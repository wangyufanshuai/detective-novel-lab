import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertPopulationPackageSummary } from "./lib/population-flow-receipt-contract.mjs";

const root = process.cwd();
const ticks = 1000;
const receipt = JSON.parse(await readFile(path.join(root, "outputs", `population-flow-multi-package-fairness-${ticks}.json`), "utf8"));

assert.equal(receipt.schema, "population-flow-multi-package-fairness.v1");
assert.equal(receipt.evidenceClass, "local-world-package-multi-package-campaign");
assert.equal(receipt.status, "candidate");
assert.equal(receipt.fairnessGate, "pending-cross-package-seed-and-human-long-run-review");
assert.equal(receipt.ticks, ticks);
assert.equal(receipt.boundaries.realWorldPackageInput, true);
assert.equal(receipt.boundaries.syntheticSourceFixture, false);
assert.equal(receipt.boundaries.productionFairnessClaim, false);
assert.equal(receipt.boundaries.crossPackageSeedCoverage, "one-deterministic-seed-per-package");
assertPopulationPackageSummary(receipt);
assert.ok(receipt.aggregate.packageCount >= 12, "all checked-in WorldPackages must be included");
assert.equal(receipt.aggregate.validatedPackageCount, receipt.aggregate.packageCount);
assert.equal(receipt.aggregate.deterministicRepeatCount, receipt.aggregate.packageCount);
assert.equal(receipt.aggregate.structuralPassCount, receipt.aggregate.packageCount);
assert.equal(receipt.aggregate.qualityRegressionCount, 0);
assert.equal(receipt.aggregate.firstActionWindowViolationCount, 0);
assert.equal(new Set(receipt.aggregate.sourcePackageHashes).size, receipt.aggregate.packageCount);

for (const item of receipt.packages) {
  assert.equal(item.validationOk, true, `${item.id} package validation`);
  assert.match(item.sourceContentHash, /^[a-f0-9]{64}$/, `${item.id} source hash`);
  assert.match(item.selectedPackageHash, /^h[a-z0-9]+$/, `${item.id} selected hash`);
  assert.equal(item.deterministicRepeat, true, `${item.id} deterministic repeat`);
  assert.equal(item.structuralPass, true, `${item.id} structural pass`);
  assert.equal(typeof item.comparison?.qualityRegression, "boolean", `${item.id} explicit quality comparison`);
  assert.equal(item.policy?.newcomerFirstActionWindowTicks, 24, `${item.id} first-action policy`);
  assert.ok(item.enabled.newcomerCount > 0 || item.enabled.triggeredCaseCount === 0, `${item.id} newcomer flow is absent despite triggered cases`);
  assert.equal(item.enabled.firstActionMissingCount, 0, `${item.id} first action completeness`);
  assert.ok(item.enabled.firstActionLatencies.every((latency) => latency <= 24), `${item.id} first action window`);
  assert.ok(item.enabled.validCaseEvidenceCoverage >= item.baseline.validCaseEvidenceCoverage, `${item.id} evidence coverage regression`);
  assert.ok(item.enabled.validCandidateCount >= item.baseline.validCandidateCount, `${item.id} candidate regression`);
  assert.match(item.receiptPath, /^outputs\/population-flow-campaign-fairness-.+-1000\.json$/);
}

console.log(JSON.stringify({
  ok: true,
  suite: "population-flow-multi-package-fairness-receipts",
  schema: receipt.schema,
  ticks: receipt.ticks,
  packageCount: receipt.aggregate.packageCount,
  enabledNewcomerCount: receipt.aggregate.enabledNewcomerCount,
  qualityRegressionCount: receipt.aggregate.qualityRegressionCount,
  fairnessGate: receipt.fairnessGate
}));
