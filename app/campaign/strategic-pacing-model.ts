import type {
  StrategicCommandAction,
  StrategicCommandViewModel
} from "./strategic-command-model";

export type StrategicPacingPhase = "brief" | "inspect" | "choose" | "execute" | "resolve" | "advance";
export type StrategicPacingFocusTarget = "map" | "character" | "institution" | "investigation" | "world-choice" | "result";
export type StrategicActionLifecycleState = "selected" | "resolving" | "succeeded" | "blocked" | "failed-safe";
export type StrategicSafeOutcomeState = Extract<StrategicActionLifecycleState, "succeeded" | "blocked" | "failed-safe">;

export type StrategicActionLifecycle = {
  state: StrategicActionLifecycleState;
  action?: StrategicCommandAction;
  detail?: string;
};

export type StrategicSafeOutcome = {
  signature: string;
  state: StrategicSafeOutcomeState;
  immediateResult: string;
  worldConsequence: string;
  nextObjective: string;
  focusTarget: StrategicPacingFocusTarget;
};

export type StrategicPacingDisclosureKey =
  | "current-objective"
  | "why-now"
  | "primary-action"
  | "safe-forecast"
  | "selected-context"
  | "decision-queue"
  | "advance-state"
  | "resources"
  | "world-consequence"
  | "journal"
  | "replay"
  | "developer";

export type StrategicPacingInput = {
  command: StrategicCommandViewModel;
  actionLifecycle?: StrategicActionLifecycle;
  recentSafeOutcomes?: readonly StrategicSafeOutcome[];
};

export type StrategicPacingViewModel = {
  phase: StrategicPacingPhase;
  currentObjective: StrategicCommandViewModel["currentObjective"];
  whyNow: string;
  primaryAction?: StrategicCommandAction;
  secondaryActions: StrategicCommandAction[];
  queueGroups: {
    now: StrategicCommandAction[];
    soon: StrategicCommandAction[];
    later: StrategicCommandAction[];
  };
  disclosure: {
    essential: StrategicPacingDisclosureKey[];
    context: StrategicPacingDisclosureKey[];
    detail: StrategicPacingDisclosureKey[];
  };
  safeForecast: {
    immediateBenefit: string;
    visibleCost: string;
    affectedSurface: string;
    unchangedAuthority: string;
  };
  focusTarget: StrategicPacingFocusTarget;
  advanceState: StrategicCommandViewModel["advanceState"];
  actionLifecycle?: StrategicActionLifecycle;
  recentSafeOutcomes: StrategicSafeOutcome[];
};

const LATER_KINDS = new Set<StrategicCommandAction["kind"]>([
  "outcome-review",
  "headquarters",
  "operations",
  "next-case"
]);

const FIXED_AUTHORITY_BOUNDARY = "Case truth, evidence coverage, the certified route, judgement, and NPC legal actions remain unchanged.";

function cloneAction(action: StrategicCommandAction): StrategicCommandAction {
  return { ...action };
}

function actionKey(action: StrategicCommandAction) {
  return `${action.kind}:${action.target}:${action.contextActionKind || "none"}`;
}

