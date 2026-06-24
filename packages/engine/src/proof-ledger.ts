import { deriveSuspectMatrix } from "./validators";
import type {
  CaseProofCoverage,
  CaseProofGap,
  CaseProofObligation,
  CaseProofObligationKind,
  CaseTruthLedger,
  DeductionCase
} from "./types";
import type { CaseFromLog, PlayerSession, WorldEvent } from "./world-types";

type CoverageInput = {
  discoveredEvidenceIds?: string[];
  selectedEvidenceIds?: string[];
  challengedCharacterIds?: string[];
  solved?: boolean;
};

const stageEvidence: Record<"motive" | "means" | "opportunity", string[]> = {
  motive: ["ev-motive"],
  means: ["ev-means", "ev-trace"],
  opportunity: ["ev-opportunity"]
};

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function targetForKind(kind: CaseProofObligationKind): CaseProofGap["target"] {
  if (kind === "motive") return "motive";
  if (kind === "means" || kind === "opportunity" || kind === "timeline" || kind === "contradiction") return "method";
  if (kind === "exclusion") return "exclusion";
  if (kind === "source") return "evidence";
  return "logic";
}

function stageLabel(kind: CaseProofObligationKind) {
  const labels: Record<CaseProofObligationKind, string> = {
    motive: "Motive proof",
    means: "Means proof",
    opportunity: "Opportunity proof",
    timeline: "Timeline proof",
    contradiction: "Testimony contradiction",
    exclusion: "Suspect exclusion",
    source: "Source backing",
    conclusion: "Final conclusion"
  };
  return labels[kind];
}

function stageDetail(kind: CaseProofObligationKind) {
  const details: Record<CaseProofObligationKind, string> = {
    motive: "Find and select evidence that proves why the culprit acted.",
    means: "Find and select evidence that proves the method or tool.",
    opportunity: "Find and select evidence that places action in the crime window.",
    timeline: "Use evidence that resolves the public timeline against the true sequence.",
    contradiction: "Challenge a witness with discovered contradiction evidence.",
    exclusion: "Use evidence that removes a non-culprit from the suspect set.",
    source: "Every key clue must be backed by a world event or memory source.",
    conclusion: "The final answer must connect decisive clues and exclusions."
  };
  return details[kind];
}

function evidenceSourceEventIds(caseFromLog: CaseFromLog, events: WorldEvent[], evidenceId: string) {
  return unique([
    ...(caseFromLog.sourceMap?.evidenceSourceEventIds?.[evidenceId] || []),
    ...events.filter((event) => event.evidenceId === evidenceId).map((event) => event.id)
  ]);
}

function evidenceMemoryIds(caseFromLog: CaseFromLog, evidenceId: string) {
  return unique(caseFromLog.testimonies.filter((item) => item.contradictionEvidenceIds.includes(evidenceId)).flatMap((item) => item.memoryIds));
}

function discoverableEvidenceIds(caseFromLog: CaseFromLog, evidenceIds: string[]) {
  const discoverable = new Set(caseFromLog.deductionCase.evidence.filter((item) => item.discoverable).map((item) => item.id));
  return unique(evidenceIds).filter((id) => discoverable.has(id));
}

function obligation(input: Omit<CaseProofObligation, "lowSpoilerLabel" | "lowSpoilerDetail" | "required"> & { required?: boolean }): CaseProofObligation {
  return {
    ...input,
    required: input.required ?? true,
    characterIds: unique(input.characterIds),
    evidenceIds: unique(input.evidenceIds),
    eventIds: unique(input.eventIds),
    memoryIds: unique(input.memoryIds),
    lowSpoilerLabel: stageLabel(input.kind),
    lowSpoilerDetail: stageDetail(input.kind)
  };
}

