import type {
  CaseFromLog,
  EmergenceProofTrace,
  EvidenceNotebookItem,
  MapInteractiveTarget,
  PlayableCaseIntake,
  PlayableCaseNextAction,
  PlayableCaseProgress,
  PlayableCaseRouteIntegrity,
  PlayableCaseSourceTrail,
  PlayableCaseTask,
  PlayerSession,
  ProofTourStep,
  WorldEvent,
  WorldState
} from "./world-types";
import type { CaseProofCoverage } from "./types";
import { buildDeductionGraph, deriveSuspectBoard } from "./deduction-graph";
import { buildCaseTruthLedger, evaluateCaseProofCoverage } from "./proof-ledger";

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

const intakeStageLabels: Record<string, string> = {
  motive: "Motive",
  means: "Means",
  opportunity: "Opportunity",
  "cover-up": "Cover-up",
  memory: "Memory support",
  exclusion: "Non-culprit exclusion"
};

function eventLabelForIntake(event: WorldEvent, solved: boolean) {
  if (solved || !event.hidden) return event.publicSummary;
  return "Hidden source event";
}

function eventDetailForIntake(event: WorldEvent, solved: boolean) {
  if (solved || !event.hidden) return `${event.time} at ${event.locationId}: ${event.publicSummary}`;
  return "Locked until the player proves the case; the intake keeps the source chain count visible without revealing the hidden action.";
}

function evidenceKindLabel(isKey: boolean, index: number) {
  return `${isKey ? "key" : "support"} clue ${index + 1}`;
}

function buildRouteIntegrity(caseFromLog: CaseFromLog, events: WorldEvent[] = []): PlayableCaseRouteIntegrity {
  const ledger = buildCaseTruthLedger(caseFromLog, events);
  const discoverable = caseFromLog.deductionCase.evidence.filter((item) => item.discoverable);
  const discoverableIds = new Set(discoverable.map((item) => item.id));
  const contradictionEvidenceIds = new Set(caseFromLog.testimonies.flatMap((item) => item.contradictionEvidenceIds));
  const criticalCoverage = {
    motive: ledger.obligations.some((item) => item.kind === "motive" && item.evidenceIds.some((id) => discoverableIds.has(id)) && (item.eventIds.length || item.memoryIds.length)),
    means: ledger.obligations.some((item) => item.kind === "means" && item.evidenceIds.some((id) => discoverableIds.has(id)) && (item.eventIds.length || item.memoryIds.length)),
    opportunity: ledger.obligations.some((item) => item.kind === "opportunity" && item.evidenceIds.some((id) => discoverableIds.has(id)) && (item.eventIds.length || item.memoryIds.length)),
    exclusion: ledger.obligations.some((item) => item.kind === "exclusion" && item.evidenceIds.some((id) => discoverableIds.has(id)) && (item.eventIds.length || item.memoryIds.length))
  };
  const searchableEvidence = discoverable.length > 0;
  const witnessAvailable = caseFromLog.testimonies.some((item) => item.characterId);
  const contradictionAvailable = discoverable.some((item) => contradictionEvidenceIds.has(item.id));
  const blockers = [
    !searchableEvidence ? "No discoverable evidence route is available." : "",
    !witnessAvailable ? "No witness testimony route is available." : "",
    !contradictionAvailable ? "No discoverable clue can challenge testimony yet." : "",
    !criticalCoverage.motive ? "Motive coverage is not backed by a source event or discoverable clue." : "",
    !criticalCoverage.means ? "Means coverage is not backed by a source event or discoverable clue." : "",
    !criticalCoverage.opportunity ? "Opportunity coverage is not backed by a source event or discoverable clue." : "",
    !criticalCoverage.exclusion ? "Non-culprit exclusion coverage is missing." : "",
    !ledger.valid ? `Truth Ledger has ${ledger.gaps.length} unbacked proof obligation(s).` : ""
  ].filter(Boolean);
  return {
    playable: blockers.length === 0,
    searchableEvidence,
    witnessAvailable,
    contradictionAvailable,
    proofLedgerValid: ledger.valid,
    criticalCoverage,
    blockers
  };
}

