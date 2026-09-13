import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const sourceDir = path.join(root, "packages", "engine", "src");
const outputDir = path.join(root, "outputs");
const runtimeDir = path.join(outputDir, "campaign-benchmark-runtime");
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

async function writeCampaignArtifacts(report, markdown) {
  const runId = `campaign-${report.seed}-${report.tickCount}`.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
  const runDir = path.join(replayStoreDir, runId);
  await fs.mkdir(runDir, { recursive: true });
  const campaignReportJson = JSON.stringify(report, null, 2);
  const qualityReportJson = JSON.stringify(report.quality, null, 2);
  const causalMetricsJson = JSON.stringify(report.report.metrics, null, 2);
  const caseGraphJson = JSON.stringify(report.report.metrics.caseGraph, null, 2);
  const evidenceGraphJson = JSON.stringify(report.report.metrics.evidenceGraph, null, 2);
  const resolvedEvidenceCaseCount = report.report.metrics.evidenceGraph.caseUses.length;
  const completeEvidenceCaseCount = report.report.metrics.evidenceGraph.caseUses.filter((item) => item.complete).length;
  const files = [
    fileMetadata("campaign-report.json", campaignReportJson),
    fileMetadata("campaign-report.md", markdown),
    fileMetadata("quality-report.json", qualityReportJson),
    fileMetadata("causal-metrics.json", causalMetricsJson),
    fileMetadata("case-graph.json", caseGraphJson),
    fileMetadata("evidence-graph.json", evidenceGraphJson)
  ];
  const manifest = {
    runId,
    kind: "campaign",
    status: report.ok ? "completed" : "failed",
    engineVersion: "persistent-town.quality.v1",
    generatedAt: report.generatedAt,
    seed: report.seed,
    tickCount: report.tickCount,
    qualityScore: report.report.metrics.causalLinkCount,
    deterministicRunHash: report.report.metrics.deterministicRunHash,
    summary: {
      caseCount: report.report.metrics.caseCount,
      uniqueCaseCount: report.report.metrics.uniqueCaseCount,
      distinctCaseTypeCount: report.report.metrics.diversity.distinctCaseTypeCount,
      candidateRepeatRate: report.report.metrics.candidateRepeatRate,
      laterCaseInfluenceRate: report.report.metrics.diversity.laterCaseInfluenceRate,
      caseGraphInfluencedLaterCases: report.report.metrics.caseGraph.influencedLaterCaseCount,
      completeEvidenceCaseCount,
      resolvedEvidenceCaseCount,
      evidenceGraphWarnings: report.report.metrics.evidenceGraph.warnings.length,
      caseGraphEdges: report.report.metrics.caseGraph.edges.length,
      runtimeMs: Math.round(report.report.performance.totalMs)
    },
    files
  };
  await fs.writeFile(path.join(runDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  await fs.writeFile(path.join(runDir, "campaign-report.json"), campaignReportJson, "utf8");
  await fs.writeFile(path.join(runDir, "campaign-report.md"), markdown, "utf8");
  await fs.writeFile(path.join(runDir, "quality-report.json"), qualityReportJson, "utf8");
  await fs.writeFile(path.join(runDir, "causal-metrics.json"), causalMetricsJson, "utf8");
  await fs.writeFile(path.join(runDir, "case-graph.json"), caseGraphJson, "utf8");
  await fs.writeFile(path.join(runDir, "evidence-graph.json"), evidenceGraphJson, "utf8");
  return { runId, runDir };
}

const seed = argValue("seed", process.env.CAMPAIGN_SEED || "campaign-validation");
const ticks = Number(argValue("ticks", process.env.CAMPAIGN_TICKS || "500"));
const defaultMaxRuntimeMs = ticks >= 5000 ? "300000" : ticks >= 1000 ? "90000" : ticks >= 500 ? "30000" : "10000";
const maxRuntimeMs = Number(argValue("max-ms", process.env.CAMPAIGN_MAX_MS || defaultMaxRuntimeMs));
const engine = await compileEngine();
const defaultMinimumCases = ticks >= 5000 ? 30 : ticks >= 1000 ? 8 : ticks >= 500 ? 5 : 3;
const minimumCaseCount = Number(argValue("min-cases", process.env.CAMPAIGN_MIN_CASES || String(defaultMinimumCases)));
const report = engine.runCampaignBenchmark({ seed, tickCount: ticks, minimumCaseCount, maxRuntimeMs });
const markdown = engine.renderCampaignRunMarkdown(report);
const artifact = await writeCampaignArtifacts(report, markdown);
const resolvedEvidenceCaseCount = report.report.metrics.evidenceGraph.caseUses.length;
const completeEvidenceCaseCount = report.report.metrics.evidenceGraph.caseUses.filter((item) => item.complete).length;
const worldStability = report.report.metrics.worldStability;

console.log(JSON.stringify({
  ok: report.ok,
  seed,
  ticks,
  cases: report.report.summary.caseCount,
  uniqueCases: report.report.metrics.uniqueCaseCount,
  minimumCaseCount,
  runtimeMs: Math.round(report.report.performance.totalMs),
  candidateDiversityScore: report.report.metrics.candidateDiversityScore,
  candidateRepeatRate: report.report.metrics.candidateRepeatRate,
  distinctCaseTypeCount: report.report.metrics.diversity.distinctCaseTypeCount,
  laterCaseInfluenceRate: report.report.metrics.diversity.laterCaseInfluenceRate,
  caseGraphInfluencedLaterCases: report.report.metrics.caseGraph.influencedLaterCaseCount,
  completeEvidenceCaseCount,
  resolvedEvidenceCaseCount,
  crossCaseInfluenceCount: report.report.metrics.diversity.crossCaseInfluenceCount,
  causalLinkCount: report.report.metrics.causalLinkCount,
  caseGraphEdges: report.report.metrics.caseGraph.edges.length,
  evidenceGraphWarnings: report.report.metrics.evidenceGraph.warnings.length,
  worldStability,
  selectedActionKindCount: worldStability.selectedActionKindCount,
  largestSelectedActionShare: worldStability.largestSelectedActionShare,
  activeActorCount: worldStability.activeActorCount,
  largestActorShare: worldStability.largestActorShare,
  institutionDecisionCount: worldStability.institutionDecisionCount,
  candidateRejectionReasonCounts: report.report.candidateRejectionReasonCounts,
  candidateLifecycleTail: report.report.candidateLifecycleDiagnostics.slice(-12),
  deterministicRunHash: report.report.metrics.deterministicRunHash,
  artifactRunId: artifact.runId
}, null, 2));

assert.equal(report.ok, true, report.errors.join("; "));
assert.equal(report.report.metrics.uniqueCaseCount, report.report.summary.caseCount, "campaign case ids must be unique");
assert.equal(report.report.metrics.caseGraph.nodes.length, report.report.summary.caseCount, "case graph must contain one node per case");
assert.ok(report.report.metrics.caseGraph.edges.length >= report.report.metrics.diversity.crossCaseInfluenceCount, "case graph must retain cross-case influence edges");
assert.equal(report.report.metrics.evidenceGraph.warnings.length, 0, report.report.metrics.evidenceGraph.warnings.join("; "));
