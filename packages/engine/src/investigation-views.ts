import type {
  CaseFromLog,
  EmergenceProofTrace,
  EvidenceNotebookItem,
  MapInteractiveTarget,
  PlayerSession,
  ProofTourStep,
  WorldEvent,
  WorldState
} from "./world-types";
import { buildDeductionGraph, deriveSuspectBoard } from "./deduction-graph";

function characterName(caseFromLog: CaseFromLog, characterId: string) {
  return caseFromLog.deductionCase.characters.find((character) => character.id === characterId)?.name || characterId;
}

function sceneName(caseFromLog: CaseFromLog, sceneId: string) {
  return caseFromLog.deductionCase.scenes.find((scene) => scene.id === sceneId)?.name || sceneId;
}

function eventByEvidence(events: WorldEvent[], evidenceId: string) {
  return events.find((event) => event.evidenceId === evidenceId);
}

function hiddenEvidenceTitle(index: number) {
  return `未发现线索 ${index + 1}`;
}

export function buildEvidenceNotebook(caseFromLog: CaseFromLog, events: WorldEvent[] = [], session?: PlayerSession | null): EvidenceNotebookItem[] {
  const discovered = new Set(session?.discoveredEvidenceIds || []);
  return caseFromLog.deductionCase.evidence.map((evidence, index) => {
    const sourceEvent = eventByEvidence(events, evidence.id);
    const isDiscovered = discovered.has(evidence.id);
    const challengeNpcIds = Array.from(new Set([...evidence.relatedCharacterIds, ...caseFromLog.testimonies.filter((item) => item.contradictionEvidenceIds.includes(evidence.id)).map((item) => item.characterId)]));
    const challengeNpcNames = challengeNpcIds.map((id) => characterName(caseFromLog, id));
    const supports = evidence.supportsConclusion.length ? evidence.supportsConclusion : evidence.isKey ? ["关键证据链"] : ["背景还原"];
    const contradicts = evidence.contradicts.length ? evidence.contradicts : caseFromLog.testimonies.filter((item) => item.contradictionEvidenceIds.includes(evidence.id)).map((item) => `${characterName(caseFromLog, item.characterId)} 的证词`);
    return {
      evidenceId: evidence.id,
      title: isDiscovered ? evidence.title : hiddenEvidenceTitle(index),
      locked: !isDiscovered,
      discovered: isDiscovered,
      isKey: evidence.isKey,
      locationId: evidence.location,
      locationName: sceneName(caseFromLog, evidence.location),
      sourceEventId: isDiscovered || session?.judgement?.accepted ? sourceEvent?.id : undefined,
      sourceEventLabel: isDiscovered || session?.judgement?.accepted ? (sourceEvent ? `${sourceEvent.time} ${sourceEvent.publicSummary}` : undefined) : undefined,
      challengeNpcIds: isDiscovered ? challengeNpcIds : [],
      challengeNpcNames: isDiscovered ? challengeNpcNames : [],
      supports: isDiscovered ? supports : [],
      contradicts: isDiscovered ? contradicts : [],
      useHint: isDiscovered
        ? challengeNpcNames.length
          ? `可出示给 ${challengeNpcNames.slice(0, 2).join("、")} 质询；也可加入推理证据链。`
          : "可加入推理证据链，用于还原地点、时间或行动。"
        : "锁定：先搜索对应地点后才显示标题和用途。"
    };
  });
}

