import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";

const jsonMode = process.argv.includes("--json");
const host = "127.0.0.1";
const port = await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.unref();
  probe.once("error", reject);
  probe.listen(0, host, () => {
    const address = probe.address();
    const availablePort = typeof address === "object" && address ? address.port : 0;
    probe.close((error) => error ? reject(error) : resolve(availablePort));
  });
});
const baseUrl = `http://${host}:${port}`;
const widths = [390, 768, 1440];
const failures = [];
const observations = [];
const dbName = `v92-strategic-command-browser-${process.pid}.db`;
const dbPath = path.join(process.cwd(), "data", dbName);
const databaseUrl = `file:./data/${dbName}`;
let server;
let currentStep = "startup";

function launchOptions() {
  const expected = chromium.executablePath();
  return fs.existsSync(expected) ? { headless: true, executablePath: expected } : { headless: true };
}

function stopServer() {
  if (!server?.pid) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
  else {
    try { process.kill(-server.pid, "SIGTERM"); } catch { server.kill("SIGTERM"); }
  }
}

function cleanDatabase() {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    try { fs.rmSync(`${dbPath}${suffix}`, { force: true }); } catch {}
  }
}

async function cleanDatabaseAfterStop() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    cleanDatabase();
    if (!["", "-wal", "-shm", "-journal"].some((suffix) => fs.existsSync(`${dbPath}${suffix}`))) return;
    await new Promise((resolve) => setTimeout(resolve, 125));
  }
  cleanDatabase();
}

