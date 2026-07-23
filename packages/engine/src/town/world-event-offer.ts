import type { DetectiveDirectiveResponseConfig } from "../detective-content";
import type { PersistentTownRuntime, WorldArcDirective } from "../persistent-town";
import type { NPCProfile, WorldEvent, WorldState } from "../world-types";
import {
  ensureTownRuleRuntimeState,
  releaseTownLongActionReservation,
  startTownLongAction,
  type InstitutionDecision,
  type TownLongActionReservation
} from "./rules";
import {
  applyFactionRelationshipDelta,
  factionStandingForInstitution
} from "./faction-relationship";
import { investigatorProgressionCanRecoverOffer } from "./investigator-progression";

export type WorldEventOfferStatus = "offered" | "accepted" | "declined" | "running" | "completed" | "failed" | "expired";
export type WorldEventOfferDecisionChoice = "accept" | "decline";

export type WorldEventOfferPublicSummary = {
  status: WorldEventOfferStatus;
  label: string;
  factionLabel: string;
  actionLabel: string;
  benefitLabel: string;
  costLabel: string;
  deadlineBand: "several town cycles" | "accepted" | "closed";
  progressLabel: string;
  queuedCount: number;
  recoveryLabel: string;
  recoveryAvailable: boolean;
  nextAction: string;
};

export type WorldEventOffer = {
  id: string;
  status: WorldEventOfferStatus;
  sourceDirectiveId: string;
  eventArchetypeId: string;
  sourceFactionKind?: string;
  factionLabel: string;
  label: string;
  response: DetectiveDirectiveResponseConfig;
  createdAtTick: number;
  expiresAtTick: number;
  acceptedAtTick?: number;
  declinedAtTick?: number;
  startedAtTick?: number;
  completedAtTick?: number;
  failedAtTick?: number;
  expiredAtTick?: number;
  institutionId?: string;
  actorId?: string;
  longActionId?: string;
  startEventId?: string;
  completionEventId?: string;
  reservedResources?: TownLongActionReservation;
  reservationReleasedAtTick?: number;
  recoveryAttempts?: number;
  campaignRecoveryUsed?: boolean;
  failureCategory?: "relationship unavailable" | "institution unavailable" | "staff unavailable" | "resource unavailable" | "operation unavailable";
};

export type WorldEventOfferRuntimeState = {
  activeId?: string;
  items: WorldEventOffer[];
};

export type WorldEventOfferDecisionInput = {
  choice: WorldEventOfferDecisionChoice;
};

const MAX_WORLD_EVENT_OFFERS = 32;
const OFFER_LIFETIME_TICKS = 20;

function terminal(status: WorldEventOfferStatus) {
  return status === "declined" || status === "completed" || status === "failed" || status === "expired";
}

function currentOffer(runtime: PersistentTownRuntime) {
  const state = runtime.worldEventOffers;
  if (!state?.items.length) return undefined;
  return state.items.find((item) => item.id === state.activeId)
    || state.items.find((item) => !terminal(item.status))
    || state.items[state.items.length - 1];
}

function retainOffers(items: WorldEventOffer[]) {
  if (items.length <= MAX_WORLD_EVENT_OFFERS) return items;
  const open = items.filter((item) => !terminal(item.status));
  const closed = items.filter((item) => terminal(item.status));
  return [...closed.slice(Math.max(0, closed.length - Math.max(0, MAX_WORLD_EVENT_OFFERS - open.length))), ...open].slice(-MAX_WORLD_EVENT_OFFERS);
}

function offerProgress(runtime: PersistentTownRuntime, offer: WorldEventOffer) {
  if (offer.status === "offered") return "Awaiting player decision";
  if (offer.status === "accepted") return "Accepted / waiting for the next legal institution cycle";
  if (offer.status === "declined") return "Declined without changing town resources";
  if (offer.status === "completed") return "Opportunity completed through an existing town operation";
  if (offer.status === "failed") return `Failed / ${offer.failureCategory || "operation unavailable"}`;
  if (offer.status === "expired") return "Expired after several unaccepted town cycles";
  const action = runtime.ruleState?.longActions.find((item) => item.id === offer.longActionId);
  return action ? `Operation ${Math.max(0, Math.min(100, action.progress))}% complete` : "Opportunity operation in progress";
}