function structuralGap(caseId: string, item: CaseProofObligation, discoverableIds: Set<string>): CaseProofGap | null {
  const missingEvidenceIds = item.evidenceIds.filter((id) => !discoverableIds.has(id));
  const hasSource = item.eventIds.length > 0 || item.memoryIds.length > 0;
  if (item.evidenceIds.length && missingEvidenceIds.length === 0 && hasSource) return null;
  if (item.kind === "conclusion" && item.evidenceIds.length && missingEvidenceIds.length === 0) return null;
  return {
    obligationId: item.id,
    kind: item.kind,
    label: `${stageLabel(item.kind)} gap`,
    detail: `${caseId} has an unbacked ${item.kind} obligation. It needs discoverable evidence and source event or memory backing before it is playable.`,
    missingEvidenceIds: item.evidenceIds.length ? missingEvidenceIds : [`missing-${item.kind}-evidence`],
    missingEventIds: hasSource ? [] : [`missing-${item.kind}-source`],
    missingMemoryIds: [],
    target: targetForKind(item.kind)
  };
}

function stageEvidenceIds(caseFromLog: CaseFromLog, events: WorldEvent[], stage: "motive" | "means" | "opportunity") {
  const stageEvents = new Set(caseFromLog.sourceMap?.chainStageSourceEventIds?.[stage] || []);
  const mapped = caseFromLog.deductionCase.evidence
    .filter((item) => evidenceSourceEventIds(caseFromLog, events, item.id).some((id) => stageEvents.has(id)))
    .map((item) => item.id);
  const fromProfile = stageEvidence[stage].filter((id) => caseFromLog.deductionCase.evidence.some((item) => item.id === id));
  const fromReasoning = caseFromLog.deductionCase.logicPuzzle.criticalReasoningChain
    .filter((step) => step.id.includes(stage) || step.conclusion.toLowerCase().includes(stage))
    .flatMap((step) => step.evidenceIds);
  return discoverableEvidenceIds(caseFromLog, [...mapped, ...fromProfile, ...fromReasoning]);
}

