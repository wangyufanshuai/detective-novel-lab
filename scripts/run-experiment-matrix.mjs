import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const sourceDir = path.join(root, "packages", "engine", "src");
const runtimeDir = path.join(root, "outputs", "experiment-matrix-runtime");
const experimentsDir = path.join(root, "experiments");
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

async function readExperiment(engine, experimentId) {
  const dir = path.join(experimentsDir, experimentId);
  const fileNames = [
    "manifest.json",
    "steps.json",
    "scenario-pack.json",
    "map-pack.json",
    "rule-catalog.json",
    "expectations.json",
    "README.md"
  ];
  const files = {};
  for (const fileName of fileNames) files[fileName] = await fs.readFile(path.join(dir, fileName), "utf8");
  const discovery = engine.validateExperimentFolderFiles(files);
  assert.equal(discovery.ok, true, `${experimentId}: ${discovery.errors.join("; ")}`);
  return {
    experimentId: discovery.experimentId,
    experimentHash: discovery.hash,
    scenarioPack: discovery.scenarioPack,
    mapPack: discovery.mapPack,
    ruleCatalog: discovery.ruleCatalog
  };
}

async function writeArtifacts(report, markdown) {
  const dir = path.join(replayStoreDir, report.matrixId);
  await fs.mkdir(dir, { recursive: true });
  const files = [
    "experiment-comparison-report.json",
    "variant-deltas.json",
    "case-type-distribution.json",
    "README.md"
  ];
  const manifest = {
    runId: report.matrixId,
    kind: "experiment-matrix",
    status: report.ok ? "completed" : "failed",
    engineVersion: "persistent-town.matrix.v1",
    startedAt: report.generatedAt,
    finishedAt: report.generatedAt,
    qualityScore: report.summary.matrixScore,
    summary: {
      branchCount: report.summary.experimentCount,
      snapshotCount: 0,
      eventGrowth: 0,
      memoryGrowth: 0,
      validCandidateCount: report.summary.qualityPassedRunCount,
      blockedCandidateCount: report.summary.runCount - report.summary.qualityPassedRunCount
    },
    files: files.map((name) => ({ name, path: name }))
  };
  await fs.writeFile(path.join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(dir, files[0]), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(dir, files[1]), `${JSON.stringify(report.variantDeltas, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(dir, files[2]), `${JSON.stringify(report.caseTypeDistribution, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(dir, files[3]), markdown, "utf8");
  return dir;
}

const ticks = Number(argValue("ticks", process.env.MATRIX_TICKS || "500"));
const seeds = argValue("seeds", process.env.MATRIX_SEEDS || "matrix-a,matrix-b,matrix-c").split(",").map((seed) => seed.trim()).filter(Boolean);
const experimentIds = argValue(
  "experiments",
  process.env.MATRIX_EXPERIMENTS || "small-town-review,evidence-contamination-pressure,media-panic-campaign"
).split(",").map((id) => id.trim()).filter(Boolean);
const threshold = Number(argValue("threshold", process.env.MATRIX_THRESHOLD || "20"));
const engine = await compileEngine();
const sources = [];
for (const experimentId of experimentIds) sources.push(await readExperiment(engine, experimentId));
const report = engine.runExperimentMatrix(sources, { ticks, seeds, threshold });
const markdown = engine.renderExperimentMatrixMarkdown(report);
const artifactDir = await writeArtifacts(report, markdown);

console.log(JSON.stringify({
  ok: report.ok,
  matrixId: report.matrixId,
  ticks,
  experiments: report.summary.experimentCount,
  runs: report.summary.runCount,
  qualityPassedExperiments: report.summary.qualityPassedExperimentCount,
  changedVariants: `${report.summary.changedVariantCount}/${report.summary.variantCount}`,
  matrixScore: report.summary.matrixScore,
  artifactDir,
  errors: report.errors
}, null, 2));

assert.equal(report.ok, true, report.errors.join("; "));
