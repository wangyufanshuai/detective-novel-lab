import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { startReleaseCandidateServer } from "./lib/release-candidate-server.mjs";

const jsonMode = process.argv.includes("--json");
const outputArgument = process.argv.find((argument) => argument.startsWith("--output="))?.slice("--output=".length);
const outputDir = path.resolve(outputArgument || path.join(process.cwd(), "outputs", "detective-world-simulation-goal7-20260911"));
const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 }
];
const failures = [];
const entries = [];
let serverHarness;

function metrics(page) {
  return page.evaluate(() => ({
    viewport: [window.innerWidth, window.innerHeight],
    pageOverflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    scrollHeight: document.documentElement.scrollHeight,
    playerView: document.querySelector("[data-testid='command-deck-shell']")?.getAttribute("data-player-view") || "",
    desk: Boolean(document.querySelector("[data-testid='cinematic-deduction-board']")),
    pathStep: document.querySelector("[data-testid='cinematic-deduction-board']")?.getAttribute("data-path-step") || "",
    pathLabels: Array.from(document.querySelectorAll("[data-testid='investigation-path-stepper'] strong")).map((node) => node.textContent || ""),
    lowSensory: document.querySelector("[data-testid='command-deck-shell']")?.getAttribute("data-low-sensory") || ""
  }));
}

async function capture(page, name, size) {
  const file = path.join(outputDir, `${name}-${size.width}x${size.height}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

try {
  fs.mkdirSync(outputDir, { recursive: true });
  serverHarness = await startReleaseCandidateServer({
    prefix: "goal7-visual-acceptance",
    env: { AI_PROVIDER: "mock", DEEPSEEK_API_KEY: "", SILICONFLOW_API_KEY: "" }
  });
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    for (const size of viewports) {
      const pageFailures = [];
      const page = await browser.newPage({ viewport: size, colorScheme: "dark", reducedMotion: "reduce" });
      const consoleErrors = [];
      const pageErrors = [];
      page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text().slice(0, 200)); });
      page.on("pageerror", (error) => pageErrors.push(error.message.slice(0, 200)));
      try {
        await page.goto(`${serverHarness.baseUrl}/?runtime=server&lang=zh-CN`, { waitUntil: "networkidle" });
        await page.getByTestId("campaign-front-door-start").click();
        await page.getByRole("button", { name: "案件调查", exact: true }).waitFor({ state: "visible", timeout: 15_000 });
        await page.getByRole("button", { name: "案件调查", exact: true }).click();
        await page.getByTestId("command-deck-shell").waitFor({ state: "visible", timeout: 15_000 });
        const exploreFile = await capture(page, "explore", size);
        const exploreMetrics = await metrics(page);
        await page.getByTestId("noir-nav-deduction").click();
        await page.getByTestId("cinematic-deduction-board").waitFor({ state: "visible", timeout: 15_000 });
        const deductionFile = await capture(page, "deduction", size);
        const deductionMetrics = await metrics(page);
        await page.getByTestId("investigation-path-people").click();
        await page.waitForTimeout(100);
        const peopleFocus = await page.evaluate(() => ({ testId: document.activeElement?.getAttribute("data-testid") || "", tag: document.activeElement?.tagName || "" }));
        await page.getByTestId("investigation-path-deduction").click();
        await page.waitForTimeout(100);
        const deductionFocus = await page.evaluate(() => ({ testId: document.activeElement?.getAttribute("data-testid") || "", tag: document.activeElement?.tagName || "" }));
        let lowSensory = null;
        if (size.width === 1280) {
          await page.getByTestId("noir-nav-settings").click();
          const settingsButtons = page.locator("[data-testid='noir-settings'] button");
          await settingsButtons.last().click();
          await page.waitForTimeout(100);
          lowSensory = await page.evaluate(() => ({
            shell: document.querySelector("[data-testid='command-deck-shell']")?.getAttribute("data-low-sensory") || "",
            pressed: document.querySelector("[data-testid='noir-settings'] button:last-of-type")?.getAttribute("aria-pressed") || ""
          }));
          await page.getByTestId("noir-nav-deduction").click();
          await page.getByTestId("cinematic-deduction-board").waitFor({ state: "visible", timeout: 5_000 });
          lowSensory.file = await capture(page, "deduction-low-sensory", size);
        }
        if (exploreMetrics.pageOverflowPx > 1 || deductionMetrics.pageOverflowPx > 1) pageFailures.push(`page overflow ${exploreMetrics.pageOverflowPx}/${deductionMetrics.pageOverflowPx}px`);
        if (!deductionMetrics.desk || deductionMetrics.pathLabels.join("|") !== "现场证据|人物关系|推理链") pageFailures.push("investigation path landmark/copy missing");
        if (peopleFocus.testId !== "cinematic-focused-witness") pageFailures.push(`people focus landed on ${peopleFocus.testId || peopleFocus.tag}`);
        if (deductionFocus.tag !== "H3") pageFailures.push(`deduction focus landed on ${deductionFocus.testId || deductionFocus.tag}`);
        if (size.width === 1280 && lowSensory?.shell !== "true") pageFailures.push("low sensory did not persist");
      } catch (error) {
        pageFailures.push(error instanceof Error ? error.message : String(error));
      } finally {
        await page.close();
      }
      entries.push({ size, status: pageFailures.length ? "failed" : "automated-pass", screenshots: [`explore-${size.width}x${size.height}.png`, `deduction-${size.width}x${size.height}.png`], failures: pageFailures, consoleErrors, pageErrors });
      failures.push(...pageFailures.map((failure) => `${size.width}x${size.height}: ${failure}`));
    }
  } finally {
    await browser.close();
  }
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
} finally {
  await serverHarness?.cleanup();
}

const warnings = entries.flatMap((entry) => [...entry.consoleErrors, ...entry.pageErrors].map((message) => `${entry.size.width}x${entry.size.height}: ${message}`));
const result = { schema: "detective-town.goal7-visual-acceptance.v1", generatedAt: new Date().toISOString(), status: failures.length ? "failed" : "automated-pass", viewports, entries, failures, warnings, humanGate: "pending" };
fs.writeFileSync(path.join(outputDir, "visual-acceptance.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(jsonMode ? JSON.stringify({ ok: result.status === "automated-pass", output: path.relative(process.cwd(), path.join(outputDir, "visual-acceptance.json")), entries: entries.length, failures }) : `Goal 7 visual acceptance: ${result.status}`);
if (failures.length) process.exitCode = 1;
