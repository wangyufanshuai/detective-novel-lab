import type { CampaignCommandBrief } from "./campaign-command-brief-model";
import type { CampaignRecoverySummary } from "./world-campaign-types";
import type { CertifiedCaseRhythmViewModel } from "./certified-case-rhythm-model";
import type { GapCard, SourceReviewUnlockSummary } from "./investigation-workspace-model";
import type {
  CaseProofCoverage,
  CaseRouteCertificate,
  CaseTruthLedger,
  DeductionCase,
  Evidence,
  EvidenceNotebookItem,
  PlayableCaseIntake,
  PlayerSession,
  PlayerTheory,
  ProofTourStep,
  TestimonyRecord
} from "@/lib/engine";

export type FinalDetectiveWorkspaceStage =
  | "intake"
  | "evidence-testimony"
  | "contradiction"
  | "theory"
  | "recovery"
  | "source-review"
  | "resolved";

export type FinalDetectiveWorkspaceActionKind =
  | "join"
  | "search"
  | "question"
  | "challenge"
  | "select-evidence"
  | "submit"
  | "recover"
  | "review-source";

export type FinalDetectiveEvidenceRow = {
  key: string;
  sourceIndex: number;
  title: string;
  description: string;
  provenanceLabel: string;
  state: "locked" | "discovered" | "selected";
  current: boolean;
  supportLabels: string[];
  contradictionLabels: string[];
  actions: Array<"focus-source" | "prepare-challenge" | "add-theory" | "remove-theory">;
};

export type FinalDetectiveTestimonyRow = {
  key: string;
  characterIndex: number;
  actorName: string;
  roleLabel: string;
  state: "unasked" | "recorded" | "contradicted";
  statement: string;
  selected: boolean;
  evidenceLabels: string[];
  contradictionLabels: string[];
};

export type FinalDetectiveContradictionRow = {
  key: string;
  label: string;
  detail: string;
  state: "ready" | "exposed";
};

export type FinalDetectiveSourceReviewRow = {
  key: string;
  category: "source" | "obligation" | "route" | "conclusion";
  state: "covered" | "open" | "complete";
  label: string;
  detail: string;
};

export type FinalDetectiveWorkspace = {
  runtimeMode: "static-demo" | "server";
  stage: FinalDetectiveWorkspaceStage;
  hierarchy: ["objective", "task", "workspace", "theory", "resolution"];
  objective: {
    phase: string;
    title: string;
    detail: string;
    progressLabel: string;
  };
  currentTask: {
    label: string;
    detail: string;
    metric: string;
    nextAction: string;
    action: {
      kind: FinalDetectiveWorkspaceActionKind;
      label: string;
      enabled: boolean;
      disabledReason: string;
    };
  };
  progress: Array<{
    key: "intake" | "fieldwork" | "deduction" | "review";
    label: string;
    metric: string;
    state: "done" | "current" | "ready" | "locked";
  }>;
  evidence: {
    discoveredCount: number;
    selectedCount: number;
    totalCount: number;
    rows: FinalDetectiveEvidenceRow[];
  };
  testimony: {
    questionedCount: number;
    contradictionCount: number;
    totalCount: number;
    rows: FinalDetectiveTestimonyRow[];
  };
  contradictions: FinalDetectiveContradictionRow[];
  activeContext: {
    locationLabel: string;
    actorLabel: string;
    testimonyLabel: string;
    scopeLabel: string;
  };
  theory: {
    state: "incomplete" | "ready" | "rejected" | "accepted";
    statusLabel: string;
    suspectComplete: boolean;
    motiveComplete: boolean;
    methodComplete: boolean;
    evidenceComplete: boolean;
    selectedEvidenceCount: number;
    selectedEvidenceLabels: string[];
    missingCategories: string[];
  };
  recovery: {
    state: "empty" | "ready" | "scheduled" | "completed";
    label: string;
    detail: string;
    costLabel: string;
    nextAction: string;
  };
  sourceReview: {
    state: "locked" | "unlocked" | "reviewed";
    statusLabel: string;
    sourceCount: number;
    coveredObligations: number;
    totalObligations: number;
    rows: FinalDetectiveSourceReviewRow[];
  };
  authorityNote: string;
};

