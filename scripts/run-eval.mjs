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
  async function collectTsFiles(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectTsFiles(fullPath);
      return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
    }));
    return nested.flat();
  }
  for (const sourcePath of await collectTsFiles(sourceDir)) {
    const source = await fs.readFile(sourcePath, "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText;
    const relative = path.relative(sourceDir, sourcePath).replace(/\.ts$/, ".cjs");
    const target = path.join(runtimeDir, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, compiled.replace(/require\("(\.{1,2}\/.+?)"\)/g, 'require("$1.cjs")'), "utf8");
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
