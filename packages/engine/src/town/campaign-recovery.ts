import type { PersistentTownRuntime } from "../persistent-town";
import type { TownInstitutionKind, TownResourceKind } from "./rules";
import { invalidateTownCandidateCache } from "./cases";
import { applyFactionRelationshipDelta, factionResourceCommitmentTerms } from "./faction-relationship";
import { reopenWorldEventOfferAfterCampaignRecovery } from "./world-event-offer";
import {
  consumeInvestigatorHeadquartersRecovery,
  investigatorHeadquartersCanRecover
} from "./investigator-headquarters";

export type CampaignRecoveryFailureKind =
  | "resource-shortage"
  | "relationship-strain"
  | "missed-opportunity"
  | "rejected-theory"
  | "blocked-operation";

export type CampaignRecoveryActionKind =
  | "restore-resource"
  | "rebuild-trust"
  | "reopen-opportunity"
  | "review-certified-route"
  | "choose-alternate-response"
  | "headquarters-route-assist";

export type CampaignRecoveryStatus = "ready" | "scheduled" | "completed";
export type CampaignRecoveryDecisionChoice = "start" | "defer" | "use-headquarters";

export type CampaignRecovery = {
  id: string;
  sourceKey: string;
  failureKind: CampaignRecoveryFailureKind;
  actionKind: CampaignRecoveryActionKind;
  status: CampaignRecoveryStatus;
  createdAtTick: number;
  selectedAtTick?: number;
  completesAtTick?: number;
  completedAtTick?: number;
  caseId?: string;
  sessionId?: string;
  resourceKind?: TownResourceKind;
  factionKind?: TownInstitutionKind;
  offerId?: string;
  appliedResourceDelta?: number;
  appliedPressureDelta?: number;
  appliedStandingDelta?: number;
  appliedOpportunityDelta?: number;
};

export type CampaignRecoveryRuntimeState = {
  activeId?: string;
  items: CampaignRecovery[];
};

export type CampaignRecoveryPublicSummary = {
  status: "empty" | CampaignRecoveryStatus;
  failureLabel: string;
  recoveryActionLabel: string;
  costLabel: string;
  progressLabel: string;
  completedCount: number;
  queuedCount: number;
  headquartersAvailable: boolean;
  headquartersActionLabel: string;
  nextAction: string;
};

export type CampaignRecoveryDecisionInput = { choice: CampaignRecoveryDecisionChoice };

const MAX_RECOVERIES = 32;
const RECOVERY_CADENCE = 5;

const FAILURE_LABELS: Record<CampaignRecoveryFailureKind, string> = {
  "resource-shortage": "A case resource is temporarily unavailable.",
  "relationship-strain": "An institution relationship is currently closed.",
  "missed-opportunity": "A world opportunity failed or expired.",
  "rejected-theory": "The submitted theory still has certified proof gaps.",
  "blocked-operation": "A faction operation cannot start under current conditions."
};

const ACTION_LABELS: Record<CampaignRecoveryActionKind, string> = {
  "restore-resource": "Take one resource recovery interval",
  "rebuild-trust": "Complete one trust-rebuilding interval",
  "reopen-opportunity": "Prepare one lower-risk opportunity retry",
  "review-certified-route": "Return to the existing certified clue route",
  "choose-alternate-response": "Choose the other legal faction response",
  "headquarters-route-assist": "Use one Headquarters evidence-handling interval"
};

function actionFor(kind: CampaignRecoveryFailureKind): CampaignRecoveryActionKind {
  if (kind === "resource-shortage") return "restore-resource";
  if (kind === "relationship-strain") return "rebuild-trust";
  if (kind === "missed-opportunity") return "reopen-opportunity";
  if (kind === "rejected-theory") return "review-certified-route";
  return "choose-alternate-response";
}

function isOpen(item: CampaignRecovery) {
  return item.status === "ready" || item.status === "scheduled";
}

function currentRecovery(runtime: PersistentTownRuntime) {
  const state = runtime.campaignRecoveries;
  if (!state?.items.length) return undefined;
  return state.items.find((item) => item.id === state.activeId && isOpen(item))
    || state.items.find(isOpen)
    || [...state.items].reverse().find((item) => item.status === "completed");
}

