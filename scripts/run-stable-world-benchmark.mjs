import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const sourceDir = path.join(root, "packages", "engine", "src");
const outputDir = path.join(root, "outputs");
const runtimeDir = path.join(outputDir, "stable-world-runtime");
const replayStoreDir = path.join(root, "data", "replay-store");

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

async function collectTsFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectTsFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
  }));
  return nested.flat();
}

async function compileEngine() {
  await fs.mkdir(runtimeDir, { recursive: true });
  for (const file of await collectTsFiles(sourceDir)) {
    const source = await fs.readFile(file, "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText;
    const relative = path.relative(sourceDir, file).replace(/\.ts$/, ".cjs");
    const target = path.join(runtimeDir, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, compiled.replace(/require\("(\.{1,2}\/.+?)"\)/g, 'require("$1.cjs")'), "utf8");
  }
  return import(pathToFileURL(path.join(runtimeDir, "index.cjs")).href);
}

function fileMetadata(name, content) {
  const buffer = Buffer.from(content, "utf8");
  return {
    name,
    path: name,
    bytes: buffer.length,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex")
  };
}

function stableWorldRunId(ticks, seeds) {
  return `stable-world-${ticks}-${seeds.join("-")}`.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return undefined;
  }
}

async function readPreviousStableWorldArtifact(runId) {
  const runDir = path.join(replayStoreDir, runId);
  const quality = await readJsonIfExists(path.join(runDir, "quality-report.json"));
  if (!quality || !quality.summary?.stability?.perSeed) return null;
  const diagnostics = await readJsonIfExists(path.join(runDir, "diagnostics-report.json"));
  return { quality, diagnostics };
}

function diagnosticsSummary(diagnostics) {
  return {
    overallStatus: diagnostics.overallStatus,
    ok: diagnostics.ok,
    findingCounts: diagnostics.findingCounts,
    topRisks: diagnostics.topRisks.map((finding) => ({
      seed: finding.seed,
      severity: finding.severity,
      dimension: finding.dimension,
      metric: finding.metric,
      actual: finding.actual,
      target: finding.target,
      message: finding.message,
      recommendedNextInspection: finding.recommendedNextInspection
    })),
    perSeedStatus: Object.fromEntries(diagnostics.seeds.map((seed) => [seed.seed, seed.status])),
    slowestSeed: diagnostics.slowestSeed,
    largestActionShareSeed: diagnostics.largestActionShareSeed,
    lowestCaseTypeSeed: diagnostics.lowestCaseTypeSeed,
    lowestInstitutionSeed: diagnostics.lowestInstitutionSeed
  };
}

function regressionSummary(regression) {
  return {
    baselineAvailable: regression.baselineAvailable,
    overallStatus: regression.overallStatus,
    ok: regression.ok,
    deltaCounts: regression.deltaCounts,
    topRegressions: regression.topRegressions.map((delta) => ({
      seed: delta.seed,
      status: delta.status,
      metric: delta.metric,
      previous: delta.previous,
      current: delta.current,
      delta: delta.delta,
      message: delta.message,
      recommendedNextInspection: delta.recommendedNextInspection
    })),
    perSeedStatus: regression.perSeedStatus,
    runtimeDeltaBySeed: regression.runtimeDeltaBySeed
  };
}

function caseQualitySummary(caseQuality) {
  return {
    overallStatus: caseQuality.overallStatus,
    ok: caseQuality.ok,
    nonBlocking: caseQuality.nonBlocking,
    averageScore: caseQuality.averageScore,
    minScore: caseQuality.minScore,
    statusCounts: caseQuality.statusCounts,
    dimensionAverages: caseQuality.dimensionAverages,
    dimensionMinimums: caseQuality.dimensionMinimums,
    perSeedStatus: Object.fromEntries(caseQuality.seeds.map((seed) => [seed.seed, seed.status])),
    perSeedScore: Object.fromEntries(caseQuality.seeds.map((seed) => [seed.seed, seed.score]))
  };
}

