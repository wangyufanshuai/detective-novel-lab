import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const sourceDir = path.join(root, "packages", "engine", "src");
const outputDir = path.join(root, "outputs");
const runtimeDir = path.join(outputDir, "simulation-quality-runtime");
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

async function writeQualityArtifacts(report, markdown) {
  const runId = `simulation-quality-${report.gate.tickCount}-${report.seeds.join("-")}`.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
  const runDir = path.join(replayStoreDir, runId);
  await fs.mkdir(runDir, { recursive: true });
  const manifest = {
    runId,
    kind: "simulation-quality",
    status: report.ok ? "completed" : "failed",
    engineVersion: "persistent-town.quality.v1",
    generatedAt: report.generatedAt,
    tickCount: report.gate.tickCount,
    seeds: report.seeds,
    qualityScore: report.summary.averageCausalLinkCount,
    files: [
      { name: "quality-report.json", path: "quality-report.json" },
      { name: "quality-report.md", path: "quality-report.md" },
      { name: "causal-metrics.json", path: "causal-metrics.json" }
    ]
  };
  const causalMetrics = Object.fromEntries(report.reports.map((item) => [item.summary.seed, item.metrics]));
  await fs.writeFile(path.join(runDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  await fs.writeFile(path.join(runDir, "quality-report.json"), JSON.stringify(report, null, 2), "utf8");
  await fs.writeFile(path.join(runDir, "quality-report.md"), markdown, "utf8");
  await fs.writeFile(path.join(runDir, "causal-metrics.json"), JSON.stringify(causalMetrics, null, 2), "utf8");
  return { runId, runDir };
}

const ticks = Number(argValue("ticks", process.env.QUALITY_TICKS || "100"));
const seeds = argValue("seeds", process.env.QUALITY_SEEDS || "quality-a,quality-b,quality-c")
  .split(",")
  .map((seed) => seed.trim())
  .filter(Boolean);
const maxRuntimeMs = Number(argValue("max-ms", process.env.QUALITY_MAX_MS || "60000"));
const engine = await compileEngine();
const report = engine.runSimulationQualitySuite({
  seeds,
  gate: {
    tickCount: ticks,
    minimumCaseCount: 3,
    minCandidateDiversityScore: 25,
    maxCandidateRepeatRate: 70,
    minCausalLinkCount: 12,
    minCrossCaseInfluenceCount: 2,
    maxRuntimeMs
  }
});
const markdown = engine.renderSimulationQualityMarkdown(report);
const artifact = await writeQualityArtifacts(report, markdown);

console.log(JSON.stringify({
  ok: report.ok,
  seeds,
  ticks,
  passed: report.summary.passed,
  failed: report.summary.failed,
  averageRuntimeMs: report.summary.averageRuntimeMs,
  averageCandidateDiversityScore: report.summary.averageCandidateDiversityScore,
  averageCandidateRepeatRate: report.summary.averageCandidateRepeatRate,
  averageCausalLinkCount: report.summary.averageCausalLinkCount,
  totalCrossCaseInfluenceCount: report.summary.totalCrossCaseInfluenceCount,
  artifactRunId: artifact.runId
}, null, 2));

assert.equal(report.ok, true, report.errors.join("; "));
