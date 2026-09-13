import assert from "node:assert/strict";
import {
  alphaReportMarkdown,
  buildAlphaReport,
  buildCampaignEvidenceManifest,
  buildLongRunGateEvidence,
  classifyCandidateRejectionReason,
  createCandidateRejectionAccumulator,
  recordCandidateRejections,
  sha256Json,
  summarizeCandidateRejections,
  validateBrowserObservabilityEvidence,
  validateCampaignEvidenceManifest,
  validateGoldSliceBehaviorEvidence,
  validateGoldSliceVisibleCopyEvidence,
  validateLongRunGateEvidence
} from "./v11-alpha-evidence-lib.mjs";

assert.equal(classifyCandidateRejectionReason("missing real case trigger: no death or crime event has been written yet"), "trigger");
assert.equal(classifyCandidateRejectionReason("missing means stage: no resource or means-access event"), "means");
assert.equal(classifyCandidateRejectionReason("missing non-culprit exclusion seed"), "route-integrity");
assert.equal(classifyCandidateRejectionReason("missing evidence chain depth: fewer than three related evidence items"), "evidence-coverage");

const accumulator = createCandidateRejectionAccumulator();
const rejection = {
  id: "private-candidate-id",
  caseType: "signal-interception",
  validation: {
    valid: false,
    failureReasons: ["missing real case trigger: no death or crime event has been written yet"],
    errors: ["real case trigger missing: six-stage chain has not produced a death or crime event"]
  }
};
recordCandidateRejections(accumulator, { campaign: "midnight-chorus", route: "baseline", ordinal: 1, candidates: [rejection] });
recordCandidateRejections(accumulator, { campaign: "midnight-chorus", route: "baseline", ordinal: 1, candidates: [rejection] });
const summary = summarizeCandidateRejections(accumulator);
assert.equal(summary.total, 1, "deduplicates the same candidate/reason observation and prefers the stable failure-reason vocabulary");
assert.equal(summary.categories.find((item) => item.category === "trigger").count, 1);
assert.equal(summary.categories.find((item) => item.category === "trigger").reasonCount, 1);
assert.equal(summary.categories.find((item) => item.category === "trigger").examples[0].locator, "midnight-chorus/baseline/case-1/signal-interception");
assert.equal(JSON.stringify(summary).includes("private-candidate-id"), false, "safe rejection summary strips candidate ids");

const cases = Array.from({ length: 72 }, (_, index) => ({
  campaign: `campaign-${String(Math.floor(index / 6) + 1).padStart(2, "0")}`,
  route: index % 6 < 3 ? "baseline" : "counter-route",
  ordinal: (index % 3) + 1,
  durationMs: 10 + index,
  candidatePolls: 1,
  status: "automated-pass",
  safeSummary: "Certified route completed."
}));
const manifest = buildCampaignEvidenceManifest({
  suite: "seventy-two-case-campaign-playthrough",
  command: "npm.cmd run test:seventy-two-case-campaign -- --json",
  expectedCampaigns: 12,
  expectedRoutes: 24,
  expectedCases: 72,
  cases,
  candidateRejections: summary,
  candidateAttemptLimit: 14,
  stableRouteSuffixes: { "midnight-chorus/counter-route": "a" },
  generatedAt: "2026-09-02T00:00:00.000Z"
});
assert.equal(manifest.summary.status, "automated-pass");
assert.equal(manifest.summary.cases, 72);
assert.match(manifest.evidenceHash, /^[a-f0-9]{64}$/);
assert.equal(validateCampaignEvidenceManifest(manifest).status, "automated-pass");
assert.equal(validateCampaignEvidenceManifest({ ...manifest, evidenceHash: "tampered" }).status, "failed");

