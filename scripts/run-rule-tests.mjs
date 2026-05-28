import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const outDir = path.join(root, "outputs");
const sourcePath = path.join(root, "lib", "deduction.ts");
const runtimePath = path.join(outDir, "deduction-runtime.cjs");

async function loadRules() {
  await fs.mkdir(outDir, { recursive: true });
  const source = await fs.readFile(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  await fs.writeFile(runtimePath, compiled, "utf8");
  return import(pathToFileURL(runtimePath).href);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const rules = await loadRules();
const baseCase = rules.createFallbackCase("规则测试");

{
  const testCase = clone(baseCase);
  assert.equal(rules.validateCase(testCase).valid, true, "fallback case should be valid");
}

{
  const testCase = clone(baseCase);
  const rival = testCase.logicPuzzle.suspectMatrix.find((row) => row.characterId === "rival");
  rival.means = true;
  rival.opportunity = true;
  rival.excludedByEvidenceIds = [];
  testCase.logicPuzzle.exclusionChains = testCase.logicPuzzle.exclusionChains.filter((chain) => chain.characterId !== "rival");
  assert.equal(rules.validateCase(testCase).valid, false, "two complete suspects should be invalid");
}

{
  const testCase = clone(baseCase);
  const admin = testCase.logicPuzzle.suspectMatrix.find((row) => row.characterId === "admin");
  admin.opportunity = true;
  admin.excludedByEvidenceIds = [];
  testCase.logicPuzzle.exclusionChains = testCase.logicPuzzle.exclusionChains.filter((chain) => chain.characterId !== "admin");
  const validation = rules.validateCase(testCase);
  assert.equal(validation.valid, false, "non-culprit with full MMO and no exclusion evidence should be invalid");
}

{
  const testCase = clone(baseCase);
  const key = testCase.evidence.find((item) => item.id === "e-power-log");
  key.discoverable = false;
  const validation = rules.validateCase(testCase);
  assert.equal(validation.valid, false, "undiscoverable decisive evidence should be invalid");
}

{
  const contradictions = rules.getTimelineContradictions(baseCase, ["e-power-log"]);
  assert.equal(contradictions.some((item) => item.revealed), true, "discovered evidence should reveal timeline contradiction");
}

{
  const discovered = baseCase.evidence.filter((item) => item.discoverable).map((item) => item.id);
  const theory = {
    culpritId: baseCase.truth.culpritId,
    motive: baseCase.truth.motive,
    method: baseCase.truth.method,
    evidenceIds: discovered
  };
  assert.equal(rules.judgeTheory(baseCase, theory, discovered).accepted, true, "complete correct theory should pass");
  assert.equal(rules.judgeTheory(baseCase, { ...theory, culpritId: "rival" }, discovered).accepted, false, "wrong culprit should fail");
  assert.equal(rules.judgeTheory(baseCase, { ...theory, evidenceIds: [] }, discovered).accepted, false, "missing evidence chain should fail");
}

console.log("Rule tests passed.");
