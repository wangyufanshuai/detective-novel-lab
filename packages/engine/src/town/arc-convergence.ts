import { invalidateTownCandidateCache } from "./cases";
import type { PersistentTownRuntime, TownCaseType } from "../persistent-town";
import { detectiveCampaignRouteForRuntime } from "./campaign-catalog";

export type ArcConvergenceStatus = "locked" | "forming" | "ready" | "active" | "completed";
export type ArcConvergenceApproach = "coalition" | "resilience" | "pressure-balance";

export type ArcConvergenceRuntimeState = {
  status: ArcConvergenceStatus;
  approach?: ArcConvergenceApproach;
  finaleCaseType: TownCaseType;
  acceptedCaseCount: number;
  advancedStageCount: number;
  supportingSignalCount: number;
  qualifyingSignalKeys: string[];
  contextLabels: string[];
  formedAtTick?: number;
  readyAtTick?: number;
  activeCaseId?: string;
  activatedAtTick?: number;
  completedAtTick?: number;
};

export type ArcConvergencePublicSummary = {
  status: ArcConvergenceStatus;
  finaleLabel: string;
  approachLabel: string;
  caseProgressLabel: string;
  worldProgressLabel: string;
  contextLabels: string[];
  nextAction: string;
};

const REQUIRED_CASES = 2;
const REQUIRED_STAGES = 2;

const APPROACH_LABELS: Record<ArcConvergenceApproach, string> = {
  coalition: "Coalition route",
  resilience: "Recovery route",
  "pressure-balance": "Pressure-balance route"
};

function acceptedCaseCount(runtime: PersistentTownRuntime) {
  return Math.max(0, Math.min(3, runtime.investigatorProgression?.competencies["case-closure"] || 0));
}

function advancedStageCount(runtime: PersistentTownRuntime) {
  return Object.values(runtime.worldArcProgress?.lines || {}).reduce(
    (total, line) => total + Math.max(0, line.completedStages || 0),
    0
  );
}

function completedDirectiveCount(runtime: PersistentTownRuntime) {
  return (runtime.worldArcDirectives?.items || []).filter((item) => item.status === "completed").length;
}

function completedOfferCount(runtime: PersistentTownRuntime) {
  return (runtime.worldEventOffers?.items || []).filter((item) => item.status === "completed").length;
}

function completedRecoveryCount(runtime: PersistentTownRuntime) {
  return (runtime.campaignRecoveries?.items || []).filter((item) => item.status === "completed").length;
}

function trustedRelationshipCount(runtime: PersistentTownRuntime) {
  return Object.values(runtime.factionRelationships?.standings || {}).filter((item) => (item?.value || 0) >= 4).length;
}

function consumedPressureCount(runtime: PersistentTownRuntime) {
  return (runtime.worldPressurePulses?.items || []).reduce((total, item) => total + Math.max(0, item.consumedLayers || 0), 0);
}

function deriveApproach(runtime: PersistentTownRuntime) {
  const trusted = trustedRelationshipCount(runtime);
  const offers = completedOfferCount(runtime);
  const recoveries = completedRecoveryCount(runtime);
  const directives = completedDirectiveCount(runtime);
  const consumedPressure = consumedPressureCount(runtime);
  const paths: Array<{
    approach: ArcConvergenceApproach;
    eligible: boolean;
    signalKeys: string[];
    contextLabels: string[];
  }> = [
    {
      approach: "coalition",
      eligible: trusted > 0 || offers > 0,
      signalKeys: [trusted > 0 ? "trusted-partner" : "", offers > 0 ? "completed-opportunity" : ""].filter(Boolean),
      contextLabels: [trusted > 0 ? "Trusted town partnership" : "", offers > 0 ? "Completed world opportunity" : ""].filter(Boolean)
    },
    {
      approach: "resilience",
      eligible: recoveries > 0,
      signalKeys: recoveries > 0 ? ["completed-recovery"] : [],
      contextLabels: recoveries > 0 ? ["Recovery path completed"] : []
    },
    {
      approach: "pressure-balance",
      eligible: directives > 0 || consumedPressure > 0,
      signalKeys: [directives > 0 ? "completed-directive" : "", consumedPressure > 0 ? "consumed-pressure" : ""].filter(Boolean),
      contextLabels: [directives > 0 ? "Faction operation completed" : "", consumedPressure > 0 ? "Cross-case pressure carried" : ""].filter(Boolean)
    }
  ];
  return paths.find((path) => path.eligible);
}

