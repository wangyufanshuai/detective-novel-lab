import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { PackageCatalogIndex } from "./package-catalog-types.ts";
import type { ReplayDatasetIndex, ReplayDatasetRun } from "./replay-catalog-types.ts";
import type {
  DatasetGateSummary,
  DatasetPackageExportReport,
  DatasetPackageFile,
  DatasetPackageListResult,
  DatasetPackageManifest,
  DatasetPackageValidationReport,
  DatasetReaderDistributionItem,
  DatasetReaderIndex,
  DatasetReaderSummary,
  PublicCaseSummaryIndex,
  StaticDatasetReaderExportReport,
  StaticDatasetReaderManifest
} from "./dataset-package-types.ts";

const DEFAULT_DATASET_ID = "detective-town-v3-5000-campaign";
const DATASET_SCHEMA_VERSION = "dataset-package.v1";
const DATASET_READER_SCHEMA_VERSION = "dataset-reader.v1";
const STATIC_READER_SCHEMA_VERSION = "static-dataset-reader.v1";
const PUBLIC_CASE_SUMMARY_SCHEMA_VERSION = "public-case-summary-index.v1";
const WORLD_PACKAGE_FILES = [
  "manifest.json",
  "scenario-pack.json",
  "map-pack.json",
  "rule-catalog.json",
  "agent-pack.json",
  "ecosystem-catalog.json",
  "expectations.json",
  "README.md",
  "ATTRIBUTION.md"
] as const;
const TEXT_FILE_RE = /\.(json|md|txt|yaml|yml|csv|sha256)$/i;
const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9][A-Za-z0-9_-]{12,}\b/,
  /"(?:apiKey|api_key|secretKey|token)"\s*:/i,
  /Authorization\s*:\s*Bearer/i,
  /\.env\.local/i
];
const FORBIDDEN_KEYS = new Set(["checkpoint", "agent_state_snapshot", "hiddenDebugLog"]);

function isForbiddenDatasetKey(key: string) {
  return FORBIDDEN_KEYS.has(key) || /checkpoint/i.test(key);
}

function rootDir(input?: string) {
  return input ? path.resolve(input) : path.resolve(/*turbopackIgnore: true*/ process.cwd());
}

function datasetRoot(root: string) {
  return path.join(/*turbopackIgnore: true*/ root, "outputs", "dataset-packages");
}

function staticDatasetReaderRoot(root: string) {
  return path.join(/*turbopackIgnore: true*/ root, "public", "dataset-reader");
}

function toPosix(value: string) {
  return value.replace(/\\/g, "/");
}

function safeName(value: string) {
  return value.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
}

function assertSafeId(value: string, label: string) {
  if (!/^[a-z0-9._-]+$/i.test(value)) throw new Error(`Invalid ${label}.`);
}

function safeRelative(root: string, target: string) {
  const relative = toPosix(path.relative(root, target));
  if (!relative || relative === ".." || relative.startsWith("../") || path.isAbsolute(relative)) {
    throw new Error("Path must stay inside workspace.");
  }
  return relative;
}

function isSafeRelativePath(value: string) {
  if (!value || path.isAbsolute(value)) return false;
  const normalized = path.normalize(value);
  return normalized !== ".." && !normalized.startsWith(`..${path.sep}`) && !normalized.includes(`${path.sep}..${path.sep}`);
}

function targetInside(base: string, relativePath: string) {
  if (!isSafeRelativePath(relativePath)) throw new Error(`Unsafe relative path: ${relativePath}`);
  const target = path.resolve(base, relativePath);
  const resolvedBase = path.resolve(base);
  if (target !== resolvedBase && !target.startsWith(`${resolvedBase}${path.sep}`)) throw new Error(`Path escapes target directory: ${relativePath}`);
  return target;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf8")) as T;
}

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(filePath), { recursive: true });
  fs.writeFileSync(/*turbopackIgnore: true*/ filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(data: Buffer | string) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => typeof item !== "undefined")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function walk(value: unknown, visit: (key: string, nested: unknown, objectPath: string[]) => void, objectPath: string[] = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, [...objectPath, String(index)]));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    const nextPath = [...objectPath, key];
    visit(key, nested, nextPath);
    walk(nested, visit, nextPath);
  }
}

function scanText(text: string, label: string, errors: string[]) {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(text)) errors.push(`${label} contains a secret-looking value.`);
  }
  if (/([A-Za-z]:[\\/]|\\\\[^\\]+\\[^\\]+)/.test(text)) errors.push(`${label} contains an absolute local path.`);
}

function scanJson(value: unknown, label: string, errors: string[]) {
  walk(value, (key, nested, objectPath) => {
    const pathLabel = `${label}:${objectPath.join(".")}`;
    if (isForbiddenDatasetKey(key)) errors.push(`${pathLabel} contains runtime-only state.`);
    if (/api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token/i.test(key)) errors.push(`${pathLabel} contains a secret-looking key.`);
    if (key === "truth" || key === "culpritId") errors.push(`${pathLabel} may contain hidden truth.`);
    if (typeof nested === "string") scanText(nested, pathLabel, errors);
  });
}

function sanitizeDatasetJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeDatasetJson);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (key === "truth" || key === "culpritId" || isForbiddenDatasetKey(key)) continue;
    out[key] = sanitizeDatasetJson(nested);
  }
  return out;
}

function copyTextFile(input: {
  root: string;
  source: string;
  outputDir: string;
  relativePath: string;
  role: DatasetPackageFile["role"];
  files: DatasetPackageFile[];
  errors: string[];
}) {
  let text = fs.readFileSync(/*turbopackIgnore: true*/ input.source, "utf8");
  if (input.role === "run-metadata" && input.relativePath.endsWith(".json")) {
    try {
      text = `${JSON.stringify(sanitizeDatasetJson(JSON.parse(text)), null, 2)}\n`;
    } catch {
      // Let the normal parse path below produce the validation error.
    }
  }
  scanText(text, input.relativePath, input.errors);
  if (input.relativePath.endsWith(".json")) {
    try {
      scanJson(JSON.parse(text), input.relativePath, input.errors);
    } catch (error) {
      input.errors.push(`${input.relativePath} is not valid JSON: ${error instanceof Error ? error.message : "parse failed"}`);
    }
  }
  const target = targetInside(input.outputDir, input.relativePath);
  fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(target), { recursive: true });
  fs.writeFileSync(/*turbopackIgnore: true*/ target, text, "utf8");
  input.files.push({
    path: toPosix(input.relativePath),
    bytes: Buffer.byteLength(text, "utf8"),
    sha256: sha256(text),
    role: input.role
  });
}

function readReplayIndex(root: string) {
  const indexPath = path.join(/*turbopackIgnore: true*/ root, "data", "replay-store", "index.json");
  if (!fs.existsSync(/*turbopackIgnore: true*/ indexPath)) throw new Error("Replay dataset index not found. Run npm run replay:audit first.");
  return readJson<ReplayDatasetIndex>(indexPath);
}

function readPackageIndex(root: string) {
  const indexPath = path.join(/*turbopackIgnore: true*/ root, "data", "package-catalog", "index.json");
  if (!fs.existsSync(/*turbopackIgnore: true*/ indexPath)) throw new Error("Package catalog index not found. Run npm run package:sync first.");
  return readJson<PackageCatalogIndex>(indexPath);
}

function metricNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function countValues(values: unknown[]): DatasetReaderDistributionItem[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") continue;
    const key = String(value);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id));
}

function distributionFromRecord(value: unknown): DatasetReaderDistributionItem[] {
  return Object.entries(recordValue(value))
    .filter(([, count]) => typeof count === "number" && Number.isFinite(count))
    .map(([id, count]) => ({ id, count: count as number }))
    .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id));
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value ? value : fallback;
}

function numericValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function publicCaseIdForOrdinal(ordinal: number) {
  return `public-case-${String(ordinal).padStart(3, "0")}`;
}

