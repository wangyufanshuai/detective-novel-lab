import {
  buildNovelCausalityReport,
  novelEvidenceQuoteLimit,
  type NovelCharacterStatePoint,
  type NovelEvidenceSnippet,
  type NovelEvent,
  type NovelLongChapterText,
  type NovelReplayComparisonReport,
  type NovelSimulationActionCandidate,
  type NovelSimulationActorState,
  type NovelSimulationExplanation,
  type NovelSimulationIntervention,
  type NovelSimulationKnowledgeFact,
  type NovelSimulationMode,
  type NovelSimulationRun,
  type NovelSimulationSnapshot,
  type NovelSimulationStep,
  type NovelWorldProject,
  type NovelWorldValidationReport
} from "./novel-world";

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function clamp(value: unknown, fallback: number, min = 0, max = 100) {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, number));
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "simulation";
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function cloneSnapshot(snapshot: NovelSimulationSnapshot, id: string, stepIndex: number): NovelSimulationSnapshot {
  return {
    ...snapshot,
    id,
    stepIndex,
    actorStates: snapshot.actorStates.map((actor) => ({ ...actor, resources: [...actor.resources], knowledgeFactIds: [...actor.knowledgeFactIds] })),
    knowledgeFacts: snapshot.knowledgeFacts.map((fact) => ({ ...fact, evidence: [...fact.evidence] })),
    activeThemeSignalIds: [...snapshot.activeThemeSignalIds],
    activeCausalClaimIds: [...snapshot.activeCausalClaimIds]
  };
}

function scopedChapters(project: NovelWorldProject, throughChapterId?: string) {
  const throughOrder = throughChapterId
    ? project.chapters.find((chapter) => chapter.input.id === throughChapterId)?.input.order ?? Number.POSITIVE_INFINITY
    : Number.POSITIVE_INFINITY;
  return project.chapters
    .filter((chapter) => chapter.status === "ready" && chapter.input.order <= throughOrder)
    .sort((a, b) => a.input.order - b.input.order);
}

function checkpointEvents(project: NovelWorldProject, throughChapterId?: string) {
  const orderByChapter = new Map(scopedChapters(project, throughChapterId).map((chapter) => [chapter.input.id, chapter.input.order]));
  return project.mergedGraph.events
    .filter((event) => !event.sourceChapterId || orderByChapter.has(event.sourceChapterId))
    .slice()
    .sort((a, b) => (orderByChapter.get(a.sourceChapterId || "") || 0) - (orderByChapter.get(b.sourceChapterId || "") || 0) || a.order - b.order || a.id.localeCompare(b.id));
}

function eventEvidence(event: NovelEvent) {
  return (event.evidence || []).filter((snippet) => snippet.source.chapterId && snippet.source.paragraphId && snippet.source.quote);
}

function actorPoint(project: NovelWorldProject, actorEntityId: string, chapterId?: string): NovelCharacterStatePoint | undefined {
  const points = project.chapters
    .flatMap((chapter) => chapter.characterStates || [])
    .filter((point) => point.characterEntityId === actorEntityId && (!chapterId || point.chapterId === chapterId))
    .sort((a, b) => a.chapterOrder - b.chapterOrder);
  return points[points.length - 1];
}

