import type { CampaignFinaleDebriefSummary, CampaignSessionSummary } from "@/app/components/WorldCampaignPanel";
import type { FinalDetectiveWorkspace } from "./final-detective-workspace-model";
import type { CampaignBeatPhase } from "./campaign-transition-model";

export const CINEMATIC_GOLD_SLICE_CAMPAIGN = "Midnight Chorus";
export const CINEMATIC_GOLD_SLICE_ROUTE = "Public Reckoning";

export type CinematicMotionPhase = "focus" | "commit" | "resolve" | "world-reaction" | "new-objective";

export function deriveCinematicResolutionPhase(phase: CampaignBeatPhase | null, fallback: CinematicMotionPhase, busy: boolean): CinematicMotionPhase {
  if (busy || phase === "action-resolving") return "commit";
  if (phase === "immediate-result") return "resolve";
  if (phase === "world-consequence") return "world-reaction";
  if (phase === "next-objective") return "new-objective";
  return phase === null ? fallback : "focus";
}

export type CinematicDeductionModel = {
  active: boolean;
  motionPhase: CinematicMotionPhase;
  campaignLabel: string;
  routeLabel: string;
  chapterLabel: string;
  objectiveLabel: string;
  riskState: "stable" | "watch" | "strained" | "settled";
  selectedEvidenceCount: number;
  discoveredEvidenceCount: number;
  contradictionCount: number;
  finaleBeats: string[];
};

export function isCinematicDeductionGoldSlice(campaign?: CampaignSessionSummary | null) {
  return campaign?.campaignLabel === CINEMATIC_GOLD_SLICE_CAMPAIGN && campaign.routeLabel === CINEMATIC_GOLD_SLICE_ROUTE;
}

export function buildCinematicDeductionModel(input: {
  campaign?: CampaignSessionSummary | null;
  finale?: CampaignFinaleDebriefSummary | null;
  workspace: FinalDetectiveWorkspace;
  busy: boolean;
}): CinematicDeductionModel {
  const accepted = input.workspace.theory.state === "accepted";
  const strained = input.workspace.theory.state === "rejected" || input.workspace.recovery.state === "ready" || input.workspace.recovery.state === "scheduled";
  const motionPhase: CinematicMotionPhase = input.busy
    ? "commit"
    : strained
      ? "world-reaction"
      : input.workspace.stage === "source-review" || input.workspace.stage === "resolved"
        ? "new-objective"
        : input.workspace.stage === "contradiction" || input.workspace.stage === "theory"
          ? "resolve"
          : "focus";
  return {
    active: isCinematicDeductionGoldSlice(input.campaign),
    motionPhase,
    campaignLabel: input.campaign?.campaignLabel || CINEMATIC_GOLD_SLICE_CAMPAIGN,
    routeLabel: input.campaign?.routeLabel || CINEMATIC_GOLD_SLICE_ROUTE,
    chapterLabel: input.campaign?.chapterLabel || "Opening case",
    objectiveLabel: input.campaign?.chapterObjective || input.workspace.objective.title,
    riskState: accepted ? "settled" : strained ? "strained" : input.workspace.theory.selectedEvidenceCount ? "watch" : "stable",
    selectedEvidenceCount: input.workspace.theory.selectedEvidenceCount,
    discoveredEvidenceCount: input.workspace.evidence.discoveredCount,
    contradictionCount: input.workspace.testimony.contradictionCount,
    finaleBeats: input.finale?.status === "ready" ? input.finale.causalBeats.slice(0, 5) : []
  };
}