function buildPublicCaseSummaryIndex(input: {
  datasetId: string;
  sourceRunId: string;
  generatedAt: string;
  runDir: string;
}): PublicCaseSummaryIndex {
  const caseGraphPath = path.join(/*turbopackIgnore: true*/ input.runDir, "case-graph.json");
  const evidenceGraphPath = path.join(/*turbopackIgnore: true*/ input.runDir, "evidence-graph.json");
  if (!fs.existsSync(/*turbopackIgnore: true*/ caseGraphPath)) throw new Error("case-graph.json is required for public case summaries.");
  if (!fs.existsSync(/*turbopackIgnore: true*/ evidenceGraphPath)) throw new Error("evidence-graph.json is required for public case summaries.");
  const caseGraph = readJson<Record<string, unknown>>(caseGraphPath);
  const evidenceGraph = readJson<Record<string, unknown>>(evidenceGraphPath);
  const caseNodes = arrayValue(caseGraph.nodes).map(recordValue);
  const caseEdges = arrayValue(caseGraph.edges).map(recordValue);
  const caseUses = arrayValue(evidenceGraph.caseUses).map(recordValue);
  const caseUseById = new Map(caseUses.map((item) => [stringValue(item.caseId), item]));

  const cases = caseNodes
    .map((node, index) => {
      const rawCaseId = stringValue(node.caseId);
      const ordinal = Math.max(1, Math.round(numericValue(node.ordinal, index + 1)));
      const relatedEdges = caseEdges.filter((edge) => edge.fromCaseId === rawCaseId || edge.toCaseId === rawCaseId);
      const incomingEdges = relatedEdges.filter((edge) => edge.toCaseId === rawCaseId);
      const outgoingEdges = relatedEdges.filter((edge) => edge.fromCaseId === rawCaseId);
      const caseUse = caseUseById.get(rawCaseId);
      const evidenceCount = numericValue(caseUse?.evidenceCount, arrayValue(node.evidenceIds).length);
      const evidenceWarningCount = numericValue(caseUse?.warningCount, 0);
      return {
        publicCaseId: publicCaseIdForOrdinal(ordinal),
        sourceCaseHash: sha256(rawCaseId || `${input.sourceRunId}:${ordinal}`),
        ordinal,
        tick: Math.max(0, Math.round(numericValue(node.tick, 0))),
        caseType: stringValue(node.caseType, "unknown"),
        outcome: stringValue(node.outcome, "unknown"),
        locationId: stringValue(node.locationId, "unknown"),
        institutionCount: arrayValue(node.institutionIds).length,
        evidenceCount,
        evidenceWarningCount,
        evidenceComplete: caseUse?.complete === true,
        laterInfluence: {
          incomingEdgeCount: incomingEdges.length,
          outgoingEdgeCount: outgoingEdges.length,
          incomingStrengthTotal: incomingEdges.reduce((sum, edge) => sum + numericValue(edge.strength, 0), 0),
          outgoingStrengthTotal: outgoingEdges.reduce((sum, edge) => sum + numericValue(edge.strength, 0), 0)
        },
        edgeTypeCounts: countValues(relatedEdges.map((edge) => edge.type))
      };
    })
    .sort((left, right) => left.ordinal - right.ordinal || left.tick - right.tick);

  const edgeTypeDistribution = countValues(caseEdges.map((edge) => edge.type));
  return {
    schemaVersion: PUBLIC_CASE_SUMMARY_SCHEMA_VERSION,
    datasetId: input.datasetId,
    sourceRunId: input.sourceRunId,
    generatedAt: input.generatedAt,
    caseCount: cases.length,
    cases,
    summary: {
      caseCount: cases.length,
      caseTypeCount: new Set(cases.map((item) => item.caseType)).size,
      locationCount: new Set(cases.map((item) => item.locationId)).size,
      evidenceCompleteCount: cases.filter((item) => item.evidenceComplete).length,
      evidenceWarningCaseCount: cases.filter((item) => item.evidenceWarningCount > 0).length,
      totalEvidenceCount: cases.reduce((sum, item) => sum + item.evidenceCount, 0),
      laterInfluencedCaseCount: cases.filter((item) => item.laterInfluence.incomingEdgeCount > 0 || item.laterInfluence.outgoingEdgeCount > 0).length,
      edgeTypeDistribution
    }
  };
}

const PUBLIC_CASE_FORBIDDEN_KEYS = new Set([
  "caseId",
  "victimId",
  "evidenceIds",
  "aftermathIds",
  "sourceIds",
  "explanation",
  "fromCaseId",
  "toCaseId",
  "fromNodeId",
  "toNodeId",
  "actorId",
  "agentId",
  "npcId",
  "eventId",
  "replayBody",
  "packageBody"
]);

const PUBLIC_CASE_FORBIDDEN_VALUE_RE = /\b(?:npc|agent)-|evidence-chain-|aftermath-|case-\d{2,}-\d{3}-[a-f0-9]{8}\b/i;

function validatePublicCaseSummaryIndexShape(index: PublicCaseSummaryIndex, errors: string[], label = "case-summary-index.json") {
  if (index.schemaVersion !== PUBLIC_CASE_SUMMARY_SCHEMA_VERSION) errors.push(`${label} schemaVersion must be public-case-summary-index.v1.`);
  if (!/^[a-z0-9._-]+$/i.test(index.datasetId || "")) errors.push(`${label} datasetId is invalid.`);
  if (!/^[a-z0-9._-]+$/i.test(index.sourceRunId || "")) errors.push(`${label} sourceRunId is invalid.`);
  if (!Array.isArray(index.cases)) errors.push(`${label} cases must be an array.`);
  if (index.caseCount !== index.cases.length) errors.push(`${label} caseCount does not match cases length.`);
  if (index.summary?.caseCount !== index.cases.length) errors.push(`${label} summary caseCount does not match cases length.`);
  const seen = new Set<string>();
  for (const item of index.cases || []) {
    if (!/^public-case-\d{3,}$/.test(item.publicCaseId || "")) errors.push(`${label} publicCaseId is invalid.`);
    if (seen.has(item.publicCaseId)) errors.push(`${label} duplicate publicCaseId ${item.publicCaseId}.`);
    seen.add(item.publicCaseId);
    if (!/^[a-f0-9]{64}$/i.test(item.sourceCaseHash || "")) errors.push(`${label} sourceCaseHash is invalid for ${item.publicCaseId}.`);
    for (const [key, value] of Object.entries(item)) {
      if (PUBLIC_CASE_FORBIDDEN_KEYS.has(key)) errors.push(`${label} contains forbidden raw key ${key}.`);
      if (typeof value === "string" && PUBLIC_CASE_FORBIDDEN_VALUE_RE.test(value)) errors.push(`${label} contains forbidden raw id value in ${item.publicCaseId}.${key}.`);
    }
  }
  walk(index, (key, nested, objectPath) => {
    if (PUBLIC_CASE_FORBIDDEN_KEYS.has(key)) errors.push(`${label}:${objectPath.join(".")} contains a forbidden raw key.`);
    if (typeof nested === "string" && PUBLIC_CASE_FORBIDDEN_VALUE_RE.test(nested)) {
      errors.push(`${label}:${objectPath.join(".")} contains a forbidden raw id value.`);
    }
  });
}

