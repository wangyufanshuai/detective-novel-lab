import type { StrategicCommandAction, StrategicCommandViewModel } from "./strategic-command-model";
import type { StrategicActionLifecycle } from "./strategic-pacing-model";

export type CampaignBeatPhase =
  | "idle"
  | "action-resolving"
  | "immediate-result"
  | "world-consequence"
  | "next-objective"
  | "dismissed";

export type CampaignBeatKind =
  | "case-opened"
  | "investigation-action-resolved"
  | "world-choice-resolved"
  | "chapter-transition"
  | "finale-ready"
  | "campaign-completed";

export type CampaignTransitionSignal =
  | "none"
  | "case-opened"
  | "chapter-transition"
  | "finale-ready"
  | "campaign-completed";

export type CampaignBeatPresentation = {
  visible: boolean;
  phase: CampaignBeatPhase;
  kind: CampaignBeatKind;
  tone: "focus" | "info" | "warning" | "success";
  signature: string;
  phaseIndex: number;
  phaseLabels: readonly ["Resolve", "Result", "Consequence", "Next"];
  eyebrow: string;
  title: string;
  detail: string;
  supportingDetail: string;
  focusLabel: string;
  benefitLabel: string;
  costLabel: string;
  fairnessLabel: string;
  nextObjective: string;
  hasWorldConsequence: boolean;
  canSkip: boolean;
  canDismiss: boolean;
};

export type CampaignBeatInput = {
  command: StrategicCommandViewModel;
  lifecycle?: StrategicActionLifecycle;
  phase?: CampaignBeatPhase;
  signal?: CampaignTransitionSignal;
  sequence?: number;
};

const RAW_IDENTIFIER_PATTERN = /\b(?:case|npc|event|source|location|institution|resource|evidence|session|world|campaign|character)-[a-z0-9-]*\d[a-z0-9-]*\b/gi;
const PRIVATE_FIELD_PATTERN = /\b(?:culpritId|victimId|hiddenTruth|rawBody|agentSnapshot|checkpoint|sqlite|sessionId|caseId|sourceId|eventId|locationId|institutionId|resourceId)\b/gi;
const ABSOLUTE_PATH_PATTERN = /\b[A-Za-z]:[\\/][^\s]+/g;
const FAIRNESS_FALLBACK = "Truth, evidence coverage, the certified route, judgement, and NPC legal actions remain unchanged.";
const PHASE_LABELS = ["Resolve", "Result", "Consequence", "Next"] as const;
const WORLD_ACTION_KINDS = new Set([
  "campaign-recovery",
  "world-lead",
  "faction-directive",
  "world-event-offer",
  "headquarters",
  "operations",
  "advance-town"
]);