export type FinalDetectiveWorkspaceInput = {
  runtimeMode: "static-demo" | "server";
  commandBrief?: CampaignCommandBrief | null;
  rhythm?: CertifiedCaseRhythmViewModel | null;
  playableIntake?: PlayableCaseIntake | null;
  session: PlayerSession | null;
  notebookItems: readonly EvidenceNotebookItem[];
  discoveredEvidence: readonly Evidence[];
  characters: DeductionCase["characters"];
  testimonies: readonly TestimonyRecord[];
  theory: PlayerTheory;
  selectedCharacterId?: string;
  selectedEvidenceId?: string;
  selectedSceneName?: string;
  promptSafe?: boolean;
  memoryCount?: number;
  evidenceImpacts?: ReadonlyMap<string, { label: string; detail: string }>;
  gapCards?: readonly GapCard[];
  nextStepAdvice?: string;
  campaignRecovery?: CampaignRecoverySummary | null;
  sourceReviewUnlock?: SourceReviewUnlockSummary | null;
  proofLedger?: CaseTruthLedger | null;
  proofCoverage?: CaseProofCoverage | null;
  routeCertificate?: CaseRouteCertificate | null;
  proofTourSteps?: readonly ProofTourStep[];
  revealAvailable?: boolean;
};

const AUTHORITY_NOTE = "Case truth, evidence coverage, the certified route, judgement, and NPC legal actions remain unchanged.";
const RAW_IDENTIFIER_PATTERN = /\b(?:case|npc|event|source|location|institution|resource|evidence|scene|session|world|campaign|package|character)-[a-z0-9-]*\d[a-z0-9-]*\b/gi;
const PRIVATE_FIELD_PATTERN = /\b(?:culpritId|victimId|hiddenTruth|rawBody|agentSnapshot|checkpoint|sqlite|sessionId|caseId|sourceId|eventId|npcId|locationId|institutionId|resourceId|selectedAnswer|playerText)\b/gi;
const ABSOLUTE_PATH_PATTERN = /(?:[A-Za-z]:[\\/]|\/(?:Users|home|tmp|var)\/)[^\s,;]*/gi;

function safeText(value: unknown, fallback: string, maximum = 220) {
  const normalized = String(value || "")
    .replace(ABSOLUTE_PATH_PATTERN, "")
    .replace(RAW_IDENTIFIER_PATTERN, "private reference")
    .replace(PRIVATE_FIELD_PATTERN, "private field")
    .replace(/\s+/g, " ")
    .trim();
  return (normalized || fallback).slice(0, maximum).trim() || fallback;
}

function safeList(values: readonly unknown[] | undefined, maximum = 3) {
  const result: string[] = [];
  for (const value of values || []) {
    const next = safeText(value, "", 120);
    if (next && !result.includes(next)) result.push(next);
    if (result.length === maximum) break;
  }
  return result;
}