export function compileNovelSimulationState(project: NovelWorldProject, throughChapterId?: string): NovelSimulationSnapshot {
  const chapters = scopedChapters(project, throughChapterId);
  const allowedChapterIds = new Set(chapters.map((chapter) => chapter.input.id));
  const events = checkpointEvents(project, throughChapterId);
  const actors = project.mergedGraph.entities.filter((entity) => entity.kind === "character");
  const knowledgeFacts: NovelSimulationKnowledgeFact[] = [];

  for (const event of events) {
    const evidence = eventEvidence(event);
    if (!evidence.length) continue;
    const informedActors = event.publicKnowledge ? actors.map((actor) => actor.id) : event.participantEntityIds;
    for (const actorEntityId of informedActors) {
      knowledgeFacts.push({
        id: `sim-fact-${event.id}-${actorEntityId}`,
        actorEntityId,
        label: event.summary,
        sourceEventId: event.id,
        chapterId: event.sourceChapterId,
        confidence: Math.max(...evidence.map((snippet) => snippet.source.confidence)),
        evidence
      });
    }
  }

  const actorStates: NovelSimulationActorState[] = actors.map((actor) => {
    const firstEvent = events.find((event) => event.participantEntityIds.includes(actor.id));
    const point = actorPoint(project, actor.id, firstEvent?.sourceChapterId);
    const relationshipPressure = project.mergedGraph.relationships
      .filter((relationship) => relationship.fromEntityId === actor.id || relationship.toEntityId === actor.id)
      .reduce((maximum, relationship) => Math.max(maximum, relationship.strength), actor.tension || 0);
    return {
      actorEntityId: actor.id,
      name: actor.name,
      locationEntityId: firstEvent?.locationEntityId,
      goal: point?.dimensions.goal.summary || actor.role || actor.summary,
      belief: point?.dimensions.belief.summary || actor.summary,
      relationshipPressure: Math.round(relationshipPressure),
      resources: project.mergedGraph.entities
        .filter((entity) => entity.kind === "item" && (entity.sourceChapterIds || []).some((id) => allowedChapterIds.has(id)))
        .slice(0, 4)
        .map((entity) => entity.id),
      bodyCapability: point ? Math.max(0, 100 - point.dimensions.bodyCapability.intensity) : 65,
      socialPosition: point?.dimensions.socialPosition.intensity || Math.max(20, 100 - (actor.tension || 50)),
      knowledgeFactIds: knowledgeFacts.filter((fact) => fact.actorEntityId === actor.id && fact.sourceEventId === firstEvent?.id).map((fact) => fact.id)
    };
  });

  return {
    id: `simulation-snapshot-${slug(project.id)}-0`,
    stepIndex: 0,
    chapterId: chapters[0]?.input.id,
    actorStates,
    knowledgeFacts,
    activeThemeSignalIds: [],
    activeCausalClaimIds: []
  };
}

function actionForEvent(event: NovelEvent): NovelSimulationActionCandidate["action"] {
  const value = `${event.title} ${event.summary} ${event.causes.join(" ")} ${event.consequences.join(" ")}`.toLowerCase();
  if (/fight|attack|conflict|arrest|demand|confront|pressure/.test(value)) return "confront";
  if (/hide|protect|save|shelter/.test(value)) return "protect";
  if (/leave|retreat|withdraw|escape/.test(value)) return "withdraw";
  if (/ask|tell|oath|order|announce|rumor|speak/.test(value)) return "communicate";
  if (/find|search|investigate|discover|trace|notice/.test(value)) return "investigate";
  if (event.locationEntityId) return "move";
  return "checkpoint";
}

function scoreCandidate(candidate: NovelSimulationActionCandidate, actor: NovelSimulationActorState | undefined, seed: string) {
  let score = candidate.sourceEventId ? 58 : 18;
  score += Math.min(20, candidate.evidence.length * 8);
  if (actor) {
    const searchable = `${candidate.label} ${candidate.ruleReasons.join(" ")}`.toLowerCase();
    const goalTerms = actor.goal.toLowerCase().split(/\W+/).filter((term) => term.length > 3);
    score += Math.min(12, goalTerms.filter((term) => searchable.includes(term)).length * 4);
    if (candidate.action === "confront") score += Math.round(actor.relationshipPressure / 10);
    if (candidate.action === "investigate") score += Math.round(actor.bodyCapability / 20);
    if (candidate.action === "communicate") score += Math.round(actor.socialPosition / 20);
    if (candidate.targetLocationEntityId === actor.locationEntityId) score += 4;
  }
  score += hash(`${seed}:${candidate.id}`) % 5;
  return candidate.legal ? score : 0;
}

