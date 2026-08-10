import {
  deriveCampaignCommandDeckViewModel,
  type CampaignCommandDeckInput,
  type CampaignCommandDeckViewModel
} from "./command-deck-model";
import type { SafeContextAction, SafeContextActionKind } from "./context-action-resolver";
import type { CertifiedCaseRhythmViewModel } from "./certified-case-rhythm-model";
import type { CommandDeckObjectiveAction } from "./command-deck-model";

export type StrategicDecisionKind =
  | "campaign"
  | "certified-investigation"
  | "campaign-recovery"
  | "world-lead"
  | "faction-directive"
  | "world-event-offer"
  | "outcome-review"
  | "headquarters"
  | "operations"
  | "advance-town"
  | "next-case";

export type StrategicActionTarget =
  | "context-action"
  | "open-campaign"
  | "show-investigation"
  | "show-world-choice"
  | "show-headquarters"
  | "show-operations"
  | "show-next-case"
  | "advance-town"
  | "review-outcome";

export type StrategicCommandAction = {
  kind: StrategicDecisionKind;
  target: StrategicActionTarget;
  label: string;
  detail: string;
  benefitLabel: string;
  costLabel: string;
  priority: number;
  enabled: boolean;
  blocking: boolean;
  contextActionKind?: SafeContextActionKind;
  disabledReason?: string;
};

export type StrategicActionDispatch =
  | { handler: "context-action"; actionKind: SafeContextActionKind }
  | { handler: "open-campaign" }
  | { handler: "show-investigation" }
  | { handler: "show-world-choice" }
  | { handler: "show-headquarters" }
  | { handler: "show-operations" }
  | { handler: "show-next-case" }
  | { handler: "advance-town" }
  | { handler: "review-outcome" };

export type StrategicResourceTone = "stable" | "watch" | "strong" | "blocked";

export type StrategicResourceRibbonItem = {
  kind: "police-time" | "informant-trust" | "evidence-integrity" | "town-time" | "operations" | "institution-pressure" | "world-pressure" | "campaign-progress";
  label: string;
  value: string;
  trend: string;
  detail: string;
  tone: StrategicResourceTone;
};

type StrategicStatus = {
  status?: string;
  label?: string;
  campaignLabel?: string;
  chapterLabel?: string;
  primaryActionLabel?: string;
  progressLabel?: string;
  nextAction?: string;
  benefitLabel?: string;
  costLabel?: string;
  recoveryActionLabel?: string;
  directionLabel?: string;
  operationLabel?: string;
  actionLabel?: string;
};

export type StrategicOperationsSummary = StrategicStatus & {
  planStatus?: string;
  supportCapacity?: number;
  supportCount?: number;
  completedOperationCount?: number;
  townTimeMinutes?: number;
  options?: Array<{
    choice?: string;
    label: string;
    available: boolean;
    availabilityBand: "ample" | "limited" | "critical" | "unavailable";
  }>;
  laneSummaries?: Array<{
    resourceLabel: string;
    selected: boolean;
  }>;
};

export type StrategicHeadquartersSummary = StrategicStatus & {
  status?: string;
  choiceLabel?: string;
};

export type StrategicCommandInput = CampaignCommandDeckInput & {
  hasWorld: boolean;
  hasCase: boolean;
  hasSession: boolean;
  judgementAccepted: boolean;
  busy?: boolean;
  advanceAvailable?: boolean;
  operations?: StrategicOperationsSummary;
  headquarters?: StrategicHeadquartersSummary;
  worldEventOffer?: StrategicStatus;
  caseRhythm?: CertifiedCaseRhythmViewModel;
};

export type StrategicCommandViewModel = CampaignCommandDeckViewModel & {
  resourceRibbon: StrategicResourceRibbonItem[];
  decisionQueue: StrategicCommandAction[];
  primaryAction?: StrategicCommandAction;
  secondaryActions: StrategicCommandAction[];
  outcomeFeedback: {
    immediate: { label: string; detail: string };
    world: { label: string; detail: string };
    next: { label: string; detail: string };
  };
  advanceState: {
    state: "ready" | "blocked" | "readonly" | "unavailable";
    label: string;
    detail: string;
    action?: StrategicCommandAction;
  };
  caseRhythm?: CertifiedCaseRhythmViewModel;
};

const DECISION_PRIORITY: Record<StrategicDecisionKind, number> = {
  campaign: 1,
  "certified-investigation": 2,
  "campaign-recovery": 3,
  "world-lead": 4,
  "faction-directive": 4,
  "world-event-offer": 4,
  "outcome-review": 5,
  headquarters: 6,
  operations: 6,
  "advance-town": 7,
  "next-case": 8
};

