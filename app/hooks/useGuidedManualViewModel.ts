"use client";

import { useMemo } from "react";
import { guidedManualActionLabel, type GuidedManualStepTarget } from "@/app/campaign/replay-practice-model";
import type {
  CaseRouteCertificate,
  DeductionCase,
  PlayableCaseIntake,
  PlayerSession,
  PlayerTheory,
  WorldLeadPublicSummary
} from "@/lib/engine";

export type GuidedManualRunViewModel = {
  currentStep: GuidedManualStepTarget["kind"];
  currentLabel: string;
  completedSteps: number;
  totalSteps: number;
  lastResult: string;
  blockerSummary: string;
  readyToReview: boolean;
  running: boolean;
};

type GuidedManualProjectionInput = {
  session: PlayerSession | null;
  theory: PlayerTheory;
  scenes: DeductionCase["scenes"];
  caseRouteCertificate?: CaseRouteCertificate | null;
  playableIntake?: PlayableCaseIntake | null;
  worldLead?: WorldLeadPublicSummary | null;
};

export function deriveGuidedManualTarget({
  session,
  theory,
  scenes,
  caseRouteCertificate,
  playableIntake,
  worldLead
}: GuidedManualProjectionInput): GuidedManualStepTarget {
  const routeSteps = caseRouteCertificate?.steps || playableIntake?.routeCertificate?.steps || [];
  if (!session) return { kind: "join", label: guidedManualActionLabel("join") };
  const discoveredSet = new Set(session.discoveredEvidenceIds);
  const questionedSet = new Set(session.interrogationLog.map((entry) => entry.characterId));
  const challengedSet = new Set(session.interrogationLog.filter((entry) => entry.challenge?.hit).map((entry) => entry.characterId));
  const selectedSet = new Set(theory.evidenceIds);
  const searchStep = routeSteps.find((step) => step.kind === "search" && step.evidenceIds.some((id) => !discoveredSet.has(id)));
  const searchTarget = searchStep ? (() => {
    const evidenceId = searchStep.evidenceIds.find((id) => !discoveredSet.has(id)) || searchStep.evidenceIds[0];
    const scene = scenes.find((item) => item.evidenceIds.includes(evidenceId));
    return { kind: "search" as const, label: guidedManualActionLabel("search"), evidenceId, locationId: scene?.id || searchStep.locationId };
  })() : undefined;
  const questionStep = routeSteps.find((step) => step.kind === "question" && step.characterIds.some((id) => !questionedSet.has(id)));
  const questionTarget = questionStep
    ? { kind: "question" as const, label: guidedManualActionLabel("question"), characterId: questionStep.characterIds.find((id) => !questionedSet.has(id)) || questionStep.characterIds[0] }
    : undefined;
  const challengeStep = routeSteps.find((step) => step.kind === "challenge" && step.characterIds.some((id) => !challengedSet.has(id)));
  const challengeTarget = challengeStep ? (() => {
    const missingEvidenceId = challengeStep.evidenceIds.find((id) => !discoveredSet.has(id));
    if (missingEvidenceId) return undefined;
    return {
      kind: "challenge" as const,
      label: guidedManualActionLabel("challenge"),
      characterId: challengeStep.characterIds.find((id) => !challengedSet.has(id)) || challengeStep.characterIds[0],
      evidenceId: challengeStep.evidenceIds.find((id) => discoveredSet.has(id)) || challengeStep.evidenceIds[0]
    };
  })() : undefined;
  const defaultTarget = searchTarget || questionTarget || challengeTarget;
  if (worldLead?.status === "followed") {
    const prioritizedTarget = worldLead.focus === "search" ? searchTarget : worldLead.focus === "question" ? questionTarget : challengeTarget;
    if (prioritizedTarget) return { ...prioritizedTarget, label: `${prioritizedTarget.label} / world lead` };
  }
  if (defaultTarget) return defaultTarget;
  if (challengeStep) {
    const missingEvidenceId = challengeStep.evidenceIds.find((id) => !discoveredSet.has(id));
    if (missingEvidenceId) {
      const scene = scenes.find((item) => item.evidenceIds.includes(missingEvidenceId));
      return { kind: "search", label: guidedManualActionLabel("search"), evidenceId: missingEvidenceId, locationId: scene?.id || challengeStep.locationId };
    }
  }
  const certifiedEvidenceIds = caseRouteCertificate?.theoryEvidenceIds?.length
    ? caseRouteCertificate.theoryEvidenceIds
    : routeSteps.find((step) => step.kind === "select-evidence")?.evidenceIds || [];
  const missingTheoryEvidence = certifiedEvidenceIds.find((id) => discoveredSet.has(id) && !selectedSet.has(id));
  if (missingTheoryEvidence || (certifiedEvidenceIds.length > 0 && certifiedEvidenceIds.some((id) => !selectedSet.has(id)))) {
    return { kind: "select-evidence", label: guidedManualActionLabel("select-evidence"), evidenceId: missingTheoryEvidence || certifiedEvidenceIds[0] };
  }
  if (!session.judgement?.accepted) return { kind: "submit", label: guidedManualActionLabel("submit") };
  return { kind: "review-source", label: guidedManualActionLabel("review-source") };
}

export function useGuidedManualViewModel(input: GuidedManualProjectionInput & {
  lastResult: string;
  guidedManualRunning: boolean;
  busy: boolean;
}) {
  const target = useMemo(() => deriveGuidedManualTarget(input), [
    input.caseRouteCertificate,
    input.playableIntake,
    input.scenes,
    input.session,
    input.theory.evidenceIds,
    input.worldLead?.focus,
    input.worldLead?.status
  ]);
  const viewModel = useMemo<GuidedManualRunViewModel>(() => {
    const questioned = Boolean(input.session?.interrogationLog.length);
    const challengeHit = Boolean(input.session?.interrogationLog.some((entry) => entry.challenge?.hit));
    const certifiedEvidenceIds = input.caseRouteCertificate?.theoryEvidenceIds || input.playableIntake?.routeCertificate?.theoryEvidenceIds || [];
    const selectedSet = new Set(input.theory.evidenceIds);
    const selectedCertified = certifiedEvidenceIds.length > 0 && certifiedEvidenceIds.every((id) => selectedSet.has(id));
    const completed = [
      Boolean(input.session),
      Boolean(input.session?.discoveredEvidenceIds.length),
      questioned,
      challengeHit,
      selectedCertified || Boolean(input.session?.submittedTheory?.evidenceIds.length),
      Boolean(input.session?.judgement?.accepted),
      Boolean(input.session?.judgement?.accepted)
    ].filter(Boolean).length;
    const blockerSummary = input.caseRouteCertificate?.blockers.length
      ? `${input.caseRouteCertificate.blockers.length} route blocker(s) need authoring review before manual completion.`
      : target.kind === "review-source"
        ? "Accepted theory is complete; review the source-backed audit workbench."
        : "Runs one low-spoiler player step using the current certified route.";
    return {
      currentStep: target.kind,
      currentLabel: target.label,
      completedSteps: completed,
      totalSteps: 7,
      lastResult: input.lastResult,
      blockerSummary,
      readyToReview: Boolean(input.session?.judgement?.accepted),
      running: input.guidedManualRunning || input.busy
    };
  }, [input.busy, input.caseRouteCertificate, input.guidedManualRunning, input.lastResult, input.playableIntake, input.session, input.theory.evidenceIds, target]);
  return { target, viewModel };
}
