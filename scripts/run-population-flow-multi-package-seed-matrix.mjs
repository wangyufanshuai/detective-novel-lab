import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { populationMatrixRows } from "./lib/population-flow-receipt-contract.mjs";

const root = process.cwd();

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const ticks = Math.max(100, Math.floor(Number(argValue("ticks", "1000"))));
const concurrency = Math.max(1, Math.min(4, Math.floor(Number(argValue("concurrency", "3")))));
const reuseExisting = argValue("reuse-existing", "false") === "true";
const requestedSeeds = argValue("seed-prefixes", "multi-package-seed-b,multi-package-seed-c")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
assert.ok(requestedSeeds.length > 0, "at least one seed prefix is required");
assert.ok(new Set(requestedSeeds).size === requestedSeeds.length, "seed prefixes must be unique");
for (const seedPrefix of requestedSeeds) {
  assert.match(seedPrefix, /^[a-z0-9._-]+$/i, `unsafe seed prefix ${seedPrefix}`);
}

const outputRoot = path.join(root, "outputs");

function seedSlug(seedPrefix) {
  return `-${seedPrefix.replace(/[^a-z0-9._-]+/gi, "-")}`;
}

function matrixOutputPath(seedPrefix) {
  return path.join(outputRoot, `population-flow-multi-package-fairness-${ticks}${seedSlug(seedPrefix)}.json`);
}

function runSeed(seedPrefix) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--expose-gc",
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "scripts/run-population-flow-multi-package-fairness.mjs",
        `--ticks=${ticks}`,
        `--concurrency=${concurrency}`,
        `--seed-prefix=${seedPrefix}`
      ],
      { cwd: root, stdio: ["ignore", "ignore", "pipe"] }
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${seedPrefix} matrix child exited with ${code}: ${stderr.trim()}`));
        return;
      }
      resolve();
    });
  });
}

const receipts = [];
for (const seedPrefix of requestedSeeds) {
  const outputPath = matrixOutputPath(seedPrefix);
  console.log(JSON.stringify({ event: "seed-start", seedPrefix, ticks }));
  if (!reuseExisting) {
    await fs.rm(outputPath, { force: true });
    await runSeed(seedPrefix);
  }
  const receipt = JSON.parse(await fs.readFile(outputPath, "utf8"));
  assert.equal(receipt.schema, "population-flow-multi-package-fairness.v1", `${seedPrefix} schema`);
  assert.equal(receipt.ticks, ticks, `${seedPrefix} ticks`);
  receipts.push({ seedPrefix, receipt, outputPath });
  console.log(JSON.stringify({
    event: "seed-complete",
    seedPrefix,
    packageCount: receipt.aggregate.packageCount,
    qualityRegressionCount: receipt.aggregate.qualityRegressionCount,
    firstActionWindowViolationCount: receipt.aggregate.firstActionWindowViolationCount,
    deterministicRepeatCount: receipt.aggregate.deterministicRepeatCount,
    structuralPassCount: receipt.aggregate.structuralPassCount
  }));
}

const packageRows = populationMatrixRows(receipts);

const aggregate = {
  seedCount: receipts.length,
  packageCount: packageRows.length,
  seedPackageCount: receipts.length * packageRows.length,
  deterministicRepeatCount: packageRows.reduce((sum, row) => sum + row.deterministicRepeatCount, 0),
  structuralPassCount: packageRows.reduce((sum, row) => sum + row.structuralPassCount, 0),
  qualityRegressionCount: packageRows.reduce((sum, row) => sum + row.qualityRegressionCount, 0),
  firstActionWindowViolationCount: packageRows.reduce((sum, row) => sum + row.firstActionWindowViolationCount, 0),
  enabledNewcomerCount: receipts.reduce((sum, entry) => sum + entry.receipt.aggregate.enabledNewcomerCount, 0),
  enabledTriggeredCaseCount: receipts.reduce((sum, entry) => sum + entry.receipt.aggregate.enabledTriggeredCaseCount, 0),
  enabledValidCandidateCount: receipts.reduce((sum, entry) => sum + entry.receipt.aggregate.enabledValidCandidateCount, 0),
  enabledValidEvidenceCoveredCount: receipts.reduce((sum, entry) => sum + entry.receipt.aggregate.enabledValidEvidenceCoveredCount, 0),
  zeroFlowPackageSeedCount: receipts.reduce((sum, entry) => sum + entry.receipt.aggregate.zeroFlowPackageIds.length, 0)
};

const matrix = {
  schema: "population-flow-multi-package-seed-matrix.v1",
  evidenceClass: "local-world-package-multi-seed-campaign",
  status: "candidate",
  fairnessGate: "pending-cross-seed-and-human-long-run-review",
  generatedAt: new Date().toISOString(),
  ticks,
  seedPrefixes: requestedSeeds,
  execution: {
    concurrency,
    childRunner: "population-flow-multi-package-fairness.v1",
    ordering: "sequential-seed-isolation",
    reusedExistingSeedReceipts: reuseExisting
  },
  seeds: receipts.map(({ seedPrefix, receipt, outputPath }) => ({
    seedPrefix,
    outputPath: path.relative(root, outputPath).replace(/\\/g, "/"),
    generatedAt: receipt.generatedAt,
    packageCount: receipt.aggregate.packageCount,
    validatedPackageCount: receipt.aggregate.validatedPackageCount,
    deterministicRepeatCount: receipt.aggregate.deterministicRepeatCount,
    structuralPassCount: receipt.aggregate.structuralPassCount,
    qualityRegressionCount: receipt.aggregate.qualityRegressionCount,
    firstActionWindowViolationCount: receipt.aggregate.firstActionWindowViolationCount,
    zeroFlowPackageIds: receipt.aggregate.zeroFlowPackageIds,
    enabledNewcomerCount: receipt.aggregate.enabledNewcomerCount,
    enabledTriggeredCaseCount: receipt.aggregate.enabledTriggeredCaseCount,
    enabledValidCandidateCount: receipt.aggregate.enabledValidCandidateCount,
    enabledValidEvidenceCoveredCount: receipt.aggregate.enabledValidEvidenceCoveredCount
  })),
  packages: packageRows,
  aggregate,
  boundaries: {
    realWorldPackageInput: true,
    syntheticSourceFixture: false,
    productionFairnessClaim: false,
    crossPackageSeedCoverage: `${receipts.length} seeds x ${packageRows.length} packages`,
    humanReview: "pending",
    acceptedAssetAndRuntimeReview: "pending"
  }
};

await fs.mkdir(outputRoot, { recursive: true });
const outputPath = path.join(outputRoot, `population-flow-multi-package-seed-matrix-${ticks}.json`);
await fs.writeFile(outputPath, `${JSON.stringify(matrix, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...matrix, outputPath }, null, 2));
