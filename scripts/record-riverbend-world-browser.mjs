import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const folder = "docs/3d-town/riverbend-v1/";
const read = path => fs.readFileSync(path, "utf8").replace(/^\uFEFF/, "");
const json = path => JSON.parse(read(path));
const hash = path => crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex");
const file = path => ({ path, sha256: hash(path), bytes: fs.statSync(path).size });
const result = path => {
  const match = /### Result\s*([\s\S]*?)\r?\n### Ran Playwright code/.exec(read(path));
  assert(match, `No completed browser result in ${path}`);
  return JSON.parse(match[1].trim());
};
const captured = json("output/playwright/riverbend-world-checked-sources.json");
for (const [path, expected] of Object.entries(captured.sources)) assert.equal(hash(path), expected, `Browser source changed: ${path}`);
const routeFolder = read("output/playwright/riverbend-current-route-run.txt").trim();
const routeIds = ["cafe", "books", "police", "station", "post", "inn", "bridge"];
const routes = routeIds.map(id => {
  const path = `${routeFolder}/${id}.log`;
  const value = result(path);
  assert.equal(value.failure, null, `${id} route failed`);
  assert.equal(value.start.timeOrigin, value.end.timeOrigin, `${id} page reloaded during its walk`);
  assert(Math.hypot(value.end.position[0], value.end.position[1] + 7) < .4, `${id} did not return by keyboard`);
  if (id !== "bridge") assert(value.actions.some(action => action.action === "observed-place" && action.modalPaused && action.text.includes("遇见")));
  return { id, passed: true, evidence: file(path), observations: value.actions.filter(action => action.action === "observed-place"), renderer: value.renderer };
});
const recoveryPath = "output/playwright/riverbend-world-recovery.log";
const tabsPath = "output/playwright/riverbend-reload-offline-tabs.log";
const mobilePath = "output/playwright/riverbend-current-mobile.log";
const recovery = result(recoveryPath), tabs = result(tabsPath), mobile = result(mobilePath);
assert(recovery.passed && tabs.passed && mobile.passed);
assert.equal(recovery.noon.remembered, 12);
assert.equal(recovery.noonVisibleActorIds.length, 4);
assert(recovery.drops.every(drop => drop.replayed && drop.committed.worldRevision === drop.recovered.worldRevision && drop.committed.time === drop.recovered.time));
assert(recovery.legacyReads.every(read => read.status === 404));
assert.equal(tabs.staleTab.status, 409);
assert.deepEqual(tabs.cafeReload.before, tabs.cafeReload.after);
assert.equal(mobile.errors.length + mobile.warnings.length + mobile.unexplainedRequests.length, 0);
const receipts = ["exploration-engine-review.json", "daily-routine-review.json", "session-review.json"].map(name => {
  const path = folder + name, value = json(path);
  assert(value.passed, `${name} has not passed`);
  for (const [source, expected] of Object.entries(value.sources || value.sourceFiles || {})) assert.equal(hash(source), expected, `${name} source changed: ${source}`);
  return file(path);
});
const typecheckPath = "output/playwright/riverbend-world-typecheck.json";
assert.equal(json(typecheckPath).exitCode, 0);
const oldBrowser = json(folder + "browser-review-v2.json");
const overwrittenPath = "output/playwright/riverbend-tour-cafe.png";
const screenshots = [
  ...routeIds.filter(id => id !== "bridge").map(id => `output/playwright/riverbend-current-tour-${id}.png`),
  "output/playwright/riverbend-world-bridge-overview.png",
  ...["midday-journal", "midday-plaza", "lost-response-retry", "lost-response-reload", "cafe-restored", "cafe-people", "phone-welcome", "phone-explore", "phone-people", "phone-overview"].map(name => `output/playwright/riverbend-current-${name}.png`)
].map(file);
const report = {
  schema: "riverbend-browser-review.v3", reviewedAt: new Date().toISOString(),
  status: "resident-exploration-functional-pass-full-game-open",
  scope: "Local Next development server, real SQLite saves and deterministic engine. Six-place walking, observed resident bodies, lunch changes, recovery and private API boundary. No complete case or new sustained-performance acceptance.",
  sourceFiles: captured.sources, sourceCapture: file("output/playwright/riverbend-world-checked-sources.json"),
  assetSha256: hash("public/assets/riverbend/v1/town.glb"), navigationSha256: hash("public/assets/riverbend/v1/navigation.json"),
  routeBatch: routes,
  midday: { time: recovery.noon.time, rememberedResidents: recovery.noon.remembered, visibleActorIds: recovery.noonVisibleActorIds, evidence: file(recoveryPath) },
  recovery: { responseLoss: recovery.drops, offlineAndCrossTab: tabs, evidence: [file(recoveryPath), file(tabsPath)] },
  privacy: { legacyReads: recovery.legacyReads, repositoryProtection: "Exploration worlds, events, cases and sessions require authenticated per-world server scope; legacy lists omit them. Concurrent scopes and cross-world identifiers tested in an isolated database." },
  phoneEmulation: { ...mobile, evidence: file(mobilePath) },
  runtimeErrors: { recoveryUnhandledErrors: recovery.errors, freshPhoneConsoleErrors: mobile.errors, freshPhoneWarnings: mobile.warnings, intentionalTransportFailures: recovery.intentionalFailures, note: "Offline fetch failures, aborted committed responses, old-tab 409 and denied legacy 404 are expected negative probes. Earlier development/HMR warnings are retained in historical logs, not counted as a clean run." },
  visualInspection: { performedBy: "agent", inspected: ["current cafe observation", "midday plaza", "midday journal", "revisited cafe", "phone welcome", "phone people", "phone overview"], findings: ["Desktop journal and mobile single-column witnesses are readable and scroll inside their panel.", "390px viewport has no horizontal overflow; overview place buttons remain visible.", "Residents remain simple original models placed at observed locations; arranged lines and lack of walk transitions still look staged.", "Browser light is fixed daytime even if simulation time advances; night art is not accepted."] },
  supportingReceipts: receipts, typecheck: { ...json(typecheckPath), evidence: file(typecheckPath) }, screenshots,
  historicalBaseline: {
    browser: file(folder + "browser-review-v2.json"), performance: file(folder + "performance-review.json"),
    isCurrentPerformanceEvidence: false,
    scope: "The earlier 16.8/33.5 ms development exterior measurements predate authoritative residents and saves. Retained as history; current full-game sustained tests remain necessary.",
    unavailableOriginalScreenshot: { path: overwrittenPath, expectedOldSha256: oldBrowser.screenshots[overwrittenPath].sha256, currentSha256: hash(overwrittenPath), reason: "The early world-integration cafe probe reused this old filename. Original v2 screenshot pixels cannot be certified from this path. Raw performance recordings were not overwritten." }
  },
  retainedFailures: [
    "outputs/riverbend-world-browser-cafe.log", "outputs/riverbend-world-browser-cafe-fixed.log",
    "outputs/riverbend-world-browser-1791432449407/south-arrival.log"
  ].filter(path => fs.existsSync(path)).map(file),
  instrumentationNote: "output/playwright/riverbend-cafe-reload.log retains a reused trailing 'returned-to-spawn' label although its coordinates are the cafe. That label is not evidence of a return. Cafe refresh is independently checked in riverbend-reload-offline-tabs.log.",
  remaining: ["Complete original case and certified investigation actions", "Resident walking/idle presentation, roof occlusion and interior transitions", "Day/night art and final regional art decision", "Independent novel workflow and shared locked facts with 6-8 chapters", "Production build and 10-minute sustained full-game performance", "Physical target-device scope and later human art/reader review"],
  wholeGoalComplete: false
};
fs.writeFileSync(folder + "browser-review-v3.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ passed: true, routes: routes.length, noonWitnesses: report.midday.visibleActorIds.length, rememberedResidents: 12, recoveryProbes: 5, phoneScope: "emulation only", wholeGoalComplete: false }));