function retain(items: CampaignRecovery[]) {
  const open = items.filter(isOpen);
  const completed = items.filter((item) => item.status === "completed");
  return [...completed.slice(Math.max(0, completed.length - Math.max(0, MAX_RECOVERIES - open.length))), ...open].slice(-MAX_RECOVERIES);
}

function nextCadence(tick: number) {
  const remainder = tick % RECOVERY_CADENCE;
  return tick + (remainder === 0 ? RECOVERY_CADENCE : RECOVERY_CADENCE - remainder);
}

function costLabel(item: CampaignRecovery) {
  if (item.actionKind === "headquarters-route-assist") return "Uses one Headquarters Recovery assist; no answer, evidence, or truth is filled automatically.";
  if (item.actionKind === "review-certified-route") return "No resource cost; this only restores low-spoiler route guidance.";
  if (item.actionKind === "choose-alternate-response") return "No resource cost; the existing alternate response keeps its original prerequisites.";
  return "Costs one visible town institution interval; no event or case truth is rewritten.";
}

export function toCampaignRecoveryPublicSummary(runtime: PersistentTownRuntime): CampaignRecoveryPublicSummary {
  const state = runtime.campaignRecoveries || { items: [] };
  const item = currentRecovery(runtime);
  const completedCount = state.items.filter((entry) => entry.status === "completed").length;
  if (!item) {
    return {
      status: "empty",
      failureLabel: "No unresolved campaign failure is waiting.",
      recoveryActionLabel: "No recovery action required",
      costLabel: "Current world choices retain their existing costs.",
      progressLabel: "Campaign path available",
      completedCount,
      queuedCount: 0,
      headquartersAvailable: false,
      headquartersActionLabel: "No Headquarters Recovery assist",
      nextAction: "Continue the current certified investigation or world opportunity."
    };
  }
  const queuedCount = state.items.filter((entry) => entry.id !== item.id && isOpen(entry)).length;
  return {
    status: item.status,
    failureLabel: FAILURE_LABELS[item.failureKind],
    recoveryActionLabel: ACTION_LABELS[item.actionKind],
    costLabel: costLabel(item),
    progressLabel: item.status === "ready"
      ? "Recovery action ready"
      : item.status === "scheduled"
        ? "Recovery scheduled for the next legal institution cycle"
        : "Recovery completed once",
    completedCount,
    queuedCount,
    headquartersAvailable: item.failureKind === "rejected-theory" && item.status === "ready" && investigatorHeadquartersCanRecover(runtime),
    headquartersActionLabel: "Use Headquarters Recovery assist",
    nextAction: item.status === "ready"
      ? investigatorHeadquartersCanRecover(runtime) && item.failureKind === "rejected-theory"
        ? "Start the existing recovery, use the one Headquarters assist, or defer; the certified truth path remains available."
        : "Start this recovery or defer it; the current certified truth path remains available."
      : item.status === "scheduled"
        ? "Advance Persistent Town until the next institution cycle completes the recovery."
        : "Continue through the reopened world option or the unchanged certified investigation route."
  };
}

function refresh(runtime: PersistentTownRuntime) {
  runtime.campaignRecoverySummary = toCampaignRecoveryPublicSummary(runtime);
  runtime.updatedAt = new Date().toISOString();
  return runtime.campaignRecoverySummary;
}

function store(runtime: PersistentTownRuntime, item: CampaignRecovery) {
  const state = runtime.campaignRecoveries || { items: [] };
  const items = retain([...state.items.filter((entry) => entry.id !== item.id), item]);
  const nextOpen = items.find(isOpen);
  runtime.campaignRecoveries = { activeId: nextOpen?.id || item.id, items };
  return refresh(runtime);
}

