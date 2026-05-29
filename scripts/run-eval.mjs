import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const outDir = path.join(root, "outputs");
const sourceDir = path.join(root, "packages", "engine", "src");
const runtimeDir = path.join(outDir, "engine-runtime");

async function compileEngine() {
  await fs.mkdir(runtimeDir, { recursive: true });
  const entries = await fs.readdir(sourceDir);
  for (const entry of entries.filter((name) => name.endsWith(".ts"))) {
    const sourcePath = path.join(sourceDir, entry);
    const source = await fs.readFile(sourcePath, "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText;
    await fs.writeFile(path.join(runtimeDir, entry.replace(/\.ts$/, ".cjs")), compiled.replace(/require\("\.\/(.+?)"\)/g, 'require("./$1.cjs")'), "utf8");
  }
  return import(pathToFileURL(path.join(runtimeDir, "index.cjs")).href);
}

const engine = await compileEngine();
const report = engine.runEval();
await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, "eval-report.json"), JSON.stringify(report, null, 2), "utf8");
await fs.writeFile(path.join(outDir, "eval-report.md"), engine.renderEvalMarkdown(report), "utf8");

console.log(
  JSON.stringify(
    {
      total: report.total,
      passed: report.passed,
      failed: report.failed,
      averageCoverage: Math.round(report.averageCoverage * 100)
    },
    null,
    2
  )
);

if (report.failed > 0) {
  process.exit(1);
}
