import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ticks = Math.max(100, Math.floor(Number(process.argv.find((arg) => arg.startsWith("--ticks="))?.slice(8) || "1000")));
const seedPrefix = process.argv.find((arg) => arg.startsWith("--seed-prefix="))?.slice(14) || "multi-package-seed-b";
const receipt = JSON.parse(await readFile(
  path.join(root, "outputs", `population-flow-multi-package-fairness-${ticks}-${seedPrefix}.json`),
  "utf8"
));

assert.equal(receipt.schema, "population-flow-multi-package-fairness.v1");
assert.equal(receipt.evidenceClass, "local-world-package-multi-package-campaign");
assert.equal(receipt.status, "candidate");
assert.equal(receipt.seedPolicy.prefix, seedPrefix);
assert.equal(receipt.seedPolicy.perPackage, true);
assert.equal(receipt.ticks, ticks);
assert.equal(receipt.aggregate.packageCount, 12);
assert.equal(receipt.aggregate.validatedPackageCount, 12);
assert.equal(receipt.aggregate.deterministicRepeatCount, 12);
assert.equal(receipt.aggregate.structuralPassCount, 12);
assert.equal(receipt.aggregate.qualityRegressionCount, 0);
assert.equal(receipt.aggregate.firstActionWindowViolationCount, 0);

const powerStation = receipt.packages.find((item) => item.id === "power-station-blackout-town");
assert.ok(powerStation, "the seed-sensitive power-station package is included");
assert.ok(powerStation.enabled.validCandidateCount >= powerStation.baseline.validCandidateCount, "population flow must not reduce valid candidates for the seed-sensitive package");
assert.ok(powerStation.enabled.validCaseEvidenceCoverage >= powerStation.baseline.validCaseEvidenceCoverage, "population flow must not reduce evidence coverage for the seed-sensitive package");

for (const item of receipt.packages) {
  assert.equal(item.deterministicRepeat, true, `${item.id} deterministic repeat`);
  assert.equal(item.structuralPass, true, `${item.id} structural pass`);
  assert.match(item.sourceContentHash, /^[a-f0-9]{64}$/, `${item.id} source hash`);
  assert.ok(item.enabled.firstActionLatencies.every((latency) => latency <= 24), `${item.id} first-action window`);
}

console.log(JSON.stringify({
  ok: true,
  suite: "population-flow-multi-package-seed-receipts",
  seedPrefix,
  ticks,
  packageCount: receipt.aggregate.packageCount,
  qualityRegressionCount: receipt.aggregate.qualityRegressionCount,
  powerStationValidCandidateCount: powerStation.enabled.validCandidateCount
}));