const browserEvidenceBody = {
  status: "automated-pass",
  summary: { entries: 12, passed: 12, failed: 0 },
  checks: Object.fromEntries(["network", "console", "overflow", "focus", "reducedMotion", "keyboard", "goldSlice"].map((check) => [check, { status: "automated-pass", summary: `${check} passed` }])),
  matrix: Array.from({ length: 12 }, () => ({ status: "automated-pass" })),
  goldSliceMatrix: Array.from({ length: 6 }, () => ({ status: "automated-pass" })),
  failures: []
};
const browserEvidence = {
  schema: "detective-town.v11-alpha-browser-observability.v1",
  generatedAt: "2026-09-02T00:00:00.000Z",
  ...browserEvidenceBody,
  evidenceHash: sha256Json(browserEvidenceBody)
};
assert.equal(validateBrowserObservabilityEvidence(browserEvidence).status, "automated-pass");
assert.equal(validateBrowserObservabilityEvidence({ ...browserEvidence, evidenceHash: "tampered" }).status, "failed");

const goldSliceBehaviorBody = {
  suite: "cinematic-deduction-gold-slice",
  scope: { campaign: "Midnight Chorus", route: "Public Reckoning", chapters: 3 },
  status: "automated-pass",
  checks: ["evidence-discovery-selection-exclusion", "claim-evidence-challenge-world-reaction", "rapid-action-restoration", "three-chapter-finale-recall", "theory-pressure-idempotence", "authority-isolation", "core-action-effect-contract"],
  coreActionEffects: { discover: ["cognition"], select: ["cognition"], exclude: ["cognition"], challenge: ["world"], "reject-theory": ["risk"], recover: ["world"], finale: ["cognition"] }
};
const goldSliceBehavior = {
  schema: "detective-town.v11-gold-slice-behavior-evidence.v1",
  generatedAt: "2026-09-02T00:00:00.000Z",
  ...goldSliceBehaviorBody,
  evidenceHash: sha256Json(goldSliceBehaviorBody)
};
assert.equal(validateGoldSliceBehaviorEvidence(goldSliceBehavior).status, "automated-pass");
assert.equal(validateGoldSliceBehaviorEvidence({ ...goldSliceBehavior, evidenceHash: "tampered" }).status, "failed");

const copyBody = {
  suite: "gold-slice-visible-copy", sourceHash: "source-version-a", ok: true,
  checks: 33, passed: 33, failed: 0, failures: [],
  results: Array.from({ length: 33 }, (_, index) => ({ label: `copy-${index}`, status: "automated-pass" }))
};
const copyEvidence = { schema: "detective-town.gold-slice-visible-copy.v1", generatedAt: "2026-09-06T00:00:00.000Z", ...copyBody, evidenceHash: sha256Json(copyBody) };
assert.equal(validateGoldSliceVisibleCopyEvidence(null, "source-version-a").status, "not-run");
assert.equal(validateGoldSliceVisibleCopyEvidence(copyEvidence, "source-version-a").status, "automated-pass");
assert.equal(validateGoldSliceVisibleCopyEvidence(copyEvidence, "source-version-b").status, "failed", "old copy evidence does not certify changed source");
assert.equal(validateGoldSliceVisibleCopyEvidence({ ...copyEvidence, evidenceHash: "tampered" }, "source-version-a").status, "failed");
const failedCopyBody = { ...copyBody, ok: false, passed: 32, failed: 1, failures: [{ label: "copy-0", status: "failed" }], results: copyBody.results.map((item, index) => index ? item : { ...item, status: "failed" }) };
const failedCopyEvidence = { ...copyEvidence, ...failedCopyBody, evidenceHash: sha256Json(failedCopyBody) };
assert.equal(validateGoldSliceVisibleCopyEvidence(failedCopyEvidence, "source-version-a").status, "failed", "valid failure evidence stays failed");
const heldCopyReport = buildAlphaReport({ gates: [{ phase: "gold-slice", ...validateGoldSliceVisibleCopyEvidence(failedCopyEvidence, "source-version-a") }], visibleCopyEvidence: { status: "failed", path: "outputs/v11-alpha/gold-slice-visible-copy.json" } });
assert.equal(heldCopyReport.promotionStatus, "held");
assert.match(alphaReportMarkdown(heldCopyReport), /gold-slice-visible-copy.json/);

