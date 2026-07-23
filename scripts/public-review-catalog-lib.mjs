import fs from "node:fs";
import path from "node:path";
import {
  assertInside,
  publicUrlToFile,
  readJson,
  scanPublicTextFiles,
  sha256,
  toPosix,
  validateAllowedFileSet,
  validatePublicCaseSummaryIndexFile,
  writeJson
} from "./public-artifact-safety-lib.mjs";
import { DEFAULT_CONTENT_ROOT, validateDetectiveContentDirectory } from "./detective-content-lib.mjs";

export const CATALOG_SCHEMA_VERSION = "public-review-catalog.v1";
export const STABLE_WORLD_SCHEMA_VERSION = "public-stable-world-summary.v1";
export const CASE_QUALITY_SCHEMA_VERSION = "public-case-quality-summary.v1";
export const WORLD_SYSTEM_INFLUENCE_SCHEMA_VERSION = "public-world-system-influence-summary.v1";
export const DEFAULT_READER_ROOT = "public/dataset-reader";
export const DEFAULT_CATALOG_ROOT = "public/review-catalog";
export const DEFAULT_STABLE_WORLD_RUN_ID = "stable-world-1000-campaign-validation-stable-town-a-stable-town-b";
export const DEFAULT_STABLE_WORLD_ROOT = `data/replay-store/${DEFAULT_STABLE_WORLD_RUN_ID}`;
export const DEFAULT_WORLD_SYSTEM_INFLUENCE_AUDIT_PATH = "outputs/world-system-influence-audit.json";

const STABLE_WORLD_PUBLIC_FILES = [
  "manifest.json",
  "stability-summary.json",
  "diagnostics-report.json",
  "regression-report.json"
];

const CASE_QUALITY_PUBLIC_FILES = [
  "manifest.json",
  "case-quality-report.json"
];

const FORBIDDEN_STABLE_WORLD_KEYS = new Set([
  "caseId",
  "victimId",
  "culpritId",
  "evidenceIds",
  "aftermathIds",
  "sourceIds",
  "sourceEventIds",
  "sourceEventId",
  "fromCaseId",
  "toCaseId",
  "fromNodeId",
  "toNodeId",
  "actorId",
  "agentId",
  "npcId",
  "eventId",
  "checkpoint",
  "truth",
  "trueMeaning",
  "qualityReport",
  "causalMetrics",
  "replayBody",
  "packageBody",
  "agentSnapshots"
]);

const FORBIDDEN_STABLE_WORLD_VALUE_RE = /\b(?:npc|agent)-|evidence-chain-|aftermath-|case-\d{2,}-\d{3}-[a-f0-9]{8}\b|[A-Za-z]:[\\/]/i;
const FORBIDDEN_PUBLIC_SUMMARY_VALUE_RE = /\b(?:npc|agent)-|evidence-chain-|aftermath-|case-\d{2,}-\d{3}-[a-f0-9]{8}\b|[A-Za-z]:[\\/]|\.sqlite|\.env\.local|sk-[A-Za-z0-9]/i;

function walkJson(value, visit, objectPath = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkJson(item, visit, [...objectPath, String(index)]));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    const nextPath = [...objectPath, key];
    visit(key, nested, nextPath);
    walkJson(nested, visit, nextPath);
  }
}

function auditOk(audit) {
  return Boolean(audit?.ok && audit.errorCount === 0 && audit.secretLeakCount === 0 && audit.hiddenTruthLeakCount === 0);
}

function validateReaderBundle(bundleDir, root = process.cwd()) {
  const readerRoot = path.resolve(root, DEFAULT_READER_ROOT);
  const target = assertInside(readerRoot, bundleDir, "Dataset reader bundle");
  const errors = [];
  const label = toPosix(path.relative(root, target));
  const allowed = validateAllowedFileSet({ dir: target, allowedFiles: ["case-summary-index.json", "dataset-card.md", "manifest-lite.json", "reader-index.json"], label });
  const scan = scanPublicTextFiles({ dir: target, label });
  errors.push(...allowed.errors, ...scan.errors);
  const files = allowed.files;
  const manifestPath = path.join(target, "manifest-lite.json");
  const readerPath = path.join(target, "reader-index.json");
  const caseSummaryPath = path.join(target, "case-summary-index.json");
  const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : null;
  const readerIndex = fs.existsSync(readerPath) ? readJson(readerPath) : null;
  const caseSummary = fs.existsSync(caseSummaryPath) ? validatePublicCaseSummaryIndexFile({ filePath: caseSummaryPath, label: `${label}/case-summary-index.json` }) : null;
  if (caseSummary) errors.push(...caseSummary.errors);
  if (manifest?.schemaVersion !== "static-dataset-reader.v1") errors.push(`${toPosix(path.relative(root, manifestPath))} schemaVersion is invalid.`);
  if (readerIndex?.schemaVersion !== "dataset-reader.v1") errors.push(`${toPosix(path.relative(root, readerPath))} schemaVersion is invalid.`);
  if (manifest && readerIndex) {
    const readerBytes = fs.readFileSync(readerPath);
    const caseSummaryBytes = fs.existsSync(caseSummaryPath) ? fs.readFileSync(caseSummaryPath) : null;
    if (manifest.datasetId !== readerIndex.datasetId) errors.push("manifest-lite datasetId does not match reader-index.");
    if (manifest.sourceRunId !== readerIndex.sourceRunId) errors.push("manifest-lite sourceRunId does not match reader-index.");
    if (manifest.readerIndexHash !== sha256(readerBytes)) errors.push("manifest-lite readerIndexHash does not match reader-index file.");
    if (manifest.caseSummaryIndexPath !== "case-summary-index.json") errors.push("manifest-lite caseSummaryIndexPath must be case-summary-index.json.");
    if (!manifest.caseSummaryIndexHash) errors.push("manifest-lite caseSummaryIndexHash is required.");
    if (caseSummaryBytes && manifest.caseSummaryIndexHash !== sha256(caseSummaryBytes)) errors.push("manifest-lite caseSummaryIndexHash does not match case-summary-index file.");
    if (caseSummary?.index?.datasetId !== readerIndex.datasetId) errors.push("case-summary-index datasetId does not match reader-index.");
    if (caseSummary?.index?.sourceRunId !== readerIndex.sourceRunId) errors.push("case-summary-index sourceRunId does not match reader-index.");
    if (caseSummary?.index?.caseCount !== readerIndex.summary.caseCount) errors.push("case-summary-index case count does not match reader-index.");
    if (!manifest.gate?.ok || !readerIndex.gate?.ok) errors.push("static reader gate must be ok.");
    if (!auditOk(manifest.audit) || !auditOk(readerIndex.audit)) errors.push("static reader audit summary must be clean.");
  }
  return { ok: errors.length === 0, errors: Array.from(new Set(errors)), manifest, readerIndex, caseSummaryIndex: caseSummary?.index, files };
}

function stableWorldFileRecord(manifest, fileName, artifactRoot) {
  const record = (manifest.files || []).find((file) => file.name === fileName || file.path === fileName);
  if (!record && artifactRoot) {
    const filePath = path.join(artifactRoot, fileName);
    if (fs.existsSync(filePath)) {
      return {
        name: fileName,
        bytes: fs.statSync(filePath).size,
        sha256: sha256(fs.readFileSync(filePath))
      };
    }
  }
  return record
    ? {
        name: fileName,
        bytes: record.bytes,
        sha256: record.sha256
      }
    : null;
}

