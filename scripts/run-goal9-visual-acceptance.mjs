import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { startReleaseCandidateServer } from "./lib/release-candidate-server.mjs";

const jsonMode = process.argv.includes("--json");
const outputArgument = process.argv.find((argument) => argument.startsWith("--output="))?.slice("--output=".length);
const outputDir = path.resolve(outputArgument || path.join(process.cwd(), "outputs", "detective-world-simulation-goal9-20260912"));
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
    ,objective: document.querySelector("[data-testid='noir-current-action'] h1")?.textContent?.trim() || ""
    ,objectiveAction: document.querySelector("[data-testid='command-deck-shell']")?.getAttribute("data-current-objective") || ""
    ,primaryVisible: Boolean(document.querySelector("[data-testid='strategic-primary-action']:not([disabled])"))
    ,encounterVisible: (() => { const node = document.querySelector("[data-testid='character-encounter']"); if (!(node instanceof HTMLElement)) return false; const rect = node.getBoundingClientRect(); const style = getComputedStyle(node); return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0; })()
    ,mapImageVisible: (() => { const image = document.querySelector("[data-testid='noir-map-stage'] img"); if (!(image instanceof HTMLImageElement)) return false; const rect = image.getBoundingClientRect(); return rect.width > 40 && rect.height > 40 && image.complete && image.naturalWidth > 0; })()
    ,stickyActionCount: Array.from(document.querySelectorAll("[data-testid='final-workspace-current-action']")).filter((node) => getComputedStyle(node).position === "sticky").length
    ,mapAreaRatio: (() => { const area = document.querySelector("[data-testid='command-deck-map-area']")?.getBoundingClientRect(); const viewport = window.innerWidth * window.innerHeight; return area && viewport ? Number(((area.width * area.height) / viewport).toFixed(3)) : 0; })()
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
    prefix: "goal9-visual-acceptance",
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
        await page.getByTestId("world-console").waitFor({ state: "visible", timeout: 60_000 });
        const worldFile = await capture(page, "world-console", size);
        const worldMetrics = await page.evaluate(() => ({
          overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
          mapVisible: Boolean(document.querySelector("[data-testid='world-console-map']")),
          hudVisible: Boolean(document.querySelector("[data-testid='world-console-hud']")),
          disclosureCount: document.querySelectorAll("[data-testid='world-console'] details").length,
          mapWidth: document.querySelector("[data-testid='world-console-map']")?.getBoundingClientRect().width || 0
        }));
        if (worldMetrics.overflow > 1) pageFailures.push(`world console overflow ${worldMetrics.overflow}px`);
        if (!worldMetrics.mapVisible || !worldMetrics.hudVisible) pageFailures.push("world console lacks map or HUD");
        if (worldMetrics.disclosureCount < 3) pageFailures.push("world records are not progressively disclosed");
        await page.getByRole("button", { name: "案件调查", exact: true }).waitFor({ state: "visible", timeout: 15_000 });
        await page.getByRole("button", { name: "案件调查", exact: true }).click();
        await page.getByTestId("command-deck-shell").waitFor({ state: "visible", timeout: 15_000 });
        const exploreFile = await capture(page, "explore", size);
        const exploreMetrics = await metrics(page);
        if (!exploreMetrics.objective || !exploreMetrics.primaryVisible) pageFailures.push("explore lacks a visible objective and primary action");
        if (exploreMetrics.objectiveAction === "join" && exploreMetrics.encounterVisible) pageFailures.push("pre-join encounter competes with the join action");
        if (!exploreMetrics.mapImageVisible) pageFailures.push("explore map artwork is not visibly loaded");
        if (exploreMetrics.mapAreaRatio < 0.32) pageFailures.push(`explore map is visually underweight (${exploreMetrics.mapAreaRatio})`);
        await page.getByTestId("noir-nav-deduction").click();
        await page.getByTestId("cinematic-deduction-board").waitFor({ state: "visible", timeout: 15_000 });
        const deductionFile = await capture(page, "deduction", size);
        const deductionMetrics = await metrics(page);
        if (deductionMetrics.stickyActionCount > 0 && size.width >= 1000) pageFailures.push("desktop deduction action remains sticky");
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
        if (worldMetrics.overflow > 1 || exploreMetrics.pageOverflowPx > 1 || deductionMetrics.pageOverflowPx > 1) pageFailures.push(`page overflow ${worldMetrics.overflow}/${exploreMetrics.pageOverflowPx}/${deductionMetrics.pageOverflowPx}px`);
        if (!deductionMetrics.desk || deductionMetrics.pathLabels.join("|") !== "现场证据|人物关系|推理链") pageFailures.push("investigation path landmark/copy missing");
        if (peopleFocus.testId !== "cinematic-focused-witness") pageFailures.push(`people focus landed on ${peopleFocus.testId || peopleFocus.tag}`);
        if (deductionFocus.tag !== "H3") pageFailures.push(`deduction focus landed on ${deductionFocus.testId || deductionFocus.tag}`);
        if (size.width === 1280 && lowSensory?.shell !== "true") pageFailures.push("low sensory did not persist");
      } catch (error) {
        pageFailures.push(error instanceof Error ? error.message : String(error));
      } finally {
        await page.close();
      }
      entries.push({ size, status: pageFailures.length ? "failed" : "automated-pass", screenshots: [`world-console-${size.width}x${size.height}.png`, `explore-${size.width}x${size.height}.png`, `deduction-${size.width}x${size.height}.png`], failures: pageFailures, consoleErrors, pageErrors });
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
const result = { schema: "detective-town.goal9-visual-acceptance.v1", generatedAt: new Date().toISOString(), status: failures.length ? "failed" : "automated-pass", viewports, entries, failures, warnings, humanGate: "pending", criteria: { fiveSecondObjective: "automated-signal-only", singlePrimaryAction: "automated-signal-only", worldFirst: "automated-signal-only", progressiveDisclosure: "automated-signal-only" } };
fs.writeFileSync(path.join(outputDir, "visual-acceptance.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(jsonMode ? JSON.stringify({ ok: result.status === "automated-pass", output: path.relative(process.cwd(), path.join(outputDir, "visual-acceptance.json")), entries: entries.length, failures }) : `Goal 8 visual acceptance: ${result.status}`);
if (failures.length) process.exitCode = 1;
