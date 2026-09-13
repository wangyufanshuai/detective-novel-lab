import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { startReleaseCandidateServer } from "./lib/release-candidate-server.mjs";
import { V11_ALPHA_BROWSER_EVIDENCE_SCHEMA, sha256Json } from "./v11-alpha-evidence-lib.mjs";

const jsonMode = process.argv.includes("--json");
const outputArgument = process.argv.find((argument) => argument.startsWith("--output="))?.slice("--output=".length);
const outputPath = path.resolve(outputArgument || path.join(process.cwd(), "outputs", "v11-alpha", "browser-observability.json"));
const matrix = [];
const goldSliceMatrix = [];
const failures = [];
let serverHarness;
const presentationSource = fs.readFileSync(path.join(process.cwd(), "packages", "engine", "src", "town", "campaign-presentation.ts"), "utf8");
const readyAudioBlock = presentationSource.match(/const READY_AUDIO_PATHS = new Set<string>\(\[([\s\S]*?)\]\);/);
const readyAudioTrackCount = /const READY_AUDIO_PATHS = new Set<string>\(\);/.test(presentationSource)
  ? 0
  : readyAudioBlock
    ? [...readyAudioBlock[1].matchAll(/["']\/noir-archive\/.+?["']/g)].length
    : Number.NaN;

function launchOptions() {
  // Use the installed Chrome channel on Windows sessions where the bundled
  // Playwright Chromium binary is present but returns `spawn UNKNOWN`.
  return { headless: true, channel: "chrome" };
}

function statusFor(predicate) {
  return predicate ? "automated-pass" : "failed";
}

async function dismissOnboardingIfPresent(page) {
  const onboarding = page.getByTestId("onboarding-overlay");
  const initiallyVisible = await onboarding.isVisible().catch(() => false);
  if (initiallyVisible) {
    await onboarding.locator(".closeButton").click();
    await onboarding.waitFor({ state: "hidden", timeout: 5_000 });
  }
  return initiallyVisible;
}

async function inspectPage(page, input) {
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  const httpErrors = [];
  const requests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 240));
  });
  page.on("pageerror", (error) => pageErrors.push(error.message.slice(0, 240)));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === input.baseUrl) requests.push({ method: request.method(), pathname: url.pathname, resourceType: request.resourceType() });
  });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (url.origin === input.baseUrl) requestFailures.push({ pathname: url.pathname, error: request.failure()?.errorText || "request failed" });
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    const url = new URL(response.url());
    if (url.origin === input.baseUrl) httpErrors.push({ pathname: url.pathname, status: response.status() });
  });

  await page.goto(`${input.baseUrl}/?runtime=${input.runtime}&lang=${input.locale}`, { waitUntil: "networkidle" });
  const frontDoor = page.getByTestId("campaign-front-door");
  await frontDoor.waitFor({ state: "visible", timeout: 15_000 });
  const onboardingInitiallyVisible = await dismissOnboardingIfPresent(page);
  const measurements = await page.evaluate(() => {
    const dialog = document.querySelector("[data-testid='campaign-front-door']");
    const active = document.activeElement;
    const parseTimeList = (value) => value.split(",").map((item) => {
      const trimmed = item.trim();
      return trimmed.endsWith("ms") ? Number.parseFloat(trimmed) : Number.parseFloat(trimmed) * 1000;
    }).filter(Number.isFinite);
    const motionNodes = dialog ? [dialog, ...dialog.querySelectorAll("*")] : [];
    const motionDurations = motionNodes.flatMap((node) => {
      const style = getComputedStyle(node);
      return [...parseTimeList(style.transitionDuration), ...parseTimeList(style.animationDuration)];
    });
    const overflowOffenders = Array.from(document.body.querySelectorAll("*")).map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        tag: node.tagName.toLowerCase(),
        testId: node.getAttribute("data-testid") || "",
        className: typeof node.className === "string" ? node.className.split(" ").filter(Boolean).slice(0, 2).join(".") : "",
        rightOverflowPx: Math.max(0, Math.round(rect.right - window.innerWidth)),
        leftOverflowPx: Math.max(0, Math.round(-rect.left))
      };
    }).filter((item) => item.rightOverflowPx > 1 || item.leftOverflowPx > 1).slice(0, 8);
    return {
      lang: document.documentElement.lang,
      overflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      overflowOffenders,
      activeElement: {
        tag: active?.tagName.toLowerCase() || "none",
        id: active?.id || "",
        testId: active?.getAttribute?.("data-testid") || ""
      },
      focusWithinFrontDoor: Boolean(dialog && active && dialog.contains(active)),
      frontDoorHeadingFocused: active?.id === "campaign-front-door-title",
      prefersReducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      maxMotionDurationMs: Math.max(0, ...motionDurations)
    };
  });
  const apiRequests = requests.filter((request) => request.pathname.startsWith("/api/"));
  const entryFailures = [];
  if (measurements.lang !== input.locale) entryFailures.push(`html lang was ${measurements.lang || "missing"}`);
  if (measurements.overflowPx > 1) entryFailures.push(`page overflowed by ${measurements.overflowPx}px`);
  if (consoleErrors.length || pageErrors.length) entryFailures.push(`${consoleErrors.length + pageErrors.length} console/page error(s)`);
  if (requestFailures.length || httpErrors.length) entryFailures.push(`${requestFailures.length + httpErrors.length} failed network response(s)`);
  if (input.runtime === "static" && apiRequests.length) entryFailures.push(`Static runtime requested ${apiRequests.length} API route(s)`);
  if (input.runtime === "server" && (!measurements.focusWithinFrontDoor || !measurements.frontDoorHeadingFocused)) entryFailures.push("Front Door heading did not own initial focus after onboarding dismissal");
  if (!measurements.prefersReducedMotion) entryFailures.push("reduced-motion media query did not match");
  if (measurements.maxMotionDurationMs > 20) entryFailures.push(`reduced-motion retained ${measurements.maxMotionDurationMs}ms transition/animation`);
  return {
    runtime: input.runtime,
    locale: input.locale,
    width: input.width,
    status: statusFor(entryFailures.length === 0),
    onboardingInitiallyVisible,
    network: {
      requestCount: requests.length,
      apiRequestCount: apiRequests.length,
      failedRequestCount: requestFailures.length,
      httpErrorCount: httpErrors.length,
      failures: [...requestFailures, ...httpErrors].slice(0, 8)
    },
    console: {
      errorCount: consoleErrors.length,
      pageErrorCount: pageErrors.length,
      examples: [...consoleErrors, ...pageErrors].slice(0, 5)
    },
    focus: {
      withinFrontDoor: measurements.focusWithinFrontDoor,
      headingFocused: measurements.frontDoorHeadingFocused,
      activeElement: measurements.activeElement
    },
    overflow: {
      pagePx: measurements.overflowPx,
      offenders: measurements.overflowOffenders
    },
    reducedMotion: {
      mediaMatches: measurements.prefersReducedMotion,
      maxDurationMs: measurements.maxMotionDurationMs
    },
    failures: entryFailures
  };
}

