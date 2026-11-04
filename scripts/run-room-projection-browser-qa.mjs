import { chromium } from "playwright";
import { startReleaseCandidateServer, waitForServer } from "./lib/release-candidate-server.mjs";

const externalBaseUrl = process.env.ROOM_PROJECTION_QA_BASE_URL?.replace(/\/$/, "") || "";
let baseUrl = externalBaseUrl;
let serverHarness;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
try {
  if (externalBaseUrl) {
    await waitForServer(baseUrl, { pathName: "/?runtime=static", timeoutMs: 30_000 });
  } else {
    serverHarness = await startReleaseCandidateServer({
      prefix: "rc-room-projection-browser",
      env: { AI_PROVIDER: "mock", DEEPSEEK_API_KEY: "", SILICONFLOW_API_KEY: "" }
    });
    baseUrl = serverHarness.baseUrl;
  }
  await page.goto(`${baseUrl}/?runtime=static`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(3000);
  const onboardingFreeExplore = page.getByRole("button", { name: "先独立探索", exact: true });
  if (await onboardingFreeExplore.count()) await onboardingFreeExplore.click();
  const deductionNavigation = page.getByTestId("noir-nav-deduction");
  if (await deductionNavigation.count()) await deductionNavigation.click();
  if (await page.getByTestId("investigation-room-projection").count() === 0) {
    const debug = await page.locator("body").innerText().catch(() => "");
    const rail = await page.getByTestId("inspector-rail").innerText().catch(() => "missing-rail");
    throw new Error(`room projection surface did not mount; url=${page.url()} rail=${rail} body=${debug.slice(0, 600)}`);
  }
  await page.getByTestId("investigation-room-projection").waitFor({ state: "visible", timeout: 30000 });
  const projection = await page.getByTestId("investigation-room-projection").evaluate((element) => ({
    roomId: element.getAttribute("data-room-id"),
    caseId: element.getAttribute("data-case-id"),
    text: element.textContent || ""
  }));
  await page.screenshot({ path: "outputs/room-projection-ui-1440.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: "outputs/room-projection-ui-390.png", fullPage: true });
  if (overflow > 1) throw new Error(`room projection overflows mobile viewport by ${overflow}px`);
  if (errors.length) throw new Error(`browser page errors: ${errors.join("; ")}`);
  console.log(JSON.stringify({ ok: true, suite: "room-projection-browser-qa", baseUrl, projection, overflow, errors }));
} finally {
  await browser.close();
  await serverHarness?.cleanup();
}