function countFrom(record, key) {
  const value = record?.[key];
  return Number.isFinite(value) ? value : 0;
}

function buildStableWorldSummary({
  stableWorldRoot = DEFAULT_STABLE_WORLD_ROOT,
  root = process.cwd()
} = {}) {
  const replayRoot = path.resolve(root, "data/replay-store");
  const resolvedStableWorldRoot = assertInside(replayRoot, path.resolve(root, stableWorldRoot), "Stable-world artifact root");
  if (!fs.existsSync(resolvedStableWorldRoot)) {
    throw new Error(`${stableWorldRoot} does not exist. Run npm run benchmark:stable-world -- --json first.`);
  }
  for (const fileName of STABLE_WORLD_PUBLIC_FILES) {
    if (!fs.existsSync(path.join(resolvedStableWorldRoot, fileName))) {
      throw new Error(`${stableWorldRoot}/${fileName} is required. Run npm run benchmark:stable-world -- --json first.`);
    }
  }

  const manifest = readJson(path.join(resolvedStableWorldRoot, "manifest.json"));
  const stability = readJson(path.join(resolvedStableWorldRoot, "stability-summary.json"));
  const diagnostics = readJson(path.join(resolvedStableWorldRoot, "diagnostics-report.json"));
  const regression = readJson(path.join(resolvedStableWorldRoot, "regression-report.json"));
  const seeds = Array.isArray(manifest.seeds) ? [...manifest.seeds] : Object.keys(stability.deterministicRunHashes || {});
  const perSeed = Array.isArray(stability.perSeed) ? stability.perSeed : [];
  const runtimeMs = perSeed.map((seed) => countFrom(seed, "runtimeMs")).filter((value) => value > 0);
  const deterministicRunHashes = Object.fromEntries(
    Object.entries(stability.deterministicRunHashes || {}).sort(([left], [right]) => left.localeCompare(right))
  );
  const artifactFiles = STABLE_WORLD_PUBLIC_FILES
    .map((fileName) => stableWorldFileRecord(manifest, fileName, resolvedStableWorldRoot))
    .filter(Boolean);

  return {
    schemaVersion: STABLE_WORLD_SCHEMA_VERSION,
    generatedAt: manifest.generatedAt || diagnostics.generatedAt || regression.generatedAt,
    sourceRunId: manifest.runId || DEFAULT_STABLE_WORLD_RUN_ID,
    sourceKind: manifest.kind || "stable-world",
    ticks: manifest.tickCount,
    seeds,
    seedCount: seeds.length,
    gate: {
      ok: manifest.status === "completed" && stability.failedSeedCount === 0 && diagnostics.findingCounts?.blocker === 0 && regression.deltaCounts?.blocked === 0,
      passedSeedCount: stability.passedSeedCount,
      failedSeedCount: stability.failedSeedCount,
      worstCandidateRepeatRate: stability.worstCandidateRepeatRate,
      lowestDistinctCaseTypeCount: stability.lowestDistinctCaseTypeCount,
      lowestSelectedActionKindCount: stability.lowestSelectedActionKindCount,
      highestLargestSelectedActionShare: stability.highestLargestSelectedActionShare,
      lowestInstitutionDecisionCount: stability.lowestInstitutionDecisionCount,
      minRuntimeMs: runtimeMs.length ? Math.min(...runtimeMs) : 0,
      maxRuntimeMs: runtimeMs.length ? Math.max(...runtimeMs) : 0
    },
    deterministicRunHashes,
    diagnostics: {
      ok: Boolean(diagnostics.ok),
      overallStatus: diagnostics.overallStatus,
      findingCounts: diagnostics.findingCounts || { ok: 0, watch: 0, risk: 0, blocker: 0 },
      blockerCount: countFrom(diagnostics.findingCounts, "blocker"),
      riskCount: countFrom(diagnostics.findingCounts, "risk"),
      watchCount: countFrom(diagnostics.findingCounts, "watch")
    },
    regression: {
      baselineAvailable: Boolean(regression.baselineAvailable),
      ok: Boolean(regression.ok),
      overallStatus: regression.overallStatus,
      deltaCounts: regression.deltaCounts || { improved: 0, unchanged: 0, watch: 0, regressed: 0, blocked: 0 },
      blockedCount: countFrom(regression.deltaCounts, "blocked"),
      regressedCount: countFrom(regression.deltaCounts, "regressed"),
      watchCount: countFrom(regression.deltaCounts, "watch")
    },
    aggregate: {
      repeatRate: stability.worstCandidateRepeatRate,
      caseTypeCount: stability.lowestDistinctCaseTypeCount,
      actionKindCount: stability.lowestSelectedActionKindCount,
      largestActionShare: stability.highestLargestSelectedActionShare,
      institutionDecisionCount: stability.lowestInstitutionDecisionCount,
      evidenceWarningCount: perSeed.reduce((sum, seed) => sum + countFrom(seed, "evidenceGraphWarnings"), 0),
      laterInfluenceRate: perSeed.length ? Math.min(...perSeed.map((seed) => countFrom(seed, "laterCaseInfluenceRate"))) : 0
    },
    artifactFiles,
    publicBoundary: {
      sanitizedBenchmarkSummary: true,
      artifactBodiesIncluded: false,
      localPathsIncluded: false,
      excludedBodies: ["full quality metrics", "causal metric samples", "raw replay data", "agent state snapshots"]
    }
  };
}