function cloneCaseRhythm(model: CertifiedCaseRhythmViewModel): CertifiedCaseRhythmViewModel {
  return {
    ...model,
    currentStep: { ...model.currentStep, action: { ...model.currentStep.action } },
    beats: model.beats.map((beat) => ({ ...beat })),
    suggestedAction: { ...model.suggestedAction }
  };
}

function normalizedStatus(value?: StrategicStatus) {
  return (value?.status || "").trim().toLowerCase();
}

function firstEnabledContextAction(actions?: SafeContextAction[]) {
  return actions?.find((action) => action.enabled && action.primary)
    || actions?.find((action) => action.enabled);
}

function resourceTone(value?: string): StrategicResourceTone {
  if (!value || value === "unavailable" || value === "blocked" || value === "critical") return "blocked";
  if (value === "limited" || value === "watch" || value === "ready") return "watch";
  if (value === "ample" || value === "active" || value === "completed" || value === "strong") return "strong";
  return "stable";
}

function availabilityResource(
  kind: StrategicResourceRibbonItem["kind"],
  label: string,
  operations: StrategicOperationsSummary | undefined,
  choice: string
): StrategicResourceRibbonItem {
  const option = operations?.options?.find((item) => item.choice === choice || item.label.toLowerCase() === label.toLowerCase());
  const value = option?.availabilityBand || "unavailable";
  const supported = Boolean(operations?.laneSummaries?.some((lane) => lane.selected && lane.resourceLabel.toLowerCase() === label.toLowerCase()));
  return {
    kind,
    label,
    value,
    trend: supported ? "reserve assigned" : option?.available ? "available" : "manual first",
    detail: option?.available
      ? `${label} is available for one bounded case operation reserve.`
      : `${label} is not reserved; the slower certified Manual First route remains legal.`,
    tone: resourceTone(value)
  };
}

function buildResourceRibbon(input: StrategicCommandInput, base: CampaignCommandDeckViewModel): StrategicResourceRibbonItem[] {
  const operations = input.operations;
  const completed = Math.max(0, operations?.completedOperationCount || 0);
  const operationStatus = operations?.planStatus || operations?.status || "ready";
  const pressureValue = input.pressure?.directionLabel || input.pressure?.status || "stable";
  return [
    availabilityResource("police-time", "Police Time", operations, "police-time"),
    availabilityResource("informant-trust", "Informant Trust", operations, "informant-trust"),
    availabilityResource("evidence-integrity", "Evidence Integrity", operations, "evidence-integrity"),
    {
      kind: "town-time",
      label: "Town Time",
      value: `${Math.max(0, operations?.townTimeMinutes || 0)} min`,
      trend: input.advanceAvailable ? "advance available" : "clock held",
      detail: "Only the existing Advance Town command moves the authoritative simulation clock.",
      tone: input.advanceAvailable ? "stable" : "watch"
    },
    {
      kind: "operations",
      label: "Operations",
      value: `${completed}/3`,
      trend: operationStatus,
      detail: operations?.progressLabel || "Search, Question, and Challenge continue through the certified handlers.",
      tone: resourceTone(operationStatus)
    },
    {
      kind: "institution-pressure",
      label: "Institution Pressure",
      value: base.townPulse.pressureLabel,
      trend: input.institutionLabel || "townwide",
      detail: "A bounded public pressure band; it does not reveal an institution key or case role.",
      tone: resourceTone(base.townPulse.pressureLabel)
    },
    {
      kind: "world-pressure",
      label: "World Pressure",
      value: pressureValue,
      trend: input.pressure?.status || "empty",
      detail: input.pressure?.nextAction || "No pressure layer is waiting to influence a future, unextracted case.",
      tone: resourceTone(input.pressure?.status || pressureValue)
    },
    {
      kind: "campaign-progress",
      label: "Campaign",
      value: input.campaign?.campaignLabel || base.townPulse.campaignLabel,
      trend: input.campaign?.progressLabel || input.campaign?.chapterLabel || input.campaign?.status || "opening",
      detail: input.campaign?.nextAction || base.campaignProgress.nextAction,
      tone: normalizedStatus(input.campaign) === "completed" ? "strong" : "stable"
    }
  ];
}

