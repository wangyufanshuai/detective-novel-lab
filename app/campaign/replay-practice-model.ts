import type { PlayerSession, PlayerTheory } from "@/lib/engine";
import { getInvestigationActionDefinition } from "./investigation-action-registry";

export type GuidedManualStepKind = "join" | "search" | "question" | "challenge" | "select-evidence" | "submit" | "review-source";

export type GuidedManualStepTarget = {
  kind: GuidedManualStepKind;
  label: string;
  evidenceId?: string;
  characterId?: string;
  locationId?: string;
};

export type GuidedStepJournalEntry = {
  id: string;
  journalKey?: string;
  step: GuidedManualStepKind;
  label: string;
  status: "done" | "blocked" | "info";
  result: string;
  progressDelta: string;
  nextAction: string;
  fallbackUsed?: boolean;
  reviewUnlocked?: boolean;
};

export type ReplayGoalAttemptState = {
  active: boolean;
  previousGuidedSteps: number;
  previousFallbackUsed: boolean;
  previousFallbackTheoryFieldCount: number;
  previousSelectedEvidenceCount: number;
  previousProofGapCount: number;
  previousSourceReviewUnlocked: boolean;
  manualEvidencePickCount: number;
  fallbackEvidencePickCount: number;
  manualTheoryFieldCount: number;
  fallbackTheoryFieldCount: number;
  blockedTheoryGapCount: number;
  theoryFallbackApproved: boolean;
  startedAt: string;
  lastResult: string;
};

export type ManualTheoryFieldKind = "culpritId" | "motive" | "method";

export function guidedManualActionLabel(kind: GuidedManualStepKind): string {
  return getInvestigationActionDefinition(kind === "review-source" ? "review" : kind).label;
}

export function countManualTheoryFields(theory: PlayerTheory) {
  return [theory.culpritId, theory.motive.trim(), theory.method.trim()].filter(Boolean).length;
}

export function unresolvedManualTheoryFields(judgement?: PlayerSession["judgement"]): Set<ManualTheoryFieldKind> {
  const unresolved = new Set<ManualTheoryFieldKind>();
  if (!judgement || judgement.accepted) return unresolved;
  if (judgement.contradictions.some((item) => /culprit/i.test(item))) unresolved.add("culpritId");
  if (judgement.missing.some((item) => /motive/i.test(item))) unresolved.add("motive");
  if (judgement.missing.some((item) => /method/i.test(item))) unresolved.add("method");
  return unresolved;
}
