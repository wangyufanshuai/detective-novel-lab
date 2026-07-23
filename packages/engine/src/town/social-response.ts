import type { PersistentTownRuntime, WorldPressurePulseDerivationInput } from "../persistent-town";
import type { NPCProfile, WorldState } from "../world-types";
import type { TownInstitutionKind } from "./rules";
import {
  deriveCompletedActionWorldPressureDirection,
  deriveWorldPressureDirectionFromActualDeltas,
  type WorldPressureDirectionDeltaInput
} from "./world-pressure";

export type TownSocialResponseStatus = "ready" | "active" | "settled";
export type TownSocialResponseDirection = "supportive" | "guarded";
export type TownSocialResponseSourceKind = "world-lead-settlement" | "faction-directive" | "world-event-offer" | "campaign-recovery";
export type TownSocialResponseReactionKind =
  | "coordinate-publicly"
  | "reassure-neighbors"
  | "resume-routine"
  | "keep-watch"
  | "avoid-contact"
  | "change-routine";

export type TownSocialResponseReaction = {
  npcId: string;
  locationId: string;
  kind: TownSocialResponseReactionKind;
  completedAtTick: number;
};

export type TownSocialResponseCycle = {
  id: string;
  sourceKey: string;
  sourceKind: TownSocialResponseSourceKind;
  status: TownSocialResponseStatus;
  direction: TownSocialResponseDirection;
  preparedAtTick: number;
  startedAtTick?: number;
  settledAtTick?: number;
  institutionId?: string;
  institutionKind?: TownInstitutionKind;
  anchorNpcId?: string;
  locationId: string;
  reactions: TownSocialResponseReaction[];
};

export type TownSocialResponseRuntimeState = {
  activeId?: string;
  lastAdvancedAtTick?: number;
  items: TownSocialResponseCycle[];
};

export type TownSocialResponsePublicReaction = {
  actorName: string;
  roleLabel: string;
  locationLabel: string;
  reactionLabel: string;
};

export type TownSocialResponsePublicSummary = {
  status: "empty" | TownSocialResponseStatus;
  direction: TownSocialResponseDirection | "none";
  directionLabel: string;
  progressLabel: string;
  headline: string;
  reactions: TownSocialResponsePublicReaction[];
  nextAction: string;
};

export type EnqueueTownSocialResponseInput = {
  sourceKey: string;
  sourceKind: TownSocialResponseSourceKind;
  direction: TownSocialResponseDirection;
  institutionId?: string;
  institutionKind?: TownInstitutionKind;
  anchorNpcId?: string;
  locationId?: string;
};

const MAX_SOCIAL_RESPONSE_RECORDS = 24;
const MAX_REACTIONS_PER_CYCLE = 3;

const REACTION_LABELS: Record<TownSocialResponseReactionKind, string> = {
  "coordinate-publicly": "coordinates openly with nearby townspeople",
  "reassure-neighbors": "reassures nearby residents",
  "resume-routine": "helps ordinary routines return",
  "keep-watch": "keeps a careful public watch",
  "avoid-contact": "avoids unnecessary contact",
  "change-routine": "changes a familiar public routine"
};

const PROFESSION_LABELS: Record<string, string> = {
  detective: "Detective",
  officer: "Police officer",
  reporter: "Reporter",
  doctor: "Doctor",
  merchant: "Merchant",
  lawyer: "Lawyer",
  clerk: "Clerk",
  dockworker: "Dock worker",
  servant: "Household staff",
  informant: "Local contact"
};

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isOpen(item: TownSocialResponseCycle) {
  return item.status === "ready" || item.status === "active";
}

function directionFromPressure(direction: "rising" | "relief"): TownSocialResponseDirection {
  return direction === "relief" ? "supportive" : "guarded";
}

export function deriveTownSocialResponseDirectionFromDeltas(input: WorldPressureDirectionDeltaInput): TownSocialResponseDirection {
  return directionFromPressure(deriveWorldPressureDirectionFromActualDeltas(input));
}

export function deriveTownSocialResponseDirectionFromCompletedAction(
  runtime: WorldPressurePulseDerivationInput["runtime"],
  action: WorldPressurePulseDerivationInput["action"]
): TownSocialResponseDirection {
  return directionFromPressure(deriveCompletedActionWorldPressureDirection(runtime, action));
}

function requestedInstitutionId(runtime: PersistentTownRuntime, input: Pick<EnqueueTownSocialResponseInput, "institutionId" | "institutionKind">) {
  if (input.institutionId && runtime.ruleState?.institutions.some((item) => item.id === input.institutionId)) return input.institutionId;
  return [...(runtime.ruleState?.institutions || [])]
    .filter((item) => item.kind === input.institutionKind)
    .sort((left, right) => left.id.localeCompare(right.id))[0]?.id;
}