function buildDecisionQueue(input: StrategicCommandInput, base: CampaignCommandDeckViewModel): StrategicCommandAction[] {
  if (input.runtimeMode === "static-demo") return [];
  const decisions = new Map<StrategicDecisionKind, StrategicCommandAction>();
  const add = (decision: Omit<StrategicCommandAction, "priority">) => {
    if (decisions.has(decision.kind)) return;
    decisions.set(decision.kind, { ...decision, priority: DECISION_PRIORITY[decision.kind] });
  };

  const campaignStatus = normalizedStatus(input.campaign);
  if (!input.hasWorld) {
    add({
      kind: "campaign",
      target: "open-campaign",
      label: "Choose a Campaign",
      detail: "Select one of the three safe campaign routes and create its deterministic town.",
      benefitLabel: "Binds the campaign theme and authored three-case route.",
      costLabel: "The route freezes after the first successful case extraction.",
      enabled: !input.busy,
      blocking: true,
      disabledReason: input.busy ? "The current campaign command is still resolving." : undefined
    });
  }

  const contextAction = firstEnabledContextAction(input.contextActions);
  const rhythmKind = input.caseRhythm?.currentStep.kind === "review-source"
    ? "review"
    : input.caseRhythm?.currentStep.kind;
  const rhythmContextMatch = Boolean(contextAction && (!rhythmKind || contextAction.kind === rhythmKind));
  if (input.hasCase && !input.hasSession) {
    add({
      kind: "certified-investigation",
      target: rhythmContextMatch ? "context-action" : "show-investigation",
      contextActionKind: rhythmContextMatch ? contextAction?.kind : undefined,
      label: input.caseRhythm?.currentStep.label || (contextAction?.kind === "join" ? contextAction.label : "Join investigation"),
      detail: input.caseRhythm?.currentStep.detail || (contextAction?.kind === "join" ? contextAction.detail : "Open the current case and join before taking certified actions."),
      benefitLabel: "Starts the existing player session without changing case authority.",
      costLabel: "Joining reveals no hidden answer or raw case binding.",
      enabled: !input.busy,
      blocking: true,
      disabledReason: input.busy ? "The current investigation command is still resolving." : undefined
    });
  } else if (input.hasSession && !input.judgementAccepted) {
    add({
      kind: "certified-investigation",
      target: rhythmContextMatch ? "context-action" : "show-investigation",
      contextActionKind: rhythmContextMatch ? contextAction?.kind : undefined,
      label: input.caseRhythm?.currentStep.label || contextAction?.label || base.currentObjective.title,
      detail: input.caseRhythm?.currentStep.detail || contextAction?.detail || base.currentObjective.detail,
      benefitLabel: "Advances the existing certified investigation route.",
      costLabel: "Truth, coverage, judgement, and legal actions remain unchanged.",
      enabled: !input.busy,
      blocking: true,
      disabledReason: input.busy ? "The current investigation command is still resolving." : undefined
    });
  } else if (input.hasSession && input.judgementAccepted && input.caseRhythm?.status !== "complete" && input.caseRhythm?.currentStep.kind === "review-source") {
    add({
      kind: "certified-investigation",
      target: rhythmContextMatch ? "context-action" : "show-investigation",
      contextActionKind: rhythmContextMatch ? contextAction?.kind : undefined,
      label: input.caseRhythm.currentStep.label,
      detail: input.caseRhythm.currentStep.detail,
      benefitLabel: "Opens the existing source-backed conclusion review.",
      costLabel: "Review does not rewrite the accepted judgement or reveal private runtime bindings.",
      enabled: !input.busy,
      blocking: true,
      disabledReason: input.busy ? "The current review command is still resolving." : undefined
    });
  }

  const recoveryStatus = normalizedStatus(input.recovery);
  if (recoveryStatus === "ready" || recoveryStatus === "scheduled") {
    add({
      kind: "campaign-recovery",
      target: "show-world-choice",
      label: input.recovery?.recoveryActionLabel || "Review Campaign Recovery",
      detail: input.recovery?.nextAction || "Choose a legal recovery path after the recorded setback.",
      benefitLabel: input.recovery?.progressLabel || "Restores a bounded route or world opportunity.",
      costLabel: input.recovery?.costLabel || "Recovery never fills the player's theory or evidence automatically.",
      enabled: !input.busy,
      blocking: true
    });
  }

  if (normalizedStatus(input.worldLead) === "pending") {
    add({
      kind: "world-lead",
      target: "show-world-choice",
      label: "Choose World Lead response",
      detail: input.worldLead?.nextAction || "Follow or skip the safe world lead before continuing the wider campaign loop.",
      benefitLabel: input.worldLead?.label || "A low-spoiler strategic preference can be followed.",
      costLabel: "Skipping preserves the unchanged certified case route.",
      enabled: !input.busy,
      blocking: true
    });
  }

  const directiveStatus = normalizedStatus(input.directive);
  if (directiveStatus === "ready" || directiveStatus === "blocked") {
    add({
      kind: "faction-directive",
      target: "show-world-choice",
      label: input.directive?.operationLabel || "Choose Faction Directive response",
      detail: input.directive?.nextAction || "Choose Support, Contain, or Defer for the prepared directive.",
      benefitLabel: input.directive?.benefitLabel || "A legal response can shape future public world state.",
      costLabel: input.directive?.costLabel || "The choice does not rewrite the current case.",
      enabled: !input.busy,
      blocking: true
    });
  }

  if (normalizedStatus(input.worldEventOffer) === "offered") {
    add({
      kind: "world-event-offer",
      target: "show-world-choice",
      label: input.worldEventOffer?.actionLabel || input.worldEventOffer?.label || "Review World Event offer",
      detail: input.worldEventOffer?.nextAction || "Accept or decline the current bounded world opportunity.",
      benefitLabel: input.worldEventOffer?.benefitLabel || "The offer can create a persistent public world result.",
      costLabel: input.worldEventOffer?.costLabel || "Declining keeps the current case authority unchanged.",
      enabled: !input.busy,
      blocking: true
    });
  }

  if (base.presentationFeedback.state === "updated" || base.presentationFeedback.state === "completed") {
    add({
      kind: "outcome-review",
      target: "review-outcome",
      label: "Review latest result",
      detail: base.presentationFeedback.detail,
      benefitLabel: base.worldConsequenceTimeline.summary,
      costLabel: "Reviewing this summary does not write another event.",
      enabled: true,
      blocking: false
    });
  }

  if (normalizedStatus(input.headquarters) === "ready") {
    add({
      kind: "headquarters",
      target: "show-headquarters",
      label: "Choose Headquarters preparation",
      detail: input.headquarters?.nextAction || "Choose one bounded preparation before the next case.",
      benefitLabel: input.headquarters?.benefitLabel || "Preparation grants one bounded next-case convenience.",
      costLabel: input.headquarters?.costLabel || "No preparation can reveal or complete case proof.",
      enabled: !input.busy,
      blocking: false
    });
  }

  const operationsStatus = (input.operations?.planStatus || input.operations?.status || "").toLowerCase();
  if (input.hasSession && (operationsStatus === "ready" || operationsStatus === "blocked")) {
    add({
      kind: "operations",
      target: "show-operations",
      label: operationsStatus === "blocked" ? "Review blocked Operations" : "Plan Investigation Operations",
      detail: input.operations?.nextAction || "Reserve up to two bounded supports or continue Manual First.",
      benefitLabel: input.operations?.benefitLabel || "A matching certified step can receive a bounded world benefit.",
      costLabel: input.operations?.costLabel || "Manual First remains legal when no reserve is selected.",
      enabled: !input.busy,
      blocking: false
    });
  }

  const blockingDecision = [...decisions.values()].find((decision) => decision.blocking && decision.enabled);
  const advanceEnabled = Boolean(input.advanceAvailable && !input.busy && !blockingDecision);
  add({
    kind: "advance-town",
    target: "advance-town",
    label: "Advance Town",
    detail: blockingDecision
      ? `Resolve ${blockingDecision.label} before advancing the authoritative town clock.`
      : "Advance the existing Persistent Town simulation by one normal step.",
    benefitLabel: "Progresses scheduled institutions, directives, offers, recovery, and public reactions.",
    costLabel: "One normal town step; no investigation handler adds a hidden step.",
    enabled: advanceEnabled,
    blocking: false,
    disabledReason: !input.advanceAvailable
      ? "Advance Town is unavailable until a Server Runtime town exists."
      : input.busy
        ? "Another command is still resolving."
        : blockingDecision
          ? `Resolve ${blockingDecision.label} first.`
          : undefined
  });

  if (input.hasWorld && !input.hasCase && campaignStatus !== "completed") {
    add({
      kind: "next-case",
      target: "show-next-case",
      label: campaignStatus === "opening" ? "Review opening-case candidates" : "Review next-case candidates",
      detail: input.campaign?.nextAction || "Inspect the legal candidate queue and choose the next case.",
      benefitLabel: "Keeps candidate membership and route integrity visible before extraction.",
      costLabel: "Previewing candidates does not consume handoff, pressure, events, or town time.",
      enabled: !input.busy,
      blocking: false
    });
  }

  return [...decisions.values()].sort((left, right) => left.priority - right.priority || left.kind.localeCompare(right.kind));
}

