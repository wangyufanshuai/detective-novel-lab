import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const packageId = "dock-court-market-town";
const expectedTicks = [100, 1000, 5000];

for (const ticks of expectedTicks) {
  const file = path.join(root, "outputs", `population-flow-campaign-fairness-${packageId}-${ticks}.json`);
  const receipt = JSON.parse(await readFile(file, "utf8"));
  assert.equal(receipt.schema, "population-flow-campaign-fairness.v1", `${ticks} schema`);
  assert.equal(receipt.evidenceClass, "local-world-package-campaign", `${ticks} evidence class`);
  assert.equal(receipt.status, "candidate", `${ticks} status`);
  assert.equal(receipt.fairnessGate, "pending-human-and-long-run-review", `${ticks} fairness gate remains pending`);
  assert.equal(receipt.ticks, ticks, `${ticks} tick count`);
  assert.equal(receipt.package.id, packageId, `${ticks} package identity`);
  assert.equal(receipt.package.validationOk, true, `${ticks} package validation`);
  assert.match(receipt.package.sourceContentHash, /^[a-f0-9]{64}$/, `${ticks} source package hash`);
  assert.match(receipt.package.selectedPackageHash, /^h[a-z0-9]+$/, `${ticks} selected package hash`);
  assert.equal(receipt.boundaries.realWorldPackageInput, true, `${ticks} real package input`);
  assert.equal(receipt.boundaries.syntheticSourceFixture, false, `${ticks} synthetic fixture boundary`);
  assert.equal(receipt.boundaries.productionFairnessClaim, false, `${ticks} production claim boundary`);
  assert.equal(receipt.deterministicRepeat, true, `${ticks} deterministic repeat`);
  assert.equal(receipt.structuralPass, true, `${ticks} structural pass`);
  assert.equal(receipt.policy.newcomerFirstActionWindowTicks, 24, `${ticks} newcomer first-action window`);

  for (const lane of [receipt.baseline, receipt.enabled]) {
    assert.equal(lane.ticks, ticks, `${ticks} lane ticks`);
    assert.ok(lane.runtimeMs > 0, `${ticks} runtime receipt`);
    assert.equal(lane.structural.duplicateNpcIds, 0, `${ticks} duplicate NPC ids`);
    assert.equal(lane.structural.duplicateEventIds, 0, `${ticks} duplicate event ids`);
    assert.equal(lane.structural.duplicateFlowIds, 0, `${ticks} duplicate flow ids`);
    assert.equal(lane.structural.duplicateArrivalIds, 0, `${ticks} duplicate arrival ids`);
    assert.equal(lane.structural.duplicateSourceIds, 0, `${ticks} duplicate source ids`);
    assert.equal(lane.structural.missingSourceEvents, 0, `${ticks} missing source events`);
    assert.equal(lane.structural.missingArrivalEvents, 0, `${ticks} missing arrival events`);
    assert.equal(lane.structural.sourceNotBacked, 0, `${ticks} source provenance`);
    assert.equal(lane.structural.arrivalSourceLinkMismatch, 0, `${ticks} arrival provenance`);
    assert.equal(lane.structural.orphanNewcomers, 0, `${ticks} newcomer linkage`);
    assert.equal(lane.structural.firstActionReceiptMismatch, 0, `${ticks} durable first-action receipt`);
    assert.equal(lane.structural.overResidentCap, false, `${ticks} resident cap`);
    assert.equal(lane.populationFlowSourceCoverage, 1, `${ticks} source coverage`);
    assert.equal(lane.firstActionObservedCount + lane.firstActionMissingCount, lane.newcomerCount, `${ticks} first action accounting`);
    assert.equal(lane.firstActionLedgerCount, lane.firstActionObservedCount, `${ticks} first-action ledger count`);
    assert.ok(lane.sourceBackedIncidentCount > 0, `${ticks} source-backed incidents`);
    assert.ok(lane.candidate.validCandidateCount >= 0, `${ticks} candidate receipt`);
    assert.ok(lane.validCaseEvidenceCoverage >= 0 && lane.validCaseEvidenceCoverage <= 1, `${ticks} evidence coverage range`);
  }
  assert.equal(receipt.baseline.enabled, false, `${ticks} baseline disabled`);
  assert.equal(receipt.enabled.enabled, true, `${ticks} enabled lane`);
  assert.equal(receipt.baseline.newcomerCount, 0, `${ticks} baseline has no population flow`);
  assert.equal(receipt.baseline.population, receipt.baseline.authoredPopulation, `${ticks} baseline population`);
  assert.ok(receipt.enabled.newcomerCount > 0, `${ticks} enabled creates source-backed residents`);
  assert.ok(receipt.enabled.population <= receipt.policy.maxResidents, `${ticks} enabled respects resident cap`);
  assert.equal(receipt.enabled.firstActionMissingCount, 0, `${ticks} every newcomer gets a first action`);
  assert.ok(receipt.enabled.firstActionLatencies.every((latency) => latency <= receipt.policy.newcomerFirstActionWindowTicks), `${ticks} first actions stay inside the bounded window`);
  assert.notEqual(receipt.baseline.digest, receipt.enabled.digest, `${ticks} policy lanes have distinct digests`);
  assert.equal(receipt.comparison.reviewRequired, true, `${ticks} review boundary`);
}

console.log(JSON.stringify({
  ok: true,
  suite: "population-flow-campaign-fairness-receipts",
  packageId,
  ticks: expectedTicks,
  evidenceClass: "local-world-package-campaign",
  status: "candidate",
  fairnessGate: "pending-human-and-long-run-review"
}));