export function scoreNovelActionCandidates(candidates: NovelSimulationActionCandidate[], snapshot: NovelSimulationSnapshot, seed = "novel-replay") {
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreCandidate(candidate, snapshot.actorStates.find((actor) => actor.actorEntityId === candidate.actorEntityId), seed)
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export function generateNovelActionCandidates(project: NovelWorldProject, snapshot: NovelSimulationSnapshot, checkpointEvent: NovelEvent, seed = "novel-replay") {
  const evidence = eventEvidence(checkpointEvent);
  const actorEntityId = checkpointEvent.participantEntityIds.find((id) => snapshot.actorStates.some((actor) => actor.actorEntityId === id))
    || snapshot.actorStates[0]?.actorEntityId
    || "";
  const actor = snapshot.actorStates.find((item) => item.actorEntityId === actorEntityId);
  const hasKnowledge = Boolean(actor?.knowledgeFactIds.length || checkpointEvent.publicKnowledge || evidence.length);
  const bodyEnough = (actor?.bodyCapability || 0) >= 20;
  const sourceCandidate: NovelSimulationActionCandidate = {
    id: `sim-action-source-${checkpointEvent.id}`,
    actorEntityId,
    action: actionForEvent(checkpointEvent),
    label: checkpointEvent.title,
    targetEntityIds: checkpointEvent.participantEntityIds.filter((id) => id !== actorEntityId),
    targetLocationEntityId: checkpointEvent.locationEntityId,
    sourceEventId: checkpointEvent.id,
    chapterId: checkpointEvent.sourceChapterId,
    legal: Boolean(actor && evidence.length && hasKnowledge && bodyEnough),
    score: 0,
    ruleReasons: [
      "source-checkpoint",
      hasKnowledge ? "knowledge-supported" : "knowledge-missing",
      bodyEnough ? "body-capability-sufficient" : "body-capability-insufficient",
      checkpointEvent.locationEntityId ? "location-transition-allowed" : "location-unchanged"
    ],
    blockedReasons: [
      ...(!actor ? ["actor-missing"] : []),
      ...(!evidence.length ? ["paragraph-evidence-missing"] : []),
      ...(!hasKnowledge ? ["actor-does-not-know-required-fact"] : []),
      ...(!bodyEnough ? ["body-capability-too-low"] : [])
    ],
    evidence
  };
  const alternatives: NovelSimulationActionCandidate[] = [
    {
      id: `sim-action-observe-${checkpointEvent.id}`,
      actorEntityId,
      action: "observe",
      label: `Observe before ${checkpointEvent.title}`,
      targetEntityIds: checkpointEvent.participantEntityIds.filter((id) => id !== actorEntityId),
      targetLocationEntityId: actor?.locationEntityId,
      chapterId: checkpointEvent.sourceChapterId,
      legal: Boolean(actor && evidence.length),
      score: 0,
      ruleReasons: ["low-risk-observation", "evidence-present"],
      blockedReasons: actor && evidence.length ? [] : ["actor-or-evidence-missing"],
      evidence
    },
    {
      id: `sim-action-investigate-${checkpointEvent.id}`,
      actorEntityId,
      action: "investigate",
      label: `Investigate the pressure behind ${checkpointEvent.title}`,
      targetEntityIds: checkpointEvent.participantEntityIds.filter((id) => id !== actorEntityId),
      targetLocationEntityId: checkpointEvent.locationEntityId || actor?.locationEntityId,
      chapterId: checkpointEvent.sourceChapterId,
      legal: Boolean(actor && evidence.length && actor.bodyCapability >= 15),
      score: 0,
      ruleReasons: ["evidence-seeking", "body-capability-check"],
      blockedReasons: actor && evidence.length && actor.bodyCapability >= 15 ? [] : ["investigation-prerequisite-missing"],
      evidence
    },
    {
      id: `sim-action-withdraw-${checkpointEvent.id}`,
      actorEntityId,
      action: "withdraw",
      label: `Withdraw from ${checkpointEvent.title}`,
      targetEntityIds: [],
      targetLocationEntityId: actor?.locationEntityId,
      chapterId: checkpointEvent.sourceChapterId,
      legal: Boolean(actor && evidence.length),
      score: 0,
      ruleReasons: ["risk-avoidance", "counterfactual-alternative"],
      blockedReasons: actor && evidence.length ? [] : ["actor-or-evidence-missing"],
      evidence
    }
  ];
  return scoreNovelActionCandidates([sourceCandidate, ...alternatives], snapshot, seed);
}

function stepThemes(project: NovelWorldProject, chapterId?: string) {
  return project.chapters.flatMap((chapter) => chapter.themeSignals || []).filter((signal) => !chapterId || signal.chapterId === chapterId).map((signal) => signal.id);
}

function stepClaims(project: NovelWorldProject, eventId: string, chapterId?: string) {
  return buildNovelCausalityReport(project, chapterId).claims
    .filter((claim) => claim.cause.id === eventId || claim.effect.id === eventId || claim.chapterIds.includes(chapterId || ""))
    .map((claim) => claim.id);
}

function applyCandidate(project: NovelWorldProject, snapshot: NovelSimulationSnapshot, event: NovelEvent, candidate: NovelSimulationActionCandidate, nextIndex: number) {
  const next = cloneSnapshot(snapshot, `simulation-snapshot-${slug(project.id)}-${nextIndex}`, nextIndex);
  next.chapterId = event.sourceChapterId;
  const participants = new Set(event.participantEntityIds);
  next.actorStates = next.actorStates.map((actor) => {
    if (!participants.has(actor.actorEntityId) && actor.actorEntityId !== candidate.actorEntityId) return actor;
    const facts = next.knowledgeFacts.filter((fact) => fact.sourceEventId === event.id && fact.actorEntityId === actor.actorEntityId).map((fact) => fact.id);
    return {
      ...actor,
      locationEntityId: candidate.targetLocationEntityId || actor.locationEntityId,
      relationshipPressure: clamp(actor.relationshipPressure + (candidate.action === "confront" ? 8 : candidate.action === "withdraw" ? -4 : 2), actor.relationshipPressure),
      bodyCapability: clamp(actor.bodyCapability - (candidate.action === "confront" ? 5 : candidate.action === "investigate" ? 2 : 0), actor.bodyCapability),
      knowledgeFactIds: unique([...actor.knowledgeFactIds, ...facts])
    };
  });
  next.activeThemeSignalIds = unique([...next.activeThemeSignalIds, ...stepThemes(project, event.sourceChapterId)]);
  next.activeCausalClaimIds = unique([...next.activeCausalClaimIds, ...stepClaims(project, event.id, event.sourceChapterId)]);
  return next;
}

export function compareNovelReplayToSource(project: NovelWorldProject, run: Pick<NovelSimulationRun, "checkpointEventIds" | "steps">): NovelReplayComparisonReport {
  const checkpoints = run.checkpointEventIds.map((id) => project.mergedGraph.events.find((event) => event.id === id)).filter((event): event is NovelEvent => Boolean(event));
  const sourceSteps = run.steps.filter((step) => step.sourceEventId && step.provenance === "source");
  const matchedIds = sourceSteps.map((step) => step.sourceEventId as string);
  const matchedOrders = matchedIds.map((id) => run.checkpointEventIds.indexOf(id));
  const orderConsistent = matchedOrders.every((order, index) => index === 0 || order >= matchedOrders[index - 1]);
  const participantMatches = sourceSteps.filter((step) => {
    const event = project.mergedGraph.events.find((item) => item.id === step.sourceEventId);
    return event && event.participantEntityIds.every((id) => step.relatedEntityIds.includes(id));
  }).length;
  const locationMatches = sourceSteps.filter((step) => {
    const event = project.mergedGraph.events.find((item) => item.id === step.sourceEventId);
    if (!event?.locationEntityId) return true;
    return step.afterSnapshot.actorStates.some((actor) => event.participantEntityIds.includes(actor.actorEntityId) && actor.locationEntityId === event.locationEntityId);
  }).length;
  const causalMatches = sourceSteps.filter((step) => step.relatedCausalClaimIds.length > 0).length;
  const denominator = Math.max(sourceSteps.length, 1);
  const report: NovelReplayComparisonReport = {
    checkpointCount: checkpoints.length,
    completedCheckpointCount: matchedIds.length,
    eventMatchRate: checkpoints.length ? matchedIds.length / checkpoints.length : 0,
    orderConsistencyRate: sourceSteps.length ? (orderConsistent ? 1 : 0) : 0,
    participantMatchRate: sourceSteps.length ? participantMatches / denominator : 0,
    locationMatchRate: sourceSteps.length ? locationMatches / denominator : 0,
    causalCoverageRate: sourceSteps.length ? causalMatches / denominator : 0,
    fidelityScore: 0,
    missingPrerequisites: run.steps.filter((step) => step.provenance === "gap").map((step) => step.gapReason || step.title),
    lowEvidenceStepIds: run.steps.filter((step) => step.evidence.length === 0 || Math.max(0, ...step.evidence.map((item) => item.source.confidence)) < 0.55).map((step) => step.id),
    divergenceReasons: run.steps.filter((step) => step.provenance === "counterfactual").map((step) => `${step.title}: observer intervention changed the selected action.`)
  };
  report.fidelityScore = Math.round(100 * (
    report.eventMatchRate * 0.35
    + report.orderConsistencyRate * 0.2
    + report.participantMatchRate * 0.15
    + report.locationMatchRate * 0.15
    + report.causalCoverageRate * 0.15
  ));
  return report;
}

export function createNovelSimulationRun(
  project: NovelWorldProject,
  options: { seed?: string; mode?: NovelSimulationMode; throughChapterId?: string; branchStepLimit?: number } = {}
): NovelSimulationRun {
  const seed = options.seed?.trim() || `${project.id}:grounded-replay`;
  const initialSnapshot = compileNovelSimulationState(project, options.throughChapterId);
  const checkpointEventIds = checkpointEvents(project, options.throughChapterId).map((event) => event.id);
  const now = new Date().toISOString();
  const run: NovelSimulationRun = {
    version: 1,
    id: `simulation-run-${slug(project.id)}-${hash(seed).toString(36)}`,
    projectId: project.id,
    seed,
    mode: options.mode || "grounded-replay",
    status: checkpointEventIds.length ? "ready" : "blocked",
    throughChapterId: options.throughChapterId,
    checkpointEventIds,
    currentStepIndex: 0,
    initialSnapshot,
    currentSnapshot: initialSnapshot,
    steps: [],
    interventions: [],
    branchStepLimit: Math.max(1, Math.min(12, options.branchStepLimit || 1)),
    comparison: {
      checkpointCount: checkpointEventIds.length,
      completedCheckpointCount: 0,
      eventMatchRate: 0,
      orderConsistencyRate: 0,
      participantMatchRate: 0,
      locationMatchRate: 0,
      causalCoverageRate: 0,
      fidelityScore: 0,
      missingPrerequisites: [],
      lowEvidenceStepIds: [],
      divergenceReasons: []
    },
    warnings: checkpointEventIds.length ? [] : ["No evidenced source events are available for replay."],
    createdAt: now,
    updatedAt: now
  };
  return { ...run, comparison: compareNovelReplayToSource(project, run) };
}

export function advanceNovelSimulation(project: NovelWorldProject, run: NovelSimulationRun): NovelSimulationRun {
  if (run.status === "complete" || run.status === "blocked") return run;
  const branchStart = run.interventions[0]?.appliedAtStepIndex;
  if (run.mode === "short-branch" && branchStart !== undefined && run.steps.length - branchStart >= run.branchStepLimit) {
    return { ...run, status: "complete", updatedAt: new Date().toISOString() };
  }
  const eventId = run.checkpointEventIds[run.currentStepIndex];
  const event = project.mergedGraph.events.find((item) => item.id === eventId);
  if (!event) return { ...run, status: "blocked", warnings: unique([...run.warnings, `Missing checkpoint event ${eventId}.`]), updatedAt: new Date().toISOString() };
  const candidates = generateNovelActionCandidates(project, run.currentSnapshot, event, run.seed);
  const legal = candidates.filter((candidate) => candidate.legal);
  const sourceCandidate = legal.find((candidate) => candidate.sourceEventId === event.id);
  const interventionActive = run.mode === "short-branch" && run.interventions.length > 0;
  const selected = interventionActive ? legal.find((candidate) => !candidate.sourceEventId) || sourceCandidate : sourceCandidate || legal[0];
  const nextIndex = run.currentStepIndex + 1;
  if (!selected || !selected.evidence.length) {
    const gapSnapshot = cloneSnapshot(run.currentSnapshot, `simulation-snapshot-${slug(project.id)}-${nextIndex}`, nextIndex);
    const gapStep: NovelSimulationStep = {
      id: `simulation-step-${slug(event.id)}-${nextIndex}`,
      index: nextIndex,
      chapterId: event.sourceChapterId,
      sourceEventId: event.id,
      title: `Evidence gap: ${event.title}`,
      summary: "Replay stopped because no legal, paragraph-grounded action could be selected.",
      provenance: "gap",
      beforeSnapshot: run.currentSnapshot,
      afterSnapshot: gapSnapshot,
      candidates,
      triggeredRuleIds: ["evidence-required", "legal-action-required"],
      relatedEntityIds: event.participantEntityIds,
      relatedThemeSignalIds: stepThemes(project, event.sourceChapterId),
      relatedCausalClaimIds: stepClaims(project, event.id, event.sourceChapterId),
      evidence: [],
      gapReason: selected ? "Selected action has no paragraph evidence." : "No legal action candidate satisfies the replay rules."
    };
    const blocked = { ...run, status: "blocked" as const, currentStepIndex: nextIndex, currentSnapshot: gapSnapshot, steps: [...run.steps, gapStep], updatedAt: new Date().toISOString() };
    return { ...blocked, comparison: compareNovelReplayToSource(project, blocked) };
  }
  const afterSnapshot = applyCandidate(project, run.currentSnapshot, event, selected, nextIndex);
  const provenance = interventionActive && !selected.sourceEventId ? "counterfactual" as const : "source" as const;
  const step: NovelSimulationStep = {
    id: `simulation-step-${slug(event.id)}-${nextIndex}`,
    index: nextIndex,
    chapterId: event.sourceChapterId,
    sourceEventId: provenance === "source" ? event.id : undefined,
    title: selected.label,
    summary: provenance === "source"
      ? `Evidence-guided replay matched the source checkpoint: ${event.summary}`
      : `Counterfactual branch selected ${selected.action} instead of source checkpoint "${event.title}".`,
    provenance,
    beforeSnapshot: run.currentSnapshot,
    afterSnapshot,
    candidates,
    selectedCandidateId: selected.id,
    triggeredRuleIds: selected.ruleReasons,
    relatedEntityIds: unique([selected.actorEntityId, ...event.participantEntityIds, ...selected.targetEntityIds]),
    relatedThemeSignalIds: afterSnapshot.activeThemeSignalIds.filter((id) => !run.currentSnapshot.activeThemeSignalIds.includes(id)),
    relatedCausalClaimIds: afterSnapshot.activeCausalClaimIds.filter((id) => !run.currentSnapshot.activeCausalClaimIds.includes(id)),
    evidence: selected.evidence
  };
  const complete = nextIndex >= run.checkpointEventIds.length
    || (run.mode === "short-branch" && run.interventions.length > 0 && run.steps.length + 1 - run.interventions[0].appliedAtStepIndex >= run.branchStepLimit);
  const nextRun: NovelSimulationRun = {
    ...run,
    status: complete ? "complete" : "paused",
    currentStepIndex: nextIndex,
    currentSnapshot: afterSnapshot,
    steps: [...run.steps, step],
    updatedAt: new Date().toISOString()
  };
  return { ...nextRun, comparison: compareNovelReplayToSource(project, nextRun) };
}

export function rewindNovelSimulation(project: NovelWorldProject, run: NovelSimulationRun): NovelSimulationRun {
  const steps = run.steps.slice(0, -1);
  const currentSnapshot = steps[steps.length - 1]?.afterSnapshot || run.initialSnapshot;
  const nextRun = { ...run, steps, currentStepIndex: steps.length, currentSnapshot, status: steps.length ? "paused" as const : "ready" as const, updatedAt: new Date().toISOString() };
  return { ...nextRun, comparison: compareNovelReplayToSource(project, nextRun) };
}

export function applyNovelSimulationIntervention(
  project: NovelWorldProject,
  run: NovelSimulationRun,
  intervention: Omit<NovelSimulationIntervention, "id" | "appliedAtStepIndex" | "summary">
): NovelSimulationRun {
  if (run.interventions.length) return { ...run, warnings: unique([...run.warnings, "Only one intervention is allowed per short branch."]) };
  const actor = run.currentSnapshot.actorStates.find((item) => item.actorEntityId === intervention.actorEntityId);
  if (!actor) return { ...run, warnings: unique([...run.warnings, `Unknown intervention actor ${intervention.actorEntityId}.`]) };
  const snapshot = cloneSnapshot(run.currentSnapshot, `${run.currentSnapshot.id}-branch`, run.currentStepIndex);
  snapshot.actorStates = snapshot.actorStates.map((item) => {
    if (item.actorEntityId !== intervention.actorEntityId) return item;
    if (intervention.kind === "location") return { ...item, locationEntityId: String(intervention.value) };
    if (intervention.kind === "relationship-pressure") return { ...item, relationshipPressure: clamp(intervention.value, item.relationshipPressure) };
    if (intervention.kind === "resource") return { ...item, resources: intervention.value ? unique([...item.resources, String(intervention.value)]) : item.resources };
    if (intervention.kind === "body-capability") return { ...item, bodyCapability: clamp(intervention.value, item.bodyCapability) };
    if (intervention.kind === "knowledge" && !Boolean(intervention.value)) return { ...item, knowledgeFactIds: [] };
    return item;
  });
  const applied: NovelSimulationIntervention = {
    ...intervention,
    id: `simulation-intervention-${slug(intervention.actorEntityId)}-${run.currentStepIndex}`,
    appliedAtStepIndex: run.currentStepIndex,
    summary: `${intervention.kind} changed for ${actor.name} before step ${run.currentStepIndex + 1}.`
  };
  const nextRun: NovelSimulationRun = {
    ...run,
    mode: "short-branch",
    status: "paused",
    currentSnapshot: snapshot,
    interventions: [applied],
    updatedAt: new Date().toISOString()
  };
  return { ...nextRun, comparison: compareNovelReplayToSource(project, nextRun) };
}

export function validateNovelSimulationRun(run: NovelSimulationRun, project: NovelWorldProject, chapters: NovelLongChapterText[] = []): NovelWorldValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [...run.warnings];
  const eventIds = new Set(project.mergedGraph.events.map((event) => event.id));
  const entityIds = new Set(project.mergedGraph.entities.map((entity) => entity.id));
  const paragraphIds = new Set(chapters.flatMap((chapter) => chapter.paragraphs.map((paragraph) => `${chapter.chapterId}:${paragraph.id}`)));
  if (run.version !== 1) errors.push("simulation run version must be 1.");
  if (run.projectId !== project.id) errors.push("simulation run projectId does not match project.");
  if (run.currentStepIndex !== run.steps.length) errors.push("simulation currentStepIndex must equal completed step count.");
  if (run.mode === "short-branch" && run.interventions.length > 1) errors.push("short branch supports at most one intervention.");
  if (run.mode === "short-branch" && run.interventions.length && run.steps.length - run.interventions[0].appliedAtStepIndex > run.branchStepLimit) errors.push("short branch exceeded branchStepLimit.");
  for (const eventId of run.checkpointEventIds) if (!eventIds.has(eventId)) errors.push(`simulation references unknown checkpoint event ${eventId}.`);
  for (const actor of run.currentSnapshot.actorStates) if (!entityIds.has(actor.actorEntityId)) errors.push(`simulation references unknown actor ${actor.actorEntityId}.`);
  for (const step of run.steps) {
    if (step.sourceEventId && !eventIds.has(step.sourceEventId)) errors.push(`simulation step ${step.id} references unknown source event ${step.sourceEventId}.`);
    if (step.provenance === "source" && !step.sourceEventId) errors.push(`source simulation step ${step.id} must reference a source event.`);
    if (step.provenance === "counterfactual" && step.sourceEventId) errors.push(`counterfactual simulation step ${step.id} cannot be stored as a source event.`);
    if (step.provenance !== "gap" && !step.evidence.length) errors.push(`simulation step ${step.id} has no paragraph evidence.`);
    for (const snippet of step.evidence) {
      if (snippet.source.quote.length > novelEvidenceQuoteLimit) errors.push(`simulation step ${step.id} quote exceeds ${novelEvidenceQuoteLimit} characters.`);
      if (chapters.length && !paragraphIds.has(`${snippet.source.chapterId}:${snippet.source.paragraphId}`)) errors.push(`simulation step ${step.id} references unknown paragraph ${snippet.source.chapterId}/${snippet.source.paragraphId}.`);
    }
  }
  if (!run.checkpointEventIds.length) warnings.push("simulation has no source checkpoints.");
  return { valid: errors.length === 0, errors, warnings: unique(warnings) };
}