function stableKey(parts: readonly unknown[]) {
  let hash = 2166136261;
  for (const character of parts.map((part) => String(part || "")).join("\u241f")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `workspace-row-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function uniqueRows<T extends { key: string }>(rows: readonly T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.key)) return false;
    seen.add(row.key);
    return true;
  });
}

function stageFor(input: FinalDetectiveWorkspaceInput): FinalDetectiveWorkspaceStage {
  if (!input.session) return "intake";
  if (input.session.judgement && !input.session.judgement.accepted) return "recovery";
  if (input.session.judgement?.accepted) return input.revealAvailable ? "resolved" : "source-review";
  const step = input.rhythm?.currentStep.kind;
  if (step === "join") return "intake";
  if (step === "search" || step === "question") return "evidence-testimony";
  if (step === "challenge") return "contradiction";
  if (step === "select-evidence" || step === "submit" || step === "recover") return step === "recover" ? "recovery" : "theory";
  return "source-review";
}

function actionKindFor(input: FinalDetectiveWorkspaceInput, stage: FinalDetectiveWorkspaceStage): FinalDetectiveWorkspaceActionKind {
  if (stage === "recovery") {
    return input.runtimeMode === "server" && input.campaignRecovery?.status === "ready" ? "recover" : "submit";
  }
  if (stage === "source-review" || stage === "resolved") return "review-source";
  const step = input.rhythm?.currentStep.kind;
  if (step && step !== "recover") return step;
  return input.session ? "search" : "join";
}

function actionEnabled(input: FinalDetectiveWorkspaceInput, kind: FinalDetectiveWorkspaceActionKind) {
  if (kind === "join") return Boolean(input.playableIntake && !input.session);
  if (kind === "recover") return Boolean(input.session?.judgement && !input.session.judgement.accepted);
  if (kind === "review-source") return Boolean(input.session?.judgement?.accepted);
  return Boolean(input.session);
}

function evidenceRows(input: FinalDetectiveWorkspaceInput): FinalDetectiveEvidenceRow[] {
  const selected = new Set(input.theory.evidenceIds);
  return input.notebookItems.map((item, sourceIndex) => {
    const state = item.discovered ? selected.has(item.evidenceId) ? "selected" as const : "discovered" as const : "locked" as const;
    const impact = input.evidenceImpacts?.get(item.evidenceId);
    const description = state === "locked"
      ? safeText(item.useHint, "Search the public location to discover this clue.", 180)
      : safeText(impact ? `${impact.label}: ${impact.detail}` : item.useHint, "Use this discovered clue in the certified route.", 180);
    const actions: FinalDetectiveEvidenceRow["actions"] = ["focus-source"];
    if (item.discovered && item.challengeNpcIds.length) actions.push("prepare-challenge");
    if (item.discovered) actions.push(selected.has(item.evidenceId) ? "remove-theory" : "add-theory");
    return {
      key: stableKey(["clue", sourceIndex, item.discovered ? item.title : item.locationName]),
      sourceIndex,
      title: item.discovered ? safeText(item.title, "Discovered clue", 100) : "Undiscovered clue",
      description,
      provenanceLabel: safeText(
        item.discovered ? `${item.locationName} / ${item.sourceEventLabel || "public scene source"}` : item.locationName,
        "Public location",
        140
      ),
      state,
      current: item.evidenceId === input.selectedEvidenceId,
      supportLabels: item.discovered ? safeList(item.supports) : [],
      contradictionLabels: item.discovered ? safeList(item.contradicts) : [],
      actions
    };
  });
}

function testimonyRows(input: FinalDetectiveWorkspaceInput): FinalDetectiveTestimonyRow[] {
  const discoveredTitles = new Map(input.discoveredEvidence.map((item) => [item.id, safeText(item.title, "Discovered clue", 100)]));
  const questioned = new Set(input.session?.interrogationLog.map((entry) => entry.characterId) || []);
  const challenged = new Set(input.session?.interrogationLog.filter((entry) => entry.challenge?.hit).map((entry) => entry.characterId) || []);
  return input.testimonies.flatMap((record) => {
    const characterIndex = input.characters.findIndex((character) => character.id === record.characterId);
    if (characterIndex < 0) return [];
    const character = input.characters[characterIndex];
    const wasQuestioned = questioned.has(record.characterId);
    const wasChallenged = challenged.has(record.characterId) || record.exposedContradictions.length > 0;
    const evidenceLabels = safeList(
      input.session?.interrogationLog
        .filter((entry) => entry.characterId === record.characterId && entry.evidenceId && discoveredTitles.has(entry.evidenceId))
        .map((entry) => discoveredTitles.get(entry.evidenceId as string)) || []
    );
    return [{
      key: stableKey(["witness", characterIndex, character.name]),
      characterIndex,
      actorName: safeText(character.name, "Witness", 80),
      roleLabel: safeText(character.role, "Public witness", 80),
      state: wasChallenged ? "contradicted" as const : wasQuestioned ? "recorded" as const : "unasked" as const,
      statement: wasQuestioned
        ? safeText(record.currentStatement, "The witness gave a public statement.", 220)
        : "Question this witness to record a public statement.",
      selected: record.characterId === input.selectedCharacterId,
      evidenceLabels,
      contradictionLabels: wasChallenged ? safeList(record.exposedContradictions) : []
    }];
  });
}

function contradictionRows(evidence: readonly FinalDetectiveEvidenceRow[], testimony: readonly FinalDetectiveTestimonyRow[]) {
  const rows: FinalDetectiveContradictionRow[] = [];
  for (const item of evidence) {
    for (const label of item.contradictionLabels) {
      rows.push({ key: stableKey(["contradiction", item.title, label]), label, detail: `${item.title} can test this public claim.`, state: "ready" });
    }
  }
  for (const item of testimony) {
    for (const label of item.contradictionLabels) {
      rows.unshift({ key: stableKey(["exposed", item.actorName, label]), label, detail: `${item.actorName}'s public statement changed after a certified challenge.`, state: "exposed" });
    }
  }
  return uniqueRows(rows);
}