function selectPublicLocation(world: WorldState, runtime: PersistentTownRuntime, input: EnqueueTownSocialResponseInput) {
  const publicLocations = world.locations.filter((location) => location.kind === "public");
  const requested = publicLocations.find((location) => location.id === input.locationId);
  if (requested) return requested.id;
  const institutionId = requestedInstitutionId(runtime, input);
  const institution = runtime.ruleState?.institutions.find((item) => item.id === institutionId);
  const influenced = publicLocations
    .map((location) => ({ id: location.id, influence: institution?.influenceByLocation[location.id] || 0 }))
    .sort((left, right) => right.influence - left.influence || left.id.localeCompare(right.id))[0];
  return influenced?.id || publicLocations.sort((left, right) => left.id.localeCompare(right.id))[0]?.id || world.locations[0]?.id || "town-square";
}

function relatedNpcIds(world: WorldState, anchorNpcId?: string) {
  if (!anchorNpcId) return new Set<string>();
  const anchor = world.npcs.find((npc) => npc.id === anchorNpcId);
  const ids = new Set(Object.keys(anchor?.relationships || {}));
  for (const npc of world.npcs) if (npc.relationships[anchorNpcId]) ids.add(npc.id);
  ids.delete(anchorNpcId);
  return ids;
}

function uniqueNpcOrder(world: WorldState, runtime: PersistentTownRuntime, cycle: TownSocialResponseCycle) {
  const living = new Map(world.npcs.filter((npc) => npc.alive).map((npc) => [npc.id, npc]));
  const institutionId = cycle.institutionId || requestedInstitutionId(runtime, cycle);
  const staff = [...(runtime.ruleState?.professions || [])]
    .filter((profession) => profession.institutionId === institutionId && living.has(profession.npcId))
    .sort((left, right) => right.rank - left.rank || left.workload - right.workload || left.npcId.localeCompare(right.npcId))
    .map((profession) => profession.npcId);
  const atLocation = runtime.agentStates
    .filter((agent) => agent.locationId === cycle.locationId && living.has(agent.npcId))
    .map((agent) => agent.npcId)
    .sort();
  const related = [...relatedNpcIds(world, cycle.anchorNpcId)].filter((npcId) => living.has(npcId)).sort();
  const fallback = [...living.keys()].sort();
  const seen = new Set<string>();
  return [...staff, ...atLocation, ...related, ...fallback].filter((npcId) => {
    if (seen.has(npcId)) return false;
    seen.add(npcId);
    return true;
  });
}

function reactionKind(cycle: TownSocialResponseCycle, npcId: string): TownSocialResponseReactionKind {
  const kinds: TownSocialResponseReactionKind[] = cycle.direction === "supportive"
    ? ["coordinate-publicly", "reassure-neighbors", "resume-routine"]
    : ["keep-watch", "avoid-contact", "change-routine"];
  return kinds[stableHash(`${cycle.sourceKey}:${npcId}:${cycle.direction}`) % kinds.length];
}

function publicRole(runtime: PersistentTownRuntime, npc: NPCProfile | undefined) {
  if (!npc) return "Town resident";
  const profession = runtime.ruleState?.professions.find((item) => item.npcId === npc.id);
  return (profession && PROFESSION_LABELS[profession.kind]) || npc.role || "Town resident";
}

function selectedCycle(runtime: PersistentTownRuntime) {
  const state = runtime.townSocialResponses;
  if (!state?.items.length) return undefined;
  const open = state.items.find((item) => item.status === "active") || state.items.find((item) => item.status === "ready");
  if (open) return open;
  return [...state.items].sort((left, right) => (right.settledAtTick || 0) - (left.settledAtTick || 0) || right.id.localeCompare(left.id))[0];
}

export function toTownSocialResponsePublicSummary(world: WorldState, runtime: PersistentTownRuntime): TownSocialResponsePublicSummary {
  const cycle = selectedCycle(runtime);
  if (!cycle) {
    return {
      status: "empty",
      direction: "none",
      directionLabel: "No public response",
      progressLabel: "0/3",
      headline: "Town routines are currently quiet.",
      reactions: [],
      nextAction: "Complete a player-driven world action to create a bounded public response."
    };
  }
  const npcById = new Map(world.npcs.map((npc) => [npc.id, npc]));
  const locationById = new Map(world.locations.map((location) => [location.id, location]));
  const reactions = cycle.reactions.slice(0, MAX_REACTIONS_PER_CYCLE).map((reaction) => ({
    actorName: npcById.get(reaction.npcId)?.name || "A town resident",
    roleLabel: publicRole(runtime, npcById.get(reaction.npcId)),
    locationLabel: locationById.get(reaction.locationId)?.name || "a public place",
    reactionLabel: REACTION_LABELS[reaction.kind]
  }));
  const directionLabel = cycle.direction === "supportive" ? "Supportive public response" : "Guarded public response";
  return {
    status: cycle.status,
    direction: cycle.direction,
    directionLabel,
    progressLabel: `${reactions.length}/${MAX_REACTIONS_PER_CYCLE}`,
    headline: cycle.status === "ready"
      ? `${directionLabel} is ready to surface.`
      : cycle.status === "active"
        ? `${directionLabel} is visible around town.`
        : `${directionLabel} has settled into the town's public routine.`,
    reactions,
    nextAction: cycle.status === "ready"
      ? "Advance Persistent Town normally to reveal one public reaction."
      : cycle.status === "active"
        ? "Continue normal town advances; each advance reveals at most one public reaction."
        : "The latest response is settled and remains separate from every investigation rule."
  };
}

