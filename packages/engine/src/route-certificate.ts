import { judgeTheory } from "./judgement";
import { buildCaseTruthLedger, evaluateCaseProofCoverage } from "./proof-ledger";
import type {
  CaseProofGap,
  CaseProofObligation,
  CaseRouteCertificate,
  CaseRouteCertificateBlocker,
  CaseRouteCertificateStep,
  PlayerTheory
} from "./types";
import type { CaseFromLog, PlayerSession, TestimonyRecord, WorldEvent } from "./world-types";

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function evidenceSourceEventIds(caseFromLog: CaseFromLog, events: WorldEvent[], evidenceId: string) {
  return unique([
    ...(caseFromLog.sourceMap?.evidenceSourceEventIds?.[evidenceId] || []),
    ...events.filter((event) => event.evidenceId === evidenceId).map((event) => event.id)
  ]);
}

function obligationIdsForEvidence(obligations: CaseProofObligation[], evidenceId: string) {
  return obligations.filter((item) => item.evidenceIds.includes(evidenceId)).map((item) => item.id);
}

function eventsForEvidence(obligations: CaseProofObligation[], caseFromLog: CaseFromLog, events: WorldEvent[], evidenceId: string) {
  return unique([
    ...evidenceSourceEventIds(caseFromLog, events, evidenceId),
    ...obligations.filter((item) => item.evidenceIds.includes(evidenceId)).flatMap((item) => item.eventIds)
  ]);
}

function memoriesForEvidence(obligations: CaseProofObligation[], evidenceId: string) {
  return unique(obligations.filter((item) => item.evidenceIds.includes(evidenceId)).flatMap((item) => item.memoryIds));
}

function blocker(input: CaseRouteCertificateBlocker): CaseRouteCertificateBlocker {
  return {
    ...input,
    missingEvidenceIds: unique(input.missingEvidenceIds),
    missingObligationIds: unique(input.missingObligationIds)
  };
}

function blockerFromGap(gap: CaseProofGap): CaseRouteCertificateBlocker {
  const kind = gap.kind === "source" ? "source" : gap.kind === "exclusion" ? "exclusion" : gap.kind === "contradiction" ? "challenge" : "submit";
  return blocker({
    kind,
    label: gap.label,
    detail: gap.detail,
    missingEvidenceIds: gap.missingEvidenceIds,
    missingObligationIds: [gap.obligationId],
    target: gap.target
  });
}

function testimonyForEvidence(testimonies: TestimonyRecord[], evidenceId: string) {
  return testimonies.find((item) => item.contradictionEvidenceIds.includes(evidenceId));
}

function makeStep(input: CaseRouteCertificateStep): CaseRouteCertificateStep {
  return {
    ...input,
    obligationIds: unique(input.obligationIds),
    evidenceIds: unique(input.evidenceIds),
    eventIds: unique(input.eventIds),
    memoryIds: unique(input.memoryIds),
    characterIds: unique(input.characterIds)
  };
}