export function prepareCampaignRecovery(runtime: PersistentTownRuntime, input: {
  sourceKey: string;
  failureKind: CampaignRecoveryFailureKind;
  caseId?: string;
  sessionId?: string;
  resourceKind?: TownResourceKind;
  factionKind?: TownInstitutionKind;
  offerId?: string;
}) {
  const state = runtime.campaignRecoveries || { items: [] };
  const id = `campaign-recovery-${input.sourceKey}`;
  const existing = state.items.find((item) => item.id === id);
  if (existing) return refresh(runtime);
  const item: CampaignRecovery = {
    id,
    sourceKey: input.sourceKey,
    failureKind: input.failureKind,
    actionKind: actionFor(input.failureKind),
    status: "ready",
    createdAtTick: runtime.tick,
    caseId: input.caseId,
    sessionId: input.sessionId,
    resourceKind: input.resourceKind,
    factionKind: input.factionKind,
    offerId: input.offerId
  };
  const active = currentRecovery(runtime);
  runtime.campaignRecoveries = {
    activeId: active && isOpen(active) ? active.id : item.id,
    items: retain([...state.items, item])
  };
  return refresh(runtime);
}

export function applyCampaignRecoveryDecision(runtime: PersistentTownRuntime, input: CampaignRecoveryDecisionInput) {
  const item = currentRecovery(runtime);
  if (!item || item.status !== "ready") return undefined;
  if (input.choice === "defer") return refresh(runtime);
  if (input.choice === "use-headquarters") {
    if (item.failureKind !== "rejected-theory" || !investigatorHeadquartersCanRecover(runtime)) return undefined;
    const completesAtTick = nextCadence(runtime.tick);
    runtime.maxTicks = Math.max(runtime.maxTicks, completesAtTick + 1);
    if (runtime.status === "completed") runtime.status = "paused";
    return store(runtime, { ...item, actionKind: "headquarters-route-assist", status: "scheduled", selectedAtTick: runtime.tick, completesAtTick });
  }
  if (item.actionKind === "review-certified-route" || item.actionKind === "choose-alternate-response") {
    return store(runtime, { ...item, status: "completed", selectedAtTick: runtime.tick, completedAtTick: runtime.tick });
  }
  const completesAtTick = nextCadence(runtime.tick);
  runtime.maxTicks = Math.max(runtime.maxTicks, completesAtTick + 1);
  if (runtime.status === "completed") runtime.status = "paused";
  return store(runtime, { ...item, status: "scheduled", selectedAtTick: runtime.tick, completesAtTick });
}

function restoreResource(runtime: PersistentTownRuntime, kind?: TownResourceKind) {
  if (!kind || !runtime.ruleState) return { resourceDelta: 0, pressureDelta: 0 };
  const ledger = runtime.ruleState.resourceLedger[kind];
  if (!ledger) return { resourceDelta: 0, pressureDelta: 0 };
  const beforeAvailable = ledger.available;
  const beforePressure = ledger.pressure;
  ledger.available = Math.max(0, Math.min(100, ledger.available + 2));
  ledger.pressure = Math.max(0, Math.min(100, ledger.pressure - 1));
  invalidateTownCandidateCache(runtime);
  return { resourceDelta: ledger.available - beforeAvailable, pressureDelta: ledger.pressure - beforePressure };
}

function restoreOfferPrerequisite(runtime: PersistentTownRuntime, item: CampaignRecovery) {
  const offer = runtime.worldEventOffers?.items.find((entry) => entry.id === item.offerId);
  if (!offer) return { resourceDelta: 0, pressureDelta: 0, standingDelta: 0 };
  let standingDelta = 0;
  if (offer.failureCategory === "relationship unavailable") {
    const standing = runtime.factionRelationships?.standings[offer.response.institutionKind]?.value || 0;
    applyFactionRelationshipDelta(runtime, {
      sourceKey: item.id,
      factionKind: offer.response.institutionKind,
      delta: 4,
      reason: "recovery"
    });
    standingDelta = (runtime.factionRelationships?.standings[offer.response.institutionKind]?.value || 0) - standing;
  }
  if (offer.failureCategory === "resource unavailable") {
    const definition = runtime.ruleState?.catalogLongActionDefinitions?.find((entry) => entry.kind === offer.response.longActionKind);
    const resourceKind = Object.keys(definition?.resourceCosts || {}).sort()[0] as TownResourceKind | undefined;
    const restored = restoreResource(runtime, resourceKind);
    return { ...restored, standingDelta };
  }
  return { resourceDelta: 0, pressureDelta: 0, standingDelta };
}

