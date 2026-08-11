import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const host = "127.0.0.1";
const port = 3421;
const baseUrl = `http://${host}:${port}`;
let server;

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
  throw new Error("production server did not become ready");
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

async function openInspectorDetail(page) {
  const detailToggle = page.getByRole("button", { name: /Case files & detail/i });
  await detailToggle.waitFor({ state: "visible", timeout: 30_000 });
  if (await detailToggle.getAttribute("aria-expanded") !== "true") await detailToggle.click();
}

async function openWorldCampaignArchive(page) {
  const archive = page.getByTestId("world-campaign-archive");
  if (!await archive.count()) return;
  if (!await archive.evaluate((node) => node instanceof HTMLDetailsElement && node.open)) await archive.locator(":scope > summary").click();
}

async function settleCampaignTransitionTheatre(page) {
  const theatre = page.getByTestId("campaign-transition-theatre");
  if (!await theatre.isVisible().catch(() => false)) {
    await theatre.waitFor({ state: "visible", timeout: 2_000 }).catch(() => undefined);
  }
  if (await theatre.isVisible().catch(() => false)) {
    await page.waitForFunction(() => document.querySelector("[data-testid='campaign-transition-theatre']")?.getAttribute("data-transition-phase") !== "action-resolving", undefined, { timeout: 30_000 });
    const skip = theatre.getByRole("button", { name: "Skip to next" });
    if (await skip.isVisible().catch(() => false)) await skip.click();
    await page.waitForFunction(() => document.querySelector("[data-testid='campaign-transition-theatre']")?.getAttribute("data-transition-phase") === "next-objective", undefined, { timeout: 10_000 }).catch(() => undefined);
    const continueButton = theatre.getByRole("button", { name: "Continue" });
    if (await continueButton.isVisible().catch(() => false)) await continueButton.click();
    await theatre.waitFor({ state: "detached", timeout: 10_000 }).catch(() => undefined);
  }
  await openInspectorDetail(page);
}

async function continueSavedCampaign(page) {
  const frontDoor = page.getByTestId("campaign-front-door");
  await frontDoor.waitFor({ state: "visible", timeout: 30_000 });
  const continueButton = frontDoor.getByTestId("campaign-front-door-continue");
  await continueButton.waitFor({ state: "visible", timeout: 30_000 });
  await continueButton.click();
  await frontDoor.waitFor({ state: "hidden", timeout: 30_000 });
  await openInspectorDetail(page);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) }
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.ok === false) throw new Error(`${options.method || "GET"} ${path} failed: ${response.status} ${JSON.stringify(json)}`);
  return json.data || json;
}

async function validCandidate(worldId) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const queue = await request(`/api/v1/query/town/candidates?worldId=${encodeURIComponent(worldId)}`);
    const candidate = queue.candidates.find((item) => item.validation?.valid);
    if (candidate) return candidate;
    await request("/api/v1/command/town/runtime/step", { method: "POST", body: JSON.stringify({ worldId, steps: 8 }) });
  }
  throw new Error("no valid candidate reached the bounded browser QA window");
}

async function extract(worldId) {
  const candidate = await validCandidate(worldId);
  return request("/api/v1/command/town/case/extract", { method: "POST", body: JSON.stringify({ worldId, candidateId: candidate.id }) });
}

async function solve(worldId, extracted, label) {
  const joined = await request("/api/v1/command/player/join", {
    method: "POST",
    body: JSON.stringify({ worldId, caseId: extracted.activeCase.id, displayName: `Headquarters QA ${label}` })
  });
  const evidenceIds = extracted.activeCase.deductionCase.evidence.map((item) => item.id);
  for (const evidenceId of evidenceIds) {
    await request("/api/v1/command/investigation/discover", {
      method: "POST",
      body: JSON.stringify({ sessionId: joined.session.id, evidenceId })
    });
  }
  const solved = await request("/api/v1/command/investigation/submit-theory", {
    method: "POST",
    body: JSON.stringify({
      sessionId: joined.session.id,
      theory: {
        culpritId: extracted.activeCase.deductionCase.truth.culpritId,
        motive: extracted.activeCase.deductionCase.truth.motive,
        method: extracted.activeCase.deductionCase.truth.method,
        evidenceIds
      }
    })
  });
  assert.equal(solved.judgement.accepted, true, `${label} accepted theory closes through existing authority`);
  return joined.session.id;
}