function theorySummary(input: FinalDetectiveWorkspaceInput, evidence: readonly FinalDetectiveEvidenceRow[]): FinalDetectiveWorkspace["theory"] {
  const accepted = Boolean(input.session?.judgement?.accepted);
  const rejected = Boolean(input.session?.judgement && !accepted);
  const suspectComplete = Boolean(input.theory.culpritId);
  const motiveComplete = Boolean(input.theory.motive.trim());
  const methodComplete = Boolean(input.theory.method.trim());
  const selectedEvidence = evidence.filter((item) => item.state === "selected");
  const evidenceComplete = selectedEvidence.length > 0;
  const routeReady = input.playableIntake?.progress?.submitReady ?? evidenceComplete;
  const ready = suspectComplete && motiveComplete && methodComplete && evidenceComplete && routeReady;
  const missingCategories = [
    ...(!suspectComplete ? ["Suspect hypothesis"] : []),
    ...(!motiveComplete ? ["Motive explanation"] : []),
    ...(!methodComplete ? ["Method explanation"] : []),
    ...(!evidenceComplete ? ["Selected evidence chain"] : []),
    ...(rejected ? (input.session?.judgement?.proofCoverage?.gaps || []).map((gap) => `${gap.kind}: ${gap.label}`) : [])
  ];
  const state = accepted ? "accepted" as const : rejected ? "rejected" as const : ready ? "ready" as const : "incomplete" as const;
  const statusLabel = state === "accepted" ? "Theory accepted" : state === "rejected" ? "Recovery required" : state === "ready" ? "Ready to submit" : "Draft incomplete";
  return {
    state,
    statusLabel,
    suspectComplete,
    motiveComplete,
    methodComplete,
    evidenceComplete,
    selectedEvidenceCount: selectedEvidence.length,
    selectedEvidenceLabels: selectedEvidence.map((item) => item.title),
    missingCategories: safeList(missingCategories, 8)
  };
}

function recoverySummary(input: FinalDetectiveWorkspaceInput): FinalDetectiveWorkspace["recovery"] {
  if (!input.session?.judgement || input.session.judgement.accepted) {
    return { state: "empty", label: "No recovery required", detail: "Submit a theory to test the current proof chain.", costLabel: "No recovery cost", nextAction: input.commandBrief?.nextAction || "Continue the current certified step." };
  }
  const campaign = input.campaignRecovery;
  const gap = input.gapCards?.[0];
  const state = campaign && campaign.status !== "empty" ? campaign.status : "ready";
  return {
    state,
    label: safeText(campaign?.recoveryActionLabel || gap?.label, "Repair one public proof gap", 100),
    detail: safeText(campaign?.failureLabel || gap?.detail || input.nextStepAdvice, "Review one visible gap, revise the theory manually, and submit again."),
    costLabel: safeText(campaign?.costLabel, "No hidden evidence or automatic answer is granted.", 180),
    nextAction: safeText(campaign?.nextAction || input.commandBrief?.nextAction, "Return to the visible evidence chain and revise one incomplete field.", 200)
  };
}

function sourceReviewSummary(input: FinalDetectiveWorkspaceInput): FinalDetectiveWorkspace["sourceReview"] {
  const unlocked = Boolean(input.sourceReviewUnlock?.unlocked || input.session?.judgement?.accepted);
  if (!unlocked) {
    return {
      state: "locked",
      statusLabel: "Accepted theory required",
      sourceCount: input.sourceReviewUnlock?.sourceEventCount || 0,
      coveredObligations: input.sourceReviewUnlock?.coveredObligations || 0,
      totalObligations: input.sourceReviewUnlock?.totalObligations || 0,
      rows: []
    };
  }
  const rows: FinalDetectiveSourceReviewRow[] = [];
  for (const [index, item] of (input.playableIntake?.sourceTrail || []).filter((item) => !item.hidden).entries()) {
    rows.push({ key: stableKey(["trail", index, item.label]), category: "source", state: "complete", label: safeText(item.label, "Public source trail", 100), detail: safeText(item.detail, "A public source supports the certified route.", 180) });
  }
  const covered = new Set(input.proofCoverage?.coveredObligationIds || []);
  for (const [index, item] of (input.proofLedger?.obligations || []).filter((item) => item.required).entries()) {
    rows.push({ key: stableKey(["obligation", index, item.lowSpoilerLabel]), category: "obligation", state: covered.has(item.id) ? "covered" : "open", label: safeText(item.lowSpoilerLabel, `${item.kind} obligation`, 100), detail: safeText(item.lowSpoilerDetail, "Review the public proof obligation.", 180) });
  }
  for (const [index, step] of (input.routeCertificate?.steps || []).entries()) {
    rows.push({ key: stableKey(["route", index, step.lowSpoilerLabel]), category: "route", state: step.complete ? "complete" : "open", label: safeText(step.lowSpoilerLabel, "Certified route step", 100), detail: safeText(step.lowSpoilerDetail, "Review the completed certified route step.", 180) });
  }
  for (const [index, step] of (input.proofTourSteps || []).filter((step) => !step.locked).entries()) {
    rows.push({ key: stableKey(["conclusion", index, step.title]), category: "conclusion", state: step.complete ? "complete" : "open", label: safeText(step.title, "Conclusion review", 100), detail: safeText(step.detail, "Review the safe conclusion path.", 180) });
  }
  return {
    state: input.revealAvailable ? "reviewed" : "unlocked",
    statusLabel: input.revealAvailable ? "Source review completed" : "Source review unlocked",
    sourceCount: input.sourceReviewUnlock?.sourceEventCount || rows.filter((row) => row.category === "source").length,
    coveredObligations: input.sourceReviewUnlock?.coveredObligations || covered.size,
    totalObligations: input.sourceReviewUnlock?.totalObligations || input.proofLedger?.obligations.filter((item) => item.required).length || 0,
    rows: uniqueRows(rows)
  };
}