function buildProgressStages(starterTasks: PlayableCaseTask[], progress: PlayableCaseProgress): PlayableCaseTask[] {
  return starterTasks.map((task) => {
    if (task.kind === "search") return { ...task, complete: progress.discoveredEvidence > 0, detail: `${progress.discoveredEvidence}/${progress.totalEvidence} discoverable clues found. ${task.detail}` };
    if (task.kind === "question") return { ...task, complete: progress.questionedWitnesses > 0, detail: `${progress.questionedWitnesses}/${progress.totalWitnesses} witnesses questioned. ${task.detail}` };
    if (task.kind === "challenge") return { ...task, complete: progress.challengeHitCount > 0, detail: `${progress.challengeReadyCount} testimony challenge(s) ready; ${progress.challengeHitCount} hit. ${task.detail}` };
    if (task.kind === "submit") return { ...task, complete: progress.solved, locked: !progress.submitReady, detail: progress.submitReady ? "The route has enough discovered material to submit a theory." : task.detail };
    return task;
  });
}

function spoilerSafeProofCoverage(coverage: CaseProofCoverage, solved: boolean): CaseProofCoverage {
  if (solved) return coverage;
  return {
    ...coverage,
    coveredObligationIds: coverage.coveredObligationIds.map((_, index) => `covered:${index + 1}`),
    missingObligationIds: coverage.missingObligationIds.map((_, index) => `missing:${index + 1}`),
    gaps: coverage.gaps.map((gap, index) => ({
      ...gap,
      obligationId: `proof-gap:${gap.kind}:${index + 1}`,
      missingEvidenceIds: [],
      missingEventIds: [],
      missingMemoryIds: []
    }))
  };
}

function buildNextAction(input: {
  session?: PlayerSession | null;
  evidenceRoute: PlayableCaseIntake["evidenceRoute"];
  witnessPlan: PlayableCaseIntake["witnessPlan"];
  progress: PlayableCaseProgress;
  routeIntegrity: PlayableCaseRouteIntegrity;
}): PlayableCaseNextAction {
  if (!input.session) {
    return {
      kind: "join",
      label: "Join the investigation",
      detail: "Create a player session before searching source-backed clues.",
      buttonLabel: "Join investigation"
    };
  }
  if (input.progress.solved) {
    return {
      kind: "review",
      label: "Review unlocked source trail",
      detail: "The case is solved; inspect the full source chain and proof tour.",
      buttonLabel: "Review source trail"
    };
  }
  const nextEvidence = input.evidenceRoute.find((item) => !item.discovered);
  if (nextEvidence) {
    return {
      kind: "search",
      label: "Search the next linked scene",
      detail: nextEvidence.hint,
      buttonLabel: "Focus search location",
      targetLocationId: nextEvidence.locationId,
      targetEvidenceId: nextEvidence.id
    };
  }
  const challenge = input.witnessPlan.find((item) => item.challengeReady);
  if (challenge) {
    return {
      kind: "challenge",
      label: "Challenge testimony",
      detail: challenge.hint,
      buttonLabel: "Prepare challenge",
      targetCharacterId: challenge.characterId === "locked-suspect" ? undefined : challenge.characterId,
      targetEvidenceId: challenge.suggestedEvidenceIds[0]
    };
  }
  const witness = input.witnessPlan.find((item) => !item.questioned && item.characterId !== "locked-suspect");
  if (witness) {
    return {
      kind: "question",
      label: "Question a memory source",
      detail: witness.hint,
      buttonLabel: "Focus witness",
      targetCharacterId: witness.characterId
    };
  }
  if (input.progress.submitReady) {
    return {
      kind: "submit",
      label: input.progress.wrongTheorySubmitted ? "Revise and submit again" : "Submit a complete theory",
      detail: input.progress.wrongTheorySubmitted ? "Use the gap cards to repair the missing stage before resubmitting." : "Use the discovered evidence chain to cover motive, method, opportunity, and exclusions.",
      buttonLabel: "Review theory form"
    };
  }
  return {
    kind: "review",
    label: "Repair route blockers",
    detail: input.routeIntegrity.blockers[0] || "Continue reviewing evidence and testimony until the route is complete.",
    buttonLabel: "Review gaps"
  };
}