function readRunGate(root: string, run: ReplayDatasetRun): DatasetGateSummary {
  const runDir = path.join(/*turbopackIgnore: true*/ root, "data", "replay-store", run.runId);
  const reportPath = path.join(/*turbopackIgnore: true*/ runDir, "campaign-report.json");
  const evidenceGraphPath = path.join(/*turbopackIgnore: true*/ runDir, "evidence-graph.json");
  const campaign = fs.existsSync(/*turbopackIgnore: true*/ reportPath) ? readJson<Record<string, unknown>>(reportPath) : {};
  const report = campaign.report as Record<string, unknown> | undefined;
  const metrics = report?.metrics as Record<string, unknown> | undefined;
  const diversity = metrics?.diversity as Record<string, unknown> | undefined;
  const performance = report?.performance as Record<string, unknown> | undefined;
  const manifestSummary = (readJson<Record<string, unknown>>(path.join(/*turbopackIgnore: true*/ runDir, "manifest.json")).summary || {}) as Record<string, unknown>;
  const evidenceGraph = fs.existsSync(/*turbopackIgnore: true*/ evidenceGraphPath) ? readJson<Record<string, unknown>>(evidenceGraphPath) : {};
  const warnings = Array.isArray(evidenceGraph.warnings) ? evidenceGraph.warnings.length : metricNumber(manifestSummary.evidenceGraphWarnings) || 0;
  const gate = {
    tickCount: metricNumber(campaign.tickCount) || run.tickCount || 0,
    uniqueCases: metricNumber(metrics?.uniqueCaseCount) || metricNumber(manifestSummary.uniqueCaseCount) || metricNumber(run.metrics?.uniqueCaseCount) || 0,
    distinctCaseTypeCount: metricNumber(diversity?.distinctCaseTypeCount) || metricNumber(manifestSummary.distinctCaseTypeCount) || metricNumber(run.metrics?.distinctCaseTypeCount) || 0,
    candidateRepeatRate: metricNumber(metrics?.candidateRepeatRate) || metricNumber(manifestSummary.candidateRepeatRate) || metricNumber(run.metrics?.candidateRepeatRate) || 0,
    laterCaseInfluenceRate: metricNumber(diversity?.laterCaseInfluenceRate) || metricNumber(manifestSummary.laterCaseInfluenceRate) || 0,
    evidenceGraphWarnings: warnings,
    runtimeMs: Math.round(metricNumber(performance?.totalMs) || metricNumber(manifestSummary.runtimeMs) || 0),
    ok: false
  };
  gate.ok =
    gate.tickCount >= 5000 &&
    gate.uniqueCases >= 30 &&
    gate.distinctCaseTypeCount >= 10 &&
    gate.candidateRepeatRate <= 15 &&
    gate.laterCaseInfluenceRate >= 70 &&
    gate.evidenceGraphWarnings === 0 &&
    gate.runtimeMs <= 300000;
  return gate;
}

function makeDatasetCard(input: {
  datasetId: string;
  run: ReplayDatasetRun;
  gate: DatasetGateSummary;
  replayIndex: ReplayDatasetIndex;
  packageIndex: PackageCatalogIndex;
  readerSummary: DatasetReaderSummary;
}) {
  const caseTypes = input.readerSummary.topCaseTypes.slice(0, 5).map((item) => `${item.id} (${item.count})`).join(", ") || "n/a";
  const evidenceTypes = input.readerSummary.topEvidenceTypes.slice(0, 5).map((item) => `${item.id} (${item.count})`).join(", ") || "n/a";
  return [
    `# ${input.datasetId}`,
    "",
    "Local Detective Novel Lab dataset package for offline review.",
    "",
    "## 5-Minute Offline Reader Path",
    "",
    "1. Open this card and `reader-index.json`.",
    "2. Check the 5000 tick gate and audit summary.",
    "3. Review the case/evidence graph summaries and top distributions.",
    "4. Check copied world package sources and `checksums.sha256`.",
    "",
    "## Source Run",
    "",
    `- Run: ${input.run.runId}`,
    `- Kind: ${input.run.kind}`,
    `- Status: ${input.run.status}`,
    `- Ticks: ${input.gate.tickCount}`,
    `- Unique cases: ${input.gate.uniqueCases}`,
    `- Case types: ${input.gate.distinctCaseTypeCount}`,
    `- Candidate repeat rate: ${input.gate.candidateRepeatRate}%`,
    `- Later-case influence: ${input.gate.laterCaseInfluenceRate}%`,
    `- Evidence graph warnings: ${input.gate.evidenceGraphWarnings}`,
    `- Runtime: ${input.gate.runtimeMs} ms`,
    `- Gate: ${input.gate.ok ? "ok" : "failed"}`,
    "",
    "## Reader Summary",
    "",
    `- Solved cases: ${input.readerSummary.solvedCaseCount}`,
    `- Failed cases: ${input.readerSummary.failedCaseCount}`,
    `- Case graph: ${input.readerSummary.caseGraph.nodeCount} nodes / ${input.readerSummary.caseGraph.edgeCount} edges`,
    `- Evidence graph: ${input.readerSummary.evidenceGraph.nodeCount} nodes / ${input.readerSummary.evidenceGraph.edgeCount} edges`,
    `- Evidence completeness: ${input.readerSummary.evidenceGraph.completeEvidenceCaseCount}/${input.readerSummary.evidenceGraph.resolvedEvidenceCaseCount} resolved cases`,
    `- Top case types: ${caseTypes}`,
    `- Top evidence types: ${evidenceTypes}`,
    `- World packages copied: ${input.readerSummary.worldPackageCount}`,
    "",
    "## Catalog Snapshots",
    "",
    `- Replay runs: ${input.replayIndex.summary.runCount}`,
    `- Replay files: ${input.replayIndex.summary.indexedFileCount}`,
    `- Packages: ${input.packageIndex.summary.packageCount}`,
    `- World packages: ${input.packageIndex.summary.byKind["world-package"] || 0}`,
    "",
    "## Safety Boundary",
    "",
    "This package must not contain API keys, local environment file contents, absolute paths, runtime checkpoints, agent state snapshots, hidden truth, or SQLite database files.",
    "Reader files contain aggregate metadata only; they do not expose package body text or raw hidden case fields.",
    ""
  ].join("\n");
}

function addGeneratedText(outputDir: string, files: DatasetPackageFile[], relativePath: string, role: DatasetPackageFile["role"], text: string) {
  const target = targetInside(outputDir, relativePath);
  fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(target), { recursive: true });
  fs.writeFileSync(/*turbopackIgnore: true*/ target, text, "utf8");
  files.push({ path: toPosix(relativePath), bytes: Buffer.byteLength(text, "utf8"), sha256: sha256(text), role });
}