export function refreshTownSocialResponseSummary(world: WorldState, runtime: PersistentTownRuntime) {
  runtime.townSocialResponseSummary = toTownSocialResponsePublicSummary(world, runtime);
  runtime.updatedAt = new Date().toISOString();
  return runtime.townSocialResponseSummary;
}

function makeRoom(items: TownSocialResponseCycle[]) {
  if (items.length < MAX_SOCIAL_RESPONSE_RECORDS) return items;
  const settled = [...items]
    .filter((item) => item.status === "settled")
    .sort((left, right) => (left.settledAtTick || 0) - (right.settledAtTick || 0) || left.id.localeCompare(right.id));
  if (!settled.length) return items;
  const remove = new Set(settled.slice(0, items.length - MAX_SOCIAL_RESPONSE_RECORDS + 1).map((item) => item.id));
  return items.filter((item) => !remove.has(item.id));
}

export function enqueueTownSocialResponse(world: WorldState, runtime: PersistentTownRuntime, input: EnqueueTownSocialResponseInput) {
  const state = runtime.townSocialResponses || { items: [] };
  const id = `town-social-response-${input.sourceKind}-${input.sourceKey}`;
  if (state.items.some((item) => item.id === id || item.sourceKey === input.sourceKey)) return refreshTownSocialResponseSummary(world, runtime);
  const retained = makeRoom(state.items);
  if (retained.length >= MAX_SOCIAL_RESPONSE_RECORDS) return refreshTownSocialResponseSummary(world, runtime);
  const item: TownSocialResponseCycle = {
    id,
    sourceKey: input.sourceKey,
    sourceKind: input.sourceKind,
    status: "ready",
    direction: input.direction,
    preparedAtTick: runtime.tick,
    institutionId: requestedInstitutionId(runtime, input),
    institutionKind: input.institutionKind,
    anchorNpcId: input.anchorNpcId,
    locationId: selectPublicLocation(world, runtime, input),
    reactions: []
  };
  const currentOpen = retained.find(isOpen);
  runtime.townSocialResponses = { ...state, activeId: currentOpen?.id || item.id, items: [...retained, item] };
  return refreshTownSocialResponseSummary(world, runtime);
}

export function advanceTownSocialResponse(world: WorldState, runtime: PersistentTownRuntime) {
  const state = runtime.townSocialResponses;
  if (!state?.items.length) return refreshTownSocialResponseSummary(world, runtime);
  if (state.lastAdvancedAtTick === runtime.tick) return refreshTownSocialResponseSummary(world, runtime);
  const current = state.items.find((item) => item.status === "active") || state.items.find((item) => item.status === "ready");
  if (!current || current.preparedAtTick >= runtime.tick) return refreshTownSocialResponseSummary(world, runtime);
  const used = new Set(current.reactions.map((reaction) => reaction.npcId));
  const order = uniqueNpcOrder(world, runtime, current);
  const nextNpcId = order.find((npcId) => !used.has(npcId));
  const reactions = nextNpcId
    ? [...current.reactions, { npcId: nextNpcId, locationId: current.locationId, kind: reactionKind(current, nextNpcId), completedAtTick: runtime.tick }]
    : current.reactions;
  const targetCount = Math.min(MAX_REACTIONS_PER_CYCLE, order.length);
  const settled = reactions.length >= targetCount;
  const next: TownSocialResponseCycle = {
    ...current,
    status: settled ? "settled" : "active",
    startedAtTick: current.startedAtTick ?? runtime.tick,
    settledAtTick: settled ? runtime.tick : undefined,
    reactions
  };
  const items = state.items.map((item) => item.id === current.id ? next : item);
  const nextOpen = items.find(isOpen);
  runtime.townSocialResponses = { activeId: nextOpen?.id || next.id, lastAdvancedAtTick: runtime.tick, items };
  return refreshTownSocialResponseSummary(world, runtime);
}

export function townSocialResponseActualDelta(input: WorldPressureDirectionDeltaInput) {
  return Object.values(input.publicOpinionDelta || {}).some((value) => (value || 0) !== 0)
    || (input.evidenceContaminationDelta || 0) !== 0
    || (input.institutionPressureDelta || 0) !== 0
    || (input.resourceAvailableDelta || 0) !== 0
    || (input.resourcePressureDelta || 0) !== 0
    || (input.relationshipDelta || 0) !== 0
    || (input.opportunityDelta || 0) !== 0;
}
