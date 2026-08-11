import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { startReleaseCandidateServer } from "./lib/release-candidate-server.mjs";

const jsonMode = process.argv.includes("--json");
let baseUrl = "";
const failures = [];
const screenshotDir = path.join(process.cwd(), "outputs", "campaign-front-door-qa");
fs.mkdirSync(screenshotDir, { recursive: true });
const requests = [];
let serverHarness;
let currentStep = "startup";

function safeRequestPath(pathname) {
  return pathname.replace(/^\/api\/worlds\/[^/]+\//, "/api/worlds/:world/");
}

function launchOptions() {
  const expected = chromium.executablePath();
  return fs.existsSync(expected) ? { headless: true, executablePath: expected } : { headless: true };
}

try {
  serverHarness = await startReleaseCandidateServer({
    prefix: "rc-campaign-front-door",
    env: { AI_PROVIDER: "mock", DEEPSEEK_API_KEY: "", SILICONFLOW_API_KEY: "" }
  });
  baseUrl = serverHarness.baseUrl;
  const browser = await chromium.launch(launchOptions());
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    page.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith("/api/")) requests.push(safeRequestPath(pathname));
    });
    currentStep = "open server front door";
    await page.goto(`${baseUrl}/?runtime=server&lang=en-US`, { waitUntil: "networkidle" });
    const frontDoor = page.getByTestId("campaign-front-door");
    await frontDoor.waitFor({ state: "visible", timeout: 15_000 });
    const cards = frontDoor.getByTestId("campaign-front-door-card");
    if (await cards.count() !== 4) failures.push("Server Front Door did not show exactly four Campaign cards.");
    const initialText = await frontDoor.innerText();
    const normalizedInitialText = initialText.toLowerCase();
    for (const label of ["Town Reckoning", "Harbor Testimony", "Clinic Headlines", "Midnight Chorus", "Civic Procedure", "Merchant Leverage", "Public surface", "Evidence style", "World pressure", "Finale"]) {
      if (!normalizedInitialText.includes(label.toLowerCase())) failures.push(`Server Front Door is missing ${label}.`);
    }
    if (/\b(?:case|npc|event|source|location|institution|resource|evidence|session|world)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(initialText)) failures.push("Server Front Door exposed a raw identifier-shaped value.");
    if (await frontDoor.locator("[data-campaign-primary='true']:not([disabled])").count() !== 1) failures.push("Server Front Door does not have exactly one primary Start action.");

    currentStep = "select Harbor Testimony";
    await cards.nth(1).click();
    if (await cards.nth(1).getAttribute("aria-pressed") !== "true") failures.push("Harbor Testimony card did not become selected.");
    currentStep = "select Harbor Chain Protection route";
    const routeButtons = frontDoor.getByTestId("campaign-front-door-route");
    if (await routeButtons.count() !== 2) failures.push("Selected Campaign did not expose exactly two authored route choices.");
    else {
      await routeButtons.nth(1).click();
      if (await routeButtons.nth(1).getAttribute("aria-pressed") !== "true") failures.push("Harbor Chain Protection route did not become selected.");
    }
    await page.screenshot({ path: path.join(screenshotDir, "1440-counter-route.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    const compactServerOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (compactServerOverflow > 1) failures.push(`Server 390px route choice overflowed by ${compactServerOverflow}px.`);
    const compactRouteControls = await routeButtons.evaluateAll((items) => items.map((item) => ({ width: item.getBoundingClientRect().width, height: item.getBoundingClientRect().height })));
    if (compactRouteControls.some((item) => item.width > 390 || item.height < 44)) failures.push("Server 390px route controls did not keep a bounded 44px interaction target.");
    await page.screenshot({ path: path.join(screenshotDir, "390-counter-route.png"), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 960 });
    currentStep = "start Harbor Chain Protection";
    await frontDoor.getByTestId("campaign-front-door-start").click();
    try {
      await frontDoor.waitFor({ state: "hidden", timeout: 45_000 });
    } catch (error) {
      const status = await frontDoor.locator("[role='status']").innerText().catch(() => "status unavailable");
      throw new Error(`${error instanceof Error ? error.message : String(error)} / Front Door status: ${status}`);
    }
    await page.getByTestId("command-deck-pulse").waitFor({ state: "visible", timeout: 15_000 });
    const pulseAfterStart = await page.getByTestId("command-deck-pulse").innerText();
    if (!pulseAfterStart.includes("Harbor Testimony")) failures.push("Started Campaign did not bind Harbor Testimony in Town Pulse.");
    if (!pulseAfterStart.includes("The Empty Watch")) failures.push("Harbor Chain Protection did not extract its authored counter-route opening case.");
    currentStep = "join authored Harbor opening";
    const joinAction = page.getByTestId("command-deck-context-action").filter({ hasText: "Join investigation" });
    await joinAction.waitFor({ state: "visible", timeout: 15_000 });
    await joinAction.click();
    currentStep = "open authored Harbor case detail";
    const detailToggle = page.getByRole("button", { name: /Case files & detail/i });
    await detailToggle.waitFor({ state: "visible", timeout: 15_000 });
    if (await detailToggle.getAttribute("aria-expanded") !== "true") await detailToggle.click();
    const worldLeadPanel = page.getByTestId("world-lead-panel");
    await worldLeadPanel.waitFor({ state: "visible", timeout: 15_000 });
    const authoredLeadText = await worldLeadPanel.innerText();
    if (!/challenge|certified challenge/i.test(authoredLeadText)) failures.push("The Empty Watch did not drive its authored Challenge World Lead after Join.");
    if (/\b(?:case|npc|event|source|location|institution|resource|evidence|session|world)-[a-z0-9-]*\d[a-z0-9-]*\b|culpritId|victimId|hiddenTruth|rawBody/i.test(authoredLeadText)) failures.push("Authored World Lead UI exposed an internal binding or truth field.");
    for (const endpoint of ["/api/worlds/create", "/api/v1/command/town/world-pack/select", "/api/v1/command/town/runtime/start", "/api/v1/command/town/case/extract"]) {
      if (!requests.includes(endpoint)) failures.push(`Start Campaign did not reuse ${endpoint}.`);
    }

    currentStep = "reopen and continue";
    await page.getByTestId("open-campaign-front-door").click();
    await frontDoor.waitFor({ state: "visible", timeout: 10_000 });
    const continueButton = frontDoor.getByTestId("campaign-front-door-continue");
    if (!await continueButton.count()) failures.push("Continue Campaign was not available after a successful start.");
    else {
      await continueButton.click();
      await frontDoor.waitFor({ state: "hidden", timeout: 30_000 });
      const pulseAfterContinue = await page.getByTestId("command-deck-pulse").innerText();
      if (!pulseAfterContinue.includes("Harbor Testimony")) failures.push("Continue Campaign did not restore the existing bound Campaign.");
      const restoredRouteText = await page.getByTestId("campaign-session").innerText().catch(() => "");
      if (restoredRouteText && !restoredRouteText.includes("Chain Protection")) failures.push("Continue Campaign did not restore the bound authored route.");
    }
    const serverOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (serverOverflow > 1) failures.push(`Server Front Door overflowed by ${serverOverflow}px.`);
    await page.close();

    currentStep = "static preview";
    const staticPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const staticApiRequests = [];
    staticPage.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith("/api/")) staticApiRequests.push(pathname);
    });
    await staticPage.goto(`${baseUrl}/?runtime=static&lang=en-US`, { waitUntil: "networkidle" });
    const staticFrontDoor = staticPage.getByTestId("campaign-front-door");
    await staticFrontDoor.waitFor({ state: "visible", timeout: 15_000 });
    if (await staticFrontDoor.getByTestId("campaign-front-door-card").count() !== 4) failures.push("Static Front Door did not show four safe previews.");
    if (await staticFrontDoor.getByTestId("campaign-front-door-start").count()) failures.push("Static Front Door exposed Start Campaign.");
    if (await staticFrontDoor.getByTestId("campaign-front-door-continue").count()) failures.push("Static Front Door exposed Continue Campaign.");
    if (await staticFrontDoor.getByTestId("campaign-front-door-route").count()) failures.push("Static Front Door exposed persistent route controls.");
    const staticText = await staticFrontDoor.innerText();
    if (!["Civic Procedure", "Merchant Leverage", "Public Reckoning", "Backstage Compact"].every((label) => staticText.includes(label))) failures.push("Static Front Door did not explain the safe authored routes, including Midnight Chorus.");
    if (!staticText.toLowerCase().includes("server-only route choice / start / continue")) failures.push("Static Front Door is missing its Server-only route boundary.");
    await staticPage.screenshot({ path: path.join(screenshotDir, "390-static-routes.png"), fullPage: true });
    const staticOverflow = await staticPage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (staticOverflow > 1) failures.push(`Static 390px Front Door overflowed by ${staticOverflow}px.`);
    if (staticApiRequests.length) failures.push(`Static Front Door requested ${staticApiRequests.join(", ")}.`);
    await staticPage.close();
  } finally {
    await browser.close();
  }
} catch (error) {
  failures.push(`${currentStep}: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await serverHarness?.cleanup();
}

const result = { ok: failures.length === 0, requests: Array.from(new Set(requests)), failures };
console.log(jsonMode ? JSON.stringify(result) : result.ok ? "Campaign Front Door browser QA passed." : failures.join("\n"));
if (!result.ok) process.exitCode = 1;
