import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { startReleaseCandidateServer } from "./lib/release-candidate-server.mjs";

const jsonMode = process.argv.includes("--json");
const failures = [];
const observations = [];
let server;
let browser;

function launchOptions() {
  const headlessShell = path.join(process.env.LOCALAPPDATA || "", "ms-playwright", "chromium_headless_shell-1223", "chrome-headless-shell-win64", "chrome-headless-shell.exe");
  if (fs.existsSync(headlessShell)) return { headless: true, executablePath: headlessShell, args: ["--no-sandbox"] };
  const executablePath = chromium.executablePath();
  return fs.existsSync(executablePath) ? { headless: true, executablePath, args: ["--no-sandbox"] } : { headless: true };
}

async function measure(page, label) {
  const result = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    worldConsole: Boolean(document.querySelector("[data-testid='world-console']")),
    hiddenTruth: /culpritId|victimId|hiddenTruth|rawBody|sourceMap|\bnpc-\d+\b|\bagent-[a-z0-9-]+\b|\bevent-[a-z0-9-]+\b/i.test(document.body.innerText)
  }));
  observations.push({ label, ...result });
  if (result.overflow > 1) failures.push(`${label}: horizontal overflow ${result.overflow}px`);
  if (result.hiddenTruth) failures.push(`${label}: world console exposed a truth/source field`);
  return result;
}

try {
  server = await startReleaseCandidateServer({ prefix: "rc-world-console-browser", env: { AI_PROVIDER: "mock", DEEPSEEK_API_KEY: "", SILICONFLOW_API_KEY: "" } });
  browser = await chromium.launch(launchOptions());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const requests = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/")) requests.push(pathname);
  });
  await page.goto(`${server.baseUrl}/?runtime=server&lang=zh-CN`, { waitUntil: "networkidle" });
  const frontDoor = page.getByTestId("campaign-front-door");
  await frontDoor.waitFor({ state: "visible", timeout: 20_000 });
  const cards = frontDoor.getByTestId("campaign-front-door-card");
  if (await cards.count() < 1) failures.push("front door did not render campaign cards");
  await cards.first().click();
  await frontDoor.getByTestId("campaign-front-door-start").click();
  await page.getByTestId("world-console").waitFor({ state: "visible", timeout: 60_000 });
  if (!(await page.getByTestId("world-console-hud").isVisible())) failures.push("world console HUD missing");
  if (!(await page.getByTestId("world-console-map").isVisible())) failures.push("world console map missing");
  if (!(await page.getByTestId("world-console-timeline").isVisible())) failures.push("world console causal stream missing");
  if (!(await page.getByTestId("world-console-settlement").isVisible())) failures.push("world console settlement/replay summary missing");
  if (!(await page.getByTestId("world-console-case-queue").isVisible())) failures.push("world console case queue missing");
  await measure(page, "desktop-1440");
  await page.screenshot({ path: path.join(process.cwd(), "outputs", "world-console-qa-1440.png"), fullPage: true });

  const tickBefore = await page.getByTestId("world-console-hud").innerText();
  const worldTools = page.getByTestId("world-console-tools");
  if (!(await worldTools.locator("summary").isVisible())) failures.push("world console runtime tools summary missing");
  await worldTools.locator("summary").click();
  await page.getByRole("button", { name: "单步" }).click();
  let tickAfter = tickBefore;
  for (let attempt = 0; attempt < 10 && tickAfter === tickBefore; attempt += 1) {
    await page.waitForTimeout(300);
    tickAfter = await page.getByTestId("world-console-hud").innerText();
  }
  if (tickBefore === tickAfter) failures.push("single-step did not update World Console HUD");

  await page.setViewportSize({ width: 390, height: 844 });
  await measure(page, "mobile-390");
  await page.screenshot({ path: path.join(process.cwd(), "outputs", "world-console-qa-390.png"), fullPage: true });
  const worldCaseButton = page.getByRole("button", { name: /案件调查/ }).first();
  if (await worldCaseButton.isVisible().catch(() => false)) {
    await worldCaseButton.click();
    await page.getByTestId("command-deck-shell").waitFor({ state: "visible", timeout: 15_000 });
    observations.push({ label: "world-to-case", enteredCaseWorkspace: true });
  } else {
    failures.push("world console did not expose a case workspace entry");
  }
  for (const endpoint of ["/api/worlds/create", "/api/v1/command/town/runtime/start", "/api/v1/command/town/runtime/step", "/api/v1/command/town/case/extract"]) {
    if (endpoint === "/api/v1/command/town/case/extract") continue;
    if (!requests.includes(endpoint)) failures.push(`world console flow did not reuse ${endpoint}`);
  }
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
} finally {
  await browser?.close().catch(() => undefined);
  await server?.cleanup().catch(() => undefined);
}

const report = { ok: failures.length === 0, suite: "world-console-browser-qa", failures, observations };
if (jsonMode) console.log(JSON.stringify(report, null, 2));
else console.log(report);
if (failures.length) process.exit(1);
