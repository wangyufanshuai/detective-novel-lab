"use client";

import { useMemo } from "react";
import { resolveCommandDeckOverlay, type CommandDeckOverlayInput } from "@/app/campaign/command-deck-overlay-model";

/** Browser-local overlay ownership only. It never reads or writes runtime state. */
export function useCommandDeckOverlayArbiter(input: CommandDeckOverlayInput) {
  return useMemo(() => resolveCommandDeckOverlay(input), [
    input.activePanel,
    input.blockingOverlayActive,
    input.encounterVisible,
    input.notificationVisible,
    input.toastVisible,
    input.transitionPhase,
    input.transitionVisible
  ]);
}
