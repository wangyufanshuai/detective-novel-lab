import { getInvestigationActionDefinition, type InvestigationActionKind } from "./investigation-action-registry";
import type {
  DeductionCase,
  Evidence,
  EvidenceNotebookItem,
  PlayableCaseIntake,
  PlayableCaseNextAction,
  PlayerSession
} from "@/lib/engine";

export type AiSafetyView = {
  promptAudit?: { safe?: boolean };
  memoryCount?: number;
  evidenceCount?: number;
  safetyFlags?: string[];
};
export type GapCard = {
  id: string;
  label: string;
  detail: string;
  target: "suspects" | "motive" | "method" | "evidence" | "exclusion" | "logic";
};
export type NotebookAction = "source" | "challenge" | "chain";
export type PlayableInvestigationPathKind = "join" | "search" | "question" | "challenge" | "select-evidence" | "submit" | "review-source";
export type PlayableInvestigationPathStep = {
  kind: PlayableInvestigationPathKind;
  label: string;
  question: string;
  detail: string;
  metric: string;
  status: "done" | "current" | "ready" | "locked";
  action: PlayableCaseNextAction;
};
export type CertifiedPlaythroughProofSummary = {
  title: string;
  actionLabel: string;
  acceptedLabel: string;
  readyLabel: string;
  blockedLabel: string;
  boundaryText: string;
  testId: string;
  runTestId: string;
  status: "ready" | "running" | "accepted" | "blocked";
  routeCertified: boolean;
  sourceBackedRoute?: boolean;
  autoRoutePassed: boolean;
  acceptedTheory: boolean;
  searchStepCount: number;
  questionedWitnessCount: number;
  challengeHitCount: number;
  selectedEvidenceCount: number;
  coveredRequiredObligations: number;
  totalRequiredObligations: number;
  blockerCount: number;
};
export type GuidedManualRunSummary = {
  currentStep: PlayableInvestigationPathKind;
  currentLabel: string;
  completedSteps: number;
  totalSteps: number;
  lastResult: string;
  blockerSummary: string;
  readyToReview: boolean;
  running: boolean;
};
export type GuidedStepJournalEntry = {
  id: string;
  journalKey?: string;
  step: PlayableInvestigationPathKind;
  label: string;
  status: "done" | "blocked" | "info";
  result: string;
  progressDelta: string;
  nextAction: string;
  fallbackUsed?: boolean;
  reviewUnlocked?: boolean;
};
export type SourceReviewUnlockSummary = {
  unlocked: boolean;
  statusLabel: string;
  sourceEventCount: number;
  memoryCount: number;
  coveredObligations: number;
  totalObligations: number;
  routeStepCount: number;
  challengeHitCount: number;
  selectedEvidenceCount: number;
  proofGapCount: number;
};
export type SolvedCaseDebriefSummary = {
  accepted: boolean;
  manualStepsCompleted: number;
  totalManualSteps: number;
  lastStepResult: string;
  fallbackUsed: boolean;
  selectedEvidenceCount: number;
  challengeHitCount: number;
  coveredObligations: number;
  totalObligations: number;
  proofGapCount: number;
  sourceEventCount: number;
  memoryCount: number;
  routeStepCount: number;
  sourceReviewUnlocked: boolean;
  worldLeadOutcomeStatus: "active" | "settled" | "not-used";
  worldLeadHandoffStatus: "ready" | "consumed" | "not-used";
  worldArcStatus: "active" | "completed" | "not-used";
  worldArcProgress: string;
  worldArcDirectiveStatus: "ready" | "scheduled" | "running" | "completed" | "blocked" | "not-used";
  worldPressureCascadeStatus: "active" | "consumed" | "empty";
  townSocialResponseStatus: "empty" | "ready" | "active" | "settled";
  investigationOperationsStatus: "ready" | "planned" | "active" | "settled" | "blocked";
  investigationOperationsSupport: string;
  investigationOperationsProgress: string;
  investigationOperationsTime: string;
};
export type ReplayGoalCoachSummary = {
  visible: boolean;
  activeAttempt: boolean;
  previousGuidedSteps: number;
  previousFallbackUsed: boolean;
  previousFallbackTheoryFieldCount: number;
  previousSelectedEvidenceCount: number;
  previousProofGapCount: number;
  previousSourceReviewUnlocked: boolean;
  currentStep: PlayableInvestigationPathKind;
  lastResult: string;
  completedGoalCount: number;
  totalGoalCount: number;
  goals: Array<{ id: string; label: string; status: "done" | "active" | "ready"; detail: string }>;
};
export type ReplayPracticeLoopPhase = "start" | "discover" | "pick-evidence" | "fill-theory" | "submit" | "review-source" | "scorecard";
export type ReplayPracticeLoopSummary = {
  visible: boolean;
  activeAttempt: boolean;
  currentPhase: ReplayPracticeLoopPhase;
  currentPhaseLabel: string;
  nextAction: string;
  manualEvidencePickCount: number;
  manualTheoryFieldCount: number;
  fallbackEvidencePickCount: number;
  fallbackTheoryFieldCount: number;
  blockedGapCount: number;
  sourceReviewUnlocked: boolean;
  scorecardStatus: "pending" | "completed" | "waiting";
  worldLeadOutcomeStatus: "active" | "settled" | "not-used";
  worldLeadHandoffStatus: "ready" | "consumed" | "not-used";
  worldArcStatus: "active" | "completed" | "not-used";
  worldArcProgress: string;
  worldArcDirectiveStatus: "ready" | "scheduled" | "running" | "completed" | "blocked" | "not-used";
  worldPressureCascadeStatus: "active" | "consumed" | "empty";
  townSocialResponseStatus: "empty" | "ready" | "active" | "settled";
  investigationOperationsStatus: "ready" | "planned" | "active" | "settled" | "blocked";
  investigationOperationsProgress: string;
  stages: Array<{ id: ReplayPracticeLoopPhase; label: string; status: "done" | "current" | "ready" | "locked" }>;
};
export type ReplayAttemptDeltaStatus = "improved" | "unchanged" | "regressed" | "completed" | "pending";
export type ReplayAttemptScorecardSummary = {
  visible: boolean;
  status: "pending" | "completed";
  activeAttempt: boolean;
  currentStep: PlayableInvestigationPathKind;
  lastResult: string;
  completedGuidedSteps: number;
  fallbackUsed: boolean;
  selectedEvidenceCount: number;
  manualEvidencePickCount: number;
  fallbackEvidencePickCount: number;
  manualTheoryFieldCount: number;
  fallbackTheoryFieldCount: number;
  blockedTheoryGapCount: number;
  proofGapCount: number;
  sourceReviewUnlocked: boolean;
  worldLeadOutcomeStatus: "active" | "settled" | "not-used";
  worldLeadHandoffStatus: "ready" | "consumed" | "not-used";
  worldArcStatus: "active" | "completed" | "not-used";
  worldArcProgress: string;
  worldArcDirectiveStatus: "ready" | "scheduled" | "running" | "completed" | "blocked" | "not-used";
  worldPressureCascadeStatus: "active" | "consumed" | "empty";
  townSocialResponseStatus: "empty" | "ready" | "active" | "settled";
  investigationOperationsStatus: "ready" | "planned" | "active" | "settled" | "blocked";
  investigationOperationsProgress: string;
  completedReplayGoals: number;
  totalReplayGoals: number;
  rows: Array<{ id: string; label: string; previous: string; current: string; status: ReplayAttemptDeltaStatus; detail: string }>;
};
export type ManualEvidenceDrillCandidate = {
  evidenceId: string;
  title: string;
  locationLabel: string;
  sourceLabel: string;
  supports: string[];
  contradicts: string[];
  selected: boolean;
};
export type ManualEvidenceDrillSummary = {
  visible: boolean;
  selectedEvidenceCount: number;
  routeEvidenceTargetCount: number;
  manualPickCount: number;
  remainingProofSlots: number;
  readyForSubmit: boolean;
  candidates: ManualEvidenceDrillCandidate[];
};
export type ManualTheoryDrillSummary = {
  visible: boolean;
  manualFieldCount: number;
  remainingFieldCount: number;
  fallbackFieldCount: number;
  blockedGapCount: number;
  evidenceReady: boolean;
  readyForSubmit: boolean;
  fallbackApproved: boolean;
  suspectOptions: Array<{ id: string; label: string }>;
  selectedCulpritId: string;
  motiveText: string;
  methodText: string;
  evidencePrompts: Array<{ title: string; detail: string; supportLabels: string[] }>;
};