export function resolveStrategicActionDispatch(action: StrategicCommandAction): StrategicActionDispatch {
  if (action.target === "context-action" && action.contextActionKind) {
    return { handler: "context-action", actionKind: action.contextActionKind };
  }
  return { handler: action.target } as StrategicActionDispatch;
}

export type StrategicActionHandlers = {
  contextAction: (actionKind: SafeContextActionKind) => void | Promise<void>;
  openCampaign: () => void | Promise<void>;
  advanceTown: () => void | Promise<void>;
  showNextCase: () => void | Promise<void>;
  showInspector: () => void | Promise<void>;
};

function dispatchStrategicAction(action: StrategicCommandAction, handlers: StrategicActionHandlers) {
  const dispatch = resolveStrategicActionDispatch(action);
  const result = dispatch.handler === "context-action"
    ? handlers.contextAction(dispatch.actionKind)
    : dispatch.handler === "open-campaign"
      ? handlers.openCampaign()
      : dispatch.handler === "advance-town"
        ? handlers.advanceTown()
        : dispatch.handler === "show-next-case"
          ? handlers.showNextCase()
          : handlers.showInspector();
  return { dispatch, result };
}

/** Executes only the existing UI adapters; it never constructs an API payload. */
export function executeStrategicActionDispatch(action: StrategicCommandAction, handlers: StrategicActionHandlers) {
  const { dispatch } = dispatchStrategicAction(action, handlers);
  return dispatch;
}