function offerNextAction(runtime: PersistentTownRuntime, offer: WorldEventOffer) {
  if (offer.status === "offered") return "Accept or decline this opportunity without advancing the town clock.";
  if (offer.status === "accepted") return "Advance Persistent Town; the accepted opportunity starts on the next legal institution cycle.";
  if (offer.status === "running") return "Advance Persistent Town to complete the existing multi-tick operation.";
  if (offer.status === "failed") return investigatorProgressionCanRecoverOffer(runtime) && !offer.recoveryAttempts
    ? "Use the one unlocked investigator recovery retry after restoring the named prerequisite."
    : "Use the named recovery path; a later offer may reopen after world conditions improve.";
  if (offer.status === "declined") return "Continue the current case path; declining never changes current-case fairness.";
  if (offer.status === "expired") return investigatorProgressionCanRecoverOffer(runtime) && !offer.recoveryAttempts
    ? "Restore the prerequisite, then use the one unlocked investigator recovery retry."
    : "Continue the town cycle; expiration creates no hidden penalty.";
  return "The durable result and explicit relationship recovery now shape only future world choices.";
}

export function toWorldEventOfferPublicSummary(runtime: PersistentTownRuntime, offerOverride?: WorldEventOffer): WorldEventOfferPublicSummary | undefined {
  const offer = offerOverride || currentOffer(runtime);
  if (!offer) return undefined;
  const queuedCount = (runtime.worldEventOffers?.items || []).filter((item) => item.id !== offer.id && !terminal(item.status)).length;
  return {
    status: offer.status,
    label: offer.label,
    factionLabel: offer.factionLabel,
    actionLabel: offer.response.label,
    benefitLabel: offer.response.benefitLabel,
    costLabel: offer.response.costLabel,
    deadlineBand: offer.status === "offered" ? "several town cycles" : offer.status === "accepted" || offer.status === "running" ? "accepted" : "closed",
    progressLabel: offerProgress(runtime, offer),
    queuedCount,
    recoveryLabel: offer.status === "failed" || offer.status === "expired"
      ? investigatorProgressionCanRecoverOffer(runtime) && !offer.recoveryAttempts
        ? "Restore the named prerequisite; an established investigator may retry this offer once without changing the current case."
        : "Improve the named institution relationship or restore the required existing resource before a future opportunity."
      : "Completed offers improve one operating-institution standing; declined or expired offers add no hidden penalty.",
    recoveryAvailable: (offer.status === "failed" || offer.status === "expired") && investigatorProgressionCanRecoverOffer(runtime) && !offer.recoveryAttempts,
    nextAction: offerNextAction(runtime, offer)
  };
}

function refreshSummary(runtime: PersistentTownRuntime, offerOverride?: WorldEventOffer) {
  runtime.worldEventOfferSummary = toWorldEventOfferPublicSummary(runtime, offerOverride);
  runtime.updatedAt = new Date().toISOString();
  return runtime.worldEventOfferSummary;
}

function storeOffer(runtime: PersistentTownRuntime, offer: WorldEventOffer, makeActive = true) {
  const state = runtime.worldEventOffers || { items: [] };
  runtime.worldEventOffers = {
    activeId: makeActive ? offer.id : state.activeId,
    items: retainOffers([...state.items.filter((item) => item.id !== offer.id), offer])
  };
  return refreshSummary(runtime, offer);
}

export function enqueueWorldEventOffer(runtime: PersistentTownRuntime, input: {
  sourceDirectiveId: string;
  eventArchetypeId: string;
  sourceFactionKind?: string;
  factionLabel: string;
  response: DetectiveDirectiveResponseConfig;
}) {
  const state = runtime.worldEventOffers || { items: [] };
  const id = `world-event-offer-${input.sourceDirectiveId}`;
  const existing = state.items.find((item) => item.id === id);
  if (existing) return refreshSummary(runtime, existing);
  if (state.items.length >= MAX_WORLD_EVENT_OFFERS && state.items.every((item) => !terminal(item.status))) return refreshSummary(runtime);
  const offer: WorldEventOffer = {
    id,
    status: "offered",
    sourceDirectiveId: input.sourceDirectiveId,
    eventArchetypeId: input.eventArchetypeId,
    sourceFactionKind: input.sourceFactionKind,
    factionLabel: input.factionLabel,
    label: `${input.factionLabel} follow-up opportunity`,
    response: { ...input.response },
    createdAtTick: runtime.tick,
    expiresAtTick: runtime.tick + OFFER_LIFETIME_TICKS
  };
  const active = currentOffer(runtime);
  const makeActive = !active || terminal(active.status);
  runtime.worldEventOffers = {
    activeId: makeActive ? offer.id : state.activeId,
    items: retainOffers([...state.items, offer])
  };
  return refreshSummary(runtime, makeActive ? offer : active);
}