export function toArcConvergencePublicSummary(runtime: PersistentTownRuntime): ArcConvergencePublicSummary {
  const state = runtime.arcConvergence || deriveArcConvergenceState(runtime);
  const campaignRoute = detectiveCampaignRouteForRuntime(runtime);
  const approachLabel = state.approach ? APPROACH_LABELS[state.approach] : "Multiple routes remain open";
  return {
    status: state.status,
    finaleLabel: campaignRoute.finaleLabel,
    approachLabel,
    caseProgressLabel: `${Math.min(REQUIRED_CASES, state.acceptedCaseCount)}/${REQUIRED_CASES} certified cases`,
    worldProgressLabel: `${Math.min(REQUIRED_STAGES, state.advancedStageCount)}/${REQUIRED_STAGES} world stages`,
    contextLabels: state.contextLabels.slice(0, 3),
    nextAction: state.status === "locked"
      ? "Close a certified case through manual investigation to begin a converging campaign history."
      : state.status === "forming"
        ? "Advance another certified case and complete a relationship, recovery, opportunity, or pressure path."
        : state.status === "ready"
          ? "A finale-family case can now appear in the normal candidate queue; any legal case remains selectable."
          : state.status === "active"
            ? "Resolve this case through its unchanged certified route to complete the campaign convergence."
            : "The campaign reached its shared finale through the history you created."
  };
}

function deriveArcConvergenceState(runtime: PersistentTownRuntime): ArcConvergenceRuntimeState {
  const accepted = acceptedCaseCount(runtime);
  const stages = advancedStageCount(runtime);
  const path = deriveApproach(runtime);
  const status: ArcConvergenceStatus = accepted === 0 && stages === 0
    ? "locked"
    : accepted >= REQUIRED_CASES && stages >= REQUIRED_STAGES && path
      ? "ready"
      : "forming";
  return {
    status,
    approach: path?.approach,
    finaleCaseType: detectiveCampaignRouteForRuntime(runtime).finaleCaseType,
    acceptedCaseCount: accepted,
    advancedStageCount: stages,
    supportingSignalCount: path?.signalKeys.length || 0,
    qualifyingSignalKeys: path?.signalKeys || [],
    contextLabels: path?.contextLabels || []
  };
}

export function refreshArcConvergence(runtime: PersistentTownRuntime) {
  const previous = runtime.arcConvergence;
  if (previous?.status === "active" || previous?.status === "completed") {
    runtime.arcConvergenceSummary = toArcConvergencePublicSummary(runtime);
    return runtime.arcConvergenceSummary;
  }
  const derived = deriveArcConvergenceState(runtime);
  const next: ArcConvergenceRuntimeState = {
    ...derived,
    formedAtTick: previous?.formedAtTick ?? (derived.status !== "locked" ? runtime.tick : undefined),
    readyAtTick: previous?.readyAtTick ?? (derived.status === "ready" ? runtime.tick : undefined)
  };
  const changed = !previous || previous.status !== next.status || previous.approach !== next.approach;
  runtime.arcConvergence = next;
  runtime.arcConvergenceSummary = toArcConvergencePublicSummary(runtime);
  if (changed) invalidateTownCandidateCache(runtime);
  runtime.updatedAt = new Date().toISOString();
  return runtime.arcConvergenceSummary;
}

export function selectArcConvergenceCaseType(runtime: PersistentTownRuntime, baseType: TownCaseType, candidateIndex: number): TownCaseType {
  return runtime.arcConvergence?.status === "ready" && candidateIndex === 0
    ? runtime.arcConvergence.finaleCaseType
    : baseType;
}

export function deriveArcConvergenceCandidateBonus(runtime: PersistentTownRuntime, caseType?: TownCaseType) {
  return runtime.arcConvergence?.status === "ready" && caseType === runtime.arcConvergence.finaleCaseType ? 3 : 0;
}

export function activateArcConvergence(runtime: PersistentTownRuntime, input: { caseId: string; caseType?: TownCaseType }) {
  const state = runtime.arcConvergence;
  if (!state || state.status !== "ready" || input.caseType !== state.finaleCaseType) return toArcConvergencePublicSummary(runtime);
  runtime.arcConvergence = {
    ...state,
    status: "active",
    activeCaseId: input.caseId,
    activatedAtTick: runtime.tick
  };
  runtime.arcConvergenceSummary = toArcConvergencePublicSummary(runtime);
  invalidateTownCandidateCache(runtime);
  runtime.updatedAt = new Date().toISOString();
  return runtime.arcConvergenceSummary;
}

export function completeArcConvergence(runtime: PersistentTownRuntime, caseId: string) {
  const state = runtime.arcConvergence;
  if (!state || state.status !== "active" || state.activeCaseId !== caseId) return undefined;
  runtime.arcConvergence = { ...state, status: "completed", completedAtTick: runtime.tick };
  runtime.arcConvergenceSummary = toArcConvergencePublicSummary(runtime);
  invalidateTownCandidateCache(runtime);
  runtime.updatedAt = new Date().toISOString();
  return runtime.arcConvergenceSummary;
}
