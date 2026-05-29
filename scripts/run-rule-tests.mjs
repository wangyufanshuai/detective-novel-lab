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