function safeText(value: unknown, fallback: string, maximum = 240) {
  const normalized = String(value || "")
    .replace(RAW_IDENTIFIER_PATTERN, "")
    .replace(PRIVATE_FIELD_PATTERN, "")
    .replace(ABSOLUTE_PATH_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();
  return (normalized || fallback).slice(0, maximum).trim() || fallback;
}

function actionKind(action?: StrategicCommandAction): CampaignBeatKind {
  if (action?.kind === "campaign" || action?.kind === "next-case") return "case-opened";
  if (action && WORLD_ACTION_KINDS.has(action.kind)) return "world-choice-resolved";
  return "investigation-action-resolved";
}

function beatKind(input: CampaignBeatInput): CampaignBeatKind {
  if (input.signal && input.signal !== "none") return input.signal;
  if (input.command.campaignPacing?.status === "settled") return "campaign-completed";
  return actionKind(input.lifecycle?.action);
}

function defaultPhase(input: CampaignBeatInput): CampaignBeatPhase {
  if (input.lifecycle?.state === "resolving" || input.lifecycle?.state === "selected") return "action-resolving";
  if (input.lifecycle?.state === "succeeded" || input.lifecycle?.state === "failed-safe" || input.signal && input.signal !== "none") return "immediate-result";
  return "idle";
}

function tone(input: CampaignBeatInput, phase: CampaignBeatPhase, kind: CampaignBeatKind): CampaignBeatPresentation["tone"] {
  if (input.lifecycle?.state === "failed-safe" || input.command.presentationFeedback.state === "blocked") return "warning";
  if (kind === "campaign-completed" || kind === "finale-ready" || phase === "next-objective") return "success";
  if (phase === "action-resolving") return "focus";
  return "info";
}

function kindLabel(kind: CampaignBeatKind) {
  if (kind === "case-opened") return "Case opened";
  if (kind === "investigation-action-resolved") return "Certified action";
  if (kind === "world-choice-resolved") return "World choice";
  if (kind === "chapter-transition") return "Chapter transition";
  if (kind === "finale-ready") return "Finale ready";
  return "Campaign completed";
}

function phaseIndex(phase: CampaignBeatPhase) {
  if (phase === "action-resolving") return 0;
  if (phase === "immediate-result") return 1;
  if (phase === "world-consequence") return 2;
  if (phase === "next-objective") return 3;
  return -1;
}

function phaseTitle(input: CampaignBeatInput, phase: CampaignBeatPhase, kind: CampaignBeatKind) {
  const action = input.lifecycle?.action;
  if (phase === "action-resolving") return safeText(action?.label, "Resolving the current action");
  if (phase === "immediate-result") {
    if (input.lifecycle?.state === "failed-safe") return "Action returned safely";
    if (kind === "chapter-transition") return safeText(input.command.campaignProgress.chapterLabel, "The next chapter is ready");
    if (kind === "finale-ready") return "The Finale route is ready";
    if (kind === "campaign-completed") return "Campaign route completed";
    return safeText(input.command.outcomeFeedback.immediate.label, "Immediate result");
  }
  if (phase === "world-consequence") return safeText(input.command.worldConsequenceTimeline.headline, "World consequence");
  if (phase === "next-objective") return safeText(input.command.primaryAction?.label || input.command.currentObjective.title, "Next objective");
  return kindLabel(kind);
}

function phaseDetail(input: CampaignBeatInput, phase: CampaignBeatPhase) {
  if (phase === "action-resolving") return safeText(input.lifecycle?.detail, "The existing typed handler is resolving without changing presentation authority.");
  if (phase === "immediate-result") return safeText(input.lifecycle?.detail || input.command.outcomeFeedback.immediate.detail, "The existing command returned a safe visible result.");
  if (phase === "world-consequence") return safeText(input.command.worldConsequenceTimeline.summary || input.command.outcomeFeedback.world.detail, "The public world context remains stable.");
  if (phase === "next-objective") return safeText(input.command.primaryAction?.detail || input.command.outcomeFeedback.next.detail, "Continue with the next legal action.");
  return "";
}

export function campaignBeatSignature(input: CampaignBeatInput) {
  const action = input.lifecycle?.action;
  const campaign = input.command.campaignPacing;
  return [
    input.sequence || 0,
    input.signal || "none",
    action?.kind || "campaign",
    safeText(action?.label, "none", 80),
    input.command.investigationTurn.turnNumber,
    safeText(campaign?.campaignLabel, "campaign", 60),
    safeText(campaign?.chapterLabel || input.command.campaignProgress.chapterLabel, "chapter", 60),
    safeText(campaign?.progressLabel || input.command.campaignProgress.progressLabel, "progress", 60)
  ].join(":");
}

export function campaignProgressSignature(command: StrategicCommandViewModel) {
  const pacing = command.campaignPacing;
  return [
    safeText(pacing?.campaignLabel, "campaign", 60),
    safeText(pacing?.chapterLabel || command.campaignProgress.chapterLabel, "chapter", 60),
    safeText(pacing?.progressLabel || command.campaignProgress.progressLabel, "progress", 60),
    pacing?.status || "active"
  ].join(":");
}

export function campaignTransitionSignal(previous: string | undefined, command: StrategicCommandViewModel): CampaignTransitionSignal {
  const current = campaignProgressSignature(command);
  if (!previous || previous === current) return "none";
  const pacing = command.campaignPacing;
  if (pacing?.status === "settled") return "campaign-completed";
  if (/finale/i.test(pacing?.chapterLabel || command.campaignProgress.chapterLabel)) return "finale-ready";
  const previousParts = previous.split(":");
  const currentParts = current.split(":");
  if (previousParts[0] !== currentParts[0] || previousParts[1] === "chapter") return "case-opened";
  return "chapter-transition";
}

export function nextCampaignBeatPhase(phase: CampaignBeatPhase, hasWorldConsequence: boolean): CampaignBeatPhase {
  if (phase === "action-resolving") return "immediate-result";
  if (phase === "immediate-result") return hasWorldConsequence ? "world-consequence" : "next-objective";
  if (phase === "world-consequence") return "next-objective";
  if (phase === "next-objective") return "dismissed";
  return phase;
}

export function deriveCampaignBeatPresentation(input: CampaignBeatInput): CampaignBeatPresentation {
  const phase = input.phase || defaultPhase(input);
  const kind = beatKind(input);
  const pacing = input.command.campaignPacing;
  const action = input.lifecycle?.action;
  const hasWorldConsequence = input.command.worldConsequenceTimeline.state !== "empty"
    && input.lifecycle?.state !== "failed-safe";
  const fairnessLabel = safeText(pacing?.safeForecast.unchangedAuthority, FAIRNESS_FALLBACK);
  return {
    visible: phase !== "idle" && phase !== "dismissed",
    phase,
    kind,
    tone: tone(input, phase, kind),
    signature: campaignBeatSignature(input),
    phaseIndex: phaseIndex(phase),
    phaseLabels: PHASE_LABELS,
    eyebrow: kindLabel(kind),
    title: phaseTitle(input, phase, kind),
    detail: phaseDetail(input, phase),
    supportingDetail: phase === "world-consequence"
      ? safeText(pacing?.safeForecast.whatChanges, input.command.outcomeFeedback.world.detail)
      : phase === "next-objective"
        ? safeText(pacing?.whyNow, input.command.currentObjective.nextAction)
        : safeText(action?.benefitLabel || input.command.presentationFeedback.label, "Existing authority confirmed"),
    focusLabel: safeText(input.command.selectedContext?.label || pacing?.value.primarySurface || input.command.campaignProgress.chapterLabel, "Public town context", 100),
    benefitLabel: safeText(action?.benefitLabel || input.command.outcomeFeedback.immediate.detail, "The existing route advances.", 180),
    costLabel: safeText(action?.costLabel || pacing?.safeForecast.visibleSurface, "No additional world cost is created by this presentation.", 180),
    fairnessLabel,
    nextObjective: safeText(input.command.primaryAction?.detail || pacing?.nextAction || input.command.currentObjective.nextAction, "Continue the next legal action."),
    hasWorldConsequence,
    canSkip: phase === "immediate-result" || phase === "world-consequence",
    canDismiss: phase === "action-resolving" || phase === "next-objective"
  };
}
