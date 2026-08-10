import type { CampaignBeatPhase } from "./campaign-transition-model";

export type CommandDeckPanelKind = "context" | "queue" | "resources" | "fronts";
export type CommandDeckDominantOverlay = "blocking" | "action" | "transition" | "encounter" | "context" | "fronts" | "panel" | "toast" | "none";

export type CommandDeckOverlayInput = {
  blockingOverlayActive?: boolean;
  transitionVisible?: boolean;
  transitionPhase?: CampaignBeatPhase;
  encounterVisible?: boolean;
  activePanel?: CommandDeckPanelKind | null;
  notificationVisible?: boolean;
  toastVisible?: boolean;
};

export type CommandDeckOverlayResolution = {
  dominant: CommandDeckDominantOverlay;
  locksPanels: boolean;
  suspendEncounter: boolean;
  suspendLocationHover: boolean;
  suspendContextDetail: boolean;
  suspendFronts: boolean;
  suspendNotifications: boolean;
  suspendToasts: boolean;
};

export function resolveCommandDeckOverlay(input: CommandDeckOverlayInput): CommandDeckOverlayResolution {
  const dominant: CommandDeckDominantOverlay = input.blockingOverlayActive
    ? "blocking"
    : input.transitionVisible && input.transitionPhase === "action-resolving"
      ? "action"
      : input.transitionVisible
        ? "transition"
        : input.encounterVisible
          ? "encounter"
          : input.activePanel === "context"
            ? "context"
            : input.activePanel === "fronts"
              ? "fronts"
              : input.activePanel
                ? "panel"
                : input.notificationVisible || input.toastVisible
                  ? "toast"
                  : "none";
  const locksPanels = dominant === "blocking" || dominant === "action" || dominant === "transition";
  const mapCardOwner = dominant === "encounter";
  const contextOwner = dominant === "context";
  const frontsOwner = dominant === "fronts";
  const highPriority = locksPanels;
  return {
    dominant,
    locksPanels,
    suspendEncounter: highPriority || contextOwner || frontsOwner || dominant === "panel",
    suspendLocationHover: highPriority || mapCardOwner || contextOwner || frontsOwner || dominant === "panel",
    suspendContextDetail: highPriority || frontsOwner,
    suspendFronts: highPriority || mapCardOwner || contextOwner || dominant === "panel",
    suspendNotifications: highPriority,
    suspendToasts: highPriority
  };
}
