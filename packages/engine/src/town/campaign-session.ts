import type { PersistentTownRuntime } from "../persistent-town";

export type CampaignSessionStatus = "opening" | "case-active" | "transition" | "finale-ready" | "finale-active" | "completed";

export type CampaignSessionHistoryEntry = {
  caseId: string;
  cycleKey: string;
  ordinal: number;
  acceptedAtTick: number;
  consequenceLabels: string[];
};

export type CampaignSessionRuntimeState = {
  status: CampaignSessionStatus;
  targetCaseCount: number;
  maximumCaseCount: number;
  startedAtTick: number;
  cycleSequence: number;
  activeCaseId?: string;
  activeCycleKey?: string;
  activeCaseOrdinal?: number;
  completedAtTick?: number;
  completedCaseIds: string[];
  completedCycleKeys: string[];
  history: CampaignSessionHistoryEntry[];
};

export type CampaignSessionPublicSummary = {
  status: CampaignSessionStatus;
  chapterLabel: string;
  progressLabel: string;
  primaryActionLabel: string;
  consequenceLabels: string[];
  replayLabel: string;
  nextAction: string;
};

export type CampaignFinaleDebriefPublicSummary = {
  status: "locked" | "ready";
  title: string;
  approachLabel: string;
  causalBeats: string[];
  replayContrast: string;
  nextAction: string;
};

const TARGET_CASE_COUNT = 3;
const MAXIMUM_CASE_COUNT = 5;

export function ensureCampaignSession(runtime: PersistentTownRuntime) {
  runtime.campaignSession ||= {
    status: "opening",
    targetCaseCount: TARGET_CASE_COUNT,
    maximumCaseCount: MAXIMUM_CASE_COUNT,
    startedAtTick: runtime.tick,
    cycleSequence: 0,
    completedCaseIds: [],
    completedCycleKeys: [],
    history: []
  };
  runtime.campaignSession.cycleSequence = Math.max(
    runtime.campaignSession.cycleSequence || 0,
    runtime.campaignSession.completedCycleKeys?.length || 0
  );
  runtime.campaignSession.completedCaseIds = Array.from(new Set(runtime.campaignSession.completedCaseIds || [])).slice(-MAXIMUM_CASE_COUNT);
  runtime.campaignSession.completedCycleKeys = Array.from(new Set(runtime.campaignSession.completedCycleKeys || runtime.campaignSession.completedCaseIds || [])).slice(-MAXIMUM_CASE_COUNT);
  runtime.campaignSession.history = (runtime.campaignSession.history || []).slice(-MAXIMUM_CASE_COUNT);
  return runtime.campaignSession;
}

function approachLabel(runtime: PersistentTownRuntime) {
  if (runtime.arcConvergenceSummary?.approachLabel) return runtime.arcConvergenceSummary.approachLabel;
  return "Multiple campaign routes remain open";
}

function safeConsequences(runtime: PersistentTownRuntime) {
  const labels: string[] = [];
  const relationship = runtime.factionRelationshipSummary;
  if (relationship?.trustedCount) labels.push(`${relationship.trustedCount} trusted town partnership${relationship.trustedCount === 1 ? "" : "s"}`);
  if (relationship?.strainedCount) labels.push(`${relationship.strainedCount} guarded town relationship${relationship.strainedCount === 1 ? "" : "s"}`);
  const completedDirectives = (runtime.worldArcDirectives?.items || []).filter((item) => item.status === "completed").length;
  if (completedDirectives) labels.push(`${completedDirectives} faction operation${completedDirectives === 1 ? "" : "s"} completed`);
  const completedOffers = (runtime.worldEventOffers?.items || []).filter((item) => item.status === "completed").length;
  if (completedOffers) labels.push(`${completedOffers} world ${completedOffers === 1 ? "opportunity" : "opportunities"} completed`);
  const completedRecoveries = (runtime.campaignRecoveries?.items || []).filter((item) => item.status === "completed").length;
  if (completedRecoveries) labels.push(`${completedRecoveries} recovery path${completedRecoveries === 1 ? "" : "s"} completed`);
  const consumedPressure = (runtime.worldPressurePulses?.items || []).reduce((total, item) => total + Math.max(0, item.consumedLayers || 0), 0);
  if (consumedPressure) labels.push(`${consumedPressure} cross-case pressure layer${consumedPressure === 1 ? "" : "s"} carried`);
  return labels.slice(0, 4);
}

export function toCampaignSessionPublicSummary(runtime: PersistentTownRuntime): CampaignSessionPublicSummary {
  const state = ensureCampaignSession(runtime);
  const completed = state.completedCycleKeys.length;
  const status = state.status;
  return {
    status,
    chapterLabel: status === "opening"
      ? "Opening case"
      : status === "finale-ready"
        ? "Finale available"
        : status === "finale-active"
          ? "Finale case"
          : status === "completed"
            ? "Campaign complete"
            : status === "transition"
              ? "Between cases"
              : `Case ${Math.min(state.maximumCaseCount, state.activeCaseOrdinal || completed + 1)}`,
    progressLabel: `${completed}/${state.targetCaseCount} campaign cases closed`,
    primaryActionLabel: status === "opening"
      ? "Extract the first legal case"
      : status === "case-active"
        ? "Continue the certified investigation"
        : status === "transition"
          ? "Resolve the current world choice, then choose a legal next case"
          : status === "finale-ready"
            ? "Choose the finale-family candidate or any legal alternative"
            : status === "finale-active"
              ? "Close the finale through its certified route"
              : "Review how the campaign changed the town",
    consequenceLabels: safeConsequences(runtime),
    replayLabel: status === "completed"
      ? `Replay through a different route than ${approachLabel(runtime)}.`
      : "Different faction, opportunity, recovery, and pressure choices can reach the same fair finale.",
    nextAction: status === "completed"
      ? "Read the campaign debrief, then start a clean world to compare another strategy."
      : status === "finale-ready"
        ? "The normal candidate queue now includes one finale-family option without removing alternatives."
        : status === "transition"
          ? "Complete at most one visible world action, then extract the next legal case."
          : status === "opening"
            ? "Advance Persistent Town until a valid candidate appears, then extract it through the normal route."
            : "Follow the single Current world action; case truth and route certification remain unchanged."
  };
}

