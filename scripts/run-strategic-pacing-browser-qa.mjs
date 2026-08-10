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
    const available = typeof address === "object" && address ? address.port : 0;
    probe.close((error) => error ? reject(error) : resolve(available));
  });
});
const baseUrl = `http://${host}:${port}`;
const dbName = `v81-strategic-pacing-browser-${process.pid}.db`;
const dbPath = path.join(process.cwd(), "data", dbName);
const databaseUrl = `file:./data/${dbName}`;
const failures = [];
const observations = [];
let server;
let currentStep = "startup";

function check(condition, message) {
  if (!condition) failures.push(message);
}

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
    const remaining = ["", "-wal", "-shm", "-journal"].some((suffix) => fs.existsSync(`${dbPath}${suffix}`));
    if (!remaining) return;
    await new Promise((resolve) => setTimeout(resolve, 125));
  }
  cleanDatabase();
}

async function waitForServer() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/?runtime=static`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Strategic Pacing production server did not become ready.");
}

async function openPage(browser, width, runtime = "server") {
  const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 } });
  await context.addInitScript(() => window.localStorage.clear());
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  const apiRequests = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/")) apiRequests.push({ method: request.method(), pathname });
  });
  await page.goto(`${baseUrl}/?runtime=${runtime}${runtime === "static" ? "&study=1" : ""}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.getByTestId("strategic-pacing").waitFor({ state: "visible" });
  if (runtime === "server") {
    const frontDoor = page.getByTestId("campaign-front-door");
    if (await frontDoor.isVisible().catch(() => false)) await frontDoor.getByTestId("campaign-front-door-dismiss").click();
    await page.getByTestId("strategic-primary-action").waitFor({ state: "visible" });
  } else {
    await page.waitForFunction(() => (
      document.querySelector("[data-testid='strategic-decision-queue']")?.getAttribute("data-queue-state") === "readonly"
      && document.querySelector("[data-testid='strategic-action-bar']")?.getAttribute("data-advance-state") === "readonly"
    ));
  }
  return { context, page, apiRequests };
}