function validateStableWorldSummary(summary, label = "stable-world-summary.json") {
  const errors = [];
  if (summary?.schemaVersion !== STABLE_WORLD_SCHEMA_VERSION) errors.push(`${label} schemaVersion must be ${STABLE_WORLD_SCHEMA_VERSION}.`);
  if (!/^stable-world-1000-[a-z0-9._-]+$/i.test(summary?.sourceRunId || "")) errors.push(`${label} sourceRunId is invalid.`);
  if (summary?.ticks !== 1000) errors.push(`${label} ticks must be 1000.`);
  if (!Array.isArray(summary?.seeds) || summary.seeds.length < 3) errors.push(`${label} seeds must contain at least three entries.`);
  if (summary?.seedCount !== summary?.seeds?.length) errors.push(`${label} seedCount must match seeds length.`);
  if (!summary?.gate?.ok || summary.gate.failedSeedCount !== 0) errors.push(`${label} gate must pass all seeds.`);
  if (summary?.diagnostics?.blockerCount !== 0) errors.push(`${label} diagnostics must have no blockers.`);
  if (summary?.regression?.blockedCount !== 0) errors.push(`${label} regression must have no blocked deltas.`);
  if (summary?.regression?.regressedCount !== 0) errors.push(`${label} regression must have no regressed deltas.`);
  if (!summary?.publicBoundary?.sanitizedBenchmarkSummary || summary?.publicBoundary?.artifactBodiesIncluded !== false || summary?.publicBoundary?.localPathsIncluded !== false) {
    errors.push(`${label} publicBoundary must describe a sanitized benchmark summary with no bodies or local paths.`);
  }
  for (const [seed, hash] of Object.entries(summary?.deterministicRunHashes || {})) {
    if (!summary.seeds?.includes(seed)) errors.push(`${label} deterministic hash seed is not listed: ${seed}.`);
    if (!/^fnv1a-[a-f0-9]{8}$/i.test(String(hash))) errors.push(`${label} deterministic hash is invalid for ${seed}.`);
  }
  const artifactFileNames = new Set((summary?.artifactFiles || []).map((file) => file.name));
  for (const fileName of STABLE_WORLD_PUBLIC_FILES) {
    if (!artifactFileNames.has(fileName)) errors.push(`${label} artifactFiles missing ${fileName}.`);
  }
  for (const file of summary?.artifactFiles || []) {
    if (!STABLE_WORLD_PUBLIC_FILES.includes(file.name)) errors.push(`${label} artifactFiles includes a non-public source file: ${file.name}.`);
    if (!Number.isFinite(file.bytes) || file.bytes <= 0) errors.push(`${label} artifact file bytes invalid for ${file.name}.`);
    if (!/^[a-f0-9]{64}$/i.test(file.sha256 || "")) errors.push(`${label} artifact file sha256 invalid for ${file.name}.`);
    if ("path" in file) errors.push(`${label} artifact file must not include local or relative path fields.`);
  }
  walkJson(summary, (key, nested, objectPath) => {
    if (FORBIDDEN_STABLE_WORLD_KEYS.has(key)) errors.push(`${label}:${objectPath.join(".")} contains a forbidden raw key.`);
    if (typeof nested === "string" && FORBIDDEN_STABLE_WORLD_VALUE_RE.test(nested)) {
      errors.push(`${label}:${objectPath.join(".")} contains a forbidden raw id or local path value.`);
    }
  });
  return { ok: errors.length === 0, errors: Array.from(new Set(errors)) };
}

function buildCaseQualitySummary({
  stableWorldRoot = DEFAULT_STABLE_WORLD_ROOT,
  root = process.cwd()
} = {}) {
  const replayRoot = path.resolve(root, "data/replay-store");
  const resolvedStableWorldRoot = assertInside(replayRoot, path.resolve(root, stableWorldRoot), "Stable-world artifact root");
  if (!fs.existsSync(resolvedStableWorldRoot)) {
    throw new Error(`${stableWorldRoot} does not exist. Run npm run benchmark:stable-world -- --json first.`);
  }
  for (const fileName of CASE_QUALITY_PUBLIC_FILES) {
    if (!fs.existsSync(path.join(resolvedStableWorldRoot, fileName))) {
      throw new Error(`${stableWorldRoot}/${fileName} is required. Run npm run benchmark:stable-world -- --json first.`);
    }
  }
  const manifest = readJson(path.join(resolvedStableWorldRoot, "manifest.json"));
  const caseQuality = readJson(path.join(resolvedStableWorldRoot, "case-quality-report.json"));
  const seeds = Array.isArray(manifest.seeds) ? [...manifest.seeds] : caseQuality.seeds?.map((seed) => seed.seed) || [];
  const deterministicRunHashes = Object.fromEntries(
    (caseQuality.seeds || [])
      .map((seed) => [seed.seed, seed.deterministicRunHash])
      .sort(([left], [right]) => left.localeCompare(right))
  );
  const dimensionAverages = Object.fromEntries(Object.entries(caseQuality.dimensionAverages || {}).sort(([left], [right]) => left.localeCompare(right)));
  const dimensionMinimums = Object.fromEntries(Object.entries(caseQuality.dimensionMinimums || {}).sort(([left], [right]) => left.localeCompare(right)));
  const perSeed = (caseQuality.seeds || []).map((seed) => ({
    seed: seed.seed,
    status: seed.status,
    score: seed.score,
    caseCount: seed.caseCount,
    solvedCaseCount: seed.solvedCaseCount,
    distinctCaseTypeCount: seed.distinctCaseTypeCount,
    evidenceCompleteCaseCount: seed.evidenceCompleteCaseCount,
    evidenceWarningCount: seed.evidenceWarningCount,
    laterCaseInfluenceRate: seed.laterCaseInfluenceRate,
    institutionDecisionCount: seed.institutionDecisionCount,
    repeatRate: seed.repeatRate,
    deterministicRunHash: seed.deterministicRunHash
  })).sort((left, right) => left.seed.localeCompare(right.seed));
  const artifactFiles = CASE_QUALITY_PUBLIC_FILES
    .map((fileName) => stableWorldFileRecord(manifest, fileName, resolvedStableWorldRoot))
    .filter(Boolean);

  return {
    schemaVersion: CASE_QUALITY_SCHEMA_VERSION,
    generatedAt: manifest.generatedAt || caseQuality.generatedAt,
    sourceRunId: manifest.runId || DEFAULT_STABLE_WORLD_RUN_ID,
    sourceKind: "stable-world-case-quality",
    ticks: manifest.tickCount,
    seeds,
    seedCount: seeds.length,
    nonBlocking: true,
    overallStatus: caseQuality.overallStatus,
    averageScore: caseQuality.averageScore,
    minScore: caseQuality.minScore,
    statusCounts: caseQuality.statusCounts || { ok: 0, watch: 0, risk: 0 },
    dimensionAverages,
    dimensionMinimums,
    perSeed,
    deterministicRunHashes,
    artifactFiles,
    publicBoundary: {
      sanitizedBenchmarkSummary: true,
      artifactBodiesIncluded: false,
      localPathsIncluded: false,
      excludedBodies: ["full quality metrics", "raw case bodies", "raw replay data", "case continuity ids", "agent state snapshots"]
    }
  };
}

