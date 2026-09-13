import { getInvestigationActionDefinition, type InvestigationActionKind } from "./investigation-action-registry";
import type { PlayableCaseIntake, PlayableCaseNextAction, PlayerSession } from "@/lib/engine";

export type CertifiedCaseRhythmStepKind =
  | "join"
  | "search"
  | "question"
  | "challenge"
  | "select-evidence"
  | "submit"
  | "review-source"
  | "recover";

export type CertifiedCaseRhythmBeatKind = "intake" | "fieldwork" | "deduction" | "review";
export type CertifiedCaseRhythmStatus = "idle" | "active" | "recovery" | "complete";

export type CertifiedCaseRhythmBeat = {
  kind: CertifiedCaseRhythmBeatKind;
  label: string;
  metric: string;
  status: "done" | "current" | "ready" | "locked";
};

export type CertifiedCaseRhythmCurrentStep = {
  kind: CertifiedCaseRhythmStepKind;
  beat: CertifiedCaseRhythmBeatKind;
  label: string;
  detail: string;
  metric: string;
  action: PlayableCaseNextAction;
};

export type CertifiedCaseRhythmViewModel = {
  status: CertifiedCaseRhythmStatus;
  currentStep: CertifiedCaseRhythmCurrentStep;
  beats: CertifiedCaseRhythmBeat[];
  completedStepCount: number;
  totalStepCount: 7;
  progressLabel: string;
  recoveryLabel?: string;
  suggestedAction: {
    phase: string;
    title: string;
    detail: string;
    targetTab: "investigation" | "logic";
  };
};

export type CertifiedCaseRhythmInput = {
  intake?: PlayableCaseIntake | null;
  session: PlayerSession | null;
  theoryEvidenceIds?: string[];
  selectedSceneName?: string;
  observedCrimeWindow?: boolean;
  revealAvailable: boolean;
  recoveryGap?: { label: string; detail: string } | null;
  recoveryAdvice?: string;
};

export const CERTIFIED_CASE_RHYTHM_AUTOMATION_BUDGET = Object.freeze({
  maxPrimaryClicksPerStep: 2,
  maxPanelSwitchesPerStep: 1,
  maxStageSettleMs: 3_000,
  maxDialogueStageSettleMs: 12_000
});

export type CertifiedCaseRhythmAutomationSample = {
  stage: CertifiedCaseRhythmStepKind;
  primaryClicks: number;
  panelSwitches: number;
  settleMs: number;
};

const STEP_BEAT: Record<CertifiedCaseRhythmStepKind, CertifiedCaseRhythmBeatKind> = {
  join: "intake",
  search: "fieldwork",
  question: "fieldwork",
  challenge: "fieldwork",
  "select-evidence": "deduction",
  submit: "deduction",
  "review-source": "review",
  recover: "deduction"
};

const PHASE_LABEL: Record<CertifiedCaseRhythmBeatKind, string> = {
  intake: "Intake",
  fieldwork: "Fieldwork",
  deduction: "Deduction",
  review: "Review"
};

