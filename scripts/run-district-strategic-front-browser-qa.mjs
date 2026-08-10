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
    probe.close((error) => error ? reject(error) : resolve(typeof address === "object" && address ? address.port : 0));
  });
});
const baseUrl = `http://${host}:${port}`;
const dbName = `v82-district-front-browser-${process.pid}.db`;
const dbPath = path.join(process.cwd(), "data", dbName);
const failures = [];
const observations = [];
let server;
let currentStep = "startup";

function check(condition, message) {
  if (!condition) failures.push(message);
}

function launchOptions() {
  const executablePath = chromium.executablePath();
  return fs.existsSync(executablePath) ? { headless: true, executablePath } : { headless: true };
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
      const response = await fetch(`${baseUrl}/?runtime=static`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("District Strategic Front production server did not become ready.");
}

async function openPage(browser, width, runtime = "server") {
  const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 } });
  await context.addInitScript(() => localStorage.clear());
  const page = await context.newPage();
  const requests = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/")) requests.push({ method: request.method(), pathname });
  });
  await page.goto(`${baseUrl}/?runtime=${runtime}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.getByTestId("district-fronts-toggle").waitFor({ state: "visible", timeout: 30_000 });
  if (runtime === "static") {
    await page.waitForFunction(() => document.querySelector("[data-testid='district-strategic-fronts']")?.getAttribute("data-front-status") === "readonly", undefined, { timeout: 10_000 });
  }
  if (runtime === "server") {
    const frontDoor = page.getByTestId("campaign-front-door");
    await frontDoor.waitFor({ state: "visible", timeout: 10_000 }).catch(() => undefined);
    if (await frontDoor.isVisible().catch(() => false)) await frontDoor.getByTestId("campaign-front-door-dismiss").click();
  }
  const onboarding = page.getByTestId("onboarding-overlay");
  if (runtime === "static") await onboarding.waitFor({ state: "visible", timeout: 4_000 }).catch(() => undefined);
  if (await onboarding.isVisible().catch(() => false)) await onboarding.locator(".closeButton").click();
  const theatre = page.getByTestId("campaign-transition-theatre");
  if (await theatre.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await theatre.waitFor({ state: "detached", timeout: 10_000 }).catch(() => undefined);
  }
  await page.waitForTimeout(250);
  const encounter = page.getByTestId("character-encounter");
  if (await encounter.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Close character encounter" }).click();
    await encounter.waitFor({ state: "detached", timeout: 10_000 }).catch(() => undefined);
  }
  const shell = page.getByTestId("command-deck-shell");
  if (await shell.getAttribute("data-active-panel") === "context") {
    await page.getByTestId("command-deck-drawer-toggle").click();
  }
  try {
    await page.waitForFunction(() => document.querySelector("[data-testid='command-deck-shell']")?.getAttribute("data-suspend-fronts") !== "true", undefined, { timeout: 10_000 });
  } catch (error) {
    const state = await page.evaluate(() => {
      const shell = document.querySelector("[data-testid='command-deck-shell']");
      const visible = (selector) => {
        const node = document.querySelector(selector);
        return Boolean(node && getComputedStyle(node).display !== "none" && node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0);
      };
      return {
        dominant: shell?.getAttribute("data-dominant-overlay"),
        activePanel: shell?.getAttribute("data-active-panel"),
        suspendFronts: shell?.getAttribute("data-suspend-fronts"),
        encounter: visible("[data-testid='character-encounter']"),
        transition: visible("[data-testid='campaign-transition-theatre']"),
        onboarding: visible("[data-testid='onboarding-overlay']"),
        frontDoor: visible("[data-testid='campaign-front-door']")
      };
    });
    throw new Error(`${error instanceof Error ? error.message : String(error)} / overlay state ${JSON.stringify(state)}`);
  }
  return { context, page, requests };
}

async function runtimeTick(worldId) {
  const response = await fetch(`${baseUrl}/api/v1/query/town/runtime?worldId=${encodeURIComponent(worldId)}`);
  const json = await response.json();
  return json?.data?.runtime?.tick ?? json?.runtime?.tick ?? null;
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
    env: { ...process.env, DATABASE_URL: `file:./data/${dbName}` },
    stdio: "ignore"
  });
  await waitForServer();
  const browser = await chromium.launch(launchOptions());
  try {
    currentStep = "390px Server front selection";
    {
      const { context, page, requests } = await openPage(browser, 390);
      const toggle = page.getByTestId("district-fronts-toggle");
      check(await toggle.getAttribute("aria-expanded") === "false", "390px Strategic Fronts did not default closed.");
      const localRequestCount = requests.length;
      await toggle.click();
      check(await page.getByTestId("command-deck-shell").getAttribute("data-active-panel") === "fronts", "390px Strategic Fronts did not become the exclusive panel.");
      const mobileEncounter = page.getByTestId("character-encounter");
      if (await mobileEncounter.count()) check(!(await mobileEncounter.isVisible()), "390px Character Encounter remained visible behind Strategic Fronts.");
      const mobilePanelGeometry = await page.evaluate(() => {
        const panel = document.querySelector("[data-testid='district-fronts-panel']")?.getBoundingClientRect();
        const action = document.querySelector("[data-testid='strategic-action-bar']")?.getBoundingClientRect();
        return {
          actionOverlap: panel && action ? Math.max(0, Math.min(panel.bottom, action.bottom) - Math.max(panel.top, action.top)) : 0
        };
      });
      check(mobilePanelGeometry.actionOverlap <= 1, `390px Strategic Front sheet overlaps Current Action by ${mobilePanelGeometry.actionOverlap}px.`);
      const options = page.getByTestId("district-front-option");
      const optionCount = await options.count();
      check(optionCount > 0 && optionCount <= 3, `390px exposed ${optionCount} fronts instead of one to three.`);
      check(await page.locator("[data-testid='district-front-option'][data-front-state='current']").count() === 1, "390px does not expose exactly one current front.");
      const institution = page.locator("[data-testid='district-front-option'][data-front-kind='institution']");
      if (await institution.count()) {
        const location = await institution.getAttribute("data-front-location");
        const lens = await institution.getAttribute("data-front-lens");
        await institution.click();
        check(await page.getByTestId("command-deck-shell").getAttribute("data-active-front") === "institution", "Selecting Institution Front did not update the active front.");
        check(await page.getByTestId("command-deck-shell").getAttribute("data-map-lens") === lens, "Selecting Institution Front did not reuse its existing map lens.");
        check(await page.getByTestId("district-front-detail").getAttribute("data-front-location") === location, "Selected front detail did not retain its public district label.");
        const selectedTileTitle = await page.locator("[data-testid='pixel-map'] .mapTile.selected").getAttribute("title");
        check(selectedTileTitle === location, "Selecting Institution Front did not focus its public map district.");
        await institution.focus();
        await page.keyboard.press("ArrowRight");
        check(await page.getByTestId("command-deck-shell").getAttribute("data-active-front") === "pressure", "ArrowRight did not move to the next bounded front.");
      }
      check(requests.length === localRequestCount, "Opening or selecting a front made an API request.");
      const panelText = await page.getByTestId("district-fronts-panel").innerText();
      check(!/\b(?:npc|case|event|source|location|institution|resource|evidence|session)-[a-z0-9-]*\d[a-z0-9-]*\b|culpritId|hiddenTruth|rawBody/i.test(panelText), "Strategic Front panel exposed an internal identifier or hidden field.");
      await page.keyboard.press("Escape");
      check(await page.getByTestId("command-deck-shell").getAttribute("data-active-panel") === "none", "Escape did not close Strategic Fronts.");
      check(await toggle.evaluate((node) => node === document.activeElement), "Closing Strategic Fronts did not restore trigger focus.");

      await toggle.click();
      const investigation = page.locator("[data-testid='district-front-option'][data-front-kind='investigation']");
      if (await investigation.count()) await investigation.click();
      const actionButton = page.getByTestId("district-front-action");
      const actionText = await actionButton.innerText();
      check(/join investigation/i.test(actionText), "Opening front action did not expose the existing Join command.");
      let joinedWorldId = "";
      let tickBefore = null;
      await page.route("**/api/players/join", async (route) => {
        joinedWorldId = route.request().postDataJSON()?.worldId || "";
        if (joinedWorldId) tickBefore = await runtimeTick(joinedWorldId);
        await route.continue();
      });
      await Promise.all([
        page.waitForResponse((response) => response.url().includes("/api/players/join") && response.request().method() === "POST" && response.ok(), { timeout: 30_000 }),
        actionButton.click()
      ]);
      await page.waitForFunction(() => document.querySelector("[data-testid='strategic-action-bar']")?.getAttribute("data-action-lifecycle") === "succeeded", undefined, { timeout: 30_000 });
      const tickAfter = joinedWorldId ? await runtimeTick(joinedWorldId) : null;
      check(tickBefore !== null && tickBefore === tickAfter, "Executing the existing Join action through a front advanced the town tick.");
      check(requests.some((request) => request.pathname === "/api/players/join"), "Front action did not reuse the existing Join endpoint.");
      check(!requests.some((request) => /district|front/i.test(request.pathname)), "Strategic Fronts introduced a new API path.");
      const mobile = await page.evaluate(() => ({
        overflow: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) - innerWidth,
        triggerHeight: document.querySelector("[data-testid='district-fronts-toggle']")?.getBoundingClientRect().height || 0,
        mapVisible: (document.querySelector("[data-testid='command-deck-map-area']")?.getBoundingClientRect().top || 999) < 260
      }));
      observations.push({ width: 390, runtime: "server", optionCount, ...mobile, frontActionOverlap: mobilePanelGeometry.actionOverlap, tickBefore, tickAfter });
      check(mobile.overflow <= 1, `390px Strategic Fronts overflowed by ${mobile.overflow}px.`);
      check(mobile.triggerHeight >= 44 && mobile.mapVisible, "390px Strategic Front trigger or map-first view is outside its budget.");
      await context.close();
    }

    currentStep = "768px edge panel";
    {
      const { context, page } = await openPage(browser, 768);
      const toggle = page.getByTestId("district-fronts-toggle");
      await toggle.click();
      const geometry = await page.evaluate(() => {
        const panel = document.querySelector("[data-testid='district-fronts-panel']")?.getBoundingClientRect();
        const action = document.querySelector("[data-testid='strategic-action-bar']")?.getBoundingClientRect();
        return {
          width: panel?.width || 0,
          viewport: innerWidth,
          actionOverlap: panel && action ? Math.max(0, Math.min(panel.bottom, action.bottom) - Math.max(panel.top, action.top)) : 0,
          ownsRightEdge: panel ? Boolean(document.elementFromPoint(panel.right - 8, panel.top + 24)?.closest("[data-testid='district-fronts-panel']")) : false
        };
      });
      check(geometry.width / geometry.viewport <= 0.351, "768px Strategic Front panel exceeds 35% of the viewport.");
      check(geometry.actionOverlap <= 1, `768px Strategic Front panel overlaps Current Action by ${geometry.actionOverlap}px.`);
      check(geometry.ownsRightEdge, "768px Strategic Front panel is occluded by another edge surface.");
      const tabletEncounter = page.getByTestId("character-encounter");
      if (await tabletEncounter.count()) check(!(await tabletEncounter.isVisible()), "768px Character Encounter remained visible behind Strategic Fronts.");
      const queueToggle = page.getByTestId("strategic-queue-toggle");
      await queueToggle.click();
      check(await page.getByTestId("command-deck-shell").getAttribute("data-active-panel") === "queue", "768px Queue did not replace Strategic Fronts.");
      check(await toggle.getAttribute("aria-expanded") === "false", "768px Fronts and Queue remained expanded together.");
      observations.push({ width: 768, panelWidth: geometry.width, panelShare: geometry.width / geometry.viewport, actionOverlap: geometry.actionOverlap, ownsRightEdge: geometry.ownsRightEdge });
      await context.close();
    }

    currentStep = "1440px map-first front";
    {
      const { context, page } = await openPage(browser, 1440);
      await page.getByTestId("district-fronts-toggle").click();
      const desktop = await page.evaluate(() => {
        const shell = document.querySelector("[data-testid='command-deck-shell']")?.getBoundingClientRect();
        const map = document.querySelector("[data-testid='command-deck-map-area']")?.getBoundingClientRect();
        const panel = document.querySelector("[data-testid='district-fronts-panel']")?.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          mapShare: (map?.width || 0) / Math.max(shell?.width || 1, 1),
          panelWidth: panel?.width || 0
        };
      });
      observations.push({ width: 1440, ...desktop });
      check(desktop.overflow <= 1 && desktop.mapShare >= 0.55, "1440px Strategic Fronts broke the map-first layout.");
      check(desktop.panelWidth <= 430, "1440px Strategic Front panel exceeded its bounded width.");
      await context.close();
    }

    currentStep = "390px Static boundary";
    {
      const { context, page, requests } = await openPage(browser, 390, "static");
      const storageBefore = await page.evaluate(() => localStorage.length);
      await page.getByTestId("district-fronts-toggle").click();
      const staticState = await page.evaluate(() => ({
        status: document.querySelector("[data-testid='district-strategic-fronts']")?.getAttribute("data-front-status"),
        options: document.querySelectorAll("[data-testid='district-front-option']").length,
        actionCount: document.querySelectorAll("[data-testid='district-front-action']").length,
        overflow: document.documentElement.scrollWidth - innerWidth
      }));
      const pressure = page.locator("[data-testid='district-front-option'][data-front-kind='pressure']");
      if (await pressure.count()) await pressure.click();
      const storageAfter = await page.evaluate(() => localStorage.length);
      observations.push({ width: 390, runtime: "static", ...staticState, requests: requests.length, storageBefore, storageAfter });
      check(staticState.status === "readonly" && staticState.actionCount === 0, "Static Strategic Fronts exposed a persistent action.");
      check(staticState.options > 0 && staticState.options <= 3, "Static Strategic Front count is outside the bounded range.");
      check(requests.length === 0 && storageBefore === 0 && storageAfter === 0, "Static Strategic Fronts requested /api/* or wrote localStorage.");
      check(staticState.overflow <= 1, "Static 390px Strategic Fronts overflowed horizontally.");
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
console.log(jsonMode ? JSON.stringify(result) : result.ok ? "District Strategic Front browser QA passed." : failures.join("\n"));
if (!result.ok) process.exitCode = 1;