function validateCaseQualitySummary(summary, label = "case-quality-summary.json") {
  const errors = [];
  if (summary?.schemaVersion !== CASE_QUALITY_SCHEMA_VERSION) errors.push(`${label} schemaVersion must be ${CASE_QUALITY_SCHEMA_VERSION}.`);
  if (!/^stable-world-1000-[a-z0-9._-]+$/i.test(summary?.sourceRunId || "")) errors.push(`${label} sourceRunId is invalid.`);
  if (summary?.sourceKind !== "stable-world-case-quality") errors.push(`${label} sourceKind must be stable-world-case-quality.`);
  if (summary?.ticks !== 1000) errors.push(`${label} ticks must be 1000.`);
  if (!Array.isArray(summary?.seeds) || summary.seeds.length < 3) errors.push(`${label} seeds must contain at least three entries.`);
  if (summary?.seedCount !== summary?.seeds?.length) errors.push(`${label} seedCount must match seeds length.`);
  if (summary?.nonBlocking !== true) errors.push(`${label} must remain non-blocking.`);
  if (!["ok", "watch", "risk"].includes(summary?.overallStatus)) errors.push(`${label} overallStatus is invalid.`);
  if (!Number.isFinite(summary?.averageScore) || summary.averageScore < 0 || summary.averageScore > 100) errors.push(`${label} averageScore must be 0-100.`);
  if (!Number.isFinite(summary?.minScore) || summary.minScore < 0 || summary.minScore > 100) errors.push(`${label} minScore must be 0-100.`);
  for (const dimension of ["fair-play-evidence", "evidence-provenance", "case-diversity", "cross-case-continuity", "institution-relevance", "repeat-control", "solution-readiness"]) {
    if (!Number.isFinite(summary?.dimensionAverages?.[dimension])) errors.push(`${label} dimensionAverages missing ${dimension}.`);
    if (!Number.isFinite(summary?.dimensionMinimums?.[dimension])) errors.push(`${label} dimensionMinimums missing ${dimension}.`);
  }
  for (const seed of summary?.perSeed || []) {
    if (!summary.seeds?.includes(seed.seed)) errors.push(`${label} perSeed seed is not listed: ${seed.seed}.`);
    if (!["ok", "watch", "risk"].includes(seed.status)) errors.push(`${label} perSeed status invalid for ${seed.seed}.`);
    if (!Number.isFinite(seed.score) || seed.score < 0 || seed.score > 100) errors.push(`${label} perSeed score invalid for ${seed.seed}.`);
    if (!/^fnv1a-[a-f0-9]{8}$/i.test(String(seed.deterministicRunHash))) errors.push(`${label} deterministic hash is invalid for ${seed.seed}.`);
  }
  for (const [seed, hash] of Object.entries(summary?.deterministicRunHashes || {})) {
    if (!summary.seeds?.includes(seed)) errors.push(`${label} deterministic hash seed is not listed: ${seed}.`);
    if (!/^fnv1a-[a-f0-9]{8}$/i.test(String(hash))) errors.push(`${label} deterministic hash is invalid for ${seed}.`);
  }
  const artifactFileNames = new Set((summary?.artifactFiles || []).map((file) => file.name));
  for (const fileName of CASE_QUALITY_PUBLIC_FILES) {
    if (!artifactFileNames.has(fileName)) errors.push(`${label} artifactFiles missing ${fileName}.`);
  }
  for (const file of summary?.artifactFiles || []) {
    if (!CASE_QUALITY_PUBLIC_FILES.includes(file.name)) errors.push(`${label} artifactFiles includes a non-public source file: ${file.name}.`);
    if (!Number.isFinite(file.bytes) || file.bytes <= 0) errors.push(`${label} artifact file bytes invalid for ${file.name}.`);
    if (!/^[a-f0-9]{64}$/i.test(file.sha256 || "")) errors.push(`${label} artifact file sha256 invalid for ${file.name}.`);
    if ("path" in file) errors.push(`${label} artifact file must not include local or relative path fields.`);
  }
  if (!summary?.publicBoundary?.sanitizedBenchmarkSummary || summary?.publicBoundary?.artifactBodiesIncluded !== false || summary?.publicBoundary?.localPathsIncluded !== false) {
    errors.push(`${label} publicBoundary must describe a sanitized benchmark summary with no bodies or local paths.`);
  }
  walkJson(summary, (key, nested, objectPath) => {
    if (FORBIDDEN_STABLE_WORLD_KEYS.has(key)) errors.push(`${label}:${objectPath.join(".")} contains a forbidden raw key.`);
    if (typeof nested === "string" && FORBIDDEN_STABLE_WORLD_VALUE_RE.test(nested)) {
      errors.push(`${label}:${objectPath.join(".")} contains a forbidden raw id or local path value.`);
    }
  });
  return { ok: errors.length === 0, errors: Array.from(new Set(errors)) };
}

function validatePublicSummarySafety(summary, label) {
  const errors = [];
  walkJson(summary, (key, nested, objectPath) => {
    if (FORBIDDEN_STABLE_WORLD_KEYS.has(key)) errors.push(`${label}:${objectPath.join(".")} contains a forbidden raw key.`);
    if (typeof nested === "string" && FORBIDDEN_PUBLIC_SUMMARY_VALUE_RE.test(nested)) {
      errors.push(`${label}:${objectPath.join(".")} contains a forbidden raw id, local path, database path, or secret-like value.`);
    }
  });
  return errors;
}

function buildWorldSystemInfluenceSummary({
  auditPath = DEFAULT_WORLD_SYSTEM_INFLUENCE_AUDIT_PATH,
  root = process.cwd()
} = {}) {
  const resolvedAuditPath = assertInside(path.resolve(root, "outputs"), path.resolve(root, auditPath), "World-system influence audit");
  if (!fs.existsSync(resolvedAuditPath)) {
    throw new Error(`${auditPath} does not exist. Run npm run audit:world-system-hints -- --json first.`);
  }
  const audit = readJson(resolvedAuditPath);
  if (audit?.schemaVersion !== "world-system-influence-audit.v1") {
    throw new Error(`${auditPath} schemaVersion must be world-system-influence-audit.v1.`);
  }
  if (!audit.ok) {
    throw new Error(`${auditPath} must be ok before building the public influence summary.`);
  }
  const perSeed = (audit.seeds || []).map((seed) => ({
    seed: seed.seed,
    tickCount: seed.tickCount,
    hintedActionShare: seed.hinted?.hintedActionShare ?? 0,
    appliedBiasCount: seed.hinted?.appliedBiasCount ?? 0,
    maxBias: seed.hinted?.maxBias ?? 0,
    validCandidateTrendDelta: seed.delta?.validCandidateTrendDelta ?? 0,
    deterministicHash: seed.deterministicHash
  })).sort((left, right) => left.seed.localeCompare(right.seed));
  return {
    schemaVersion: WORLD_SYSTEM_INFLUENCE_SCHEMA_VERSION,
    generatedAt: audit.generatedAt,
    sourceKind: "world-system-influence-audit",
    seedCount: audit.seedCount,
    tickCount: audit.tickCount,
    aggregate: {
      appliedBiasCount: audit.aggregate?.appliedBiasCount ?? 0,
      maxBias: audit.aggregate?.maxBias ?? 0,
      hintedActionShare: audit.aggregate?.hintedActionShare ?? 0,
      institutionLabelCoverage: audit.aggregate?.institutionLabelCoverage ?? 0,
      validCandidateTrendDelta: audit.aggregate?.validCandidateTrendDelta ?? 0,
      actionKindDelta: Object.fromEntries(Object.entries(audit.aggregate?.actionKindDelta || {}).sort(([left], [right]) => left.localeCompare(right)))
    },
    safety: {
      maxBiasOk: Boolean(audit.safety?.maxBiasOk),
      noLegalCandidateLoss: Boolean(audit.safety?.noLegalCandidateLoss),
      deterministicHashOk: Boolean(audit.safety?.deterministicHashOk),
      publicSafe: Boolean(audit.safety?.publicSafe)
    },
    perSeed,
    publicBoundary: {
      sanitizedAuditSummary: true,
      rawBodiesIncluded: false,
      rawIdsIncluded: false,
      localPathsIncluded: false,
      runtimeAuthority: false,
      excludedBodies: ["raw replay data", "raw case bodies", "NPC ids", "evidence ids", "event/source ids", "agent state snapshots", "candidate lists"]
    }
  };
}

