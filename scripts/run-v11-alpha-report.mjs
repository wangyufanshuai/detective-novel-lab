import fs from "node:fs";
import path from "node:path";
import { hashPublicArtifactTree } from "./public-artifact-safety-lib.mjs";
import {
  alphaReportMarkdown,
  buildAlphaReport,
  sha256Json,
  validateBrowserObservabilityEvidence,
  validateCampaignEvidenceManifest,
  validateGoldSliceBehaviorEvidence,
  validateGoldSliceVisibleCopyEvidence,
  validateLongRunGateEvidence
} from "./v11-alpha-evidence-lib.mjs";

const jsonMode = process.argv.includes("--json");
const root = process.cwd();
const outputDir = path.join(root, "outputs", "v11-alpha");
const manifestPath = path.join(outputDir, "72-case-evidence-manifest.json");
const browserPath = path.join(outputDir, "browser-observability.json");
const longRunPath = path.join(outputDir, "long-run-gate.json");
const goldSliceBehaviorPath = path.join(outputDir, "gold-slice-behavior-evidence.json");
const visibleCopyPath = path.join(outputDir, "gold-slice-visible-copy.json");
const reportJsonPath = path.join(outputDir, "alpha-report.json");
const reportMarkdownPath = path.join(outputDir, "alpha-report.md");
const protectedPublicPaths = ["public/dataset-reader", "public/review-catalog"];
const expectedProtectedPublicHash = "a3fca1430935d4252a03db9600d792cf52eedef0984c2469b76ff45addef3c1f";

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const manifest = readJson(manifestPath);
const browser = readJson(browserPath);
const longRun = readJson(longRunPath);
const goldSliceBehavior = readJson(goldSliceBehaviorPath);
const visibleCopy = readJson(visibleCopyPath);
const visibleCopyGate = validateGoldSliceVisibleCopyEvidence(visibleCopy, sha256Json(fs.readFileSync(path.join(root, "app/localization/midnight-chorus-gold-slice-locale.ts"), "utf8")));
const manifestGate = validateCampaignEvidenceManifest(manifest);
const browserEvidenceGate = validateBrowserObservabilityEvidence(browser);
const longRunGate = validateLongRunGateEvidence(longRun);
const goldSliceBehaviorGate = validateGoldSliceBehaviorEvidence(goldSliceBehavior);
const protectedPublic = hashPublicArtifactTree({ paths: protectedPublicPaths });
const protectedPublicStatus = protectedPublic.treeHash === expectedProtectedPublicHash ? "automated-pass" : "failed";
const browserGate = (key, label, fallbackSummary) => ({
  area: "browser",
  check: label,
  status: browser
    ? browserEvidenceGate.hashMatches
      ? browser.checks?.[key]?.status || "failed"
      : "failed"
    : "not-run",
  summary: browserEvidenceGate.hashMatches
    ? browser?.checks?.[key]?.summary || fallbackSummary?.(browser?.checks?.[key]) || "Evidence is incomplete."
    : browserEvidenceGate.summary
});
const normalizedRejectionCategories = (manifest?.candidateRejections?.categories || []).map((category) => ({
  ...category,
  reasonCount: Number.isInteger(category.reasonCount) ? category.reasonCount : Array.isArray(category.reasons) ? category.reasons.length : 0,
  examples: (category.examples || []).map((example) => ({
    ...example,
    locator: example.locator || `${example.campaign}/${example.route}/case-${example.ordinal}/${example.caseType}`
  }))
}));
const rejectionCount = manifest?.candidateRejections?.total;
const rejectionCategories = normalizedRejectionCategories.filter((item) => item.count > 0).map((item) => item.category);
const rejectionEvidenceValid = manifestGate.status === "automated-pass"
  && Number.isInteger(rejectionCount)
  && rejectionCount >= 0
  && rejectionCategories.every((item) => ["trigger", "means", "route-integrity", "evidence-coverage", "unknown"].includes(item));