export function enqueueWorldEventOfferFromCompletedDirective(runtime: PersistentTownRuntime, directive: WorldArcDirective) {
  if (directive.status !== "completed" || (directive.choice !== "support" && directive.choice !== "contain")) return undefined;
  const preferred = directive.choice === "support" ? directive.responses.contain : directive.responses.support;
  const fallback = directive.responses[directive.choice];
  const canReserve = (response: DetectiveDirectiveResponseConfig) => {
    const state = runtime.ruleState;
    const definition = state?.catalogLongActionDefinitions?.find((item) => item.kind === response.longActionKind);
    if (!state || !definition) return true;
    return Object.entries(definition.resourceCosts).every(([kind, cost]) => {
      if (!cost || cost < 0) return true;
      return (state.resourceLedger[kind as keyof typeof state.resourceLedger]?.available || 0) >= cost;
    });
  };
  const response = canReserve(preferred) || !canReserve(fallback) ? preferred : fallback;
  return enqueueWorldEventOffer(runtime, {
    sourceDirectiveId: directive.id,
    eventArchetypeId: directive.eventArchetypeId,
    sourceFactionKind: directive.sourceFactionKind,
    factionLabel: directive.factionLabel,
    response
  });
}

export function applyWorldEventOfferDecision(runtime: PersistentTownRuntime, input: WorldEventOfferDecisionInput) {
  const offer = currentOffer(runtime);
  const recovery = offer && input.choice === "accept" && (offer.status === "failed" || offer.status === "expired")
    && !offer.recoveryAttempts && investigatorProgressionCanRecoverOffer(runtime);
  if (!offer || (offer.status !== "offered" && !recovery)) return undefined;
  const next: WorldEventOffer = input.choice === "accept"
    ? {
        ...offer,
        status: "accepted",
        acceptedAtTick: runtime.tick,
        recoveryAttempts: recovery ? 1 : offer.recoveryAttempts,
        expiresAtTick: recovery ? runtime.tick + OFFER_LIFETIME_TICKS : offer.expiresAtTick,
        failureCategory: undefined,
        failedAtTick: undefined,
        expiredAtTick: undefined
      }
    : { ...offer, status: "declined", declinedAtTick: runtime.tick };
  if (input.choice === "accept") {
    runtime.maxTicks = Math.max(runtime.maxTicks, runtime.tick + 16);
    if (runtime.status === "completed") runtime.status = "paused";
  }
  storeOffer(runtime, next);
  return refreshSummary(runtime, next);
}

export function reopenWorldEventOfferAfterCampaignRecovery(runtime: PersistentTownRuntime, offerId?: string) {
  const state = runtime.worldEventOffers;
  if (!state?.items.length) return undefined;
  const offer = (offerId ? state.items.find((item) => item.id === offerId) : undefined)
    || [...state.items].reverse().find((item) => item.status === "failed" || item.status === "expired");
  if (!offer || (offer.status !== "failed" && offer.status !== "expired") || offer.campaignRecoveryUsed) return undefined;
  const reopened: WorldEventOffer = {
    ...offer,
    status: "offered",
    campaignRecoveryUsed: true,
    expiresAtTick: runtime.tick + OFFER_LIFETIME_TICKS,
    failedAtTick: undefined,
    expiredAtTick: undefined,
    failureCategory: undefined,
    acceptedAtTick: undefined,
    startedAtTick: undefined,
    longActionId: undefined,
    startEventId: undefined,
    completionEventId: undefined,
    reservedResources: undefined,
    reservationReleasedAtTick: undefined
  };
  storeOffer(runtime, reopened);
  return runtime.worldEventOfferSummary;
}