export function buildCaseTruthLedger(caseFromLog: CaseFromLog, events: WorldEvent[] = []): CaseTruthLedger {
  const obligations: CaseProofObligation[] = [];
  const caseId = caseFromLog.id;
  const culpritId = caseFromLog.deductionCase.truth.culpritId;
  const sourceEventIds = unique([...(caseFromLog.sourceEventIds || []), ...(caseFromLog.sourceMap?.sourceEventIds || [])]);

  for (const stage of ["motive", "means", "opportunity"] as const) {
    const evidenceIds = stageEvidenceIds(caseFromLog, events, stage);
    obligations.push(obligation({
      id: `${caseId}:${stage}`,
      kind: stage,
      label: `${stageLabel(stage)} for the true culprit`,
      detail: `${stageLabel(stage)} must be backed by discoverable evidence and the source event chain.`,
      characterIds: [culpritId],
      evidenceIds,
      eventIds: unique(evidenceIds.flatMap((id) => evidenceSourceEventIds(caseFromLog, events, id))),
      memoryIds: unique(evidenceIds.flatMap((id) => evidenceMemoryIds(caseFromLog, id))),
      source: "reasoning"
    }));
  }

  for (const item of caseFromLog.deductionCase.truth.trueTimeline.filter((event) => event.contradictedByEvidenceIds.length)) {
    const evidenceIds = discoverableEvidenceIds(caseFromLog, item.contradictedByEvidenceIds);
    obligations.push(obligation({
      id: `${caseId}:timeline:${item.id}`,
      kind: "timeline",
      label: `Timeline contradiction ${item.time}`,
      detail: item.event,
      characterIds: item.characterIds,
      evidenceIds,
      eventIds: unique([item.id, ...evidenceIds.flatMap((id) => evidenceSourceEventIds(caseFromLog, events, id))]),
      memoryIds: unique(evidenceIds.flatMap((id) => evidenceMemoryIds(caseFromLog, id))),
      source: "truth"
    }));
  }

  for (const testimony of caseFromLog.testimonies.filter((item) => item.contradictionEvidenceIds.length)) {
    const evidenceIds = discoverableEvidenceIds(caseFromLog, testimony.contradictionEvidenceIds);
    obligations.push(obligation({
      id: `${caseId}:contradiction:${testimony.characterId}`,
      kind: "contradiction",
      label: `Challenge testimony from ${testimony.characterId}`,
      detail: testimony.currentStatement,
      characterIds: [testimony.characterId],
      evidenceIds,
      eventIds: unique(evidenceIds.flatMap((id) => evidenceSourceEventIds(caseFromLog, events, id))),
      memoryIds: unique(testimony.memoryIds),
      source: "testimony"
    }));
  }

  for (const chain of caseFromLog.deductionCase.logicPuzzle.exclusionChains) {
    const evidenceIds = discoverableEvidenceIds(caseFromLog, chain.evidenceIds);
    obligations.push(obligation({
      id: `${caseId}:exclusion:${chain.characterId}`,
      kind: "exclusion",
      label: `Exclude ${chain.characterId}`,
      detail: chain.reason,
      characterIds: [chain.characterId],
      evidenceIds,
      eventIds: unique(evidenceIds.flatMap((id) => evidenceSourceEventIds(caseFromLog, events, id))),
      memoryIds: unique(evidenceIds.flatMap((id) => evidenceMemoryIds(caseFromLog, id))),
      source: "exclusion"
    }));
  }

  for (const evidenceId of caseFromLog.deductionCase.truth.decisiveEvidenceIds) {
    const eventIds = evidenceSourceEventIds(caseFromLog, events, evidenceId);
    obligations.push(obligation({
      id: `${caseId}:source:${evidenceId}`,
      kind: "source",
      label: `Source-backed clue ${evidenceId}`,
      detail: "A decisive clue must come from a recorded event or memory, not from a bare conclusion.",
      characterIds: [],
      evidenceIds: discoverableEvidenceIds(caseFromLog, [evidenceId]),
      eventIds,
      memoryIds: evidenceMemoryIds(caseFromLog, evidenceId),
      source: "sourceMap"
    }));
  }

  const matrix = deriveSuspectMatrix(caseFromLog.deductionCase);
  const nonCulpritExclusionEvidence = unique(matrix.filter((row) => !row.isCulprit).flatMap((row) => row.excludedByEvidenceIds));
  const conclusionEvidenceIds = discoverableEvidenceIds(caseFromLog, [...caseFromLog.deductionCase.truth.decisiveEvidenceIds, ...nonCulpritExclusionEvidence]);
  obligations.push(obligation({
    id: `${caseId}:conclusion`,
    kind: "conclusion",
    label: "Unique hard-logic conclusion",
    detail: "The final culprit, method, and exclusions must be supported by selected evidence.",
    characterIds: [culpritId],
    evidenceIds: conclusionEvidenceIds,
    eventIds: unique([...sourceEventIds, ...conclusionEvidenceIds.flatMap((id) => evidenceSourceEventIds(caseFromLog, events, id))]),
    memoryIds: unique(conclusionEvidenceIds.flatMap((id) => evidenceMemoryIds(caseFromLog, id))),
    source: "truth"
  }));

  const discoverable = new Set(caseFromLog.deductionCase.evidence.filter((item) => item.discoverable).map((item) => item.id));
  const gaps = obligations.map((item) => structuralGap(caseId, item, discoverable)).filter((item): item is CaseProofGap => Boolean(item));
  return {
    caseId,
    valid: gaps.length === 0,
    obligations,
    gaps,
    sourceEventCount: sourceEventIds.length,
    discoverableEvidenceCount: discoverable.size,
    requiredEvidenceIds: unique(obligations.filter((item) => item.required).flatMap((item) => item.evidenceIds))
  };
}

export function buildDeductionCaseTruthLedger(deductionCase: DeductionCase): CaseTruthLedger {
  const minimalCase: CaseFromLog = {
    id: deductionCase.id,
    worldId: deductionCase.id,
    sourceEventIds: [],
    deathEventId: deductionCase.truth.trueTimeline[0]?.id || "",
    generationProfile: {
      seed: deductionCase.id,
      archetype: "blade",
      victimId: "",
      culpritId: deductionCase.truth.culpritId,
      witnessId: "",
      focusSuspectIds: [],
      sceneLocationId: deductionCase.scenes[0]?.id || "",
      prepLocationId: deductionCase.scenes[0]?.id || "",
      motiveEventId: "",
      meansEventId: "",
      opportunityEventId: "",
      deathEventId: deductionCase.truth.trueTimeline[0]?.id || "",
      stagingEventId: "",
      traceEventId: "",
      groupAlibiEventId: "",
      decisiveEvidenceIds: deductionCase.truth.decisiveEvidenceIds
    },
    sourceMap: {
      motiveEvidenceId: "ev-motive",
      meansEvidenceId: "ev-means",
      opportunityEvidenceId: "ev-opportunity",
      stagingEvidenceId: "ev-staging",
      traceEvidenceId: "ev-trace",
      groupAlibiEvidenceId: "ev-town-rollcall",
      sourceEventIds: []
    },
    testimonies: [],
    qualityReport: {} as CaseFromLog["qualityReport"],
    deductionCase,
    validation: {} as CaseFromLog["validation"],
    createdAt: new Date(0).toISOString()
  };
  return buildCaseTruthLedger(minimalCase, []);
}