export function certifyPlayableCase(caseFromLog: CaseFromLog, events: WorldEvent[] = [], session?: PlayerSession | null): CaseRouteCertificate {
  const sourceMode: CaseRouteCertificate["sourceMode"] = caseFromLog.sourceCandidateId || caseFromLog.sourceMap?.sourceCandidateId ? "emerged" : "static";
  const ledger = buildCaseTruthLedger(caseFromLog, events);
  const evidenceById = new Map(caseFromLog.deductionCase.evidence.map((item) => [item.id, item]));
  const discoverableIds = new Set(caseFromLog.deductionCase.evidence.filter((item) => item.discoverable).map((item) => item.id));
  const requiredEvidenceIds = unique(ledger.requiredEvidenceIds);
  const missingDiscoverableEvidenceIds = requiredEvidenceIds.filter((id) => !discoverableIds.has(id));
  const contradictionObligations = ledger.obligations.filter((item) => item.kind === "contradiction");
  const exclusionObligations = ledger.obligations.filter((item) => item.kind === "exclusion");
  const sourceGaps = ledger.gaps.filter((item) => item.kind === "source" || item.missingEventIds.length > 0 || item.missingMemoryIds.length > 0);
  const challengePairs = contradictionObligations
    .map((obligation) => {
      const evidenceId = obligation.evidenceIds.find((id) => discoverableIds.has(id));
      const testimony = evidenceId ? testimonyForEvidence(caseFromLog.testimonies, evidenceId) : undefined;
      return evidenceId && testimony ? { obligation, testimony, evidenceId } : null;
    })
    .filter((item): item is { obligation: CaseProofObligation; testimony: TestimonyRecord; evidenceId: string } => Boolean(item));
  const requiredWitnessIds = unique(challengePairs.map((item) => item.testimony.characterId));
  const challengeEvidenceIds = unique(challengePairs.map((item) => item.evidenceId));
  const theoryEvidenceIds = requiredEvidenceIds.filter((id) => discoverableIds.has(id));
  const challengedCharacterIds = session?.interrogationLog.filter((entry) => entry.challenge?.hit).map((entry) => entry.characterId) || requiredWitnessIds;
  const coverage = evaluateCaseProofCoverage(ledger, {
    discoveredEvidenceIds: theoryEvidenceIds,
    selectedEvidenceIds: theoryEvidenceIds,
    challengedCharacterIds,
    solved: Boolean(session?.judgement?.accepted)
  });
  const autoTheory: PlayerTheory = {
    culpritId: caseFromLog.deductionCase.truth.culpritId,
    motive: caseFromLog.deductionCase.truth.motive,
    method: caseFromLog.deductionCase.truth.method,
    evidenceIds: theoryEvidenceIds
  };
  const judgement = judgeTheory(caseFromLog.deductionCase, autoTheory, theoryEvidenceIds);
  const blockers: CaseRouteCertificateBlocker[] = [];

  if (!caseFromLog.deductionCase.evidence.some((item) => item.discoverable)) {
    blockers.push(blocker({
      kind: "search",
      label: "No searchable evidence route",
      detail: "The case needs at least one discoverable clue before it can become playable.",
      missingEvidenceIds: [],
      missingObligationIds: ledger.obligations.map((item) => item.id),
      target: "evidence"
    }));
  }
  if (missingDiscoverableEvidenceIds.length) {
    blockers.push(blocker({
      kind: "search",
      label: "Required evidence is not discoverable",
      detail: "A required proof obligation points to evidence that cannot be found by the player.",
      missingEvidenceIds: missingDiscoverableEvidenceIds,
      missingObligationIds: ledger.obligations.filter((item) => item.evidenceIds.some((id) => missingDiscoverableEvidenceIds.includes(id))).map((item) => item.id),
      target: "evidence"
    }));
  }
  if (!caseFromLog.testimonies.some((item) => item.characterId)) {
    blockers.push(blocker({
      kind: "witness",
      label: "No witness route",
      detail: "The case needs at least one witness testimony route.",
      missingEvidenceIds: [],
      missingObligationIds: contradictionObligations.map((item) => item.id),
      target: "suspects"
    }));
  }
  if (contradictionObligations.length === 0) {
    blockers.push(blocker({
      kind: "challenge",
      label: "No testimony contradiction route",
      detail: "The case needs at least one proof obligation that can be challenged with testimony evidence.",
      missingEvidenceIds: [],
      missingObligationIds: [],
      target: "method"
    }));
  } else if (challengePairs.length < contradictionObligations.length) {
    blockers.push(blocker({
      kind: "challenge",
      label: "No complete testimony challenge route",
      detail: "Every contradiction obligation needs a witness and discoverable challenge evidence.",
      missingEvidenceIds: contradictionObligations.flatMap((item) => item.evidenceIds).filter((id) => !challengeEvidenceIds.includes(id)),
      missingObligationIds: contradictionObligations.filter((item) => !challengePairs.some((pair) => pair.obligation.id === item.id)).map((item) => item.id),
      target: "method"
    }));
  }
  if (!exclusionObligations.some((item) => item.evidenceIds.some((id) => discoverableIds.has(id)))) {
    blockers.push(blocker({
      kind: "exclusion",
      label: "No suspect exclusion route",
      detail: "The case needs discoverable evidence that removes non-culprit suspects.",
      missingEvidenceIds: exclusionObligations.flatMap((item) => item.evidenceIds),
      missingObligationIds: exclusionObligations.map((item) => item.id),
      target: "exclusion"
    }));
  }
  if (sourceMode === "emerged" && sourceGaps.length) {
    blockers.push(...sourceGaps.map(blockerFromGap));
  }
  if (!coverage.complete || !judgement.accepted) {
    blockers.push(blocker({
      kind: "submit",
      label: "Auto theory is not accepted",
      detail: "The route cannot yet build an accepted theory from discoverable evidence and challenge hits.",
      missingEvidenceIds: unique(coverage.gaps.flatMap((item) => item.missingEvidenceIds)),
      missingObligationIds: coverage.missingObligationIds,
      target: "logic"
    }));
  }

  const searchSteps = theoryEvidenceIds.map((evidenceId, index) => {
    const evidence = evidenceById.get(evidenceId);
    return makeStep({
      id: `route:${caseFromLog.id}:search:${evidenceId}`,
      kind: "search",
      label: `Search for ${evidence?.title || evidenceId}`,
      detail: evidence?.visibleDescription || "Find the required clue.",
      lowSpoilerLabel: `Search route clue ${index + 1}`,
      lowSpoilerDetail: "Search the linked scene for a required clue.",
      complete: Boolean(evidence?.discoverable),
      obligationIds: obligationIdsForEvidence(ledger.obligations, evidenceId),
      evidenceIds: [evidenceId],
      eventIds: eventsForEvidence(ledger.obligations, caseFromLog, events, evidenceId),
      memoryIds: memoriesForEvidence(ledger.obligations, evidenceId),
      characterIds: evidence?.relatedCharacterIds || [],
      locationId: evidence?.location
    });
  });
  const questionSteps = requiredWitnessIds.map((characterId, index) => makeStep({
    id: `route:${caseFromLog.id}:question:${characterId}`,
    kind: "question",
    label: `Question ${characterId}`,
    detail: "Ask this witness before presenting contradiction evidence.",
    lowSpoilerLabel: `Question witness ${index + 1}`,
    lowSpoilerDetail: "Question a witness connected to the memory chain.",
    complete: true,
    obligationIds: contradictionObligations.filter((item) => item.characterIds.includes(characterId)).map((item) => item.id),
    evidenceIds: [],
    eventIds: [],
    memoryIds: unique(caseFromLog.testimonies.filter((item) => item.characterId === characterId).flatMap((item) => item.memoryIds)),
    characterIds: [characterId]
  }));
  const challengeSteps = challengePairs.map((pair, index) => makeStep({
    id: `route:${caseFromLog.id}:challenge:${pair.obligation.id}:${pair.testimony.characterId}:${pair.evidenceId}`,
    kind: "challenge",
    label: `Challenge ${pair.testimony.characterId} with ${pair.evidenceId}`,
    detail: "Present contradiction evidence to lock the testimony route.",
    lowSpoilerLabel: `Challenge testimony ${index + 1}`,
    lowSpoilerDetail: "Present a discovered clue to test a witness statement.",
    complete: true,
    obligationIds: [pair.obligation.id],
    evidenceIds: [pair.evidenceId],
    eventIds: eventsForEvidence(ledger.obligations, caseFromLog, events, pair.evidenceId),
    memoryIds: pair.testimony.memoryIds,
    characterIds: [pair.testimony.characterId]
  }));
  const selectStep = makeStep({
    id: `route:${caseFromLog.id}:select-evidence`,
    kind: "select-evidence",
    label: "Select proof evidence",
    detail: "Select every clue required by the proof ledger.",
    lowSpoilerLabel: "Select proof evidence",
    lowSpoilerDetail: "Select the discovered clues that cover the proof ledger.",
    complete: theoryEvidenceIds.length === requiredEvidenceIds.length,
    obligationIds: ledger.obligations.map((item) => item.id),
    evidenceIds: theoryEvidenceIds,
    eventIds: unique(theoryEvidenceIds.flatMap((id) => eventsForEvidence(ledger.obligations, caseFromLog, events, id))),
    memoryIds: unique(theoryEvidenceIds.flatMap((id) => memoriesForEvidence(ledger.obligations, id))),
    characterIds: []
  });
  const submitStep = makeStep({
    id: `route:${caseFromLog.id}:submit`,
    kind: "submit",
    label: "Submit accepted theory",
    detail: judgement.explanation,
    lowSpoilerLabel: "Submit accepted theory",
    lowSpoilerDetail: "Submit the culprit, motive, method, and selected evidence after the route is covered.",
    complete: judgement.accepted,
    obligationIds: ledger.obligations.map((item) => item.id),
    evidenceIds: theoryEvidenceIds,
    eventIds: [],
    memoryIds: [],
    characterIds: [caseFromLog.deductionCase.truth.culpritId]
  });
  const steps = [...searchSteps, ...questionSteps, ...challengeSteps, selectStep, submitStep];
  const sourceBacked = sourceMode === "static" || sourceGaps.length === 0;
  const routeCertified = blockers.length === 0;

  return {
    caseId: caseFromLog.id,
    sourceMode,
    valid: routeCertified,
    routeCertified,
    sourceBacked,
    autoTheoryAccepted: judgement.accepted,
    totalRequiredObligations: coverage.totalRequired,
    coveredRequiredObligations: coverage.coveredRequired,
    routeStepCount: steps.length,
    requiredEvidenceIds,
    requiredWitnessIds,
    challengeEvidenceIds,
    theoryEvidenceIds,
    coveredObligationIds: coverage.coveredObligationIds,
    steps,
    blockers,
    judgement
  };
}