function failureCategory(reason?: string): NonNullable<WorldEventOffer["failureCategory"]> {
  if (/relationship/i.test(reason || "")) return "relationship unavailable";
  if (/institution/i.test(reason || "")) return "institution unavailable";
  if (/actor|staff|running/i.test(reason || "")) return "staff unavailable";
  if (/insufficient|resource|capacity|credit|trust|docket|time/i.test(reason || "")) return "resource unavailable";
  return "operation unavailable";
}

function promoteNextOffer(runtime: PersistentTownRuntime) {
  const state = runtime.worldEventOffers;
  const active = currentOffer(runtime);
  if (!state || !active || !terminal(active.status)) return active;
  const next = state.items.find((item) => !terminal(item.status));
  if (!next) return active;
  runtime.worldEventOffers = { ...state, activeId: next.id };
  refreshSummary(runtime, next);
  return next;
}

export function startAcceptedWorldEventOffer(world: WorldState, events: WorldEvent[], runtime: PersistentTownRuntime) {
  let offer = promoteNextOffer(runtime);
  if (!offer) return { events: [] as WorldEvent[], excludedInstitutionIds: [] as string[] };
  if (offer.status === "offered" && runtime.tick >= offer.expiresAtTick) {
    offer = { ...offer, status: "expired", expiredAtTick: runtime.tick };
    storeOffer(runtime, offer);
    return { events: [] as WorldEvent[], excludedInstitutionIds: [] as string[] };
  }
  if (offer.status === "offered" && offer.createdAtTick === runtime.tick) {
    const institutionId = runtime.ruleState?.institutions
      .filter((item) => item.kind === offer.response.institutionKind)
      .sort((left, right) => left.id.localeCompare(right.id))[0]?.id;
    return { events: [] as WorldEvent[], excludedInstitutionIds: institutionId ? [institutionId] : [] as string[] };
  }
  if (offer.status !== "accepted" || runtime.tick % 5 !== 0) return { events: [] as WorldEvent[], excludedInstitutionIds: [] as string[] };
  const standing = factionStandingForInstitution(runtime, offer.response.institutionKind);
  if (standing === "hostile") {
    storeOffer(runtime, { ...offer, status: "failed", failedAtTick: runtime.tick, failureCategory: "relationship unavailable" });
    return { events: [] as WorldEvent[], excludedInstitutionIds: [] as string[] };
  }
  const ruleState = ensureTownRuleRuntimeState(world, runtime);
  const institution = [...ruleState.institutions]
    .filter((item) => item.kind === offer.response.institutionKind)
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  if (!institution) {
    storeOffer(runtime, { ...offer, status: "failed", failedAtTick: runtime.tick, failureCategory: "institution unavailable" });
    return { events: [] as WorldEvent[], excludedInstitutionIds: [] as string[] };
  }
  const living = new Set(world.npcs.filter((npc) => npc.alive).map((npc) => npc.id));
  const profession = [...ruleState.professions]
    .filter((item) => item.institutionId === institution.id && living.has(item.npcId))
    .sort((left, right) => right.rank - left.rank || left.workload - right.workload || left.npcId.localeCompare(right.npcId))[0];
  const actor: NPCProfile | undefined = profession ? world.npcs.find((npc) => npc.id === profession.npcId && npc.alive) : undefined;
  if (!profession || !actor) {
    storeOffer(runtime, { ...offer, status: "failed", failedAtTick: runtime.tick, institutionId: institution.id, failureCategory: "staff unavailable" });
    return { events: [] as WorldEvent[], excludedInstitutionIds: [] as string[] };
  }
  const targetLocationId = Object.entries(institution.influenceByLocation)
    .sort(([leftId, left], [rightId, right]) => right - left || leftId.localeCompare(rightId))[0]?.[0]
    || world.locations[0]?.id
    || "town-square";
  const started = startTownLongAction({
    world,
    state: ruleState,
    actor,
    kind: offer.response.longActionKind,
    events,
    tick: runtime.tick,
    targetLocationId,
    institutionId: institution.id
  });
  if (!started.action) {
    storeOffer(runtime, { ...offer, status: "failed", failedAtTick: runtime.tick, institutionId: institution.id, actorId: actor.id, failureCategory: failureCategory(started.blockedReason) });
    return { events: [] as WorldEvent[], excludedInstitutionIds: [] as string[] };
  }
  const eventId = `world-event-offer-start-${offer.id}`;
  started.action.eventIds = [eventId];
  const decision: InstitutionDecision = {
    id: `world-event-offer-decision-${offer.id}`,
    tick: runtime.tick,
    institutionId: institution.id,
    strategy: offer.response.strategy,
    reason: "A player-accepted world event offer enters the existing institution and long-action cycle.",
    targetNpcId: actor.id,
    targetLocationId,
    eventId,
    worldSystemLabels: [offer.factionLabel, offer.label]
  };
  ruleState.institutionDecisions = [decision, ...(ruleState.institutionDecisions || [])].slice(0, 80);
  const event: WorldEvent = {
    id: eventId,
    worldId: world.id,
    day: runtime.currentDay,
    time: runtime.currentTime,
    type: offer.response.strategy === "chase-headline" || offer.response.strategy === "cultivate-informant" ? "witness" : "obtain_item",
    actorIds: [],
    locationId: targetLocationId,
    summary: "An accepted world event opportunity begins through an existing town institution.",
    publicSummary: "A player-accepted opportunity has started and will take multiple town ticks.",
    hidden: false,
    relatedCharacterIds: [],
    tags: ["world_event_offer", "offer_start", offer.response.strategy],
    causedByEventIds: [],
    explanation: "The accepted offer passed relationship, institution, actor, and resource checks."
  };
  storeOffer(runtime, {
    ...offer,
    status: "running",
    institutionId: institution.id,
    actorId: actor.id,
    longActionId: started.action.id,
    startEventId: eventId,
    startedAtTick: runtime.tick,
    reservedResources: started.reservedResources,
    reservationReleasedAtTick: undefined,
    failureCategory: undefined
  });
  return { events: [event], excludedInstitutionIds: [institution.id] };
}