export function evaluateCaseProofCoverage(ledger: CaseTruthLedger, input: CoverageInput = {}): CaseProofCoverage {
  const discovered = new Set(input.discoveredEvidenceIds || []);
  const selected = input.selectedEvidenceIds ? new Set(input.selectedEvidenceIds) : null;
  const challenged = new Set(input.challengedCharacterIds || []);
  const coveredObligationIds: string[] = [];
  const gaps: CaseProofGap[] = [];

  for (const item of ledger.obligations.filter((obligationItem) => obligationItem.required)) {
    const evidenceSet = selected || discovered;
    const evidenceCovered = item.evidenceIds.length > 0 && item.evidenceIds.every((id) => discovered.has(id) && evidenceSet.has(id));
    const challengeCovered = item.kind === "contradiction" && item.characterIds.some((id) => challenged.has(id));
    const solvedCovered = Boolean(input.solved);
    if (evidenceCovered || challengeCovered || solvedCovered) {
      coveredObligationIds.push(item.id);
      continue;
    }
    const missingEvidenceIds = item.evidenceIds.filter((id) => !discovered.has(id) || (selected && !selected.has(id)));
    gaps.push({
      obligationId: item.id,
      kind: item.kind,
      label: `${stageLabel(item.kind)} missing`,
      detail: item.lowSpoilerDetail,
      missingEvidenceIds: missingEvidenceIds.length ? missingEvidenceIds : item.evidenceIds,
      missingEventIds: [],
      missingMemoryIds: [],
      target: targetForKind(item.kind)
    });
  }

  const totalRequired = ledger.obligations.filter((item) => item.required).length;
  const missingObligationIds = gaps.map((item) => item.obligationId);
  return {
    caseId: ledger.caseId,
    totalRequired,
    coveredRequired: coveredObligationIds.length,
    coverageRatio: totalRequired ? coveredObligationIds.length / totalRequired : 1,
    complete: totalRequired > 0 && missingObligationIds.length === 0,
    coveredObligationIds,
    missingObligationIds,
    gaps
  };
}

export function evaluateSessionProofCoverage(caseFromLog: CaseFromLog, events: WorldEvent[] = [], session?: PlayerSession | null): CaseProofCoverage {
  const ledger = buildCaseTruthLedger(caseFromLog, events);
  return evaluateCaseProofCoverage(ledger, {
    discoveredEvidenceIds: session?.discoveredEvidenceIds || [],
    selectedEvidenceIds: session?.submittedTheory?.evidenceIds,
    challengedCharacterIds: session?.interrogationLog.filter((entry) => entry.challenge?.hit).map((entry) => entry.characterId) || [],
    solved: Boolean(session?.judgement?.accepted)
  });
}

export function spoilerSafeCaseTruthLedger(ledger: CaseTruthLedger, solved: boolean): CaseTruthLedger {
  if (solved) return ledger;
  return {
    ...ledger,
    obligations: ledger.obligations.map((item, index) => ({
      ...item,
      id: `obligation:${item.kind}:${index + 1}`,
      label: item.lowSpoilerLabel,
      detail: item.lowSpoilerDetail,
      characterIds: [],
      evidenceIds: [],
      eventIds: [],
      memoryIds: []
    })),
    gaps: ledger.gaps.map((gap, index) => ({
      ...gap,
      obligationId: `proof-gap:${gap.kind}:${index + 1}`,
      detail: "A required proof obligation needs discoverable evidence and source backing before the full chain can be revealed.",
      missingEvidenceIds: [],
      missingEventIds: [],
      missingMemoryIds: []
    })),
    requiredEvidenceIds: []
  };
}

export function spoilerSafeCaseProofCoverage(coverage: CaseProofCoverage, solved: boolean): CaseProofCoverage {
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