export function toCampaignFinaleDebriefPublicSummary(runtime: PersistentTownRuntime): CampaignFinaleDebriefPublicSummary {
  const state = ensureCampaignSession(runtime);
  if (state.status !== "completed") {
    return {
      status: "locked",
      title: "Campaign debrief locked",
      approachLabel: approachLabel(runtime),
      causalBeats: [],
      replayContrast: "Complete the converged finale to compare another campaign strategy.",
      nextAction: "Continue the current campaign through the certified case path."
    };
  }
  const consequences = safeConsequences(runtime);
  const causalBeats = [
    `${state.completedCycleKeys.length} certified investigations were closed by accepted player theories.`,
    `${approachLabel(runtime)} connected the campaign history to the shared town reckoning.`,
    ...consequences,
    "The finale remained under the same truth, evidence, route, and judgement rules as every earlier case."
  ].slice(0, 8);
  return {
    status: "ready",
    title: "Town Reckoning: Campaign Debrief",
    approachLabel: approachLabel(runtime),
    causalBeats,
    replayContrast: `A replay can replace ${approachLabel(runtime)} with another valid convergence route while keeping the finale fair.`,
    nextAction: "Start a clean world and choose a different relationship, recovery, opportunity, or pressure strategy."
  };
}

function refresh(runtime: PersistentTownRuntime) {
  runtime.campaignSessionSummary = toCampaignSessionPublicSummary(runtime);
  runtime.campaignFinaleDebrief = toCampaignFinaleDebriefPublicSummary(runtime);
  runtime.updatedAt = new Date().toISOString();
  return runtime.campaignSessionSummary;
}

export function refreshCampaignSession(runtime: PersistentTownRuntime) {
  const state = ensureCampaignSession(runtime);
  if (state.status === "completed") return refresh(runtime);
  if (runtime.arcConvergence?.status === "active") state.status = "finale-active";
  else if (state.activeCaseId) state.status = "case-active";
  else if (runtime.arcConvergence?.status === "ready") state.status = "finale-ready";
  else if (state.completedCycleKeys.length) state.status = "transition";
  else state.status = "opening";
  return refresh(runtime);
}

export function activateCampaignCase(runtime: PersistentTownRuntime, caseId: string, cycleKey = caseId) {
  const state = ensureCampaignSession(runtime);
  if (state.status === "completed") return refresh(runtime);
  if (state.activeCaseId === caseId && state.activeCycleKey) return refresh(runtime);
  state.cycleSequence += 1;
  state.activeCaseId = caseId;
  // Generated cases intentionally reuse their stable outer case id and may
  // rebuild the same candidate key without a tick. The internal extraction
  // sequence is therefore the authoritative campaign-cycle identity.
  state.activeCycleKey = `${cycleKey}:campaign-cycle-${state.cycleSequence}`;
  state.activeCaseOrdinal = Math.min(state.maximumCaseCount, state.completedCycleKeys.length + 1);
  state.status = runtime.arcConvergence?.status === "active" ? "finale-active" : "case-active";
  return refresh(runtime);
}

export function completeCampaignCase(runtime: PersistentTownRuntime, caseId: string) {
  const state = ensureCampaignSession(runtime);
  if (!state.activeCaseId || state.activeCaseId !== caseId || !state.activeCycleKey) return refresh(runtime);
  const cycleKey = state.activeCycleKey;
  if (state.completedCycleKeys.includes(cycleKey)) return refresh(runtime);
  const completedCaseIds = [...state.completedCaseIds, caseId].slice(-state.maximumCaseCount);
  const completedCycleKeys = [...state.completedCycleKeys, cycleKey].slice(-state.maximumCaseCount);
  state.completedCaseIds = completedCaseIds;
  state.completedCycleKeys = completedCycleKeys;
  state.history = [...state.history, {
    caseId,
    cycleKey,
    ordinal: completedCycleKeys.length,
    acceptedAtTick: runtime.tick,
    consequenceLabels: safeConsequences(runtime)
  }].slice(-state.maximumCaseCount);
  state.activeCaseId = undefined;
  state.activeCycleKey = undefined;
  state.activeCaseOrdinal = undefined;
  if (runtime.arcConvergence?.status === "completed") {
    state.status = "completed";
    state.completedAtTick = runtime.tick;
  } else if (runtime.arcConvergence?.status === "ready") {
    state.status = "finale-ready";
  } else {
    state.status = "transition";
  }
  return refresh(runtime);
}
