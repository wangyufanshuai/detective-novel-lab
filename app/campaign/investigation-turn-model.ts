import type { SafeContextActionKind } from "./context-action-resolver";

export type InvestigationTurnPhase = "choose-target" | "choose-action" | "resolve" | "feedback" | "next-objective";

export type InvestigationTurnState = {
  turnNumber: number;
  phase: InvestigationTurnPhase;
  objectiveKey: string;
  contextLabel?: string;
  lastActionKind?: SafeContextActionKind;
  lastActionLabel?: string;
  feedbackLabel: string;
};

export type InvestigationTurnEvent =
  | { type: "sync"; objectiveKey: string; contextLabel?: string }
  | { type: "start-action"; actionKind: SafeContextActionKind; actionLabel: string }
  | { type: "finish-action"; objectiveKey: string }
  | { type: "reset"; objectiveKey: string; contextLabel?: string };

export function createInvestigationTurnState(input: { objectiveKey: string; contextLabel?: string }): InvestigationTurnState {
  return {
    turnNumber: 1,
    phase: input.contextLabel ? "choose-action" : "choose-target",
    objectiveKey: input.objectiveKey,
    contextLabel: input.contextLabel,
    feedbackLabel: input.contextLabel ? "Choose one legal action for the selected public context." : "Select a public map object to begin the next investigation turn."
  };
}

/** Presentation state only; it never evaluates action legality or case truth. */
export function transitionInvestigationTurn(state: InvestigationTurnState, event: InvestigationTurnEvent): InvestigationTurnState {
  if (event.type === "reset") return createInvestigationTurnState(event);
  if (event.type === "start-action") {
    return {
      ...state,
      phase: "resolve",
      lastActionKind: event.actionKind,
      lastActionLabel: event.actionLabel,
      feedbackLabel: `${event.actionLabel} is running through the existing investigation handler.`
    };
  }
  if (event.type === "finish-action") {
    const objectiveAdvanced = event.objectiveKey !== state.objectiveKey;
    return {
      ...state,
      turnNumber: state.turnNumber + 1,
      phase: objectiveAdvanced ? "next-objective" : "feedback",
      objectiveKey: event.objectiveKey,
      feedbackLabel: objectiveAdvanced
        ? "The current objective advanced. Select the next public target."
        : "The action returned. Review the visible result before choosing again."
    };
  }

  if (state.phase === "resolve") return state;
  const objectiveAdvanced = event.objectiveKey !== state.objectiveKey;
  const contextChanged = event.contextLabel !== state.contextLabel;
  if (!objectiveAdvanced && !contextChanged) return state;
  if (objectiveAdvanced && state.lastActionKind) {
    return {
      ...state,
      objectiveKey: event.objectiveKey,
      contextLabel: event.contextLabel,
      phase: "next-objective",
      feedbackLabel: "The current objective advanced. Select the next public target."
    };
  }
  return {
    ...state,
    objectiveKey: event.objectiveKey,
    contextLabel: event.contextLabel,
    phase: event.contextLabel ? "choose-action" : "choose-target",
    feedbackLabel: event.contextLabel ? "Choose one legal action for the selected public context." : "Select a public map object to begin the next investigation turn."
  };
}

export const INVESTIGATION_TURN_PHASES: ReadonlyArray<{ phase: InvestigationTurnPhase; label: string }> = Object.freeze([
  { phase: "choose-target", label: "Target" },
  { phase: "choose-action", label: "Action" },
  { phase: "resolve", label: "Resolve" },
  { phase: "feedback", label: "Feedback" },
  { phase: "next-objective", label: "Next" }
]);
