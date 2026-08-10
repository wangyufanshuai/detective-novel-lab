import {
  listAuthoredCampaignCaseDefinitions,
  listDetectiveCampaignDefinitions,
  type AuthoredCampaignCaseDefinition,
  type CampaignSessionPublicSummary,
  type DetectiveCampaignDefinition,
  type DetectiveCampaignRouteDefinition
} from "@/lib/engine";

export type CampaignPacingStatus = "opening" | "active" | "waiting-choice" | "advancing" | "settled";

export type CampaignPacingSignalKind = "lead" | "arc" | "directive" | "pressure" | "offer" | "recovery" | "headquarters" | "reaction";

export type CampaignPacingSource = {
  kind?: CampaignPacingSignalKind;
  status?: string;
  label?: string;
  detail?: string;
  nextAction?: string;
  benefitLabel?: string;
  costLabel?: string;
  headline?: string;
  summary?: string;
};

export type CampaignPacingValueEntry = {
  campaignLabel: string;
  routeLabel: string;
  chapterLabel: string;
  chapterOrdinal: 1 | 2 | 3;
  publicHook: string;
  primarySurface: string;
  consequenceLabel: string;
  whyNow: string;
  whatChanges: string;
  nextCaseHint: string;
  replayContrast: string;
  leadFocusLabel: "Search" | "Question" | "Challenge";
};

export type CampaignPacingAction = {
  kind: "current-objective" | "world-context" | "next-case" | "fairness";
  label: string;
  detail: string;
  enabled: boolean;
  primary?: boolean;
};

export type CampaignPacingViewModel = {
  status: CampaignPacingStatus;
  campaignLabel: string;
  chapterLabel: string;
  progressLabel: string;
  currentObjective: {
    label: string;
    detail: string;
  };
  whyNow: string;
  prerequisiteLabel: string;
  nextAction: string;
  value: CampaignPacingValueEntry;
  safeForecast: {
    whatChanges: string;
    visibleSurface: string;
    unchangedAuthority: string;
  };
  primaryAction?: CampaignPacingAction;
  secondaryActions: CampaignPacingAction[];
  disclosure: {
    essential: Array<"current-objective" | "why-now" | "next-action">;
    context: Array<"what-changes" | "public-surface" | "next-case">;
    detail: Array<"fairness-boundary" | "replay-contrast">;
  };
};

export type CampaignPacingInput = {
  runtimeMode: "static-demo" | "server";
  campaign?: CampaignSessionPublicSummary | null;
  currentAction?: CampaignPacingSource | null;
  signals?: readonly CampaignPacingSource[];
  consequence?: CampaignPacingSource | null;
  hasCase?: boolean;
  judgementAccepted?: boolean;
  busy?: boolean;
};

const RAW_IDENTIFIER_PATTERN = /\b(?:case|npc|event|source|location|institution|resource|evidence|session|world|campaign|package)-[a-z0-9-]*\d[a-z0-9-]*\b/gi;
const PRIVATE_FIELD_PATTERN = /\b(?:culpritId|victimId|hiddenTruth|rawBody|agentSnapshot|checkpoint|sqlite|sessionId|caseId|sourceId|eventId|locationId|institutionId|resourceId)\b/gi;
const FIXED_AUTHORITY_BOUNDARY = "Case truth, evidence coverage, the certified route, judgement, and NPC legal actions remain unchanged.";
const DEFAULT_REPLAY = "Replay with another fair strategy route; no hidden answer is revealed by pacing.";
const SIGNAL_PRIORITY: CampaignPacingSignalKind[] = ["recovery", "headquarters", "lead", "directive", "offer", "pressure", "reaction", "arc"];
const WAITING_STATUSES = new Set(["ready", "pending", "offered", "blocked", "choice"]);
const ADVANCING_STATUSES = new Set(["scheduled", "running", "active", "prepared"]);

