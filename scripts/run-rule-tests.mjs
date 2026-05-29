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
const showcase = rules.createFallbackCase("规则测试");

{
  const report = rules.validateCase(showcase);
  assert.equal(report.valid, true, "showcase case should be valid");
  assert.equal(Array.isArray(report.errors), true, "report exposes errors");
  assert.equal(Array.isArray(report.warnings), true, "report exposes warnings");
  assert.equal(report.reasoningCoverage.requiredEvidenceIds.length >= 3, true, "report exposes reasoning coverage");
}

{
  const testCase = clone(showcase);
  const rival = testCase.logicPuzzle.suspectMatrix.find((row) => row.characterId === "rival");
  rival.means = true;
  rival.opportunity = true;
  rival.excludedByEvidenceIds = [];
  testCase.logicPuzzle.exclusionChains = testCase.logicPuzzle.exclusionChains.filter((chain) => chain.characterId !== "rival");
  assert.equal(rules.validateCase(testCase).valid, false, "two complete suspects should be invalid");
}

{
  const testCase = clone(showcase);
  const admin = testCase.logicPuzzle.suspectMatrix.find((row) => row.characterId === "admin");
  admin.opportunity = true;
  admin.excludedByEvidenceIds = [];
  testCase.logicPuzzle.exclusionChains = testCase.logicPuzzle.exclusionChains.filter((chain) => chain.characterId !== "admin");
  const report = rules.validateCase(testCase);
  assert.equal(report.valid, false, "non-culprit with full MMO and no exclusion evidence should be invalid");
}

{
  const testCase = clone(showcase);
  const key = testCase.evidence.find((item) => item.id === "e-power-log");
  key.discoverable = false;
  const report = rules.validateCase(testCase);
  assert.equal(report.valid, false, "undiscoverable decisive evidence should be invalid");
}

{
  const contradictions = rules.getTimelineContradictions(showcase, ["e-power-log"]);
  assert.equal(contradictions.some((item) => item.revealed), true, "discovered evidence should reveal timeline contradiction");
}

{
  const driftCase = clone(showcase);
  driftCase.logicPuzzle.exclusionChains = [
    { suspectId: "rival", reason: "会议室白板排除", evidence: ["e-meeting-note"] },
    { suspectId: "admin", reason: "维修车 GPS 排除", evidence: ["e-van-gps"] }
  ];
  driftCase.logicPuzzle.criticalReasoningChain = [
    "备用电源日志（e-power-log）证明监控空白可被人为制造。",
    "望远镜基座刻度（e-base-mark）证明死亡留言指向固定点。",
    "档案盒灰尘（e-dust）证明陆青不在场证明为假。"
  ];
  const report = rules.validateCase(driftCase);
  assert.equal(report.valid, true, "common LLM field drift should be tolerated");
}

{
  const discovered = showcase.evidence.filter((item) => item.discoverable).map((item) => item.id);
  const theory = {
    culpritId: showcase.truth.culpritId,
    motive: showcase.truth.motive,
    method: showcase.truth.method,
    evidenceIds: discovered
  };
  assert.equal(rules.judgeTheory(showcase, theory, discovered).accepted, true, "complete correct theory should pass");
  assert.equal(rules.judgeTheory(showcase, { ...theory, culpritId: "rival" }, discovered).accepted, false, "wrong culprit should fail");
  assert.equal(rules.judgeTheory(showcase, { ...theory, evidenceIds: [] }, discovered).accepted, false, "missing evidence chain should fail");
}

console.log("Rule tests passed.");