function buildReaderIndex(input: {
  datasetId: string;
  run: ReplayDatasetRun;
  gate: DatasetGateSummary;
  audit: DatasetPackageManifest["audit"];
  packageIndex: PackageCatalogIndex;
  runDir: string;
  files: DatasetPackageFile[];
}): DatasetReaderIndex {
  const campaignPath = path.join(/*turbopackIgnore: true*/ input.runDir, "campaign-report.json");
  const caseGraphPath = path.join(/*turbopackIgnore: true*/ input.runDir, "case-graph.json");
  const evidenceGraphPath = path.join(/*turbopackIgnore: true*/ input.runDir, "evidence-graph.json");
  const campaign = fs.existsSync(/*turbopackIgnore: true*/ campaignPath) ? readJson<Record<string, unknown>>(campaignPath) : {};
  const caseGraph = fs.existsSync(/*turbopackIgnore: true*/ caseGraphPath) ? readJson<Record<string, unknown>>(caseGraphPath) : {};
  const evidenceGraph = fs.existsSync(/*turbopackIgnore: true*/ evidenceGraphPath) ? readJson<Record<string, unknown>>(evidenceGraphPath) : {};

  const report = recordValue(campaign.report);
  const reportSummary = recordValue(report.summary);
  const metrics = recordValue(report.metrics);
  const diversity = recordValue(metrics.diversity);
  const caseNodes = arrayValue(caseGraph.nodes).map(recordValue);
  const caseEdges = arrayValue(caseGraph.edges).map(recordValue);
  const evidenceNodes = arrayValue(evidenceGraph.nodes).map(recordValue);
  const evidenceEdges = arrayValue(evidenceGraph.edges).map(recordValue);
  const caseUses = arrayValue(evidenceGraph.caseUses).map(recordValue);
  const warningCount = arrayValue(evidenceGraph.warnings).length;

  const caseTypeDistribution = distributionFromRecord(diversity.caseTypeDistribution);
  const fallbackCaseTypeDistribution = countValues(caseNodes.map((node) => node.caseType));
  const finalCaseTypeDistribution = caseTypeDistribution.length ? caseTypeDistribution : fallbackCaseTypeDistribution;
  const evidenceItems = evidenceNodes.filter((node) => node.kind === "evidence");
  const evidenceTypeDistribution = countValues(evidenceItems.map((node) => node.evidenceKind || node.label));
  const edgeTypeDistribution = countValues(caseEdges.map((edge) => edge.type));
  const completeEvidenceCaseCount = caseUses.filter((item) => item.complete === true).length;
  const resolvedEvidenceCaseCount = caseUses.length;
  const worldPackages = input.packageIndex.packages
    .filter((entry) => entry.kind === "world-package" && entry.status === "valid")
    .map((entry) => ({
      packageId: entry.packageId,
      name: entry.name,
      version: entry.version,
      license: entry.license,
      contentHash: entry.contentHash
    }));

  const summary: DatasetReaderSummary = {
    caseCount: metricNumber(reportSummary.caseCount) || input.gate.uniqueCases,
    solvedCaseCount: metricNumber(reportSummary.solvedCaseCount) || 0,
    failedCaseCount: metricNumber(reportSummary.failedCaseCount) || 0,
    distinctCaseTypeCount: finalCaseTypeDistribution.length || input.gate.distinctCaseTypeCount,
    topCaseTypes: finalCaseTypeDistribution.slice(0, 8),
    distinctEvidenceTypeCount: evidenceTypeDistribution.length,
    topEvidenceTypes: evidenceTypeDistribution.slice(0, 8),
    caseGraph: {
      nodeCount: caseNodes.length || input.gate.uniqueCases,
      edgeCount: caseEdges.length,
      influencedLaterCaseCount: metricNumber(caseGraph.influencedLaterCaseCount) || 0,
      laterCaseInfluenceRate: metricNumber(caseGraph.laterCaseInfluenceRate) || input.gate.laterCaseInfluenceRate,
      topEdgeTypes: edgeTypeDistribution.slice(0, 8)
    },
    evidenceGraph: {
      nodeCount: evidenceNodes.length,
      edgeCount: evidenceEdges.length,
      evidenceNodeCount: evidenceItems.length,
      caseNodeCount: evidenceNodes.filter((node) => node.kind === "case").length,
      warningCount,
      completeEvidenceCaseCount,
      resolvedEvidenceCaseCount,
      completenessRate: resolvedEvidenceCaseCount ? Math.round((completeEvidenceCaseCount / resolvedEvidenceCaseCount) * 100) : 0
    },
    worldPackageCount: worldPackages.length
  };

  return {
    schemaVersion: DATASET_READER_SCHEMA_VERSION,
    datasetId: input.datasetId,
    sourceRunId: input.run.runId,
    generatedAt: new Date().toISOString(),
    gate: input.gate,
    audit: input.audit,
    summary,
    caseTypeDistribution: finalCaseTypeDistribution,
    evidenceTypeDistribution,
    worldPackages,
    files: input.files.map((file) => ({
      path: file.path,
      bytes: file.bytes,
      sha256: file.sha256,
      role: file.role
    }))
  };
}

function computeContentHash(files: DatasetPackageFile[]) {
  return sha256(stableStringify(files
    .filter((file) => file.path !== "dataset-manifest.json" && file.path !== "checksums.sha256")
    .map((file) => ({ path: file.path, bytes: file.bytes, sha256: file.sha256, role: file.role }))
    .sort((left, right) => left.path.localeCompare(right.path))));
}

function writeStaticReaderFile(input: {
  source: string;
  outputDir: string;
  relativePath: string;
  errors: string[];
}) {
  const data = fs.readFileSync(/*turbopackIgnore: true*/ input.source);
  const text = data.toString("utf8");
  scanText(text, input.relativePath, input.errors);
  if (input.relativePath.endsWith(".json")) {
    try {
      scanJson(JSON.parse(text), input.relativePath, input.errors);
    } catch (error) {
      input.errors.push(`${input.relativePath} is invalid JSON: ${error instanceof Error ? error.message : "parse failed"}`);
    }
  }
  const target = targetInside(input.outputDir, input.relativePath);
  fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(target), { recursive: true });
  fs.writeFileSync(/*turbopackIgnore: true*/ target, data);
  return {
    path: input.relativePath,
    bytes: data.length,
    sha256: sha256(data)
  };
}

function writeStaticReaderText(input: {
  text: string;
  outputDir: string;
  relativePath: string;
  errors: string[];
}) {
  scanText(input.text, input.relativePath, input.errors);
  if (input.relativePath.endsWith(".json")) {
    try {
      scanJson(JSON.parse(input.text), input.relativePath, input.errors);
    } catch (error) {
      input.errors.push(`${input.relativePath} is invalid JSON: ${error instanceof Error ? error.message : "parse failed"}`);
    }
  }
  const target = targetInside(input.outputDir, input.relativePath);
  fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(target), { recursive: true });
  fs.writeFileSync(/*turbopackIgnore: true*/ target, input.text, "utf8");
  return {
    path: input.relativePath,
    bytes: Buffer.byteLength(input.text, "utf8"),
    sha256: sha256(input.text)
  };
}

function makeStaticDatasetReaderCard(readerIndex: DatasetReaderIndex) {
  const summary = readerIndex.summary;
  const caseTypes = summary.topCaseTypes.slice(0, 5).map((item) => `${item.id} (${item.count})`).join(", ") || "n/a";
  const evidenceTypes = summary.topEvidenceTypes.slice(0, 5).map((item) => `${item.id} (${item.count})`).join(", ") || "n/a";
  return [
    `# ${readerIndex.datasetId}`,
    "",
    "Public static dataset reader for Detective Novel Lab.",
    "",
    "## 5-Minute Reader Path",
    "",
    "1. Check `manifest-lite.json` for source run, hashes, and file totals.",
    "2. Check `reader-index.json` for the 5000 tick gate and audit counts.",
    "3. Review graph totals plus case and evidence distributions.",
    "4. Open `case-summary-index.json` for spoiler-safe public case cards.",
    "",
    "## Source Run",
    "",
    `- Run: ${readerIndex.sourceRunId}`,
    `- Ticks: ${readerIndex.gate.tickCount}`,
    `- Unique cases: ${readerIndex.gate.uniqueCases}`,
    `- Case types: ${readerIndex.gate.distinctCaseTypeCount}`,
    `- Candidate repeat rate: ${readerIndex.gate.candidateRepeatRate}%`,
    `- Later-case influence: ${readerIndex.gate.laterCaseInfluenceRate}%`,
    `- Evidence graph warnings: ${readerIndex.gate.evidenceGraphWarnings}`,
    `- Runtime: ${readerIndex.gate.runtimeMs} ms`,
    `- Gate: ${readerIndex.gate.ok ? "ok" : "failed"}`,
    "",
    "## Reader Summary",
    "",
    `- Solved cases: ${summary.solvedCaseCount}`,
    `- Failed cases: ${summary.failedCaseCount}`,
    `- Case graph: ${summary.caseGraph.nodeCount} nodes / ${summary.caseGraph.edgeCount} edges`,
    `- Evidence graph: ${summary.evidenceGraph.nodeCount} nodes / ${summary.evidenceGraph.edgeCount} edges`,
    `- Evidence completeness: ${summary.evidenceGraph.completeEvidenceCaseCount}/${summary.evidenceGraph.resolvedEvidenceCaseCount} resolved cases`,
    `- Top case types: ${caseTypes}`,
    `- Top evidence types: ${evidenceTypes}`,
    `- World packages summarized: ${summary.worldPackageCount}`,
    "",
    "## Public Boundary",
    "",
    "This static reader contains aggregate review data and spoiler-safe case cards only. It does not include full run artifacts, database files, environment files, private runtime state, or source package bodies.",
    ""
  ].join("\n");
}

