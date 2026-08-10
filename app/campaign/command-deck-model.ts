import type { SafeContextAction } from "./context-action-resolver";
import type { TownMapLensViewModel } from "./town-map-lens-model";
import type { InvestigationTurnState } from "./investigation-turn-model";
import type { WorldConsequenceTimeline } from "./world-consequence-timeline";
import type { CampaignPacingViewModel } from "./campaign-pacing-model";
import { derivePresentationFeedback, type PresentationFeedback } from "./presentation-feedback";

export type CommandDeckObjectiveAction = "observe" | "join" | "search" | "question" | "challenge" | "select-evidence" | "submit" | "review" | "world-choice" | "advance" | "recover" | "complete";

export type CampaignCommandDeckViewModel = {
  runtimeMode: "static-demo" | "server";
  townPulse: {
    caseLabel: string;
    timeLabel: string;
    heatLabel: string;
    trustLabel: string;
    pressureLabel: string;
    campaignLabel: string;
  };
  currentObjective: {
    action: CommandDeckObjectiveAction;
    phase: string;
    title: string;
    detail: string;
    nextAction: string;
    recoveryLabel: string;
    progressLabel: string;
  };
  selectedContext?: {
    kind: "location" | "institution" | "actor" | "evidence" | "theory";
    label: string;
    detail: string;
    actions: SafeContextAction[];
  };
  campaignProgress: {
    chapterLabel: string;
    progressLabel: string;
    nextAction: string;
  };
  mapSignals: {
    institutionLabel: string;
    pressureLabel: string;
    socialResponseLabel: string;
  };
  mapLenses: TownMapLensViewModel;
  investigationTurn: InvestigationTurnState;
  worldConsequenceTimeline: WorldConsequenceTimeline;
  presentationFeedback: PresentationFeedback;
  /** Optional content/pacing context; it never owns a command or authority. */
  campaignPacing?: CampaignPacingViewModel;
  notifications: Array<{
    label: string;
    detail: string;
    tone: "info" | "warning" | "success";
  }>;
};

type CommandDeckSuggestedAction = {
  phase?: string;
  title?: string;
  detail?: string;
  targetTab?: string;
};

export type CommandDeckStatus = {
  status?: string;
  label?: string;
  campaignLabel?: string;
  themeLabel?: string;
  chapterLabel?: string;
  chapterObjective?: string;
  primaryActionLabel?: string;
  nextAction?: string;
  directionLabel?: string;
  headline?: string;
  progressLabel?: string;
  benefitLabel?: string;
  costLabel?: string;
  recoveryActionLabel?: string;
  operationLabel?: string;
  actionLabel?: string;
};

export type CampaignCommandDeckInput = {
  runtimeMode: "static-demo" | "server";
  caseLabel?: string;
  currentTime?: string;
  suggestedAction?: CommandDeckSuggestedAction;
  urgency?: string;
  heat?: number;
  publicTrust?: number;
  resourcePressure?: number;
  tickLabel?: string;
  institutionLabel?: string;
  campaign?: CommandDeckStatus;
  worldLead?: CommandDeckStatus;
  worldArc?: CommandDeckStatus;
  directive?: CommandDeckStatus;
  pressure?: CommandDeckStatus;
  socialResponse?: CommandDeckStatus;
  recovery?: CommandDeckStatus;
  guidedJournal?: CommandDeckStatus;
  worldEvent?: CommandDeckStatus;
  selectedContext?: { kind: "location" | "institution" | "actor" | "evidence" | "theory"; label: string };
  contextActions?: SafeContextAction[];
  mapLenses?: TownMapLensViewModel;
  investigationTurn?: InvestigationTurnState;
  worldConsequenceTimeline?: WorldConsequenceTimeline;
  campaignPacing?: CampaignPacingViewModel;
};

