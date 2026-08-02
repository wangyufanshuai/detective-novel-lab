import type { SafeContextAction } from "./context-action-resolver";

export type CommandDeckObjectiveAction = "observe" | "join" | "search" | "question" | "submit" | "review" | "world-choice" | "advance" | "recover" | "complete";

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
    kind: "location" | "institution" | "actor";
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

type CommandDeckStatus = {
  status?: string;
  label?: string;
  primaryActionLabel?: string;
  nextAction?: string;
  directionLabel?: string;
  headline?: string;
  progressLabel?: string;
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
  selectedContext?: { kind: "location" | "institution" | "actor"; label: string };
  contextActions?: SafeContextAction[];
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
  const suggested = input.suggestedAction || {};
  const phase = suggested.phase || "Next";
  const title = suggested.title || input.campaign?.primaryActionLabel || "Continue the investigation";
  const detail = suggested.detail || input.campaign?.nextAction || "Choose the next legal action from the current context.";
  const notifications = [
    statusNotification("Guided Journal", input.guidedJournal, input.guidedJournal?.status === "done" ? "success" : "info"),
    statusNotification("World Event", input.worldEvent),
    statusNotification("Recovery", input.recovery, input.recovery?.status === "blocked" ? "warning" : "info"),
    statusNotification("World Lead", input.worldLead),
    statusNotification("World Arc", input.worldArc),
    statusNotification("Faction Directive", input.directive, input.directive?.status === "completed" ? "success" : "info"),
    statusNotification("World Pressure", input.pressure, input.pressure?.status === "active" ? "warning" : "info"),
    statusNotification("Town Response", input.socialResponse, input.socialResponse?.status === "settled" ? "success" : "info")
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const objectiveAction = suggested.targetTab === "events"
    ? "observe"
    : suggested.targetTab === "investigation" && phase.toLowerCase().includes("join")
      ? "join"
      : actionFromPhase(phase);

  return {
    runtimeMode: input.runtimeMode,
    townPulse: {
      caseLabel: input.caseLabel || "No active case",
      timeLabel: input.tickLabel || input.currentTime || "--:--",
      heatLabel: pressureBand(input.heat, input.urgency || "stable"),
      trustLabel: trustBand(input.publicTrust, input.socialResponse?.directionLabel || "stable"),
      pressureLabel: pressureBand(input.resourcePressure, input.pressure?.directionLabel || "none"),
      campaignLabel: input.campaign?.progressLabel || "Campaign opening"
    },
    currentObjective: {
      action: objectiveAction,
      phase,
      title,
      detail,
      nextAction: input.campaign?.nextAction || "Complete the current certified step before opening optional world actions.",
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
              : "Selected public character. Only legal investigation actions are shown.",
          actions: input.contextActions || []
        }
      : undefined,
    campaignProgress: {
      chapterLabel: input.campaign?.label || input.campaign?.status || "Opening case",
      progressLabel: input.campaign?.progressLabel || "Campaign opening",
      nextAction: input.campaign?.nextAction || "Create or join a case to begin the campaign."
    },
    mapSignals: {
      institutionLabel: input.institutionLabel || "No institution selected",
      pressureLabel: input.pressure?.directionLabel || input.pressure?.status || "No active pressure",
      socialResponseLabel: input.socialResponse?.directionLabel || input.socialResponse?.status || "Town response stable"
    },
    notifications: notifications.slice(0, 5)
  };
}