cleanDatabase();
try {
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", `npm.cmd run start -- -H ${host} -p ${port}`]
    : ["run", "start", "--", "-H", host, "-p", String(port)];
  server = spawn(command, args, {
    cwd: process.cwd(),
    detached: process.platform !== "win32",
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "ignore"
  });
  await waitForServer();
  const browser = await chromium.launch(launchOptions());
  try {
    currentStep = "390px progressive disclosure";
    {
      const { context, page } = await openPage(browser, 390);
      const initial = await page.evaluate(() => {
        const objective = document.querySelector("[data-testid='strategic-pacing']")?.getBoundingClientRect();
        const action = document.querySelector("[data-testid='strategic-action-bar']")?.getBoundingClientRect();
        const map = document.querySelector("[data-testid='command-deck-map-area']")?.getBoundingClientRect();
        const visibleResources = [...document.querySelectorAll("[data-testid='strategic-resource-ribbon'] summary")]
          .filter((node) => node.getBoundingClientRect().height > 0).length;
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          objectiveTop: objective?.top || 0,
          actionTop: action?.top || 0,
          mapTop: map?.top || 0,
          mapBottom: map?.bottom || 0,
          objectiveBeforeAction: Boolean(objective && action && objective.top < action.top),
          actionBeforeMap: Boolean(action && map && action.top < map.top),
          visibleResources,
          phase: document.querySelector("[data-testid='strategic-pacing']")?.getAttribute("data-pacing-phase"),
          primaryCount: document.querySelectorAll("[data-command-deck-primary='true']:not([disabled])").length,
          primaryHeight: document.querySelector("[data-testid='strategic-primary-action']")?.getBoundingClientRect().height || 0
        };
      });
      observations.push({ width: 390, ...initial });
      check(initial.overflow <= 1, `390px overflowed horizontally by ${initial.overflow}px.`);
      check(initial.objectiveBeforeAction && initial.actionBeforeMap && initial.mapTop < 650 && initial.mapBottom > 600, "390px order is not Current Objective -> Current Action -> Map.");
      check(initial.visibleResources === 0, `390px exposes ${initial.visibleResources} secondary resource summaries instead of the All Resources trigger only.`);
      check(initial.primaryCount === 1, "390px does not expose exactly one legal primary action.");
      check(initial.primaryHeight >= 44, "390px primary action is below 44px.");

      const resourceToggle = page.getByTestId("strategic-all-resources-toggle");
      await resourceToggle.click();
      check(await page.getByTestId("command-deck-shell").getAttribute("data-active-panel") === "resources", "All Resources did not become the exclusive mobile panel.");
      check(await page.getByTestId("strategic-resource-sheet").getAttribute("aria-hidden") === "false", "All Resources sheet did not open.");
      await page.keyboard.press("Escape");
      check(await page.getByTestId("command-deck-shell").getAttribute("data-active-panel") === "none", "Escape did not close All Resources.");
      check(await resourceToggle.evaluate((node) => document.activeElement === node), "Closing All Resources did not restore trigger focus.");

      const queueToggle = page.getByTestId("strategic-queue-toggle");
      await queueToggle.click();
      check(await page.getByTestId("command-deck-shell").getAttribute("data-active-panel") === "queue", "Decision Queue did not open as the exclusive mobile sheet.");
      await page.keyboard.press("j");
      await page.waitForFunction(() => document.activeElement?.hasAttribute("data-queue-index"));
      const queueFocusAfterJ = await page.evaluate(() => document.activeElement?.getAttribute("data-queue-index"));
      check(queueFocusAfterJ === "1" || queueFocusAfterJ === "0", "J did not move focus into the Decision Queue.");
      await page.keyboard.press("k");
      await page.waitForFunction(() => document.activeElement?.getAttribute("data-queue-index") === "0");
      check(await page.evaluate(() => document.activeElement?.getAttribute("data-queue-index")) === "0", "K did not move focus back through the Decision Queue.");

      await page.evaluate(() => {
        const input = document.createElement("input");
        input.setAttribute("data-testid", "pacing-shortcut-input");
        document.querySelector("[data-testid='command-deck-shell']")?.append(input);
        input.focus();
      });
      await page.keyboard.press("j");
      check(await page.evaluate(() => document.activeElement?.getAttribute("data-testid")) === "pacing-shortcut-input", "Global Queue shortcut fired while an input was focused.");
      check(await page.getByTestId("command-deck-shell").getAttribute("data-active-panel") === "queue", "Input-focused shortcut changed panel state.");
      await page.evaluate(() => document.querySelector("[data-testid='pacing-shortcut-input']")?.remove());
      await queueToggle.focus();
      await page.keyboard.press("Escape");
      check(await queueToggle.evaluate((node) => document.activeElement === node), "Closing Queue did not restore Queue trigger focus.");

      const contextToggle = page.getByTestId("command-deck-drawer-toggle");
      await contextToggle.click();
      check(await page.getByTestId("command-deck-shell").getAttribute("data-active-panel") === "context", "Context did not open as the exclusive mobile sheet.");
      check(await queueToggle.getAttribute("aria-expanded") === "false", "Queue and Context were fully expanded together.");
      const detailToggle = page.getByRole("button", { name: /Case files & detail/i });
      await detailToggle.click();
      check(await detailToggle.getAttribute("aria-expanded") === "true", "Inspector detail did not open on demand.");
      await page.keyboard.press("Escape");
      check(await detailToggle.getAttribute("aria-expanded") === "false", "First Escape did not close the topmost Inspector detail.");
      check(await detailToggle.evaluate((node) => document.activeElement === node), "Inspector detail Escape did not restore focus.");
      await page.keyboard.press("Escape");
      check(await contextToggle.evaluate((node) => document.activeElement === node), "Second Escape did not close Context and restore its trigger focus.");

      await page.getByTestId("command-deck-map-area").focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelector("[data-testid='strategic-action-bar']")?.getAttribute("data-action-lifecycle") !== "idle");
      check(["selected", "resolving", "succeeded", "failed-safe"].includes(await page.getByTestId("strategic-action-bar").getAttribute("data-action-lifecycle")), "Enter did not execute the current legal primary action through the lifecycle.");

      await page.emulateMedia({ reducedMotion: "reduce" });
      const motion = await page.evaluate(() => {
        const primary = document.querySelector("[data-testid='strategic-primary-action']");
        const drawer = document.querySelector("[data-testid='command-deck-context-rail']");
        return {
          primaryTransition: Number.parseFloat(primary ? getComputedStyle(primary).transitionDuration : "0") || 0,
          drawerTransition: Number.parseFloat(drawer ? getComputedStyle(drawer).transitionDuration : "0") || 0
        };
      });
      check(motion.primaryTransition <= 0.01 && motion.drawerTransition <= 0.01, "390px reduced-motion still exposes a non-trivial transition.");
      await context.close();
    }

    currentStep = "768px edge panels";
    {
      const { context, page } = await openPage(browser, 768);
      const geometry = await page.evaluate(() => {
        const map = document.querySelector("[data-testid='command-deck-map-area']")?.getBoundingClientRect();
        const encounter = document.querySelector("[data-testid='character-encounter']")?.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          mapWidth: map?.width || 0,
          encounterWidth: encounter?.width || 0,
          encounterRightGap: map && encounter ? Math.abs(map.right - encounter.right) : 0
        };
      });
      observations.push({ width: 768, ...geometry });
      check(geometry.overflow <= 1, `768px overflowed horizontally by ${geometry.overflow}px.`);
      check(!geometry.encounterWidth || geometry.encounterWidth / Math.max(geometry.mapWidth, 1) <= 0.351, "768px Character Encounter covers more than 35% of the map.");
      check(!geometry.encounterWidth || geometry.encounterRightGap <= 2, "768px Character Encounter is not attached to the map edge.");
      const encounter = page.getByTestId("character-encounter");
      if (await encounter.isVisible().catch(() => false)) {
        await page.getByRole("button", { name: "Close character encounter" }).click();
        await encounter.waitFor({ state: "hidden" });
      }
      const queueToggle = page.getByTestId("strategic-queue-toggle");
      const contextToggle = page.getByTestId("command-deck-drawer-toggle");
      await queueToggle.click();
      await page.keyboard.press("Escape");
      check(await queueToggle.evaluate((node) => document.activeElement === node), "768px Queue Escape did not restore Queue trigger focus.");
      await contextToggle.click();
      check(await page.getByTestId("command-deck-shell").getAttribute("data-active-panel") === "context", "768px Context did not replace the open Queue.");
      check(await queueToggle.getAttribute("aria-expanded") === "false", "768px Queue and Inspector remained fully expanded together.");
      await page.keyboard.press("Escape");
      check(await contextToggle.evaluate((node) => document.activeElement === node), "768px Escape did not restore Context trigger focus.");
      await context.close();
    }

    currentStep = "1440px map-first disclosure";
    {
      const { context, page } = await openPage(browser, 1440);
      const desktop = await page.evaluate(() => {
        const shell = document.querySelector("[data-testid='command-deck-shell']")?.getBoundingClientRect();
        const map = document.querySelector("[data-testid='command-deck-map-area']")?.getBoundingClientRect();
        const detail = document.querySelector("[data-inspector-open]");
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          mapShare: (map?.width || 0) / Math.max(shell?.width || 1, 1),
          inspectorOpen: detail?.getAttribute("data-inspector-open"),
          fullInspectorPresent: Boolean(document.querySelector("#command-deck-full-inspector")),
          queueGroups: [...document.querySelectorAll("[data-queue-group]")].map((node) => node.getAttribute("data-queue-group")),
          visibleResources: [...document.querySelectorAll("[data-testid='strategic-resource-ribbon'] summary")].filter((node) => node.getBoundingClientRect().height > 0).length
        };
      });
      observations.push({ width: 1440, ...desktop });
      check(desktop.overflow <= 1, `1440px overflowed horizontally by ${desktop.overflow}px.`);
      check(desktop.mapShare >= 0.55, `1440px map occupies only ${(desktop.mapShare * 100).toFixed(1)}% of the shell.`);
      check(desktop.inspectorOpen === "false" && !desktop.fullInspectorPresent, "Desktop Inspector did not default to essential-only disclosure.");
      check(desktop.queueGroups[0] === "now", "Desktop Decision Queue does not start with Now.");
      check(desktop.visibleResources === 8, "Desktop resource ribbon does not expose all eight summaries.");
      await context.close();
    }

    currentStep = "Static read-only boundary";
    {
      const { context, page, apiRequests } = await openPage(browser, 390, "static");
      const staticState = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - innerWidth,
        phase: document.querySelector("[data-testid='strategic-pacing']")?.getAttribute("data-pacing-phase"),
        forecast: Boolean(document.querySelector("[data-testid='strategic-safe-forecast']")),
        feedbackLayers: document.querySelector("[data-testid='command-deck-feedback']")?.children.length || 0,
        queueState: document.querySelector("[data-testid='strategic-decision-queue']")?.getAttribute("data-queue-state"),
        primaryCount: document.querySelectorAll("[data-command-deck-primary='true']:not([disabled])").length,
        storageLength: localStorage.length,
        studyRecorder: document.body.innerText.includes("Campaign Study Recorder")
      }));
      await page.getByTestId("strategic-all-resources-toggle").click();
      const storageAfterLocalDisclosure = await page.evaluate(() => localStorage.length);
      observations.push({ width: 390, runtime: "static", ...staticState, apiRequests: apiRequests.length, storageAfterLocalDisclosure });
      check(apiRequests.length === 0, `Static Pacing requested ${apiRequests.map((item) => item.pathname).join(", ")}.`);
      check(staticState.overflow <= 1, `Static 390px overflowed by ${staticState.overflow}px.`);
      check(Boolean(staticState.phase) && staticState.forecast && staticState.feedbackLayers === 3, "Static Pacing omitted its local phase, forecast, or three-layer feedback.");
      check(staticState.queueState === "readonly" && staticState.primaryCount === 0, "Static Pacing exposed a persistent decision or primary action.");
      check(staticState.storageLength === 0 && storageAfterLocalDisclosure === 0, "Static Pacing wrote localStorage.");
      check(!staticState.studyRecorder, "Static Pacing displayed the Server-only study recorder.");
      await context.close();
    }
  } finally {
    await browser.close();
  }
} catch (error) {
  failures.push(`${currentStep}: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  stopServer();
  await cleanDatabaseAfterStop();
}

const result = { ok: failures.length === 0, observations, failures };
console.log(jsonMode ? JSON.stringify(result) : result.ok ? "Strategic Pacing browser QA passed." : failures.join("\n"));
if (!result.ok) process.exitCode = 1;