export function createFallbackNovelSimulationExplanation(step: NovelSimulationStep): NovelSimulationExplanation {
  const selected = step.candidates.find((candidate) => candidate.id === step.selectedCandidateId);
  return {
    id: `simulation-explanation-${slug(step.id)}`,
    stepId: step.id,
    explanation: selected
      ? `${selected.label} was selected because ${selected.ruleReasons.join(", ")}. The decision is ${step.provenance} and remains bounded by the cited paragraph evidence.`
      : step.gapReason || "No legal evidence-grounded action was available.",
    uncertainty: selected?.evidence.length ? Math.max(0, 1 - Math.max(...selected.evidence.map((item) => item.source.confidence))) : 1,
    evidenceIds: selected?.evidence.map((item) => item.id) || [],
    warnings: step.provenance === "counterfactual" ? ["This explanation describes an alternate branch, not a source fact."] : []
  };
}

export function validateNovelSimulationExplanation(explanation: NovelSimulationExplanation, step: NovelSimulationStep): NovelWorldValidationReport {
  const errors: string[] = [];
  const evidenceIds = new Set(step.evidence.map((item) => item.id));
  if (explanation.stepId !== step.id) errors.push("simulation explanation stepId does not match the supplied step.");
  if (!explanation.explanation.trim()) errors.push("simulation explanation text is required.");
  for (const id of explanation.evidenceIds) if (!evidenceIds.has(id)) errors.push(`simulation explanation references unknown evidence ${id}.`);
  if (step.provenance !== "gap" && !explanation.evidenceIds.length) errors.push("simulation explanation must cite evidence.");
  return { valid: errors.length === 0, errors, warnings: explanation.warnings };
}