function uniqueActions(actions: readonly StrategicCommandAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = actionKey(action);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function focusForAction(command: StrategicCommandViewModel, action?: StrategicCommandAction): StrategicPacingFocusTarget {
  if (action?.kind === "outcome-review") return "result";
  if (action?.target === "show-world-choice") return "world-choice";
  if (action?.target === "show-headquarters" || action?.target === "show-operations") return "institution";
  if (action?.target === "show-investigation" || action?.target === "context-action") {
    if (command.selectedContext?.kind === "actor") return "character";
    if (command.selectedContext?.kind === "institution") return "institution";
    return "investigation";
  }
  if (action?.target === "review-outcome") return "result";
  if (command.presentationFeedback.state === "updated" || command.presentationFeedback.state === "completed" || command.presentationFeedback.state === "blocked") return "result";
  if (command.selectedContext?.kind === "actor") return "character";
  if (command.selectedContext?.kind === "institution") return "institution";
  if (command.selectedContext) return "investigation";
  return "map";
}

function derivePhase(command: StrategicCommandViewModel, lifecycle: StrategicActionLifecycle | undefined, primaryAction: StrategicCommandAction | undefined): StrategicPacingPhase {
  if (lifecycle?.state === "resolving" || command.presentationFeedback.state === "resolving") return "execute";
  if (lifecycle?.state === "succeeded" || lifecycle?.state === "blocked" || lifecycle?.state === "failed-safe") return "resolve";
  if (command.presentationFeedback.state === "updated" || command.presentationFeedback.state === "completed" || command.presentationFeedback.state === "blocked") return "resolve";
  if (lifecycle?.state === "selected") return "execute";
  if (primaryAction?.kind === "advance-town" && command.advanceState.state === "ready") return "advance";
  if (command.selectedContext) return "inspect";
  if (primaryAction) return "choose";
  return "brief";
}

function groupQueue(command: StrategicCommandViewModel, primaryAction: StrategicCommandAction | undefined) {
  const source = uniqueActions(command.decisionQueue);
  const primaryKey = primaryAction ? actionKey(primaryAction) : undefined;
  const now: StrategicCommandAction[] = [];
  const soon: StrategicCommandAction[] = [];
  const later: StrategicCommandAction[] = [];

  for (const decision of source) {
    const copy = cloneAction(decision);
    if (primaryKey === actionKey(decision)) now.push(copy);
    else if (decision.enabled && decision.blocking) now.push(copy);
    else if (LATER_KINDS.has(decision.kind)) later.push(copy);
    else soon.push(copy);
  }
  return { now, soon, later };
}

function affectedSurfaceLabel(focusTarget: StrategicPacingFocusTarget) {
  switch (focusTarget) {
    case "character": return "Selected public character and Context Inspector.";
    case "institution": return "Selected public institution and Situation Brief.";
    case "investigation": return "Investigation workspace and Decision Queue.";
    case "world-choice": return "World Campaign and Situation Brief.";
    case "result": return "Map focus, Inspector, and Next Objective.";
    default: return "Town map and Current Objective.";
  }
}

function stableSafeSignature(parts: readonly string[]) {
  let hash = 2166136261;
  for (const character of parts.join("\u241f")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `outcome-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function appendRecentSafeOutcome(history: readonly StrategicSafeOutcome[], outcome?: StrategicSafeOutcome) {
  const source = outcome ? [outcome, ...history] : [...history];
  const seen = new Set<string>();
  const bounded: StrategicSafeOutcome[] = [];
  for (const item of source) {
    if (seen.has(item.signature)) continue;
    seen.add(item.signature);
    bounded.push({ ...item });
    if (bounded.length === 5) break;
  }
  return bounded;
}

export function deriveCurrentSafeOutcome(command: StrategicCommandViewModel, lifecycle?: StrategicActionLifecycle): StrategicSafeOutcome | undefined {
  const state: StrategicSafeOutcomeState | undefined = lifecycle?.state === "succeeded" || lifecycle?.state === "blocked" || lifecycle?.state === "failed-safe"
    ? lifecycle.state
    : command.presentationFeedback.state === "blocked"
      ? "blocked"
      : command.presentationFeedback.state === "updated" || command.presentationFeedback.state === "completed"
        ? "succeeded"
        : undefined;
  if (!state) return undefined;
  const focusTarget = focusForAction(command, lifecycle?.action);
  const immediateResult = lifecycle?.detail || command.outcomeFeedback.immediate.detail;
  const worldConsequence = command.outcomeFeedback.world.detail;
  const nextObjective = command.outcomeFeedback.next.detail;
  return {
    signature: stableSafeSignature([state, immediateResult, worldConsequence, nextObjective, focusTarget]),
    state,
    immediateResult,
    worldConsequence,
    nextObjective,
    focusTarget
  };
}

/**
 * Public-safe presentation derivation only. This model never reads authority,
 * executes a handler, advances time, or writes browser/server storage.
 */
export function buildStrategicPacingViewModel(input: StrategicPacingInput): StrategicPacingViewModel {
  const command = input.command;
  const primaryAction = command.primaryAction?.enabled ? cloneAction(command.primaryAction) : undefined;
  const primaryKey = primaryAction ? actionKey(primaryAction) : undefined;
  const secondaryActions = uniqueActions(command.secondaryActions)
    .filter((action) => action.enabled && actionKey(action) !== primaryKey)
    .slice(0, 3)
    .map(cloneAction);
  const focusTarget = focusForAction(command, input.actionLifecycle?.action || primaryAction);
  const currentOutcome = deriveCurrentSafeOutcome(command, input.actionLifecycle);
  const recentSafeOutcomes = appendRecentSafeOutcome(input.recentSafeOutcomes || [], currentOutcome);
  const queueGroups = groupQueue(command, primaryAction);
  const fallbackNextAction = command.currentObjective.nextAction || command.campaignProgress.nextAction;
  const campaignWhyNow = command.campaignPacing?.whyNow;

  return {
    phase: derivePhase(command, input.actionLifecycle, primaryAction),
    currentObjective: { ...command.currentObjective },
    whyNow: primaryAction?.kind === "certified-investigation"
      ? primaryAction.detail
      : campaignWhyNow || primaryAction?.detail || fallbackNextAction,
    primaryAction,
    secondaryActions,
    queueGroups,
    disclosure: {
      essential: ["current-objective", "why-now", "primary-action", "safe-forecast"],
      context: command.selectedContext
        ? ["selected-context", "decision-queue", "advance-state"]
        : ["decision-queue", "advance-state"],
      detail: ["resources", "world-consequence", "journal", "replay", "developer"]
    },
    safeForecast: {
      immediateBenefit: primaryAction?.benefitLabel || command.outcomeFeedback.immediate.detail,
      visibleCost: primaryAction?.costLabel || command.advanceState.detail,
      affectedSurface: command.campaignPacing?.safeForecast.visibleSurface || affectedSurfaceLabel(focusTarget),
      unchangedAuthority: command.campaignPacing?.safeForecast.unchangedAuthority || FIXED_AUTHORITY_BOUNDARY
    },
    focusTarget,
    advanceState: {
      ...command.advanceState,
      action: command.advanceState.action ? cloneAction(command.advanceState.action) : undefined
    },
    actionLifecycle: input.actionLifecycle
      ? { ...input.actionLifecycle, action: input.actionLifecycle.action ? cloneAction(input.actionLifecycle.action) : undefined }
      : undefined,
    recentSafeOutcomes
  };
}