export function spoilerSafeCaseRouteCertificate(certificate: CaseRouteCertificate, solved: boolean): CaseRouteCertificate {
  if (solved) return certificate;
  return {
    ...certificate,
    requiredEvidenceIds: [],
    requiredWitnessIds: [],
    challengeEvidenceIds: [],
    theoryEvidenceIds: [],
    coveredObligationIds: certificate.coveredObligationIds.map((_, index) => `covered:${index + 1}`),
    judgement: undefined,
    blockers: certificate.blockers.map((item, index) => ({
      ...item,
      label: item.label,
      detail: item.detail,
      missingEvidenceIds: [],
      missingObligationIds: item.missingObligationIds.map((_, blockerIndex) => `blocker:${index + 1}:${blockerIndex + 1}`)
    })),
    steps: certificate.steps.map((item, index) => ({
      ...item,
      id: `route-step:${item.kind}:${index + 1}`,
      label: item.lowSpoilerLabel,
      detail: item.lowSpoilerDetail,
      obligationIds: item.obligationIds.map((_, obligationIndex) => `obligation:${item.kind}:${obligationIndex + 1}`),
      evidenceIds: [],
      eventIds: [],
      memoryIds: [],
      characterIds: [],
      locationId: item.kind === "search" ? item.locationId : undefined
    }))
  };
}
