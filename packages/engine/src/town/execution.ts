import { computeSocialPressures } from "../world-simulator";
import type { MemoryRecord, NPCProfile, SocialPressure, WorldEvent, WorldState } from "../world-types";
import type {
  NpcAgentState,
  PersistentTownRuntime,
  TownEventObservation
} from "../persistent-town";
import type { TownRuleRuntimeState } from "./rules";

export type TownSnapshotMode = "summary" | "checkpoint";

export type TownExecutionPolicy = {
  profile: boolean;
  snapshotEveryTicks: number;
  checkpointEveryTicks: number;
  candidateEveryTicks: number;
  actionEveryTicks: number;
  indexEventLimit?: number;
};

export type TownPhaseTiming = {
  phase: string;
  calls: number;
  totalMs: number;
  maxMs: number;
};

export type TownPerformanceSummary = {
  totalMs: number;
  tickCount: number;
  averageTickMs: number;
  phases: TownPhaseTiming[];
  counters: {
    snapshotCount: number;
    checkpointCount: number;
    candidateRebuildCount: number;
    socialPressureRebuildCount: number;
  };
  growth: {
    events: number;
    memories: number;
    observations: number;
  };
};

export type TownTickIndex = {
  tick: number;
  eventById: Map<string, WorldEvent>;
  eventsByActorId: Map<string, WorldEvent[]>;
  eventsByLocationId: Map<string, WorldEvent[]>;
  memoryByNpcId: Map<string, MemoryRecord[]>;
  memoryByEventId: Map<string, MemoryRecord[]>;
  indexedMemoryCount: number;
  observationsByEventId: Map<string, TownEventObservation[]>;
  evidenceByEventId: Map<string, TownRuleRuntimeState["evidenceChain"]["items"]>;
  evidenceByLocationId: Map<string, TownRuleRuntimeState["evidenceChain"]["items"]>;
  agentStateByNpcId: Map<string, NpcAgentState>;
  socialPressures: SocialPressure[];
  pressureByNpcId: Map<string, SocialPressure[]>;
  npcById: Map<string, NPCProfile>;
  locationById: Map<string, WorldState["locations"][number]>;
};

export type TownTickMemoryIndex = Pick<TownTickIndex, "memoryByNpcId" | "memoryByEventId" | "indexedMemoryCount">;

export function normalizeTownExecutionPolicy(input: Partial<TownExecutionPolicy> = {}): TownExecutionPolicy {
  return {
    profile: input.profile ?? false,
    snapshotEveryTicks: Math.max(1, Math.round(input.snapshotEveryTicks ?? 1)),
    checkpointEveryTicks: Math.max(1, Math.round(input.checkpointEveryTicks ?? 5)),
    candidateEveryTicks: Math.max(1, Math.round(input.candidateEveryTicks ?? 1)),
    actionEveryTicks: Math.max(1, Math.round(input.actionEveryTicks ?? 1)),
    indexEventLimit: input.indexEventLimit === undefined ? undefined : Math.max(1, Math.round(input.indexEventLimit))
  };
}

function appendMapValue<T>(map: Map<string, T[]>, key: string, value: T) {
  const values = map.get(key);
  if (values) values.push(value);
  else map.set(key, [value]);
}

export function createTownTickIndex(
  world: WorldState,
  events: WorldEvent[],
  runtime: PersistentTownRuntime,
  memoryIndex?: TownTickMemoryIndex
): TownTickIndex {
  const eventById = new Map<string, WorldEvent>();
  const eventsByActorId = new Map<string, WorldEvent[]>();
  const eventsByLocationId = new Map<string, WorldEvent[]>();
  for (const event of events) {
    eventById.set(event.id, event);
    for (const npcId of new Set([...event.actorIds, ...event.relatedCharacterIds])) appendMapValue(eventsByActorId, npcId, event);
    appendMapValue(eventsByLocationId, event.locationId, event);
  }
  const memoryByNpcId = memoryIndex?.memoryByNpcId || new Map<string, MemoryRecord[]>();
  const memoryByEventId = memoryIndex?.memoryByEventId || new Map<string, MemoryRecord[]>();
  if (!memoryIndex) {
    for (const memory of world.memories || []) {
      appendMapValue(memoryByNpcId, memory.npcId, memory);
      appendMapValue(memoryByEventId, memory.eventId, memory);
    }
  }
  const observationsByEventId = new Map<string, TownEventObservation[]>();
  for (const observation of runtime.eventObservations || []) appendMapValue(observationsByEventId, observation.eventId, observation);
  const evidenceByEventId = new Map<string, TownRuleRuntimeState["evidenceChain"]["items"]>();
  const evidenceByLocationId = new Map<string, TownRuleRuntimeState["evidenceChain"]["items"]>();
  for (const item of runtime.ruleState?.evidenceChain.items || []) {
    for (const eventId of item.sourceEventIds) appendMapValue(evidenceByEventId, eventId, item);
    appendMapValue(evidenceByLocationId, item.locationId, item);
  }
  const socialPressures = computeSocialPressures(world, events);
  const pressureByNpcId = new Map<string, SocialPressure[]>();
  for (const pressure of socialPressures) appendMapValue(pressureByNpcId, pressure.npcId, pressure);
  return {
    tick: runtime.tick,
    eventById,
    eventsByActorId,
    eventsByLocationId,
    memoryByNpcId,
    memoryByEventId,
    indexedMemoryCount: memoryIndex?.indexedMemoryCount ?? (world.memories || []).length,
    observationsByEventId,
    evidenceByEventId,
    evidenceByLocationId,
    agentStateByNpcId: new Map(runtime.agentStates.map((state) => [state.npcId, state])),
    socialPressures,
    pressureByNpcId,
    npcById: new Map(world.npcs.map((npc) => [npc.id, npc])),
    locationById: new Map(world.locations.map((location) => [location.id, location]))
  };
}

export function addEventToTownTickIndex(index: TownTickIndex, event: WorldEvent) {
  index.eventById.set(event.id, event);
  for (const npcId of new Set([...event.actorIds, ...event.relatedCharacterIds])) appendMapValue(index.eventsByActorId, npcId, event);
  appendMapValue(index.eventsByLocationId, event.locationId, event);
}

export function addMemoryToTownTickIndex(index: TownTickIndex, memory: MemoryRecord) {
  if (!(index.memoryByEventId.get(memory.eventId) || []).some((item) => item.id === memory.id)) {
    appendMapValue(index.memoryByEventId, memory.eventId, memory);
  }
  if (!(index.memoryByNpcId.get(memory.npcId) || []).some((item) => item.id === memory.id)) {
    appendMapValue(index.memoryByNpcId, memory.npcId, memory);
  }
}

export function recordTownPhaseTiming(summary: TownPerformanceSummary, phase: string, elapsedMs: number) {
  const existing = summary.phases.find((item) => item.phase === phase);
  if (existing) {
    existing.calls += 1;
    existing.totalMs += elapsedMs;
    existing.maxMs = Math.max(existing.maxMs, elapsedMs);
    return;
  }
  summary.phases.push({ phase, calls: 1, totalMs: elapsedMs, maxMs: elapsedMs });
}

export function createTownPerformanceSummary(): TownPerformanceSummary {
  return {
    totalMs: 0,
    tickCount: 0,
    averageTickMs: 0,
    phases: [],
    counters: {
      snapshotCount: 0,
      checkpointCount: 0,
      candidateRebuildCount: 0,
      socialPressureRebuildCount: 0
    },
    growth: { events: 0, memories: 0, observations: 0 }
  };
}
