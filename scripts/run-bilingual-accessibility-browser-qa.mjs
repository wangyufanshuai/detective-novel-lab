import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { startReleaseCandidateServer } from "./lib/release-candidate-server.mjs";

const jsonMode = process.argv.includes("--json");
let baseUrl = "";
const failures = [];
const observations = [];
let serverHarness;
let step = "startup";

function launchOptions() {
  const executablePath = chromium.executablePath();
  return fs.existsSync(executablePath) ? { headless: true, executablePath } : { headless: true };
}

async function assertAxe(page, label) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const severe = result.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
  if (severe.length) failures.push(`${label} axe: ${severe.map((item) => `${item.id}(${item.nodes.map((node) => node.target.join(" ")).join(" | ")})`).join(", ")}`);
  return severe.length;
}

async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
  if (overflow > 1) failures.push(`${label} overflowed horizontally by ${overflow}px.`);
  return overflow;
}

try {
  if (!fs.existsSync(path.join(process.cwd(), ".next", "BUILD_ID"))) throw new Error("Run npm.cmd run build before bilingual accessibility QA.");
  serverHarness = await startReleaseCandidateServer({
    prefix: "rc-accessibility-bilingual",
    healthPath: "/?runtime=static&lang=en-US",
    env: { AI_PROVIDER: "mock", DEEPSEEK_API_KEY: "", SILICONFLOW_API_KEY: "" }
  });
  baseUrl = serverHarness.baseUrl;
  const browser = await chromium.launch(launchOptions());
  try {
    for (const locale of ["en-US", "zh-CN"]) {
      for (const width of [320, 390, 768, 1440]) {
        step = `Static ${locale} ${width}px`;
        const context = await browser.newContext({ viewport: { width, height: width <= 390 ? 780 : 900 } });
        const page = await context.newPage();
        const apiRequests = [];
        page.on("request", (request) => {
          const pathname = new URL(request.url()).pathname;
          if (pathname.startsWith("/api/")) apiRequests.push(pathname);
        });
        await page.goto(`${baseUrl}/?runtime=static&lang=${locale}&study=1`, { waitUntil: "networkidle" });
        await page.getByTestId("campaign-front-door").waitFor({ state: "visible", timeout: 15_000 });
        const language = await page.locator("html").getAttribute("lang");
        if (language !== locale) failures.push(`${step} html lang was ${language}.`);
        if (apiRequests.length) failures.push(`${step} requested ${apiRequests.join(", ")}.`);
        const storage = await page.evaluate(() => ({
          server: localStorage.getItem("detective-town-launch-v1"),
          bootstrap: sessionStorage.getItem("detective-town-bootstrap-v1"),
          study: localStorage.getItem("detective-town-campaign-study-v1"),
          locale: localStorage.getItem("detective-town-locale-v1")
        }));
        if (storage.server || storage.bootstrap || storage.study || storage.locale) failures.push(`${step} wrote browser storage without an explicit player choice.`);
        if (await page.getByTestId("campaign-study-recorder").count()) failures.push(`${step} exposed the Server-only Study Recorder.`);
        const frontText = await page.getByTestId("campaign-front-door").innerText();
        if (locale === "en-US" && !frontText.includes("4 Campaign previews")) failures.push(`${step} missed the English Front Door projection.`);
        if (locale === "zh-CN" && !frontText.includes("4 个 Campaign 预览")) failures.push(`${step} missed the Chinese Front Door projection.`);
        await assertNoOverflow(page, step);
        if (width === 320) {
          await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
          await assertNoOverflow(page, `${step} at 200% text zoom`);
          const controls = await page.locator("button:visible:not(.mapTile):not(.mapTileHitTarget):not(.marker):not(.actorPin), select:visible, input:visible:not([type='range'])").evaluateAll((nodes) => nodes.slice(0, 80).map((node) => ({
            height: node.getBoundingClientRect().height,
            label: (node.getAttribute("aria-label") || node.textContent || node.getAttribute("name") || node.tagName).trim().slice(0, 80)
          })));
          const undersized = controls.filter((item) => item.height > 0 && item.height < 44);
          if (undersized.length) failures.push(`${step} has controls below 44px: ${undersized.map((item) => `${item.label}=${item.height.toFixed(1)}`).join(", ")}.`);
        }
        if (width === 390) await assertAxe(page, step);
        observations.push({ runtime: "static", locale, width, apiRequests: apiRequests.length });
        await context.close();
      }
    }

    step = "Server English keyboard dialog";
    const serverContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const page = await serverContext.newPage();
    const serverRequests = [];
    page.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith("/api/")) serverRequests.push(pathname);
    });
    await page.goto(`${baseUrl}/?runtime=server&lang=en-US`, { waitUntil: "networkidle" });
    const frontDoor = page.getByTestId("campaign-front-door");
    await frontDoor.waitFor({ state: "visible", timeout: 15_000 });
    const frontDoorOnboarding = page.getByTestId("onboarding-overlay");
    if (await frontDoorOnboarding.isVisible().catch(() => false)) {
      await frontDoorOnboarding.locator(".closeButton").click();
      await frontDoorOnboarding.waitFor({ state: "hidden", timeout: 5_000 });
    }
    if (!await page.locator("#campaign-front-door-title").evaluate((node) => node === document.activeElement)) failures.push("Front Door did not focus its heading on open.");
    for (let index = 0; index < 18; index += 1) await page.keyboard.press("Tab");
    if (!await frontDoor.evaluate((node) => node.contains(document.activeElement))) failures.push("Front Door Tab sequence escaped the modal.");
    await assertAxe(page, step);
    await page.keyboard.press("Escape");
    await frontDoor.waitFor({ state: "hidden", timeout: 5_000 });
    const reopen = page.getByTestId("open-campaign-front-door");
    await reopen.focus();
    await reopen.press("Enter");
    await frontDoor.waitFor({ state: "visible", timeout: 5_000 });
    await page.waitForFunction(() => document.querySelector("#campaign-front-door-title") === document.activeElement, undefined, { timeout: 5_000 });
    await page.keyboard.press("Escape");
    await frontDoor.waitFor({ state: "hidden", timeout: 5_000 });
    await page.waitForFunction(() => document.querySelector("[data-testid='open-campaign-front-door']") === document.activeElement, undefined, { timeout: 5_000 });
    if (!await reopen.evaluate((node) => node === document.activeElement)) failures.push("Front Door did not restore focus to its trigger after Escape.");

    step = "Server reload idempotence";
    const createCountBeforeReload = serverRequests.filter((pathname) => pathname === "/api/worlds/create").length;
    await page.reload({ waitUntil: "networkidle" });
    await frontDoor.waitFor({ state: "visible", timeout: 15_000 });
    const createCountAfterReload = serverRequests.filter((pathname) => pathname === "/api/worlds/create").length;
    if (createCountAfterReload !== createCountBeforeReload) failures.push(`Server reload created ${createCountAfterReload - createCountBeforeReload} duplicate bootstrap world(s).`);
    if (!await page.evaluate(() => sessionStorage.getItem("detective-town-bootstrap-v1")?.includes('"formatVersion":1'))) failures.push("Server bootstrap pointer was not versioned after first creation.");
    await page.keyboard.press("Escape");
    const onboarding = page.getByTestId("onboarding-overlay");
    if (await onboarding.isVisible().catch(() => false)) {
      if (!await page.locator("#onboarding-title").evaluate((node) => node === document.activeElement)) failures.push("Onboarding did not focus its heading.");
      await page.keyboard.press("Escape");
      await onboarding.waitFor({ state: "hidden", timeout: 5_000 });
    }

    step = "Server responsive workspace";
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width <= 390 ? 780 : 900 });
      await assertNoOverflow(page, `Server en-US ${width}px`);
      if (!await page.getByTestId("command-deck-shell").isVisible()) failures.push(`Server en-US ${width}px lost the Command Deck.`);
    }
    await page.setViewportSize({ width: 1440, height: 960 });

    step = "Server duplicate and failed actions";
    const settings = page.locator(".settingsDrawer");
    if (!await settings.getAttribute("open")) await settings.locator(":scope > summary").click();
    const resetTown = settings.locator("button.primaryButton");
    const createCountBeforeDoubleClick = serverRequests.filter((pathname) => pathname === "/api/worlds/create").length;
    await resetTown.evaluate((button) => { button.click(); button.click(); });
    await page.waitForFunction(() => !document.querySelector(".settingsDrawer button.primaryButton")?.hasAttribute("disabled"), undefined, { timeout: 30_000 });
    const duplicateCreateDelta = serverRequests.filter((pathname) => pathname === "/api/worlds/create").length - createCountBeforeDoubleClick;
    if (duplicateCreateDelta !== 1) failures.push(`Duplicate Create Town dispatched ${duplicateCreateDelta} requests.`);
    await page.route("**/api/players/join", (route) => route.abort("failed"));
    const joinButton = page.getByRole("button", { name: "Join Investigation" }).first();
    await joinButton.click();
    await page.waitForFunction(() => /Joining failed/i.test(document.querySelector("[data-testid='status-line']")?.textContent || ""), undefined, { timeout: 10_000 });
    const joinRecovery = await page.evaluate(() => ({
      pointer: JSON.parse(localStorage.getItem("detective-town-launch-v1") || "null"),
      status: document.querySelector("[data-testid='status-line']")?.textContent || ""
    }));
    if (joinRecovery.pointer?.sessionId) failures.push("Failed optimistic Join persisted a session pointer.");
    if (/session-pending|TypeError|Failed to fetch|[A-Za-z]:[\\/]/i.test(joinRecovery.status)) failures.push("Failed Join exposed pending state or a raw client error.");
    await page.unroute("**/api/players/join");

    const localeToggle = page.locator(".localeSwitcher");
    await localeToggle.click();
    if (await page.locator("html").getAttribute("lang") !== "zh-CN") failures.push("Explicit locale toggle did not update html lang.");
    const preference = await page.evaluate(() => JSON.parse(localStorage.getItem("detective-town-locale-v1") || "null"));
    if (JSON.stringify(preference) !== '{"formatVersion":1,"locale":"zh-CN"}') failures.push("Locale preference stored fields beyond the versioned locale projection.");
    const unsafeText = await page.locator("body").innerText();
    if (/\b(?:culpritId|victimId|hiddenTruth|rawBody)\b|[A-Za-z]:[\\/]/i.test(unsafeText)) failures.push("Server main path exposed a forbidden authority token or absolute path.");
    await serverContext.close();

    step = "Corrupt and stale Continue recovery";
    const corruptContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await corruptContext.addInitScript(() => localStorage.setItem("detective-town-launch-v1", "broken-json"));
    const corruptPage = await corruptContext.newPage();
    await corruptPage.goto(`${baseUrl}/?runtime=server&lang=en-US`, { waitUntil: "networkidle" });
    const corruptFrontDoor = corruptPage.getByTestId("campaign-front-door");
    await corruptFrontDoor.waitFor({ state: "visible", timeout: 15_000 });
    if (!/invalid|clean Campaign|current map/i.test(await corruptFrontDoor.innerText())) failures.push("Corrupt Continue pointer did not expose a safe recovery path.");
    if (await corruptPage.evaluate(() => localStorage.getItem("detective-town-launch-v1")) !== null) failures.push("Corrupt Continue pointer was not cleared.");
    await corruptContext.close();

    const staleContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await staleContext.addInitScript(() => localStorage.setItem("detective-town-launch-v1", JSON.stringify({ formatVersion: 1, worldId: "world-does-not-exist", sessionId: "" })));
    const stalePage = await staleContext.newPage();
    await stalePage.goto(`${baseUrl}/?runtime=server&lang=en-US`, { waitUntil: "networkidle" });
    const staleFrontDoor = stalePage.getByTestId("campaign-front-door");
    await staleFrontDoor.waitFor({ state: "visible", timeout: 15_000 });
    await staleFrontDoor.getByTestId("campaign-front-door-continue").click();
    await stalePage.waitForFunction(() => localStorage.getItem("detective-town-launch-v1") === null, undefined, { timeout: 10_000 });
    if (await staleFrontDoor.getByTestId("campaign-front-door-continue").count()) failures.push("Stale Continue remained actionable after a 404 restore.");
    if (!/retry|clean Campaign/i.test(await staleFrontDoor.innerText())) failures.push("Stale Continue did not expose Retry or clean Campaign recovery.");
    await staleContext.close();
  } finally {
    await browser.close();
  }
} catch (error) {
  failures.push(`${step}: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await serverHarness?.cleanup();
}

const result = { ok: failures.length === 0, observations, failures };
console.log(jsonMode ? JSON.stringify(result) : result.ok ? "Bilingual accessibility browser QA passed." : failures.join("\n"));
if (!result.ok) process.exitCode = 1;
