import type {
  StrategicCommandAction,
  StrategicCommandViewModel
} from "./strategic-command-model";

export type CampaignCommandBriefStatus = "ready" | "blocked" | "readonly" | "idle";
export type CampaignCommandBriefFocus = "map" | "character" | "institution" | "investigation" | "world-choice" | "result";

export type CampaignCommandBriefWorldSignal = {
  kind: string;
  label: string;
  state: string;
  detail: string;
};

export type CampaignCommandBrief = {
  runtimeMode: StrategicCommandViewModel["runtimeMode"];
  status: CampaignCommandBriefStatus;
  hierarchy: ["objective", "action", "map", "context"];
  objective: {
    phase: string;
    title: string;
    detail: string;
    progressLabel: string;
  };
  primaryAction?: {
    kind: StrategicCommandAction["kind"];
    target: StrategicCommandAction["target"];
    label: string;
    detail: string;
    benefitLabel: string;
    costLabel: string;
    blocking: boolean;
  };
  whyNow: string;
  whatChanges: string;
  nextAction: string;
  focus: {
    target: CampaignCommandBriefFocus;
    label: string;
    detail: string;
  };
  context: {
    state: "focused" | "available" | "empty";
    label: string;
    detail: string;
  };
  world: {
    state: string;
    headline: string;
    signalCount: number;
    signals: CampaignCommandBriefWorldSignal[];
  };
  transition: {
    state: "idle" | "resolving" | "result" | "blocked";
    label: string;
    detail: string;
  };
  safeBoundary: string;
};

type CampaignCommandBriefInput = {
  command: StrategicCommandViewModel;
};

const RAW_IDENTIFIER_PATTERN = /\b(?:case|npc|event|source|location|institution|resource|evidence|scene|session|world|campaign|package)-[a-z0-9-]*\d[a-z0-9-]*\b/gi;
const PRIVATE_FIELD_PATTERN = /\b(?:culpritId|victimId|hiddenTruth|rawBody|agentSnapshot|checkpoint|sqlite|sessionId|caseId|sourceId|eventId|npcId|locationId|institutionId|resourceId|selectedAnswer|playerText)\b/gi;
const ABSOLUTE_PATH_PATTERN = /(?:[A-Za-z]:[\\/]|\/(?:Users|home|tmp|var)\/)[^\s,;]*/gi;
const FIXED_AUTHORITY_BOUNDARY = "Case truth, evidence coverage, the certified route, judgement, and NPC legal actions remain unchanged.";
const WORLD_DECISION_KINDS = new Set<StrategicCommandAction["kind"]>([
  "campaign-recovery",
  "world-lead",
  "faction-directive",
  "world-event-offer",
  "headquarters",
  "operations",
  "outcome-review"
]);