const longRunEvidence = buildLongRunGateEvidence({
  command: "npm run gate:v11-long-run -- --json",
  minimumCaseCount: 30,
  maxRuntimeMsPerRun: 300000,
  generatedAt: "2026-09-02T00:00:00.000Z",
  runs: [5000, 10000].map((tickCount) => ({
    status: "automated-pass",
    tickCount,
    seed: `v11-alpha-long-run-${tickCount}`,
    minimumCaseCount: 30,
    runtimeMs: tickCount * 10,
    cases: 30,
    uniqueCases: 30,
    completeEvidenceCaseCount: 30,
    resolvedEvidenceCaseCount: 30,
    evidenceGraphWarnings: 0,
    deterministicRunHash: `fnv1a-${tickCount.toString(16)}`,
    artifactRunId: `campaign-v11-alpha-long-run-${tickCount}-${tickCount}`
  }))
});
assert.equal(validateLongRunGateEvidence(longRunEvidence).status, "automated-pass");
assert.equal(validateLongRunGateEvidence({ ...longRunEvidence, evidenceHash: "tampered" }).status, "failed");

const report = buildAlphaReport({
  release: "v11.1-alpha.1",
  baseline: { inheritedStages: 63, campaigns: 12, routes: 24, cases: 72, worldPackages: 12 },
  goldSliceBehaviorEvidence: {
    status: "automated-pass",
    path: "outputs/v11-alpha/gold-slice-behavior-evidence.json",
    generatedAt: goldSliceBehavior.generatedAt,
    evidenceHash: goldSliceBehavior.evidenceHash,
    checks: goldSliceBehavior.checks.length
  },
  candidateRejections: {
    status: "automated-pass",
    path: "outputs/v11-alpha/72-case-evidence-manifest.json",
    jsonPointer: "/candidateRejections",
    total: 1,
    categories: summary.categories
  },
  gates: [
    { phase: "alpha1", area: "playthrough", check: "72-case manifest", status: "automated-pass", summary: "72/72" },
    { area: "browser", check: "comprehension", status: "human-pending", summary: "0/5 sessions recorded" },
    { area: "browser", check: "motion", status: "unexpected", summary: "normalized to not-run" }
  ]
});
assert.equal(report.alphaEntryStatus, "automated-pass");
assert.equal(report.promotionStatus, "held");
assert.deepEqual(report.statusCounts, { "automated-pass": 1, "human-pending": 1, "not-run": 1, failed: 0 });
assert.match(alphaReportMarkdown(report), /human-pending/);
assert.match(alphaReportMarkdown(report), /midnight-chorus\/baseline\/case-1\/signal-interception/);
assert.equal(report.goldSliceBehaviorEvidence.status, "automated-pass", "report retains the supplied Gold Slice evidence status");
assert.equal(report.goldSliceBehaviorEvidence.evidenceHash, goldSliceBehavior.evidenceHash, "report retains the validated source hash");
assert.ok(alphaReportMarkdown(report).includes(`Gold Slice behavior: \`outputs/v11-alpha/gold-slice-behavior-evidence.json\` (hash \`${goldSliceBehavior.evidenceHash}\`)`), "Markdown points to the same evidence as JSON");
const reportWithoutBehavior = buildAlphaReport({ release: report.release, gates: report.gates });
assert.deepEqual(reportWithoutBehavior.goldSliceBehaviorEvidence, { status: "not-run" }, "absent behavior evidence remains explicitly not-run");
const changedBehaviorReport = buildAlphaReport({ ...report, goldSliceBehaviorEvidence: { ...report.goldSliceBehaviorEvidence, evidenceHash: "changed" } });
assert.notEqual(changedBehaviorReport.reportHash, report.reportHash, "report hash covers the behavior evidence reference");
assert.match(alphaReportMarkdown(report), /does not rerun tests or certify the current worktree/, "report distinguishes aggregation from fresh verification");

console.log(JSON.stringify({ ok: true, suite: "v11-alpha-evidence", checks: ["rejection-taxonomy", "safe-examples", "72-case-manifest", "long-run-gate", "status-vocabulary", "report-hash"] }));
