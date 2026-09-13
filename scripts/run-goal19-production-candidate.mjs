import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { startReleaseCandidateServer } from "./lib/release-candidate-server.mjs";

const outputDir = path.resolve(process.argv.find((item) => item.startsWith("--output="))?.slice(9) || path.join(process.cwd(), "outputs", "detective-world-simulation-goal19-20260912"));
const viewports = [{ width: 390, height: 844 }, { width: 1280, height: 720 }];
const failures = [];
const entries = [];
const adminToken = "goal19-production-candidate-admin-token";
let server;

function recordFailure(size, message) {
  failures.push(`${size.width}x${size.height}: ${message}`);
}

async function screenshot(page, name, size) {
  const file = path.join(outputDir, `${name}-${size.width}x${size.height}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return path.basename(file);
}

async function layoutMetrics(page) {
  return page.evaluate(() => ({
    viewport: [window.innerWidth, window.innerHeight],
    scrollWidth: document.documentElement.scrollWidth,
    overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    largeButtons: Array.from(document.querySelectorAll("button, a, input, [role='button']")).filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width >= 44 && rect.height >= 44;
    }).length,
    undersizedControls: Array.from(document.querySelectorAll("button, a, input, [role='button']")).filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0 && Math.min(rect.width, rect.height) < 44;
    }).map((element) => ({ testId: element.getAttribute("data-testid") || "", text: (element.textContent || "").trim().slice(0, 80), width: Math.round(element.getBoundingClientRect().width), height: Math.round(element.getBoundingClientRect().height) }))
  }));
}

async function openPlayer(page, size) {
  console.log(`[goal19] ${size.width}x${size.height} player boot`);
  await page.goto(`${server.baseUrl}/?runtime=server&lang=zh-CN`, { waitUntil: "networkidle" });
  await page.getByTestId("campaign-front-door-start").click();
  await page.getByTestId("world-console").waitFor({ state: "visible", timeout: 60_000 });
  console.log(`[goal19] ${size.width}x${size.height} world console ready`);
  const world = await layoutMetrics(page);
  if (world.overflow > 1) recordFailure(size, `世界运行台横向溢出 ${world.overflow}px`);
  if (!(await page.getByTestId("world-console-map").isVisible()) || !(await page.getByTestId("world-console-hud").isVisible())) recordFailure(size, "世界运行台缺少地图或 HUD");
  await screenshot(page, "goal19-world-console", size);

  await page.getByRole("button", { name: "案件调查", exact: true }).click();
  await page.getByTestId("command-deck-shell").waitFor({ state: "visible", timeout: 30_000 });
  console.log(`[goal19] ${size.width}x${size.height} player shell ready`);
  const player = await layoutMetrics(page);
  const objective = await page.getByTestId("noir-current-action").locator("h1").innerText();
  if (player.overflow > 1) recordFailure(size, `玩家调查横向溢出 ${player.overflow}px`);
  if (!objective.trim()) recordFailure(size, "玩家首屏没有调查目标");
  if (!(await page.getByTestId("strategic-primary-action").isVisible())) recordFailure(size, "玩家首屏没有主行动");
  if (player.undersizedControls.length) recordFailure(size, `玩家存在小于 44px 触点: ${JSON.stringify(player.undersizedControls)}`);
  await screenshot(page, "goal19-explore", size);

  await page.getByTestId("noir-nav-deduction").click();
  await page.getByTestId("noir-deduction-workspace").waitFor({ state: "visible", timeout: 15_000 });
  const deduction = await layoutMetrics(page);
  if (deduction.overflow > 1) recordFailure(size, `推理工作区横向溢出 ${deduction.overflow}px`);
  await screenshot(page, "goal19-deduction", size);

  if (size.width === 1280) {
    await page.getByTestId("noir-nav-settings").click();
    const settings = page.getByTestId("noir-settings");
    await settings.waitFor({ state: "visible" });
    const toggles = settings.locator("button");
    await toggles.last().click();
    await page.getByTestId("noir-nav-explore").click();
    const sensory = await page.getByTestId("command-deck-shell").getAttribute("data-low-sensory");
    if (sensory !== "true") recordFailure(size, "低感官模式未保持到探索视图");
  }
}

async function openAdmin(page, size) {
  console.log(`[goal19] ${size.width}x${size.height} admin boot`);
  await page.goto(`${server.baseUrl}/admin/operations`, { waitUntil: "networkidle" });
  await page.getByTestId("admin-operations-page").waitFor({ state: "visible" });
  if (await page.getByText("已连接", { exact: true }).count()) recordFailure(size, "admin 页面在连接前意外读取数据");
  await page.getByLabel("Admin token（可选）").fill(adminToken);
  await page.getByRole("button", { name: "连接观察", exact: true }).click();
  await page.getByText("已连接", { exact: true }).waitFor({ state: "visible", timeout: 15_000 });
  console.log(`[goal19] ${size.width}x${size.height} admin connected`);
  if (!(await page.getByText("最近审计记录", { exact: true }).isVisible())) recordFailure(size, "admin 页面没有审计面板");
  const metrics = await layoutMetrics(page);
  if (metrics.overflow > 1) recordFailure(size, `admin 页面横向溢出 ${metrics.overflow}px`);
  await screenshot(page, "goal19-admin-operations", size);
  await page.getByRole("button", { name: "断开", exact: true }).click();
  const reconnectButton = page.getByRole("button", { name: "连接观察", exact: true });
  const returnedFocus = await reconnectButton.evaluate((element) => document.activeElement === element);
  if (!returnedFocus) recordFailure(size, "admin 断开后焦点未回到连接按钮");
  if ((await page.getByLabel("Admin token（可选）").inputValue()) !== "") recordFailure(size, "admin 断开后 token 未清除");
}

try {
  fs.mkdirSync(outputDir, { recursive: true });
  server = await startReleaseCandidateServer({ prefix: "goal19-production-candidate", env: { AI_PROVIDER: "mock", DEEPSEEK_API_KEY: "", SILICONFLOW_API_KEY: "", RUNTIME_ADMIN_TOKENS: adminToken, RUNTIME_ADMIN_SESSION_TOKEN: "" } });
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    for (const size of viewports) {
      const page = await browser.newPage({ viewport: size, colorScheme: "dark", reducedMotion: "reduce" });
      const consoleErrors = [];
      const pageErrors = [];
      page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text().slice(0, 240)); });
      page.on("pageerror", (error) => pageErrors.push(error.message.slice(0, 240)));
      try {
        await openPlayer(page, size);
        await openAdmin(page, size);
      } catch (error) {
        recordFailure(size, error instanceof Error ? error.message : String(error));
      } finally {
        entries.push({ size, status: consoleErrors.length || pageErrors.length ? "failed" : "automated-pass", consoleErrors, pageErrors });
        if (consoleErrors.length) recordFailure(size, `console errors: ${consoleErrors.join(" | ")}`);
        if (pageErrors.length) recordFailure(size, `page errors: ${pageErrors.join(" | ")}`);
        await page.close();
      }
    }

    const unauthorizedPage = await browser.newPage({ viewport: viewports[0], colorScheme: "dark", reducedMotion: "reduce" });
    try {
      await unauthorizedPage.goto(`${server.baseUrl}/admin/operations`, { waitUntil: "networkidle" });
      await unauthorizedPage.getByRole("button", { name: "连接观察", exact: true }).click();
      const unauthorizedAlert = unauthorizedPage.getByTestId("admin-operations-error");
      await unauthorizedAlert.waitFor({ state: "visible", timeout: 15_000 });
      const alertText = await unauthorizedAlert.innerText();
      assert.match(alertText, /401|authenticated|凭据|鉴权/i, "admin page should surface an unauthorized response");
    } finally {
      await unauthorizedPage.close();
    }
  } finally {
    await browser.close();
  }
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
} finally {
  await server?.cleanup();
}

const result = {
  schema: "detective-town.goal19-production-candidate.v1",
  generatedAt: new Date().toISOString(),
  status: failures.length ? "failed" : "automated-pass",
  viewports,
  entries,
  failures,
  humanGate: "pending",
  scope: ["world-console", "player-explore", "player-deduction", "low-sensory", "admin-operations", "admin-unauthorized"]
};
fs.writeFileSync(path.join(outputDir, "goal19-browser-acceptance.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: result.status === "automated-pass", output: path.relative(process.cwd(), path.join(outputDir, "goal19-browser-acceptance.json")), failures }, null, 2));
if (failures.length) process.exitCode = 1;