function safeText(value: unknown, fallback: string, maximum = 220) {
  const normalized = String(value || "")
    .replace(ABSOLUTE_PATH_PATTERN, "")
    .replace(RAW_IDENTIFIER_PATTERN, "")
    .replace(PRIVATE_FIELD_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();
  return (normalized || fallback).slice(0, maximum).trim() || fallback;
}

function focusTarget(command: StrategicCommandViewModel, action?: StrategicCommandAction): CampaignCommandBriefFocus {
  if (action?.kind === "outcome-review" || action?.target === "review-outcome") return "result";
  if (action?.target === "show-world-choice") return "world-choice";
  if (action?.target === "show-headquarters" || action?.target === "show-operations") return "institution";
  if (command.selectedContext?.kind === "actor") return "character";
  if (command.selectedContext?.kind === "institution") return "institution";
  if (command.selectedContext) return "investigation";
  return "map";
}

function transitionState(command: StrategicCommandViewModel): CampaignCommandBrief["transition"]["state"] {
  const state = command.presentationFeedback.state;
  if (state === "resolving") return "resolving";
  if (state === "blocked") return "blocked";
  if (state === "updated" || state === "completed") return "result";
  return "idle";
}

function commandStatus(command: StrategicCommandViewModel, primary?: StrategicCommandAction): CampaignCommandBriefStatus {
  if (command.runtimeMode === "static-demo") return "readonly";
  if (primary?.enabled) return "ready";
  if (command.advanceState.state === "blocked") return "blocked";
  return "idle";
}

function worldSignals(command: StrategicCommandViewModel) {
  const signals: CampaignCommandBriefWorldSignal[] = command.worldConsequenceTimeline.beats
    .filter((beat) => beat.state !== "inactive")
    .map((beat) => ({
      kind: beat.kind,
      label: safeText(beat.title, "World context", 72),
      state: safeText(beat.state, "active", 32),
      detail: safeText(beat.summary, "A bounded public-world signal is visible.", 180)
    }));
  const seen = new Set(signals.map((signal) => signal.kind));
  for (const decision of command.decisionQueue) {
    if (!WORLD_DECISION_KINDS.has(decision.kind) || seen.has(decision.kind)) continue;
    seen.add(decision.kind);
    signals.push({
      kind: decision.kind,
      label: safeText(decision.label, "World decision", 72),
      state: decision.enabled ? "ready" : "held",
      detail: safeText(decision.disabledReason || decision.detail, "Review the public world context.", 180)
    });
  }
  return signals.slice(0, 6);
}

/**
 * Canonical public-safe Campaign brief. It owns presentation hierarchy only:
 * no request, command execution, storage, tick, event, or case authority.
 */
export function buildCampaignCommandBrief({ command }: CampaignCommandBriefInput): CampaignCommandBrief {
  const primary = command.primaryAction?.enabled ? command.primaryAction : undefined;
  const target = focusTarget(command, primary);
  const signals = worldSignals(command);
  const campaignWhyNow = command.campaignPacing?.whyNow;
  const objectiveFallback = "Continue the current certified investigation step.";
  const contextLabel = command.selectedContext?.label;
  const transition = transitionState(command);
  return {
    runtimeMode: command.runtimeMode,
    status: commandStatus(command, primary),
    hierarchy: ["objective", "action", "map", "context"],
    objective: {
      phase: safeText(command.currentObjective.phase, "Brief", 32),
      title: safeText(command.currentObjective.title, "Continue the investigation", 100),
      detail: safeText(command.currentObjective.detail, objectiveFallback, 240),
      progressLabel: safeText(command.currentObjective.progressLabel || command.campaignProgress.progressLabel, "Campaign opening", 100)
    },
    primaryAction: primary ? {
      kind: primary.kind,
      target: primary.target,
      label: safeText(primary.label, "Continue", 84),
      detail: safeText(primary.detail, objectiveFallback, 220),
      benefitLabel: safeText(primary.benefitLabel, command.outcomeFeedback.immediate.detail, 180),
      costLabel: safeText(primary.costLabel, command.advanceState.detail, 180),
      blocking: primary.blocking
    } : undefined,
    whyNow: safeText(
      primary?.kind === "certified-investigation" ? primary.detail : campaignWhyNow || primary?.detail,
      command.currentObjective.nextAction || objectiveFallback,
      220
    ),
    whatChanges: safeText(
      command.campaignPacing?.safeForecast.whatChanges || command.outcomeFeedback.world.detail,
      "The visible public context updates while the certified case remains frozen.",
      220
    ),
    nextAction: safeText(
      command.outcomeFeedback.next.detail || command.campaignPacing?.nextAction || command.currentObjective.nextAction,
      objectiveFallback,
      220
    ),
    focus: {
      target,
      label: safeText(contextLabel || command.campaignPacing?.value.primarySurface || command.campaignProgress.chapterLabel, "Town map", 100),
      detail: safeText(primary?.detail || command.currentObjective.nextAction, "Select a public map context for the next legal action.", 180)
    },
    context: {
      state: command.selectedContext ? "focused" : command.decisionQueue.length ? "available" : "empty",
      label: safeText(contextLabel, "Context Rail", 100),
      detail: safeText(
        command.selectedContext?.detail,
        "Resources, world consequences, Journal, Replay, and case detail remain available on request.",
        220
      )
    },
    world: {
      state: safeText(command.worldConsequenceTimeline.state, "empty", 32),
      headline: safeText(command.worldConsequenceTimeline.headline, "World state stable", 100),
      signalCount: signals.length,
      signals
    },
    transition: {
      state: transition,
      label: safeText(command.presentationFeedback.label, transition === "idle" ? "No result transition" : "Campaign result", 100),
      detail: safeText(command.presentationFeedback.detail, command.outcomeFeedback.next.detail, 180)
    },
    safeBoundary: safeText(command.campaignPacing?.safeForecast.unchangedAuthority, FIXED_AUTHORITY_BOUNDARY, 220)
  };
}
