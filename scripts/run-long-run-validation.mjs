import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const sourceDir = path.join(root, "packages", "engine", "src");
const outputDir = path.join(root, "outputs");
const runtimeDir = path.join(outputDir, "long-run-validation-runtime");
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

async function writeLongRunArtifacts(report, markdown) {
  const runId = report.summary.runId.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
  const runDir = path.join(replayStoreDir, runId);
  await fs.mkdir(runDir, { recursive: true });
  const causalMetrics = report.metrics;
  const manifest = {
    runId,
    kind: "long-run-validation",
    status: report.ok ? "completed" : "failed",
    engineVersion: "persistent-town.long-run.v1",
    generatedAt: report.generatedAt,
    seed: report.summary.seed,
    tickCount: report.summary.tickCount,
    caseCount: report.summary.caseCount,
    files: [
      { name: "long-run-report.json", path: "long-run-report.json" },
      { name: "long-run-report.md", path: "long-run-report.md" },
      { name: "causal-metrics.json", path: "causal-metrics.json" }
    ]
  };
  await fs.writeFile(path.join(runDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  await fs.writeFile(path.join(runDir, "long-run-report.json"), JSON.stringify(report, null, 2), "utf8");
  await fs.writeFile(path.join(runDir, "long-run-report.md"), markdown, "utf8");
  await fs.writeFile(path.join(runDir, "causal-metrics.json"), JSON.stringify(causalMetrics, null, 2), "utf8");
  return { runId, runDir };
}

const ticks = Number(argValue("ticks", process.env.LONG_RUN_TICKS || "100"));
const seed = argValue("seed", process.env.LONG_RUN_SEED || "long-run-validation");
const minimumCases = Number(argValue("minimum-cases", process.env.LONG_RUN_MIN_CASES || "3"));
const maxRuntimeMs = Number(argValue("max-ms", process.env.LONG_RUN_MAX_MS || "60000"));
const benchmarkMode = process.argv.includes("--benchmark");
const verifyDeterminism = process.argv.includes("--verify-determinism") || process.env.LONG_RUN_VERIFY_DETERMINISM === "1";
const engine = await compileEngine();

const report = engine.runMultiCaseSimulation({
  seed,
  tickCount: ticks,
  minimumCaseCount: minimumCases,
  snapshotEveryTicks: benchmarkMode ? 5 : 1,
  checkpointEveryTicks: benchmarkMode ? 25 : 5
});
const markdown = engine.renderLongRunValidationMarkdown(report);
const artifact = await writeLongRunArtifacts(report, markdown);

const summary = {
  ok: report.ok,
  seed,
  ticks,
  cases: report.summary.caseCount,
  solved: report.summary.solvedCaseCount,
  failed: report.summary.failedCaseCount,
  crossCaseNpcReuseRate: report.metrics.crossCaseNpcReuseRate,
  institutionAftermathPropagationCount: report.metrics.institutionAftermathPropagationCount,
  candidateDiversityScore: report.metrics.candidateDiversityScore,
  candidateRepeatRate: report.metrics.candidateRepeatRate,
  causalLinkCount: report.metrics.causalLinkCount,
  uniqueCaseCount: report.metrics.uniqueCaseCount,
  caseGraphEdges: report.metrics.caseGraph.edges.length,
  evidenceGraphWarnings: report.metrics.evidenceGraph.warnings.length,
  runtimeMs: Math.round(report.performance.totalMs),
  averageTickMs: Number(report.performance.averageTickMs.toFixed(2)),
  snapshots: report.performance.counters.snapshotCount,
  checkpoints: report.performance.counters.checkpointCount,
  candidateRebuilds: report.performance.counters.candidateRebuildCount,
  deterministicRunHash: report.metrics.deterministicRunHash,
  artifactRunId: artifact.runId
};
console.log(JSON.stringify(summary, null, 2));

if (!benchmarkMode && verifyDeterminism) {
  const repeat = engine.runMultiCaseSimulation({ seed, tickCount: ticks, minimumCaseCount: minimumCases });
  assert.equal(repeat.metrics.deterministicRunHash, report.metrics.deterministicRunHash, "same seed long-run hash is deterministic");
}

if (!benchmarkMode) {
  assert.equal(report.summary.caseCount >= minimumCases, true, `long run extracts at least ${minimumCases} cases`);
  assert.equal(report.metrics.causalClaims.length >= 3, true, "long run produces at least three causal claims");
  assert.equal(report.metrics.candidateDiversityScore >= 25, true, "candidate diversity stays above minimum");
  assert.equal(report.metrics.candidateRepeatRate <= 70, true, "candidate repeat rate stays below maximum");
  assert.equal(report.metrics.uniqueCaseCount, report.summary.caseCount, "every extracted campaign case has a unique id");
  assert.equal(report.metrics.caseGraph.nodes.length, report.summary.caseCount, "case graph has one node per case");
  assert.equal(report.metrics.evidenceGraph.warnings.length, 0, report.metrics.evidenceGraph.warnings.join("; "));
  assert.equal(report.performance.totalMs <= maxRuntimeMs, true, `long run must complete within ${maxRuntimeMs}ms, actual ${Math.round(report.performance.totalMs)}ms`);
  if (seed === "long-run-validation" && ticks === 100 && minimumCases === 3) {
    assert.equal(report.metrics.deterministicRunHash, "fnv1a-3cc999fd", "default long-run deterministic hash matches the reviewed v4.8 semantic baseline");
  }
  assert.equal(report.ok, true, report.errors.join("; "));
}