async function writeStableWorldArtifacts(report, markdown, diagnostics, diagnosticsMarkdown, regression, regressionMarkdown, caseQuality, caseQualityMarkdown) {
  const runId = stableWorldRunId(report.gate.tickCount, report.seeds);
  const runDir = path.join(replayStoreDir, runId);
  await fs.mkdir(runDir, { recursive: true });
  const qualityReportJson = JSON.stringify(report, null, 2);
  const causalMetricsJson = JSON.stringify(Object.fromEntries(report.reports.map((item) => [item.summary.seed, item.metrics])), null, 2);
  const stabilityJson = JSON.stringify(report.summary.stability, null, 2);
  const diagnosticsJson = JSON.stringify(diagnostics, null, 2);
  const regressionJson = JSON.stringify(regression, null, 2);
  const caseQualityJson = JSON.stringify(caseQuality, null, 2);
  const files = [
    fileMetadata("quality-report.json", qualityReportJson),
    fileMetadata("quality-report.md", markdown),
    fileMetadata("causal-metrics.json", causalMetricsJson),
    fileMetadata("stability-summary.json", stabilityJson),
    fileMetadata("diagnostics-report.json", diagnosticsJson),
    fileMetadata("diagnostics-report.md", diagnosticsMarkdown),
    fileMetadata("regression-report.json", regressionJson),
    fileMetadata("regression-report.md", regressionMarkdown),
    fileMetadata("case-quality-report.json", caseQualityJson),
    fileMetadata("case-quality-report.md", caseQualityMarkdown)
  ];
  const manifest = {
    runId,
    kind: "stable-world",
    status: report.ok ? "completed" : "failed",
    engineVersion: "persistent-town.stable-world.v1",
    generatedAt: report.generatedAt,
    tickCount: report.gate.tickCount,
    seeds: report.seeds,
    qualityScore: report.summary.averageCausalLinkCount,
    summary: {
      passedSeedCount: report.summary.stability.passedSeedCount,
      failedSeedCount: report.summary.stability.failedSeedCount,
      worstCandidateRepeatRate: report.summary.stability.worstCandidateRepeatRate,
      lowestDistinctCaseTypeCount: report.summary.stability.lowestDistinctCaseTypeCount,
      lowestSelectedActionKindCount: report.summary.stability.lowestSelectedActionKindCount,
      highestLargestSelectedActionShare: report.summary.stability.highestLargestSelectedActionShare,
      lowestInstitutionDecisionCount: report.summary.stability.lowestInstitutionDecisionCount,
      diagnosticStatus: diagnostics.overallStatus,
      diagnosticFindings: diagnostics.findingCounts,
      regressionStatus: regression.overallStatus,
      regressionBaselineAvailable: regression.baselineAvailable,
      regressionDeltas: regression.deltaCounts,
      caseQualityStatus: caseQuality.overallStatus,
      caseQualityAverageScore: caseQuality.averageScore,
      caseQualityMinScore: caseQuality.minScore,
      caseQualityNonBlocking: caseQuality.nonBlocking
    },
    files
  };
  await fs.writeFile(path.join(runDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  await fs.writeFile(path.join(runDir, "quality-report.json"), qualityReportJson, "utf8");
  await fs.writeFile(path.join(runDir, "quality-report.md"), markdown, "utf8");
  await fs.writeFile(path.join(runDir, "causal-metrics.json"), causalMetricsJson, "utf8");
  await fs.writeFile(path.join(runDir, "stability-summary.json"), stabilityJson, "utf8");
  await fs.writeFile(path.join(runDir, "diagnostics-report.json"), diagnosticsJson, "utf8");
  await fs.writeFile(path.join(runDir, "diagnostics-report.md"), diagnosticsMarkdown, "utf8");
  await fs.writeFile(path.join(runDir, "regression-report.json"), regressionJson, "utf8");
  await fs.writeFile(path.join(runDir, "regression-report.md"), regressionMarkdown, "utf8");
  await fs.writeFile(path.join(runDir, "case-quality-report.json"), caseQualityJson, "utf8");
  await fs.writeFile(path.join(runDir, "case-quality-report.md"), caseQualityMarkdown, "utf8");
  return { runId, runDir };
}

const ticks = Number(argValue("ticks", process.env.STABLE_WORLD_TICKS || "1000"));
const seeds = argValue("seeds", process.env.STABLE_WORLD_SEEDS || "campaign-validation,stable-town-a,stable-town-b")
  .split(",")
  .map((seed) => seed.trim())
  .filter(Boolean);
const maxRuntimeMs = Number(argValue("max-ms", process.env.STABLE_WORLD_MAX_MS || "90000"));
const runId = stableWorldRunId(ticks, seeds);
const previousArtifact = await readPreviousStableWorldArtifact(runId);
const engine = await compileEngine();
const report = engine.runSimulationQualitySuite({
  seeds,
  gate: {
    tickCount: ticks,
    minimumCaseCount: 8,
    minCandidateDiversityScore: 70,
    maxCandidateRepeatRate: 20,
    minCausalLinkCount: 120,
    minCrossCaseInfluenceCount: 8,
    maxRuntimeMs,
    minDistinctCaseTypeCount: 4,
    minLaterCaseInfluenceRate: 60,
    maxEvidenceGraphWarnings: 0,
    minSelectedActionKindCount: 6,
    maxLargestSelectedActionShare: 55,
    minInstitutionDecisionCount: 4,
    minEvidenceCompleteCaseCount: 8
  }
});
const markdown = engine.renderSimulationQualityMarkdown(report);
const diagnostics = engine.buildStableWorldDiagnostics(report);
const diagnosticsMarkdown = engine.renderStableWorldDiagnosticsMarkdown(diagnostics);
const regression = engine.buildStableWorldRegressionReport(previousArtifact, { quality: report, diagnostics });
const regressionMarkdown = engine.renderStableWorldRegressionMarkdown(regression);
const caseQuality = engine.buildStableWorldCaseQualityReport(report);
const caseQualityMarkdown = engine.renderStableWorldCaseQualityMarkdown(caseQuality);
const artifact = await writeStableWorldArtifacts(report, markdown, diagnostics, diagnosticsMarkdown, regression, regressionMarkdown, caseQuality, caseQualityMarkdown);

console.log(JSON.stringify({
  ok: report.ok,
  seeds,
  ticks,
  perSeedGateSummary: report.summary.stability.perSeed,
  stability: report.summary.stability,
  diagnostics: diagnosticsSummary(diagnostics),
  regression: regressionSummary(regression),
  caseQuality: caseQualitySummary(caseQuality),
  artifactRunId: artifact.runId
}, null, 2));

assert.equal(report.ok, true, report.errors.join("; "));
