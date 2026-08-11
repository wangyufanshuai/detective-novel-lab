import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";
import { startReleaseCandidateServer } from "./lib/release-candidate-server.mjs";

const jsonMode = process.argv.includes("--json");
let baseUrl = "";
const failures = [];
let apiRequestCount = 0;
let serverHarness;

function chromiumLaunchOptions() {
  const expected = chromium.executablePath();
  if (fs.existsSync(expected)) return { headless: true, executablePath: expected };
  const browserRoot = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(process.env.LOCALAPPDATA || "", "ms-playwright");
  if (!fs.existsSync(browserRoot)) return { headless: true };
  const executableName = process.platform === "win32" ? "chrome.exe" : "chrome";
  const candidates = fs.readdirSync(browserRoot)
    .filter((name) => name.startsWith("chromium-") && !name.includes("headless"))
    .sort()
    .reverse()
    .map((name) => path.join(browserRoot, name, process.platform === "win32" ? "chrome-win64" : "chrome-linux", executableName));
  const executablePath = candidates.find((candidate) => fs.existsSync(candidate));
  return executablePath ? { headless: true, executablePath } : { headless: true };
}

try {
  serverHarness = await startReleaseCandidateServer({
    prefix: "rc-static-boundary",
    healthPath: "/?runtime=static&lang=en-US",
    env: { NEXT_PUBLIC_DEMO_MODE: "static", AI_PROVIDER: "mock", DEEPSEEK_API_KEY: "", SILICONFLOW_API_KEY: "" }
  });
  baseUrl = serverHarness.baseUrl;
  const browser = await chromium.launch(chromiumLaunchOptions());
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const apiRequests = [];
    page.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith("/api/")) apiRequests.push(pathname);
    });
    await page.goto(`${baseUrl}/?runtime=static&study=1&lang=en-US`, { waitUntil: "networkidle" });
    apiRequestCount = apiRequests.length;
    const boundary = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      studyStorage: localStorage.getItem("detective-town-campaign-study-v1"),
      recorderVisible: document.body.innerText.includes("Campaign Study Recorder")
    }));
    if (apiRequests.length) failures.push(`Static runtime requested ${apiRequests.join(", ")}`);
    if (boundary.overflow > 1) failures.push(`390px viewport overflowed by ${boundary.overflow}px.`);
    if (boundary.studyStorage !== null) failures.push("Static runtime wrote Campaign Study localStorage.");
    if (boundary.recorderVisible) failures.push("Static runtime displayed the Server-only Campaign Study Recorder.");
  } finally {
    await browser.close();
  }
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
} finally {
  await serverHarness?.cleanup();
}

const result = { ok: failures.length === 0, apiRequestCount, viewportWidth: 390, failures };
console.log(jsonMode ? JSON.stringify(result) : result.ok ? "Static boundary QA passed." : failures.join("\n"));
if (!result.ok) process.exitCode = 1;