function actionFromPhase(phase: string): CommandDeckObjectiveAction {
  const normalized = phase.toLowerCase();
  if (normalized.includes("observe") || normalized.includes("观察")) return "observe";
  if (normalized.includes("join") || normalized.includes("加入")) return "join";
  if (normalized.includes("search") || normalized.includes("搜索") || normalized.includes("搜寻")) return "search";
  if (normalized.includes("question") || normalized.includes("质询") || normalized.includes("询问")) return "question";
  if (normalized.includes("submit") || normalized.includes("提交") || normalized.includes("推理")) return "submit";
  if (normalized.includes("review") || normalized.includes("复盘") || normalized.includes("审阅") || normalized.includes("解答")) return "review";
  if (normalized.includes("recovery")) return "recover";
  if (normalized.includes("complete")) return "complete";
  return "advance";
}

function statusNotification(label: string, status: CommandDeckStatus | undefined, tone: "info" | "warning" | "success" = "info") {
  if (!status || !status.status || status.status === "empty" || status.status === "not-used") return undefined;
  const detail = status.headline || status.nextAction || status.progressLabel || status.directionLabel;
  if (!detail) return undefined;
  return { label, detail, tone };
}

function pressureBand(value: number | undefined, fallback: string) {
  if (!Number.isFinite(value)) return fallback;
  if ((value as number) >= 67) return "high";
  if ((value as number) >= 34) return "watch";
  return "low";
}

function trustBand(value: number | undefined, fallback: string) {
  if (!Number.isFinite(value)) return fallback;
  if ((value as number) >= 67) return "strong";
  if ((value as number) >= 34) return "mixed";
  return "fragile";
}