function validateWorldSystemInfluenceSummary(summary, label = "world-system-influence-summary.json") {
  const errors = [];
  if (summary?.schemaVersion !== WORLD_SYSTEM_INFLUENCE_SCHEMA_VERSION) errors.push(`${label} schemaVersion must be ${WORLD_SYSTEM_INFLUENCE_SCHEMA_VERSION}.`);
  if (summary?.sourceKind !== "world-system-influence-audit") errors.push(`${label} sourceKind must be world-system-influence-audit.`);
  if (summary?.seedCount !== 3) errors.push(`${label} seedCount must be 3 for the public short audit proof.`);
  if (summary?.tickCount !== 120) errors.push(`${label} tickCount must be 120 for the public short audit proof.`);
  if (!Array.isArray(summary?.perSeed) || summary.perSeed.length !== summary?.seedCount) errors.push(`${label} perSeed must match seedCount.`);
  if (!Number.isFinite(summary?.aggregate?.appliedBiasCount) || summary.aggregate.appliedBiasCount <= 0) errors.push(`${label} aggregate.appliedBiasCount must be positive.`);
  if (!Number.isFinite(summary?.aggregate?.maxBias) || summary.aggregate.maxBias < 0 || summary.aggregate.maxBias > 4) errors.push(`${label} aggregate.maxBias must be 0-4.`);
  if (!Number.isFinite(summary?.aggregate?.hintedActionShare) || summary.aggregate.hintedActionShare <= 0 || summary.aggregate.hintedActionShare > 100) errors.push(`${label} aggregate.hintedActionShare must be 1-100.`);
  if (!Number.isFinite(summary?.aggregate?.institutionLabelCoverage) || summary.aggregate.institutionLabelCoverage < 0 || summary.aggregate.institutionLabelCoverage > 100) errors.push(`${label} aggregate.institutionLabelCoverage must be 0-100.`);
  if (!summary?.aggregate?.actionKindDelta || typeof summary.aggregate.actionKindDelta !== "object") errors.push(`${label} aggregate.actionKindDelta is required.`);
  for (const [kind, value] of Object.entries(summary?.aggregate?.actionKindDelta || {})) {
    if (!/^[a-z0-9-]+$/i.test(kind)) errors.push(`${label} action kind is invalid: ${kind}.`);
    if (!Number.isFinite(value)) errors.push(`${label} actionKindDelta.${kind} must be numeric.`);
  }
  for (const key of ["maxBiasOk", "noLegalCandidateLoss", "deterministicHashOk", "publicSafe"]) {
    if (summary?.safety?.[key] !== true) errors.push(`${label} safety.${key} must be true.`);
  }
  for (const seed of summary?.perSeed || []) {
    if (!/^[a-z0-9._-]+$/i.test(seed.seed || "")) errors.push(`${label} perSeed seed label is invalid.`);
    if (seed.tickCount !== summary.tickCount) errors.push(`${label} perSeed ${seed.seed} tickCount must match summary tickCount.`);
    if (!Number.isFinite(seed.hintedActionShare) || seed.hintedActionShare < 0 || seed.hintedActionShare > 100) errors.push(`${label} perSeed hintedActionShare invalid for ${seed.seed}.`);
    if (!Number.isFinite(seed.appliedBiasCount) || seed.appliedBiasCount <= 0) errors.push(`${label} perSeed appliedBiasCount must be positive for ${seed.seed}.`);
    if (!Number.isFinite(seed.maxBias) || seed.maxBias < 0 || seed.maxBias > 4) errors.push(`${label} perSeed maxBias must be 0-4 for ${seed.seed}.`);
    if (!Number.isFinite(seed.validCandidateTrendDelta)) errors.push(`${label} perSeed validCandidateTrendDelta must be numeric for ${seed.seed}.`);
    if (!/^fnv1a-[a-f0-9]{8}$/i.test(String(seed.deterministicHash))) errors.push(`${label} deterministic hash invalid for ${seed.seed}.`);
  }
  if (
    summary?.publicBoundary?.sanitizedAuditSummary !== true
    || summary?.publicBoundary?.rawBodiesIncluded !== false
    || summary?.publicBoundary?.rawIdsIncluded !== false
    || summary?.publicBoundary?.localPathsIncluded !== false
    || summary?.publicBoundary?.runtimeAuthority !== false
  ) {
    errors.push(`${label} publicBoundary must describe a sanitized non-authority audit summary with no raw bodies, ids, or local paths.`);
  }
  errors.push(...validatePublicSummarySafety(summary, label));
  return { ok: errors.length === 0, errors: Array.from(new Set(errors)) };
}

