import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const outputDir = path.join(process.cwd(), "outputs");
const sourceDir = path.join(root, "packages", "engine", "src");
const runtimeDir = path.join(outputDir, "emergence-benchmark-runtime");
await fs.mkdir(outputDir, { recursive: true });

async function compileEngine() {
  await fs.mkdir(runtimeDir, { recursive: true });
  const entries = await fs.readdir(sourceDir);
  for (const entry of entries.filter((name) => name.endsWith(".ts"))) {
    const source = await fs.readFile(path.join(sourceDir, entry), "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText;
    await fs.writeFile(path.join(runtimeDir, entry.replace(/\.ts$/, ".cjs")), compiled.replace(/require\("\.\/(.+?)"\)/g, 'require("./$1.cjs")'), "utf8");
  }
  return import(pathToFileURL(path.join(runtimeDir, "index.cjs")).href);
}

const count = Number(process.env.EMERGENCE_BENCHMARK_SEEDS || 20);
const seeds = Array.from({ length: Math.max(1, count) }, (_, index) => `emergence-benchmark-${String(index + 1).padStart(2, "0")}`);
const engine = await compileEngine();
const report = engine.runEmergenceBenchmark(seeds);
const jsonPath = path.join(outputDir, "emergence-benchmark.json");
const mdPath = path.join(outputDir, "emergence-benchmark.md");

await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
await fs.writeFile(mdPath, engine.renderEmergenceBenchmarkMarkdown(report), "utf8");

console.log(JSON.stringify({
  seedCount: report.seedCount,
  passed: report.passed,
  failed: report.failed,
  passRate: report.passRate,
  averageQualityScore: report.averageQualityScore,
  averageEmergenceScore: report.averageEmergenceScore
}, null, 2));

if (report.failed > report.seedCount) {
  throw new Error("Impossible benchmark state.");
}