const report = buildAlphaReport({
  release: "v11.1-alpha.1",
  visibleCopyEvidence: visibleCopy ? {
    status: visibleCopyGate.status,
    path: path.relative(root, visibleCopyPath).replaceAll("\\", "/"),
    generatedAt: visibleCopy.generatedAt,
    evidenceHash: visibleCopy.evidenceHash,
    sourceHash: visibleCopy.sourceHash
  } : { status: "not-run" },
  baseline: { inheritedStages: 63, campaigns: 12, routes: 24, cases: 72, worldPackages: 12 },
  evidenceManifest: manifest ? {
    status: manifestGate.status,
    path: path.relative(root, manifestPath).replaceAll("\\", "/"),
    evidenceHash: manifest.evidenceHash || "missing",
    generatedAt: manifest.generatedAt || "missing",
    cases: manifest.summary?.cases || 0
  } : { status: "not-run" },
  candidateRejections: manifest ? {
    status: rejectionEvidenceValid ? "automated-pass" : "failed",
    path: path.relative(root, manifestPath).replaceAll("\\", "/"),
    jsonPointer: "/candidateRejections",
    total: rejectionCount || 0,
    categories: normalizedRejectionCategories
  } : { status: "not-run" },
  browserEvidence: browser ? {
    status: browserEvidenceGate.status,
    path: path.relative(root, browserPath).replaceAll("\\", "/"),
    generatedAt: browser.generatedAt || "missing",
    summary: browser.summary || null,
    checks: browser.checks || {}
  } : { status: "not-run" },
  goldSliceBehaviorEvidence: goldSliceBehavior ? {
    status: goldSliceBehaviorGate.status,
    path: path.relative(root, goldSliceBehaviorPath).replaceAll("\\", "/"),
    evidenceHash: goldSliceBehavior.evidenceHash || "missing",
    generatedAt: goldSliceBehavior.generatedAt || "missing",
    checks: goldSliceBehavior.checks?.length || 0
  } : { status: "not-run" },
  protectedPublicHash: {
    status: protectedPublicStatus,
    treeHash: protectedPublic.treeHash,
    expectedTreeHash: expectedProtectedPublicHash,
    fileCount: protectedPublic.fileCount
  },
  gates: [
    {
      phase: "alpha1",
      area: "playthrough",
      check: "72-case local evidence manifest",
      status: manifestGate.status,
      summary: manifestGate.summary
    },
    {
      phase: "alpha1",
      area: "candidate-queue",
      check: "candidate rejection taxonomy",
      status: manifest ? rejectionEvidenceValid ? "automated-pass" : "failed" : "not-run",
      summary: manifest ? `${rejectionCount || 0} unique rejection observations across ${rejectionCategories.length} populated categories.` : "Candidate rejection evidence has not been generated."
    },
    { phase: "alpha1", ...browserGate("network", "network requests and failures") },
    { phase: "alpha1", ...browserGate("console", "console and page errors") },
    { phase: "alpha1", ...browserGate("overflow", "390 / 768 / 1440 overflow") },
    { phase: "alpha1", ...browserGate("focus", "initial focus ownership") },
    { phase: "alpha1", ...browserGate("reducedMotion", "reduced-motion equivalence") },
    { phase: "alpha1", ...browserGate("keyboard", "keyboard containment and focus restore", (entry) => entry?.checks
      ? `${Object.values(entry.checks).filter(Boolean).length}/${Object.keys(entry.checks).length} keyboard and focus checks passed`
      : undefined) },
    { phase: "gold-slice", ...browserGate("goldSlice", "Midnight Chorus bilingual responsive and Low Sensory gold slice") },
    { phase: "gold-slice", area: "behavior", check: "Evidence selection, contradiction loop, Theory Pressure, and Finale recall", status: goldSliceBehaviorGate.status, summary: goldSliceBehaviorGate.summary },
    { phase: "gold-slice", area: "localization", check: "Observed visible-copy regressions and unknown-text preservation", status: visibleCopyGate.status, summary: visibleCopyGate.summary },
    {
      phase: "alpha1",
      area: "release-safety",
      check: "protected-public hash",
      status: protectedPublicStatus,
      summary: `${protectedPublic.fileCount} protected files; tree hash ${protectedPublic.treeHash}${protectedPublicStatus === "automated-pass" ? "." : `; expected ${expectedProtectedPublicHash}.`}`
    },
    { phase: "human", area: "human", check: "90-second orientation and 4/5 comprehension", status: "human-pending", summary: "Template and five moderated sessions are still required." },
    { phase: "human", area: "human", check: "art-direction approval", status: "human-pending", summary: "Gold Slice visual review has not yet been conducted." },
    { phase: "beta", area: "beta", check: "5000 / 10000 tick gate", status: longRunGate.status, summary: longRunGate.summary }
  ]
});

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
fs.writeFileSync(reportMarkdownPath, alphaReportMarkdown(report), "utf8");
const result = {
  ok: report.alphaEntryStatus === "automated-pass",
  alphaEntryStatus: report.alphaEntryStatus,
  automatedStatus: report.automatedStatus,
  promotionStatus: report.promotionStatus,
  statusCounts: report.statusCounts,
  reportHash: report.reportHash,
  outputs: [path.relative(root, reportJsonPath), path.relative(root, reportMarkdownPath)]
};
console.log(jsonMode ? JSON.stringify(result) : `v11 Alpha report: ${report.automatedStatus}; promotion ${report.promotionStatus}`);
if (!result.ok) process.exitCode = 1;