function validateReaderIndexShape(readerIndex: DatasetReaderIndex, errors: string[]) {
  if (readerIndex.schemaVersion !== DATASET_READER_SCHEMA_VERSION) errors.push("reader-index schemaVersion must be dataset-reader.v1.");
  if (!/^[a-z0-9._-]+$/i.test(readerIndex.datasetId || "")) errors.push("reader-index datasetId is invalid.");
  if (!/^[a-z0-9._-]+$/i.test(readerIndex.sourceRunId || "")) errors.push("reader-index sourceRunId is invalid.");
  if (!readerIndex.gate?.ok) errors.push("reader-index gate must be ok.");
  if (!readerIndex.audit?.ok || readerIndex.audit.errorCount || readerIndex.audit.secretLeakCount || readerIndex.audit.hiddenTruthLeakCount) errors.push("reader-index audit summary is not clean.");
  if (readerIndex.summary.caseCount !== readerIndex.gate.uniqueCases) errors.push("reader-index case count does not match gate unique cases.");
  if (readerIndex.summary.evidenceGraph.warningCount !== readerIndex.gate.evidenceGraphWarnings) errors.push("reader-index evidence warnings do not match gate.");
}

function validateStaticDatasetReader(input: { path: string; root?: string }) {
  const root = rootDir(input.root);
  const bundlePath = path.resolve(/*turbopackIgnore: true*/ root, input.path);
  const relativePath = safeRelative(root, bundlePath);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!fs.existsSync(/*turbopackIgnore: true*/ bundlePath) || !fs.statSync(/*turbopackIgnore: true*/ bundlePath).isDirectory()) {
    return { ok: false, relativePath, fileCount: 0, bytes: 0, errors: ["Static dataset reader directory does not exist."], warnings };
  }
  const actualFiles = listFiles(bundlePath);
  const allowedFiles = new Set(["reader-index.json", "dataset-card.md", "manifest-lite.json", "case-summary-index.json"]);
  for (const required of allowedFiles) {
    if (!actualFiles.includes(required)) errors.push(`${required} is required.`);
  }
  for (const file of actualFiles) {
    if (!allowedFiles.has(file)) errors.push(`${file} is not allowed in a static dataset reader bundle.`);
    const target = targetInside(bundlePath, file);
    const data = fs.readFileSync(/*turbopackIgnore: true*/ target);
    const text = data.toString("utf8");
    scanText(text, file, errors);
    if (file.endsWith(".json")) {
      try {
        scanJson(JSON.parse(text), file, errors);
      } catch (error) {
        errors.push(`${file} is invalid JSON: ${error instanceof Error ? error.message : "parse failed"}`);
      }
    }
  }
  let manifest: StaticDatasetReaderManifest | undefined;
  let readerIndex: DatasetReaderIndex | undefined;
  let caseSummaryIndex: PublicCaseSummaryIndex | undefined;
  const manifestPath = path.join(/*turbopackIgnore: true*/ bundlePath, "manifest-lite.json");
  const readerPath = path.join(/*turbopackIgnore: true*/ bundlePath, "reader-index.json");
  const caseSummaryPath = path.join(/*turbopackIgnore: true*/ bundlePath, "case-summary-index.json");
  if (fs.existsSync(/*turbopackIgnore: true*/ manifestPath)) {
    try {
      manifest = readJson<StaticDatasetReaderManifest>(manifestPath);
      if (manifest.schemaVersion !== STATIC_READER_SCHEMA_VERSION) errors.push("manifest-lite schemaVersion must be static-dataset-reader.v1.");
      if (manifest.readerIndexPath !== "reader-index.json") errors.push("manifest-lite readerIndexPath must be reader-index.json.");
      if (manifest.datasetCardPath !== "dataset-card.md") errors.push("manifest-lite datasetCardPath must be dataset-card.md.");
      if (manifest.caseSummaryIndexPath !== "case-summary-index.json") errors.push("manifest-lite caseSummaryIndexPath must be case-summary-index.json.");
      if (!manifest.caseSummaryIndexHash) errors.push("manifest-lite caseSummaryIndexHash is required.");
    } catch (error) {
      errors.push(`manifest-lite.json is invalid JSON: ${error instanceof Error ? error.message : "parse failed"}`);
    }
  }
  if (fs.existsSync(/*turbopackIgnore: true*/ readerPath)) {
    try {
      readerIndex = readJson<DatasetReaderIndex>(readerPath);
      validateReaderIndexShape(readerIndex, errors);
    } catch (error) {
      errors.push(`reader-index.json is invalid JSON: ${error instanceof Error ? error.message : "parse failed"}`);
    }
  }
  if (fs.existsSync(/*turbopackIgnore: true*/ caseSummaryPath)) {
    try {
      caseSummaryIndex = readJson<PublicCaseSummaryIndex>(caseSummaryPath);
      validatePublicCaseSummaryIndexShape(caseSummaryIndex, errors);
    } catch (error) {
      errors.push(`case-summary-index.json is invalid JSON: ${error instanceof Error ? error.message : "parse failed"}`);
    }
  }
  if (manifest && readerIndex) {
    const readerBytes = fs.readFileSync(/*turbopackIgnore: true*/ readerPath);
    if (manifest.datasetId !== readerIndex.datasetId) errors.push("manifest-lite datasetId does not match reader-index.");
    if (manifest.sourceRunId !== readerIndex.sourceRunId) errors.push("manifest-lite sourceRunId does not match reader-index.");
    if (manifest.readerIndexHash !== sha256(readerBytes)) errors.push("manifest-lite readerIndexHash does not match reader-index file.");
    if (manifest.readerSummary.caseCount !== readerIndex.summary.caseCount) errors.push("manifest-lite readerSummary does not match reader-index.");
  }
  if (manifest && readerIndex && caseSummaryIndex) {
    const caseSummaryBytes = fs.readFileSync(/*turbopackIgnore: true*/ caseSummaryPath);
    if (caseSummaryIndex.datasetId !== readerIndex.datasetId) errors.push("case-summary-index datasetId does not match reader-index.");
    if (caseSummaryIndex.sourceRunId !== readerIndex.sourceRunId) errors.push("case-summary-index sourceRunId does not match reader-index.");
    if (caseSummaryIndex.caseCount !== readerIndex.summary.caseCount) errors.push("case-summary-index case count does not match reader-index.");
    if (manifest.caseSummaryIndexHash !== sha256(caseSummaryBytes)) errors.push("manifest-lite caseSummaryIndexHash does not match case-summary-index file.");
  }
  const bytes = actualFiles.reduce((sum, file) => sum + fs.statSync(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ bundlePath, file)).size, 0);
  return {
    ok: errors.length === 0,
    datasetId: manifest?.datasetId || readerIndex?.datasetId,
    relativePath,
    fileCount: actualFiles.length,
    bytes,
    errors: Array.from(new Set(errors)),
    warnings: Array.from(new Set(warnings)),
    gate: manifest?.gate || readerIndex?.gate,
    audit: manifest?.audit || readerIndex?.audit,
    readerSummary: manifest?.readerSummary || readerIndex?.summary,
    manifest,
    readerIndex,
    caseSummary: caseSummaryIndex?.summary
  };
}

