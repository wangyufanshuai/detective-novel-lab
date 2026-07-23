import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import ts from "typescript";

const root = process.cwd();
const outDir = path.join(root, "outputs");
const sourceDir = path.join(root, "packages", "engine", "src");
const runtimeDir = path.join(outDir, "engine-test-runtime");

async function loadEngine() {
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

const engine = await loadEngine();
const showcase = engine.createShowcaseCase("rule tests");

{
  const schema = engine.validateCaseSchema(showcase);
  const report = engine.validateCase(showcase);
  assert.equal(schema.valid, true, "showcase schema should be valid");
  assert.equal(report.valid, true, "showcase case should be valid");
  assert.equal(report.reasoningCoverage.requiredEvidenceIds.length >= 3, true, "report exposes reasoning coverage");
}

{
  const report = engine.runEval();
  assert.equal(report.failed, 0, "fixture evaluation should pass");
}

{
  const discovered = showcase.evidence.filter((item) => item.discoverable).map((item) => item.id);
  const theory = {
    culpritId: showcase.truth.culpritId,
    motive: showcase.truth.motive,
    method: showcase.truth.method,
    evidenceIds: discovered
  };
  assert.equal(engine.judgeTheory(showcase, theory, discovered).accepted, true, "complete correct theory should pass");
  assert.equal(engine.judgeTheory(showcase, { ...theory, culpritId: "rival" }, discovered).accepted, false, "wrong culprit should fail");
}

console.log("Rule tests passed.");
