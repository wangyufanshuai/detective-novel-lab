import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const sourceDir = path.join(root, "packages", "engine", "src");
const outputDir = path.join(root, "outputs");
const runtimeDir = path.join(outputDir, "rule-ablation-runtime");
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

async function writeAblationArtifacts(report, markdown) {
  const runId = `ablation-${report.baseline.summary.seed}-${report.baseline.summary.tickCount}`.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
  const runDir = path.join(replayStoreDir, runId);
  await fs.mkdir(runDir, { recursive: true });
  const manifest = {
    runId,
    kind: "rule-ablation",
    status: report.ok ? "completed" : "failed",
    engineVersion: "persistent-town.long-run.v1",
    generatedAt: report.generatedAt,
    threshold: report.threshold,
    files: [
      { name: "ablation-report.json", path: "ablation-report.json" },
      { name: "ablation-report.md", path: "ablation-report.md" },
      { name: "causal-metrics.json", path: "causal-metrics.json" }
    ]
  };
  const causalMetrics = {
    baseline: report.baseline.metrics,
    variants: Object.fromEntries(Object.entries(report.variants).map(([variant, item]) => [variant, item.metrics])),
    ablationDeltas: report.ablationDeltas
  };
  await fs.writeFile(path.join(runDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  await fs.writeFile(path.join(runDir, "ablation-report.json"), JSON.stringify(report, null, 2), "utf8");
  await fs.writeFile(path.join(runDir, "ablation-report.md"), markdown, "utf8");
  await fs.writeFile(path.join(runDir, "causal-metrics.json"), JSON.stringify(causalMetrics, null, 2), "utf8");
  return { runId, runDir };
}

const ticks = Number(argValue("ticks", process.env.LONG_RUN_TICKS || "100"));
const seed = argValue("seed", process.env.LONG_RUN_SEED || "long-run-validation");
const threshold = Number(argValue("threshold", process.env.ABLATION_THRESHOLD || "20"));
const engine = await compileEngine();
const report = engine.runRuleAblationSuite({ seed, tickCount: ticks, minimumCaseCount: 3, threshold });
const markdown = engine.renderRuleAblationMarkdown(report);
const artifact = await writeAblationArtifacts(report, markdown);

console.log(JSON.stringify({
  ok: report.ok,
  seed,
  ticks,
  threshold,
  baselineCases: report.baseline.summary.caseCount,
  deltas: report.ablationDeltas.map((delta) => ({
    variant: delta.variant,
    changed: delta.changed,
    strongestMetric: delta.strongestMetric,
    relativeChange: delta.relativeChange
  })),
  artifactRunId: artifact.runId
}, null, 2));

for (const delta of report.ablationDeltas) {
  assert.equal(delta.changed, true, `${delta.variant} reaches ${threshold}% metric change`);
}
assert.equal(report.baseline.summary.caseCount >= 3, true, "baseline extracts at least three cases");
assert.equal(report.ok, true, report.errors.join("; "));