export function exportDatasetPackage(input: {
  runId: string;
  datasetId?: string;
  root?: string;
}): DatasetPackageExportReport {
  assertSafeId(input.runId, "run id");
  const root = rootDir(input.root);
  const datasetId = safeName(input.datasetId || DEFAULT_DATASET_ID);
  assertSafeId(datasetId, "dataset id");
  const replayIndex = readReplayIndex(root);
  const packageIndex = readPackageIndex(root);
  const run = replayIndex.runs.find((item) => item.runId === input.runId);
  if (!run) throw new Error(`Replay run ${input.runId} was not found in replay index.`);
  if (run.kind !== "campaign") throw new Error("Dataset export requires a campaign run.");
  const gate = readRunGate(root, run);
  if (!gate.ok) throw new Error(`Source run does not satisfy the 5000 tick dataset gate: ${JSON.stringify(gate)}`);
  if (!replayIndex.audit.ok) throw new Error(`Replay audit has ${replayIndex.audit.errorCount} error(s).`);
  if (replayIndex.audit.secretLeakCount || replayIndex.audit.hiddenTruthLeakCount) throw new Error("Replay audit reports secret or hidden truth leaks.");

  const outputRoot = datasetRoot(root);
  const outputDir = path.join(/*turbopackIgnore: true*/ outputRoot, datasetId);
  const relativeExportPath = safeRelative(root, outputDir);
  const outputRelative = path.relative(outputRoot, path.resolve(/*turbopackIgnore: true*/ outputDir));
  if (outputRelative === ".." || outputRelative.startsWith(`..${path.sep}`) || path.isAbsolute(outputRelative)) throw new Error("Dataset output path must stay inside outputs/dataset-packages.");
  if (fs.existsSync(/*turbopackIgnore: true*/ outputDir)) fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(/*turbopackIgnore: true*/ outputDir, { recursive: true });

  const files: DatasetPackageFile[] = [];
  const errors: string[] = [];
  addGeneratedText(outputDir, files, "replay-index.snapshot.json", "snapshot", `${JSON.stringify(replayIndex, null, 2)}\n`);
  addGeneratedText(outputDir, files, "package-index.snapshot.json", "snapshot", `${JSON.stringify(packageIndex, null, 2)}\n`);
  addGeneratedText(outputDir, files, "audit-report.json", "audit", `${JSON.stringify(replayIndex.audit, null, 2)}\n`);
  const runDir = path.join(/*turbopackIgnore: true*/ root, "data", "replay-store", run.runId);
  const audit = {
    ok: replayIndex.audit.ok,
    errorCount: replayIndex.audit.errorCount,
    warningCount: replayIndex.audit.warningCount,
    secretLeakCount: replayIndex.audit.secretLeakCount,
    hiddenTruthLeakCount: replayIndex.audit.hiddenTruthLeakCount
  };
  const readerDraft = buildReaderIndex({ datasetId, run, gate, audit, packageIndex, runDir, files });
  addGeneratedText(outputDir, files, "dataset-card.md", "card", makeDatasetCard({ datasetId, run, gate, replayIndex, packageIndex, readerSummary: readerDraft.summary }));

  for (const file of run.files) {
    const source = targetInside(runDir, file.path);
    if (!fs.existsSync(/*turbopackIgnore: true*/ source)) throw new Error(`Run file missing: ${file.path}`);
    copyTextFile({ root, source, outputDir, relativePath: `runs/${run.runId}/${file.path}`, role: "run-metadata", files, errors });
  }

  const worldPackages = packageIndex.packages.filter((entry) => entry.kind === "world-package" && entry.status === "valid");
  for (const entry of worldPackages) {
    const sourceDir = targetInside(root, entry.relativePath);
    for (const fileName of WORLD_PACKAGE_FILES) {
      const source = path.join(/*turbopackIgnore: true*/ sourceDir, fileName);
      if (!fs.existsSync(/*turbopackIgnore: true*/ source)) continue;
      copyTextFile({ root, source, outputDir, relativePath: `world-packs/${entry.packageId}/${fileName}`, role: "world-package", files, errors });
    }
  }
  if (errors.length) throw new Error(`Dataset package safety scan failed: ${Array.from(new Set(errors)).join("; ")}`);

  const readerIndex = buildReaderIndex({ datasetId, run, gate, audit, packageIndex, runDir, files });
  const readerText = `${JSON.stringify(readerIndex, null, 2)}\n`;
  addGeneratedText(outputDir, files, "reader-index.json", "reader", readerText);
  const readerIndexHash = sha256(readerText);

  const contentHash = computeContentHash(files);
  const checksums = files
    .filter((file) => file.path !== "checksums.sha256")
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((file) => `${file.sha256}  ${file.path}`)
    .join("\n") + "\n";
  addGeneratedText(outputDir, files, "checksums.sha256", "checksum", checksums);

  const manifest: DatasetPackageManifest = {
    schemaVersion: DATASET_SCHEMA_VERSION,
    datasetId,
    title: "Detective Town v3 5000 Tick Campaign Dataset",
    generatedAt: new Date().toISOString(),
    sourceRunId: run.runId,
    sourceRunKind: run.kind,
    replayIndexSnapshotPath: "replay-index.snapshot.json",
    packageIndexSnapshotPath: "package-index.snapshot.json",
    auditReportPath: "audit-report.json",
    datasetCardPath: "dataset-card.md",
    readerIndexPath: "reader-index.json",
    checksumPath: "checksums.sha256",
    contentHash,
    fileCount: files.length + 1,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    gate,
    audit,
    files,
    readerSummary: readerIndex.summary,
    readerIndexHash,
    worldPackages: worldPackages.map((entry) => ({
      packageId: entry.packageId,
      name: entry.name,
      version: entry.version,
      license: entry.license,
      relativePath: `world-packs/${entry.packageId}`,
      contentHash: entry.contentHash
    }))
  };
  manifest.files = files;
  manifest.fileCount = files.length + 1;
  const nonManifestBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const manifestBytes = Buffer.byteLength(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const nextBytes = nonManifestBytes + manifestBytes;
    if (manifest.bytes === nextBytes) break;
    manifest.bytes = nextBytes;
  }
  writeJson(path.join(/*turbopackIgnore: true*/ outputDir, "dataset-manifest.json"), manifest);

  return {
    ok: true,
    datasetId,
    relativeExportPath,
    manifestPath: "dataset-manifest.json",
    contentHash,
    fileCount: manifest.fileCount,
    bytes: manifest.bytes,
    gate,
    audit: manifest.audit,
    readerSummary: manifest.readerSummary,
    readerIndexHash: manifest.readerIndexHash,
    warnings: replayIndex.audit.findings.filter((finding) => finding.severity === "warning").map((finding) => finding.message).slice(0, 20)
  };
}