export function buildPlayerProofTour(
  caseFromLog: CaseFromLog,
  events: WorldEvent[] = [],
  trace: EmergenceProofTrace | null,
  session?: PlayerSession | null
): ProofTourStep[] {
  const solved = Boolean(session?.judgement?.accepted);
  const discovered = new Set(session?.discoveredEvidenceIds || []);
  const graph = buildDeductionGraph(caseFromLog, events);
  const board = deriveSuspectBoard(caseFromLog, events);
  const steps: ProofTourStep[] = [];

  const push = (step: ProofTourStep) => steps.push(step);
  const publicEvent = events.find((event) => event.id === caseFromLog.deathEventId) || events.find((event) => event.type === "death") || events[0];
  if (publicEvent) {
    push({
      id: `tour:event:${publicEvent.id}`,
      stage: "event",
      title: "事件发生",
      detail: solved || !publicEvent.hidden ? publicEvent.publicSummary : "案发窗口已公开，但隐藏行动细节仍需调查。",
      locked: publicEvent.hidden && !solved,
      complete: true,
      time: publicEvent.time,
      locationId: publicEvent.locationId,
      characterIds: publicEvent.relatedCharacterIds,
      evidenceIds: publicEvent.evidenceId ? [publicEvent.evidenceId] : [],
      eventIds: [publicEvent.id],
      memoryIds: []
    });
  }

  for (const testimony of caseFromLog.testimonies.slice(0, 4)) {
    const evidenceHit = testimony.contradictionEvidenceIds.some((id) => discovered.has(id));
    const visible = solved || evidenceHit;
    push({
      id: `tour:memory:${testimony.id}`,
      stage: "memory",
      title: visible ? `${characterName(caseFromLog, testimony.characterId)} 的记忆范围` : "未验证的 NPC 记忆",
      detail: visible ? testimony.currentStatement : "NPC 只能基于自身 MemoryRecord 作答；相关矛盾需要证据触发。",
      locked: !visible,
      complete: visible,
      characterIds: [testimony.characterId],
      evidenceIds: visible ? testimony.contradictionEvidenceIds.filter((id) => discovered.has(id) || solved) : [],
      eventIds: [],
      memoryIds: visible ? testimony.memoryIds : []
    });
  }

  for (const evidence of caseFromLog.deductionCase.evidence) {
    const visible = solved || discovered.has(evidence.id);
    const source = eventByEvidence(events, evidence.id);
    push({
      id: `tour:evidence:${evidence.id}`,
      stage: "evidence",
      title: visible ? evidence.title : "未发现证据",
      detail: visible ? evidence.visibleDescription : "先搜索地点后才解锁证据标题、来源和用途。",
      locked: !visible,
      complete: visible,
      time: source?.time,
      locationId: evidence.location,
      characterIds: evidence.relatedCharacterIds,
      evidenceIds: visible ? [evidence.id] : [],
      eventIds: source && visible ? [source.id] : [],
      memoryIds: []
    });
  }

  for (const node of graph.nodes.filter((item) => item.type === "testimony")) {
    const visible = solved || node.evidenceIds.some((id) => discovered.has(id));
    push({
      id: `tour:contradiction:${node.id}`,
      stage: "contradiction",
      title: visible ? node.label : "锁定的证词矛盾",
      detail: visible ? node.detail : "需要先发现并出示对应证据；未解锁前不显示矛盾内容。",
      locked: !visible,
      complete: visible,
      characterIds: node.characterIds,
      evidenceIds: visible ? node.evidenceIds.filter((id) => discovered.has(id) || solved) : [],
      eventIds: visible ? node.eventIds : [],
      memoryIds: []
    });
  }

  for (const row of board.filter((item) => item.status !== "culprit")) {
    const visibleEvidenceIds = row.exclusionEvidenceIds.filter((id) => discovered.has(id) || solved);
    const visible = visibleEvidenceIds.length > 0;
    push({
      id: `tour:elimination:${row.characterId}`,
      stage: "elimination",
      title: visible ? `${row.name} 被排除` : "仍需排除证据",
      detail: visible ? `${row.name} 的表面嫌疑被已发现证据反驳。` : "非凶手的排除链仍锁定，不提前显示证据标题。",
      locked: !visible,
      complete: visible,
      characterIds: [row.characterId],
      evidenceIds: visibleEvidenceIds,
      eventIds: visible ? row.sourceEventIds : [],
      memoryIds: []
    });
  }

  const culprit = characterName(caseFromLog, caseFromLog.deductionCase.truth.culpritId);
  push({
    id: "tour:conclusion",
    stage: "conclusion",
    title: solved ? "唯一结论" : "最终结论锁定",
    detail: solved ? `${culprit} 是唯一保留完整动机、手段、机会且没有被反证排除的人。` : "只有本地规则接受玩家推理后，才显示最终结论。",
    locked: !solved,
    complete: solved,
    characterIds: solved ? [caseFromLog.deductionCase.truth.culpritId] : [],
    evidenceIds: solved ? caseFromLog.deductionCase.truth.decisiveEvidenceIds : [],
    eventIds: solved ? caseFromLog.sourceEventIds : [],
    memoryIds: []
  });

  if (trace) {
    push({
      id: "tour:validation",
      stage: "validation",
      title: "本地规则验收",
      detail: `Event-backed: ${trace.evaluation.worldBackedEvidence ? "Yes" : "No"} / Memory-scoped: ${trace.evaluation.memoryScopedTestimony ? "Yes" : "No"} / Hard logic: ${trace.evaluation.hardLogicValid ? "Pass" : "Fail"}`,
      locked: false,
      complete: trace.evaluation.hardLogicValid,
      characterIds: [],
      evidenceIds: [],
      eventIds: [],
      memoryIds: []
    });
  }

  return steps;
}

export function deriveMapInteractiveTargets(world: WorldState, caseFromLog?: CaseFromLog, events: WorldEvent[] = [], session?: PlayerSession | null): MapInteractiveTarget[] {
  const discovered = new Set(session?.discoveredEvidenceIds || []);
  const targets: MapInteractiveTarget[] = [];
  for (const location of world.locations) {
    const scene = caseFromLog?.deductionCase.scenes.find((item) => item.id === location.id);
    targets.push({
      id: `location:${location.id}`,
      kind: "location",
      label: location.name,
      locationId: location.id,
      enabled: Boolean(scene)
    });
  }
  for (const npc of world.npcs) {
    targets.push({
      id: `npc:${npc.id}`,
      kind: "npc",
      label: npc.name,
      characterId: npc.id,
      locationId: npc.schedule[world.currentTime] || npc.homeLocationId,
      enabled: npc.alive
    });
  }
  for (const event of events.filter((item) => !item.hidden || session?.judgement?.accepted || (item.evidenceId && discovered.has(item.evidenceId)))) {
    targets.push({
      id: `event:${event.id}`,
      kind: "event",
      label: event.publicSummary,
      eventId: event.id,
      evidenceId: event.evidenceId,
      locationId: event.locationId,
      time: event.time,
      enabled: true
    });
  }
  for (const evidence of caseFromLog?.deductionCase.evidence || []) {
    targets.push({
      id: `evidence:${evidence.id}`,
      kind: "evidence",
      label: discovered.has(evidence.id) ? evidence.title : "未发现证据",
      evidenceId: evidence.id,
      locationId: evidence.location,
      enabled: evidence.discoverable
    });
  }
  return targets;
}