async function inspectKeyboard(baseUrl, browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: "reduce", colorScheme: "dark" });
  const page = await context.newPage();
  const checks = {
    headingFocusedOnOpen: false,
    tabContained: false,
    escapeCloses: false,
    enterReopens: false,
    focusRestored: false
  };
  try {
    await page.goto(`${baseUrl}/?runtime=server&lang=en-US`, { waitUntil: "networkidle" });
    const frontDoor = page.getByTestId("campaign-front-door");
    await frontDoor.waitFor({ state: "visible", timeout: 15_000 });
    await dismissOnboardingIfPresent(page);
    checks.headingFocusedOnOpen = await page.locator("#campaign-front-door-title").evaluate((node) => node === document.activeElement);
    for (let index = 0; index < 18; index += 1) await page.keyboard.press("Tab");
    checks.tabContained = await frontDoor.evaluate((node) => node.contains(document.activeElement));
    await page.keyboard.press("Escape");
    await frontDoor.waitFor({ state: "hidden", timeout: 5_000 });
    checks.escapeCloses = true;
    const reopen = page.getByTestId("open-campaign-front-door");
    await reopen.focus();
    await reopen.press("Enter");
    await frontDoor.waitFor({ state: "visible", timeout: 5_000 });
    checks.enterReopens = true;
    await page.keyboard.press("Escape");
    await frontDoor.waitFor({ state: "hidden", timeout: 5_000 });
    await page.waitForFunction(() => document.querySelector("[data-testid='open-campaign-front-door']") === document.activeElement, undefined, { timeout: 5_000 }).catch(() => undefined);
    checks.focusRestored = await reopen.evaluate((node) => node === document.activeElement);
  } finally {
    await context.close();
  }
  const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([check]) => check);
  return {
    status: statusFor(failedChecks.length === 0),
    summary: `${Object.values(checks).filter(Boolean).length}/${Object.keys(checks).length} keyboard and focus checks passed`,
    checks,
    failures: failedChecks
  };
}