export function exportStaticDatasetReader(input: {
  path: string;
  datasetId?: string;
  root?: string;
}): StaticDatasetReaderExportReport {
  const validation = validateDatasetPackage(input);
  if (!validation.ok) throw new Error(`Dataset package validation failed: ${validation.errors.join("; ")}`);
  const root = rootDir(input.root);
  const packagePath = path.resolve(/*turbopackIgnore: true*/ root, input.path);
  const sourceManifest = readJson<DatasetPackageManifest>(path.join(/*turbopackIgnore: true*/ packagePath, "dataset-manifest.json"));
  const datasetId = safeName(input.datasetId || sourceManifest.datasetId || DEFAULT_DATASET_ID);
  assertSafeId(datasetId, "dataset id");
  const readerPath = sourceManifest.readerIndexPath || "reader-index.json";
  const readerSource = targetInside(packagePath, readerPath);
  if (!fs.existsSync(/*turbopackIgnore: true*/ readerSource)) throw new Error("reader-index.json is required before static reader export.");

  const outputRoot = staticDatasetReaderRoot(root);
  const outputDir = path.join(/*turbopackIgnore: true*/ outputRoot, datasetId);
  const relativeExportPath = safeRelative(root, outputDir);
  const outputRelative = path.relative(outputRoot, path.resolve(/*turbopackIgnore: true*/ outputDir));
  if (outputRelative === ".." || outputRelative.startsWith(`..${path.sep}`) || path.isAbsolute(outputRelative)) throw new Error("Static reader output path must stay inside public/dataset-reader.");
  if (fs.existsSync(/*turbopackIgnore: true*/ outputDir)) fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(/*turbopackIgnore: true*/ outputDir, { recursive: true });

  const errors: string[] = [];
  const readerFile = writeStaticReaderFile({ source: readerSource, outputDir, relativePath: "reader-index.json", errors });
  const readerIndex = readJson<DatasetReaderIndex>(readerSource);
  const cardFile = writeStaticReaderText({ text: makeStaticDatasetReaderCard(readerIndex), outputDir, relativePath: "dataset-card.md", errors });
  const sourceRunDir = targetInside(packagePath, `runs/${sourceManifest.sourceRunId}`);
  const caseSummaryIndex = buildPublicCaseSummaryIndex({
    datasetId,
    sourceRunId: sourceManifest.sourceRunId,
    generatedAt: readerIndex.generatedAt || sourceManifest.generatedAt,
    runDir: sourceRunDir
  });
  validatePublicCaseSummaryIndexShape(caseSummaryIndex, errors);
  const caseSummaryFile = writeStaticReaderText({
    text: `${JSON.stringify(caseSummaryIndex, null, 2)}\n`,
    outputDir,
    relativePath: "case-summary-index.json",
    errors
  });
  validateReaderIndexShape(readerIndex, errors);
  if (readerIndex.datasetId !== sourceManifest.datasetId) errors.push("reader-index datasetId does not match source manifest.");
  if (readerIndex.sourceRunId !== sourceManifest.sourceRunId) errors.push("reader-index sourceRunId does not match source manifest.");
  if (readerIndex.summary.caseCount !== sourceManifest.gate.uniqueCases) errors.push("reader-index summary does not match source manifest gate.");
  if (caseSummaryIndex.caseCount !== readerIndex.summary.caseCount) errors.push("case-summary-index case count does not match reader-index.");
  if (errors.length) throw new Error(`Static dataset reader safety scan failed: ${Array.from(new Set(errors)).join("; ")}`);

  const contentHash = sha256(stableStringify([
    { path: readerFile.path, bytes: readerFile.bytes, sha256: readerFile.sha256 },
    { path: cardFile.path, bytes: cardFile.bytes, sha256: cardFile.sha256 },
    { path: caseSummaryFile.path, bytes: caseSummaryFile.bytes, sha256: caseSummaryFile.sha256 }
  ]));
  const manifest: StaticDatasetReaderManifest = {
    schemaVersion: STATIC_READER_SCHEMA_VERSION,
    datasetId,
    sourceRunId: sourceManifest.sourceRunId,
    generatedAt: readerIndex.generatedAt || sourceManifest.generatedAt,
    contentHash,
    readerIndexHash: readerFile.sha256,
    caseSummaryIndexPath: "case-summary-index.json",
    caseSummaryIndexHash: caseSummaryFile.sha256,
    fileCount: 4,
    bytes: readerFile.bytes + cardFile.bytes + caseSummaryFile.bytes,
    readerIndexPath: "reader-index.json",
    datasetCardPath: "dataset-card.md",
    gate: readerIndex.gate,
    audit: readerIndex.audit,
    readerSummary: readerIndex.summary
  };
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const manifestBytes = Buffer.byteLength(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const nextBytes = readerFile.bytes + cardFile.bytes + caseSummaryFile.bytes + manifestBytes;
    if (manifest.bytes === nextBytes) break;
    manifest.bytes = nextBytes;
  }
  writeJson(path.join(/*turbopackIgnore: true*/ outputDir, "manifest-lite.json"), manifest);
  const staticValidation = validateStaticDatasetReader({ path: relativeExportPath, root });
  if (!staticValidation.ok) throw new Error(`Static dataset reader validation failed: ${staticValidation.errors.join("; ")}`);

  return {
    ok: true,
    datasetId,
    relativeExportPath,
    contentHash,
    readerIndexHash: readerFile.sha256,
    caseSummaryIndexPath: "case-summary-index.json",
    caseSummaryIndexHash: caseSummaryFile.sha256,
    fileCount: manifest.fileCount,
    bytes: manifest.bytes,
    gate: manifest.gate,
    audit: manifest.audit,
    readerSummary: manifest.readerSummary,
    warnings: staticValidation.warnings
  };
}

function listFiles(dir: string, base = dir): string[] {
  if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) return [];
  return fs.readdirSync(/*turbopackIgnore: true*/ dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(/*turbopackIgnore: true*/ dir, entry.name);
    if (entry.isDirectory()) return listFiles(target, base);
    return [toPosix(path.relative(base, target))];
  }).sort((left, right) => left.localeCompare(right));
}

export function validateDatasetPackage(input: { path: string; root?: string }): DatasetPackageValidationReport {
  const root = rootDir(input.root);
  const packagePath = path.resolve(/*turbopackIgnore: true*/ root, input.path);
  const relativePath = safeRelative(root, packagePath);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!fs.existsSync(/*turbopackIgnore: true*/ packagePath) || !fs.statSync(/*turbopackIgnore: true*/ packagePath).isDirectory()) {
    return { ok: false, relativePath, fileCount: 0, bytes: 0, errors: ["Dataset package directory does not exist."], warnings };
  }
  const manifestPath = path.join(/*turbopackIgnore: true*/ packagePath, "dataset-manifest.json");
  if (!fs.existsSync(/*turbopackIgnore: true*/ manifestPath)) {
    return { ok: false, relativePath, fileCount: 0, bytes: 0, errors: ["dataset-manifest.json is required."], warnings };
  }
  let manifest: DatasetPackageManifest | undefined;
  try {
    manifest = readJson<DatasetPackageManifest>(manifestPath);
  } catch (error) {
    return { ok: false, relativePath, fileCount: 0, bytes: 0, errors: [`dataset-manifest.json is invalid JSON: ${error instanceof Error ? error.message : "parse failed"}`], warnings };
  }
  if (manifest.schemaVersion !== DATASET_SCHEMA_VERSION) errors.push("dataset-manifest schemaVersion must be dataset-package.v1.");
  if (!manifest.datasetId || !/^[a-z0-9._-]+$/i.test(manifest.datasetId)) errors.push("datasetId is invalid.");
  if (!manifest.gate?.ok) errors.push("Dataset gate summary is not ok.");
  if (!manifest.audit?.ok || manifest.audit.errorCount || manifest.audit.secretLeakCount || manifest.audit.hiddenTruthLeakCount) errors.push("Dataset audit summary is not clean.");

  const actualFiles = listFiles(packagePath);
  const fileMap = new Map((manifest.files || []).map((file) => [file.path, file]));
  for (const required of ["dataset-card.md", "reader-index.json", "replay-index.snapshot.json", "package-index.snapshot.json", "audit-report.json", "checksums.sha256"]) {
    if (!actualFiles.includes(required)) errors.push(`${required} is required.`);
  }
  for (const actual of actualFiles) {
    if (actual.endsWith(".db") || actual.includes("mystery-town.db")) errors.push(`${actual} must not include SQLite data.`);
    const target = targetInside(packagePath, actual);
    const data = fs.readFileSync(/*turbopackIgnore: true*/ target);
    const expected = fileMap.get(actual);
    if (expected) {
      if (expected.bytes !== data.length) errors.push(`${actual} byte count does not match manifest.`);
      if (expected.sha256 !== sha256(data)) errors.push(`${actual} sha256 does not match manifest.`);
    }
    if (TEXT_FILE_RE.test(actual)) {
      const text = data.toString("utf8");
      scanText(text, actual, errors);
      if (actual.endsWith(".json")) {
        try {
          scanJson(JSON.parse(text), actual, errors);
        } catch (error) {
          errors.push(`${actual} is invalid JSON: ${error instanceof Error ? error.message : "parse failed"}`);
        }
      }
    }
  }
  for (const file of manifest.files || []) {
    if (!isSafeRelativePath(file.path)) errors.push(`${file.path} is not a safe relative path.`);
    if (!actualFiles.includes(file.path)) errors.push(`${file.path} is listed in manifest but missing.`);
  }
  const readerPath = manifest.readerIndexPath || "reader-index.json";
  if (readerPath !== "reader-index.json") errors.push("readerIndexPath must be reader-index.json.");
  const readerFilePath = path.join(/*turbopackIgnore: true*/ packagePath, readerPath);
  let readerIndex: DatasetReaderIndex | undefined;
  if (fs.existsSync(/*turbopackIgnore: true*/ readerFilePath)) {
    try {
      readerIndex = readJson<DatasetReaderIndex>(readerFilePath);
      if (readerIndex.schemaVersion !== DATASET_READER_SCHEMA_VERSION) errors.push("reader-index schemaVersion must be dataset-reader.v1.");
      if (readerIndex.datasetId !== manifest.datasetId) errors.push("reader-index datasetId does not match manifest.");
      if (readerIndex.sourceRunId !== manifest.sourceRunId) errors.push("reader-index sourceRunId does not match manifest.");
      if (readerIndex.gate.uniqueCases !== manifest.gate.uniqueCases) errors.push("reader-index gate does not match manifest gate.");
      if (readerIndex.summary.caseCount !== manifest.gate.uniqueCases) errors.push("reader-index case count does not match manifest gate.");
      if (readerIndex.summary.evidenceGraph.warningCount !== manifest.gate.evidenceGraphWarnings) errors.push("reader-index evidence warning count does not match manifest gate.");
      if (manifest.readerIndexHash && manifest.readerIndexHash !== sha256(fs.readFileSync(/*turbopackIgnore: true*/ readerFilePath))) errors.push("reader-index sha256 does not match manifest readerIndexHash.");
      if (manifest.readerSummary && manifest.readerSummary.caseCount !== readerIndex.summary.caseCount) errors.push("manifest readerSummary does not match reader-index summary.");
    } catch (error) {
      errors.push(`reader-index.json is invalid JSON: ${error instanceof Error ? error.message : "parse failed"}`);
    }
  }
  const bytes = actualFiles.reduce((sum, file) => sum + fs.statSync(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ packagePath, file)).size, 0);
  return {
    ok: errors.length === 0,
    datasetId: manifest.datasetId,
    relativePath,
    fileCount: actualFiles.length,
    bytes,
    errors: Array.from(new Set(errors)),
    warnings: Array.from(new Set(warnings)),
    gate: manifest.gate,
    audit: manifest.audit,
    readerSummary: readerIndex?.summary || manifest.readerSummary
  };
}

