import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { chromium } from "@playwright/test";

function chromiumLaunchOptions() {
  const expected = chromium.executablePath();
  if (fs.existsSync(expected)) return { headless: true, executablePath: expected };
  const browserRoot = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(process.env.LOCALAPPDATA || "", "ms-playwright");
  const executableName = process.platform === "win32" ? "chrome.exe" : "chrome";
  const platformDirectory = process.platform === "win32" ? "chrome-win64" : "chrome-linux";
  if (!fs.existsSync(browserRoot)) return { headless: true };
  const candidates = fs.readdirSync(browserRoot)
    .filter((name) => name.startsWith("chromium-") && !name.includes("headless"))
    .sort()
    .reverse()
    .map((name) => path.join(browserRoot, name, platformDirectory, executableName));
  const executablePath = candidates.find((candidate) => fs.existsSync(candidate));
  return executablePath ? { headless: true, executablePath } : { headless: true };
}

function findAvailableLocalPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function resolveBaseUrl() {
  const requested = argValue("url");
  if (requested) return requested.replace(/\/$/, "");
  // A generic response on :3000 may belong to another local Next.js project
  // or to a stale build. An isolated ephemeral port makes the default QA run
  // project-owned; callers can still opt into a known server with --url.
  return `http://127.0.0.1:${await findAvailableLocalPort()}`;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function get(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      response.resume();
      response.on("end", () => resolve({ ok: true, status: response.statusCode || 0 }));
    });
    request.on("timeout", () => {
      request.destroy();
      resolve({ ok: false, status: 0 });
    });
    request.on("error", () => resolve({ ok: false, status: 0 }));
  });
}

