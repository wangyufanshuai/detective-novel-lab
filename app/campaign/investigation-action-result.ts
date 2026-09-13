import type { PlayerSession } from "@/lib/engine";

/** A completed promise is not evidence that an investigation action succeeded. */
export type InvestigationActionResult = {
  status: "succeeded" | "rejected" | "blocked" | "cancelled" | "failed";
  /** Player-facing outcome only; never include raw exceptions or hidden case facts. */
  detail: string;
  judgement?: PlayerSession["judgement"];
  /** A public world effect confirmed by this response, never a previous signal. */
  worldChange?: string;
};

export const investigationActionCancelled = (): InvestigationActionResult => ({
  status: "cancelled",
  detail: "The investigation changed before this action finished."
});

export const investigationActionBusy = (): InvestigationActionResult => ({
  status: "blocked",
  detail: "Wait for the current investigation action to finish."
});
