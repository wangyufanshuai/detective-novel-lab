import { judgeTheory } from "./judgement";
import { createPremiumShowcaseWorld } from "./premium-showcase";
import { buildNpcKnowledgeContext, makeRuleBoundInterrogation, updateTestimonyWithContradiction } from "./world-case";
import type { PlayerTheory } from "./types";
import type { DemoRuntimeState, PlayerSession } from "./world-types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createSession(worldId: string, caseId: string): PlayerSession {
  const stamp = new Date().toISOString();
  return {
    id: "session-static-premium",
    worldId,
    caseId,
    playerId: "player-static",
    displayName: "调查员",
    discoveredEvidenceIds: [],
    interrogationLog: [],
    createdAt: stamp,
    updatedAt: stamp
  };
}

export function createStaticDemoRuntime(): DemoRuntimeState {
  const premium = createPremiumShowcaseWorld("premium-showcase");
  return {
    mode: "static-demo",
    world: premium.world,
    events: premium.events,
    activeCase: premium.activeCase,
    session: createSession(premium.world.id, premium.activeCase.id),
    progress: {
      observedCrimeWindow: false,
      joinedInvestigation: true,
      discoveredEvidence: false,
      challengedTestimony: false,
      submittedTheory: false,
      solvedCase: false
    },
    revealText: ""
  };
}

export function discoverDemoEvidence(state: DemoRuntimeState, evidenceId: string): DemoRuntimeState {
  const next = clone(state);
  if (!next.activeCase.deductionCase.evidence.some((item) => item.id === evidenceId && item.discoverable)) return next;
  next.session.discoveredEvidenceIds = Array.from(new Set([...next.session.discoveredEvidenceIds, evidenceId]));
  next.session.updatedAt = new Date().toISOString();
  next.progress.discoveredEvidence = next.session.discoveredEvidenceIds.length > 0;
  return next;
}

export function interrogateDemoNpc(
  state: DemoRuntimeState,
  input: { characterId: string; question: string; evidenceId?: string }
): DemoRuntimeState {
  const next = clone(state);
  const context = buildNpcKnowledgeContext(
    next.world,
    next.events,
    next.activeCase.deductionCase,
    input.characterId,
    next.session.discoveredEvidenceIds
  );
  const testimonyUpdate = updateTestimonyWithContradiction(next.activeCase.testimonies, input.characterId, input.evidenceId);
  next.activeCase.testimonies = testimonyUpdate.testimonies;
  const character = next.activeCase.deductionCase.characters.find((item) => item.id === input.characterId);
  const memoryCount = context.visibleMemories.length;
  const answer = input.evidenceId
    ? `${character?.name || "NPC"}：这条证据确实影响了我之前的说法。我只能修正自己亲眼见到或记忆记录中的部分，不能替其他人下结论。`
    : `${character?.name || "NPC"}：我只能根据自己的记忆回答。目前有 ${memoryCount} 条与我直接相关的记忆记录。`;
  const entry = makeRuleBoundInterrogation(
    next.world,
    next.events,
    next.activeCase.deductionCase,
    next.session.id,
    input.characterId,
    input.question,
    next.session.discoveredEvidenceIds,
    input.evidenceId,
    answer
  );
  next.session.interrogationLog.push(entry);
  next.session.updatedAt = new Date().toISOString();
  next.progress.challengedTestimony ||= Boolean(testimonyUpdate.updated);
  return next;
}

export function submitDemoTheory(state: DemoRuntimeState, theory: PlayerTheory): DemoRuntimeState {
  const next = clone(state);
  next.session.submittedTheory = theory;
  next.session.judgement = judgeTheory(next.activeCase.deductionCase, theory, next.session.discoveredEvidenceIds);
  next.session.updatedAt = new Date().toISOString();
  next.progress.submittedTheory = true;
  next.progress.solvedCase = Boolean(next.session.judgement.accepted);
  return next;
}

export function revealDemoSolution(state: DemoRuntimeState): DemoRuntimeState {
  const next = clone(state);
  if (!next.session.judgement?.accepted) return next;
  const truth = next.activeCase.deductionCase.truth;
  const culprit = next.activeCase.deductionCase.characters.find((item) => item.id === truth.culpritId);
  const evidence = next.activeCase.deductionCase.evidence
    .filter((item) => truth.decisiveEvidenceIds.includes(item.id))
    .map((item) => `- ${item.title}：${item.trueMeaning}`)
    .join("\n");
  next.revealText = [
    `凶手：${culprit?.name || truth.culpritId}`,
    `动机：${truth.motive}`,
    `手法：${truth.method}`,
    "",
    "关键证据链：",
    evidence,
    "",
    "排除逻辑：",
    ...next.activeCase.deductionCase.logicPuzzle.exclusionChains.map((item) => `- ${item.reason}`)
  ].join("\n");
  return next;
}

export function markDemoCrimeObserved(state: DemoRuntimeState): DemoRuntimeState {
  const next = clone(state);
  next.progress.observedCrimeWindow = true;
  return next;
}
