import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const STORAGE_KEY = "detective-town-campaign-study-v1";
const EXPORT_FILE = "detective-town-campaign-study-v1.json";

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function argValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function launchOptions() {
  const executablePath = chromium.executablePath();
  const fallback = process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : "";
  return fs.existsSync(executablePath)
    ? { headless: true, executablePath }
    : fs.existsSync(fallback)
      ? { headless: true, executablePath: fallback }
      : { headless: true };
}

function findAvailableLocalPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function get(url, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      response.resume();
      response.on("end", () => resolve({ ok: true, status: response.statusCode || 0 }));
    });
    request.on("timeout", () => {
      request.destroy();
      resolve({ ok: false, status: 0 });
    });
    request.on("error", () => resolve({ ok: false, status: 0 }));
  });
}

async function waitForServer(baseUrl, timeoutMs = 120000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await get(`${baseUrl}/?runtime=server`);
    if (result.ok && result.status >= 200 && result.status < 500) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${baseUrl}.`);
}

async function ensureServer(baseUrl, forceStart) {
  const existing = forceStart ? { ok: false } : await get(`${baseUrl}/?runtime=server`);
  if (existing.ok) return { started: false, child: null };
  const port = new URL(baseUrl).port;
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", `npm.cmd run dev -- -p ${port}`]
    : ["run", "dev", "--", "-p", port];
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, NEXT_PUBLIC_DEMO_MODE: "server" },
    stdio: "ignore"
  });
  await waitForServer(baseUrl);
  return { started: true, child };
}

async function streamText(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function dismissCampaignFrontDoor(page) {
  const frontDoor = page.getByTestId("campaign-front-door");
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await frontDoor.isVisible().catch(() => false)) {
      const dismiss = frontDoor.getByTestId("campaign-front-door-dismiss");
      await dismiss.waitFor({ state: "visible", timeout: 30000 });
      await page.waitForFunction((element) => element instanceof HTMLButtonElement && !element.disabled, await dismiss.elementHandle(), { timeout: 30000 });
      await dismiss.click({ force: true });
    }
    await page.waitForTimeout(250);
    if (!(await frontDoor.isVisible().catch(() => false))) {
      await page.waitForTimeout(250);
      if (!(await frontDoor.isVisible().catch(() => false))) return;
    }
  }
  throw new Error("Campaign Front Door remained open while entering Campaign Study.");
}

function awaitingAssessmentCollection() {
  const completedPilot = (ordinal, cohort, scenario) => ({
    formatVersion: 1,
    ordinal,
    cohort,
    protocol: "pilot",
    scenario,
    status: "completed",
    currentStage: "debrief",
    elapsedSeconds: 420,
    firstMeaningfulActionSeconds: 70,
    stageDurations: { opening: { count: 1, totalSeconds: 70, maxSeconds: 70 } },
    worldChoiceDurations: {},
    recoveryShownCount: scenario === "recovery-probe" ? 1 : 0,
    recoveryStartedCount: scenario === "recovery-probe" ? 1 : 0,
    guidedStepUseCount: 0,
    explicitFallbackUseCount: 0,
    campaignCompleted: true,
    assessment: {
      primaryActionMisunderstandingCount: 0,
      confusionCategories: [],
      recoveryPrompted: false,
      finaleExplanation: "correct",
      replayIntent: "different-route"
    },
    measurement: {
      stageStartedAtSeconds: 420,
      activeWorldChoiceStartedAtSeconds: {},
      recoveryReadyOpen: false
    }
  });
  return {
    formatVersion: 1,
    nextOrdinal: 4,
    runs: [
      completedPilot(1, "mystery-first", "standard"),
      completedPilot(2, "systems-first", "recovery-probe"),
      {
      formatVersion: 1,
      ordinal: 3,
      cohort: "mystery-first",
      protocol: "official",
      scenario: "standard",
      status: "awaiting-assessment",
      currentStage: "debrief",
      elapsedSeconds: 480,
      firstMeaningfulActionSeconds: 85,
      stageDurations: { opening: { count: 1, totalSeconds: 85, maxSeconds: 85 } },
      worldChoiceDurations: {},
      recoveryShownCount: 0,
      recoveryStartedCount: 0,
      guidedStepUseCount: 0,
      explicitFallbackUseCount: 0,
      campaignCompleted: true,
      assessment: {
        primaryActionMisunderstandingCount: 0,
        confusionCategories: [],
        recoveryPrompted: false,
        finaleExplanation: "not-assessed",
        replayIntent: "not-assessed"
      },
      measurement: {
        stageStartedAtSeconds: 480,
        activeWorldChoiceStartedAtSeconds: {},
        recoveryReadyOpen: false
      }
      }
    ]
  };
}

function completedPilotsCollection() {
  const collection = awaitingAssessmentCollection();
  return { ...collection, nextOrdinal: 3, runs: collection.runs.slice(0, 2) };
}

function invalidOfficialCollection() {
  const collection = awaitingAssessmentCollection();
  return {
    formatVersion: 1,
    nextOrdinal: 2,
    runs: [{ ...collection.runs[2], ordinal: 1, status: "abandoned", currentStage: "opening", campaignCompleted: false }]
  };
}

async function verifyServer(context, baseUrl) {
  const page = await context.newPage();
  const runtimeStepBodies = [];
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/command/town/runtime/step")) runtimeStepBodies.push(request.postData() || "");
  });
  await page.goto(`${baseUrl}/?runtime=server&study=1`, { waitUntil: "load" });
  await page.getByTestId("campaign-study-recorder").waitFor({ state: "visible", timeout: 30000 });
  await dismissCampaignFrontDoor(page);
  await page.getByTestId("open-persistent-town").waitFor({ state: "visible", timeout: 60000 });
  await page.getByTestId("open-persistent-town").click();
  await dismissCampaignFrontDoor(page);
  await page.getByTestId("town-situation-brief").waitFor({ state: "visible", timeout: 30000 });
  const recorder = page.getByTestId("campaign-study-recorder");
  await dismissCampaignFrontDoor(page);
  if (!(await recorder.getAttribute("open"))) await recorder.locator("summary").click();
  await page.getByTestId("campaign-study-next-slot").waitFor({ state: "visible", timeout: 10000 });
  const initialSlot = (await page.getByTestId("campaign-study-next-slot").innerText()).includes("P1");
  const manualSelectorsHidden = await recorder.locator("select[data-testid^='campaign-study-']").count() === 0;
  await page.waitForFunction(() => {
    const button = document.querySelector("[data-testid='campaign-study-start']");
    return button instanceof HTMLButtonElement && !button.disabled;
  }, undefined, { timeout: 30000 });
  await page.getByTestId("campaign-study-start").click();
  await page.getByTestId("campaign-study-stage").waitFor({ state: "visible", timeout: 10000 });
  await page.waitForFunction(() => {
    const button = document.querySelector("[data-testid='persistent-town-step']");
    return button instanceof HTMLButtonElement && !button.disabled;
  }, undefined, { timeout: 30000 });
  await page.getByTestId("persistent-town-step").click();
  await page.waitForFunction(() => document.querySelector("[data-testid='campaign-study-first-action']")?.textContent !== "Waiting", undefined, { timeout: 30000 });
  const activeStorage = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
  await page.getByTestId("campaign-study-abandon").click();
  await page.waitForFunction(() => document.querySelector("[data-testid='campaign-study-next-slot']")?.textContent?.includes("P1"), undefined, { timeout: 10000 });

  await page.evaluate(({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: completedPilotsCollection() });
  await page.reload({ waitUntil: "load" });
  await page.getByTestId("campaign-study-recorder").waitFor({ state: "visible", timeout: 30000 });
  await dismissCampaignFrontDoor(page);
  const pilotReadyRecorder = page.getByTestId("campaign-study-recorder");
  if (!(await pilotReadyRecorder.getAttribute("open"))) await pilotReadyRecorder.locator("summary").click();
  await page.waitForFunction(() => document.querySelector("[data-testid='campaign-study-next-slot']")?.textContent?.includes("O1"), undefined, { timeout: 10000 });

  await page.evaluate(({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: awaitingAssessmentCollection() });
  await page.reload({ waitUntil: "load" });
  await page.getByTestId("campaign-study-recorder").waitFor({ state: "visible", timeout: 30000 });
  await dismissCampaignFrontDoor(page);
  const reloadedRecorder = page.getByTestId("campaign-study-recorder");
  if (!(await reloadedRecorder.getAttribute("open"))) await reloadedRecorder.locator("summary").click();
  await page.getByTestId("campaign-study-finale-rating").selectOption("correct");
  await page.getByTestId("campaign-study-replay-intent").selectOption("different-route");
  await page.getByTestId("campaign-study-finalize").click();
  await page.waitForFunction(() => document.querySelector("[data-testid='campaign-study-recorder'] summary")?.textContent?.includes("1/8 eligible official"), undefined, { timeout: 10000 });
  await page.waitForFunction(() => document.querySelector("[data-testid='campaign-study-next-slot']")?.textContent?.includes("O2"), undefined, { timeout: 10000 });
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("campaign-study-export").click();
  const download = await downloadPromise;
  const exportedText = await streamText(await download.createReadStream());
  const exported = JSON.parse(exportedText);
  const serialized = JSON.stringify(exported);
  const finalStorage = JSON.parse(await page.evaluate((key) => window.localStorage.getItem(key) || "{}", STORAGE_KEY));
  await page.evaluate(({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: invalidOfficialCollection() });
  await page.reload({ waitUntil: "load" });
  await page.getByTestId("campaign-study-recorder").waitFor({ state: "visible", timeout: 30000 });
  await dismissCampaignFrontDoor(page);
  const invalidRecorder = page.getByTestId("campaign-study-recorder");
  if (!(await invalidRecorder.getAttribute("open"))) await invalidRecorder.locator("summary").click();
  const invalidStart = page.getByTestId("campaign-study-start");
  await invalidStart.waitFor({ state: "visible", timeout: 10000 });
  const invalidStateBlocked = await invalidStart.isDisabled()
    && (await invalidRecorder.innerText()).includes("do not match the fixed slot order");
  await page.close();
  const privacyPattern = /\b(?:worldId|caseId|sessionId|npcId|locationId|sourceId|eventId|seed|timestamp|createdAt|updatedAt|selectedAnswer|playerText|rawBody|truth|measurement)\b/i;
  const summary = {
    recorderVisible: true,
    initialSlotLocked: initialSlot,
    manualSelectorsHidden,
    pilotToOfficialLocked: true,
    nextOfficialLocked: true,
    invalidStateBlocked,
    activeRunPersisted: Boolean(activeStorage && JSON.parse(activeStorage).runs?.some((run) => run.status === "active")),
    firstMeaningfulActionRecorded: Boolean(activeStorage && JSON.parse(activeStorage).runs?.some((run) => Number.isInteger(run.firstMeaningfulActionSeconds))),
    runtimeRequestUnchanged: runtimeStepBodies.length > 0 && runtimeStepBodies.every((body) => !/study|cohort|protocol|scenario/i.test(body)),
    finalized: finalStorage.runs?.some((run) => run.protocol === "official" && run.status === "completed"),
    exportFileName: download.suggestedFilename() === EXPORT_FILE,
    exportSafe: exported.formatVersion === 1 && Array.isArray(exported.runs) && !privacyPattern.test(serialized),
    pageErrors: pageErrors.length
  };
  const failures = Object.entries(summary).flatMap(([key, value]) => value === false || (key === "pageErrors" && value !== 0) ? [`server.${key}=${String(value)}`] : []);
  return { ok: failures.length === 0, summary, failures };
}

async function verifyStatic(context, baseUrl) {
  const page = await context.newPage();
  const requests = [];
  const pageErrors = [];
  await page.addInitScript((key) => window.localStorage.removeItem(key), STORAGE_KEY);
  page.on("request", (request) => requests.push(request.url()));
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${baseUrl}/?runtime=static&study=1`, { waitUntil: "load" });
  await page.locator('[data-testid="district-strategic-fronts"][data-front-status="readonly"]').waitFor({ state: "attached", timeout: 30000 });
  const onboarding = page.getByTestId("onboarding-overlay");
  if (await onboarding.isVisible().catch(() => false)) await onboarding.locator("button").last().click();
  const studyBoundary = page.getByTestId("campaign-study-boundary");
  if (await studyBoundary.count() === 0) {
    const inspectorToggle = page.locator('button[aria-controls="command-deck-full-inspector"]');
    await inspectorToggle.waitFor({ state: "attached", timeout: 30000 });
    await inspectorToggle.click({ force: true });
  }
  await studyBoundary.waitFor({ state: "visible", timeout: 30000 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const summary = await page.evaluate((key) => ({
    recorderCount: document.querySelectorAll("[data-testid='campaign-study-recorder']").length,
    storageValue: window.localStorage.getItem(key),
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }), STORAGE_KEY);
  await page.close();
  const apiRequests = requests.filter((url) => new URL(url).pathname.startsWith("/api/"));
  const checks = {
    recorderHidden: summary.recorderCount === 0,
    storageUntouched: summary.storageValue === null,
    zeroApiRequests: apiRequests.length === 0,
    mobileNoOverflow: summary.scrollWidth <= summary.clientWidth,
    pageErrors: pageErrors.length
  };
  const failures = Object.entries(checks).flatMap(([key, value]) => value === false || (key === "pageErrors" && value !== 0) ? [`static.${key}=${String(value)}`] : []);
  return { ok: failures.length === 0, summary: { ...checks, apiRequests }, failures };
}

const requestedUrl = argValue("url")?.replace(/\/$/, "");
const baseUrl = requestedUrl || `http://127.0.0.1:${await findAvailableLocalPort()}`;
const json = hasFlag("json");
let server;
let browser;
try {
  server = await ensureServer(baseUrl, !requestedUrl);
  browser = await chromium.launch(launchOptions());
  const serverContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  await serverContext.addInitScript((key) => {
    if (window.sessionStorage.getItem("campaign-study-qa-initialized") === "1") return;
    window.localStorage.removeItem(key);
    window.sessionStorage.setItem("campaign-study-qa-initialized", "1");
  }, STORAGE_KEY);
  const serverReport = await verifyServer(serverContext, baseUrl);
  await serverContext.close();
  const staticContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const staticReport = await verifyStatic(staticContext, baseUrl);
  await staticContext.close();
  const failures = [...serverReport.failures, ...staticReport.failures];
  const report = { ok: failures.length === 0, baseUrl, serverStarted: server.started, server: serverReport, static: staticReport, failures };
  console.log(json ? JSON.stringify(report, null, 2) : `Campaign comprehension browser QA: ${report.ok ? "ok" : `failed\n${failures.join("\n")}`}`);
  if (!report.ok) process.exitCode = 1;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.log(json ? JSON.stringify({ ok: false, error: message }, null, 2) : message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server?.started && server.child) {
    if (process.platform === "win32" && server.child.pid) {
      try {
        execFileSync("taskkill", ["/PID", String(server.child.pid), "/T", "/F"], { stdio: "ignore" });
      } catch {
        server.child.kill();
      }
    } else server.child.kill();
  }
}
