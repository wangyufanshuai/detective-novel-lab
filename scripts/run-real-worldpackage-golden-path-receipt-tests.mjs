import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const packageId = "dock-court-market-town";
const file = path.join(root, "outputs", `worldpackage-golden-investigation-path-${packageId}.json`);
const receipt = JSON.parse(await fs.readFile(file, "utf8"));

assert.equal(receipt.schema, "worldpackage-golden-investigation-path.v1");
assert.equal(receipt.evidenceClass, "local-world-package-campaign");
assert.equal(receipt.status, "candidate");
assert.equal(receipt.humanGate, "pending-human-comprehension-and-ui-review");
assert.equal(receipt.package.id, packageId);
assert.equal(receipt.package.validationOk, true);
assert.match(receipt.package.sourceContentHash, /^[a-f0-9]{64}$/);
assert.ok(receipt.package.selectedPackageHash);
assert.equal(receipt.boundaries.realWorldPackageInput, true);
assert.equal(receipt.boundaries.syntheticSourceFixture, false);
assert.equal(receipt.boundaries.productionInvestigationClaim, false);
assert.equal(receipt.execution.ticks >= 60, true);
assert.ok(receipt.execution.selectedCandidateId);
assert.ok(receipt.execution.selectedCaseId);
assert.ok(receipt.execution.selectedReplayDigest);

assert.equal(receipt.candidate.valid, true);
assert.equal(receipt.activeCase.validationValid, true);
assert.equal(receipt.activeCase.quality.worldBackedEvidence, true);
assert.equal(receipt.activeCase.quality.memoryScopedTestimony, true);
assert.equal(receipt.activeCase.quality.nonCulpritExcluded, true);
assert.equal(receipt.activeCase.quality.timeline24hComplete, true);
assert.equal(receipt.sourceResolution.complete, true);
assert.equal(receipt.sourceResolution.sourceEventCount > 0, true);
assert.equal(receipt.sourceResolution.memorySourceCount > 0, true);
assert.equal(receipt.sourceResolution.observationSourceCount > 0, true);
assert.equal(receipt.sourceResolution.observationResolution, "live-or-persisted-memory-link");
assert.equal(receipt.sourceResolution.memoryLinkedObservationCount >= receipt.sourceResolution.observationSourceCount, true);
assert.equal(receipt.views.playerIntake.route.playable, true);
assert.equal(receipt.views.playerIntake.route.routeCertified, true);
assert.equal(receipt.views.reviewRoom.integrity.traceable, true);
assert.equal(receipt.views.playerRoom.integrity.sourceEventsResolved, true);
assert.equal(receipt.views.solvedIntake.progress.solved, true);
assert.equal(receipt.views.solvedRoom.sourceEventCount > 0, true);
assert.equal(receipt.autoSolve.passed, true);
assert.equal(receipt.autoSolve.summary.proofCoverageComplete, true);
assert.equal(receipt.masking.complete, true);
assert.equal(receipt.masking.unsolvedSourceEventCount, 0);
assert.equal(receipt.masking.unsolvedTriggerId, undefined);
assert.equal(receipt.masking.playerTrailLeaks, 0);
assert.deepEqual(receipt.masking.leakedSourceEventIds, []);
assert.equal(receipt.masking.culpritLeak, false);
assert.equal(receipt.deterministicRepeat, true);

console.log(JSON.stringify({
  ok: true,
  suite: "real-worldpackage-golden-path-receipts",
  schema: receipt.schema,
  packageId,
  selectedCaseId: receipt.execution.selectedCaseId,
  sourceEventCount: receipt.sourceResolution.sourceEventCount,
  memorySourceCount: receipt.sourceResolution.memorySourceCount,
  observationSourceCount: receipt.sourceResolution.observationSourceCount,
  routeCertified: receipt.views.reviewRoom.integrity.routeCertified,
  autoSolve: receipt.autoSolve.passed,
  masking: receipt.masking.complete,
  deterministicRepeat: receipt.deterministicRepeat
}));
