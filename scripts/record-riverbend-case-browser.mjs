import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const log = "output/playwright/riverbend-case-desktop.log";
const sourcesPath = "output/playwright/riverbend-case-checked-sources.json";
const resultLine = fs.readFileSync(log, "utf8").split(/\r?\n/).find(line => line.startsWith('{"status":'));
assert(resultLine, "No actual browser result found");
const result = JSON.parse(resultLine);
assert.equal(result.status, "passed");
assert.deepEqual(result.failures, []); assert.deepEqual(result.errors, []); assert.deepEqual(result.warnings, []);
assert.equal(new Set(result.steps.filter(s => s.name.startsWith("walk-")).map(s => s.sceneId)).size, 6);
assert(result.steps.some(s => s.name === "case-solved" && s.solved && s.clues === 8));
assert(result.steps.some(s => s.name === "draft-survived-reload" && !s.solved));
assert(result.steps.some(s => s.name === "phone-emulated-case-book" && !s.errors.length && s.layouts.every(l => l.dialog === l.dialogScroll && l.scroll === l.viewport)));
assert.equal(result.requests.filter(r => r.kind === "case-submit").length, 3);
const sources = JSON.parse(fs.readFileSync(sourcesPath, "utf8"));
for (const [file, expected] of Object.entries(sources)) assert.equal(hash(file), expected, `Browser evidence is stale: ${file}`);
const retained = fs.mkdtempSync("output/playwright/riverbend-case-review-");
const preserve = file => {
  const target = path.join(retained, path.basename(file)).replaceAll("\\", "/");
  fs.copyFileSync(file, target);
  return { path: target, sha256: hash(target), bytes: fs.statSync(target).size };
};
const report = {
  schema: "riverbend-browser-review.v4", reviewedAt: new Date().toISOString(), status: "authored-first-case-functional-pass-full-goal-open",
  scope: "Local Next development build. Real keyboard street travel, original authored nonfatal case, owned SQLite authority and player UI. No new 3D art, production/performance or physical-device acceptance.",
  sourceFiles: sources, sourceCapture: preserve(sourcesPath), rawLog: preserve(log), runner: preserve("output/playwright/riverbend-case-desktop.js"),
  screenshots: result.shots.map(preserve),
  result,
  checks: { sixLocationsWalked: true, eightCluesDiscovered: true, initialStatementsHeard: true, twoSpecificEvidenceChallenges: true, evidenceOnlySubmissionRejected: true, wrongSuspectRejected: true, completeTheoryAccepted: true, draftAndAssignmentsSurviveReload: true, solvedCaseAndClockSurviveReload: true, phoneCaseBookNoHorizontalOverflow: true, browserErrors: 0, browserWarnings: 0 },
  additionalEvidence: { engineAndStorage: "case-review.json", sessionAndPrivacy: "session-review.json", earlierExplorationAndRecovery: "browser-review-v3.json", historicalExteriorPerformance: "performance-review.json" },
  retainedFailedRuns: [preserve("output/playwright/riverbend-case-desktop-event-collision.log"), preserve("output/playwright/riverbend-case-desktop-label-lookup.log")],
  corrections: ["World-scoped event identities prevent same-seed saves from colliding; old history and legacy replay IDs stay intact.", "Case analysis uses the daily world's declared road minutes, with explicit impossible-journey negative checks.", "Stable control names, visible dialogue responses and a sticky close button improve book interaction."],
  limitations: ["Original authored case; not an emergent agent-generated crime or independent literary review.", "Clues and dialogue are accessed at building entrances; walkable interiors are unfinished.", "Station retrieval requires the clerk to be co-located; other places expose static recorded sources.", "Current town window is 24 story hours; resident walking transitions and night art remain unfinished.", "Mobile is browser emulation. No physical mobile, production bundle or sustained full-game performance approval.", "Frozen private case facts carry a revision and SHA-256; novel workflow integration and 6-8 chapters remain open.", "Failed-run logs are retained. The shared failure screenshot was overwritten by the later label-lookup failure and is not used as proof of the first failure."],
  gates: { candidateCaseFunction: true, humanArtApproved: false, humanPlayerApproved: false, physicalDeviceApproved: false, currentSustainedPerformanceApproved: false, novelWorkflowComplete: false }
};
fs.writeFileSync("docs/3d-town/riverbend-v1/browser-review-v4.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: report.status, retained, screenshots: report.screenshots.length, checkedSourceFiles: Object.keys(sources).length }));