function makeCatalogCard(catalog) {
  const content = catalog.contentSummary
    ? [
        "## Content Tables",
        "",
        `- Pack: ${catalog.contentSummary.packId}`,
        `- Schema: ${catalog.contentSummary.schemaVersion}`,
        `- Case types: ${catalog.contentSummary.caseTypeCount}`,
        `- Evidence types: ${catalog.contentSummary.evidenceTypeCount}`,
        `- Locations / roles / motives: ${catalog.contentSummary.locationCount} / ${catalog.contentSummary.roleCount} / ${catalog.contentSummary.motiveCount}`,
        `- World systems: ${catalog.contentSummary.worldSystemCount || 0} systems / ${catalog.contentSummary.worldSystemRecordCount || 0} aggregate rows`,
        `- Resources / factions / events / progression: ${catalog.contentSummary.resourceCount || 0} / ${catalog.contentSummary.factionCount || 0} / ${catalog.contentSummary.eventArchetypeCount || 0} / ${catalog.contentSummary.progressionLineCount || 0}`,
        `- Coverage: ${catalog.contentSummary.validation.ok ? "ok" : "check"} (${catalog.contentSummary.validation.errorCount} errors, ${catalog.contentSummary.validation.warningCount} warnings)`
      ].join("\n")
    : "";
  const stableWorld = catalog.stableWorld
    ? [
        "## Stable World Proof",
        "",
        `- Seeds: ${catalog.stableWorld.seedCount}`,
        `- Ticks: ${catalog.stableWorld.ticks} each`,
        `- Gate: ${catalog.stableWorld.gate.passedSeedCount}/${catalog.stableWorld.seedCount} seeds pass`,
        `- Repeat / action kinds / institutions: ${catalog.stableWorld.aggregate.repeatRate}% / ${catalog.stableWorld.aggregate.actionKindCount} / ${catalog.stableWorld.aggregate.institutionDecisionCount}`,
        `- Diagnostics: ${catalog.stableWorld.diagnostics.overallStatus} (${catalog.stableWorld.diagnostics.blockerCount} blockers, ${catalog.stableWorld.diagnostics.watchCount} watch)`,
        `- Regression: ${catalog.stableWorld.regression.overallStatus} (${catalog.stableWorld.regression.blockedCount} blocked, ${catalog.stableWorld.regression.regressedCount} regressed)`,
        `- Summary path: ${catalog.stableWorldSummaryPath}`
      ].join("\n")
    : "";
  const caseQuality = catalog.caseQuality
    ? [
        "## Case Quality Proof",
        "",
        `- Status: ${catalog.caseQuality.overallStatus} (non-blocking)`,
        `- Average score: ${catalog.caseQuality.averageScore}`,
        `- Lowest seed score: ${catalog.caseQuality.minScore}`,
        `- Fair-play evidence / diversity / continuity / institution: ${catalog.caseQuality.dimensionAverages["fair-play-evidence"]} / ${catalog.caseQuality.dimensionAverages["case-diversity"]} / ${catalog.caseQuality.dimensionAverages["cross-case-continuity"]} / ${catalog.caseQuality.dimensionAverages["institution-relevance"]}`,
        `- Summary path: ${catalog.caseQualitySummaryPath}`
      ].join("\n")
    : "";
  const worldSystemInfluence = catalog.worldSystemInfluence
    ? [
        "## World-System Influence Proof",
        "",
        `- Seeds / ticks: ${catalog.worldSystemInfluence.seedCount} / ${catalog.worldSystemInfluence.tickCount}`,
        `- Applied bias / max bias: ${catalog.worldSystemInfluence.aggregate.appliedBiasCount} / ${catalog.worldSystemInfluence.aggregate.maxBias}`,
        `- Hinted action share: ${catalog.worldSystemInfluence.aggregate.hintedActionShare}%`,
        `- Institution label coverage: ${catalog.worldSystemInfluence.aggregate.institutionLabelCoverage}%`,
        `- Safety: ${Object.values(catalog.worldSystemInfluence.safety).every(Boolean) ? "ok" : "check"}`,
        `- Summary path: ${catalog.worldSystemInfluenceSummaryPath}`
      ].join("\n")
    : "";
  const datasets = catalog.datasets.map((dataset) => (
    [
      `## ${dataset.datasetId}`,
      "",
      `- Source run: ${dataset.sourceRunId}`,
      `- Gate: ${dataset.gate.ok ? "ok" : "failed"} (${dataset.gate.tickCount} ticks, ${dataset.gate.uniqueCases} cases, ${dataset.gate.distinctCaseTypeCount} case types)`,
      `- Audit: ${dataset.audit.errorCount} errors, ${dataset.audit.secretLeakCount} secret leaks, ${dataset.audit.hiddenTruthLeakCount} hiddenTruthLeakCount`,
      `- Reader hash: ${dataset.readerIndexHash}`,
      `- Public case summaries: ${dataset.caseSummaryCount || 0} (${dataset.caseSummaryIndexPath || "n/a"})`,
      `- Static paths: ${dataset.manifestPath}, ${dataset.readerIndexPath}, ${dataset.datasetCardPath}, ${dataset.caseSummaryIndexPath || "n/a"}`,
      `- Top case types: ${dataset.caseTypeDistribution.slice(0, 5).map((item) => `${item.id} (${item.count})`).join(", ") || "n/a"}`,
      `- Top evidence types: ${dataset.evidenceTypeDistribution.slice(0, 5).map((item) => `${item.id} (${item.count})`).join(", ") || "n/a"}`,
      `- World packages summarized: ${dataset.worldPackages.length}`
    ].join("\n")
  )).join("\n\n");
  return [
    "# Public Review Catalog",
    "",
    "Static public catalog for Detective Novel Lab review artifacts.",
    "",
    "## Summary",
    "",
    `- Datasets: ${catalog.summary.datasetCount}`,
    `- Source runs: ${catalog.summary.sourceRunCount}`,
    `- World packages summarized: ${catalog.summary.worldPackageCount}`,
    `- Gate ok: ${catalog.summary.gateOkCount}/${catalog.summary.datasetCount}`,
    `- Audit ok: ${catalog.summary.auditOkCount}/${catalog.summary.datasetCount}`,
    `- Static-only: ${catalog.publicBoundary.staticOnly ? "yes" : "no"}`,
    "",
    "## Public Boundary",
    "",
    "This catalog is a static index over sanitized reader metadata. It does not include full run artifacts, database files, environment files, private runtime state, or package source bodies.",
    "",
    stableWorld,
    "",
    caseQuality,
    "",
    worldSystemInfluence,
    "",
    content,
    "",
    datasets
  ].join("\n") + "\n";
}

