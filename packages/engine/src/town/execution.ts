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
  /** Optional diagnostic retention for bounded long-run benchmarks. */
  traceRetention?: number;
  reportRetention?: number;
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
  eventMinuteById: Map<string, number>;
  /** All exclusion/alibi events retained separately so chain assembly does not
   * rescan the complete event log once per pressure pair. */
  exclusionEvents: WorldEvent[];
  /** Per-tick cache for the bounded risk-chain selection used by ledger and
   * candidate validation. It is invalidated whenever the index receives a new
   * event so it cannot hide same-tick evidence. */
  riskChainByPair: Map<string, WorldEvent[]>;
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
    indexEventLimit: input.indexEventLimit === undefined ? undefined : Math.max(1, Math.round(input.indexEventLimit)),
    traceRetention: input.traceRetention === undefined ? undefined : Math.max(1, Math.round(input.traceRetention)),
    reportRetention: input.reportRetention === undefined ? undefined : Math.max(1, Math.round(input.reportRetention))
  };
}

function appendMapValue<T>(map: Map<string, T[]>, key: string, value: T) {
  const values = map.get(key);
  if (values) values.push(value);
  else map.set(key, [value]);
}

function eventMinuteForIndex(event: WorldEvent) {
  const [hours, minutes] = event.time.split(":").map(Number);
  return event.day * 24 * 60 + (hours || 0) * 60 + (minutes || 0);
}

export function createTownTickIndex(
  world: WorldState,
  events: WorldEvent[],
  runtime: PersistentTownRuntime,
  memoryIndex?: TownTickMemoryIndex
): TownTickIndex {
  const eventById = new Map<string, WorldEvent>();
  const eventMinuteById = new Map<string, number>();
  const exclusionEvents: WorldEvent[] = [];
  const eventsByActorId = new Map<string, WorldEvent[]>();
  const eventsByLocationId = new Map<string, WorldEvent[]>();
  for (const event of events) {
    eventById.set(event.id, event);
    eventMinuteById.set(event.id, eventMinuteForIndex(event));
    if (event.type === "alibi" || event.tags.includes("alibi_seed")) exclusionEvents.push(event);
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
    eventMinuteById,
    exclusionEvents,
    riskChainByPair: new Map(),
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
  index.eventMinuteById.set(event.id, eventMinuteForIndex(event));
  index.riskChainByPair.clear();
  if ((event.type === "alibi" || event.tags.includes("alibi_seed")) && !index.exclusionEvents.some((item) => item.id === event.id)) {
    index.exclusionEvents.push(event);
  }
  for (const npcId of new Set([...event.actorIds, ...event.relatedCharacterIds])) appendMapValue(index.eventsByActorId, npcId, event);
  appendMapValue(index.eventsByLocationId, event.locationId, event);
}

/** Refresh evidence lookup maps after a tick phase mutates the rule state.
 * Long actions and agent events can add or update chain items after the index
 * was created; candidate extraction must see those same-tick items. */
export function refreshTownEvidenceIndex(index: TownTickIndex, state?: TownRuleRuntimeState | null) {
  index.evidenceByEventId.clear();
  index.evidenceByLocationId.clear();
  for (const item of state?.evidenceChain.items || []) {
    for (const eventId of item.sourceEventIds) appendMapValue(index.evidenceByEventId, eventId, item);
    appendMapValue(index.evidenceByLocationId, item.locationId, item);
  }
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