export function reconcileCampaignRecovery(runtime: PersistentTownRuntime) {
  const item = currentRecovery(runtime);
  if (!item || item.status !== "scheduled" || runtime.tick < (item.completesAtTick || Number.MAX_SAFE_INTEGER)) return undefined;
  let resourceDelta = 0;
  let pressureDelta = 0;
  let standingDelta = 0;
  let opportunityDelta = 0;
  if (item.actionKind === "restore-resource") {
    const restored = restoreResource(runtime, item.resourceKind);
    resourceDelta = restored.resourceDelta;
    pressureDelta = restored.pressureDelta;
  } else if (item.actionKind === "rebuild-trust" && item.factionKind) {
    const before = runtime.factionRelationships?.standings[item.factionKind]?.value || 0;
    applyFactionRelationshipDelta(runtime, { sourceKey: item.id, factionKind: item.factionKind, delta: 4, reason: "recovery" });
    standingDelta = (runtime.factionRelationships?.standings[item.factionKind]?.value || 0) - before;
  } else if (item.actionKind === "reopen-opportunity") {
    const beforeOffer = runtime.worldEventOffers?.items.find((entry) => entry.id === item.offerId);
    const restored = restoreOfferPrerequisite(runtime, item);
    resourceDelta = restored.resourceDelta;
    pressureDelta = restored.pressureDelta;
    standingDelta = restored.standingDelta;
    reopenWorldEventOfferAfterCampaignRecovery(runtime, item.offerId);
    const afterOffer = runtime.worldEventOffers?.items.find((entry) => entry.id === item.offerId);
    opportunityDelta = beforeOffer && afterOffer && beforeOffer.status !== "offered" && afterOffer.status === "offered" ? 1 : 0;
  } else if (item.actionKind === "headquarters-route-assist") {
    if (!consumeInvestigatorHeadquartersRecovery(runtime)) return undefined;
  }
  return store(runtime, {
    ...item,
    status: "completed",
    completedAtTick: runtime.tick,
    appliedResourceDelta: resourceDelta,
    appliedPressureDelta: pressureDelta,
    appliedStandingDelta: standingDelta,
    appliedOpportunityDelta: opportunityDelta
  });
}

export function syncCampaignRecoveryFromRuntime(runtime: PersistentTownRuntime) {
  const blockedCommitment = [...(runtime.playerResourceCommitments?.items || [])]
    .reverse()
    .find((item) => item.status === "blocked");
  if (blockedCommitment?.resourceKind && blockedCommitment.blockedCategory) {
    const terms = factionResourceCommitmentTerms(runtime, blockedCommitment.resourceKind);
    prepareCampaignRecovery(runtime, {
      sourceKey: `${blockedCommitment.sessionId}:${blockedCommitment.caseId}:${blockedCommitment.choice}:blocked`,
      failureKind: blockedCommitment.blockedCategory === "relationship unavailable" ? "relationship-strain" : "resource-shortage",
      caseId: blockedCommitment.caseId,
      sessionId: blockedCommitment.sessionId,
      resourceKind: blockedCommitment.resourceKind,
      factionKind: terms.factionKind
    });
  }
  const offer = [...(runtime.worldEventOffers?.items || [])]
    .reverse()
    .find((item) => (item.status === "failed" || item.status === "expired") && !item.campaignRecoveryUsed);
  if (offer) {
    prepareCampaignRecovery(runtime, {
      sourceKey: `${offer.id}:terminal`,
      failureKind: "missed-opportunity",
      factionKind: offer.response.institutionKind,
      offerId: offer.id
    });
  }
  const directive = [...(runtime.worldArcDirectives?.items || [])].reverse().find((item) => item.status === "blocked");
  if (directive) {
    prepareCampaignRecovery(runtime, {
      sourceKey: `${directive.id}:blocked`,
      failureKind: "blocked-operation",
      factionKind: directive.choice === "support" || directive.choice === "contain"
        ? directive.responses[directive.choice].institutionKind
        : undefined
    });
  }
  return refresh(runtime);
}