export function validatePlayableCaseRoute(caseFromLog: CaseFromLog, events: WorldEvent[] = []): PlayableCaseRouteIntegrity {
  return buildRouteIntegrity(caseFromLog, events);
}

export function buildPlayableCaseIntake(
  caseFromLog: CaseFromLog,
  events: WorldEvent[] = [],
  world?: WorldState | null,
  session?: PlayerSession | null
): PlayableCaseIntake {
  const solved = Boolean(session?.judgement?.accepted);
  const discovered = new Set(session?.discoveredEvidenceIds || []);
  const interrogationLog = session?.interrogationLog || [];
  const sourceMap = caseFromLog.sourceMap || {};
  const sourceEventIds = Array.from(new Set([...(caseFromLog.sourceEventIds || []), ...(sourceMap.sourceEventIds || [])]));
  const evidenceSourceEventIds = sourceMap.evidenceSourceEventIds || {};
  const chainStageSourceEventIds = sourceMap.chainStageSourceEventIds || {};
  const routeIntegrity = buildRouteIntegrity(caseFromLog, events);
  const truthLedger = buildCaseTruthLedger(caseFromLog, events);
  const proofCoverage = evaluateCaseProofCoverage(truthLedger, {
    discoveredEvidenceIds: session?.discoveredEvidenceIds || [],
    selectedEvidenceIds: session?.submittedTheory?.evidenceIds,
    challengedCharacterIds: interrogationLog.filter((entry) => entry.challenge?.hit).map((entry) => entry.characterId),
    solved
  });
  const sourceEvents = sourceEventIds.map((id) => events.find((event) => event.id === id)).filter((event): event is WorldEvent => Boolean(event));
  const memorySourceIds = sourceMap.memorySourceIds || [];
  const observationSourceIds = sourceMap.observationSourceIds || [];
  const totalEvidence = caseFromLog.deductionCase.evidence.length;
  const discoveredEvidence = caseFromLog.deductionCase.evidence.filter((item) => discovered.has(item.id));
  const questioned = new Set(interrogationLog.map((entry) => entry.characterId));
  const challengeHits = new Set(interrogationLog.filter((entry) => entry.challenge?.hit).map((entry) => entry.characterId));
  const submittedEvidenceCount = session?.submittedTheory?.evidenceIds?.length || 0;
  const chainStageIds = ["motive", "means", "opportunity", "cover-up", "memory", "exclusion"];
  const chainStages = chainStageIds.map((id) => ({
    id,
    label: intakeStageLabels[id] || id,
    complete: id === "memory"
      ? memorySourceIds.length > 0 || Boolean(chainStageSourceEventIds[id]?.length)
      : Boolean(chainStageSourceEventIds[id]?.length),
    sourceEventCount: chainStageSourceEventIds[id]?.length || 0
  }));
  const completeStages = chainStages.filter((stage) => stage.complete).length;
  const status = solved ? "solved" : session ? "investigating" : "ready";
  const sceneById = new Map(caseFromLog.deductionCase.scenes.map((scene) => [scene.id, scene]));
  const sceneByName = new Map(caseFromLog.deductionCase.scenes.map((scene) => [scene.name, scene]));
  const characterById = new Map(caseFromLog.deductionCase.characters.map((character) => [character.id, character]));
  const evidenceRoute = caseFromLog.deductionCase.evidence
    .filter((evidence) => evidence.discoverable)
    .map((evidence, index) => {
      const sourceCount = evidenceSourceEventIds[evidence.id]?.length || 0;
      const scene = sceneById.get(evidence.location) || sceneByName.get(evidence.location);
      const locationId = scene?.id || world?.locations.find((location) => location.name === evidence.location)?.id || evidence.location;
      const locationName = scene?.name || world?.locations.find((location) => location.id === evidence.location)?.name || evidence.location;
      return {
        id: evidence.id,
        locationId,
        locationName,
        discovered: discovered.has(evidence.id),
        isKey: evidence.isKey,
        hint: discovered.has(evidence.id)
          ? `${evidence.title} is available for the reasoning chain.`
          : `Search ${locationName} for ${evidenceKindLabel(evidence.isKey, index)}${sourceCount ? ` backed by ${sourceCount} source event${sourceCount === 1 ? "" : "s"}` : ""}.`
      };
    });
  const witnessPlan = caseFromLog.testimonies.slice(0, 6).map((testimony) => {
    const character = characterById.get(testimony.characterId);
    const readyEvidenceIds = testimony.contradictionEvidenceIds.filter((id) => discovered.has(id));
    const masksTruth = !solved && testimony.characterId === caseFromLog.deductionCase.truth.culpritId;
    const displayName = masksTruth ? "A linked suspect" : character?.name || testimony.characterId;
    return {
      characterId: masksTruth ? "locked-suspect" : testimony.characterId,
      characterName: displayName,
      questioned: questioned.has(testimony.characterId),
      challengeReady: readyEvidenceIds.length > 0 && !challengeHits.has(testimony.characterId),
      suggestedEvidenceIds: solved ? testimony.contradictionEvidenceIds : readyEvidenceIds,
      hint: readyEvidenceIds.length
        ? `Present ${readyEvidenceIds.length} discovered clue${readyEvidenceIds.length === 1 ? "" : "s"} to test this memory-scoped testimony.`
        : `Question ${displayName} after searching linked scenes; hidden contradiction evidence is not named yet.`
    };
  });
  const starterTasks = [
    {
      id: "intake:observe",
      kind: "observe" as const,
      title: "Read the public incident window",
      detail: "Start from the visible crime marker and the public event log before opening hidden source details.",
      complete: true,
      targetLocationId: caseFromLog.generationProfile.sceneLocationId
    },
    {
      id: "intake:search",
      kind: "search" as const,
      title: "Search the first linked scene",
      detail: evidenceRoute.find((item) => !item.discovered)?.hint || "All discoverable clues are already in the notebook.",
      complete: discoveredEvidence.length > 0,
      targetLocationId: evidenceRoute.find((item) => !item.discovered)?.locationId || evidenceRoute[0]?.locationId,
      targetEvidenceId: evidenceRoute.find((item) => !item.discovered)?.id || evidenceRoute[0]?.id
    },
    {
      id: "intake:question",
      kind: "question" as const,
      title: "Question a memory source",
      detail: witnessPlan.find((item) => !item.questioned)?.hint || "All listed witnesses have been questioned.",
      complete: interrogationLog.length > 0,
      targetCharacterId: witnessPlan.find((item) => !item.questioned)?.characterId || witnessPlan[0]?.characterId
    },
    {
      id: "intake:challenge",
      kind: "challenge" as const,
      title: "Challenge testimony with a discovered clue",
      detail: witnessPlan.find((item) => item.challengeReady)?.hint || "Find a contradiction clue before challenging testimony.",
      complete: Boolean(interrogationLog.some((entry) => entry.challenge?.hit)),
      targetCharacterId: witnessPlan.find((item) => item.challengeReady)?.characterId
    },
    {
      id: "intake:submit",
      kind: "submit" as const,
      title: "Submit only after the chain is closed",
      detail: proofCoverage.complete ? "The proof ledger is covered; submit the culprit, motive, method, and evidence chain." : "Use discovered evidence to cover motive, method, opportunity, contradictions, and non-culprit exclusions.",
      complete: Boolean(session?.judgement?.accepted),
      locked: !proofCoverage.complete && discoveredEvidence.length < Math.min(3, totalEvidence)
    }
  ];
  const spoilerSafeGaps = [
    ...routeIntegrity.blockers,
    ...proofCoverage.gaps.slice(0, 6).map((gap) => gap.detail),
    ...chainStages.filter((stage) => !stage.complete).map((stage) => `${stage.label} still needs source support.`),
    ...(discoveredEvidence.length ? [] : ["No evidence has been discovered in this session yet."]),
    ...(witnessPlan.some((item) => item.challengeReady) || solved ? [] : ["No testimony challenge is ready until a linked clue is discovered."])
  ];
  const progress: PlayableCaseProgress = {
    currentStage: !session ? "join" : solved ? "solved" : discoveredEvidence.length < Math.min(totalEvidence, 1) ? "search" : interrogationLog.length < 1 ? "question" : challengeHits.size < 1 && witnessPlan.some((item) => item.challengeReady) ? "challenge" : "submit",
    discoveredEvidence: discoveredEvidence.length,
    totalEvidence,
    questionedWitnesses: questioned.size,
    totalWitnesses: witnessPlan.length,
    challengeReadyCount: witnessPlan.filter((item) => item.challengeReady).length,
    challengeHitCount: challengeHits.size,
    selectedTheoryEvidence: submittedEvidenceCount,
    submitReady: (proofCoverage.complete || solved) && interrogationLog.length > 0 && routeIntegrity.playable,
    wrongTheorySubmitted: Boolean(session?.judgement && !session.judgement.accepted),
    solved
  };
  const progressStages = buildProgressStages(starterTasks, progress);
  const nextAction = buildNextAction({ session, evidenceRoute, witnessPlan, progress, routeIntegrity });
  const sourceTrail: PlayableCaseSourceTrail[] = [
    {
      id: `candidate:${caseFromLog.sourceCandidateId || caseFromLog.id}`,
      kind: "candidate",
      label: "Emergence candidate",
      detail: `Extracted from ${sourceEventIds.length} source events and ${memorySourceIds.length} memory records.`,
      hidden: false,
      characterIds: []
    },
    ...sourceEvents.slice(0, solved ? 12 : 6).map((event, index) => ({
      id: solved ? `event:${event.id}` : `event:source-${index + 1}`,
      kind: "event" as const,
      label: eventLabelForIntake(event, solved),
      detail: eventDetailForIntake(event, solved),
      hidden: event.hidden && !solved,
      eventId: solved ? event.id : undefined,
      time: event.time,
      locationId: event.locationId,
      characterIds: solved ? event.relatedCharacterIds : event.relatedCharacterIds.filter((id) => id !== caseFromLog.deductionCase.truth.culpritId)
    })),
    ...memorySourceIds.slice(0, solved ? 8 : 3).map((id, index) => ({
      id: solved ? `memory:${id}` : `memory:source-${index + 1}`,
      kind: "memory" as const,
      label: solved ? id : "Locked memory source",
      detail: solved ? "Memory source used by the extracted testimony chain." : "Memory id is hidden until the case is solved.",
      hidden: !solved,
      memoryId: solved ? id : undefined,
      characterIds: []
    }))
  ];
  return {
    caseId: caseFromLog.id,
    sourceCandidateId: caseFromLog.sourceCandidateId || sourceMap.sourceCandidateId,
    readiness: {
      status,
      score: Math.min(100, Math.round((completeStages / Math.max(chainStages.length, 1)) * 55 + (proofCoverage.coverageRatio * 25) + (caseFromLog.validation.valid ? 10 : 0) + (caseFromLog.qualityReport?.reasoningTraceComplete ? 10 : 0))),
      summary: solved
        ? "Solved: full source trail is unlocked."
        : "Ready for low-spoiler investigation: source counts, route hints, and witness plans are visible; hidden conclusions stay locked."
    },
    chainStages,
    starterTasks,
    evidenceRoute,
    witnessPlan,
    spoilerSafeGaps,
    sourceCounts: {
      events: sourceEventIds.length,
      memories: memorySourceIds.length,
      observations: observationSourceIds.length,
      discoveredEvidence: discoveredEvidence.length,
      totalEvidence
    },
    sourceTrail
    ,
    nextAction,
    routeIntegrity,
    proofCoverage: spoilerSafeProofCoverage(proofCoverage, solved),
    progress,
    progressStages,
    blockedReasons: spoilerSafeGaps
  };
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