async function waitForServer() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/?runtime=server`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Strategic Command production server did not become ready.");
}

cleanDatabase();
try {
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", `npm.cmd run start -- -H ${host} -p ${port}`]
    : ["run", "start", "--", "-H", host, "-p", String(port)];
  server = spawn(command, args, { cwd: process.cwd(), detached: process.platform !== "win32", env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "ignore" });
  await waitForServer();
  const browser = await chromium.launch(launchOptions());
  try {
    for (const width of widths) {
      currentStep = `${width}px server`;
      const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 } });
      page.setDefaultTimeout(20_000);
      await page.goto(`${baseUrl}/?runtime=server`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      const frontDoor = page.getByTestId("campaign-front-door");
      await frontDoor.waitFor({ state: "visible", timeout: 15_000 });
      await frontDoor.getByTestId("campaign-front-door-dismiss").click();
      await page.getByTestId("strategic-action-bar").waitFor({ state: "visible", timeout: 15_000 });

      const resourceItems = page.getByTestId("strategic-resource-ribbon").locator("details");
      if (await resourceItems.count() !== 8) failures.push(`${width}px resource ribbon did not expose exactly eight strategic summaries.`);
      if (width > 520) {
        const firstResource = resourceItems.first();
        await firstResource.locator("summary").click();
        if (!await firstResource.evaluate((node) => node.hasAttribute("open"))) failures.push(`${width}px resource explanation did not open from its summary control.`);
        await firstResource.locator("summary").click();
      }

      const metrics = await page.evaluate(() => {
        const shell = document.querySelector("[data-testid='command-deck-shell']");
        const objective = document.querySelector("[data-testid='strategic-pacing']")?.getBoundingClientRect();
        const map = document.querySelector("[data-testid='command-deck-map-area']");
        const primary = document.querySelectorAll("[data-command-deck-primary='true']:not([disabled])");
        const secondary = document.querySelectorAll("[data-testid='strategic-secondary-action']:not([disabled])");
        const queue = document.querySelector("[data-testid='strategic-decision-queue']");
        const feedback = document.querySelector("[data-testid='command-deck-feedback']");
        const actionBar = document.querySelector("[data-testid='strategic-action-bar']");
        const latestResolution = document.querySelector("[data-testid='command-deck-feedback']");
        const mapRect = map?.getBoundingClientRect();
        const actionRect = actionBar?.getBoundingClientRect();
        const latestResolutionRect = latestResolution?.getBoundingClientRect();
        const primaryRect = primary[0]?.getBoundingClientRect();
        const resourceTargets = Array.from(document.querySelectorAll("[data-testid='strategic-resource-ribbon'] summary"))
          .map((node) => node.getBoundingClientRect())
          .filter((rect) => rect.width > 0 && rect.height > 0)
          .map((rect) => rect.height);
        const allResources = document.querySelector("[data-testid='strategic-all-resources-toggle']")?.getBoundingClientRect();
        const strategicText = [queue?.textContent, actionBar?.textContent, document.querySelector("[data-testid='strategic-resource-ribbon']")?.textContent].join(" ");
        return {
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          shellWidth: shell?.getBoundingClientRect().width || 0,
          mapWidth: mapRect?.width || 0,
          mapTop: mapRect?.top || 0,
          mapBottom: mapRect?.bottom || 0,
          objectiveBeforeAction: Boolean(objective && actionRect && objective.top < actionRect.top),
          actionBeforeLatest: Boolean(actionRect && latestResolutionRect && actionRect.top < latestResolutionRect.top),
          latestBeforeMap: Boolean(latestResolutionRect && mapRect && latestResolutionRect.top < mapRect.top),
          primaryCount: primary.length,
          secondaryCount: secondary.length,
          primaryHeight: primaryRect?.height || 0,
          minimumResourceHeight: resourceTargets.length ? Math.min(...resourceTargets) : 0,
          visibleResourceCount: resourceTargets.length,
          allResourcesHeight: allResources?.height || 0,
          queueState: queue?.getAttribute("data-queue-state") || "",
          decisionCount: queue?.querySelectorAll("[data-decision-kind]").length || 0,
          currentDecisionCount: queue?.querySelectorAll("[data-decision-primary='true']").length || 0,
          feedbackLayers: feedback?.querySelectorAll(":scope > span").length || 0,
          advanceState: actionBar?.getAttribute("data-advance-state") || "",
          rawLeak: /\b(?:npc|case|event|source|location|institution|resource|evidence|session)-[a-z0-9-]*\d[a-z0-9-]*\b|culpritId|victimId|hiddenTruth|rawBody|checkpoint|agentSnapshot/i.test(strategicText)
        };
      });
      observations.push({ width, ...metrics });
      if (metrics.overflow > 1) failures.push(`${width}px Strategic Command overflowed horizontally by ${metrics.overflow}px.`);
      if (metrics.primaryCount > 1) failures.push(`${width}px Strategic Command exposed more than one primary action.`);
      if (metrics.secondaryCount > 3) failures.push(`${width}px Strategic Command exposed more than three enabled secondary actions.`);
      if (metrics.primaryHeight < 44) failures.push(`${width}px primary action target is below 44px.`);
      if (metrics.visibleResourceCount && metrics.minimumResourceHeight < 44) failures.push(`${width}px resource ribbon target is below 44px.`);
      if (width <= 520 && metrics.visibleResourceCount !== 0) failures.push(`${width}px resource ribbon did not collapse secondary summaries behind All Resources.`);
      if (width > 520 && width < 1200 && metrics.visibleResourceCount !== 4) failures.push(`${width}px resource ribbon did not collapse to four core summaries.`);
      if (width >= 1200 && metrics.visibleResourceCount !== 8) failures.push(`${width}px resource ribbon did not expose all eight desktop summaries.`);
      if (width < 1200 && metrics.allResourcesHeight < 44) failures.push(`${width}px All Resources control is below 44px or hidden.`);
      if (metrics.queueState !== "active" || metrics.decisionCount < 1 || metrics.currentDecisionCount !== 1) failures.push(`${width}px deterministic decision queue is missing its single current decision.`);
      if (metrics.feedbackLayers !== 4) failures.push(`${width}px action feedback does not contain Result, World Change, Objective Progress, and Next Action layers.`);
      if (!/ready|blocked|unavailable/.test(metrics.advanceState)) failures.push(`${width}px Advance Town state is missing.`);
      if (metrics.rawLeak) failures.push(`${width}px strategic surfaces exposed a raw identifier or hidden authority token.`);
      if (width >= 1200 && metrics.mapWidth / Math.max(metrics.shellWidth, 1) < 0.55) failures.push(`${width}px map area is below the 55% desktop budget.`);
      if (width === 390 && (!metrics.objectiveBeforeAction || !metrics.actionBeforeLatest || !metrics.latestBeforeMap || metrics.mapTop >= 820 || metrics.mapBottom <= 760)) failures.push("390px hierarchy is not Current Objective -> Current Action -> Latest Resolution -> Map.");

      await page.emulateMedia({ reducedMotion: "reduce" });
      const motion = await page.getByTestId("strategic-primary-action").evaluate((node) => ({
        animation: Number.parseFloat(getComputedStyle(node).animationDuration) || 0,
        transition: Number.parseFloat(getComputedStyle(node).transitionDuration) || 0
      }));
      if (motion.animation > 0.01 || motion.transition > 0.01) failures.push(`${width}px primary action ignores reduced motion.`);

      const screenshotPath = path.join(process.cwd(), "outputs", "strategic-command-qa", `${width}.png`);
      fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: false });
      await page.close();
    }

    currentStep = "static boundary";
    const staticPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const apiRequests = [];
    staticPage.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith("/api/")) apiRequests.push(pathname);
    });
    staticPage.setDefaultTimeout(20_000);
    await staticPage.goto(`${baseUrl}/?runtime=static&study=1`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await staticPage.waitForFunction(() => (
      document.querySelector("[data-testid='strategic-decision-queue']")?.getAttribute("data-queue-state") === "readonly"
      && document.querySelector("[data-testid='strategic-action-bar']")?.getAttribute("data-advance-state") === "readonly"
    ));
    const staticState = await staticPage.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      queueState: document.querySelector("[data-testid='strategic-decision-queue']")?.getAttribute("data-queue-state") || "",
      decisions: document.querySelectorAll("[data-testid='strategic-decision-queue'] [data-decision-kind]").length,
      primary: document.querySelectorAll("[data-command-deck-primary='true']:not([disabled])").length,
      advanceState: document.querySelector("[data-testid='strategic-action-bar']")?.getAttribute("data-advance-state") || "",
      studyRecorder: document.body.innerText.includes("Campaign Study Recorder")
    }));
    observations.push({ width: 390, runtime: "static", ...staticState });
    if (apiRequests.length) failures.push(`Static Strategic Command requested ${apiRequests.join(", ")}.`);
    if (staticState.overflow > 1) failures.push(`Static 390px Strategic Command overflowed by ${staticState.overflow}px.`);
    if (staticState.queueState !== "readonly" || staticState.decisions !== 0 || staticState.primary !== 0 || staticState.advanceState !== "readonly") failures.push(`Static Strategic Command exposed persistent decisions or controls: ${JSON.stringify(staticState)}.`);
    if (staticState.studyRecorder) failures.push("Static Strategic Command displayed Study Recorder.");
    await staticPage.close();
  } finally {
    await browser.close();
  }
} catch (error) {
  failures.push(`${currentStep}: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  stopServer();
  await cleanDatabaseAfterStop();
}

const result = { ok: failures.length === 0, widths, observations, failures };
console.log(jsonMode ? JSON.stringify(result) : result.ok ? "Strategic Command browser QA passed." : failures.join("\n"));
if (!result.ok) process.exitCode = 1;
