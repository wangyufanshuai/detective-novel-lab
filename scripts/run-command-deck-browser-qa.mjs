import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";

const jsonMode = process.argv.includes("--json");
const host = "127.0.0.1";
const port = 3413;
const baseUrl = `http://${host}:${port}`;
const widths = [390, 768, 1440];
const failures = [];
const observations = [];
let server;

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

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/?runtime=server`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Command Deck production server did not become ready.");
}

try {
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", `npm.cmd run start -- -H ${host} -p ${port}`]
    : ["run", "start", "--", "-H", host, "-p", String(port)];
  server = spawn(command, args, { cwd: process.cwd(), detached: process.platform !== "win32", env: process.env, stdio: "ignore" });
  await waitForServer();
  const browser = await chromium.launch(launchOptions());
  try {
    for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: width <= 390 ? 844 : 900 } });
      const contextKinds = [];
      await page.goto(`${baseUrl}/?runtime=server`, { waitUntil: "networkidle" });
      await page.getByTestId("command-deck-pulse").waitFor({ state: "visible", timeout: 15_000 });
      if (width <= 760) {
        const drawerToggle = page.getByTestId("command-deck-drawer-toggle");
        await drawerToggle.click();
        if (await drawerToggle.getAttribute("aria-expanded") !== "true") failures.push(`${width}px context drawer did not open.`);
        await drawerToggle.click();
        if (await drawerToggle.getAttribute("aria-expanded") !== "false") failures.push(`${width}px context drawer did not close.`);
        await page.waitForTimeout(220);
      }
      if (width === 1440) {
        await page.locator(".settingsDrawer summary").click();
        await page.getByRole("button", { name: /Reset \/ Create Town/ }).click();
        await page.locator("[data-testid='pixel-map'] .mapTile").first().waitFor({ state: "visible", timeout: 30_000 });
        const selectableLocation = page.locator("[data-testid='pixel-map'] .mapTile[aria-label]").first();
        if (await selectableLocation.count()) {
          await selectableLocation.click();
          await page.getByTestId("command-deck-context").waitFor({ state: "visible" });
          contextKinds.push(await page.getByTestId("command-deck-context").getAttribute("data-context-kind"));
          const actor = page.locator("[data-testid='pixel-map'] .actorPin").first();
          if (await actor.count()) {
            await actor.click();
            contextKinds.push(await page.getByTestId("command-deck-context").getAttribute("data-context-kind"));
            await page.locator(".inspectorTabs button").nth(3).click();
            await page.waitForFunction(() => document.querySelector("[data-testid='command-deck-context']")?.getAttribute("data-context-kind") === "institution");
            contextKinds.push("institution");
            await page.locator(".inspectorTabs button").nth(1).click();
            await selectableLocation.click();
          }
        }
      }
      const metrics = await page.evaluate(() => {
        const map = document.querySelector("[data-testid='command-deck-map-area']");
        const shell = document.querySelector("[data-testid='command-deck-shell']");
        return {
          viewport: window.innerWidth,
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          mapWidth: map?.getBoundingClientRect().width || 0,
          shellWidth: shell?.getBoundingClientRect().width || 0,
          agenda: Boolean(document.querySelector("[data-testid='command-deck-agenda']")),
          context: Boolean(document.querySelector("[data-testid='command-deck-context']"))
          ,mapIntel: document.querySelector("[data-testid='command-deck-map-intel']")?.textContent || ""
          ,drawerToggle: Boolean(document.querySelector("[data-testid='command-deck-drawer-toggle']"))
          ,contextActions: document.querySelectorAll("[data-testid='command-deck-context-action']").length
          ,primaryActions: document.querySelectorAll("[data-command-deck-primary='true']:not([disabled])").length
          ,rawLeak: /\b(?:npc|case|event|source|location|institution|resource)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(document.body.innerText)
          ,tileSample: document.querySelector(".pixelMap .mapTile") ? {
            className: document.querySelector(".pixelMap .mapTile")?.className || "",
            background: getComputedStyle(document.querySelector(".pixelMap .mapTile")).backgroundColor
          } : null
        };
      });
      metrics.contextKinds = contextKinds;
      observations.push(metrics);
      if (metrics.overflow > 1) failures.push(`${width}px document overflowed by ${metrics.overflow}px.`);
      if (!metrics.agenda || !metrics.context) failures.push(`${width}px missing agenda/context surface.`);
      if (width <= 760 && !metrics.drawerToggle) failures.push(`${width}px missing mobile context drawer toggle.`);
      if (width >= 1200 && metrics.contextActions < 1) failures.push(`${width}px context inspector did not expose a safe action.`);
      if (metrics.contextActions > 3) failures.push(`${width}px context inspector exposed more than three actions.`);
      if (metrics.primaryActions > 1) failures.push(`${width}px exposed more than one primary Command Deck action.`);
      if (metrics.rawLeak) failures.push(`${width}px command deck body contains a raw identifier-like token.`);
      if (width >= 1200 && metrics.mapWidth / Math.max(metrics.shellWidth, 1) < 0.55) failures.push(`${width}px map area is below the 55% target.`);
      if (width >= 1200 && !["INSTITUTION", "WORLD PRESSURE", "TOWN REACTION"].every((label) => metrics.mapIntel.includes(label))) failures.push(`${width}px map intel is missing institution, pressure, or social response.`);
      if (width >= 1200 && !["location", "actor", "institution"].every((kind) => metrics.contextKinds.includes(kind))) failures.push(`${width}px did not cover location, actor, and institution contexts.`);
      const screenshotPath = path.join(process.cwd(), "outputs", "command-deck-qa", `${width}.png`);
      fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.querySelector("[data-testid='command-deck-agenda-rail']")?.scrollTo(0, 0);
      });
      await page.screenshot({ path: screenshotPath, fullPage: false });
      await page.close();
    }

    const staticPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const apiRequests = [];
    staticPage.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith("/api/")) apiRequests.push(pathname);
    });
    await staticPage.goto(`${baseUrl}/?runtime=static&study=1`, { waitUntil: "networkidle" });
    const staticState = await staticPage.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      studyRecorder: document.body.innerText.includes("Campaign Study Recorder")
    }));
    if (apiRequests.length) failures.push(`Static Command Deck requested ${apiRequests.join(", ")}.`);
    if (staticState.overflow > 1) failures.push(`Static 390px overflowed by ${staticState.overflow}px.`);
    if (staticState.studyRecorder) failures.push("Static runtime displayed Study Recorder.");
    await staticPage.close();
  } finally {
    await browser.close();
  }
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
} finally {
  stopServer();
}

const result = { ok: failures.length === 0, widths, observations, failures };
console.log(jsonMode ? JSON.stringify(result) : result.ok ? "Command Deck browser QA passed." : failures.join("\n"));
if (!result.ok) process.exitCode = 1;