export function buildPublicReviewCatalog({
  readerRoot = DEFAULT_READER_ROOT,
  catalogRoot = DEFAULT_CATALOG_ROOT,
  contentRoot = DEFAULT_CONTENT_ROOT,
  stableWorldRoot = DEFAULT_STABLE_WORLD_ROOT,
  worldSystemInfluenceAuditPath = DEFAULT_WORLD_SYSTEM_INFLUENCE_AUDIT_PATH,
  root = process.cwd()
} = {}) {
  const resolvedReaderRoot = assertInside(path.resolve(root, "public"), path.resolve(root, readerRoot), "Reader root");
  const resolvedCatalogRoot = assertInside(path.resolve(root, "public"), path.resolve(root, catalogRoot), "Catalog root");
  if (!fs.existsSync(resolvedReaderRoot)) throw new Error(`${readerRoot} does not exist. Run npm run qa:static-reader first.`);

  const datasets = fs.readdirSync(resolvedReaderRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const bundleDir = path.join(resolvedReaderRoot, entry.name);
      const validation = validateReaderBundle(bundleDir, root);
      if (!validation.ok) throw new Error(`Static reader validation failed for ${entry.name}: ${validation.errors.join("; ")}`);
      const { manifest, readerIndex, caseSummaryIndex } = validation;
      const staticPath = `/dataset-reader/${entry.name}`;
      return {
        datasetId: manifest.datasetId,
        title: manifest.datasetId,
        sourceRunId: manifest.sourceRunId,
        generatedAt: manifest.generatedAt,
        staticPath,
        manifestPath: `${staticPath}/manifest-lite.json`,
        readerIndexPath: `${staticPath}/reader-index.json`,
        datasetCardPath: `${staticPath}/dataset-card.md`,
        caseSummaryIndexPath: `${staticPath}/case-summary-index.json`,
        contentHash: manifest.contentHash,
        readerIndexHash: manifest.readerIndexHash,
        caseSummaryIndexHash: manifest.caseSummaryIndexHash,
        caseSummaryCount: caseSummaryIndex?.caseCount || 0,
        fileCount: manifest.fileCount,
        bytes: manifest.bytes,
        gate: manifest.gate,
        audit: manifest.audit,
        readerSummary: manifest.readerSummary,
        caseTypeDistribution: readerIndex.caseTypeDistribution,
        evidenceTypeDistribution: readerIndex.evidenceTypeDistribution,
        worldPackages: readerIndex.worldPackages
      };
    })
    .sort((left, right) => left.datasetId.localeCompare(right.datasetId));

  if (!datasets.length) throw new Error(`${readerRoot} does not contain any static reader datasets.`);

  const worldPackageIds = new Set(datasets.flatMap((dataset) => dataset.worldPackages.map((item) => item.packageId)));
  const sourceRuns = new Set(datasets.map((dataset) => dataset.sourceRunId));
  const latestGeneratedAt = datasets.map((dataset) => dataset.generatedAt).sort().at(-1);
  const contentReport = validateDetectiveContentDirectory({ contentRoot, root });
  if (!contentReport.ok) throw new Error(`Detective content validation failed: ${contentReport.errors.join("; ")}`);
  const stableWorldSummary = buildStableWorldSummary({ stableWorldRoot, root });
  const stableWorldValidation = validateStableWorldSummary(stableWorldSummary);
  if (!stableWorldValidation.ok) throw new Error(`Stable-world public summary validation failed: ${stableWorldValidation.errors.join("; ")}`);
  const caseQualitySummary = buildCaseQualitySummary({ stableWorldRoot, root });
  const caseQualityValidation = validateCaseQualitySummary(caseQualitySummary);
  if (!caseQualityValidation.ok) throw new Error(`Case-quality public summary validation failed: ${caseQualityValidation.errors.join("; ")}`);
  const worldSystemInfluenceSummary = buildWorldSystemInfluenceSummary({ auditPath: worldSystemInfluenceAuditPath, root });
  const worldSystemInfluenceValidation = validateWorldSystemInfluenceSummary(worldSystemInfluenceSummary);
  if (!worldSystemInfluenceValidation.ok) throw new Error(`World-system influence public summary validation failed: ${worldSystemInfluenceValidation.errors.join("; ")}`);
  const stableWorld = stableWorldSummary;
  const stableWorldSummaryText = `${JSON.stringify(stableWorldSummary, null, 2)}\n`;
  const stableWorldSummaryHash = sha256(stableWorldSummaryText);
  const caseQuality = caseQualitySummary;
  const caseQualitySummaryText = `${JSON.stringify(caseQualitySummary, null, 2)}\n`;
  const caseQualitySummaryHash = sha256(caseQualitySummaryText);
  const worldSystemInfluence = worldSystemInfluenceSummary;
  const worldSystemInfluenceSummaryText = `${JSON.stringify(worldSystemInfluenceSummary, null, 2)}\n`;
  const worldSystemInfluenceSummaryHash = sha256(worldSystemInfluenceSummaryText);
  const catalogGeneratedAt = [latestGeneratedAt, stableWorldSummary.generatedAt, caseQualitySummary.generatedAt, worldSystemInfluenceSummary.generatedAt].filter(Boolean).sort().at(-1);
  const catalog = {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    generatedAt: catalogGeneratedAt,
    summary: {
      datasetCount: datasets.length,
      sourceRunCount: sourceRuns.size,
      worldPackageCount: worldPackageIds.size,
      gateOkCount: datasets.filter((dataset) => dataset.gate.ok).length,
      auditOkCount: datasets.filter((dataset) => auditOk(dataset.audit)).length,
      totalBytes: datasets.reduce((sum, dataset) => sum + dataset.bytes, 0),
      latestGeneratedAt,
      caseCount: datasets.reduce((sum, dataset) => sum + dataset.readerSummary.caseCount, 0),
      distinctCaseTypeCount: Math.max(...datasets.map((dataset) => dataset.readerSummary.distinctCaseTypeCount)),
      evidenceNodeCount: datasets.reduce((sum, dataset) => sum + dataset.readerSummary.evidenceGraph.nodeCount, 0),
      publicCaseSummaryCount: datasets.reduce((sum, dataset) => sum + (dataset.caseSummaryCount || 0), 0)
    },
    publicBoundary: {
      staticOnly: true,
      apiRoutesAllowed: false,
      artifactBodiesIncluded: false,
      allowedFetchPrefixes: ["/review-catalog/", "/dataset-reader/"]
    },
    contentSummary: contentReport.summary,
    stableWorldSummaryPath: "/review-catalog/stable-world-summary.json",
    stableWorldSummaryHash,
    stableWorld,
    caseQualitySummaryPath: "/review-catalog/case-quality-summary.json",
    caseQualitySummaryHash,
    caseQuality,
    worldSystemInfluenceSummaryPath: "/review-catalog/world-system-influence-summary.json",
    worldSystemInfluenceSummaryHash,
    worldSystemInfluence,
    datasets
  };

  if (fs.existsSync(resolvedCatalogRoot)) fs.rmSync(resolvedCatalogRoot, { recursive: true, force: true });
  fs.mkdirSync(resolvedCatalogRoot, { recursive: true });
  const stableWorldSummaryPath = path.join(resolvedCatalogRoot, "stable-world-summary.json");
  fs.writeFileSync(stableWorldSummaryPath, stableWorldSummaryText, "utf8");
  const caseQualitySummaryPath = path.join(resolvedCatalogRoot, "case-quality-summary.json");
  fs.writeFileSync(caseQualitySummaryPath, caseQualitySummaryText, "utf8");
  const worldSystemInfluenceSummaryPath = path.join(resolvedCatalogRoot, "world-system-influence-summary.json");
  fs.writeFileSync(worldSystemInfluenceSummaryPath, worldSystemInfluenceSummaryText, "utf8");
  writeJson(path.join(resolvedCatalogRoot, "index.json"), catalog);
  fs.writeFileSync(path.join(resolvedCatalogRoot, "catalog-card.md"), makeCatalogCard(catalog), "utf8");
  return validatePublicReviewCatalog({ catalogRoot, root, expected: catalog });
}