const RAW_REFERENCE_RE = /\b(?:case|session|npc|character|location|institution|resource|evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b|\b(?:culpritId|victimId|hiddenTruth|rawBody|sourceId|eventId)\b|[A-Za-z]:[\\/][^\s]*/gi;

function safeText(value: unknown, fallback: string, maximum = 220) {
  const normalized = String(value || "").replace(RAW_REFERENCE_RE, "private reference").replace(/\s+/g, " ").trim();
  return (normalized || fallback).slice(0, maximum);
}

function normalizeStep(kind: unknown): CertifiedCaseRhythmStepKind | undefined {
  if (kind === "observe" || kind === "organize") return "search";
  if (kind === "review" || kind === "solved" || kind === "review-source") return "review-source";
  if (["join", "search", "question", "challenge", "select-evidence", "submit", "recover"].includes(String(kind))) {
    return kind as CertifiedCaseRhythmStepKind;
  }
  return undefined;
}

function fallbackStep(input: CertifiedCaseRhythmInput, progress: NonNullable<PlayableCaseIntake["progress"]>) {
  if (!input.session) return "join" as const;
  if (input.session.judgement && !input.session.judgement.accepted) return "recover" as const;
  if (input.session.judgement?.accepted) return "review-source" as const;
  if (progress.discoveredEvidence < 1) return "search" as const;
  if (progress.questionedWitnesses < 1) return "question" as const;
  if (progress.challengeHitCount < 1) return "challenge" as const;
  if (progress.selectedTheoryEvidence < 1) return "select-evidence" as const;
  return "submit" as const;
}

function actionKindFor(step: CertifiedCaseRhythmStepKind): InvestigationActionKind {
  if (step === "review-source") return "review";
  return step;
}

function buildStepAction(step: CertifiedCaseRhythmStepKind, input: CertifiedCaseRhythmInput, detail: string): PlayableCaseNextAction {
  if (step === "search" && input.session && input.observedCrimeWindow === false) {
    const definition = getInvestigationActionDefinition("observe");
    return { kind: "observe", label: definition.label, detail, buttonLabel: definition.label };
  }
  const source = input.intake?.nextAction;
  const sourceStep = source ? normalizeStep(source.kind) : undefined;
  const sourceIsStaleObservation = step === "search" && input.observedCrimeWindow === true && source?.kind === "observe";
  if (step !== "recover" && source && sourceStep === step && !sourceIsStaleObservation) {
    return { ...source, label: safeText(source.label, "Continue certified step", 100), detail: safeText(source.detail, detail) };
  }
  const actionKind = actionKindFor(step);
  const definition = getInvestigationActionDefinition(actionKind);
  return {
    kind: step === "review-source" ? "review-source" : step === "recover" ? "submit" : step,
    label: definition.label,
    detail,
    buttonLabel: step === "recover" ? "Open theory repair" : definition.label
  };
}

function stepCopy(step: CertifiedCaseRhythmStepKind, input: CertifiedCaseRhythmInput) {
  if (step === "recover") {
    const label = safeText(input.recoveryGap?.label, "Repair one proof gap", 100);
    const detail = safeText(input.recoveryGap?.detail || input.recoveryAdvice, "Review one visible gap, revise the theory manually, and submit again.");
    return { label, detail, metric: "one safe gap" };
  }
  if (step === "search" && input.session && input.observedCrimeWindow === false) {
    const definition = getInvestigationActionDefinition("observe");
    return { label: definition.label, detail: definition.detail, metric: "case window" };
  }
  const source = input.intake?.nextAction;
  const sourceStep = source ? normalizeStep(source.kind) : undefined;
  const sourceIsStaleObservation = step === "search" && input.observedCrimeWindow === true && source?.kind === "observe";
  if (step === "search" && source && sourceStep === "search" && !sourceIsStaleObservation) {
    return {
      label: safeText(source.label, "Search location", 100),
      detail: safeText(source.detail, "Inspect the certified route location through the existing Search action."),
      metric: "location ready"
    };
  }
  if (step === "search" && input.selectedSceneName) {
    return { label: "Search location", detail: `Focus ${safeText(input.selectedSceneName, "the selected public place", 80)} and use the existing certified Search action.`, metric: "location ready" };
  }
  const definition = getInvestigationActionDefinition(actionKindFor(step));
  const metrics: Record<Exclude<CertifiedCaseRhythmStepKind, "recover">, string> = {
    join: "session pending",
    search: "find route clue",
    question: "hear witness",
    challenge: "test statement",
    "select-evidence": "build proof chain",
    submit: "test theory",
    "review-source": "audit result"
  };
  return { label: definition.label, detail: definition.detail, metric: metrics[step] };
}

function defaultProgress(): NonNullable<PlayableCaseIntake["progress"]> {
  return {
    currentStage: "join",
    discoveredEvidence: 0,
    totalEvidence: 0,
    questionedWitnesses: 0,
    totalWitnesses: 0,
    challengeReadyCount: 0,
    challengeHitCount: 0,
    selectedTheoryEvidence: 0,
    submitReady: false,
    wrongTheorySubmitted: false,
    solved: false
  };
}

/** Pure, low-spoiler presentation projection. It does not validate or execute a case action. */
export function buildCertifiedCaseRhythm(input: CertifiedCaseRhythmInput): CertifiedCaseRhythmViewModel {
  const progress = { ...(input.intake?.progress || defaultProgress()) };
  if (input.theoryEvidenceIds) {
    const discovered = new Set(input.session?.discoveredEvidenceIds || []);
    progress.selectedTheoryEvidence = new Set(input.theoryEvidenceIds.filter((id) => discovered.has(id))).size;
  }
  const accepted = Boolean(input.session?.judgement?.accepted);
  const rejected = Boolean(input.session?.judgement && !accepted);
  const proposed = normalizeStep(input.intake?.nextAction?.kind)
    || normalizeStep(input.intake?.coach?.stage)
    || normalizeStep(progress.currentStage);
  let currentKind = rejected ? "recover" : proposed || fallbackStep(input, progress);
  if (input.theoryEvidenceIds && !accepted && !rejected && (currentKind === "select-evidence" || currentKind === "submit")) {
    currentKind = progress.selectedTheoryEvidence > 0 && progress.submitReady ? "submit" : "select-evidence";
  }
  const status: CertifiedCaseRhythmStatus = !input.intake ? "idle" : rejected ? "recovery"
    : accepted && input.revealAvailable ? "complete" : "active";
  const copy = stepCopy(currentKind, input);
  const action = buildStepAction(currentKind, input, copy.detail);
  const beat = STEP_BEAT[currentKind];
  const fieldDone = progress.discoveredEvidence > 0 && progress.questionedWitnesses > 0 && progress.challengeHitCount > 0;
  const doneByBeat: Record<CertifiedCaseRhythmBeatKind, boolean> = {
    intake: Boolean(input.session),
    fieldwork: fieldDone,
    deduction: accepted,
    review: accepted && input.revealAvailable
  };
  const unlockedByBeat: Record<CertifiedCaseRhythmBeatKind, boolean> = {
    intake: true,
    fieldwork: Boolean(input.session),
    deduction: fieldDone || progress.selectedTheoryEvidence > 0 || rejected,
    review: accepted
  };
  const metrics: Record<CertifiedCaseRhythmBeatKind, string> = {
    intake: input.session ? "joined" : "pending",
    fieldwork: `${Number(progress.discoveredEvidence > 0) + Number(progress.questionedWitnesses > 0) + Number(progress.challengeHitCount > 0)}/3 steps`,
    deduction: accepted ? "accepted" : `${progress.selectedTheoryEvidence} clue(s)`,
    review: input.revealAvailable ? "reviewed" : accepted ? "unlocked" : "locked"
  };
  const beats = (Object.keys(PHASE_LABEL) as CertifiedCaseRhythmBeatKind[]).map((kind) => ({
    kind,
    label: PHASE_LABEL[kind],
    metric: metrics[kind],
    status: doneByBeat[kind] ? "done" as const : kind === beat ? "current" as const : unlockedByBeat[kind] ? "ready" as const : "locked" as const
  }));
  const completedStepCount = Number(Boolean(input.session))
    + Number(progress.discoveredEvidence > 0)
    + Number(progress.questionedWitnesses > 0)
    + Number(progress.challengeHitCount > 0)
    + Number(progress.selectedTheoryEvidence > 0)
    + Number(accepted)
    + Number(accepted && input.revealAvailable);
  const phase = rejected ? "Recovery" : PHASE_LABEL[beat];
  return {
    status,
    currentStep: { kind: currentKind, beat, label: copy.label, detail: copy.detail, metric: copy.metric, action },
    beats,
    completedStepCount,
    totalStepCount: 7,
    progressLabel: `${Math.min(7, completedStepCount)}/7 certified steps`,
    recoveryLabel: rejected ? copy.label : undefined,
    suggestedAction: {
      phase,
      title: copy.label,
      detail: copy.detail,
      targetTab: currentKind === "review-source" ? "logic" : "investigation"
    }
  };
}

export function cloneCertifiedCaseRhythm(model: CertifiedCaseRhythmViewModel): CertifiedCaseRhythmViewModel {
  return {
    ...model,
    currentStep: { ...model.currentStep, action: { ...model.currentStep.action } },
    beats: model.beats.map((beat) => ({ ...beat })),
    suggestedAction: { ...model.suggestedAction }
  };
}

export function evaluateCertifiedCaseRhythmAutomation(samples: readonly CertifiedCaseRhythmAutomationSample[]) {
  const failures: string[] = [];
  for (const sample of samples) {
    if (sample.primaryClicks > CERTIFIED_CASE_RHYTHM_AUTOMATION_BUDGET.maxPrimaryClicksPerStep) failures.push(`${sample.stage}: primary click budget exceeded`);
    if (sample.panelSwitches > CERTIFIED_CASE_RHYTHM_AUTOMATION_BUDGET.maxPanelSwitchesPerStep) failures.push(`${sample.stage}: panel switch budget exceeded`);
    const settleBudget = sample.stage === "question" || sample.stage === "challenge"
      ? CERTIFIED_CASE_RHYTHM_AUTOMATION_BUDGET.maxDialogueStageSettleMs
      : CERTIFIED_CASE_RHYTHM_AUTOMATION_BUDGET.maxStageSettleMs;
    if (sample.settleMs > settleBudget) failures.push(`${sample.stage}: automated settle budget exceeded`);
  }
  return {
    ok: failures.length === 0,
    sampleCount: samples.length,
    maxPrimaryClicks: Math.max(0, ...samples.map((sample) => sample.primaryClicks)),
    maxPanelSwitches: Math.max(0, ...samples.map((sample) => sample.panelSwitches)),
    maxSettleMs: Math.max(0, ...samples.map((sample) => sample.settleMs)),
    failures
  };
}
