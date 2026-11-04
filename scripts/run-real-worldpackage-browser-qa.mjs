import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { startReleaseCandidateServer, waitForServer } from "./lib/release-candidate-server.mjs";

const jsonMode = process.argv.includes("--json");
const outputDir = path.join(process.cwd(), "outputs", "worldpackage-browser-qa");
fs.mkdirSync(outputDir, { recursive: true });
const failures = [];
const observations = [];
const errors = [];
const requests = [];
const assetRequests = [];
const setupRequests = [];
let step = "startup";
let serverHarness;
let browser;

function launchOptions() {
  // Let Playwright resolve its bundled browser. Supplying the Windows
  // executable path explicitly can fail with `spawn UNKNOWN` on the junctioned
  // workspace even when the bundled launcher works.
  return { headless: true };
}

async function request(baseUrl, pathName, options = {}) {
  setupRequests.push(pathName);
  const response = await fetch(`${baseUrl}${pathName}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    signal: AbortSignal.timeout(60_000)
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.ok === false) throw new Error(`${options.method || "GET"} ${pathName} failed: ${response.status} ${JSON.stringify(json)}`);
  return json.data || json;
}

async function assertAxe(page, label) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const severe = result.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
  if (severe.length) failures.push(`${label} axe: ${severe.map((item) => `${item.id}(${item.nodes.map((node) => node.target.join(" ")).join(" | ")})`).join(", ")}`);
  return severe.length;
}

async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
  if (overflow > 1) failures.push(`${label} horizontal overflow ${overflow}px`);
  return overflow;
}

try {
  browser = await chromium.launch(launchOptions());
  serverHarness = await startReleaseCandidateServer({
    prefix: "rc-real-worldpackage-browser-qa",
    healthPath: "/api/v1/query/runtime/status",
    env: { AI_PROVIDER: "mock", DEEPSEEK_API_KEY: "", SILICONFLOW_API_KEY: "" }
  });
  const baseUrl = serverHarness.baseUrl;

  step = "build real WorldPackage case";
  const created = await request(baseUrl, "/api/v1/command/town/create", {
    method: "POST",
    body: JSON.stringify({ seed: "real-worldpackage-browser-qa", mode: "advanced", caseMode: "generated", npcCount: 30, timelineHours: 120, preSimDays: 5 })
  });
  const worldId = created.world.id;
  const selected = await request(baseUrl, "/api/v1/command/player/world-pack/select", {
    method: "POST",
    body: JSON.stringify({ worldId, packageId: "dock-court-market-town", campaignRouteId: "baseline" })
  });
  assert.equal(selected.currentExperiment?.worldPackageReceipt?.schema, "world-package-receipt.v1");
  let started = await request(baseUrl, "/api/v1/command/town/runtime/start", {
    method: "POST",
    body: JSON.stringify({ worldId, steps: 2, actionId: "real-worldpackage-browser-start" })
  });
  let candidate = started.queue?.candidates?.find((item) => item.validation?.valid) || null;
  for (let attempt = 0; attempt < 12 && !candidate; attempt += 1) {
    started = await request(baseUrl, "/api/v1/command/town/runtime/step", {
      method: "POST",
      body: JSON.stringify({ worldId, steps: 10, actionId: `real-worldpackage-browser-step-${attempt + 1}`, sessionRevision: started.runtime?.revision })
    });
    candidate = started.queue?.candidates?.find((item) => item.validation?.valid) || null;
  }
  assert.ok(candidate, `a real WorldPackage must produce a valid candidate for the browser path (tick=${started.runtime?.tick}, candidates=${JSON.stringify((started.queue?.candidates || []).slice(0, 4).map((item) => ({ id: item.id, tick: item.tick, valid: item.validation?.valid, reasons: item.validation?.failureReasons })))})`);
  const extracted = await request(baseUrl, "/api/v1/command/town/case/extract", {
    method: "POST",
    body: JSON.stringify({ worldId, candidateId: candidate.id })
  });
  const activeCase = extracted.activeCase;
  assert.equal(activeCase?.validation?.valid, true);
  assert.ok(activeCase?.id);
  assert.ok(activeCase?.deductionCase?.title);
  const state = await request(baseUrl, `/api/v1/query/world/state?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(state.activeCase?.id, activeCase.id);

  step = "load real case in browser";
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: "reduce" });
    await context.addInitScript(({ worldSession }) => {
      localStorage.setItem("detective-town-launch-v1", worldSession);
      localStorage.setItem("detective-town-locale-v1", JSON.stringify({ formatVersion: 1, locale: "zh-CN" }));
    }, { worldSession: JSON.stringify({ formatVersion: 1, worldId, sessionId: "" }) });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("request", (requestEvent) => {
      const pathname = new URL(requestEvent.url()).pathname;
      if (pathname.startsWith("/api/")) requests.push(pathname);
      if (pathname.endsWith("/procedural-room-candidate.glb")) assetRequests.push(pathname);
    });
    await page.goto(`${baseUrl}/?runtime=server&lang=zh-CN`, { waitUntil: "networkidle", timeout: 60_000 });
    const frontDoor = page.getByTestId("campaign-front-door");
    await frontDoor.waitFor({ state: "visible", timeout: 20_000 });
    const continueButton = frontDoor.getByTestId("campaign-front-door-continue");
    await continueButton.waitFor({ state: "visible", timeout: 10_000 });
    await continueButton.click();
    await frontDoor.waitFor({ state: "hidden", timeout: 30_000 });
    const consoleSurface = page.getByTestId("world-console");
    await consoleSurface.waitFor({ state: "visible", timeout: 30_000 });
    const consoleIdentity = await page.getByTestId("world-console-hud").innerText();
    if (!consoleIdentity.includes(activeCase.deductionCase.title)) failures.push("World Console did not display the extracted real-package case title.");
    const runtimeMode = await consoleSurface.getAttribute("data-runtime-mode");
    assert.equal(runtimeMode, "server");
    observations.push({ surface: "world-console", worldId, caseId: activeCase.id, caseTitle: activeCase.deductionCase.title, runtimeMode });

    step = "navigate from living world to investigation room";
    await page.getByRole("button", { name: "进入案件调查" }).first().click();
    await page.getByTestId("command-deck-shell").waitFor({ state: "visible", timeout: 20_000 });
    const deductionNavigation = page.getByTestId("noir-nav-deduction");
    await deductionNavigation.click();
    const room = page.getByTestId("investigation-room-projection");
    await room.waitFor({ state: "visible", timeout: 30_000 });
    const runtime = page.getByTestId("procedural-room-runtime");
    await runtime.waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForFunction(() => {
      const element = document.querySelector("[data-testid='procedural-room-runtime']");
      return element?.dataset.runtimeStatus === "ready" || element?.dataset.runtimeStatus === "fallback";
    }, undefined, { timeout: 30_000 });
    await page.waitForTimeout(1_200);
    const runtimeState = await runtime.evaluate((element) => ({
      roomId: element.getAttribute("data-room-id"),
      caseId: element.getAttribute("data-case-id"),
      assetStatus: element.getAttribute("data-asset-status"),
      runtimeStatus: element.getAttribute("data-runtime-status"),
      frameCount: Number(element.getAttribute("data-frame-count") || 0),
      p95FrameMs: Number(element.getAttribute("data-p95-frame-ms") || 0),
      loadMs: Number(element.getAttribute("data-load-ms") || 0),
      contextLost: element.getAttribute("data-context-lost") === "true",
      assetUrl: element.getAttribute("data-asset-url")
    }));
    if (runtimeState.runtimeStatus !== "ready") failures.push(`Candidate GLB runtime did not reach ready state: ${JSON.stringify(runtimeState)}`);
    if (runtimeState.assetStatus !== "candidate-only") failures.push("Room runtime did not preserve candidate-only asset status.");
    if (runtimeState.contextLost) failures.push("Room runtime reported a lost WebGL context.");
    if (runtimeState.frameCount < 10) failures.push(`Room runtime produced too few frames for a browser capture: ${runtimeState.frameCount}`);
    if (!assetRequests.some((pathname) => pathname.endsWith("/procedural-room-candidate.glb"))) failures.push("Browser did not request the candidate GLB runtime asset.");
    const projection = await room.evaluate((element) => ({
      roomId: element.getAttribute("data-room-id"),
      caseId: element.getAttribute("data-case-id"),
      text: element.textContent || ""
    }));
    assert.equal(projection.caseId, activeCase.id);
    assert.ok(projection.roomId);
    if (activeCase.triggeredEventId && projection.text.includes(activeCase.triggeredEventId)) failures.push("Player room projection leaked the private trigger event id.");
    const culpritId = activeCase.deductionCase.truth?.culpritId;
    if (culpritId && projection.text.includes(culpritId)) failures.push("Player room projection leaked the private culprit id.");
    if (!projection.text.includes("锁定") && !projection.text.includes("低剧透")) failures.push("Player room projection did not expose its low-spoiler state.");
    const focusedAfterNavigation = await page.evaluate(() => ({
      tag: document.activeElement?.tagName || "",
      testId: document.activeElement?.getAttribute("data-testid") || "",
      insideShell: Boolean(document.activeElement?.closest("[data-testid='command-deck-shell']"))
    }));
    if (!focusedAfterNavigation.insideShell) failures.push("Investigation navigation did not leave focus inside the Command Deck.");
    const axeSevereViolations = await assertAxe(page, "real WorldPackage investigation room");
    await page.screenshot({ path: path.join(outputDir, "1440-real-worldpackage-investigation.png"), fullPage: true });

    step = "responsive real case room";
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileOverflow = await assertNoOverflow(page, "real WorldPackage room 390px");
    const mobileAxeSevereViolations = await assertAxe(page, "real WorldPackage investigation room 390px");
    await page.screenshot({ path: path.join(outputDir, "390-real-worldpackage-investigation.png"), fullPage: true });
    await page.setViewportSize({ width: 320, height: 780 });
    const narrowOverflow = await assertNoOverflow(page, "real WorldPackage room 320px");
    await page.emulateMedia({ reducedMotion: "reduce" });
    if (errors.length) failures.push(`browser page errors: ${errors.join("; ")}`);
    observations.push({ surface: "investigation-room", projection, runtime: runtimeState, mobileOverflow, narrowOverflow, axeSevereViolations, mobileAxeSevereViolations, focusedAfterNavigation, reducedMotion: "reduce" });
    await context.close();
  } finally {
    await browser.close();
  }

  if (!setupRequests.includes("/api/v1/command/player/world-pack/select")) failures.push("WorldPackage setup did not call the player selection endpoint.");
  if (!requests.includes(`/api/worlds/${worldId}/state`)) failures.push("Browser Continue path did not load the persisted world state.");
  if (!requests.includes(`/api/v1/query/case/room-projection`)) failures.push("Browser investigation path did not query the room projection.");
  if (errors.length) failures.push(`browser page errors: ${errors.join("; ")}`);

  const receipt = {
    schema: "worldpackage-browser-qa.v1",
    evidenceClass: "local-world-package-browser-campaign",
    status: failures.length ? "candidate-failed" : "candidate",
    humanGate: "pending-human-comprehension-and-ui-review",
    package: { id: "dock-court-market-town", selectionReceiptSchema: selected.currentExperiment?.worldPackageReceipt?.schema || null },
    world: { id: worldId, caseId: activeCase.id, caseTitle: activeCase.deductionCase.title },
    browser: { viewport: { desktop: [1440, 960], mobile: [390, 844], narrow: [320, 780] }, reducedMotion: "reduce", requests: Array.from(new Set(requests)), assetRequests: Array.from(new Set(assetRequests)), setupRequests: Array.from(new Set(setupRequests)), errors },
    observations,
    boundaries: { realWorldPackageInput: true, syntheticSourceFixture: false, productionUiClaim: false, humanComprehensionReview: "pending", acceptedAssetAndRuntimeReview: "pending" },
    failures
  };
  await fs.promises.writeFile(path.join(process.cwd(), "outputs", "worldpackage-browser-qa-dock-court-market-town.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(jsonMode ? JSON.stringify({ ...receipt, outputPath: "outputs/worldpackage-browser-qa-dock-court-market-town.json" }) : receipt.status === "candidate" ? "Real WorldPackage browser QA passed." : failures.join("\n"));
  if (failures.length) process.exitCode = 1;
} catch (error) {
  failures.push(`${step}: ${error instanceof Error ? error.message : String(error)}`);
  console.log(jsonMode ? JSON.stringify({ ok: false, step, failures }) : failures.join("\n"));
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => undefined);
  await serverHarness?.cleanup();
}