function normalizePlayableActionKind(kind?: PlayableCaseNextAction["kind"] | PlayableInvestigationPathKind | "review" | "solved") {
  if (!kind || kind === "review" || kind === "solved") return "review-source";
  if (kind === "observe" || kind === "organize") return "search";
  return kind as PlayableInvestigationPathKind;
}

function buildPathAction(input: {
  kind: PlayableInvestigationPathKind;
  label: string;
  detail: string;
  playableIntake?: PlayableCaseIntake | null;
  notebookItems: EvidenceNotebookItem[];
  characters: DeductionCase["characters"];
  discoveredEvidence: Evidence[];
}): PlayableCaseNextAction {
  const nextAction = input.playableIntake?.nextAction;
  if (nextAction && normalizePlayableActionKind(nextAction.kind) === input.kind) return nextAction;
  const coachStep = input.playableIntake?.coach?.steps.find((step) => step.stage === input.kind);
  if (coachStep) {
    return {
      kind: input.kind,
      label: coachStep.label,
      detail: coachStep.detail,
      buttonLabel: coachStep.buttonLabel,
      coachStepId: coachStep.id,
      targetLocationId: coachStep.targetLocationId,
      targetCharacterId: coachStep.targetCharacterId,
      targetEvidenceId: coachStep.targetEvidenceId
    };
  }
  const firstRouteItem = input.notebookItems.find((item) => !item.discovered) || input.notebookItems[0];
  const firstDiscoveredRouteItem = input.notebookItems.find((item) => item.discovered && item.challengeNpcIds.length) || input.notebookItems.find((item) => item.discovered);
  const firstWitness = firstDiscoveredRouteItem?.challengeNpcIds[0] || input.notebookItems.find((item) => item.challengeNpcIds.length)?.challengeNpcIds[0] || input.characters.find((item) => item.role !== "死者")?.id;
  const firstEvidence = input.discoveredEvidence[0]?.id || firstDiscoveredRouteItem?.evidenceId;
  return {
    kind: input.kind,
    label: input.label,
    detail: input.detail,
    buttonLabel: input.kind === "join" ? "Join investigation" : "Focus step",
    targetLocationId: input.kind === "search" ? firstRouteItem?.locationId : firstDiscoveredRouteItem?.locationId,
    targetCharacterId: input.kind === "question" || input.kind === "challenge" ? firstWitness : undefined,
    targetEvidenceId: input.kind === "challenge" || input.kind === "select-evidence" ? firstEvidence : undefined
  };
}