function safeText(value: unknown, fallback: string, maximum = 220) {
  const normalized = String(value || "")
    .replace(RAW_IDENTIFIER_PATTERN, "")
    .replace(PRIVATE_FIELD_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();
  return (normalized || fallback).slice(0, maximum).trim() || fallback;
}

function focusLabel(focus: AuthoredCampaignCaseDefinition["leadFocus"]): CampaignPacingValueEntry["leadFocusLabel"] {
  return focus === "question" ? "Question" : focus === "challenge" ? "Challenge" : "Search";
}

function authoredCaseFor(definition: DetectiveCampaignDefinition, route: DetectiveCampaignRouteDefinition, ordinal: 1 | 2 | 3) {
  return listAuthoredCampaignCaseDefinitions().find((item) => item.campaignId === definition.id && item.routeId === route.id && item.ordinal === ordinal);
}

function nextHint(definition: DetectiveCampaignDefinition, route: DetectiveCampaignRouteDefinition, authored: AuthoredCampaignCaseDefinition | undefined, ordinal: 1 | 2 | 3) {
  const next = ordinal < 3 ? authoredCaseFor(definition, route, (ordinal + 1) as 1 | 2 | 3) : undefined;
  if (next) return safeText(`The next chapter follows the public consequence: ${next.causalBridge}`, "The next chapter follows the visible town consequence.");
  return safeText(`The campaign closes through ${route.finaleLabel}; the other authored route remains fair.`, "The campaign closes through its public Finale.");
}

function matrixEntry(definition: DetectiveCampaignDefinition, route: DetectiveCampaignRouteDefinition, chapterOrdinal: 1 | 2 | 3): CampaignPacingValueEntry {
  const chapter = route.chapters[chapterOrdinal - 1];
  const authored = authoredCaseFor(definition, route, chapterOrdinal);
  const primarySurface = safeText(chapter.worldSurfaceLabel, "public town surface", 100);
  return {
    campaignLabel: safeText(definition.label, "Detective Campaign", 72),
    routeLabel: safeText(route.label, "Authored route", 72),
    chapterLabel: safeText(chapter.label, `Chapter ${chapterOrdinal}`, 72),
    chapterOrdinal,
    publicHook: safeText(authored?.publicPremise, chapter.objectiveLabel, 240),
    primarySurface,
    consequenceLabel: safeText(authored?.aftermathLabel, `${primarySurface} context carries forward.`, 160),
    whyNow: safeText(authored?.causalBridge, chapter.objectiveLabel, 240),
    whatChanges: safeText(authored?.occupationalPressure, `${primarySurface} becomes the visible campaign context.`, 220),
    nextCaseHint: nextHint(definition, route, authored, chapterOrdinal),
    replayContrast: safeText(route.replayContrast, DEFAULT_REPLAY, 220),
    leadFocusLabel: focusLabel(authored?.leadFocus || "search")
  };
}

/**
 * Builds the eighteen-treatment public value matrix from both authored routes.
 * The returned objects intentionally contain labels and safe prose only; the
 * internal campaign and case keys never cross this presentation boundary.
 */
export function buildCampaignPacingValueMatrix(): CampaignPacingValueEntry[] {
  return listDetectiveCampaignDefinitions().flatMap((definition) =>
    definition.routes.flatMap((route) => route.chapters.map((chapter) => matrixEntry(definition, route, chapter.ordinal)))
  );
}

export const deriveCampaignValueMatrix = buildCampaignPacingValueMatrix;

function chapterOrdinal(campaign?: CampaignSessionPublicSummary | null): 1 | 2 | 3 {
  if (!campaign) return 1;
  if (campaign.status === "finale-ready" || campaign.status === "finale-active" || campaign.status === "completed") return 3;
  const chapterNumber = Number(campaign.chapterLabel.match(/\b([1-3])\b/)?.[1] || 0);
  if (chapterNumber >= 1 && chapterNumber <= 3) return chapterNumber as 1 | 2 | 3;
  const completed = Number(campaign.progressLabel.match(/^(\d+)/)?.[1] || 0);
  return Math.max(1, Math.min(3, completed + (campaign.status === "transition" ? 1 : 1))) as 1 | 2 | 3;
}

function campaignContext(campaign?: CampaignSessionPublicSummary | null) {
  const label = campaign?.campaignLabel?.trim();
  const definition = listDetectiveCampaignDefinitions().find((item) => item.label === label) || listDetectiveCampaignDefinitions()[0];
  const routeLabel = campaign?.routeLabel?.trim();
  const route = definition.routes.find((item) => item.label === routeLabel) || definition.routes[0];
  return { definition, route };
}

function normalizedStatus(value?: string) {
  return (value || "").trim().toLowerCase();
}

function firstSignal(signals: readonly CampaignPacingSource[] = []) {
  const actionable = signals.filter((signal) => WAITING_STATUSES.has(normalizedStatus(signal.status)) || ADVANCING_STATUSES.has(normalizedStatus(signal.status)));
  return [...actionable].sort((left, right) => {
    const leftIndex = left.kind ? SIGNAL_PRIORITY.indexOf(left.kind) : SIGNAL_PRIORITY.length;
    const rightIndex = right.kind ? SIGNAL_PRIORITY.indexOf(right.kind) : SIGNAL_PRIORITY.length;
    return leftIndex - rightIndex;
  })[0];
}

function deriveStatus(input: CampaignPacingInput, signal?: CampaignPacingSource): CampaignPacingStatus {
  const campaignStatus = input.campaign?.status;
  if (campaignStatus === "completed") return "settled";
  const signalStatus = normalizedStatus(signal?.status);
  if (WAITING_STATUSES.has(signalStatus)) return "waiting-choice";
  if (ADVANCING_STATUSES.has(signalStatus) || normalizedStatus(input.consequence?.status) === "active") return "advancing";
  if (campaignStatus === "opening") return "opening";
  return "active";
}

function safeCurrentAction(input: CampaignPacingInput, entry: CampaignPacingValueEntry) {
  const source = input.currentAction;
  const label = safeText(source?.label || input.campaign?.primaryActionLabel, "Continue the campaign route", 120);
  const detail = safeText(source?.detail || input.campaign?.chapterObjective, entry.whyNow, 220);
  return { label, detail };
}

function signalObjective(signal: CampaignPacingSource, fallback: { label: string; detail: string }) {
  const advancing = ADVANCING_STATUSES.has(normalizedStatus(signal.status));
  const labels: Record<CampaignPacingSignalKind, [string, string]> = {
    recovery: ["Choose Campaign Recovery", "Advance Campaign Recovery"],
    headquarters: ["Choose Headquarters preparation", "Carry Headquarters preparation"],
    lead: ["Choose World Lead response", "Continue the followed World Lead"],
    arc: ["Review World Arc context", "Continue the World Arc"],
    directive: ["Choose Faction Directive response", "Advance the Faction Directive"],
    pressure: ["Review World Pressure", "Carry World Pressure forward"],
    offer: ["Choose the World Opportunity", "Advance the World Opportunity"],
    reaction: ["Review the Town Reaction", "Advance the Town Reaction"]
  };
  const label = signal.kind ? labels[signal.kind][advancing ? 1 : 0] : signal.label || fallback.label;
  return {
    label: safeText(label, fallback.label, 120),
    detail: safeText(signal.nextAction || signal.detail || signal.summary, fallback.detail, 220)
  };
}

function signalDetail(signal?: CampaignPacingSource, fallback?: string) {
  if (!signal) return fallback || "The visible campaign context remains available without changing the certified route.";
  return safeText(signal.detail || signal.summary || signal.benefitLabel || signal.nextAction, fallback || "A bounded public-world context is ready.", 220);
}

/**
 * Pure, non-authoritative pacing projection. It explains the current chapter
 * and existing consequences; it never creates a decision, request, tick, or
 * candidate preference.
 */
export function deriveCampaignPacingViewModel(input: CampaignPacingInput): CampaignPacingViewModel {
  const { definition, route } = campaignContext(input.campaign);
  const ordinal = chapterOrdinal(input.campaign);
  const value = matrixEntry(definition, route, ordinal);
  const signal = firstSignal(input.signals);
  const status = deriveStatus(input, signal);
  const fallbackObjective = safeCurrentAction(input, value);
  const currentObjective = signal ? signalObjective(signal, fallbackObjective) : fallbackObjective;
  const staticMode = input.runtimeMode === "static-demo";
  const worldDetail = signalDetail(signal, value.whatChanges);
  const consequenceDetail = input.consequence?.summary || input.consequence?.detail || input.consequence?.headline;
  const whyNow = status === "settled"
    ? "The three-case route is closed; read the visible debrief before starting another fair route."
    : signal && (WAITING_STATUSES.has(normalizedStatus(signal.status)) || ADVANCING_STATUSES.has(normalizedStatus(signal.status)))
      ? safeText(signal.nextAction || signal.detail || value.whyNow, value.whyNow)
      : value.whyNow;
  const nextAction = safeText(input.currentAction?.nextAction || input.campaign?.nextAction || value.nextCaseHint, value.nextCaseHint, 220);
  const primaryAction: CampaignPacingAction | undefined = !staticMode && status !== "settled"
    ? {
        kind: "current-objective",
        label: currentObjective.label,
        detail: currentObjective.detail,
        enabled: !input.busy,
        primary: true
      }
    : undefined;
  const secondaryActions: CampaignPacingAction[] = [];
  if (!staticMode && signal) {
    secondaryActions.push({ kind: "world-context", label: safeText(signal.label, "Review world context", 100), detail: worldDetail, enabled: true });
  }
  if (!staticMode && status !== "settled") {
    secondaryActions.push({ kind: "next-case", label: "Read the next-case context", detail: value.nextCaseHint, enabled: true });
  }
  secondaryActions.push({ kind: "fairness", label: "Keep the certified route fair", detail: FIXED_AUTHORITY_BOUNDARY, enabled: true });

  return {
    status,
    campaignLabel: safeText(input.campaign?.campaignLabel || definition.label, "Campaign context", 72),
    chapterLabel: safeText(input.campaign?.chapterLabel || value.chapterLabel, value.chapterLabel, 72),
    progressLabel: safeText(input.campaign?.progressLabel, "Campaign opening", 90),
    currentObjective,
    whyNow,
    prerequisiteLabel: status === "waiting-choice"
      ? "Resolve the visible choice before advancing the town clock."
      : status === "advancing"
        ? "Use the existing Advance Town command to let the scheduled world work progress."
        : status === "settled"
          ? "No further campaign action is required in this world."
          : "Complete the current certified step before optional world context.",
    nextAction,
    value,
    safeForecast: {
      whatChanges: safeText(consequenceDetail || worldDetail, value.whatChanges),
      visibleSurface: safeText(`${value.primarySurface} / ${value.consequenceLabel}`, value.primarySurface, 180),
      unchangedAuthority: FIXED_AUTHORITY_BOUNDARY
    },
    primaryAction,
    secondaryActions: secondaryActions.slice(0, 3),
    disclosure: {
      essential: ["current-objective", "why-now", "next-action"],
      context: ["what-changes", "public-surface", "next-case"],
      detail: ["fairness-boundary", "replay-contrast"]
    }
  };
}

export function campaignPacingPublicText(model: CampaignPacingViewModel) {
  return JSON.stringify({
    status: model.status,
    campaignLabel: model.campaignLabel,
    chapterLabel: model.chapterLabel,
    progressLabel: model.progressLabel,
    currentObjective: model.currentObjective,
    whyNow: model.whyNow,
    nextAction: model.nextAction,
    safeForecast: model.safeForecast,
    value: model.value,
    secondaryActions: model.secondaryActions
  });
}