async function waitForServer(baseUrl, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await get(`${baseUrl}/?runtime=static`);
    if (result.ok && result.status >= 200 && result.status < 500) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

function stopServerChild(child) {
  if (!child) return;
  if (process.platform === "win32" && child.pid) {
    try {
      execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      return;
    } catch {}
  }
  child.kill();
}

function latestInputMtime(target) {
  if (!fs.existsSync(target)) return 0;
  const stat = fs.statSync(target);
  if (stat.isFile()) return stat.mtimeMs;
  return fs.readdirSync(target, { withFileTypes: true }).reduce((latest, entry) => {
    if (entry.name === "node_modules" || entry.name === ".next") return latest;
    return Math.max(latest, latestInputMtime(path.join(target, entry.name)));
  }, stat.mtimeMs);
}

function hasFreshProductionBuild() {
  const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
  if (!fs.existsSync(buildIdPath)) return false;
  const buildMtime = fs.statSync(buildIdPath).mtimeMs;
  const inputs = ["app", "packages", "content", "package.json", "next.config.ts", "tsconfig.json"]
    .map((entry) => path.join(process.cwd(), entry));
  return inputs.every((entry) => latestInputMtime(entry) <= buildMtime);
}

async function ensureServer(baseUrl) {
  const existing = await get(`${baseUrl}/?runtime=static`);
  if (existing.ok && existing.status >= 200 && existing.status < 500) return { started: false, child: null };
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const parsedUrl = new URL(baseUrl);
  const port = parsedUrl.port || (parsedUrl.protocol === "https:" ? "443" : "80");
  const serverScript = hasFlag("dev") ? "dev" : hasFlag("production") || hasFreshProductionBuild() ? "start" : "dev";
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", `npm.cmd run ${serverScript} -- -H 127.0.0.1 -p ${port}`]
    : ["run", serverScript, "--", "-H", "127.0.0.1", "-p", port];
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, NEXT_PUBLIC_DEMO_MODE: "static" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let startupOutput = "";
  const collectStartupOutput = (chunk) => {
    startupOutput = `${startupOutput}${String(chunk)}`.slice(-8000);
  };
  child.stdout?.on("data", collectStartupOutput);
  child.stderr?.on("data", collectStartupOutput);
  const ready = await waitForServer(baseUrl);
  if (!ready) {
    stopServerChild(child);
    const detail = startupOutput.trim().replace(/\s+/g, " ").slice(-1600);
    throw new Error(`Timed out waiting for local ${serverScript} server on port ${port}.${detail ? ` Startup output: ${detail}` : ""}`);
  }
  return { started: true, child, serverScript };
}

async function waitForGuidedStepIdle(page, timeout = 18000) {
  await page.waitForFunction(
    () => !/running guided step/i.test(document.querySelector("[data-testid='run-next-guided-step']")?.textContent || ""),
    undefined,
    { timeout }
  ).catch(() => undefined);
  return settleCampaignTransitionTheatre(page);
}

async function settleCampaignTransitionTheatre(page, waitMs = 1800) {
  if (new URL(page.url()).searchParams.get("runtime") !== "server") return { seen: false, text: "", controlHeight: 0 };
  const theatre = page.getByTestId("campaign-transition-theatre");
  if (!await theatre.isVisible().catch(() => false)) {
    await theatre.waitFor({ state: "visible", timeout: waitMs }).catch(() => undefined);
  }
  if (!await theatre.isVisible().catch(() => false)) return { seen: false, text: "", controlHeight: 0 };
  const text = await theatre.innerText();
  const controlHeight = await theatre.locator("button").first().evaluate((node) => node.getBoundingClientRect().height).catch(() => 0);
  await page.waitForFunction(() => {
    const phase = document.querySelector("[data-testid='campaign-transition-theatre']")?.getAttribute("data-transition-phase");
    return !phase || phase !== "action-resolving";
  }, undefined, { timeout: 30_000 }).catch(() => undefined);
  if (await theatre.isVisible().catch(() => false)) {
    const skip = theatre.getByRole("button", { name: "Skip to next" });
    if (await skip.isVisible().catch(() => false)) await skip.click();
  }
  if (await theatre.isVisible().catch(() => false)) {
    await page.waitForFunction(() => document.querySelector("[data-testid='campaign-transition-theatre']")?.getAttribute("data-transition-phase") === "next-objective", undefined, { timeout: 10_000 }).catch(() => undefined);
    const continueButton = theatre.getByRole("button", { name: "Continue" });
    if (await continueButton.isVisible().catch(() => false)) await continueButton.click();
  }
  await theatre.waitFor({ state: "detached", timeout: 10_000 }).catch(() => undefined);
  await openCommandDeckInspectorDetail(page);
  return { seen: true, text, controlHeight };
}

async function openWorldCampaignArchive(page) {
  const archive = page.getByTestId("world-campaign-archive");
  if (!await archive.count()) return false;
  if (!await archive.evaluate((node) => node instanceof HTMLDetailsElement && node.open)) {
    await archive.locator(":scope > summary").click();
  }
  return archive.evaluate((node) => node instanceof HTMLDetailsElement && node.open);
}

async function waitForCommandButtonReady(button, timeout = 30000) {
  await button.waitFor({ state: "visible", timeout });
  await button.page().waitForFunction(
    (element) => element instanceof HTMLButtonElement && !element.disabled,
    await button.elementHandle(),
    { timeout }
  );
}

async function runUntilManualTheoryDrill(page, maxClicks = 12) {
  for (let index = 0; index < maxClicks; index += 1) {
    if (await page.getByTestId("manual-theory-drill").isVisible().catch(() => false)) return;
    await page.getByTestId("run-next-guided-step").click();
    await waitForGuidedStepIdle(page);
    await page.waitForTimeout(650);
  }
  await page.getByTestId("manual-theory-drill").waitFor({ state: "visible", timeout: 30000 });
}

async function fillManualTheoryDrill(page) {
  await page.getByTestId("manual-theory-drill").waitFor({ state: "visible", timeout: 30000 });
  const suspectSelect = page.getByTestId("manual-theory-culprit");
  const suspectValue = await suspectSelect.locator("option").evaluateAll((options) => {
    const option = options.find((item) => item.value);
    return option?.value || "";
  });
  if (suspectValue) await suspectSelect.selectOption(suspectValue);
  await page.getByTestId("manual-theory-motive").fill("manual motive hypothesis from discovered clues");
  await page.getByTestId("manual-theory-method").fill("manual method hypothesis from discovered clues");
}

async function completeManualTheoryReplay(page) {
  await runUntilManualTheoryDrill(page);
  await page.getByText("Manual Theory Drill", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  const manualTheoryDrillTextBeforeFill = await page.getByTestId("manual-theory-drill").innerText();
  await fillManualTheoryDrill(page);
  await page.waitForTimeout(400);
  const manualTheoryDrillTextAfterFill = await page.getByTestId("manual-theory-drill").innerText();
  const replayPracticeLoopTextAfterManualTheoryFill = await page.getByTestId("replay-practice-loop").innerText();
  const guidedStepJournalTextAfterManualTheoryFill = await page.getByTestId("guided-step-journal").innerText();
  const replayAttemptScorecardTextAfterManualTheoryFill = await page.getByTestId("replay-attempt-scorecard").innerText();
  await page.getByTestId("run-next-guided-step").click();
  await waitForGuidedStepIdle(page);
  await page.waitForTimeout(850);
  const manualTheoryDrillTextAfterBlockedSubmit = await page.getByTestId("manual-theory-drill").innerText();
  const replayPracticeLoopTextAfterBlockedSubmit = await page.getByTestId("replay-practice-loop").innerText();
  const finalWorkspaceRecovery = await page.getByTestId("final-detective-workspace").evaluate((node) => ({
    stage: node.getAttribute("data-workspace-stage") || "",
    theoryState: node.querySelector("[data-testid='final-workspace-theory']")?.getAttribute("data-theory-state") || "",
    recoveryVisible: Boolean(node.querySelector("[data-testid='final-workspace-recovery']")),
    actionKind: node.querySelector("[data-testid='final-workspace-primary-action']")?.getAttribute("data-action-kind") || ""
  }));
  let campaignRecoveryTextReady = "";
  let campaignRecoveryTextCompleted = "";
  let finalWorkspacePostRecoveryActionKind = finalWorkspaceRecovery.actionKind;
  const campaignRecoveryStart = page.getByTestId("campaign-recovery-start");
  if (await campaignRecoveryStart.isVisible().catch(() => false)) {
    campaignRecoveryTextReady = await page.getByTestId("campaign-recovery").innerText();
    await campaignRecoveryStart.click();
    await settleCampaignTransitionTheatre(page);
    await openWorldCampaignArchive(page);
    await page.getByTestId("campaign-recovery").getByText("completed", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
    campaignRecoveryTextCompleted = await page.getByTestId("campaign-recovery").innerText();
    finalWorkspacePostRecoveryActionKind = await page.getByTestId("final-workspace-primary-action").getAttribute("data-action-kind") || "";
  }
  await page.getByTestId("manual-theory-fallback").click();
  await page.waitForTimeout(400);
  const manualTheoryDrillTextAfterFallback = await page.getByTestId("manual-theory-drill").innerText();
  const replayPracticeLoopTextAfterFallback = await page.getByTestId("replay-practice-loop").innerText();
  const guidedStepJournalTextAfterManualTheoryFallback = await page.getByTestId("guided-step-journal").innerText();
  const replayAttemptScorecardTextAfterManualTheoryFallback = await page.getByTestId("replay-attempt-scorecard").innerText();
  await page.getByTestId("run-next-guided-step").click();
  await waitForGuidedStepIdle(page);
  await page.waitForTimeout(900);
  await page.getByText(/completed replay delta/i).first().waitFor({ state: "visible", timeout: 30000 });
  const replayPracticeLoopTextCompleted = await page.getByTestId("replay-practice-loop").innerText();
  const finalWorkspaceResolved = await page.getByTestId("final-detective-workspace").evaluate((node) => ({
    stage: node.getAttribute("data-workspace-stage") || "",
    theoryState: node.querySelector("[data-testid='final-workspace-theory']")?.getAttribute("data-theory-state") || "",
    sourceReviewVisible: Boolean(node.querySelector("[data-testid='source-review-workbench']")),
    ledgerVisible: Boolean(node.querySelector("[data-testid='final-workspace-latest-resolution']")),
    primaryCount: node.querySelectorAll("[data-testid='final-workspace-primary-action']").length
  }));
  return {
    manualTheoryDrillTextBeforeFill,
    manualTheoryDrillTextAfterFill,
    manualTheoryDrillTextAfterBlockedSubmit,
    manualTheoryDrillTextAfterFallback,
    replayPracticeLoopTextAfterManualTheoryFill,
    replayPracticeLoopTextAfterBlockedSubmit,
    replayPracticeLoopTextAfterFallback,
    replayPracticeLoopTextCompleted,
    guidedStepJournalTextAfterManualTheoryFill,
    guidedStepJournalTextAfterManualTheoryFallback,
    replayAttemptScorecardTextAfterManualTheoryFill,
    replayAttemptScorecardTextAfterManualTheoryFallback,
    campaignRecoveryTextReady,
    campaignRecoveryTextCompleted,
    finalWorkspaceRecovery,
    finalWorkspacePostRecoveryActionKind,
    finalWorkspaceResolved
  };
}

async function keepCommandDeckSectionsOpen(page) {
  await page.getByTestId("command-deck-shell").waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(350);
  await page.evaluate(() => {
    const openSections = () => {
      document.querySelectorAll("details[data-command-deck-collapsible]").forEach((element) => {
        if (element instanceof HTMLDetailsElement) element.open = true;
      });
    };
    openSections();
    if (!window.__commandDeckQaObserver) {
      const observer = new MutationObserver(openSections);
      observer.observe(document.body, { childList: true, subtree: true });
      window.__commandDeckQaObserver = observer;
    }
  });
}

async function openCommandDeckInspectorDetail(page) {
  const detailToggle = page.getByRole("button", { name: /Case files & detail/i });
  const contextToggle = page.getByTestId("command-deck-drawer-toggle");
  if (await contextToggle.isVisible().catch(() => false) && await contextToggle.getAttribute("aria-expanded") !== "true") await contextToggle.click();
  await detailToggle.waitFor({ state: "visible", timeout: 30_000 });
  if (await detailToggle.getAttribute("aria-expanded") !== "true") await detailToggle.click();
}

async function dismissCommandDeckOnboarding(page) {
  const dismiss = page.locator("[data-testid='onboarding-overlay'] .closeButton");
  await page.locator("[data-testid='onboarding-overlay']").waitFor({ state: "visible", timeout: 4000 }).catch(() => undefined);
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
  await openCommandDeckInspectorDetail(page);
}

async function verifyStaticPage(page, baseUrl) {
  const requests = [];
  const consoleErrors = [];
  const pageErrors = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${baseUrl}/?runtime=static`, { waitUntil: "load" });
  await keepCommandDeckSectionsOpen(page);
  await dismissCommandDeckOnboarding(page);
  await page.getByTestId("playable-investigation-path").waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Playable Investigation Path", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Join -> Search -> Question -> Challenge -> Select Evidence -> Submit -> Review Source", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  const playablePathTextBeforeReview = await page.getByTestId("playable-investigation-path").innerText();
  await page.getByTestId("playable-path-next-action").click();
  await page.getByTestId("guided-manual-run").waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("world-lead-panel").waitFor({ state: "visible", timeout: 30000 });
  const staticWorldLeadText = await page.getByTestId("world-lead-panel").innerText();
  const staticWorldCurrentActionText = await page.getByTestId("world-campaign-current-action").innerText();
  const staticInfluenceBudgetText = await page.getByTestId("world-influence-budget").innerText();
  const staticResourceCommitmentText = await page.getByTestId("player-resource-commitment").innerText();
  const staticFactionRelationshipText = await page.getByTestId("faction-relationship-summary").innerText();
  const staticWorldEventOfferText = await page.getByTestId("world-event-offer").innerText();
  const staticWorldEventOfferButtons = await page.getByTestId("world-event-offer").locator("button").count();
  const staticInvestigatorProgressionText = await page.getByTestId("investigator-progression").innerText();
  const staticInvestigatorProgressionButtons = await page.getByTestId("investigator-progression").locator("button").count();
  const staticCampaignRecoveryText = await page.getByTestId("campaign-recovery").innerText();
  const staticCampaignRecoveryButtons = await page.getByTestId("campaign-recovery").locator("button").count();
  const staticInvestigatorHeadquartersText = await page.getByTestId("investigator-headquarters").innerText();
  const staticInvestigatorHeadquartersButtons = await page.getByTestId("investigator-headquarters").locator("button").count();
  const staticArcConvergenceText = await page.getByTestId("arc-convergence").innerText();
  const staticArcConvergenceButtons = await page.getByTestId("arc-convergence").locator("button").count();
  const staticCampaignSessionText = await page.getByTestId("campaign-session").innerText();
  const staticCampaignSessionButtons = await page.getByTestId("campaign-session").locator("button").count();
  const staticCampaignPacingText = await page.getByTestId("campaign-pacing").innerText();
  const staticCampaignPacingButtons = await page.getByTestId("campaign-pacing").locator("button").count();
  const staticCampaignTransitionText = await page.getByTestId("campaign-transition-boundary").innerText();
  const staticCampaignTransitionButtons = await page.getByTestId("campaign-transition-boundary").locator("button").count();
  const staticCampaignTransitionTheatreCount = await page.getByTestId("campaign-transition-theatre").count();
  const staticTownSocialResponseText = await page.getByTestId("town-social-response").innerText();
  const staticTownSocialResponseButtons = await page.getByTestId("town-social-response").locator("button").count();
  await page.getByText("Guided Manual Run", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  const guidedManualTexts = [];
  for (let index = 0; index < 22; index += 1) {
    const guidedText = await page.getByTestId("guided-manual-run").innerText();
    guidedManualTexts.push(guidedText);
    if (/review source audit/i.test(guidedText) || /source review ready/i.test(guidedText) || /\baccepted\b/i.test(guidedText)) break;
    await page.getByTestId("run-next-guided-step").click();
    await page.waitForFunction(() => !/running guided step/i.test(document.querySelector("[data-testid='run-next-guided-step']")?.textContent || ""), undefined, { timeout: 12000 }).catch(() => undefined);
    await page.waitForTimeout(650);
    if (await page.getByTestId("source-review-workbench").isVisible().catch(() => false)) break;
  }
  await page.getByTestId("static-playthrough-proof").waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Static Playthrough Proof", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText(/route certified/i).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText(/challenge hits/i).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText(/selected evidence/i).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText(/covered obligations/i).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText(/completed \/ accepted theory/i).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("source-review-unlock").waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Source Review Unlock", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("source-review-unlock").getByText(/source review unlocked/i).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("source-review-unlock").getByText(/audit ready/i).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("source-review-workbench").waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("source-review-trail").getByText("Source Trail", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("source-review-obligations").getByText("Proof Obligations", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("source-review-route").getByText("Certified Route", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("source-review-conclusion").getByText("Conclusion Review", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("solved-case-debrief").waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Solved Case Debrief", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("replay-goal-coach").waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Replay Goal Coach", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("replay-practice-loop").waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Replay Practice Loop", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("replay-attempt-scorecard").waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Replay Attempt Scorecard", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  const staticPlaythroughTextBeforeReview = await page.getByTestId("static-playthrough-proof").innerText();
  const guidedManualTextBeforeReview = guidedManualTexts.join("\n---\n") + "\n---\n" + await page.getByTestId("guided-manual-run").innerText();
  await page.getByTestId("guided-step-journal").waitFor({ state: "visible", timeout: 30000 });
  const guidedStepJournalTextBeforeReview = await page.getByTestId("guided-step-journal").innerText();
  const sourceReviewTextBeforeReview = await page.getByTestId("source-review-unlock").innerText();
  const solvedCaseDebriefTextBeforeReview = await page.getByTestId("solved-case-debrief").innerText();
  const replayPracticeLoopTextBeforeAttempt = await page.getByTestId("replay-practice-loop").innerText();
  const replayGoalCoachTextBeforeAttempt = await page.getByTestId("replay-goal-coach").innerText();
  const replayAttemptScorecardTextBeforeAttempt = await page.getByTestId("replay-attempt-scorecard").innerText();
  await page.getByTestId("start-replay-attempt").click();
  await page.getByText(/replay attempt active/i).first().waitFor({ state: "visible", timeout: 30000 });
  const replayPracticeLoopTextAfterAttempt = await page.getByTestId("replay-practice-loop").innerText();
  const replayGoalCoachTextAfterAttempt = await page.getByTestId("replay-goal-coach").innerText();
  await page.getByText(/pending replay delta/i).first().waitFor({ state: "visible", timeout: 30000 });
  const replayAttemptScorecardTextPending = await page.getByTestId("replay-attempt-scorecard").innerText();
  const guidedManualTextAfterReplayAttempt = await page.getByTestId("guided-manual-run").innerText();
  for (let index = 0; index < 22; index += 1) {
    const guidedText = await page.getByTestId("guided-manual-run").innerText();
    if (/select-evidence/i.test(guidedText) && await page.getByTestId("manual-evidence-drill").isVisible().catch(() => false)) break;
    if (/review source audit/i.test(guidedText) || /source review ready/i.test(guidedText) || /\baccepted\b/i.test(guidedText)) break;
    await page.getByTestId("run-next-guided-step").click();
    await page.waitForFunction(() => !/running guided step/i.test(document.querySelector("[data-testid='run-next-guided-step']")?.textContent || ""), undefined, { timeout: 12000 }).catch(() => undefined);
    await page.waitForTimeout(650);
  }
  await page.getByTestId("manual-evidence-drill").waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Manual Evidence Drill", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  const guidedManualTextAtManualDrill = await page.getByTestId("guided-manual-run").innerText();
  const manualEvidenceDrillTextBeforeAdd = await page.getByTestId("manual-evidence-drill").innerText();
  await page.getByTestId("manual-evidence-add").first().click();
  await page.waitForTimeout(400);
  const manualEvidenceDrillTextAfterFirstAdd = await page.getByTestId("manual-evidence-drill").innerText();
  for (let index = 0; index < 8; index += 1) {
    const addCount = await page.getByTestId("manual-evidence-add").count().catch(() => 0);
    if (!addCount) break;
    await page.getByTestId("manual-evidence-add").first().click();
    await page.waitForTimeout(250);
  }
  const manualEvidenceDrillTextAfterAdd = await page.getByTestId("manual-evidence-drill").innerText();
  const guidedStepJournalTextAfterManualDrill = await page.getByTestId("guided-step-journal").innerText();
  const replayPracticeLoopTextAfterManualDrill = await page.getByTestId("replay-practice-loop").innerText();
  const replayAttemptScorecardTextAfterManualDrill = await page.getByTestId("replay-attempt-scorecard").innerText();
  const guidedManualTextAfterManualDrill = await page.getByTestId("guided-manual-run").innerText();
  const staticManualTheoryReplay = await completeManualTheoryReplay(page);
  const replayAttemptScorecardTextCompleted = await page.getByTestId("replay-attempt-scorecard").innerText();
  await page.getByRole("button", { name: "持续小镇" }).click();
  await page.getByRole("heading", { name: "Public Review Snapshot" }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Reviewer Home", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Reviewer Main Path", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("proof-strip").waitFor({ state: "visible", timeout: 30000 });
  const reviewerHomeWasVisible = await page.getByTestId("reviewer-home").isVisible();
  await page.getByText("Trust Snapshot", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Stable World Proof", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Per-seed Pass Cards", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Runtime Band", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Diagnostics Finding Counts", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Regression Delta Counts", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Deterministic Hash Comparison", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Case Quality Proof", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText(/fair-play evidence/i).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText(/non-blocking/i).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("World-System Influence Proof", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText(/bounded influence proved/i).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText(/no candidate loss/i).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Review Path", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Public Demo Vertical Slice", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("reviewer-gateway").waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("reviewer-gateway").getByRole("button", { name: /Pack/i }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("reviewer-gateway").getByRole("button", { name: /Replay/i }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("reviewer-gateway").getByRole("button", { name: /Map/i }).click();
  await page.getByTestId("world-system-overview").waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Growth Lines", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("reviewer-gateway").getByRole("button", { name: /Agent/i }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByRole("heading", { name: "Dataset Reader" }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Case Summary", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByRole("heading", { name: "Public Dataset Explorer" }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Reviewer next step", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Distribution Explorer").first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByRole("button", { name: "Case Types" }).click();
  await page.getByLabel("Search distributions").fill("murder");
  await page.getByLabel("Sort buckets").selectOption("name-asc");
  await page.getByText("murder", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByRole("button", { name: "Evidence Types" }).click();
  await page.getByLabel("Search distributions").fill("trace");
  await page.getByText("trace", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("distribution-explorer").getByRole("button", { name: "World Packages" }).click();
  await page.getByLabel("Search distributions").fill("dock");
  await page.getByText("dock-court-market-town").first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("distribution-explorer").getByRole("button", { name: "Public Case Explorer" }).click();
  await page.getByLabel("Search distributions").fill("public-case-026");
  await page.getByLabel("Sort public cases").selectOption("tick-desc");
  await page.getByLabel("Case type filter").selectOption("murder");
  await page.getByLabel("Warning status filter").selectOption("clean");
  await page.getByText("public-case-026", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Selected public case", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Evidence/Influence Summary", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Audit Boundary", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByRole("button", { name: "Gate & Audit" }).click();
  await page.getByText("Static boundary summary", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("distribution-explorer").getByRole("button", { name: "Public Case Explorer" }).click();
  await page.waitForTimeout(750);

  const summary = await page.evaluate(() => {
    const text = document.body?.innerText || "";
    const lowerText = text.toLowerCase();
    const proofStripText = document.querySelector("[data-testid='proof-strip']")?.textContent || "";
    const playablePathText = document.querySelector("[data-testid='playable-investigation-path']")?.textContent || "";
    const resolutionText = document.querySelector("[data-testid='command-deck-feedback']")?.textContent || "";
    const resolutionLabels = Array.from(document.querySelectorAll("[data-testid='command-deck-feedback'] > span > small")).map((node) => node.textContent || "");
    return {
      hasPlayableInvestigationPath: playablePathText.toLowerCase().includes("playable investigation path"),
      hasPlayableInvestigationSteps: ["Join", "Search", "Question", "Challenge", "Select Evidence", "Submit", "Review Source"].every((label) => playablePathText.includes(label)),
      hasPlayablePathBoundary: /read-only route audit/i.test(playablePathText) && /final detective workspace/i.test(playablePathText) && /existing certified adapter/i.test(playablePathText),
      hasCampaignResolutionLedger: ["Result", "World Change", "Objective Progress", "Next Action"].every((label) => resolutionLabels.includes(label)),
      hasStaticResolutionNoPersistence: document.querySelector("[data-testid='command-deck-feedback'] [data-resolution-field='worldChange'] b")?.textContent === "No persistent world change",
      hasCampaignResolutionNoRawIds: !/\b(?:npc|case|event|source|location|institution|resource|evidence|scene|session|character)-[a-z0-9-]*\d[a-z0-9-]*\b|culpritId|victimId|hiddenTruth|rawBody|sourceId|[A-Za-z]:[\\/]/i.test(resolutionText),
      hasReviewerHome: /Reviewer\s+Home/.test(text),
      hasReviewerMainPath: text.includes("Reviewer Main Path"),
      hasTrustSnapshot: text.includes("Trust Snapshot"),
      hasStableWorldProof: text.includes("Stable World Proof"),
      hasStableWorldSeeds: text.includes("3 seeds"),
      hasStableWorldTicks: text.includes("1000 ticks"),
      hasStableWorldDiagnostics: /diagnostics/i.test(text),
      hasStableWorldRegression: /regression/i.test(text),
      hasStableWorldNoBlockers: text.includes("no blockers"),
      hasStableWorldDrilldown: text.includes("Per-seed Pass Cards") && text.includes("Runtime Band") && text.includes("Diagnostics Finding Counts") && text.includes("Regression Delta Counts") && text.includes("Deterministic Hash Comparison"),
      hasStableWorldSeedCards: text.includes("campaign-validation") && text.includes("stable-town-a") && text.includes("stable-town-b"),
      hasStableWorldRuntimeBand: text.includes("Runtime Band") && text.includes("Aggregate-only runtime range"),
      hasStableWorldCountDrilldown: text.includes("Diagnostics Finding Counts") && text.includes("Regression Delta Counts"),
      hasStableWorldHashComparison: text.includes("unique deterministic hashes") && text.includes("public summary hash"),
      hasCaseQualityProof: text.includes("Case Quality Proof") || (lowerText.includes("average score") && lowerText.includes("non-blocking")),
      hasCaseQualityScore: lowerText.includes("average score") && lowerText.includes("lowest seed score"),
      hasCaseQualityDimensions: lowerText.includes("fair-play evidence") && lowerText.includes("diversity") && lowerText.includes("continuity") && lowerText.includes("institution"),
      hasCaseQualityNonBlocking: lowerText.includes("non-blocking"),
      hasWorldSystemInfluenceProof: text.includes("World-System Influence Proof"),
      hasWorldSystemInfluenceMetrics: lowerText.includes("applied bias") && lowerText.includes("max bias") && lowerText.includes("hinted action share"),
      hasWorldSystemInfluenceSafety: lowerText.includes("no candidate loss") && lowerText.includes("public-safe") && lowerText.includes("deterministic hashes"),
      hasProofStrip: proofStripText.includes("Static Boundary") && proofStripText.includes("World-System Influence") && proofStripText.includes("Case Quality"),
      hasReviewPath: text.includes("Review Path"),
      hasGatewayPackReplayMapAgent: ["Pack", "Replay", "Map", "Agent"].every((label) => text.includes(label)),
      hasGatewayQuestions: text.includes("Is the public package trustworthy?") && text.includes("Can the world be replayed and checked?") && text.includes("Is the world wide enough to grow?") && text.includes("Do world systems affect behavior?"),
      hasWorldSystemsOverview: text.includes("Roles") && text.includes("Locations") && text.includes("Resources") && text.includes("Factions") && text.includes("Events") && text.includes("Growth Lines"),
      hasWorldSystemCounts: (text.includes("world systems") && text.includes("system rows")) || (text.includes("6 systems") && text.includes("39")),
      hasReviewerNextStep: text.includes("Reviewer next step"),
      hasPublicReviewSnapshot: text.includes("Public Review Snapshot"),
      hasPublicDemoVerticalSlice: text.includes("Public Demo Vertical Slice"),
      hasPublicCatalog: text.includes("Public Catalog") || text.includes("Public Review Snapshot"),
      hasCatalogStep: text.includes("Catalog"),
      hasDatasetStep: text.includes("Dataset"),
      hasDatasetReader: text.includes("Dataset Reader"),
      hasCaseSummary: text.includes("Case Summary"),
      hasEvidenceDistribution: text.includes("Evidence Distribution"),
      hasAuditStatus: text.includes("Audit Status"),
      hasStaticBoundary: text.includes("Static Boundary") || text.includes("Static boundary summary") || lowerText.includes("static-only"),
      hasDistributionExplorer: text.includes("Distribution Explorer"),
      hasPublicDatasetExplorer: text.includes("Public Dataset Explorer"),
      hasPublicCaseExplorer: text.includes("Public Case Explorer"),
      hasCaseSummaryIndex: text.includes("Case Summary Index") || text.includes("case summary index"),
      hasSelectedPublicCase: text.includes("Selected public case"),
      hasEvidenceInfluenceSummary: text.includes("Evidence/Influence Summary"),
      hasAuditBoundary: text.includes("Audit Boundary"),
      hasSortPublicCases: text.includes("Sort public cases"),
      hasCaseTypeFilter: text.includes("Case type filter"),
      hasLocationFilter: text.includes("Location filter"),
      hasWarningStatusFilter: text.includes("Warning status filter"),
      hasSearchDistributions: text.includes("Search distributions"),
      hasSortControl: text.includes("Sort buckets") || text.includes("Sort public cases"),
      hasCaseTypes: text.includes("Case Types"),
      hasEvidenceTypes: text.includes("Evidence Types"),
      hasWorldPackages: text.includes("World Packages"),
      hasGateAndAudit: text.includes("Gate & Audit"),
      hasSelectedBucket: text.includes("Selected bucket") || text.includes("Selected public case"),
      hasExploreAggregates: text.includes("Explore aggregates") || text.includes("Distribution Explorer"),
      has5000: text.includes("5000"),
      hasCaseTotals: text.includes("30") && /case/i.test(text),
      hasEvidenceTotals: /evidence/i.test(text),
      hasTopDistributions: text.includes("blackmail") || text.includes("court-intimidation") || text.includes("dock-smuggling"),
      hasContentTables: text.includes("Content Tables"),
      hasStaticOnlyBoundary: text.includes("Static-only boundary") || text.includes("static-only boundary") || text.includes("Static Boundary"),
      hasRunCatalog: text.includes("RunCatalog") || text.includes("Run Catalog"),
      hasReplayBundle: text.includes("ReplayBundle") || text.includes("Replay Bundle"),
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyWidth: document.body?.scrollWidth || 0
    };
  });
  summary.hasPlayableInvestigationPath = summary.hasPlayableInvestigationPath || playablePathTextBeforeReview.toLowerCase().includes("playable investigation path");
  summary.hasPlayableInvestigationSteps = summary.hasPlayableInvestigationSteps || ["Join", "Search", "Question", "Challenge", "Select Evidence", "Submit", "Review Source"].every((label) => playablePathTextBeforeReview.includes(label));
  summary.hasPlayablePathBoundary = summary.hasPlayablePathBoundary || (/read-only route audit/i.test(playablePathTextBeforeReview) && /final detective workspace/i.test(playablePathTextBeforeReview) && /existing certified adapter/i.test(playablePathTextBeforeReview));
  summary.hasCampaignResolutionLedger = /campaign resolution ledger/i.test(guidedStepJournalTextBeforeReview)
    && ["result", "world change", "objective progress", "next action"].every((label) => guidedStepJournalTextBeforeReview.toLowerCase().includes(label));
  summary.hasStaticResolutionNoPersistence = /no persistent world change/i.test(guidedStepJournalTextBeforeReview);
  summary.hasCampaignResolutionNoRawIds = !/\b(?:npc|case|event|source|location|institution|resource|evidence|scene|session|character)-[a-z0-9-]*\d[a-z0-9-]*\b|culpritId|victimId|hiddenTruth|rawBody|sourceId|[A-Za-z]:[\\/]/i.test(guidedStepJournalTextBeforeReview);
  summary.hasStaticPlaythroughProof = staticPlaythroughTextBeforeReview.toLowerCase().includes("static playthrough proof");
  summary.hasStaticPlaythroughAccepted = staticPlaythroughTextBeforeReview.toLowerCase().includes("completed / accepted theory") && staticPlaythroughTextBeforeReview.toLowerCase().includes("accepted");
  summary.hasStaticPlaythroughMetrics = ["route certified", "auto route pass", "challenge hits", "selected evidence", "covered obligations"].every((label) => staticPlaythroughTextBeforeReview.toLowerCase().includes(label));
  summary.hasStaticWorldLeadBoundary = /world lead/i.test(staticWorldLeadText) && /server runtime loop/i.test(staticWorldLeadText) && /case-scoped world arc/i.test(staticWorldLeadText) && /support \/ contain faction directive/i.test(staticWorldLeadText) && /server-only pressure cascade/i.test(staticWorldLeadText) && !/follow world lead|keep certified route/i.test(staticWorldLeadText);
  summary.hasStaticWorldCurrentAction = /campaign priority/i.test(staticWorldCurrentActionText) && /continue the certified investigation path/i.test(staticWorldCurrentActionText) && /server-only/i.test(staticWorldCurrentActionText);
  summary.hasStaticInfluenceBudgetBoundary = /server-only/i.test(staticInfluenceBudgetText) && /unified influence budget/i.test(staticInfluenceBudgetText) && /read-only/i.test(staticInfluenceBudgetText);
  summary.hasStaticResourceCommitmentBoundary = /server-only/i.test(staticResourceCommitmentText) && /investigation operations economy/i.test(staticResourceCommitmentText) && /read-only/i.test(staticResourceCommitmentText) && !/confirm operations|use support/i.test(staticResourceCommitmentText);
  summary.hasStaticFactionRelationshipBoundary = /server-only/i.test(staticFactionRelationshipText) && /faction relationship ledger/i.test(staticFactionRelationshipText) && !/trusted|strained|hostile|relationship-priced resource controls/i.test(staticFactionRelationshipText.replace(/relationship-priced resource controls/i, ""));
  summary.hasStaticWorldEventOfferBoundary = /server-only/i.test(staticWorldEventOfferText) && /world event offer lifecycle/i.test(staticWorldEventOfferText) && /no persistent offer/i.test(staticWorldEventOfferText) && staticWorldEventOfferButtons === 0;
  summary.hasStaticInvestigatorProgressionBoundary = /server-only/i.test(staticInvestigatorProgressionText) && /investigator progression|practice profile/i.test(staticInvestigatorProgressionText) && /does not persist|read-only|no persistent/i.test(staticInvestigatorProgressionText) && staticInvestigatorProgressionButtons === 0;
  summary.hasStaticCampaignRecoveryBoundary = /server-only/i.test(staticCampaignRecoveryText) && /failure and recovery/i.test(staticCampaignRecoveryText) && /does not persist/i.test(staticCampaignRecoveryText) && staticCampaignRecoveryButtons === 0;
  summary.hasStaticInvestigatorHeadquartersBoundary = /server-only/i.test(staticInvestigatorHeadquartersText) && /investigator headquarters/i.test(staticInvestigatorHeadquartersText) && /does not persist|no preparation state/i.test(staticInvestigatorHeadquartersText) && staticInvestigatorHeadquartersButtons === 0;
  summary.hasStaticArcConvergenceBoundary = /server-only/i.test(staticArcConvergenceText) && /arc convergence finale/i.test(staticArcConvergenceText) && /does not read campaign history/i.test(staticArcConvergenceText) && staticArcConvergenceButtons === 0;
  summary.hasStaticCampaignSessionBoundary = /server-only/i.test(staticCampaignSessionText) && /three-case campaign journey/i.test(staticCampaignSessionText) && /does not persist campaign chapters/i.test(staticCampaignSessionText) && staticCampaignSessionButtons === 0;
  summary.hasStaticCampaignPacingBoundary = /server-only/i.test(staticCampaignPacingText) && /campaign pacing and content value/i.test(staticCampaignPacingText) && /no persistent chapter context/i.test(staticCampaignPacingText) && staticCampaignPacingButtons === 0;
  summary.hasStaticCampaignTransitionBoundary = /server-only/i.test(staticCampaignTransitionText) && /focused resolution and campaign transition theatre/i.test(staticCampaignTransitionText) && /no transition state/i.test(staticCampaignTransitionText) && staticCampaignTransitionButtons === 0 && staticCampaignTransitionTheatreCount === 0;
  summary.hasStaticTownSocialResponseBoundary = /server-only/i.test(staticTownSocialResponseText) && /town social response/i.test(staticTownSocialResponseText) && /does not read public npc reactions/i.test(staticTownSocialResponseText) && staticTownSocialResponseButtons === 0;
  summary.hasGuidedManualRun = /guided manual run/i.test(guidedManualTextBeforeReview);
  summary.hasGuidedManualProgression = ["search complete", "question complete", "challenge complete", "evidence selected", "accepted"].every((label) => guidedManualTextBeforeReview.toLowerCase().includes(label));
  summary.hasGuidedManualReadyToReview = /review source audit/i.test(guidedManualTextBeforeReview) || /source review ready/i.test(guidedManualTextBeforeReview) || /\baccepted\b/i.test(guidedManualTextBeforeReview);
  summary.hasGuidedStepJournal = /guided step journal/i.test(guidedStepJournalTextBeforeReview);
  summary.hasGuidedStepJournalEntries = ["join investigation", "search certified clue", "question certified witness", "challenge certified testimony", "select certified evidence", "submit certified theory", "review source audit"].every((label) => guidedStepJournalTextBeforeReview.toLowerCase().includes(label));
  summary.hasGuidedStepJournalFallback = /certified fallback/i.test(guidedStepJournalTextBeforeReview) && /used/i.test(guidedStepJournalTextBeforeReview);
  summary.hasGuidedStepJournalReviewUnlock = /review unlocked/i.test(guidedStepJournalTextBeforeReview) || /source review workbench unlocked/i.test(guidedStepJournalTextBeforeReview);
  summary.hasGuidedStepJournalNoRawIds = !/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(guidedStepJournalTextBeforeReview);
  summary.hasSourceReviewUnlock = /source review unlock/i.test(sourceReviewTextBeforeReview) && /source review unlocked/i.test(sourceReviewTextBeforeReview) && /audit ready/i.test(sourceReviewTextBeforeReview);
  summary.hasSourceReviewWorkbench = ["source trail", "proof obligations", "certified route", "conclusion review"].every((label) => sourceReviewTextBeforeReview.toLowerCase().includes(label));
  summary.hasSourceReviewNoRawIds = !/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(sourceReviewTextBeforeReview);
  summary.hasSolvedCaseDebrief = /solved case debrief/i.test(solvedCaseDebriefTextBeforeReview) && /investigation completed \/ accepted/i.test(solvedCaseDebriefTextBeforeReview);
  summary.hasSolvedCaseDebriefSections = ["player route", "evidence closure", "source confidence", "next replay goal"].every((label) => solvedCaseDebriefTextBeforeReview.toLowerCase().includes(label));
  summary.hasSolvedCaseDebriefMetrics = /certified fallback/i.test(solvedCaseDebriefTextBeforeReview) && /proof gaps/i.test(solvedCaseDebriefTextBeforeReview) && /selected evidence/i.test(solvedCaseDebriefTextBeforeReview);
  summary.hasSolvedCaseDebriefNoRawIds = !/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(solvedCaseDebriefTextBeforeReview);
  summary.hasReplayGoalCoach = /replay goal coach/i.test(replayGoalCoachTextBeforeAttempt);
  summary.hasReplayGoalCoachGoals = ["reduce fallback", "manual evidence selection", "fewer guided clicks", "review source after submit"].every((label) => replayGoalCoachTextBeforeAttempt.toLowerCase().includes(label));
  summary.hasReplayGoalCoachMetrics = /previous guided steps/i.test(replayGoalCoachTextBeforeAttempt) && /fallback used/i.test(replayGoalCoachTextBeforeAttempt) && /selected evidence/i.test(replayGoalCoachTextBeforeAttempt) && /proof gaps/i.test(replayGoalCoachTextBeforeAttempt);
  summary.hasReplayGoalAttemptStarted = /replay attempt active/i.test(replayGoalCoachTextAfterAttempt) && /completed replay goals/i.test(replayGoalCoachTextAfterAttempt);
  summary.hasReplayGoalAttemptGuidedRun = /guided manual run/i.test(guidedManualTextAfterReplayAttempt) && /run next guided step/i.test(guidedManualTextAfterReplayAttempt);
  summary.hasReplayGoalCoachNoRawIds = !/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(`${replayGoalCoachTextBeforeAttempt}\n${replayGoalCoachTextAfterAttempt}`);
  summary.hasReplayPracticeLoop = /replay practice loop/i.test(replayPracticeLoopTextBeforeAttempt);
  summary.hasReplayPracticeLoopStages = ["start", "discover", "pick evidence", "fill theory", "submit", "review source", "scorecard"].every((label) => replayPracticeLoopTextBeforeAttempt.toLowerCase().includes(label));
  summary.hasReplayPracticeLoopAttempt = /active attempt/i.test(replayPracticeLoopTextAfterAttempt) && /run next guided step|use manual evidence drill/i.test(replayPracticeLoopTextAfterAttempt);
  summary.hasReplayPracticeLoopManualEvidence = /manual evidence picks/i.test(replayPracticeLoopTextAfterManualDrill) && /pick evidence/i.test(replayPracticeLoopTextAfterManualDrill);
  summary.hasReplayPracticeLoopManualTheory = /manual theory fields/i.test(staticManualTheoryReplay.replayPracticeLoopTextAfterManualTheoryFill) && /fill theory|submit/i.test(staticManualTheoryReplay.replayPracticeLoopTextAfterManualTheoryFill);
  summary.hasReplayPracticeLoopBlockedFallback = /blocked gaps/i.test(staticManualTheoryReplay.replayPracticeLoopTextAfterBlockedSubmit)
    && /fallback theory fields/i.test(staticManualTheoryReplay.replayPracticeLoopTextAfterFallback)
    && /explicit fallback/i.test(staticManualTheoryReplay.replayPracticeLoopTextAfterFallback);
  summary.hasReplayPracticeLoopCompleted = /source review/i.test(staticManualTheoryReplay.replayPracticeLoopTextCompleted)
    && /unlocked/i.test(staticManualTheoryReplay.replayPracticeLoopTextCompleted)
    && /completed/i.test(staticManualTheoryReplay.replayPracticeLoopTextCompleted)
    && /scorecard/i.test(staticManualTheoryReplay.replayPracticeLoopTextCompleted);
  summary.hasFinalWorkspaceRecovery = staticManualTheoryReplay.finalWorkspaceRecovery.stage === "recovery"
    && staticManualTheoryReplay.finalWorkspaceRecovery.theoryState === "rejected"
    && staticManualTheoryReplay.finalWorkspaceRecovery.recoveryVisible
    && staticManualTheoryReplay.finalWorkspaceRecovery.actionKind === "submit";
  summary.hasFinalWorkspaceSourceReview = ["source-review", "resolved"].includes(staticManualTheoryReplay.finalWorkspaceResolved.stage)
    && staticManualTheoryReplay.finalWorkspaceResolved.theoryState === "accepted"
    && staticManualTheoryReplay.finalWorkspaceResolved.sourceReviewVisible
    && staticManualTheoryReplay.finalWorkspaceResolved.primaryCount === 1;
  summary.hasFinalWorkspaceResolutionLedger = staticManualTheoryReplay.finalWorkspaceResolved.ledgerVisible;
  summary.hasReplayPracticeLoopNoRawIds = !/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(`${replayPracticeLoopTextBeforeAttempt}\n${replayPracticeLoopTextAfterAttempt}\n${replayPracticeLoopTextAfterManualDrill}\n${staticManualTheoryReplay.replayPracticeLoopTextAfterManualTheoryFill}\n${staticManualTheoryReplay.replayPracticeLoopTextAfterBlockedSubmit}\n${staticManualTheoryReplay.replayPracticeLoopTextAfterFallback}\n${staticManualTheoryReplay.replayPracticeLoopTextCompleted}`);
  summary.hasManualEvidenceDrill = /manual evidence drill/i.test(manualEvidenceDrillTextBeforeAdd);
  summary.hasManualEvidenceDrillProgress = /selected evidence/i.test(manualEvidenceDrillTextBeforeAdd) && /route target count/i.test(manualEvidenceDrillTextBeforeAdd) && /remaining proof slots/i.test(manualEvidenceDrillTextBeforeAdd);
  summary.hasManualEvidenceDrillAdd = /add to theory/i.test(manualEvidenceDrillTextBeforeAdd) && /selected/i.test(manualEvidenceDrillTextAfterFirstAdd);
  summary.hasManualEvidenceDrillJournal = /manual evidence drill/i.test(guidedStepJournalTextAfterManualDrill) && /manually selected/i.test(guidedStepJournalTextAfterManualDrill);
  summary.hasManualEvidenceDrillScorecardSignal = /manual picks/i.test(replayAttemptScorecardTextAfterManualDrill) && /fallback picks/i.test(replayAttemptScorecardTextAfterManualDrill);
  summary.hasManualEvidenceDrillGuidedPrompt = /manual evidence drill/i.test(guidedManualTextAtManualDrill) || /select-evidence/i.test(guidedManualTextAtManualDrill);
  summary.hasManualEvidenceDrillNoRawIds = !/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(`${manualEvidenceDrillTextBeforeAdd}\n${manualEvidenceDrillTextAfterAdd}\n${guidedStepJournalTextAfterManualDrill}\n${replayAttemptScorecardTextAfterManualDrill}`);
  summary.hasManualTheoryDrill = /manual theory drill/i.test(staticManualTheoryReplay.manualTheoryDrillTextBeforeFill);
  summary.hasManualTheoryDrillProgress = /manual fields/i.test(staticManualTheoryReplay.manualTheoryDrillTextBeforeFill)
    && /remaining fields/i.test(staticManualTheoryReplay.manualTheoryDrillTextBeforeFill)
    && /evidence ready/i.test(staticManualTheoryReplay.manualTheoryDrillTextBeforeFill)
    && /ready for submit/i.test(staticManualTheoryReplay.manualTheoryDrillTextAfterFill);
  summary.hasManualTheoryDrillManualFields = /3\/3 theory field\(s\) completed manually/i.test(staticManualTheoryReplay.guidedStepJournalTextAfterManualTheoryFill)
    || /manual theory fields/i.test(staticManualTheoryReplay.replayAttemptScorecardTextAfterManualTheoryFill);
  summary.hasManualTheoryDrillBlocksAutoFallback = /blocked gaps/i.test(staticManualTheoryReplay.manualTheoryDrillTextAfterBlockedSubmit)
    || /field-level gap/i.test(staticManualTheoryReplay.manualTheoryDrillTextAfterBlockedSubmit);
  summary.hasManualTheoryDrillExplicitFallback = /explicit fallback approved/i.test(staticManualTheoryReplay.manualTheoryDrillTextAfterFallback)
    && /unresolved theory field/i.test(staticManualTheoryReplay.guidedStepJournalTextAfterManualTheoryFallback);
  summary.hasManualTheoryDrillScorecardSignal = /manual theory fields/i.test(replayAttemptScorecardTextCompleted)
    && /fallback theory fields/i.test(replayAttemptScorecardTextCompleted)
    && /blocked theory gaps/i.test(replayAttemptScorecardTextCompleted);
  summary.hasManualTheoryDrillNoRawIds = !/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(`${staticManualTheoryReplay.manualTheoryDrillTextBeforeFill}\n${staticManualTheoryReplay.manualTheoryDrillTextAfterFill}\n${staticManualTheoryReplay.manualTheoryDrillTextAfterBlockedSubmit}\n${staticManualTheoryReplay.manualTheoryDrillTextAfterFallback}\n${staticManualTheoryReplay.guidedStepJournalTextAfterManualTheoryFallback}\n${staticManualTheoryReplay.replayAttemptScorecardTextAfterManualTheoryFallback}`);
  summary.hasReplayAttemptScorecard = /replay attempt scorecard/i.test(replayAttemptScorecardTextBeforeAttempt);
  summary.hasReplayAttemptScorecardPending = /pending replay delta/i.test(replayAttemptScorecardTextPending) && /current step/i.test(replayAttemptScorecardTextPending);
  summary.hasReplayAttemptScorecardCompleted = /completed replay delta/i.test(replayAttemptScorecardTextCompleted);
  summary.hasReplayAttemptScorecardDeltas = ["guided clicks", "explicit fallback", "manual evidence selection", "manual theory fields", "proof gaps", "source review unlocked", "completed replay goals"].every((label) => replayAttemptScorecardTextCompleted.toLowerCase().includes(label))
    && /previous:/i.test(replayAttemptScorecardTextCompleted)
    && /current:/i.test(replayAttemptScorecardTextCompleted)
    && /manual picks/i.test(replayAttemptScorecardTextCompleted)
    && /fallback picks/i.test(replayAttemptScorecardTextCompleted)
    && /\b(?:improved|unchanged|regressed|completed)\b/i.test(replayAttemptScorecardTextCompleted);
  summary.hasReplayAttemptScorecardNoRawIds = !/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(`${replayAttemptScorecardTextBeforeAttempt}\n${replayAttemptScorecardTextPending}\n${replayAttemptScorecardTextCompleted}`);
  summary.hasReviewerHome = summary.hasReviewerHome || reviewerHomeWasVisible;

  const apiRequests = requests.filter((url) => /\/api\//.test(url));
  const datasetRequests = requests.filter((url) => /\/dataset-reader\//.test(url));
  const catalogRequests = requests.filter((url) => /\/review-catalog\//.test(url));
  const disallowedStaticRequests = requests.filter((url) => {
    try {
      const parsed = new URL(url);
      if (parsed.origin !== baseUrl) return false;
      if (parsed.pathname.startsWith("/dataset-reader/")) return false;
      if (parsed.pathname.startsWith("/review-catalog/")) return false;
      if (parsed.pathname.startsWith("/_next/")) return false;
      if (parsed.pathname === "/" || parsed.pathname === "/favicon.ico") return false;
      return parsed.pathname.endsWith(".json") || parsed.pathname.endsWith(".md");
    } catch {
      return false;
    }
  });
  const failures = [];
  for (const [key, value] of Object.entries(summary)) {
    if (key.startsWith("has") && !value) failures.push(`${key} was false.`);
  }
  if (apiRequests.length) failures.push(`Static runtime made /api/* requests: ${apiRequests.join(", ")}`);
  if (catalogRequests.length < 1) failures.push("Static runtime did not load the expected review-catalog files.");
  if (datasetRequests.length < 3) failures.push("Static runtime did not load the expected dataset-reader files.");
  if (disallowedStaticRequests.length) failures.push(`Static runtime made disallowed public data requests: ${disallowedStaticRequests.join(", ")}`);
  if (consoleErrors.length) failures.push(`Console errors: ${consoleErrors.join(" | ")}`);
  if (pageErrors.length) failures.push(`Page errors: ${pageErrors.join(" | ")}`);
  if (summary.scrollWidth > summary.clientWidth + 1 || summary.bodyWidth > summary.clientWidth + 1) failures.push("Desktop viewport has page-level horizontal overflow.");

  await page.goto(`${baseUrl}/?runtime=static`, { waitUntil: "load" });
  await keepCommandDeckSectionsOpen(page);
  await dismissCommandDeckOnboarding(page);
  await page.getByTestId("open-authoring").click();
  await page.getByRole("heading", { name: "Case Authoring" }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("authoring-workflow-coach").waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("authoring-workflow-stages").waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("authoring-next-action").waitFor({ state: "visible", timeout: 30000 });
  const initialCoachText = await page.getByTestId("authoring-workflow-coach").innerText();
  const originalAuthoringTitle = (await page.locator(".stageTopbar h2").textContent()) || "";
  await page.getByRole("button", { name: "Content", exact: true }).click();
  await page.getByTestId("content-authoring-guide").waitFor({ state: "visible", timeout: 30000 });
  await page.getByLabel("Content resource").waitFor({ state: "visible", timeout: 30000 });
  await page.getByLabel("Content faction").waitFor({ state: "visible", timeout: 30000 });
  await page.getByLabel("Content event archetype").waitFor({ state: "visible", timeout: 30000 });
  await page.getByLabel("Content growth line").waitFor({ state: "visible", timeout: 30000 });
  await page.getByLabel("Content case type").selectOption("dock-smuggling");
  await page.getByText("Dock Smuggling at Dock").first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("authoring-next-action").click();
  await page.getByText("Preview Content Seed").first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("safe-diff-review").waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Pending safe diff", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("pending-safe-diff-case").waitFor({ state: "visible", timeout: 30000 });
  const previewCoachText = await page.getByTestId("authoring-workflow-coach").innerText();
  const pendingSafeDiffVisible = (await page.getByTestId("safe-diff-review").innerText()).includes("Case title");
  await page.getByTestId("apply-content-seed").click();
  await page.waitForFunction(() => document.querySelector(".stageTopbar h2")?.textContent === "Dock Smuggling at Dock", null, { timeout: 30000 });
  await page.getByTestId("applied-safe-diff").waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Applied safe diff", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  const appliedCoachText = await page.getByTestId("authoring-workflow-coach").innerText();
  const appliedSafeDiffText = await page.getByTestId("applied-safe-diff").innerText();
  const appliedSafeDiffLowerText = appliedSafeDiffText.toLowerCase();
  const appliedSafeDiffVisible = appliedSafeDiffText.includes("Case title")
    && appliedSafeDiffLowerText.includes("before")
    && appliedSafeDiffLowerText.includes("after");
  await page.getByTestId("content-seed-trail").waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Content Seed Undo", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("undo-content-seed").click();
  await page.waitForFunction((expectedTitle) => document.querySelector(".stageTopbar h2")?.textContent === expectedTitle, originalAuthoringTitle, { timeout: 30000 });
  await page.getByText("Undo Content Seed restored").first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("applied-safe-diff").waitFor({ state: "hidden", timeout: 30000 });
  const undoCoachText = await page.getByTestId("authoring-workflow-coach").innerText();
  const contentSeedUndoRestored = (await page.locator("body").innerText()).includes("Undo Content Seed restored");
  const safeDiffUndoCleared = await page.getByTestId("applied-safe-diff").count() === 0;
  await page.getByRole("button", { name: "Gallery", exact: true }).click();
  await page.getByTestId("case-gallery-panel").waitFor({ state: "visible", timeout: 30000 });
  const backupTitle = `Before Content Seed - ${originalAuthoringTitle}`;
  const backupCard = page.getByTestId("case-gallery-card").filter({ hasText: backupTitle }).first();
  await backupCard.waitFor({ state: "visible", timeout: 30000 });
  await backupCard.getByRole("button", { name: "Load into Authoring" }).click();
  await page.waitForFunction((expectedTitle) => document.querySelector(".stageTopbar h2")?.textContent === expectedTitle, originalAuthoringTitle, { timeout: 30000 });
  await page.getByRole("button", { name: "Content", exact: true }).click();
  await page.waitForTimeout(500);
  const authoringSummary = await page.evaluate((contentSeedUndoRestored) => {
    const text = document.body?.innerText || "";
    const lowerText = text.toLowerCase();
    const title = document.querySelector(".stageTopbar h2")?.textContent || "";
    const runButton = document.querySelector("[data-testid='run-authoring-draft']");
    const expansionText = document.querySelector("[data-testid='authored-content-expansion']")?.textContent || "";
    return {
      hasCaseAuthoring: text.includes("Case Authoring"),
      hasAuthoringWorkflowCoach: text.includes("Authoring Workflow Coach"),
      hasWorkflowStages: ["Draft", "Content Seed", "Safe Diff", "Validation", "Run Draft", "Gallery Backup"].every((label) => text.includes(label)),
      hasNextAction: lowerText.includes("next action"),
      hasContentTab: text.includes("Content-Guided Case Authoring"),
      hasPreviewContentSeed: text.includes("Preview Content Seed"),
      hasApplyContentSeed: text.includes("Apply Content Seed"),
      hasSafeDiffReview: text.includes("Safe Diff Review"),
      hasPendingSafeDiff: text.includes("Pending safe diff"),
      hasAppliedSafeDiffCleared: !text.includes("Applied safe diff"),
      hasContentSeedTrail: text.includes("Content Seed Undo"),
      hasContentCoverage: lowerText.includes("compatible evidence") && lowerText.includes("compatible roles") && lowerText.includes("avg risk"),
      hasExpandedAuthoredContent: /16\s*case types/i.test(expansionText) && /10\s*events/i.test(expansionText) && /8\s*growth lines/i.test(expansionText) && /6\s*authored clusters/i.test(expansionText),
      hasWorldSystemAuthoring: lowerText.includes("resource pressure") && lowerText.includes("event risk") && lowerText.includes("growth stages") && lowerText.includes("world-system labels"),
      hasLocalBoundaryCopy: lowerText.includes("localstorage only") && lowerText.includes("does not write repo json") && lowerText.includes("/api/*"),
      hasGalleryBackupStatus: text.includes("Loaded \"Before Content Seed -"),
      contentSeedUndoRestored,
      title,
      runDraftAvailableOrBlocked: Boolean(runButton && !(runButton).disabled) || text.includes("Blocked:")
    };
  }, contentSeedUndoRestored);
  const coachSummary = {
    initial: {
      hasCoach: initialCoachText.includes("Authoring Workflow Coach"),
      hasStages: ["Draft", "Content Seed", "Safe Diff", "Validation", "Run Draft", "Gallery Backup"].every((label) => initialCoachText.includes(label)),
      hasNextAction: initialCoachText.toLowerCase().includes("next action")
    },
    preview: {
      pointsToSafeDiff: previewCoachText.includes("Safe Diff") && previewCoachText.toLowerCase().includes("pending"),
      pointsToContentSeed: previewCoachText.includes("Content Seed")
    },
    applied: {
      pointsToAppliedDiff: appliedCoachText.includes("Review applied safe diff") || appliedCoachText.includes("Applied safe diff"),
      mentionsGalleryBackup: appliedCoachText.includes("Gallery Backup") || appliedCoachText.includes("Gallery backup"),
      mentionsUndo: appliedCoachText.includes("Undo Content Seed")
    },
    undo: {
      clearedAppliedDiff: !undoCoachText.includes("Review applied safe diff") && !undoCoachText.includes("Applied safe diff"),
      returnsToPreview: undoCoachText.includes("Preview Content Seed") || undoCoachText.includes("Pending")
    }
  };
  if (!authoringSummary.hasCaseAuthoring) failures.push("Authoring workbench was not visible.");
  if (!authoringSummary.hasAuthoringWorkflowCoach || !coachSummary.initial.hasCoach) failures.push("Authoring Workflow Coach was not visible.");
  if (!authoringSummary.hasWorkflowStages || !coachSummary.initial.hasStages) failures.push("Authoring Workflow Coach stages were not visible.");
  if (!authoringSummary.hasNextAction || !coachSummary.initial.hasNextAction) failures.push("Authoring Workflow Coach Next Action was not visible.");
  if (!coachSummary.preview.pointsToSafeDiff || !coachSummary.preview.pointsToContentSeed) failures.push("Workflow Coach did not point to Safe Diff after Preview Content Seed.");
  if (!coachSummary.applied.pointsToAppliedDiff || !coachSummary.applied.mentionsGalleryBackup || !coachSummary.applied.mentionsUndo) failures.push("Workflow Coach did not explain applied diff, Gallery backup, and Undo after Apply Content Seed.");
  if (!coachSummary.undo.clearedAppliedDiff || !coachSummary.undo.returnsToPreview) failures.push("Workflow Coach did not return to pending/clean state after Undo Content Seed.");
  if (!authoringSummary.hasContentTab) failures.push("Content tab was not visible.");
  if (!authoringSummary.hasPreviewContentSeed) failures.push("Preview Content Seed was not visible.");
  if (!authoringSummary.hasApplyContentSeed) failures.push("Apply Content Seed was not visible.");
  if (!authoringSummary.hasSafeDiffReview) failures.push("Safe Diff Review was not visible.");
  if (!authoringSummary.hasPendingSafeDiff) failures.push("Pending safe diff was not visible.");
  if (!pendingSafeDiffVisible) failures.push("Pending safe diff did not show safe field changes.");
  if (!appliedSafeDiffVisible) failures.push("Applied safe diff did not show before/after safe field changes.");
  if (!safeDiffUndoCleared || !authoringSummary.hasAppliedSafeDiffCleared) failures.push("Applied safe diff did not clear after Undo Content Seed.");
  if (!authoringSummary.hasContentSeedTrail) failures.push("Content Seed Undo trail was not visible.");
  if (!authoringSummary.contentSeedUndoRestored) failures.push("Content Seed undo did not restore the original draft.");
  if (!authoringSummary.hasContentCoverage) failures.push("Content coverage metrics were not visible.");
  if (!authoringSummary.hasExpandedAuthoredContent) failures.push("Expanded authored content counts were not visible.");
  if (!authoringSummary.hasWorldSystemAuthoring) failures.push("World-system authoring controls and preview were not visible.");
  if (!authoringSummary.hasLocalBoundaryCopy) failures.push("Browser-local content boundary copy was not visible.");
  if (!authoringSummary.hasGalleryBackupStatus) failures.push("Content seed Gallery backup was not loaded for revert.");
  if (authoringSummary.title !== originalAuthoringTitle) failures.push(`Gallery backup did not restore the original draft title: ${authoringSummary.title}`);
  if (!authoringSummary.runDraftAvailableOrBlocked) failures.push("Run Draft was neither available nor clearly blocked after applying content seed.");

  const finalApiRequests = requests.filter((url) => /\/api\//.test(url));
  const finalDatasetRequests = requests.filter((url) => /\/dataset-reader\//.test(url));
  const finalCatalogRequests = requests.filter((url) => /\/review-catalog\//.test(url));
  if (finalApiRequests.length) failures.push(`Static authoring path made /api/* requests: ${finalApiRequests.join(", ")}`);

  return { ok: failures.length === 0, failures, summary, authoringSummary, coachSummary, apiRequests: finalApiRequests, catalogRequests: finalCatalogRequests, datasetRequests: finalDatasetRequests, disallowedStaticRequests, consoleErrors, pageErrors };
}

async function verifyMobile(page, baseUrl) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/?runtime=static`, { waitUntil: "load" });
  await keepCommandDeckSectionsOpen(page);
  await dismissCommandDeckOnboarding(page);
  await page.getByTestId("playable-investigation-path").waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Playable Investigation Path", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Join -> Search -> Question -> Challenge -> Select Evidence -> Submit -> Review Source", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  const playablePathTextBeforeReview = await page.getByTestId("playable-investigation-path").innerText();
  await page.getByTestId("guided-manual-run").waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Guided Manual Run", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  const guidedManualTextBeforeReview = await page.getByTestId("guided-manual-run").innerText();
  await page.getByTestId("guided-step-journal").waitFor({ state: "visible", timeout: 30000 });
  const guidedStepJournalTextBeforeReview = await page.getByTestId("guided-step-journal").innerText();
  await page.getByTestId("static-playthrough-proof").waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Static Playthrough Proof", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  const staticPlaythroughTextBeforeReview = await page.getByTestId("static-playthrough-proof").innerText();
  await page.getByTestId("source-review-unlock").waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Source Review Unlock", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  const sourceReviewTextBeforeReview = await page.getByTestId("source-review-unlock").innerText();
  await page.getByRole("button", { name: "持续小镇" }).click();
  await page.getByRole("heading", { name: "Public Review Snapshot" }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Reviewer Home", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Reviewer Main Path", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("proof-strip").waitFor({ state: "visible", timeout: 30000 });
  const reviewerHomeWasVisible = await page.getByTestId("reviewer-home").isVisible();
  await page.getByText("Trust Snapshot", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Stable World Proof", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Per-seed Pass Cards", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Runtime Band", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Diagnostics Finding Counts", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Regression Delta Counts", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Deterministic Hash Comparison", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Case Quality Proof", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText(/fair-play evidence/i).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText(/non-blocking/i).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("World-System Influence Proof", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText(/bounded influence proved/i).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText(/no candidate loss/i).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Review Path", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("reviewer-gateway").waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("reviewer-gateway").getByRole("button", { name: /Pack/i }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("reviewer-gateway").getByRole("button", { name: /Replay/i }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("reviewer-gateway").getByRole("button", { name: /Map/i }).click();
  await page.getByTestId("world-system-overview").waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Growth Lines", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("reviewer-gateway").getByRole("button", { name: /Agent/i }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByRole("heading", { name: "Dataset Reader" }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByRole("heading", { name: "Public Dataset Explorer" }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Reviewer next step", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("distribution-explorer").getByRole("button", { name: "Public Case Explorer" }).click();
  await page.waitForTimeout(750);
  const summary = await page.evaluate(() => {
    const text = document.body?.innerText || "";
    const lowerText = text.toLowerCase();
    const proofStripText = document.querySelector("[data-testid='proof-strip']")?.textContent || "";
    const playablePathText = document.querySelector("[data-testid='playable-investigation-path']")?.textContent || "";
    return {
      hasPlayableInvestigationPath: playablePathText.toLowerCase().includes("playable investigation path"),
      hasPlayableInvestigationSteps: ["Join", "Search", "Question", "Challenge", "Select Evidence", "Submit", "Review Source"].every((label) => playablePathText.includes(label)),
      hasPlayablePathBoundary: /read-only route audit/i.test(playablePathText) && /final detective workspace/i.test(playablePathText) && /existing certified adapter/i.test(playablePathText),
      hasReviewerHome: /Reviewer\s+Home/.test(text),
      hasReviewerMainPath: text.includes("Reviewer Main Path"),
      hasTrustSnapshot: text.includes("Trust Snapshot"),
      hasStableWorldProof: text.includes("Stable World Proof"),
      hasStableWorldSeeds: text.includes("3 seeds"),
      hasStableWorldTicks: text.includes("1000 ticks"),
      hasStableWorldDiagnostics: /diagnostics/i.test(text),
      hasStableWorldRegression: /regression/i.test(text),
      hasStableWorldNoBlockers: text.includes("no blockers"),
      hasStableWorldDrilldown: text.includes("Per-seed Pass Cards") && text.includes("Runtime Band") && text.includes("Diagnostics Finding Counts") && text.includes("Regression Delta Counts") && text.includes("Deterministic Hash Comparison"),
      hasStableWorldSeedCards: text.includes("campaign-validation") && text.includes("stable-town-a") && text.includes("stable-town-b"),
      hasStableWorldRuntimeBand: text.includes("Runtime Band") && text.includes("Aggregate-only runtime range"),
      hasStableWorldCountDrilldown: text.includes("Diagnostics Finding Counts") && text.includes("Regression Delta Counts"),
      hasStableWorldHashComparison: text.includes("unique deterministic hashes") && text.includes("public summary hash"),
      hasCaseQualityProof: text.includes("Case Quality Proof") || (lowerText.includes("average score") && lowerText.includes("non-blocking")),
      hasCaseQualityScore: lowerText.includes("average score") && lowerText.includes("lowest seed score"),
      hasCaseQualityDimensions: lowerText.includes("fair-play evidence") && lowerText.includes("diversity") && lowerText.includes("continuity") && lowerText.includes("institution"),
      hasCaseQualityNonBlocking: lowerText.includes("non-blocking"),
      hasWorldSystemInfluenceProof: text.includes("World-System Influence Proof"),
      hasWorldSystemInfluenceMetrics: lowerText.includes("applied bias") && lowerText.includes("max bias") && lowerText.includes("hinted action share"),
      hasWorldSystemInfluenceSafety: lowerText.includes("no candidate loss") && lowerText.includes("public-safe") && lowerText.includes("deterministic hashes"),
      hasProofStrip: proofStripText.includes("Static Boundary") && proofStripText.includes("World-System Influence") && proofStripText.includes("Case Quality"),
      hasReviewPath: text.includes("Review Path"),
      hasGatewayPackReplayMapAgent: ["Pack", "Replay", "Map", "Agent"].every((label) => text.includes(label)),
      hasGatewayQuestions: text.includes("Is the public package trustworthy?") && text.includes("Can the world be replayed and checked?") && text.includes("Is the world wide enough to grow?") && text.includes("Do world systems affect behavior?"),
      hasWorldSystemsOverview: text.includes("Roles") && text.includes("Locations") && text.includes("Resources") && text.includes("Factions") && text.includes("Events") && text.includes("Growth Lines"),
      hasWorldSystemCounts: (text.includes("world systems") && text.includes("system rows")) || (text.includes("6 systems") && text.includes("39")),
      hasReviewerNextStep: text.includes("Reviewer next step"),
      hasPublicReviewSnapshot: text.includes("Public Review Snapshot"),
      hasPublicDemoVerticalSlice: text.includes("Public Demo Vertical Slice"),
      hasPublicCatalog: text.includes("Public Catalog") || text.includes("Public Review Snapshot"),
      hasDatasetReader: text.includes("Dataset Reader"),
      hasCaseSummary: text.includes("Case Summary"),
      hasEvidenceDistribution: text.includes("Evidence Distribution"),
      hasAuditStatus: text.includes("Audit Status"),
      hasStaticBoundary: text.includes("Static Boundary") || text.includes("Static boundary summary") || lowerText.includes("static-only"),
      hasDistributionExplorer: text.includes("Distribution Explorer"),
      hasPublicDatasetExplorer: text.includes("Public Dataset Explorer"),
      hasPublicCaseExplorer: text.includes("Public Case Explorer"),
      hasCaseSummaryIndex: text.includes("Case Summary Index") || text.includes("case summary index"),
      hasEvidenceInfluenceSummary: text.includes("Evidence/Influence Summary"),
      hasAuditBoundary: text.includes("Audit Boundary"),
      hasSearchDistributions: text.includes("Search distributions"),
      hasSortControl: text.includes("Sort buckets") || text.includes("Sort public cases"),
      hasCaseTypes: text.includes("Case Types"),
      hasEvidenceTypes: text.includes("Evidence Types"),
      hasWorldPackages: text.includes("World Packages"),
      hasGateAndAudit: text.includes("Gate & Audit"),
      has5000: text.includes("5000"),
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyWidth: document.body?.scrollWidth || 0
    };
  });
  summary.hasPlayableInvestigationPath = summary.hasPlayableInvestigationPath || playablePathTextBeforeReview.toLowerCase().includes("playable investigation path");
  summary.hasPlayableInvestigationSteps = summary.hasPlayableInvestigationSteps || ["Join", "Search", "Question", "Challenge", "Select Evidence", "Submit", "Review Source"].every((label) => playablePathTextBeforeReview.includes(label));
  summary.hasPlayablePathBoundary = summary.hasPlayablePathBoundary || (/read-only route audit/i.test(playablePathTextBeforeReview) && /final detective workspace/i.test(playablePathTextBeforeReview) && /existing certified adapter/i.test(playablePathTextBeforeReview));
  summary.hasGuidedManualRun = /guided manual run/i.test(guidedManualTextBeforeReview);
  summary.hasGuidedStepJournal = /guided step journal/i.test(guidedStepJournalTextBeforeReview);
  summary.hasStaticPlaythroughProof = staticPlaythroughTextBeforeReview.toLowerCase().includes("static playthrough proof");
  summary.hasStaticPlaythroughMetrics = ["route certified", "auto route pass", "challenge hits", "selected evidence", "covered obligations"].every((label) => staticPlaythroughTextBeforeReview.toLowerCase().includes(label));
  summary.hasSourceReviewUnlock = /source review unlock/i.test(sourceReviewTextBeforeReview);
  summary.hasReviewerHome = summary.hasReviewerHome || reviewerHomeWasVisible;
  const failures = [];
  if (!summary.hasPlayableInvestigationPath) failures.push("Mobile Playable Investigation Path was not visible.");
  if (!summary.hasPlayableInvestigationSteps) failures.push("Mobile playable investigation steps were not visible.");
  if (!summary.hasPlayablePathBoundary) failures.push("Mobile playable path boundary copy was not visible.");
  if (!summary.hasStaticPlaythroughProof) failures.push("Mobile Static Playthrough Proof was not visible.");
  if (!summary.hasStaticPlaythroughMetrics) failures.push("Mobile static playthrough aggregate metrics were not visible.");
  if (!summary.hasSourceReviewUnlock) failures.push("Mobile Source Review Unlock was not visible.");
  if (!summary.hasReviewerHome) failures.push("Mobile Reviewer Home was not visible.");
  if (!summary.hasReviewerMainPath) failures.push("Mobile Reviewer Main Path was not visible.");
  if (!summary.hasTrustSnapshot) failures.push("Mobile Trust Snapshot was not visible.");
  if (!summary.hasStableWorldProof) failures.push("Mobile Stable World Proof was not visible.");
  if (!summary.hasStableWorldSeeds) failures.push("Mobile stable-world seed count was not visible.");
  if (!summary.hasStableWorldTicks) failures.push("Mobile stable-world tick count was not visible.");
  if (!summary.hasStableWorldDiagnostics) failures.push("Mobile stable-world diagnostics text was not visible.");
  if (!summary.hasStableWorldRegression) failures.push("Mobile stable-world regression text was not visible.");
  if (!summary.hasStableWorldNoBlockers) failures.push("Mobile stable-world no blockers text was not visible.");
  if (!summary.hasStableWorldDrilldown) failures.push("Mobile stable-world drilldown sections were not visible.");
  if (!summary.hasStableWorldSeedCards) failures.push("Mobile stable-world per-seed cards were not visible.");
  if (!summary.hasStableWorldRuntimeBand) failures.push("Mobile stable-world runtime band was not visible.");
  if (!summary.hasStableWorldCountDrilldown) failures.push("Mobile stable-world count drilldown was not visible.");
  if (!summary.hasStableWorldHashComparison) failures.push("Mobile stable-world hash comparison was not visible.");
  if (!summary.hasCaseQualityProof) failures.push("Mobile Case Quality Proof was not visible.");
  if (!summary.hasCaseQualityScore) failures.push("Mobile case quality score text was not visible.");
  if (!summary.hasCaseQualityDimensions) failures.push("Mobile case quality dimension text was not visible.");
  if (!summary.hasCaseQualityNonBlocking) failures.push("Mobile case quality non-blocking text was not visible.");
  if (!summary.hasWorldSystemInfluenceProof) failures.push("Mobile World-System Influence Proof was not visible.");
  if (!summary.hasWorldSystemInfluenceMetrics) failures.push("Mobile world-system influence metrics were not visible.");
  if (!summary.hasWorldSystemInfluenceSafety) failures.push("Mobile world-system influence safety text was not visible.");
  if (!summary.hasProofStrip) failures.push("Mobile Proof Strip was not visible.");
  if (!summary.hasReviewPath) failures.push("Mobile Review Path was not visible.");
  if (!summary.hasGatewayPackReplayMapAgent) failures.push("Mobile Pack/Replay/Map/Agent gateway labels were not visible.");
  if (!summary.hasGatewayQuestions) failures.push("Mobile Reviewer Main Path questions were not visible.");
  if (!summary.hasWorldSystemsOverview) failures.push("Mobile World Systems overview was not visible.");
  if (!summary.hasWorldSystemCounts) failures.push("Mobile world-system counts were not visible.");
  if (!summary.hasReviewerNextStep) failures.push("Mobile reviewer next step was not visible.");
  if (!summary.hasPublicReviewSnapshot) failures.push("Mobile Public Review Snapshot was not visible.");
  if (!summary.hasPublicDemoVerticalSlice) failures.push("Mobile Public Demo Vertical Slice was not visible.");
  if (!summary.hasPublicCatalog) failures.push("Mobile Public Catalog was not visible.");
  if (!summary.hasDatasetReader) failures.push("Mobile Dataset Reader was not visible.");
  if (!summary.hasCaseSummary) failures.push("Mobile Case Summary was not visible.");
  if (!summary.hasEvidenceDistribution) failures.push("Mobile Evidence Distribution was not visible.");
  if (!summary.hasAuditStatus) failures.push("Mobile Audit Status was not visible.");
  if (!summary.hasStaticBoundary) failures.push("Mobile Static Boundary was not visible.");
  if (!summary.hasDistributionExplorer) failures.push("Mobile Distribution Explorer was not visible.");
  if (!summary.hasPublicDatasetExplorer) failures.push("Mobile Public Dataset Explorer was not visible.");
  if (!summary.hasPublicCaseExplorer) failures.push("Mobile Public Case Explorer was not visible.");
  if (!summary.hasCaseSummaryIndex) failures.push("Mobile case summary index text was not visible.");
  if (!summary.hasEvidenceInfluenceSummary) failures.push("Mobile Evidence/Influence Summary was not visible.");
  if (!summary.hasAuditBoundary) failures.push("Mobile Audit Boundary was not visible.");
  if (!summary.hasSearchDistributions) failures.push("Mobile Search distributions control was not visible.");
  if (!summary.hasSortControl) failures.push("Mobile sort control was not visible.");
  if (!summary.hasCaseTypes) failures.push("Mobile Case Types tab was not visible.");
  if (!summary.hasEvidenceTypes) failures.push("Mobile Evidence Types tab was not visible.");
  if (!summary.hasWorldPackages) failures.push("Mobile World Packages tab was not visible.");
  if (!summary.hasGateAndAudit) failures.push("Mobile Gate & Audit tab was not visible.");
  if (!summary.has5000) failures.push("Mobile 5000 gate text was not visible.");
  if (summary.scrollWidth > summary.clientWidth + 1 || summary.bodyWidth > summary.clientWidth + 1) failures.push("Mobile viewport has page-level horizontal overflow.");
  return { ok: failures.length === 0, failures, summary };
}

async function verifyServerRuntime(page, baseUrl) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${baseUrl}/?runtime=server`, { waitUntil: "load" });
  const campaignFrontDoor = page.getByTestId("campaign-front-door");
  if (await campaignFrontDoor.getByTestId("campaign-front-door-dismiss").count()) {
    await campaignFrontDoor.getByTestId("campaign-front-door-dismiss").click();
    await campaignFrontDoor.waitFor({ state: "hidden", timeout: 10_000 });
  }
  await keepCommandDeckSectionsOpen(page);
  await dismissCommandDeckOnboarding(page);
  await page.locator(".settingsDrawer").first().locator("summary").click();
  await page.locator(".settingsDrawer label").filter({ hasText: "Seed" }).locator("input").fill("directive-browser-6");
  await page.locator(".settingsDrawer label").filter({ hasText: "Case Mode" }).locator("select").selectOption("generated");
  await Promise.all([
    page.waitForResponse((response) => {
      if (!response.url().includes("/api/worlds/create") || response.request().method() !== "POST" || !response.ok()) return false;
      try {
        return response.request().postDataJSON()?.caseMode === "generated";
      } catch {
        return false;
      }
    }, { timeout: 60000 }),
    page.getByRole("button", { name: /Reset \/ Create Town/i }).click()
  ]);
  await page.getByRole("button", { name: "持续小镇" }).click();
  await page.getByRole("heading", { name: "Dataset Package" }).waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(1000);
  const serverCatalogText = await page.locator("body").innerText();
  await page.getByTestId("persistent-command-center").waitFor({ state: "visible", timeout: 30000 });
  const commandControls = page.locator(".commandControls").first();
  await commandControls.locator("button").first().click();
  const fastStepButton = commandControls.locator("button").nth(3);
  const extractButton = page.locator("[data-testid='command-candidate-board'] article.valid button").first();
  for (let index = 0; index < 20; index += 1) {
    if (await extractButton.isVisible().catch(() => false)) break;
    await waitForCommandButtonReady(fastStepButton);
    await fastStepButton.click();
    await waitForCommandButtonReady(fastStepButton);
  }
  if (!await extractButton.isVisible().catch(() => false)) {
    const commandHud = await page.getByTestId("command-center-hud").innerText().catch(() => "HUD unavailable");
    const candidateBoard = await page.getByTestId("command-candidate-board").innerText().catch(() => "Candidate board unavailable");
    throw new Error(`No valid generated-world candidate after bounded fast steps.\n${commandHud}\n${candidateBoard}`);
  }
  await extractButton.click();
  await openCommandDeckInspectorDetail(page);
  await page.getByTestId("playable-investigation-path").waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("server-playthrough-proof").waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Server Playthrough Proof", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText(/source-backed route/i).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText(/covered obligations/i).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("guided-manual-run").waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("run-next-guided-step").click();
  const serverTransitionPresentation = await waitForGuidedStepIdle(page);
  await page.getByTestId("world-lead-panel").waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("world-campaign-current-action").waitFor({ state: "visible", timeout: 30000 });
  const serverWorldCampaignArchiveDefaultClosed = await page.getByTestId("world-campaign-archive").evaluate((node) => node instanceof HTMLDetailsElement && !node.open);
  const serverWorldCampaignFocusSurface = await page.getByTestId("world-campaign-focus").getAttribute("data-focus-surface");
  const serverWorldCampaignPriorityText = await page.getByTestId("world-campaign-current-action").innerText();
  await openWorldCampaignArchive(page);
  await page.getByTestId("world-arc-progress").waitFor({ state: "visible", timeout: 30000 });
  const serverWorldArcTextInitial = await page.getByTestId("world-arc-progress").innerText();
  const serverInvestigatorProgressionTextInitial = await page.getByTestId("investigator-progression").innerText();
  const serverArcConvergenceTextInitial = await page.getByTestId("arc-convergence").innerText();
  const serverCampaignSessionTextInitial = await page.getByTestId("campaign-session").innerText();
  const serverCampaignPacingTextInitial = await page.getByTestId("campaign-pacing").innerText();
  await page.getByTestId("player-resource-commitment").waitFor({ state: "visible", timeout: 30000 });
  const serverResourceCommitmentTextReady = await page.getByTestId("player-resource-commitment").innerText();
  const serverFactionRelationshipTextInitial = await page.getByTestId("faction-relationship-summary").innerText();
  const operationSupportButtons = page.locator("[data-testid^='investigation-operations-']:not([data-testid='investigation-operations-confirm']):not([disabled])");
  const operationSupportCount = Math.min(2, await operationSupportButtons.count());
  if (operationSupportCount < 1) {
    const operationPanelState = await page.getByTestId("player-resource-commitment").evaluate((node) => ({
      text: node.textContent || "",
      scope: node.getAttribute("data-operation-scope") || "",
      controls: Array.from(node.querySelectorAll("button")).map((button) => ({
        testId: button.getAttribute("data-testid") || "",
        disabled: button.disabled,
        label: button.textContent || ""
      }))
    }));
    throw new Error(`No Investigation Operations support lane is available in Server Runtime QA. ${JSON.stringify(operationPanelState)}`);
  }
  for (let index = 0; index < operationSupportCount; index += 1) await operationSupportButtons.nth(index).click();
  await page.getByTestId("investigation-operations-confirm").click();
  await settleCampaignTransitionTheatre(page);
  await page.getByTestId("player-resource-commitment").getByText("planned", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  const serverResourceCommitmentTextReserved = await page.getByTestId("player-resource-commitment").innerText();
  const serverResourceCommitmentJournalReservedText = await page.getByTestId("guided-step-journal").innerText();
  const serverWorldCurrentActionChoice = await page.getByTestId("world-campaign-current-action").innerText();
  await page.getByTestId("world-lead-follow").click();
  await settleCampaignTransitionTheatre(page);
  await page.getByText("followed", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  const serverWorldLeadTextFollowed = await page.getByTestId("world-lead-panel").innerText();
  let serverWorldLeadTextActive = "";
  const serverGuidedManualTexts = [];
  for (let index = 0; index < 32; index += 1) {
    const guidedText = await page.getByTestId("guided-manual-run").innerText();
    serverGuidedManualTexts.push(guidedText);
    if (/review source audit/i.test(guidedText) || /source review ready/i.test(guidedText) || /\baccepted\b/i.test(guidedText)) break;
    await page.getByTestId("run-next-guided-step").click();
    await waitForGuidedStepIdle(page);
    await page.waitForTimeout(900);
    await openWorldCampaignArchive(page);
    if (!serverWorldLeadTextActive && await page.getByTestId("world-lead-outcome").isVisible().catch(() => false)) {
      serverWorldLeadTextActive = await page.getByTestId("world-lead-panel").innerText();
    }
    if (await page.getByTestId("source-review-workbench").isVisible().catch(() => false)) break;
  }
  await page.getByText(/completed \/ accepted theory/i).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("source-review-unlock").waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Source Review Unlock", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("source-review-workbench").waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("source-review-trail").getByText("Source Trail", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("source-review-obligations").getByText("Proof Obligations", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("source-review-route").getByText("Certified Route", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("source-review-conclusion").getByText("Conclusion Review", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("solved-case-debrief").waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("replay-practice-loop").waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("replay-goal-coach").waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("replay-attempt-scorecard").waitFor({ state: "visible", timeout: 30000 });
  const serverPlaythroughText = await page.getByTestId("server-playthrough-proof").innerText();
  await openWorldCampaignArchive(page);
  const serverWorldLeadTextResolved = await page.getByTestId("world-lead-panel").innerText();
  const serverCampaignPacingTextResolved = await page.getByTestId("campaign-pacing").innerText();
  const serverGuidedCampaignPacingText = await page.getByTestId("guided-campaign-pacing").innerText();
  await openWorldCampaignArchive(page);
  const serverTownSocialResponseTextReady = await page.getByTestId("town-social-response").innerText();
  const serverResourceCommitmentTextUsed = await page.getByTestId("player-resource-commitment").innerText();
  const serverFactionRelationshipTextAfterCase = await page.getByTestId("faction-relationship-summary").innerText();
  const serverWorldArcTextAdvanced = await page.getByTestId("world-arc-progress").innerText();
  const serverInvestigatorProgressionTextAfterCase = await page.getByTestId("investigator-progression").innerText();
  await openWorldCampaignArchive(page);
  await page.getByTestId("investigator-headquarters").waitFor({ state: "visible", timeout: 30000 });
  const serverInvestigatorHeadquartersTextReady = await page.getByTestId("investigator-headquarters").innerText();
  const headquartersPrepareButton = page.getByTestId("investigator-headquarters").locator("article.available button").first();
  await headquartersPrepareButton.waitFor({ state: "visible", timeout: 30000 });
  await headquartersPrepareButton.click();
  await settleCampaignTransitionTheatre(page);
  await page.getByTestId("investigator-headquarters").getByText("prepared", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  const serverInvestigatorHeadquartersTextPrepared = await page.getByTestId("investigator-headquarters").innerText();
  await openWorldCampaignArchive(page);
  await page.getByTestId("world-arc-directive").waitFor({ state: "visible", timeout: 30000 });
  const serverWorldArcDirectiveTextReady = await page.getByTestId("world-arc-directive").innerText();
  const serverInfluenceBudgetTextReady = await page.getByTestId("world-influence-budget").innerText();
  const serverWorldCurrentActionDirectiveReady = await page.getByTestId("world-campaign-current-action").innerText();
  await page.getByTestId("world-arc-directive-defer").click();
  await settleCampaignTransitionTheatre(page);
  await page.getByTestId("world-arc-directive").getByText("defer", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  const serverWorldArcDirectiveTextDeferred = await page.getByTestId("world-arc-directive").innerText();
  await page.getByTestId("world-arc-directive-support").click();
  await settleCampaignTransitionTheatre(page);
  await page.getByTestId("world-arc-directive").getByText("scheduled", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  const serverWorldArcDirectiveTextScheduled = await page.getByTestId("world-arc-directive").innerText();
  const serverWorldCurrentActionScheduled = await page.getByTestId("world-campaign-current-action").innerText();
  const serverGuidedManualText = serverGuidedManualTexts.join("\n---\n") + "\n---\n" + await page.getByTestId("guided-manual-run").innerText();
  const serverGuidedStepJournalText = await page.getByTestId("guided-step-journal").innerText();
  const serverGuidedStepJournalCompletedSteps = (await page.getByTestId("guided-step-journal").getAttribute("data-completed-steps") || "").split(/\s+/).filter(Boolean);
  const serverSourceReviewText = await page.getByTestId("source-review-unlock").innerText();
  const serverSolvedCaseDebriefText = await page.getByTestId("solved-case-debrief").innerText();
  const serverReplayPracticeLoopTextBeforeAttempt = await page.getByTestId("replay-practice-loop").innerText();
  const serverReplayGoalCoachTextBeforeAttempt = await page.getByTestId("replay-goal-coach").innerText();
  const serverReplayAttemptScorecardTextBeforeAttempt = await page.getByTestId("replay-attempt-scorecard").innerText();
  await page.getByTestId("start-replay-attempt").click();
  await page.getByText(/replay attempt active/i).first().waitFor({ state: "visible", timeout: 30000 });
  const serverReplayOperationsScope = await page.getByTestId("player-resource-commitment").getAttribute("data-operation-scope");
  const serverReplayOperationsText = await page.getByTestId("player-resource-commitment").innerText();
  const serverReplayPracticeLoopTextAfterAttempt = await page.getByTestId("replay-practice-loop").innerText();
  const serverReplayGoalCoachTextAfterAttempt = await page.getByTestId("replay-goal-coach").innerText();
  await page.getByText(/pending replay delta/i).first().waitFor({ state: "visible", timeout: 30000 });
  const serverReplayAttemptScorecardTextPending = await page.getByTestId("replay-attempt-scorecard").innerText();
  const serverGuidedManualTextAfterReplayAttempt = await page.getByTestId("guided-manual-run").innerText();
  for (let index = 0; index < 100; index += 1) {
    const guidedText = await page.getByTestId("guided-manual-run").innerText();
    if (/select-evidence/i.test(guidedText) && await page.getByTestId("manual-evidence-drill").isVisible().catch(() => false)) break;
    if (/review source audit/i.test(guidedText) || /source review ready/i.test(guidedText) || /\baccepted\b/i.test(guidedText)) break;
    await page.getByTestId("run-next-guided-step").click();
    await waitForGuidedStepIdle(page);
    await page.waitForTimeout(900);
  }
  await page.getByTestId("manual-evidence-drill").waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Manual Evidence Drill", { exact: true }).first().waitFor({ state: "visible", timeout: 30000 });
  const serverGuidedManualTextAtManualDrill = await page.getByTestId("guided-manual-run").innerText();
  const serverManualEvidenceDrillTextBeforeAdd = await page.getByTestId("manual-evidence-drill").innerText();
  await page.getByTestId("manual-evidence-add").first().click();
  await page.waitForTimeout(500);
  const serverManualEvidenceDrillTextAfterFirstAdd = await page.getByTestId("manual-evidence-drill").innerText();
  for (let index = 0; index < 8; index += 1) {
    const addCount = await page.getByTestId("manual-evidence-add").count().catch(() => 0);
    if (!addCount) break;
    await page.getByTestId("manual-evidence-add").first().click();
    await page.waitForTimeout(300);
  }
  const serverManualEvidenceDrillTextAfterAdd = await page.getByTestId("manual-evidence-drill").innerText();
  const serverGuidedStepJournalTextAfterManualDrill = await page.getByTestId("guided-step-journal").innerText();
  const serverReplayPracticeLoopTextAfterManualDrill = await page.getByTestId("replay-practice-loop").innerText();
  const serverReplayAttemptScorecardTextAfterManualDrill = await page.getByTestId("replay-attempt-scorecard").innerText();
  const serverGuidedManualTextAfterManualDrill = await page.getByTestId("guided-manual-run").innerText();
  const serverManualTheoryReplay = await completeManualTheoryReplay(page);
  const serverReplayAttemptScorecardTextCompleted = await page.getByTestId("replay-attempt-scorecard").innerText();
  await page.getByRole("button", { name: "持续小镇" }).click();
  await page.getByTestId("persistent-command-center").waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("situation-campaign-pacing").waitFor({ state: "visible", timeout: 30000 });
  const serverSituationCampaignPacingText = await page.getByTestId("situation-campaign-pacing").innerText();
  const directiveStepButton = page.locator(".commandControls").first().locator("button").nth(2);
  let serverSituationDirectiveText = await page.getByTestId("situation-faction-directive").innerText().catch(() => "");
  const serverTownSocialSituationTexts = [];
  const serverSituationResourceCommitmentText = await page.getByTestId("situation-player-resource").innerText().catch(() => "");
  for (let index = 0; index < 24 && !/completed/i.test(serverSituationDirectiveText); index += 1) {
    if (/blocked/i.test(serverSituationDirectiveText)) {
      await page.evaluate(async () => {
        const saved = JSON.parse(localStorage.getItem("detective-town-launch-v1") || "{}");
        if (!saved.worldId) return;
        await fetch("/api/v1/command/town/runtime/step", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ worldId: saved.worldId, steps: 0, worldArcDirectiveDecision: { choice: "contain" } })
        });
      });
    }
    await waitForCommandButtonReady(directiveStepButton);
    await directiveStepButton.click();
    await waitForCommandButtonReady(directiveStepButton);
    serverSituationDirectiveText = await page.getByTestId("situation-faction-directive").innerText().catch(() => "");
    const socialText = await page.getByTestId("situation-town-social-response").innerText().catch(() => "");
    if (socialText) serverTownSocialSituationTexts.push(socialText);
  }
  if (!/completed/i.test(serverSituationDirectiveText)) throw new Error(`Faction directive did not complete in bounded browser steps: ${serverSituationDirectiveText}`);
  await page.getByTestId("situation-world-pressure").waitFor({ state: "visible", timeout: 30000 });
  const serverSituationPressureTextActive = await page.getByTestId("situation-world-pressure").innerText();
  await page.getByTestId("situation-influence-budget").waitFor({ state: "visible", timeout: 30000 });
  const serverSituationInfluenceBudgetTextActive = await page.getByTestId("situation-influence-budget").innerText();
  const serverSituationFactionRelationshipText = await page.getByTestId("situation-faction-relationship").innerText();
  await page.getByTestId("situation-world-event-offer").waitFor({ state: "visible", timeout: 30000 });
  const serverWorldEventOfferTextOffered = await page.getByTestId("situation-world-event-offer").innerText();
  await page.evaluate(async () => {
    const saved = JSON.parse(localStorage.getItem("detective-town-launch-v1") || "{}");
    if (!saved.worldId) return;
    await fetch("/api/v1/command/town/runtime/step", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ worldId: saved.worldId, steps: 0, worldEventOfferDecision: { choice: "accept" } })
    });
  });
  await waitForCommandButtonReady(directiveStepButton);
  await directiveStepButton.click();
  await waitForCommandButtonReady(directiveStepButton);
  const serverWorldEventOfferTextAccepted = await page.getByTestId("situation-world-event-offer").innerText();
  let serverWorldEventOfferTextTerminal = serverWorldEventOfferTextAccepted;
  for (let index = 0; index < 24 && !/completed|failed|expired/i.test(serverWorldEventOfferTextTerminal); index += 1) {
    await waitForCommandButtonReady(directiveStepButton);
    await directiveStepButton.click();
    await waitForCommandButtonReady(directiveStepButton);
    serverWorldEventOfferTextTerminal = await page.getByTestId("situation-world-event-offer").innerText();
    const socialText = await page.getByTestId("situation-town-social-response").innerText().catch(() => "");
    if (socialText) serverTownSocialSituationTexts.push(socialText);
  }
  if (!/completed|failed|expired/i.test(serverWorldEventOfferTextTerminal)) throw new Error(`World event offer did not reach a bounded terminal state: ${serverWorldEventOfferTextTerminal}`);
  const handoffExtractButton = page.locator("[data-testid='command-candidate-board'] article.valid button").first();
  await handoffExtractButton.waitFor({ state: "visible", timeout: 30000 });
  await handoffExtractButton.click();
  // A successful next-case extraction creates the chapter-transition beat.
  // Let the Theatre own that layer before reopening Case Files; otherwise it
  // correctly closes an Inspector that the test opened too early.
  const serverChapterTransitionPresentation = await settleCampaignTransitionTheatre(page, 30_000);
  await openCommandDeckInspectorDetail(page);
  await openWorldCampaignArchive(page);
  await page.getByTestId("world-lead-handoff").getByText("consumed", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  const serverWorldLeadTextConsumed = await page.getByTestId("world-lead-panel").innerText();
  const serverWorldArcTextNextCase = await page.getByTestId("world-arc-progress").innerText();
  const serverGuidedStepJournalTextAfterHandoff = await page.getByTestId("guided-step-journal").innerText();
  const serverWorldArcDirectiveTextCompleted = await page.getByTestId("world-arc-directive").innerText();
  await page.getByTestId("world-pressure-cascade").waitFor({ state: "visible", timeout: 30000 });
  const serverWorldPressureTextConsumed = await page.getByTestId("world-pressure-cascade").innerText();
  const serverInvestigatorHeadquartersTextActive = await page.getByTestId("investigator-headquarters").innerText();
  const serverInfluenceBudgetTextNextCase = await page.getByTestId("world-influence-budget").innerText();
  const serverWorldCurrentActionNextCase = await page.getByTestId("world-campaign-current-action").innerText();
  const serverTownSocialResponseTextAfterHandoff = await page.getByTestId("town-social-response").innerText();
  const summary = await page.evaluate(async () => {
    const text = document.body?.innerText || "";
    const saved = JSON.parse(localStorage.getItem("detective-town-launch-v1") || "{}");
    let worldId = saved.worldId || "";
    if (!worldId) {
      const created = await fetch("/api/worlds/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          seed: "world-system-runtime-hints-qa",
          mode: "showcase",
          caseMode: "premium",
          npcCount: 8,
          timelineHours: 24,
          preSimDays: 1
        })
      }).then((response) => response.json()).catch(() => null);
      worldId = created?.world?.id || "";
    }
    const runtimeResponse = worldId
      ? await fetch(`/api/v1/query/town/runtime?worldId=${encodeURIComponent(worldId)}`).then((response) => response.json()).catch(() => null)
      : null;
    const hintSummary = runtimeResponse?.data?.runtime?.worldSystemHintSummary || runtimeResponse?.runtime?.worldSystemHintSummary;
    return {
      hasDatasetPackage: text.includes("Dataset Package"),
      hasReplayDataset: text.includes("Replay Dataset"),
      hasWorldPackages: text.includes("World Packages"),
      hasRunCatalog: text.includes("RunCatalog") || text.includes("Run Catalog"),
      hasReplayBundle: text.includes("ReplayBundle") || text.includes("Replay Bundle"),
      hasWorldSystemRuntimeHints: Boolean(hintSummary?.active),
      hasWorldSystemRuntimeLabels: Boolean(hintSummary?.resourcePressureLabel && hintSummary?.factionLaneLabel && hintSummary?.eventArchetypeLabel && hintSummary?.progressionLineLabel),
      hasBoundedWorldSystemBias: typeof hintSummary?.maxActionBias === "number" && hintSummary.maxActionBias <= 4,
      hasServerPlaythroughProof: text.includes("Server Playthrough Proof"),
      hasServerPlaythroughAccepted: /completed \/ accepted theory/i.test(text),
      hasServerPlaythroughMetrics: /source-backed route/i.test(text) && /challenge hits/i.test(text) && /selected evidence/i.test(text) && /covered obligations/i.test(text),
      hasServerSourceReviewUnlock: /Source Review Unlock/i.test(text),
      hasServerSourceReviewWorkbench: /Source Trail/i.test(text) && /Proof Obligations/i.test(text) && /Certified Route/i.test(text) && /Conclusion Review/i.test(text),
      hasServerSourceReviewNoRawIds: true
    };
  });
  summary.serverPlaythroughText = serverPlaythroughText;
  summary.serverWorldLeadText = `${serverWorldLeadTextFollowed}\n---\n${serverWorldLeadTextActive}\n---\n${serverWorldLeadTextResolved}\n---\n${serverWorldLeadTextConsumed}`;
  summary.serverWorldCurrentActionText = `${serverWorldCurrentActionChoice}\n---\n${serverWorldCurrentActionDirectiveReady}\n---\n${serverWorldCurrentActionScheduled}\n---\n${serverWorldCurrentActionNextCase}`;
  summary.serverWorldArcDirectiveText = `${serverWorldArcDirectiveTextReady}\n---\n${serverWorldArcDirectiveTextDeferred}\n---\n${serverWorldArcDirectiveTextScheduled}\n---\n${serverSituationDirectiveText}\n---\n${serverWorldArcDirectiveTextCompleted}`;
  summary.serverWorldPressureText = `${serverSituationPressureTextActive}\n---\n${serverWorldPressureTextConsumed}`;
  summary.serverArcConvergenceText = serverArcConvergenceTextInitial;
  summary.serverCampaignSessionText = serverCampaignSessionTextInitial;
  summary.serverCampaignPacingText = `${serverCampaignPacingTextInitial}\n---\n${serverCampaignPacingTextResolved}\n---\n${serverGuidedCampaignPacingText}\n---\n${serverSituationCampaignPacingText}`;
  summary.serverWorldEventOfferText = `${serverWorldEventOfferTextOffered}\n---\n${serverWorldEventOfferTextAccepted}\n---\n${serverWorldEventOfferTextTerminal}`;
  summary.serverInfluenceBudgetText = `${serverInfluenceBudgetTextReady}\n---\n${serverSituationInfluenceBudgetTextActive}\n---\n${serverInfluenceBudgetTextNextCase}`;
  summary.serverResourceCommitmentText = `${serverResourceCommitmentTextReady}\n---\n${serverResourceCommitmentTextReserved}\n---\n${serverResourceCommitmentTextUsed}`;
  summary.serverInvestigatorHeadquartersText = `${serverInvestigatorHeadquartersTextReady}\n---\n${serverInvestigatorHeadquartersTextPrepared}\n---\n${serverInvestigatorHeadquartersTextActive}`;
  summary.serverSituationResourceCommitmentText = serverSituationResourceCommitmentText;
  summary.serverFactionRelationshipText = `${serverFactionRelationshipTextInitial}\n---\n${serverFactionRelationshipTextAfterCase}\n---\n${serverSituationFactionRelationshipText}`;
  summary.serverResourceCommitmentJournalText = `${serverResourceCommitmentJournalReservedText}\n---\n${serverGuidedStepJournalText}`;
  summary.serverGuidedManualText = serverGuidedManualText;
  summary.serverGuidedStepJournalText = `${serverGuidedStepJournalText}\n---\n${serverGuidedStepJournalTextAfterHandoff}`;
  summary.serverSourceReviewText = serverSourceReviewText;
  summary.serverSolvedCaseDebriefText = serverSolvedCaseDebriefText;
  summary.serverReplayPracticeLoopText = `${serverReplayPracticeLoopTextBeforeAttempt}\n---\n${serverReplayPracticeLoopTextAfterAttempt}\n---\n${serverManualTheoryReplay.replayPracticeLoopTextCompleted}`;
  summary.serverReplayGoalCoachText = `${serverReplayGoalCoachTextBeforeAttempt}\n---\n${serverReplayGoalCoachTextAfterAttempt}`;
  summary.serverReplayAttemptScorecardText = `${serverReplayAttemptScorecardTextBeforeAttempt}\n---\n${serverReplayAttemptScorecardTextPending}\n---\n${serverReplayAttemptScorecardTextCompleted}`;
  summary.serverManualEvidenceDrillText = `${serverManualEvidenceDrillTextBeforeAdd}\n---\n${serverManualEvidenceDrillTextAfterAdd}`;
  summary.serverWorldCurrentActionSamples = {
    choice: serverWorldCurrentActionChoice,
    directiveReady: serverWorldCurrentActionDirectiveReady,
    scheduled: serverWorldCurrentActionScheduled,
    nextCase: serverWorldCurrentActionNextCase
  };
  summary.hasDatasetPackage = summary.hasDatasetPackage || serverCatalogText.includes("Dataset Package");
  summary.hasReplayDataset = summary.hasReplayDataset || serverCatalogText.includes("Replay Dataset");
  summary.hasWorldPackages = summary.hasWorldPackages || serverCatalogText.includes("World Packages");
  summary.hasRunCatalog = summary.hasRunCatalog || serverCatalogText.includes("RunCatalog") || serverCatalogText.includes("Run Catalog");
  summary.hasReplayBundle = summary.hasReplayBundle || serverCatalogText.includes("ReplayBundle") || serverCatalogText.includes("Replay Bundle");
  summary.hasServerPlaythroughProof = summary.hasServerPlaythroughProof || /server playthrough proof/i.test(serverPlaythroughText);
  summary.hasServerPlaythroughAccepted = summary.hasServerPlaythroughAccepted || /completed \/ accepted theory/i.test(serverPlaythroughText);
  summary.hasServerPlaythroughMetrics = summary.hasServerPlaythroughMetrics || (/source-backed route/i.test(serverPlaythroughText) && /challenge hits/i.test(serverPlaythroughText) && /selected evidence/i.test(serverPlaythroughText) && /covered obligations/i.test(serverPlaythroughText));
  summary.hasServerWorldLead = /world lead/i.test(serverWorldLeadTextFollowed) && /followed/i.test(serverWorldLeadTextFollowed);
  summary.hasServerWorldCurrentAction = /campaign priority/i.test(serverWorldCurrentActionChoice)
    && /observe case window|choose how to approach this case/i.test(serverWorldCurrentActionChoice)
    && /review the public event window|follow the safe world lead|certified route/i.test(serverWorldCurrentActionChoice);
  summary.hasServerWorldCurrentActionDirectiveReady = /campaign priority/i.test(serverWorldCurrentActionDirectiveReady)
    && /choose one faction response|extract the next case with preparation active|review conclusion/i.test(serverWorldCurrentActionDirectiveReady)
    && /faction directive|next extraction|open the certified conclusion/i.test(serverWorldCurrentActionDirectiveReady);
  summary.hasServerWorldCurrentActionScheduled = /campaign priority/i.test(serverWorldCurrentActionScheduled)
    && /advance the existing town operation|extract the next case with preparation active|review conclusion/i.test(serverWorldCurrentActionScheduled)
    && /faction directive|next extraction|open the certified conclusion/i.test(serverWorldCurrentActionScheduled);
  summary.hasServerWorldCurrentActionNextCase = /campaign priority/i.test(serverWorldCurrentActionNextCase)
    && /join investigation|observe case window|choose how to approach this case/i.test(serverWorldCurrentActionNextCase)
    && /create the player session|review the public event window|certified investigation route/i.test(serverWorldCurrentActionNextCase);
  summary.hasServerWorldCampaignConsolidated = /case & world consequence/i.test(serverWorldLeadTextFollowed) && /campaign priority/i.test(serverWorldLeadTextFollowed);
  summary.hasServerWorldLeadResolved = /resolved/i.test(serverWorldLeadTextResolved);
  summary.hasServerWorldLeadOutcomeActive = /world effect/i.test(serverWorldLeadTextActive) && /active/i.test(serverWorldLeadTextActive);
  summary.hasServerWorldLeadOutcomeSettled = /world effect/i.test(serverWorldLeadTextResolved) && /settled/i.test(serverWorldLeadTextResolved);
  summary.hasServerWorldLeadHandoffReady = /ready/i.test(serverWorldLeadTextResolved) && /next case queue|follow-up/i.test(serverWorldLeadTextResolved);
  summary.hasServerWorldLeadHandoffConsumed = /consumed/i.test(serverWorldLeadTextConsumed) && /carried into the next|follow-up/i.test(serverWorldLeadTextConsumed);
  summary.hasServerWorldArcInitial = /active/i.test(serverWorldArcTextInitial) && /0\/\d+ stages/i.test(serverWorldArcTextInitial);
  summary.hasServerWorldArcAdvanced = /active|completed/i.test(serverWorldArcTextAdvanced) && /1\/\d+ stages/i.test(serverWorldArcTextAdvanced);
  summary.hasServerWorldArcNextCase = /world|arc|inquiry|pressure/i.test(serverWorldArcTextNextCase) && /\d+\/\d+ stages/i.test(serverWorldArcTextNextCase);
  summary.hasServerWorldArcJournal = /world arc (?:activated|resumed|advanced|completed)|faction directive prepared/i.test(serverGuidedStepJournalText);
  summary.hasServerWorldArcNoRawIds = !/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:case|evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(`${serverWorldArcTextInitial}\n${serverWorldArcTextAdvanced}\n${serverWorldArcTextNextCase}`);
  summary.hasServerWorldArcDirectiveReady = /faction directive/i.test(serverWorldArcDirectiveTextReady) && /ready/i.test(serverWorldArcDirectiveTextReady) && /support/i.test(serverWorldArcDirectiveTextReady) && /contain/i.test(serverWorldArcDirectiveTextReady);
  summary.hasServerWorldArcDirectiveDeferred = /defer/i.test(serverWorldArcDirectiveTextDeferred) && /response still open/i.test(serverWorldArcDirectiveTextDeferred);
  summary.hasServerWorldArcDirectiveScheduled = /scheduled/i.test(serverWorldArcDirectiveTextScheduled) && /next institution cycle/i.test(serverWorldArcDirectiveTextScheduled);
  summary.hasServerWorldArcDirectiveCompleted = /completed/i.test(serverSituationDirectiveText) && /completed/i.test(serverWorldArcDirectiveTextCompleted);
  summary.hasServerWorldArcDirectiveAggregates = /faction directive/i.test(serverSolvedCaseDebriefText) && /faction directive/i.test(serverReplayPracticeLoopTextBeforeAttempt) && /faction directive/i.test(serverReplayAttemptScorecardTextBeforeAttempt);
  summary.hasServerWorldArcDirectiveJournal = [
    /faction directive prepared/i,
    /faction directive deferred/i,
    /faction directive support selected/i,
    /faction directive started/i,
    /faction directive completed/i
  ].every((pattern) => pattern.test(`${serverGuidedStepJournalText}\n${serverGuidedStepJournalTextAfterHandoff}`));
  summary.hasServerWorldArcDirectiveNoRawIds = !/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:case|evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(summary.serverWorldArcDirectiveText);
  summary.hasServerWorldPressureActive = /world pressure/i.test(serverSituationPressureTextActive) && /active/i.test(serverSituationPressureTextActive) && /layer/i.test(serverSituationPressureTextActive);
  summary.hasServerWorldPressureConsumed = /world pressure/i.test(serverWorldPressureTextConsumed) && /consumed/i.test(serverWorldPressureTextConsumed) && /remaining layers/i.test(serverWorldPressureTextConsumed);
  summary.hasServerWorldPressureAggregates = /world pressure/i.test(serverSolvedCaseDebriefText) && /world pressure/i.test(serverReplayPracticeLoopTextBeforeAttempt) && /world pressure/i.test(serverReplayAttemptScorecardTextBeforeAttempt);
  summary.hasServerWorldPressureJournal = /world pressure activated/i.test(serverGuidedStepJournalTextAfterHandoff) && /world pressure carried into next case/i.test(serverGuidedStepJournalTextAfterHandoff);
  summary.hasServerWorldPressureNoRawIds = !/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:case|evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b|institutionId|resourceKind|longActionKind/i.test(summary.serverWorldPressureText);
  summary.hasServerTownSocialResponseReady = /town reactions/i.test(serverTownSocialResponseTextReady) && /ready/i.test(serverTownSocialResponseTextReady) && /0\/3/i.test(serverTownSocialResponseTextReady);
  summary.hasServerTownSocialResponseVisible = serverTownSocialSituationTexts.some((text) => /latest town reaction/i.test(text) && /·/.test(text));
  summary.hasServerTownSocialResponseSettled = /town reactions/i.test(serverTownSocialResponseTextAfterHandoff) && /(?:settled|active|ready)/i.test(serverTownSocialResponseTextAfterHandoff);
  summary.hasServerTownSocialResponseJournal = /town response (?:prepared|surfaced|settled)/i.test(serverGuidedStepJournalTextAfterHandoff);
  summary.hasServerTownSocialResponseAggregates = /town (?:social response|reactions)/i.test(serverSolvedCaseDebriefText) && /town reactions/i.test(serverReplayPracticeLoopTextBeforeAttempt) && /town reactions/i.test(serverReplayAttemptScorecardTextBeforeAttempt);
  summary.hasServerTownSocialResponseNoRawIds = !/npcId|locationId|institutionId|sourceKey|eventId|caseId|tick|delta|\bnpc-\d+\b|\bev-[a-z0-9-]+\b|culprit|victim/i.test(`${serverTownSocialResponseTextReady}\n${serverTownSocialSituationTexts.join("\n")}\n${serverTownSocialResponseTextAfterHandoff}`);
  summary.hasServerInvestigatorProgressionInitial = /investigator progression|practice profile/i.test(serverInvestigatorProgressionTextInitial) && /developing|practice marks|points/i.test(serverInvestigatorProgressionTextInitial);
  summary.hasServerInvestigatorProgressionAfterCase = /practice marks|competency|bounded unlock/i.test(serverInvestigatorProgressionTextAfterCase);
  summary.hasServerInvestigatorProgressionJournal = /investigator practice recorded|evidence practice recorded/i.test(serverGuidedStepJournalText);
  summary.hasServerInvestigatorProgressionNoRawIds = !/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:case|evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b|sourceKey|session-|caseId|ledger/i.test(`${serverInvestigatorProgressionTextInitial}\n${serverInvestigatorProgressionTextAfterCase}`);
  summary.hasServerInvestigatorHeadquartersReady = /investigator headquarters/i.test(serverInvestigatorHeadquartersTextReady) && /ready/i.test(serverInvestigatorHeadquartersTextReady) && /field search|witness work|contradiction analysis|evidence handling|institutional access/i.test(serverInvestigatorHeadquartersTextReady);
  summary.hasServerInvestigatorHeadquartersPrepared = /prepared/i.test(serverInvestigatorHeadquartersTextPrepared) && /selected/i.test(serverInvestigatorHeadquartersTextPrepared);
  summary.hasServerInvestigatorHeadquartersActive = /active/i.test(serverInvestigatorHeadquartersTextActive) && /next case|current case/i.test(serverInvestigatorHeadquartersTextActive);
  summary.hasServerInvestigatorHeadquartersNoRawIds = !/cycleKey|targetCaseId|sourceCaseId|createdAtTick|preparedAtTick|activatedAtTick|resourceKind|institutionId|caseId|tick|raw/i.test(summary.serverInvestigatorHeadquartersText);
  summary.hasServerCampaignRecoveryReady = /failure & recovery/i.test(serverManualTheoryReplay.campaignRecoveryTextReady) && /ready/i.test(serverManualTheoryReplay.campaignRecoveryTextReady) && /certified clue route/i.test(serverManualTheoryReplay.campaignRecoveryTextReady);
  summary.hasServerCampaignRecoveryCompleted = /completed/i.test(serverManualTheoryReplay.campaignRecoveryTextCompleted) && /continue through|certified investigation route/i.test(serverManualTheoryReplay.campaignRecoveryTextCompleted);
  summary.hasServerCampaignRecoveryJournal = /theory recovery path prepared/i.test(serverManualTheoryReplay.guidedStepJournalTextAfterManualTheoryFallback) && /campaign recovery started/i.test(serverManualTheoryReplay.guidedStepJournalTextAfterManualTheoryFallback);
  summary.hasServerCampaignRecoveryNoRawIds = !/sourceKey|sessionId|caseId|resourceKind|factionKind|offerId|createdAtTick|completedAtTick|applied.*Delta|\bnpc-\d+\b|\bev-[a-z0-9-]+\b/i.test(`${serverManualTheoryReplay.campaignRecoveryTextReady}\n${serverManualTheoryReplay.campaignRecoveryTextCompleted}`);
  summary.hasServerArcConvergenceVisible = /arc convergence/i.test(serverArcConvergenceTextInitial) && /civic reckoning|harbor inquest|public trust review/i.test(serverArcConvergenceTextInitial) && /locked|forming|ready/i.test(serverArcConvergenceTextInitial);
  summary.hasServerArcConvergenceNoRawIds = !/caseId|tick|signalKey|sourceKey|culprit|evidenceId|internal-|\bnpc-\d+\b|\bev-[a-z0-9-]+\b/i.test(serverArcConvergenceTextInitial);
  summary.hasServerCampaignSessionVisible = /town reckoning|harbor testimony|clinic headlines/i.test(serverCampaignSessionTextInitial) && /case 1/i.test(serverCampaignSessionTextInitial) && /0\/3 campaign cases closed/i.test(serverCampaignSessionTextInitial) && /records and custody|cargo logs and movement|medical timing and inventory/i.test(serverCampaignSessionTextInitial);
  summary.hasServerCampaignSessionNoRawIds = !/caseId|tick|sourceKey|signalKey|culprit|evidenceId|internal-|\bnpc-\d+\b|\bev-[a-z0-9-]+\b/i.test(serverCampaignSessionTextInitial);
  summary.hasServerCampaignPacingVisible = /campaign pacing/i.test(serverCampaignPacingTextInitial) && /why now/i.test(serverCampaignPacingTextInitial) && /what changes \/ what stays fair/i.test(serverCampaignPacingTextInitial);
  summary.hasServerCampaignPacingTransition = /campaign pacing/i.test(serverCampaignPacingTextResolved) && /active|waiting-choice|advancing|settled/i.test(serverCampaignPacingTextResolved);
  summary.hasServerCampaignPacingJournal = /campaign context/i.test(serverGuidedCampaignPacingText) && /why|continue|route|chapter|case/i.test(serverGuidedCampaignPacingText);
  summary.hasServerCampaignPacingSituationBrief = /why now \/ what changes/i.test(serverSituationCampaignPacingText);
  summary.hasServerCampaignPacingAggregates = /campaign pacing/i.test(serverSolvedCaseDebriefText) && /campaign pacing/i.test(serverReplayPracticeLoopTextBeforeAttempt);
  summary.hasServerCampaignPacingNoRawIds = !/caseId|sessionId|sourceId|eventId|npcId|locationId|institutionId|resourceId|culprit|victim|hiddenTruth|rawBody|\b(?:case|npc|event|source|location|institution|resource|evidence|session|world)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(summary.serverCampaignPacingText);
  summary.hasServerObjectiveFirstWorldCampaign = serverWorldCampaignArchiveDefaultClosed
    && Boolean(serverWorldCampaignFocusSurface && serverWorldCampaignFocusSurface !== "overview")
    && /campaign priority/i.test(serverWorldCampaignPriorityText);
  const serverTransitionEvidence = [serverTransitionPresentation, serverChapterTransitionPresentation];
  summary.hasServerCampaignTransitionTheatre = serverTransitionEvidence.some((item) => item.seen
    && ["resolve", "result", "consequence", "next"].every((label) => item.text.toLowerCase().includes(label))
    && item.controlHeight >= 44);
  summary.hasServerCampaignTransitionNoRawIds = !/caseId|sessionId|sourceId|eventId|npcId|locationId|institutionId|resourceId|culprit|victim|hiddenTruth|rawBody|\b(?:case|npc|event|source|location|institution|resource|evidence|session|world)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(serverTransitionEvidence.map((item) => item.text).join("\n"));
  summary.hasServerWorldEventOfferOffered = /world opportunity/i.test(serverWorldEventOfferTextOffered) && /offered/i.test(serverWorldEventOfferTextOffered);
  summary.hasServerWorldEventOfferAccepted = /accepted/i.test(serverWorldEventOfferTextAccepted) && /zero|next legal institution cycle/i.test(serverWorldEventOfferTextAccepted);
  summary.hasServerWorldEventOfferTerminal = /completed|failed|expired/i.test(serverWorldEventOfferTextTerminal);
  summary.hasServerWorldEventOfferNoRawIds = !/world-event-offer|world-arc-directive|eventArchetypeId|institutionKind|longActionKind|createdAtTick|expiresAtTick|npc-|case-|event-|source-|resource/i.test(summary.serverWorldEventOfferText);
  summary.hasServerInfluenceBudgetReady = /unified influence budget/i.test(serverInfluenceBudgetTextReady) && /active sources/i.test(serverInfluenceBudgetTextReady) && /±3|\+\/-3/.test(serverInfluenceBudgetTextReady);
  summary.hasServerInfluenceBudgetActive = /influence budget/i.test(serverSituationInfluenceBudgetTextActive) && /3 source/i.test(serverSituationInfluenceBudgetTextActive) && /3 cap/i.test(serverSituationInfluenceBudgetTextActive);
  summary.hasServerInfluenceBudgetConsumed = /unified influence budget/i.test(serverInfluenceBudgetTextNextCase) && !/next-case follow-up|world pressure/i.test(serverInfluenceBudgetTextNextCase);
  summary.hasServerInfluenceBudgetNoRawIds = !/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:case|evidence|event|source|pulse)-[a-z0-9-]*\d[a-z0-9-]*\b|progressionLineId|institutionId|resourceKind|longActionKind/i.test(summary.serverInfluenceBudgetText);
  summary.hasServerResourceCommitmentReady = /investigation operations|case operations board/i.test(serverResourceCommitmentTextReady) && /ready/i.test(serverResourceCommitmentTextReady) && /police time/i.test(serverResourceCommitmentTextReady) && /informant trust/i.test(serverResourceCommitmentTextReady) && /evidence integrity/i.test(serverResourceCommitmentTextReady);
  summary.hasServerResourceCommitmentReserved = /planned/i.test(serverResourceCommitmentTextReserved) && /[12]\/2/i.test(serverResourceCommitmentTextReserved) && /advance town/i.test(serverResourceCommitmentTextReserved);
  summary.hasServerResourceCommitmentUsed = /settled/i.test(serverResourceCommitmentTextUsed) && /after action/i.test(serverResourceCommitmentTextUsed) && /3\/3/i.test(serverResourceCommitmentTextUsed);
  summary.hasServerResourceCommitmentJournal = /investigation support planned|manual first operations planned/i.test(summary.serverResourceCommitmentJournalText) && /operation resolved/i.test(summary.serverResourceCommitmentJournalText);
  summary.hasServerResourceCommitmentSituationBrief = /investigation operations/i.test(serverSituationResourceCommitmentText) && /3\/3 resolved/i.test(serverSituationResourceCommitmentText);
  summary.hasServerResourceCommitmentNoRawIds = !/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:case|evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b|police_time|informant_trust|evidence_integrity|sessionId|caseId|locationId|resourceKind/i.test(summary.serverResourceCommitmentText);
  summary.hasServerReplayOperationsPractice = serverReplayOperationsScope === "practice"
    && /replay practice|frozen operations summary/i.test(serverReplayOperationsText)
    && /3\/3/i.test(serverReplayOperationsText)
    && /150 min/i.test(serverReplayOperationsText);
  summary.hasServerFactionRelationshipInitial = /faction standing/i.test(serverFactionRelationshipTextInitial) && /neutral/i.test(serverFactionRelationshipTextInitial);
  summary.hasServerFactionRelationshipChanged = /changed/i.test(serverFactionRelationshipTextAfterCase) && /standing (?:improved|declined)/i.test(serverFactionRelationshipTextAfterCase);
  summary.hasServerFactionRelationshipPricing = /reserve\s+[123]/i.test(serverResourceCommitmentTextReady) && /neutral|trusted|strained|ample|limited/i.test(serverResourceCommitmentTextReady);
  summary.hasServerFactionRelationshipSituationBrief = /faction standing/i.test(serverSituationFactionRelationshipText) && /trusted|guarded/i.test(serverSituationFactionRelationshipText);
  summary.hasServerFactionRelationshipJournal = /faction standing changed|case standing recorded/i.test(`${serverGuidedStepJournalText}\n${serverGuidedStepJournalTextAfterHandoff}`);
  summary.hasServerFactionRelationshipNoRawIds = !/factionKind|sourceKey|requestedDelta|appliedDelta|directive-|session-|case-|institutionId|resourceKind|updatedAtTick/i.test(summary.serverFactionRelationshipText);
  summary.hasServerWorldLeadNoRawIds = !/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(summary.serverWorldLeadText);
  summary.hasServerGuidedManualRun = /guided manual run/i.test(serverGuidedManualText);
  summary.hasServerGuidedManualProgression = ["search complete", "question complete", "challenge complete", "evidence selected", "accepted"].every((label) => serverGuidedManualText.toLowerCase().includes(label));
  summary.hasServerGuidedManualReadyToReview = /review source audit/i.test(serverGuidedManualText) || /source review ready/i.test(serverGuidedManualText) || /\baccepted\b/i.test(serverGuidedManualText);
  summary.hasServerGuidedStepJournal = /guided step journal/i.test(serverGuidedStepJournalText);
  summary.hasServerGuidedStepJournalEntries = ["join", "search", "question", "challenge", "select-evidence", "submit", "review-source"]
    .every((step) => serverGuidedStepJournalCompletedSteps.includes(step));
  summary.hasServerGuidedStepJournalFallback = /certified fallback/i.test(serverGuidedStepJournalText) && /used/i.test(serverGuidedStepJournalText);
  summary.hasServerGuidedStepJournalReviewUnlock = /review unlocked/i.test(serverGuidedStepJournalText) || /source review workbench unlocked/i.test(serverGuidedStepJournalText);
  summary.hasServerGuidedStepJournalHandoff = /world lead handoff prepared/i.test(serverGuidedStepJournalText) && /world lead handoff carried/i.test(serverGuidedStepJournalTextAfterHandoff);
  summary.hasServerGuidedStepJournalNoRawIds = !/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(serverGuidedStepJournalText);
  summary.hasServerSourceReviewUnlock = summary.hasServerSourceReviewUnlock || /source review unlock/i.test(serverSourceReviewText);
  summary.hasServerSourceReviewWorkbench = summary.hasServerSourceReviewWorkbench || ["source trail", "proof obligations", "certified route", "conclusion review"].every((label) => serverSourceReviewText.toLowerCase().includes(label));
  summary.hasServerSourceReviewNoRawIds = !/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(serverSourceReviewText);
  summary.hasServerSolvedCaseDebrief = /solved case debrief/i.test(serverSolvedCaseDebriefText) && /investigation completed \/ accepted/i.test(serverSolvedCaseDebriefText);
  summary.hasServerSolvedCaseDebriefSections = ["player route", "evidence closure", "source confidence", "next replay goal"].every((label) => serverSolvedCaseDebriefText.toLowerCase().includes(label));
  summary.hasServerSolvedCaseDebriefMetrics = /certified fallback/i.test(serverSolvedCaseDebriefText) && /proof gaps/i.test(serverSolvedCaseDebriefText) && /selected evidence/i.test(serverSolvedCaseDebriefText);
  summary.hasServerSolvedCaseDebriefNoRawIds = !/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(serverSolvedCaseDebriefText);
  summary.hasServerReplayGoalCoach = /replay goal coach/i.test(serverReplayGoalCoachTextBeforeAttempt);
  summary.hasServerReplayGoalCoachGoals = ["reduce fallback", "manual evidence selection", "fewer guided clicks", "review source after submit"].every((label) => serverReplayGoalCoachTextBeforeAttempt.toLowerCase().includes(label));
  summary.hasServerReplayGoalCoachMetrics = /previous guided steps/i.test(serverReplayGoalCoachTextBeforeAttempt) && /fallback used/i.test(serverReplayGoalCoachTextBeforeAttempt) && /selected evidence/i.test(serverReplayGoalCoachTextBeforeAttempt) && /proof gaps/i.test(serverReplayGoalCoachTextBeforeAttempt);
  summary.hasServerReplayGoalAttemptStarted = /replay attempt active/i.test(serverReplayGoalCoachTextAfterAttempt) && /completed replay goals/i.test(serverReplayGoalCoachTextAfterAttempt);
  summary.hasServerReplayGoalAttemptGuidedRun = /replay attempt active/i.test(serverReplayGoalCoachTextAfterAttempt)
    && /guided manual run/i.test(serverGuidedManualTextAfterReplayAttempt)
    && /current step/i.test(serverGuidedManualTextAfterReplayAttempt)
    && /\b(?:join|search|question|challenge|select-evidence|submit|review-source)\b/i.test(serverGuidedManualTextAfterReplayAttempt);
  summary.hasServerReplayGoalCoachNoRawIds = !/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(`${serverReplayGoalCoachTextBeforeAttempt}\n${serverReplayGoalCoachTextAfterAttempt}`);
  summary.hasServerReplayPracticeLoop = /replay practice loop/i.test(serverReplayPracticeLoopTextBeforeAttempt);
  summary.hasServerReplayPracticeLoopStages = ["start", "discover", "pick evidence", "fill theory", "submit", "review source", "scorecard"].every((label) => serverReplayPracticeLoopTextBeforeAttempt.toLowerCase().includes(label));
  summary.hasServerReplayPracticeLoopAttempt = /active attempt/i.test(serverReplayPracticeLoopTextAfterAttempt) && /run next guided step|use manual evidence drill/i.test(serverReplayPracticeLoopTextAfterAttempt);
  summary.hasServerReplayPracticeLoopManualEvidence = /manual evidence picks/i.test(serverReplayPracticeLoopTextAfterManualDrill) && /pick evidence/i.test(serverReplayPracticeLoopTextAfterManualDrill);
  summary.hasServerReplayPracticeLoopManualTheory = /manual theory fields/i.test(serverManualTheoryReplay.replayPracticeLoopTextAfterManualTheoryFill) && /fill theory|submit/i.test(serverManualTheoryReplay.replayPracticeLoopTextAfterManualTheoryFill);
  summary.hasServerReplayPracticeLoopBlockedFallback = /blocked gaps/i.test(serverManualTheoryReplay.replayPracticeLoopTextAfterBlockedSubmit)
    && /fallback theory fields/i.test(serverManualTheoryReplay.replayPracticeLoopTextAfterFallback)
    && /explicit fallback/i.test(serverManualTheoryReplay.replayPracticeLoopTextAfterFallback);
  summary.hasServerReplayPracticeLoopCompleted = /source review/i.test(serverManualTheoryReplay.replayPracticeLoopTextCompleted)
    && /unlocked/i.test(serverManualTheoryReplay.replayPracticeLoopTextCompleted)
    && /completed/i.test(serverManualTheoryReplay.replayPracticeLoopTextCompleted)
    && /scorecard/i.test(serverManualTheoryReplay.replayPracticeLoopTextCompleted);
  summary.hasServerFinalWorkspaceRecovery = serverManualTheoryReplay.finalWorkspaceRecovery.stage === "recovery"
    && serverManualTheoryReplay.finalWorkspaceRecovery.theoryState === "rejected"
    && serverManualTheoryReplay.finalWorkspaceRecovery.recoveryVisible
    && serverManualTheoryReplay.finalWorkspaceRecovery.actionKind === "recover"
    && serverManualTheoryReplay.finalWorkspacePostRecoveryActionKind === "submit";
  summary.hasServerFinalWorkspaceSourceReview = ["source-review", "resolved"].includes(serverManualTheoryReplay.finalWorkspaceResolved.stage)
    && serverManualTheoryReplay.finalWorkspaceResolved.theoryState === "accepted"
    && serverManualTheoryReplay.finalWorkspaceResolved.sourceReviewVisible
    && serverManualTheoryReplay.finalWorkspaceResolved.primaryCount === 1;
  summary.hasServerFinalWorkspaceResolutionLedger = serverManualTheoryReplay.finalWorkspaceResolved.ledgerVisible;
  summary.hasServerReplayPracticeLoopNoRawIds = !/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(`${serverReplayPracticeLoopTextBeforeAttempt}\n${serverReplayPracticeLoopTextAfterAttempt}\n${serverReplayPracticeLoopTextAfterManualDrill}\n${serverManualTheoryReplay.replayPracticeLoopTextAfterManualTheoryFill}\n${serverManualTheoryReplay.replayPracticeLoopTextAfterBlockedSubmit}\n${serverManualTheoryReplay.replayPracticeLoopTextAfterFallback}\n${serverManualTheoryReplay.replayPracticeLoopTextCompleted}`);
  summary.hasServerManualEvidenceDrill = /manual evidence drill/i.test(serverManualEvidenceDrillTextBeforeAdd);
  summary.hasServerManualEvidenceDrillProgress = /selected evidence/i.test(serverManualEvidenceDrillTextBeforeAdd) && /route target count/i.test(serverManualEvidenceDrillTextBeforeAdd) && /remaining proof slots/i.test(serverManualEvidenceDrillTextBeforeAdd);
  summary.hasServerManualEvidenceDrillAdd = /add to theory/i.test(serverManualEvidenceDrillTextBeforeAdd) && /selected/i.test(serverManualEvidenceDrillTextAfterFirstAdd);
  summary.hasServerManualEvidenceDrillJournal = /manual evidence drill/i.test(serverGuidedStepJournalTextAfterManualDrill) && /manually selected/i.test(serverGuidedStepJournalTextAfterManualDrill);
  summary.hasServerManualEvidenceDrillScorecardSignal = /manual picks/i.test(serverReplayAttemptScorecardTextAfterManualDrill) && /fallback picks/i.test(serverReplayAttemptScorecardTextAfterManualDrill);
  summary.hasServerManualEvidenceDrillGuidedPrompt = /manual evidence drill/i.test(serverGuidedManualTextAtManualDrill) || /select-evidence/i.test(serverGuidedManualTextAtManualDrill);
  summary.hasServerManualEvidenceDrillNoRawIds = !/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(`${serverManualEvidenceDrillTextBeforeAdd}\n${serverManualEvidenceDrillTextAfterAdd}\n${serverGuidedStepJournalTextAfterManualDrill}\n${serverReplayAttemptScorecardTextAfterManualDrill}`);
  summary.hasServerManualTheoryDrill = /manual theory drill/i.test(serverManualTheoryReplay.manualTheoryDrillTextBeforeFill);
  summary.hasServerManualTheoryDrillProgress = /manual fields/i.test(serverManualTheoryReplay.manualTheoryDrillTextBeforeFill)
    && /remaining fields/i.test(serverManualTheoryReplay.manualTheoryDrillTextBeforeFill)
    && /evidence ready/i.test(serverManualTheoryReplay.manualTheoryDrillTextBeforeFill)
    && /ready for submit/i.test(serverManualTheoryReplay.manualTheoryDrillTextAfterFill);
  summary.hasServerManualTheoryDrillManualFields = /3\/3 theory field\(s\) completed manually/i.test(serverManualTheoryReplay.guidedStepJournalTextAfterManualTheoryFill)
    || /manual theory fields/i.test(serverManualTheoryReplay.replayAttemptScorecardTextAfterManualTheoryFill);
  summary.hasServerManualTheoryDrillBlocksAutoFallback = /blocked gaps/i.test(serverManualTheoryReplay.manualTheoryDrillTextAfterBlockedSubmit)
    || /field-level gap/i.test(serverManualTheoryReplay.manualTheoryDrillTextAfterBlockedSubmit);
  summary.hasServerManualTheoryDrillExplicitFallback = /explicit fallback approved/i.test(serverManualTheoryReplay.manualTheoryDrillTextAfterFallback)
    && /unresolved theory field/i.test(serverManualTheoryReplay.guidedStepJournalTextAfterManualTheoryFallback);
  summary.hasServerManualTheoryDrillScorecardSignal = /manual theory fields/i.test(serverReplayAttemptScorecardTextCompleted)
    && /fallback theory fields/i.test(serverReplayAttemptScorecardTextCompleted)
    && /blocked theory gaps/i.test(serverReplayAttemptScorecardTextCompleted);
  summary.hasServerManualTheoryDrillNoRawIds = !/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(`${serverManualTheoryReplay.manualTheoryDrillTextBeforeFill}\n${serverManualTheoryReplay.manualTheoryDrillTextAfterFill}\n${serverManualTheoryReplay.manualTheoryDrillTextAfterBlockedSubmit}\n${serverManualTheoryReplay.manualTheoryDrillTextAfterFallback}\n${serverManualTheoryReplay.guidedStepJournalTextAfterManualTheoryFallback}\n${serverManualTheoryReplay.replayAttemptScorecardTextAfterManualTheoryFallback}`);
  summary.hasServerReplayAttemptScorecard = /replay attempt scorecard/i.test(serverReplayAttemptScorecardTextBeforeAttempt);
  summary.hasServerReplayAttemptScorecardPending = /pending replay delta/i.test(serverReplayAttemptScorecardTextPending) && /current step/i.test(serverReplayAttemptScorecardTextPending);
  summary.hasServerReplayAttemptScorecardCompleted = /completed replay delta/i.test(serverReplayAttemptScorecardTextCompleted);
  summary.hasServerReplayAttemptScorecardDeltas = ["guided clicks", "explicit fallback", "manual evidence selection", "manual theory fields", "proof gaps", "source review unlocked", "completed replay goals"].every((label) => serverReplayAttemptScorecardTextCompleted.toLowerCase().includes(label))
    && /previous:/i.test(serverReplayAttemptScorecardTextCompleted)
    && /current:/i.test(serverReplayAttemptScorecardTextCompleted)
    && /manual picks/i.test(serverReplayAttemptScorecardTextCompleted)
    && /fallback picks/i.test(serverReplayAttemptScorecardTextCompleted)
    && /\b(?:improved|unchanged|regressed|completed)\b/i.test(serverReplayAttemptScorecardTextCompleted);
  summary.hasServerReplayAttemptScorecardNoRawIds = !/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(`${serverReplayAttemptScorecardTextBeforeAttempt}\n${serverReplayAttemptScorecardTextPending}\n${serverReplayAttemptScorecardTextCompleted}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  const serverOperationsMobile = await page.evaluate(() => ({
    overflow: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) - window.innerWidth,
    boardVisible: Boolean(document.querySelector("[data-testid='player-resource-commitment']")),
    boardWidth: document.querySelector("[data-testid='player-resource-commitment']")?.getBoundingClientRect().width || 0,
    viewport: window.innerWidth
  }));
  summary.hasServerOperationsMobileBoard = serverOperationsMobile.boardVisible
    && serverOperationsMobile.overflow <= 1
    && serverOperationsMobile.boardWidth <= serverOperationsMobile.viewport + 1;
  const failures = [];
  for (const [key, value] of Object.entries(summary)) {
    if (!value) failures.push(`${key} was false.`);
  }
  return { ok: failures.length === 0, failures, summary };
}

const json = hasFlag("json");
const baseUrl = await resolveBaseUrl();

let server;
let browser;
let currentQaStep = "startup";
try {
  server = await ensureServer(baseUrl);
  browser = await chromium.launch(chromiumLaunchOptions());
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  currentQaStep = "desktop Static Runtime";
  const staticReport = await verifyStaticPage(page, baseUrl);
  currentQaStep = "390px Static Runtime";
  const mobileReport = await verifyMobile(page, baseUrl);
  currentQaStep = "Server Runtime playthrough";
  const serverReport = await verifyServerRuntime(page, baseUrl);
  const failures = [...staticReport.failures, ...mobileReport.failures, ...serverReport.failures];
  const report = {
    ok: failures.length === 0,
    baseUrl,
    serverStarted: server.started,
    static: staticReport,
    mobile: mobileReport,
    serverRuntime: serverReport,
    failures
  };
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Static browser QA: ${report.ok ? "ok" : "failed"}`);
    console.log(`Server: ${server.started ? "started" : "reused"}`);
    console.log(`Static /api requests: ${staticReport.apiRequests.length}`);
    console.log(`Static catalog requests: ${staticReport.catalogRequests.length}`);
    console.log(`Static dataset requests: ${staticReport.datasetRequests.length}`);
    console.log(`Mobile overflow: ${mobileReport.summary.scrollWidth - mobileReport.summary.clientWidth}`);
    console.log(`Server runtime panels: ${serverReport.ok ? "ok" : "failed"}`);
    for (const failure of failures) console.log(`- ${failure}`);
  }
  if (!report.ok) process.exitCode = 1;
} catch (error) {
  const detail = error instanceof Error ? error.message : "Unknown error";
  const message = `${currentQaStep}: ${detail}`;
  if (json) console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  else console.error(message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server?.started && server.child) {
    stopServerChild(server.child);
  }
}