try {
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args = process.platform === "win32" ? ["/d", "/s", "/c", `npm.cmd run start -- -H ${host} -p ${port}`] : ["run", "start", "--", "-H", host, "-p", String(port)];
  server = spawn(command, args, { cwd: process.cwd(), detached: process.platform !== "win32", env: process.env, stdio: "ignore" });
  await waitForServer();
  const worldCreated = await request("/api/v1/command/town/create", { method: "POST", body: JSON.stringify({ seed: "investigator-headquarters-browser", mode: "showcase", caseMode: "generated", npcCount: 20, timelineHours: 24 }) });
  const worldId = worldCreated.world.id;
  let started = await request("/api/v1/command/town/runtime/start", { method: "POST", body: JSON.stringify({ worldId, steps: 2 }) });
  for (let attempt = 0; attempt < 6 && !started.queue.candidates.some((item) => item.validation?.valid); attempt += 1) {
    started = await request("/api/v1/command/town/runtime/step", { method: "POST", body: JSON.stringify({ worldId, steps: 8 }) });
  }
  let extracted = await extract(worldId);
  let sessionId = await solve(worldId, extracted, "Case One");
  let runtime = await request(`/api/v1/query/town/runtime?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(runtime.runtime.investigatorHeadquartersSummary.status, "ready", "first accepted case prepares Headquarters");

  const browser = await chromium.launch(launchOptions());
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(({ worldId: id, sessionId: sid }) => localStorage.setItem("detective-town-launch-v1", JSON.stringify({ worldId: id, sessionId: sid })), { worldId, sessionId });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/?runtime=server&lang=en-US`, { waitUntil: "networkidle" });
    // Server Runtime intentionally opens the Campaign Front Door on first load.
    // The persisted launch record only seeds the Continue action; it does not
    // bypass that player-facing boundary. Restore through the same UI path the
    // player uses before asserting the Headquarters surface.
    await continueSavedCampaign(page);
    await openWorldCampaignArchive(page);
    const headquarters = page.getByTestId("investigator-headquarters");
    await headquarters.waitFor({ state: "visible", timeout: 30_000 });
    const readyText = await headquarters.innerText();
    assert.match(readyText, /ready|field search|witness work|evidence handling|institutional access/i, "ready Headquarters UI shows directions");
    assert.equal(/caseId|targetCaseId|sourceCaseId|createdAtTick|tick|resourceKind|institutionId/i.test(readyText), false, "ready Headquarters UI is public-safe");
    const firstPreparation = headquarters.locator("article.available button").first();
    const [preparationResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/v1/command/town/runtime/step") && response.request().method() === "POST" && Boolean(response.request().postDataJSON()?.investigatorHeadquartersDecision), { timeout: 30_000 }),
      firstPreparation.click()
    ]);
    const preparationPayload = await preparationResponse.json();
    assert.equal(preparationResponse.ok(), true, `Headquarters decision API failed: ${JSON.stringify(preparationPayload)}`);
    assert.equal(preparationPayload?.data?.investigatorHeadquarters?.status, "prepared", "Headquarters decision API returns prepared state");
    await settleCampaignTransitionTheatre(page);
    await openWorldCampaignArchive(page);
    try {
      await headquarters.getByText("prepared", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
    } catch (error) {
      const uiText = await headquarters.innerText().catch(() => "Headquarters surface missing");
      const persisted = await request(`/api/v1/query/town/runtime?worldId=${encodeURIComponent(worldId)}`);
      throw new Error(`${error instanceof Error ? error.message : String(error)} / persisted ${persisted.runtime.investigatorHeadquartersSummary?.status || "missing"} / UI ${JSON.stringify(uiText)}`);
    }
    const preparedText = await headquarters.innerText();
    assert.match(preparedText, /prepared|selected/i, "Headquarters UI shows prepared state");
    await page.evaluate(() => localStorage.setItem("detective-town-launch-v1", JSON.stringify({ worldId: JSON.parse(localStorage.getItem("detective-town-launch-v1") || "{}").worldId, sessionId: "" })));
    extracted = await extract(worldId);
    assert.equal(extracted.investigatorHeadquarters.status, "active", "next extraction activates Headquarters");
    await page.reload({ waitUntil: "networkidle" });
    await continueSavedCampaign(page);
    await openWorldCampaignArchive(page);
    await page.getByTestId("investigator-headquarters").getByText("active", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });

    sessionId = await solve(worldId, extracted, "Case Two");
    runtime = await request(`/api/v1/query/town/runtime?worldId=${encodeURIComponent(worldId)}`);
    assert.equal(runtime.runtime.investigatorHeadquartersSummary.status, "ready", "second accepted case prepares the second Headquarters stage");
    await page.evaluate((sid) => localStorage.setItem("detective-town-launch-v1", JSON.stringify({ worldId: JSON.parse(localStorage.getItem("detective-town-launch-v1") || "{}").worldId, sessionId: sid })), sessionId);
    await page.reload({ waitUntil: "networkidle" });
    await continueSavedCampaign(page);
    await openWorldCampaignArchive(page);
    await page.getByTestId("investigator-headquarters").getByText("ready", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
    await page.getByTestId("investigator-headquarters").locator("article.available button").first().click();
    await settleCampaignTransitionTheatre(page);
    await openWorldCampaignArchive(page);
    await page.getByTestId("investigator-headquarters").getByText("prepared", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
    await page.evaluate(() => localStorage.setItem("detective-town-launch-v1", JSON.stringify({ worldId: JSON.parse(localStorage.getItem("detective-town-launch-v1") || "{}").worldId, sessionId: "" })));
    extracted = await extract(worldId);
    assert.equal(extracted.investigatorHeadquarters.status, "active", "third-case extraction activates the second Headquarters stage");
    sessionId = await solve(worldId, extracted, "Finale");
    await page.evaluate((sid) => localStorage.setItem("detective-town-launch-v1", JSON.stringify({ worldId: JSON.parse(localStorage.getItem("detective-town-launch-v1") || "{}").worldId, sessionId: sid })), sessionId);
    await page.reload({ waitUntil: "networkidle" });
    await continueSavedCampaign(page);
    await openWorldCampaignArchive(page);
    const completed = page.getByTestId("investigator-headquarters");
    await completed.getByText("completed", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
    const completedText = await completed.innerText();
    assert.match(completedText, /completed|preparation completed/i, "accepted finale shows completed Headquarters state");
    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) - window.innerWidth);
    assert.ok(overflow <= 1, "390px Headquarters UI has no horizontal overflow");
    await context.close();
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify({ ok: true, suite: "investigator-headquarters-browser", lifecycle: ["ready", "prepared", "active", "completed"] }));
} finally {
  stopServer();
}