/** Pure, request-free projection for the final player investigation workspace. */
export function buildFinalDetectiveWorkspace(input: FinalDetectiveWorkspaceInput): FinalDetectiveWorkspace {
  const stage = stageFor(input);
  const actionKind = actionKindFor(input, stage);
  const enabled = actionEnabled(input, actionKind);
  const evidence = evidenceRows(input);
  const testimony = testimonyRows(input);
  const theory = theorySummary(input, evidence);
  const recovery = recoverySummary(input);
  const sourceReview = sourceReviewSummary(input);
  const selectedTestimony = testimony.find((item) => item.selected);
  const brief = input.commandBrief;
  const actionLabel = actionKind === "recover"
    ? recovery.label
    : stage === "recovery" && actionKind === "submit"
      ? "Submit revised theory"
    : actionKind === "review-source"
      ? sourceReview.state === "reviewed" ? "Review source record" : "Open Source Review"
      : safeText(input.rhythm?.currentStep.action.buttonLabel || input.rhythm?.currentStep.label, "Continue certified step", 100);
  return {
    runtimeMode: input.runtimeMode,
    stage,
    hierarchy: ["objective", "task", "workspace", "theory", "resolution"],
    objective: {
      phase: safeText(brief?.objective.phase, "Investigation", 40),
      title: safeText(brief?.objective.title || input.playableIntake?.readiness.summary, "Complete the certified investigation", 110),
      detail: safeText(brief?.objective.detail, "Follow the visible evidence route without changing case authority.", 220),
      progressLabel: safeText(input.rhythm?.progressLabel || brief?.objective.progressLabel, "0/7 certified steps", 100)
    },
    currentTask: {
      label: actionKind === "recover" ? recovery.label : safeText(input.rhythm?.currentStep.label, actionLabel, 100),
      detail: safeText(brief?.nextAction || input.rhythm?.currentStep.detail, "Continue the next legal certified action.", 220),
      metric: safeText(input.rhythm?.currentStep.metric, input.rhythm?.progressLabel || "certified route", 100),
      nextAction: safeText(brief?.nextAction, input.rhythm?.currentStep.detail || "Continue the next legal certified action.", 220),
      action: {
        kind: actionKind,
        label: actionLabel,
        enabled,
        disabledReason: enabled ? "" : actionKind === "join" ? "A case intake is required before joining." : "Join the investigation before using this certified action."
      }
    },
    progress: (input.rhythm?.beats || []).map((beat) => ({ key: beat.kind, label: safeText(beat.label, beat.kind, 60), metric: safeText(beat.metric, "pending", 80), state: beat.status })),
    evidence: { discoveredCount: evidence.filter((item) => item.state !== "locked").length, selectedCount: evidence.filter((item) => item.state === "selected").length, totalCount: evidence.length, rows: evidence },
    testimony: { questionedCount: testimony.filter((item) => item.state !== "unasked").length, contradictionCount: testimony.filter((item) => item.state === "contradicted").length, totalCount: testimony.length, rows: testimony },
    contradictions: contradictionRows(evidence, testimony),
    activeContext: {
      locationLabel: safeText(input.selectedSceneName, "Select a public location", 100),
      actorLabel: selectedTestimony?.actorName || "Select a witness",
      testimonyLabel: selectedTestimony?.statement || "Question a witness to establish a public statement.",
      scopeLabel: input.promptSafe === false
        ? "Prompt scope needs review before questioning."
        : `${Math.max(0, input.memoryCount || 0)} memory record(s) and ${input.discoveredEvidence.length} discovered clue(s) are in the visible scope.`
    },
    theory,
    recovery,
    sourceReview,
    authorityNote: safeText(brief?.safeBoundary, AUTHORITY_NOTE, 240)
  };
}