export function deriveCampaignCommandDeckViewModel(input: CampaignCommandDeckInput): CampaignCommandDeckViewModel {
  const openingCampaignLabel = input.runtimeMode === "server" ? "Town Reckoning" : "Campaign demonstration";
  const suggested = input.suggestedAction || {};
  const phase = suggested.phase || "Next";
  const title = input.campaignPacing?.currentObjective.label
    || suggested.title
    || input.campaign?.primaryActionLabel
    || "Continue the investigation";
  const detail = input.campaignPacing?.currentObjective.detail
    || suggested.detail
    || input.campaign?.nextAction
    || "Choose the next legal action from the current context.";
  const notifications = [
    statusNotification("Guided Journal", input.guidedJournal, input.guidedJournal?.status === "done" ? "success" : "info"),
    statusNotification("World Event", input.worldEvent),
    input.worldConsequenceTimeline && input.worldConsequenceTimeline.state !== "empty"
      ? { label: input.worldConsequenceTimeline.headline, detail: input.worldConsequenceTimeline.summary, tone: input.worldConsequenceTimeline.state === "blocked" ? "warning" as const : input.worldConsequenceTimeline.state === "settled" ? "success" as const : "info" as const }
      : undefined
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const objectiveAction = suggested.targetTab === "events"
    ? "observe"
    : suggested.targetTab === "investigation" && phase.toLowerCase().includes("join")
      ? "join"
      : actionFromPhase(phase);
  const resolvedTurn = input.investigationTurn || {
    turnNumber: 1,
    phase: input.selectedContext ? "choose-action" as const : "choose-target" as const,
    objectiveKey: `${phase}:${title}`,
    contextLabel: input.selectedContext?.label,
    feedbackLabel: input.selectedContext ? "Choose one legal action for the selected public context." : "Select a public map object to begin the next investigation turn."
  };
  const enabledActionLabel = input.contextActions?.find((action) => action.enabled && action.primary)?.label
    || input.contextActions?.find((action) => action.enabled)?.label;
  const presentationFeedback = derivePresentationFeedback({
    turnPhase: resolvedTurn.phase,
    turnNumber: resolvedTurn.turnNumber,
    selectedContextLabel: input.selectedContext?.label,
    enabledActionLabel,
    lastActionLabel: resolvedTurn.lastActionLabel,
    consequenceState: input.worldConsequenceTimeline?.state,
    consequenceHeadline: input.worldConsequenceTimeline?.headline,
    campaignStatus: input.campaign?.status
  });

  return {
    runtimeMode: input.runtimeMode,
    townPulse: {
      caseLabel: input.caseLabel || "No active case",
      timeLabel: input.tickLabel || input.currentTime || "--:--",
      heatLabel: pressureBand(input.heat, input.urgency || "stable"),
      trustLabel: trustBand(input.publicTrust, input.socialResponse?.directionLabel || "stable"),
      pressureLabel: pressureBand(input.resourcePressure, input.pressure?.directionLabel || "none"),
      campaignLabel: input.campaign?.campaignLabel || input.campaign?.progressLabel || openingCampaignLabel
    },
    currentObjective: {
      action: objectiveAction,
      phase,
      title,
      detail,
      nextAction: input.campaignPacing?.nextAction
        || input.campaign?.nextAction
        || "Complete the current certified step before opening optional world actions.",
      recoveryLabel: input.recovery?.status || "not needed",
      progressLabel: input.campaign?.progressLabel || "Opening case"
    },
    selectedContext: input.selectedContext
      ? {
          ...input.selectedContext,
          detail: input.selectedContext.kind === "location"
            ? "Selected public location. Available actions remain governed by the certified investigation route."
            : input.selectedContext.kind === "institution"
              ? "Selected public institution. World strategy remains optional and separate from certified case authority."
              : input.selectedContext.kind === "evidence"
                ? "Selected discovered clue. Theory and challenge actions reuse the existing case handlers."
                : input.selectedContext.kind === "theory"
                  ? "Current theory workspace. Judgement remains governed by the certified case authority."
                  : "Selected public character. Only legal investigation actions are shown.",
          actions: input.contextActions || []
        }
      : undefined,
    campaignProgress: {
      chapterLabel: [input.campaign?.campaignLabel, input.campaign?.chapterLabel].filter(Boolean).join(" · ") || input.campaign?.label || input.campaign?.status || "Opening case",
      progressLabel: input.campaign?.progressLabel || "Campaign opening",
      nextAction: input.campaignPacing?.whyNow
        || input.campaign?.chapterObjective
        || input.campaign?.nextAction
        || "Create or join a case to begin the campaign."
    },
    mapSignals: {
      institutionLabel: input.institutionLabel || "No institution selected",
      pressureLabel: input.pressure?.directionLabel || input.pressure?.status || "No active pressure",
      socialResponseLabel: input.socialResponse?.directionLabel || input.socialResponse?.status || "Town response stable"
    },
    mapLenses: input.mapLenses || {
      defaultLens: "evidence",
      controls: [
        { kind: "institution", label: "Institution", summary: "No institution signal" },
        { kind: "pressure", label: "Pressure", summary: "No pressure signal" },
        { kind: "reaction", label: "Reaction", summary: "No public response" },
        { kind: "evidence", label: "Evidence", summary: "No case clue signal" }
      ],
      locationSignals: []
    },
    investigationTurn: resolvedTurn,
    worldConsequenceTimeline: input.worldConsequenceTimeline || {
      state: "empty",
      headline: "World state stable",
      summary: "Player-facing world consequences will appear here after a real campaign choice.",
      nextAction: "Continue the certified investigation route.",
      beats: [
        { kind: "world-lead", title: "World Lead", state: "inactive", summary: "No world lead decision is active." },
        { kind: "world-arc", title: "World Arc", state: "inactive", summary: "No campaign arc change is active." },
        { kind: "directive", title: "Faction Directive", state: "inactive", summary: "No faction operation is active." },
        { kind: "pressure", title: "World Pressure", state: "inactive", summary: "No cross-case pressure is active." },
        { kind: "recovery", title: "Campaign Recovery", state: "inactive", summary: "No recovery action is required." },
        { kind: "reaction", title: "Town Reaction", state: "inactive", summary: "No public town reaction is active." }
      ]
    },
    presentationFeedback,
    campaignPacing: input.campaignPacing,
    notifications: notifications.slice(0, 5)
  };
}