export function smokeDatasetPackage(input: { path: string; root?: string }) {
  const validation = validateDatasetPackage(input);
  if (!validation.ok) return { ok: false, validation };
  const root = rootDir(input.root);
  const packagePath = path.resolve(/*turbopackIgnore: true*/ root, input.path);
  const manifest = readJson<DatasetPackageManifest>(path.join(/*turbopackIgnore: true*/ packagePath, "dataset-manifest.json"));
  const replayIndex = readJson<ReplayDatasetIndex>(path.join(/*turbopackIgnore: true*/ packagePath, manifest.replayIndexSnapshotPath));
  const packageIndex = readJson<PackageCatalogIndex>(path.join(/*turbopackIgnore: true*/ packagePath, manifest.packageIndexSnapshotPath));
  const runManifestPath = path.join(/*turbopackIgnore: true*/ packagePath, "runs", manifest.sourceRunId, "manifest.json");
  const runManifest = fs.existsSync(/*turbopackIgnore: true*/ runManifestPath) ? readJson<Record<string, unknown>>(runManifestPath) : null;
  return {
    ok: true,
    validation,
    datasetId: manifest.datasetId,
    sourceRunId: manifest.sourceRunId,
    replayRunCount: replayIndex.summary.runCount,
    packageCount: packageIndex.summary.packageCount,
    runManifestFound: Boolean(runManifest),
    readerSummary: manifest.readerSummary
  };
}

export function readDatasetPackageReader(input: { path: string; root?: string }) {
  const root = rootDir(input.root);
  const packagePath = path.resolve(/*turbopackIgnore: true*/ root, input.path);
  const fullManifestPath = path.join(/*turbopackIgnore: true*/ packagePath, "dataset-manifest.json");
  const staticManifestPath = path.join(/*turbopackIgnore: true*/ packagePath, "manifest-lite.json");
  if (!fs.existsSync(/*turbopackIgnore: true*/ fullManifestPath) && fs.existsSync(/*turbopackIgnore: true*/ staticManifestPath)) {
    const validation = validateStaticDatasetReader(input);
    if (!validation.ok || !validation.manifest || !validation.readerIndex) return { ok: false, validation };
    return {
      ok: true,
      validation,
      datasetId: validation.readerIndex.datasetId,
      sourceRunId: validation.readerIndex.sourceRunId,
      gate: validation.readerIndex.gate,
      audit: validation.readerIndex.audit,
      summary: validation.readerIndex.summary,
      caseTypeDistribution: validation.readerIndex.caseTypeDistribution,
      evidenceTypeDistribution: validation.readerIndex.evidenceTypeDistribution,
      worldPackages: validation.readerIndex.worldPackages,
      fileCount: validation.fileCount,
      readerFileCount: validation.readerIndex.files.length,
      readerIndexHash: validation.manifest.readerIndexHash,
      caseSummaryIndexHash: validation.manifest.caseSummaryIndexHash,
      caseSummary: validation.caseSummary,
      staticReader: true
    };
  }
  const validation = validateDatasetPackage(input);
  if (!validation.ok) return { ok: false, validation };
  const manifest = readJson<DatasetPackageManifest>(fullManifestPath);
  const readerPath = manifest.readerIndexPath || "reader-index.json";
  const readerIndex = readJson<DatasetReaderIndex>(path.join(/*turbopackIgnore: true*/ packagePath, readerPath));
  return {
    ok: true,
    validation,
    datasetId: readerIndex.datasetId,
    sourceRunId: readerIndex.sourceRunId,
    gate: readerIndex.gate,
    audit: readerIndex.audit,
    summary: readerIndex.summary,
    caseTypeDistribution: readerIndex.caseTypeDistribution,
    evidenceTypeDistribution: readerIndex.evidenceTypeDistribution,
    worldPackages: readerIndex.worldPackages,
    fileCount: validation.fileCount,
    readerFileCount: readerIndex.files.length,
    readerIndexHash: manifest.readerIndexHash || sha256(fs.readFileSync(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ packagePath, readerPath))),
    staticReader: false
  };
}

export function listDatasetPackages(input: { root?: string } = {}): DatasetPackageListResult {
  const root = rootDir(input.root);
  const dir = datasetRoot(root);
  if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) return { packages: [], total: 0, summary: { packageCount: 0, totalBytes: 0, validPackageCount: 0 } };
  const packages = fs.readdirSync(/*turbopackIgnore: true*/ dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const manifestPath = path.join(/*turbopackIgnore: true*/ dir, entry.name, "dataset-manifest.json");
      if (!fs.existsSync(/*turbopackIgnore: true*/ manifestPath)) return null;
      try {
        return readJson<DatasetPackageManifest>(manifestPath);
      } catch {
        return null;
      }
    })
    .filter((entry): entry is DatasetPackageManifest => Boolean(entry))
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
  return {
    packages,
    total: packages.length,
    summary: {
      packageCount: packages.length,
      totalBytes: packages.reduce((sum, item) => sum + item.bytes, 0),
      validPackageCount: packages.filter((item) => item.gate.ok && item.audit.ok).length,
      latestGeneratedAt: packages[0]?.generatedAt
    }
  };
}

export function getDatasetPackage(datasetId: string, root = rootDir()) {
  assertSafeId(datasetId, "dataset id");
  const manifestPath = path.join(/*turbopackIgnore: true*/ datasetRoot(root), safeName(datasetId), "dataset-manifest.json");
  if (!fs.existsSync(/*turbopackIgnore: true*/ manifestPath)) return null;
  return readJson<DatasetPackageManifest>(manifestPath);
}
