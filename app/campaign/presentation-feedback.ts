import type { InvestigationTurnPhase } from "./investigation-turn-model";

export type PresentationFeedbackState = "idle" | "available" | "selected" | "resolving" | "updated" | "blocked" | "completed";
export type PresentationFeedbackTone = "quiet" | "info" | "focus" | "warning" | "success";
export type PresentationAudioCue = "none" | "focus" | "confirm" | "resolve" | "warning" | "complete";

export type PresentationFeedback = {
  state: PresentationFeedbackState;
  tone: PresentationFeedbackTone;
  audioCue: PresentationAudioCue;
  label: string;
  detail: string;
  signature: string;
};

export type PresentationFeedbackInput = {
  turnPhase: InvestigationTurnPhase;
  turnNumber: number;
  selectedContextLabel?: string;
  enabledActionLabel?: string;
  lastActionLabel?: string;
  consequenceState?: "empty" | "active" | "blocked" | "settled";
  consequenceHeadline?: string;
  campaignStatus?: string;
};

function feedback(state: PresentationFeedbackState, tone: PresentationFeedbackTone, audioCue: PresentationAudioCue, label: string, detail: string, signature: string): PresentationFeedback {
  return { state, tone, audioCue, label, detail, signature };
}

export function derivePresentationFeedback(input: PresentationFeedbackInput): PresentationFeedback {
  if (input.consequenceState === "blocked") {
    return feedback("blocked", "warning", "warning", "World action blocked", input.consequenceHeadline || "Review the visible condition before continuing.", `blocked:${input.consequenceHeadline || "world"}`);
  }
  if (input.turnPhase === "resolve") {
    return feedback("resolving", "focus", "resolve", "Resolving action", input.lastActionLabel || "The existing investigation handler is resolving.", `resolve:${input.turnNumber}:${input.lastActionLabel || "action"}`);
  }
  if (input.campaignStatus === "completed") {
    return feedback("completed", "success", "complete", "Campaign complete", "Review the debrief or begin a clean route.", `complete:${input.turnNumber}`);
  }
  if (input.turnPhase === "next-objective") {
    return feedback("updated", "success", "confirm", "Objective updated", "The authoritative investigation objective has advanced.", `updated:${input.turnNumber}`);
  }
  if (input.turnPhase === "feedback") {
    return feedback("updated", "info", "confirm", "Action recorded", input.lastActionLabel || "The current objective remains available.", `feedback:${input.turnNumber}:${input.lastActionLabel || "action"}`);
  }
  if (input.selectedContextLabel) {
    return feedback("selected", "focus", "focus", "Context selected", input.selectedContextLabel, `selected:${input.selectedContextLabel}`);
  }
  if (input.enabledActionLabel) {
    return feedback("available", "info", "none", "Action available", input.enabledActionLabel, `available:${input.enabledActionLabel}`);
  }
  if (input.consequenceState === "settled") {
    return feedback("completed", "success", "complete", "World consequence settled", input.consequenceHeadline || "The visible consequence chain is settled.", `settled:${input.consequenceHeadline || "world"}`);
  }
  return feedback("idle", "quiet", "none", "Awaiting target", "Select a public map context to reveal the next legal action.", "idle");
}

export const PRESENTATION_FEEDBACK_STATES: readonly PresentationFeedbackState[] = ["idle", "available", "selected", "resolving", "updated", "blocked", "completed"];