export function reconcileWorldEventOfferLongAction(world: WorldState, runtime: PersistentTownRuntime): WorldEvent[] {
  const offer = currentOffer(runtime);
  if (!offer || offer.status !== "running") return [];
  const ruleState = ensureTownRuleRuntimeState(world, runtime);
  const action = ruleState.longActions.find((item) => item.id === offer.longActionId);
  if (action?.status === "completed") {
    if (offer.completionEventId) return [];
    const completionEventId = `world-event-offer-complete-${offer.id}`;
    const completed: WorldEventOffer = { ...offer, status: "completed", completedAtTick: runtime.tick, completionEventId };
    storeOffer(runtime, completed);
    applyFactionRelationshipDelta(runtime, {
      sourceKey: offer.id,
      factionKind: offer.response.institutionKind,
      delta: 1,
      reason: "recovery"
    });
    refreshSummary(runtime, completed);
    return [{
      id: completionEventId,
      worldId: world.id,
      day: runtime.currentDay,
      time: runtime.currentTime,
      type: "forensic_clue",
      actorIds: [],
      locationId: action.targetLocationId || world.locations[0]?.id || "town-square",
      summary: "A player-accepted world event opportunity reaches its durable result.",
      publicSummary: "A bounded world opportunity completes and one institution relationship improves.",
      hidden: false,
      relatedCharacterIds: [],
      tags: ["world_event_offer", "offer_complete"],
      causedByEventIds: offer.startEventId ? [offer.startEventId] : [],
      explanation: "The existing long-action lifecycle completed the accepted offer."
    }];
  }
  if (!action || action.status === "blocked" || action.status === "cancelled") {
    if (!offer.reservationReleasedAtTick && offer.reservedResources) releaseTownLongActionReservation(ruleState, offer.reservedResources);
    storeOffer(runtime, {
      ...offer,
      status: "failed",
      failedAtTick: runtime.tick,
      reservationReleasedAtTick: offer.reservationReleasedAtTick || runtime.tick,
      failureCategory: failureCategory(action?.blockedReason || "operation unavailable")
    });
  }
  return [];
}
