import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { readWorldPackageSource } from "../lib/world-package-catalog.ts";
import { assertPopulationQualityComparison, populationFirstActionViolation } from "./lib/population-flow-receipt-contract.mjs";

const root = process.cwd();

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const ticks = Math.max(100, Math.floor(Number(argValue("ticks", "1000"))));
const concurrency = Math.max(1, Math.min(4, Math.floor(Number(argValue("concurrency", "3")))));
const seedPrefix = argValue("seed-prefix", "");
const seedSlug = seedPrefix ? `-${seedPrefix.replace(/[^a-z0-9._-]+/gi, "-")}` : "";
const requestedPackages = argValue("packages", "all");
const worldPacksRoot = path.join(root, "world-packs");
const outputRoot = path.join(root, "outputs");

const packageIds = requestedPackages === "all"
  ? (await fs.readdir(worldPacksRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
  : requestedPackages.split(",").map((value) => value.trim()).filter(Boolean);
assert.ok(packageIds.length > 0, "at least one WorldPackage is required");
for (const packageId of packageIds) assert.match(packageId, /^[a-z0-9._-]+$/i, `unsafe package id ${packageId}`);

const sources = packageIds.map((packageId) => readWorldPackageSource(packageId, root));
for (const source of sources) {
  assert.ok(source, "WorldPackage source must exist");
  assert.equal(source.validation.ok, true, `${source.packageId} validation failed: ${source.validation.errors.join("; ")}`);
}

function childOutputPath(packageId) {
  return path.join(outputRoot, `population-flow-campaign-fairness-${packageId}-${ticks}${seedSlug}.json`);
}

function runPackage(packageId) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--expose-gc",
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "scripts/run-population-flow-campaign-fairness.mjs",
        `--package=${packageId}`,
        `--ticks=${ticks}`,
        `--runtime-namespace=population-flow-campaign-fairness-${packageId}-${process.pid}`,
        `--output-suffix=${seedSlug}`,
        ...(seedPrefix ? [`--seed=${seedPrefix}:${packageId}`] : [])
      ],
      { cwd: root, stdio: ["ignore", "ignore", "pipe"] }
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${packageId} runner exited with ${code}: ${stderr.trim()}`));
        return;
      }
      resolve(packageId);
    });
  });
}

const completed = [];
let nextIndex = 0;
async function worker() {
  while (nextIndex < packageIds.length) {
    const packageId = packageIds[nextIndex++];
    console.log(JSON.stringify({ event: "package-start", packageId, ticks }));
    await fs.rm(childOutputPath(packageId), { force: true });
    await runPackage(packageId);
    const receipt = JSON.parse(await fs.readFile(childOutputPath(packageId), "utf8"));
    assert.equal(receipt.schema, "population-flow-campaign-fairness.v1", `${packageId} child schema`);
    completed.push(receipt);
    console.log(JSON.stringify({ event: "package-complete", packageId, newcomerCount: receipt.enabled.newcomerCount, validCandidateCount: receipt.enabled.candidate.validCandidateCount, deterministicRepeat: receipt.deterministicRepeat }));
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, packageIds.length) }, () => worker()));
completed.sort((left, right) => left.package.id.localeCompare(right.package.id));

const qualityRegressions = completed.filter((receipt) => (
  assertPopulationQualityComparison({
    id: receipt.package.id,
    baseline: { ...receipt.baseline.candidate, validCaseEvidenceCoverage: receipt.baseline.validCaseEvidenceCoverage },
    enabled: { ...receipt.enabled.candidate, validCaseEvidenceCoverage: receipt.enabled.validCaseEvidenceCoverage },
    comparison: receipt.comparison
  }).qualityRegression
));
const firstActionWindowViolations = completed.filter((receipt) => (
  populationFirstActionViolation(receipt)
));
const structuralFailures = completed.filter((receipt) => receipt.structuralPass !== true || receipt.enabled.structuralPass === false);
const deterministicFailures = completed.filter((receipt) => receipt.deterministicRepeat !== true);
const runtimeMultipliers = completed.map((receipt) => receipt.comparison.runtimeMultiplier).filter((value) => Number.isFinite(value));
const aggregate = {
  packageCount: completed.length,
  validatedPackageCount: completed.filter((receipt) => receipt.package.validationOk === true).length,
  deterministicRepeatCount: completed.length - deterministicFailures.length,
  structuralPassCount: completed.length - structuralFailures.length,
  qualityRegressionCount: qualityRegressions.length,
  firstActionWindowViolationCount: firstActionWindowViolations.length,
  enabledNewcomerCount: completed.reduce((sum, receipt) => sum + receipt.enabled.newcomerCount, 0),
  enabledTriggeredCaseCount: completed.reduce((sum, receipt) => sum + receipt.enabled.triggeredCaseCount, 0),
  enabledValidCandidateCount: completed.reduce((sum, receipt) => sum + receipt.enabled.candidate.validCandidateCount, 0),
  enabledValidEvidenceCoveredCount: completed.reduce((sum, receipt) => sum + receipt.enabled.candidate.validEvidenceCoveredCount, 0),
  zeroFlowPackageIds: completed.filter((receipt) => receipt.enabled.newcomerCount === 0).map((receipt) => receipt.package.id),
  maxRuntimeMultiplier: runtimeMultipliers.length ? Math.max(...runtimeMultipliers) : null,
  minRuntimeMultiplier: runtimeMultipliers.length ? Math.min(...runtimeMultipliers) : null,
  sourcePackageHashes: completed.map((receipt) => receipt.package.sourceContentHash).sort()
};

const receipt = {
  schema: "population-flow-multi-package-fairness.v1",
  evidenceClass: "local-world-package-multi-package-campaign",
  status: "candidate",
  fairnessGate: "pending-cross-package-seed-and-human-long-run-review",
  generatedAt: new Date().toISOString(),
  ticks,
  seedPolicy: { prefix: seedPrefix || null, perPackage: Boolean(seedPrefix) },
  execution: { concurrency, childRunner: "population-flow-campaign-fairness.v1" },
  packages: completed.map((child) => ({
    id: child.package.id,
    version: child.package.version,
    sourceContentHash: child.package.sourceContentHash,
    selectedPackageHash: child.package.selectedPackageHash,
    validationOk: child.package.validationOk,
    receiptPath: path.relative(root, childOutputPath(child.package.id)).replace(/\\/g, "/"),
    baseline: {
      population: child.baseline.population,
      triggeredCaseCount: child.baseline.triggeredCaseCount,
      sourceBackedIncidentCount: child.baseline.sourceBackedIncidentCount,
      validCandidateCount: child.baseline.candidate.validCandidateCount,
      peakValidCandidateCount: child.baseline.candidate.peakValidCandidateCount,
      validCaseEvidenceCoverage: child.baseline.validCaseEvidenceCoverage,
      peakValidEvidenceCoveredCount: child.baseline.candidate.peakValidEvidenceCoveredCount,
      digest: child.baseline.digest
    },
    enabled: {
      population: child.enabled.population,
      newcomerCount: child.enabled.newcomerCount,
      triggeredCaseCount: child.enabled.triggeredCaseCount,
      sourceBackedIncidentCount: child.enabled.sourceBackedIncidentCount,
      validCandidateCount: child.enabled.candidate.validCandidateCount,
      peakValidCandidateCount: child.enabled.candidate.peakValidCandidateCount,
      validEvidenceCoveredCount: child.enabled.candidate.validEvidenceCoveredCount,
      peakValidEvidenceCoveredCount: child.enabled.candidate.peakValidEvidenceCoveredCount,
      validCaseEvidenceCoverage: child.enabled.validCaseEvidenceCoverage,
      firstActionMissingCount: child.enabled.firstActionMissingCount,
      firstActionLatencies: child.enabled.firstActionLatencies,
      digest: child.enabled.digest
    },
    policy: {
      newcomerFirstActionWindowTicks: child.policy.newcomerFirstActionWindowTicks
    },
    comparison: {
      validCandidateDelta: child.comparison.validCandidateDelta,
      validEvidenceCoveredCandidateDelta: child.comparison.validEvidenceCoveredCandidateDelta,
      evidenceCoverageDelta: child.comparison.evidenceCoverageDelta,
      qualityRegression: child.comparison.qualityRegression
    },
    deterministicRepeat: child.deterministicRepeat,
    structuralPass: child.structuralPass,
    runtimeMultiplier: child.comparison.runtimeMultiplier
  })),
  aggregate,
  boundaries: {
    realWorldPackageInput: true,
    syntheticSourceFixture: false,
    productionFairnessClaim: false,
    crossPackageSeedCoverage: "one-deterministic-seed-per-package",
    humanReview: "pending",
    acceptedAssetAndRuntimeReview: "pending"
  }
};

await fs.mkdir(outputRoot, { recursive: true });
const outputPath = path.join(outputRoot, `population-flow-multi-package-fairness-${ticks}${seedSlug}.json`);
await fs.writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...receipt, outputPath }, null, 2));