async function inspectGoldSlice(baseUrl, browser, input) {
  const context = await browser.newContext({
    viewport: { width: input.width, height: input.width === 390 ? 844 : 960 },
    reducedMotion: "reduce",
    colorScheme: "dark"
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  const httpErrors = [];
  const requests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 240));
  });
  page.on("pageerror", (error) => pageErrors.push(error.message.slice(0, 240)));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === baseUrl) requests.push({ method: request.method(), pathname: url.pathname });
  });
  page.on("requestfailed", (request) => requestFailures.push({ pathname: new URL(request.url()).pathname, error: request.failure()?.errorText || "request failed" }));
  page.on("response", (response) => {
    if (response.status() >= 400) httpErrors.push({ pathname: new URL(response.url()).pathname, status: response.status() });
  });
  try {
    await page.goto(`${baseUrl}/?runtime=server&lang=${input.locale}`, { waitUntil: "networkidle" });
    const frontDoor = page.getByTestId("campaign-front-door");
    await frontDoor.waitFor({ state: "visible", timeout: 15_000 });
    await dismissOnboardingIfPresent(page);
    await frontDoor.getByTestId("campaign-front-door-card").nth(8).click();
    await frontDoor.getByTestId("campaign-front-door-route").nth(0).click();
    await frontDoor.getByTestId("campaign-front-door-start").click();
    await frontDoor.waitFor({ state: "hidden", timeout: 30_000 });
    await page.waitForTimeout(300);
    const encounterClose = page.getByTestId("character-encounter-close");
    if (await encounterClose.count()) await encounterClose.click({ force: true });
    const drawerToggle = page.getByTestId("command-deck-drawer-toggle");
    if (input.width <= 900 && await drawerToggle.count() && await drawerToggle.getAttribute("aria-expanded") !== "true") await drawerToggle.click({ force: true });
    const inspectorToggle = page.getByTestId("command-deck-inspector-toggle");
    await inspectorToggle.waitFor({ state: "visible", timeout: 15_000 });
    if (await inspectorToggle.getAttribute("aria-expanded") !== "true") await inspectorToggle.click({ force: true });
    const board = page.getByTestId("cinematic-deduction-board");
    await board.waitFor({ state: "visible", timeout: 10_000 });
    const submitTheory = board.getByTestId("cinematic-submit-theory");
    const initialTheoryDisabled = await submitTheory.isDisabled();
    const initialTheoryReason = await board.locator("#cinematic-theory-block-reason").innerText().catch(() => "");
    const motionLabels = await board.locator("ol li b").allInnerTexts();
    const contradictionStage = await board.getByTestId("cinematic-contradiction-stage").innerText();
    const commitStage = await board.getByTestId("cinematic-commit-stage").innerText();
    const lowSensoryToggle = board.getByTestId("cinematic-low-sensory-toggle");
    const feedbackStartedAt = performance.now();
    await lowSensoryToggle.click();
    await page.waitForFunction(() => document.querySelector("[data-testid='cinematic-deduction-board']")?.getAttribute("data-low-sensory") === "true", undefined, { timeout: 1_000 });
    const localFeedbackMs = Math.round((performance.now() - feedbackStartedAt) * 10) / 10;
    const measurements = await board.evaluate((node) => {
      const durationMs = (value) => value.split(",").map((part) => {
        const token = part.trim();
        return Number.parseFloat(token) * (token.endsWith("ms") ? 1 : 1000);
      }).filter(Number.isFinite);
      const descendants = [node, ...node.querySelectorAll("*")];
      const motion = descendants.flatMap((element) => {
        const style = getComputedStyle(element);
        return [...durationMs(style.animationDuration), ...durationMs(style.transitionDuration)];
      });
      const active = document.activeElement;
      const englishGoldSliceTokens = ["FOCUS", "COMMIT", "RESOLVE", "WORLD REACTION", "NEW OBJECTIVE", "Undiscovered clue", "Draft incomplete", "Join investigation", "Question a witness to establish a public statement.", "interrogation path"];
      return {
        pageOverflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        boardOverflowPx: Math.max(0, node.scrollWidth - node.clientWidth),
        campaignHeading: node.querySelector("h2")?.textContent?.trim() || "",
        motionPhase: node.getAttribute("data-motion-phase"),
        lowSensory: node.getAttribute("data-low-sensory"),
        lowSensoryFocused: active?.getAttribute?.("data-testid") === "cinematic-low-sensory-toggle",
        maxMotionDurationMs: Math.max(0, ...motion),
        certifiedActionCount: node.querySelectorAll("[data-testid='cinematic-certified-action']").length,
        challengeActionCount: node.querySelectorAll("[data-testid='cinematic-challenge-action']").length,
        theoryActionCount: node.querySelectorAll("[data-testid='cinematic-submit-theory']").length,
        authorityNoteVisible: Boolean(node.lastElementChild?.textContent?.includes("truth") || node.lastElementChild?.textContent?.includes("真相")),
        residualEnglishTokens: englishGoldSliceTokens.filter((token) => node.innerText.includes(token))
      };
    });
    const audioRequests = requests.filter((request) => /\.(?:opus|mp3)$/i.test(request.pathname));
    let rapidAction = { checked: false, authoritativeDispatchCount: null, passed: null, actionLabel: "" };
    let postSearchLocalization = { checked: false, actionLabels: [], residualEnglishTokens: [], missingChineseTokens: [] };
    if (input.locale === "en-US" && input.width === 1440) {
      const certifiedAction = board.getByTestId("cinematic-certified-action");
      rapidAction.actionLabel = (await certifiedAction.innerText()).trim();
      const writesBefore = requests.filter((request) => !["GET", "HEAD", "OPTIONS"].includes(request.method)).length;
      await certifiedAction.evaluate((button) => { button.click(); button.click(); });
      await page.waitForTimeout(750);
      const writesAfter = requests.filter((request) => !["GET", "HEAD", "OPTIONS"].includes(request.method)).length;
      rapidAction = { ...rapidAction, checked: true, authoritativeDispatchCount: writesAfter - writesBefore, passed: writesAfter - writesBefore === 1 };
    }
    if (input.locale === "zh-CN" && input.width === 1440) {
      const certifiedAction = page.getByTestId("strategic-primary-action");
      const actionLabels = [];
      await certifiedAction.click();
      await page.waitForTimeout(2_500);
      actionLabels.push((await certifiedAction.innerText()).trim());
      await certifiedAction.click();
      await page.waitForTimeout(2_500);
      actionLabels.push((await certifiedAction.innerText()).trim());
      // Join and Observe are strategic command-deck actions. Once the route
      // reaches Search, execute the board's certified action so the flow
      // exercises the actual map/evidence handler instead of dispatching the
      // same strategic primary action a third time.
      if (await inspectorToggle.getAttribute("aria-expanded") !== "true") await inspectorToggle.click({ force: true });
      await board.waitFor({ state: "visible", timeout: 10_000 });
      const boardSearchAction = board.getByTestId("cinematic-certified-action");
      await boardSearchAction.click();
      await page.waitForTimeout(2_500);
      actionLabels.push((await boardSearchAction.innerText()).trim());
      const bodyText = await page.locator("body").innerText();
      const criticalEnglishTokens = [
        "Search the next linked scene",
        "Search the linked scene for a required clue.",
        "Search operation resolved",
        "No reserved capacity spent;",
        "Certified investigation progress was preserved",
        "Choose World Lead response",
        "Prioritize the next legal certified witness question.",
        "Selected discovered clue.",
        "Add clue to theory",
        "Open theory workspace",
        "Evidence found: Restricted type block",
        "Restricted type block",
        "Guided Journal",
        "Investigation session opened.",
        "World Event"
      ];
      const requiredChineseTokens = [
        "搜索下一个关联现场",
        "在关联现场搜索一条必要线索。",
        "搜索行动已结算",
        "已发现证据：",
        "把线索加入理论",
        "打开理论工作区",
        "引导日志",
        "世界事件"
      ];
      postSearchLocalization = {
        checked: true,
        actionLabels,
        residualEnglishTokens: criticalEnglishTokens.filter((token) => bodyText.includes(token)),
        missingChineseTokens: requiredChineseTokens.filter((token) => !bodyText.includes(token))
      };
    }
    const expectedHeading = input.locale === "zh-CN" ? "午夜合唱" : "Midnight Chorus";
    const entryFailures = [];
    if (measurements.campaignHeading !== expectedHeading) entryFailures.push(`campaign heading was ${measurements.campaignHeading || "missing"}`);
    if (measurements.motionPhase !== "focus") entryFailures.push(`initial motion phase was ${measurements.motionPhase || "missing"}`);
    if (measurements.lowSensory !== "true") entryFailures.push("Low Sensory did not persist its pressed state");
    if (!measurements.lowSensoryFocused) entryFailures.push("Low Sensory toggle did not retain keyboard focus");
    if (localFeedbackMs >= 150) entryFailures.push(`local Low Sensory feedback took ${localFeedbackMs}ms`);
    if (measurements.maxMotionDurationMs > 20) entryFailures.push(`Low Sensory retained ${measurements.maxMotionDurationMs}ms motion`);
    if (measurements.pageOverflowPx > 1 || measurements.boardOverflowPx > 1) entryFailures.push(`gold slice overflowed page/board by ${measurements.pageOverflowPx}/${measurements.boardOverflowPx}px`);
    if (measurements.certifiedActionCount !== 1 || measurements.challengeActionCount !== 1 || measurements.theoryActionCount !== 1) entryFailures.push("gold slice action ownership was incomplete");
    if (!measurements.authorityNoteVisible) entryFailures.push("authority isolation note was not visible");
    if (!initialTheoryDisabled || !initialTheoryReason.trim()) entryFailures.push("initial incomplete Theory did not expose a disabled action with a reason");
    if (input.locale === "zh-CN") {
      if (motionLabels.join("|") !== "定位|承诺|裁定|世界反应|新目标") entryFailures.push(`Chinese motion grammar retained unexpected stage copy: ${motionLabels.join("|")}`);
      if (contradictionStage !== "02 / 矛盾循环" || commitStage !== "03 / 承诺") entryFailures.push(`Chinese gold-slice stage copy was ${contradictionStage} / ${commitStage}`);
      if (measurements.residualEnglishTokens.length) entryFailures.push(`Chinese gold slice retained English UI tokens: ${measurements.residualEnglishTokens.join(", ")}`);
    }
    if (!Number.isFinite(readyAudioTrackCount)) entryFailures.push("ready audio manifest count could not be read");
    if (readyAudioTrackCount === 0 && audioRequests.length) entryFailures.push(`planned-only audio requested ${audioRequests.length} Opus/MP3 file(s)`);
    if (rapidAction.checked && !rapidAction.passed) entryFailures.push(`rapid duplicate action produced ${rapidAction.authoritativeDispatchCount} authoritative dispatches`);
    if (postSearchLocalization.checked && postSearchLocalization.residualEnglishTokens.length) entryFailures.push(`Chinese post-search flow retained English UI tokens: ${postSearchLocalization.residualEnglishTokens.join(", ")}`);
    if (postSearchLocalization.checked && postSearchLocalization.missingChineseTokens.length) entryFailures.push(`Chinese post-search flow missed required UI tokens: ${postSearchLocalization.missingChineseTokens.join(", ")}`);
    if (consoleErrors.length || pageErrors.length) entryFailures.push(`${consoleErrors.length + pageErrors.length} console/page error(s)`);
    if (requestFailures.length || httpErrors.length) entryFailures.push(`${requestFailures.length + httpErrors.length} failed network response(s)`);
    return {
      locale: input.locale,
      width: input.width,
      status: statusFor(entryFailures.length === 0),
      measurements,
      localFeedbackMs,
      theoryGate: { initialDisabled: initialTheoryDisabled, reason: initialTheoryReason },
      localization: { motionLabels, contradictionStage, commitStage, postSearch: postSearchLocalization },
      audio: { readyTrackCount: readyAudioTrackCount, requestCount: audioRequests.length, requests: audioRequests.slice(0, 8) },
      rapidAction,
      network: { requestCount: requests.length, failedRequestCount: requestFailures.length, httpErrorCount: httpErrors.length, failures: [...requestFailures, ...httpErrors].slice(0, 8) },
      console: { errorCount: consoleErrors.length, pageErrorCount: pageErrors.length, examples: [...consoleErrors, ...pageErrors].slice(0, 5) },
      failures: entryFailures
    };
  } finally {
    await context.close();
  }
}

