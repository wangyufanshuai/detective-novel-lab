"use client";

import { useMemo } from "react";
import type { useInvestigationController } from "@/app/controllers/useInvestigationController";
import {
  autoSolvePlayableCase,
  buildCaseTruthLedger,
  buildEmergenceProofTrace,
  buildEvidenceNotebook,
  buildPlayableCaseIntake,
  buildPlayerProofTour,
  certifyPlayableCase,
  evaluateCaseProofCoverage
} from "@/lib/engine";
import type { CaseAutoSolveSummary, EmergenceProofTrace, EvidenceNotebookItem, PlayableCaseIntake, ProofTourStep, WorldEvent } from "@/lib/engine";

type CertifiedCaseAuditModelsInput = {
  investigation: ReturnType<typeof useInvestigationController>;
  serverPlaythroughSummary: CaseAutoSolveSummary | null;
};

/** Pure certified-route and source-review projections; never executes an investigation action. */
export function useCertifiedCaseAuditModels({ investigation, serverPlaythroughSummary }: CertifiedCaseAuditModelsInput) {
  const { world, events, activeCase, session, runtimeMode } = investigation;
  const causalTrace = activeCase?.causalTrace;
  const causalTraceEvents = useMemo(
    () => (causalTrace?.orderedEventIds || []).map((id) => events.find((event) => event.id === id)).filter((event): event is WorldEvent => Boolean(event)),
    [causalTrace?.orderedEventIds, events]
  );
  const emergenceProofTrace: EmergenceProofTrace | null = useMemo(() => {
    if (!world || !activeCase) return null;
    return buildEmergenceProofTrace(world, events, activeCase, {
      solved: Boolean(session?.judgement?.accepted),
      discoveredEvidenceIds: session?.discoveredEvidenceIds || []
    });
  }, [activeCase, events, session?.discoveredEvidenceIds, session?.judgement?.accepted, world]);
  const evidenceNotebook: EvidenceNotebookItem[] = useMemo(
    () => (activeCase ? buildEvidenceNotebook(activeCase, events, session) : []),
    [activeCase, events, session]
  );
  const proofTourSteps: ProofTourStep[] = useMemo(
    () => (activeCase ? buildPlayerProofTour(activeCase, events, emergenceProofTrace, session) : []),
    [activeCase, emergenceProofTrace, events, session]
  );
  const playableIntake: PlayableCaseIntake | null = useMemo(
    () => (activeCase && ((activeCase.sourceEventIds || []).length > 0 || Boolean(activeCase.sourceCandidateId) || Boolean(activeCase.triggeredEventId))
      ? buildPlayableCaseIntake(activeCase, events, world, session)
      : null),
    [activeCase, events, session, world]
  );
  const caseTruthLedger = useMemo(() => (activeCase ? buildCaseTruthLedger(activeCase, events) : null), [activeCase, events]);
  const caseProofCoverage = useMemo(
    () => caseTruthLedger ? evaluateCaseProofCoverage(caseTruthLedger, {
      discoveredEvidenceIds: session?.discoveredEvidenceIds || [],
      selectedEvidenceIds: session?.submittedTheory?.evidenceIds,
      challengedCharacterIds: session?.interrogationLog.filter((entry) => entry.challenge?.hit).map((entry) => entry.characterId) || [],
      solved: Boolean(session?.judgement?.accepted)
    }) : null,
    [caseTruthLedger, session]
  );
  const caseRouteCertificate = useMemo(
    () => (activeCase ? certifyPlayableCase(activeCase, events, session) : null),
    [activeCase, events, session]
  );
  const staticPlaythroughProof = useMemo(() => {
    if (runtimeMode !== "static-demo" || !activeCase) return null;
    const autoSolve = autoSolvePlayableCase(activeCase, events, { dryRun: true });
    const acceptedTheory = Boolean(session?.judgement?.accepted);
    const questionedWitnessCount = acceptedTheory
      ? new Set((session?.interrogationLog || []).map((entry) => entry.characterId)).size
      : autoSolve.summary.questionedWitnessCount;
    const challengeHitCount = acceptedTheory
      ? (session?.interrogationLog || []).filter((entry) => entry.challenge?.hit).length
      : autoSolve.summary.challengeHitCount;
    const selectedEvidenceCount = acceptedTheory
      ? session?.submittedTheory?.evidenceIds.length || 0
      : autoSolve.summary.selectedEvidenceCount;
    return {
      title: "Static Playthrough Proof",
      actionLabel: "Run Certified Playthrough",
      acceptedLabel: "completed / accepted theory",
      readyLabel: "ready / certified route",
      blockedLabel: "blocked / inspect route",
      boundaryText: "Browser-local aggregate proof only: no hidden truth, raw bodies, internal ids, source ids, SQLite writes, or public artifact changes.",
      testId: "static-playthrough-proof",
      runTestId: "run-certified-playthrough",
      status: acceptedTheory ? "accepted" as const : autoSolve.passed ? "ready" as const : "blocked" as const,
      routeCertified: Boolean(caseRouteCertificate?.routeCertified || autoSolve.summary.routeCertified),
      autoRoutePassed: autoSolve.passed,
      acceptedTheory: Boolean(acceptedTheory || autoSolve.summary.autoTheoryAccepted),
      searchStepCount: autoSolve.steps.filter((step) => step.kind === "search").length,
      questionedWitnessCount,
      challengeHitCount,
      selectedEvidenceCount,
      coveredRequiredObligations: acceptedTheory
        ? caseProofCoverage?.coveredRequired || autoSolve.summary.coveredRequiredObligations
        : autoSolve.summary.coveredRequiredObligations,
      totalRequiredObligations: acceptedTheory
        ? caseProofCoverage?.totalRequired || autoSolve.summary.totalRequiredObligations
        : autoSolve.summary.totalRequiredObligations,
      blockerCount: autoSolve.failures.length
    };
  }, [activeCase, caseProofCoverage, caseRouteCertificate, events, runtimeMode, session]);
  const serverPlaythroughProof = useMemo(() => {
    if (runtimeMode === "static-demo" || !activeCase || !playableIntake) return null;
    const sourceBackedRoute = Boolean(
      (activeCase.sourceEventIds || []).length > 0
        || activeCase.sourceCandidateId
        || activeCase.sourceMap?.sourceCandidateId
        || activeCase.triggeredEventId
    );
    const acceptedTheory = Boolean(session?.judgement?.accepted);
    const summary = serverPlaythroughSummary?.caseId === activeCase.id ? serverPlaythroughSummary : null;
    const coverage = playableIntake.coach?.coverage;
    const routeCertified = Boolean(caseRouteCertificate?.routeCertified || coverage?.routeCertified || summary?.routeCertified);
    const autoRoutePassed = Boolean(summary?.passed || coverage?.autoSolvePassed);
    const questionedWitnessCount = acceptedTheory
      ? new Set((session?.interrogationLog || []).map((entry) => entry.characterId)).size
      : summary?.questionedWitnessCount ?? coverage?.questionedWitnesses ?? 0;
    const challengeHitCount = acceptedTheory
      ? (session?.interrogationLog || []).filter((entry) => entry.challenge?.hit).length
      : summary?.challengeHitCount ?? coverage?.challengeHitCount ?? 0;
    const selectedEvidenceCount = acceptedTheory
      ? session?.submittedTheory?.evidenceIds.length || 0
      : summary?.selectedEvidenceCount ?? coverage?.selectedTheoryEvidence ?? 0;
    return {
      title: "Server Playthrough Proof",
      actionLabel: "Run Server Certified Playthrough",
      acceptedLabel: "completed / accepted theory",
      readyLabel: "ready / source-backed route",
      blockedLabel: "blocked / inspect emerged route",
      boundaryText: "Server Runtime aggregate proof: persists only an explicit auto-player session; no public catalog, dataset reader, raw bodies, or SQLite schema changes.",
      testId: "server-playthrough-proof",
      runTestId: "run-server-certified-playthrough",
      status: acceptedTheory ? "accepted" as const : autoRoutePassed && routeCertified ? "ready" as const : "blocked" as const,
      routeCertified,
      sourceBackedRoute,
      autoRoutePassed,
      acceptedTheory: Boolean(acceptedTheory || summary?.autoTheoryAccepted),
      searchStepCount: (playableIntake.routeCertificate?.steps || caseRouteCertificate?.steps || []).filter((step) => step.kind === "search").length,
      questionedWitnessCount,
      challengeHitCount,
      selectedEvidenceCount,
      coveredRequiredObligations: acceptedTheory
        ? caseProofCoverage?.coveredRequired || summary?.coveredRequiredObligations || coverage?.coveredRequired || 0
        : summary?.coveredRequiredObligations ?? coverage?.coveredRequired ?? 0,
      totalRequiredObligations: acceptedTheory
        ? caseProofCoverage?.totalRequired || summary?.totalRequiredObligations || coverage?.totalRequired || 0
        : summary?.totalRequiredObligations ?? coverage?.totalRequired ?? 0,
      blockerCount: summary?.failureKinds.length || playableIntake.coach?.blockers.length || 0
    };
  }, [activeCase, caseProofCoverage, caseRouteCertificate, playableIntake, runtimeMode, serverPlaythroughSummary, session]);
  const sourceReviewUnlock = useMemo(() => {
    if (!activeCase) return null;
    const unlocked = Boolean(session?.judgement?.accepted);
    const memoryCount = playableIntake?.sourceCounts.memories
      ?? activeCase.sourceMap?.memorySourceIds?.length
      ?? activeCase.testimonies.reduce((sum, testimony) => sum + (testimony.memoryIds?.length || 0), 0)
      ?? 0;
    return {
      unlocked,
      statusLabel: unlocked ? "unlocked / source-backed audit ready" : "locked / accepted theory required",
      sourceEventCount: playableIntake?.sourceCounts.events ?? activeCase.sourceEventIds.length,
      memoryCount,
      coveredObligations: caseProofCoverage?.coveredRequired || 0,
      totalObligations: caseProofCoverage?.totalRequired || caseRouteCertificate?.totalRequiredObligations || 0,
      routeStepCount: caseRouteCertificate?.routeStepCount || caseRouteCertificate?.steps.length || 0,
      challengeHitCount: (session?.interrogationLog || []).filter((entry) => entry.challenge?.hit).length,
      selectedEvidenceCount: session?.submittedTheory?.evidenceIds.length || 0,
      proofGapCount: caseProofCoverage?.gaps.length || 0
    };
  }, [activeCase, caseProofCoverage, caseRouteCertificate, playableIntake, session]);

  return {
    causalTrace, causalTraceEvents, emergenceProofTrace, evidenceNotebook, proofTourSteps, playableIntake,
    caseTruthLedger, caseProofCoverage, caseRouteCertificate, staticPlaythroughProof, serverPlaythroughProof,
    sourceReviewUnlock
  };
}