export function buildPlayableInvestigationPath(input: {
  playableIntake?: PlayableCaseIntake | null;
  session: PlayerSession | null;
  notebookItems: EvidenceNotebookItem[];
  discoveredEvidence: Evidence[];
  dialogueLog: PlayerSession["interrogationLog"];
  playerTheoryEvidence: Set<string>;
  characters: DeductionCase["characters"];
}): PlayableInvestigationPathStep[] {
  const definitionFor = (kind: PlayableInvestigationPathKind) => getInvestigationActionDefinition((kind === "review-source" ? "review" : kind) as InvestigationActionKind);
  const progress = input.playableIntake?.progress;
  const coach = input.playableIntake?.coach;
  const routeCertificate = input.playableIntake?.routeCertificate;
  const discoveredCount = progress?.discoveredEvidence ?? input.discoveredEvidence.length;
  const totalEvidence = progress?.totalEvidence ?? Math.max(input.notebookItems.length, input.discoveredEvidence.length);
  const questionedCount = progress?.questionedWitnesses ?? new Set(input.dialogueLog.map((entry) => entry.characterId)).size;
  const totalWitnesses = progress?.totalWitnesses ?? Math.max(1, new Set(input.notebookItems.flatMap((item) => item.challengeNpcIds)).size);
  const challengeHitCount = progress?.challengeHitCount ?? input.dialogueLog.filter((entry) => entry.challenge?.hit).length;
  const challengeReadyCount = progress?.challengeReadyCount ?? input.notebookItems.filter((item) => item.discovered && item.challengeNpcIds.length).length;
  const selectedTheoryEvidence = progress?.selectedTheoryEvidence ?? input.playerTheoryEvidence.size;
  const submitReady = progress?.submitReady ?? Boolean(routeCertificate?.routeCertified && selectedTheoryEvidence > 0);
  const solved = progress?.solved ?? Boolean(input.session?.judgement?.accepted);
  const activeKind = normalizePlayableActionKind(input.playableIntake?.nextAction?.kind || coach?.stage || progress?.currentStage);
  const base = [
    { kind: "join" as const, label: "Join", question: "Enter the case", detail: "Start the investigation before searching or questioning.", metric: input.session ? "joined" : "start", complete: Boolean(input.session), ready: true },
    { kind: "search" as const, label: "Search", question: "Find clues", detail: "Use the map or evidence notebook to locate discoverable clues.", metric: `${discoveredCount}/${totalEvidence} clues`, complete: discoveredCount > 0, ready: Boolean(input.session) },
    { kind: "question" as const, label: "Question", question: "Talk to witnesses", detail: "Ask witnesses from the current memory scope.", metric: `${questionedCount}/${totalWitnesses} witnesses`, complete: questionedCount > 0, ready: discoveredCount > 0 },
    { kind: "challenge" as const, label: "Challenge", question: "Test statements", detail: "Use known clues to expose local testimony contradictions.", metric: challengeHitCount > 0 ? `${challengeHitCount} hit` : `${challengeReadyCount} ready`, complete: challengeHitCount > 0, ready: questionedCount > 0 || challengeReadyCount > 0 },
    { kind: "select-evidence" as const, label: "Select Evidence", question: "Build the chain", detail: "Choose discovered clues for the theory route.", metric: `${selectedTheoryEvidence} selected`, complete: selectedTheoryEvidence > 0, ready: discoveredCount > 0 },
    { kind: "submit" as const, label: "Submit", question: "Test the theory", detail: "Submit only after the route has enough discovered material.", metric: solved ? "accepted" : submitReady ? "ready" : "not ready", complete: solved, ready: submitReady || selectedTheoryEvidence > 0 },
    { kind: "review-source" as const, label: "Review Source", question: "Audit the proof", detail: "After solving, inspect the source-backed reasoning route.", metric: solved ? "unlocked" : "locked", complete: solved, ready: solved }
  ];
  for (const step of base) {
    const definition = definitionFor(step.kind);
    step.label = definition.label;
    step.detail = definition.detail;
  }
  const firstActionableKind = base.find((step) => !step.complete && step.ready)?.kind || "review-source";
  return base.map((step) => {
    const current = step.kind === activeKind || (!base.some((item) => item.kind === activeKind && !item.complete) && step.kind === firstActionableKind);
    const status: PlayableInvestigationPathStep["status"] = step.complete ? "done" : current ? "current" : step.ready ? "ready" : "locked";
    return {
      kind: step.kind,
      label: step.label,
      question: step.question,
      detail: step.detail,
      metric: step.metric,
      status,
      action: buildPathAction({ ...step, playableIntake: input.playableIntake, notebookItems: input.notebookItems, characters: input.characters, discoveredEvidence: input.discoveredEvidence })
    };
  });
}