/** Promise-aware presentation wrapper around the same existing adapters and payloads. */
export async function executeStrategicActionDispatchAsync(action: StrategicCommandAction, handlers: StrategicActionHandlers) {
  const { dispatch, result } = dispatchStrategicAction(action, handlers);
  await result;
  return dispatch;
}

export function buildStrategicCommandViewModel(input: StrategicCommandInput): StrategicCommandViewModel {
  const base = deriveCampaignCommandDeckViewModel(input);
  const decisionQueue = buildDecisionQueue(input, base);
  const primaryAction = decisionQueue.find((decision) => decision.enabled);
  const secondaryActions = decisionQueue
    .filter((decision) => decision.enabled && decision !== primaryAction)
    .slice(0, 3);
  const advanceAction = decisionQueue.find((decision) => decision.kind === "advance-town");
  const rhythmObjectiveAction = input.caseRhythm?.currentStep.kind === "review-source"
    ? "review"
    : input.caseRhythm?.currentStep.kind as CommandDeckObjectiveAction | undefined;
  const currentObjective = primaryAction?.kind === "certified-investigation" && input.caseRhythm
    ? {
        ...base.currentObjective,
        action: rhythmObjectiveAction || base.currentObjective.action,
        phase: input.caseRhythm.suggestedAction.phase,
        title: input.caseRhythm.currentStep.label,
        detail: input.caseRhythm.currentStep.detail,
        nextAction: input.caseRhythm.currentStep.detail,
        recoveryLabel: input.caseRhythm.recoveryLabel || "not needed",
        progressLabel: input.caseRhythm.progressLabel
      }
    : base.currentObjective;
  const advanceState: StrategicCommandViewModel["advanceState"] = input.runtimeMode === "static-demo"
    ? {
        state: "readonly",
        label: "Server-only Advance Town",
        detail: "Static Runtime keeps the certified demonstration fixed and makes no /api/* request."
      }
    : !input.advanceAvailable
      ? {
          state: "unavailable",
          label: "Advance Town unavailable",
          detail: advanceAction?.disabledReason || "Create or continue a Server Runtime town first.",
          action: advanceAction
        }
      : advanceAction?.enabled
        ? {
            state: "ready",
            label: advanceAction.label,
            detail: advanceAction.detail,
            action: advanceAction
          }
        : {
            state: "blocked",
            label: "Advance Town held",
            detail: advanceAction?.disabledReason || "Resolve the current blocking decision first.",
            action: advanceAction
          };

  return {
    ...base,
    currentObjective,
    resourceRibbon: buildResourceRibbon(input, base),
    decisionQueue,
    primaryAction,
    secondaryActions,
    outcomeFeedback: {
      immediate: {
        label: "Immediate Result",
        detail: base.presentationFeedback.detail
      },
      world: {
        label: "World Consequence",
        detail: `${base.worldConsequenceTimeline.headline}: ${base.worldConsequenceTimeline.summary}`
      },
      next: {
        label: "Next Objective",
        detail: primaryAction?.detail || currentObjective.nextAction
      }
    },
    advanceState,
    caseRhythm: input.caseRhythm ? cloneCaseRhythm(input.caseRhythm) : undefined
  };
}