try {
  if (!fs.existsSync(path.join(process.cwd(), ".next", "BUILD_ID"))) throw new Error("Run npm.cmd run build before v11 Alpha browser observability.");
  serverHarness = await startReleaseCandidateServer({
    prefix: "v11-alpha-browser-observability",
    healthPath: "/?runtime=static&lang=en-US",
    env: { AI_PROVIDER: "mock", DEEPSEEK_API_KEY: "", SILICONFLOW_API_KEY: "" }
  });
  const browser = await chromium.launch(launchOptions());
  let keyboard;
  try {
    for (const runtime of ["static", "server"]) {
      for (const locale of ["en-US", "zh-CN"]) {
        for (const width of [390, 768, 1440]) {
          const context = await browser.newContext({
            viewport: { width, height: width === 390 ? 844 : 960 },
            reducedMotion: "reduce",
            colorScheme: "dark"
          });
          const page = await context.newPage();
          try {
            const entry = await inspectPage(page, { baseUrl: serverHarness.baseUrl, runtime, locale, width });
            matrix.push(entry);
            for (const failure of entry.failures) failures.push(`${runtime}/${locale}/${width}: ${failure}`);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            matrix.push({ runtime, locale, width, status: "failed", failures: [message] });
            failures.push(`${runtime}/${locale}/${width}: ${message}`);
          } finally {
            await context.close();
          }
        }
      }
    }
    keyboard = await inspectKeyboard(serverHarness.baseUrl, browser);
    for (const failure of keyboard.failures) failures.push(`keyboard: ${failure}`);
    for (const locale of ["en-US", "zh-CN"]) {
      for (const width of [390, 768, 1440]) {
        try {
          const entry = await inspectGoldSlice(serverHarness.baseUrl, browser, { locale, width });
          goldSliceMatrix.push(entry);
          for (const failure of entry.failures) failures.push(`gold-slice/${locale}/${width}: ${failure}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          goldSliceMatrix.push({ locale, width, status: "failed", failures: [message] });
          failures.push(`gold-slice/${locale}/${width}: ${message}`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  const checks = {
    network: {
      status: statusFor(matrix.every((entry) => entry.network && entry.network.failedRequestCount === 0 && entry.network.httpErrorCount === 0 && (entry.runtime !== "static" || entry.network.apiRequestCount === 0))),
      summary: `${matrix.reduce((sum, entry) => sum + (entry.network?.requestCount || 0), 0)} local requests; ${matrix.reduce((sum, entry) => sum + (entry.network?.failedRequestCount || 0) + (entry.network?.httpErrorCount || 0), 0)} failures`
    },
    console: {
      status: statusFor(matrix.every((entry) => entry.console && entry.console.errorCount === 0 && entry.console.pageErrorCount === 0)),
      summary: `${matrix.reduce((sum, entry) => sum + (entry.console?.errorCount || 0) + (entry.console?.pageErrorCount || 0), 0)} console/page errors`
    },
    overflow: {
      status: statusFor(matrix.every((entry) => entry.overflow && entry.overflow.pagePx <= 1)),
      summary: `max ${Math.max(0, ...matrix.map((entry) => entry.overflow?.pagePx || 0))}px page overflow`
    },
    focus: {
      status: statusFor(matrix.filter((entry) => entry.runtime === "server").every((entry) => entry.focus && entry.focus.withinFrontDoor && entry.focus.headingFocused)),
      summary: `${matrix.filter((entry) => entry.runtime === "server" && entry.focus?.headingFocused).length}/${matrix.filter((entry) => entry.runtime === "server").length} Server matrix entries focused the Front Door heading`
    },
    reducedMotion: {
      status: statusFor(matrix.every((entry) => entry.reducedMotion && entry.reducedMotion.mediaMatches && entry.reducedMotion.maxDurationMs <= 20)),
      summary: `max ${Math.max(0, ...matrix.map((entry) => entry.reducedMotion?.maxDurationMs || 0))}ms transition/animation under reduced motion`
    },
    keyboard,
    goldSlice: {
      status: statusFor(goldSliceMatrix.length === 6 && goldSliceMatrix.every((entry) => entry.status === "automated-pass")),
      summary: `${goldSliceMatrix.filter((entry) => entry.status === "automated-pass").length}/6 Midnight Chorus gold-slice entries passed bilingual copy, Theory gating, planned-audio silence, rapid-action exclusion, responsive, <150ms local feedback, Low Sensory, focus, network, console, and authority checks`
    }
  };
  const evidenceBody = {
    status: statusFor(failures.length === 0),
    summary: { entries: matrix.length, passed: matrix.filter((entry) => entry.status === "automated-pass").length, failed: matrix.filter((entry) => entry.status === "failed").length },
    checks,
    matrix,
    goldSliceMatrix,
    failures
  };
  const result = {
    schema: V11_ALPHA_BROWSER_EVIDENCE_SCHEMA,
    generatedAt: new Date().toISOString(),
    ...evidenceBody,
    evidenceHash: sha256Json(evidenceBody)
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(jsonMode ? JSON.stringify({ ok: result.status === "automated-pass", output: path.relative(process.cwd(), outputPath), summary: result.summary, checks, failures }) : `v11 Alpha browser observability: ${result.status}`);
  if (result.status !== "automated-pass") process.exitCode = 1;
} catch (error) {
  const evidenceBody = {
    status: "failed",
    summary: { entries: matrix.length, passed: 0, failed: matrix.length || 1 },
    checks: {},
    matrix,
    goldSliceMatrix,
    failures: [error instanceof Error ? error.message : String(error)]
  };
  const result = {
    schema: V11_ALPHA_BROWSER_EVIDENCE_SCHEMA,
    generatedAt: new Date().toISOString(),
    ...evidenceBody,
    evidenceHash: sha256Json(evidenceBody)
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(jsonMode ? JSON.stringify({ ok: false, output: path.relative(process.cwd(), outputPath), failures: result.failures }) : result.failures.join("\n"));
  process.exitCode = 1;
} finally {
  await serverHarness?.cleanup();
}
