import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const runtimeDir = path.join(root, "outputs", "ai-safety-runtime");

async function compileFile(sourcePath, targetPath) {
  const source = await fs.readFile(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(
    targetPath,
    compiled
      .replaceAll("@/lib/engine", "../../engine/index.cjs")
      .replace(/require\("\.\/(.+?)"\)/g, 'require("./$1.cjs")'),
    "utf8"
  );
}

async function loadEngine() {
  const sourceDir = path.join(root, "packages", "engine", "src");
  const engineDir = path.join(runtimeDir, "engine");
  await fs.mkdir(engineDir, { recursive: true });
  for (const entry of (await fs.readdir(sourceDir)).filter((name) => name.endsWith(".ts"))) {
    await compileFile(path.join(sourceDir, entry), path.join(engineDir, entry.replace(/\.ts$/, ".cjs")));
  }
  return import(pathToFileURL(path.join(engineDir, "index.cjs")).href);
}

const engine = await loadEngine();
await compileFile(path.join(root, "lib", "world", "ai.ts"), path.join(runtimeDir, "lib", "world", "ai.cjs"));
const ai = await import(pathToFileURL(path.join(runtimeDir, "lib", "world", "ai.cjs")).href);

const world = engine.createInitialWorld("ai-safety-seed");
const daily = engine.simulateDailyLife(world, 1, []);
const tick = engine.simulateWorldTick(daily.world, daily.events);
const events = [...daily.events, ...tick.events];
const caseFromLog = engine.extractCaseFromWorld(tick.world, events);
const focus = caseFromLog.generationProfile.focusSuspectIds[0];
const context = engine.buildNpcKnowledgeContext(tick.world, events, caseFromLog.deductionCase, focus, []);
const payload = ai.buildGuardedNpcPromptPayload({ context, question: "你知道谁是凶手吗？" });
const text = JSON.stringify(payload);
const audit = ai.auditPromptPayload(payload, caseFromLog, focus);
const dialogueEval = ai.evaluateNpcDialogue({
  answer: "我只知道自己见过的部分。你问到的凶手身份超出我的记忆范围，我不能确认。",
  caseFromLog,
  characterId: focus,
  promptAudit: audit
});
const contract = ai.buildRevealFactContract(caseFromLog);
const localReveal = ai.makeLocalReveal(caseFromLog);
const revealEval = ai.evaluateReveal(localReveal, caseFromLog);
const wrongCulpritReveal = localReveal.replaceAll(contract.culprit.name, "错误凶手").replaceAll(contract.culprit.id, "npc-wrong");
const wrongMethodReveal = localReveal.replace(contract.method.text, "错误手法");
const missingEvidenceReveal = [
  `本地规则复盘：凶手是${contract.culprit.name}（${contract.culprit.id}）。`,
  `动机：${contract.motive.text}`,
  `手法：${contract.method.text}`,
  `源事件：${contract.sourceEventIds.slice(0, 2).join("、")}。`
].join("\n");

assert.equal(text.includes("culpritId"), false, "NPC prompt payload must not include culpritId");
assert.equal(text.includes(caseFromLog.deductionCase.truth.method), false, "NPC prompt payload must not include full truth method");
assert.equal(audit.safe, true, "Prompt audit must mark scoped NPC payload as safe");
assert.equal(dialogueEval.safetyFlags.length, 0, "Harmless scoped dialogue should not trigger safety flags");
assert.equal(contract.culprit.id, caseFromLog.deductionCase.truth.culpritId, "Reveal contract culprit must come from local truth");
assert.equal(revealEval.factContractScore >= 85, true, "Local reveal should satisfy the fact contract");
assert.equal(ai.evaluateReveal(wrongCulpritReveal, caseFromLog).culpritPreserved, false, "Changed culprit must fail reveal evaluation");
assert.equal(ai.evaluateReveal(wrongMethodReveal, caseFromLog).methodPreserved, false, "Changed method must fail reveal evaluation");
assert.equal(ai.evaluateReveal(missingEvidenceReveal, caseFromLog).evidencePreserved, false, "Missing decisive evidence must fail reveal evaluation");
assert.equal(
  payload.visibleMemories.every((memory) => context.visibleMemories.some((source) => source.id === memory.id && source.npcId === focus)),
  true,
  "NPC prompt payload should only include selected NPC memories"
);

console.log("AI safety tests passed.");
