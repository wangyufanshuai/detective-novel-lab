import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ticks = Math.max(100, Math.floor(Number(process.argv.find((arg) => arg.startsWith("--ticks="))?.slice(8) || "1000")));
const receipt = JSON.parse(await readFile(
  path.join(root, "outputs", `population-flow-multi-package-seed-matrix-${ticks}.json`),
  "utf8"
));

assert.equal(receipt.schema, "population-flow-multi-package-seed-matrix.v1");
assert.equal(receipt.evidenceClass, "local-world-package-multi-seed-campaign");
assert.equal(receipt.status, "candidate");
assert.equal(receipt.fairnessGate, "pending-cross-seed-and-human-long-run-review");
assert.equal(receipt.ticks, ticks);
assert.ok(receipt.seedPrefixes.length >= 2, "matrix must cover at least two seed prefixes");
assert.equal(receipt.aggregate.seedCount, receipt.seedPrefixes.length);
assert.equal(receipt.aggregate.packageCount, 12);
assert.equal(receipt.aggregate.seedPackageCount, receipt.seedPrefixes.length * receipt.aggregate.packageCount);
assert.equal(receipt.aggregate.deterministicRepeatCount, receipt.aggregate.seedPackageCount);
assert.equal(receipt.aggregate.structuralPassCount, receipt.aggregate.seedPackageCount);
assert.equal(receipt.aggregate.qualityRegressionCount, 0);
assert.equal(receipt.aggregate.firstActionWindowViolationCount, 0);

const powerStation = receipt.packages.find((item) => item.id === "power-station-blackout-town");
assert.ok(powerStation, "power-station package is included in every seed");
assert.equal(powerStation.qualityRegressionCount, 0);
assert.equal(powerStation.firstActionWindowViolationCount, 0);
assert.equal(powerStation.deterministicRepeatCount, receipt.aggregate.seedCount);
assert.equal(powerStation.structuralPassCount, receipt.aggregate.seedCount);

for (const row of receipt.packages) {
  assert.equal(row.seedCount, receipt.aggregate.seedCount, `${row.id} seed coverage`);
  assert.equal(row.qualityRegressionCount, 0, `${row.id} quality regression`);
  assert.equal(row.firstActionWindowViolationCount, 0, `${row.id} first-action window`);
  assert.equal(row.deterministicRepeatCount, row.seedCount, `${row.id} deterministic repeat`);
  assert.equal(row.structuralPassCount, row.seedCount, `${row.id} structural pass`);
}

console.log(JSON.stringify({
  ok: true,
  suite: "population-flow-multi-package-seed-matrix-receipts",
  seedPrefixes: receipt.seedPrefixes,
  ticks: receipt.ticks,
  seedPackageCount: receipt.aggregate.seedPackageCount,
  qualityRegressionCount: receipt.aggregate.qualityRegressionCount,
  powerStationQualityRegressionCount: powerStation.qualityRegressionCount
}));
