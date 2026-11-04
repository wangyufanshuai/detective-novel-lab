import assert from "node:assert/strict";

function count(value, label) {
  assert.ok(Number.isInteger(value) && value >= 0, `${label} must be a non-negative integer`);
  return value;
}

function coverage(value, label) {
  assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, `${label} must be a finite coverage ratio`);
  return value;
}

/** Recompute the campaign's existing quality gate; missing data cannot mean pass. */
export function populationQualityComparison(baseline, enabled) {
  for (const [label, lane] of [["baseline", baseline], ["enabled", enabled]]) {
    assert.ok(lane, `${label} lane is required`);
    count(lane.peakValidCandidateCount, `${label} peak candidates`);
    count(lane.peakValidEvidenceCoveredCount, `${label} peak evidence`);
    assert.ok(lane.peakValidEvidenceCoveredCount <= lane.peakValidCandidateCount, `${label} evidence exceeds candidates`);
    coverage(lane.validCaseEvidenceCoverage, `${label} final evidence coverage`);
  }
  return {
    validCandidateDelta: enabled.peakValidCandidateCount - baseline.peakValidCandidateCount,
    validEvidenceCoveredCandidateDelta: enabled.peakValidEvidenceCoveredCount - baseline.peakValidEvidenceCoveredCount,
    evidenceCoverageDelta: Number((enabled.peakValidEvidenceCoveredCount / Math.max(1, enabled.peakValidCandidateCount)
      - baseline.peakValidEvidenceCoveredCount / Math.max(1, baseline.peakValidCandidateCount)).toFixed(4)),
    qualityRegression: enabled.peakValidEvidenceCoveredCount < baseline.peakValidEvidenceCoveredCount
      || enabled.validCaseEvidenceCoverage < baseline.validCaseEvidenceCoverage
  };
}

export function assertPopulationQualityComparison(row) {
  assert.ok(row.comparison && typeof row.comparison.qualityRegression === "boolean", `${row.id}: explicit quality comparison is required`);
  const derived = populationQualityComparison(row.baseline, row.enabled);
  for (const [key, value] of Object.entries(derived)) {
    assert.equal(row.comparison[key], value, `${row.id}: inconsistent comparison.${key}`);
  }
  return derived;
}

export function populationFirstActionViolation(row) {
  const window = count(row.policy?.newcomerFirstActionWindowTicks, `${row.id} first-action window`);
  assert.ok(window > 0, `${row.id}: positive first-action window required`);
  count(row.enabled.firstActionMissingCount, `${row.id} missing first actions`);
  assert.ok(Array.isArray(row.enabled.firstActionLatencies), `${row.id}: first-action latencies required`);
  for (const value of row.enabled.firstActionLatencies) count(value, `${row.id} first-action latency`);
  assert.equal(row.enabled.firstActionMissingCount + row.enabled.firstActionLatencies.length,
    row.enabled.newcomerCount, `${row.id}: first-action coverage must account for every newcomer`);
  return row.enabled.firstActionMissingCount !== 0 || row.enabled.firstActionLatencies.some((value) => value > window);
}

export function assertPopulationPackageSummary(receipt) {
  assert.equal(receipt.schema, "population-flow-multi-package-fairness.v1");
  assert.ok(receipt.packages?.length > 0, "package rows required");
  assert.equal(new Set(receipt.packages.map((row) => row.id)).size, receipt.packages.length, "duplicate packages");
  let qualityRegressionCount = 0;
  let firstActionWindowViolationCount = 0;
  for (const row of receipt.packages) {
    qualityRegressionCount += Number(assertPopulationQualityComparison(row).qualityRegression);
    firstActionWindowViolationCount += Number(populationFirstActionViolation(row));
    assert.equal(typeof row.deterministicRepeat, "boolean", `${row.id}: deterministic result required`);
    assert.equal(typeof row.structuralPass, "boolean", `${row.id}: structural result required`);
  }
  for (const [key, value] of Object.entries({
    packageCount: receipt.packages.length,
    qualityRegressionCount,
    firstActionWindowViolationCount,
    deterministicRepeatCount: receipt.packages.filter((row) => row.deterministicRepeat).length,
    structuralPassCount: receipt.packages.filter((row) => row.structuralPass).length
  })) assert.equal(receipt.aggregate[key], value, `package aggregate.${key}`);
}

export function populationMatrixRows(entries) {
  assert.ok(entries.length > 0, "seed receipts required");
  assert.equal(new Set(entries.map((entry) => entry.seedPrefix)).size, entries.length, "duplicate seed receipts");
  const packageIds = entries[0].receipt.packages.map((row) => row.id).sort();
  for (const { seedPrefix, receipt } of entries) {
    assertPopulationPackageSummary(receipt);
    assert.equal(receipt.seedPolicy.prefix, seedPrefix, "seed identity mismatch");
    assert.deepEqual(receipt.packages.map((row) => row.id).sort(), packageIds, `${seedPrefix}: package set mismatch`);
    assert.equal(receipt.ticks, entries[0].receipt.ticks, `${seedPrefix}: tick scope mismatch`);
  }
  return packageIds.map((id) => {
    const seeds = entries.map(({ seedPrefix, receipt }) => {
      const item = receipt.packages.find((row) => row.id === id);
      return {
        seedPrefix,
        deterministicRepeat: item.deterministicRepeat,
        structuralPass: item.structuralPass,
        qualityRegression: item.comparison.qualityRegression,
        firstActionWindowViolation: populationFirstActionViolation(item),
        comparison: item.comparison,
        baselineValidCandidateCount: item.baseline.validCandidateCount,
        enabledValidCandidateCount: item.enabled.validCandidateCount,
        baselineEvidenceCoverage: item.baseline.validCaseEvidenceCoverage,
        enabledEvidenceCoverage: item.enabled.validCaseEvidenceCoverage,
        newcomerCount: item.enabled.newcomerCount,
        digest: item.enabled.digest
      };
    });
    return {
      id, seedCount: seeds.length,
      deterministicRepeatCount: seeds.filter((row) => row.deterministicRepeat).length,
      structuralPassCount: seeds.filter((row) => row.structuralPass).length,
      qualityRegressionCount: seeds.filter((row) => row.qualityRegression).length,
      firstActionWindowViolationCount: seeds.filter((row) => row.firstActionWindowViolation).length,
      seeds
    };
  });
}