export function validatePublicReviewCatalog({
  catalogRoot = DEFAULT_CATALOG_ROOT,
  root = process.cwd(),
  expected
} = {}) {
  const resolvedCatalogRoot = assertInside(path.resolve(root, "public"), path.resolve(root, catalogRoot), "Catalog root");
  const errors = [];
  if (!fs.existsSync(resolvedCatalogRoot)) {
    return { ok: false, relativePath: catalogRoot, fileCount: 0, bytes: 0, errors: [`${catalogRoot} does not exist.`], warnings: [] };
  }
  const allowed = validateAllowedFileSet({ dir: resolvedCatalogRoot, allowedFiles: ["catalog-card.md", "case-quality-summary.json", "index.json", "stable-world-summary.json", "world-system-influence-summary.json"], label: "public/review-catalog" });
  const scan = scanPublicTextFiles({ dir: resolvedCatalogRoot, label: "public/review-catalog" });
  errors.push(...allowed.errors, ...scan.errors);
  const files = allowed.files;
  const indexPath = path.join(resolvedCatalogRoot, "index.json");
  const catalog = fs.existsSync(indexPath) ? readJson(indexPath) : null;
  if (catalog?.schemaVersion !== CATALOG_SCHEMA_VERSION) errors.push("index.json schemaVersion must be public-review-catalog.v1.");
  if (!catalog?.publicBoundary?.staticOnly || catalog?.publicBoundary?.apiRoutesAllowed !== false || catalog?.publicBoundary?.artifactBodiesIncluded !== false) {
    errors.push("publicBoundary must describe a static-only catalog with no API routes or artifact bodies.");
  }
  if (!Array.isArray(catalog?.datasets) || catalog.datasets.length === 0) errors.push("catalog datasets must be a non-empty array.");
  const stableWorldSummaryPath = path.join(resolvedCatalogRoot, "stable-world-summary.json");
  const stableWorldFile = fs.existsSync(stableWorldSummaryPath) ? readJson(stableWorldSummaryPath) : null;
  if (catalog?.stableWorldSummaryPath !== "/review-catalog/stable-world-summary.json") errors.push("stableWorldSummaryPath must point at /review-catalog/stable-world-summary.json.");
  if (!catalog?.stableWorldSummaryHash) errors.push("stableWorldSummaryHash is required.");
  if (!stableWorldFile) {
    errors.push("stable-world-summary.json is required.");
  } else {
    const stableWorldValidation = validateStableWorldSummary(stableWorldFile);
    errors.push(...stableWorldValidation.errors);
    if (catalog?.stableWorldSummaryHash !== sha256(fs.readFileSync(stableWorldSummaryPath))) errors.push("stableWorldSummaryHash does not match stable-world-summary.json.");
    if (JSON.stringify(catalog?.stableWorld) !== JSON.stringify(stableWorldFile)) errors.push("index.json stableWorld must match stable-world-summary.json.");
  }
  const caseQualitySummaryPath = path.join(resolvedCatalogRoot, "case-quality-summary.json");
  const caseQualityFile = fs.existsSync(caseQualitySummaryPath) ? readJson(caseQualitySummaryPath) : null;
  if (catalog?.caseQualitySummaryPath !== "/review-catalog/case-quality-summary.json") errors.push("caseQualitySummaryPath must point at /review-catalog/case-quality-summary.json.");
  if (!catalog?.caseQualitySummaryHash) errors.push("caseQualitySummaryHash is required.");
  if (!caseQualityFile) {
    errors.push("case-quality-summary.json is required.");
  } else {
    const caseQualityValidation = validateCaseQualitySummary(caseQualityFile);
    errors.push(...caseQualityValidation.errors);
    if (catalog?.caseQualitySummaryHash !== sha256(fs.readFileSync(caseQualitySummaryPath))) errors.push("caseQualitySummaryHash does not match case-quality-summary.json.");
    if (JSON.stringify(catalog?.caseQuality) !== JSON.stringify(caseQualityFile)) errors.push("index.json caseQuality must match case-quality-summary.json.");
  }
  const worldSystemInfluenceSummaryPath = path.join(resolvedCatalogRoot, "world-system-influence-summary.json");
  const worldSystemInfluenceFile = fs.existsSync(worldSystemInfluenceSummaryPath) ? readJson(worldSystemInfluenceSummaryPath) : null;
  if (catalog?.worldSystemInfluenceSummaryPath !== "/review-catalog/world-system-influence-summary.json") errors.push("worldSystemInfluenceSummaryPath must point at /review-catalog/world-system-influence-summary.json.");
  if (!catalog?.worldSystemInfluenceSummaryHash) errors.push("worldSystemInfluenceSummaryHash is required.");
  if (!worldSystemInfluenceFile) {
    errors.push("world-system-influence-summary.json is required.");
  } else {
    const worldSystemInfluenceValidation = validateWorldSystemInfluenceSummary(worldSystemInfluenceFile);
    errors.push(...worldSystemInfluenceValidation.errors);
    if (catalog?.worldSystemInfluenceSummaryHash !== sha256(fs.readFileSync(worldSystemInfluenceSummaryPath))) errors.push("worldSystemInfluenceSummaryHash does not match world-system-influence-summary.json.");
    if (JSON.stringify(catalog?.worldSystemInfluence) !== JSON.stringify(worldSystemInfluenceFile)) errors.push("index.json worldSystemInfluence must match world-system-influence-summary.json.");
  }
  if (catalog?.contentSummary) {
    const content = catalog.contentSummary;
    if (content.schemaVersion !== "detective-content-pack.v1") errors.push("contentSummary schemaVersion must be detective-content-pack.v1.");
    if (!content.validation?.ok || content.validation.errorCount !== 0) errors.push("contentSummary validation must be clean.");
    for (const key of ["caseTypeCount", "evidenceTypeCount", "locationCount", "roleCount", "motiveCount", "resourceCount", "factionCount", "eventArchetypeCount", "progressionLineCount", "worldSystemCount", "worldSystemRecordCount"]) {
      if (!Number.isFinite(content[key]) || content[key] <= 0) errors.push(`contentSummary ${key} must be positive.`);
    }
    for (const key of ["resourcesWithCases", "resourcesWithRoles", "factionsWithResources", "eventArchetypesWithFactions", "progressionLinesWithEvents", "worldSystemsWithRefs"]) {
      if (!Number.isFinite(content.coverage?.[key]) || content.coverage[key] <= 0) errors.push(`contentSummary coverage.${key} must be positive.`);
    }
    if (content.tableCounts && typeof content.tableCounts === "object") {
      for (const [key, value] of Object.entries(content.tableCounts)) {
        if (!Number.isFinite(value) || value <= 0) errors.push(`contentSummary tableCounts.${key} must be positive.`);
      }
    } else {
      errors.push("contentSummary tableCounts must be present.");
    }
  }
  for (const dataset of catalog?.datasets || []) {
    if (!/^[a-z0-9._-]+$/i.test(dataset.datasetId || "")) errors.push(`datasetId is invalid: ${dataset.datasetId || ""}`);
    for (const key of ["staticPath", "manifestPath", "readerIndexPath", "datasetCardPath", "caseSummaryIndexPath"]) {
      if (!String(dataset[key] || "").startsWith("/dataset-reader/")) errors.push(`${dataset.datasetId} ${key} must point at /dataset-reader/.`);
    }
    if (!dataset.gate?.ok) errors.push(`${dataset.datasetId} gate must be ok.`);
    if (!auditOk(dataset.audit)) errors.push(`${dataset.datasetId} audit must be clean.`);
    const readerPath = publicUrlToFile(root, dataset.readerIndexPath);
    if (!fs.existsSync(readerPath)) {
      errors.push(`${dataset.datasetId} readerIndexPath does not exist.`);
    } else if (dataset.readerIndexHash !== sha256(fs.readFileSync(readerPath))) {
      errors.push(`${dataset.datasetId} readerIndexHash does not match reader file.`);
    }
    const caseSummaryPath = publicUrlToFile(root, dataset.caseSummaryIndexPath);
    if (!fs.existsSync(caseSummaryPath)) {
      errors.push(`${dataset.datasetId} caseSummaryIndexPath does not exist.`);
    } else {
      const caseSummary = validatePublicCaseSummaryIndexFile({ filePath: caseSummaryPath, label: `${dataset.datasetId} case-summary-index.json` });
      errors.push(...caseSummary.errors);
      if (dataset.caseSummaryIndexHash !== sha256(fs.readFileSync(caseSummaryPath))) errors.push(`${dataset.datasetId} caseSummaryIndexHash does not match case-summary-index file.`);
      if (dataset.caseSummaryCount !== caseSummary.index.caseCount) errors.push(`${dataset.datasetId} caseSummaryCount does not match case-summary-index.`);
    }
  }
  if (expected && catalog) {
    if (catalog.summary.datasetCount !== expected.summary.datasetCount) errors.push("catalog summary datasetCount changed after write.");
    if (catalog.summary.totalBytes !== expected.summary.totalBytes) errors.push("catalog summary totalBytes changed after write.");
  }
  const bytes = files.reduce((sum, file) => sum + fs.statSync(path.join(resolvedCatalogRoot, file)).size, 0);
  return {
    ok: errors.length === 0,
    relativePath: toPosix(path.relative(root, resolvedCatalogRoot)),
    fileCount: files.length,
    bytes,
    errors: Array.from(new Set(errors)),
    warnings: [],
    catalog
  };
}
