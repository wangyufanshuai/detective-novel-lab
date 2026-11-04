import { deriveNpcAgentState, type PersistentTownRuntime } from "../persistent-town";
import type { NPCProfile, PopulationFlowRecord, WorldEvent, WorldLocation, WorldState } from "../world-types";

type RuntimeWorld = WorldState & { persistentRuntime?: PersistentTownRuntime };

export type PopulationFlowInput = {
  /** A pre-existing event in the authoritative event log. */
  sourceEventId: string;
  /** Optional durable Agent action identity. Automatic cadence leaves this absent. */
  agentActionId?: string;
  /** Source references captured when an Agent executor issued the flow. */
  agentSourceRefs?: string[];
  /** Optional candidate/chain identity that makes the flow key more specific. */
  sourceCandidateId?: string;
  /** Stable, authored explanation stored in the provenance ledger. */
  reason?: string;
  /** Optional deterministic override for a valid town location. */
  arrivalLocationId?: string;
  /** Optional replay override. Defaults to the runtime/world clock. */
  day?: number;
  time?: string;
};

export type PopulationFlowResult = {
  world: WorldState;
  runtime: PersistentTownRuntime;
  event: WorldEvent;
  record: PopulationFlowRecord;
  created: boolean;
  createdEvents: WorldEvent[];
};

export type PopulationFlowPolicy = {
  /** Automatic cadence is opt-in. A missing policy is treated as disabled. */
  enabled: boolean;
  /** Run the source selector every N completed town ticks. */
  cadenceTicks: number;
  /** Hard living-resident cap, including authored residents and newcomers. */
  maxResidents: number;
  /** Bound the number of newcomers created by one cadence. */
  maxFlowsPerTick: number;
  /** Require a source event to be this many simulated ticks old. */
  minSourceAgeTicks: number;
  /** Give a newly arrived resident a bounded opportunity to take its first action. */
  newcomerFirstActionWindowTicks: number;
};

export const DEFAULT_POPULATION_FLOW_POLICY: Readonly<PopulationFlowPolicy> = {
  enabled: false,
  cadenceTicks: 24,
  maxResidents: 64,
  maxFlowsPerTick: 1,
  minSourceAgeTicks: 1,
  newcomerFirstActionWindowTicks: 24
};

export type PopulationFlowCadenceResult = {
  world: WorldState;
  runtime: PersistentTownRuntime;
  events: WorldEvent[];
  createdRecords: PopulationFlowRecord[];
  createdEvents: WorldEvent[];
  skippedReason?: "disabled" | "cadence" | "population-cap" | "no-source";
};

const POPULATION_NAMES = ["沈岚", "周砚", "顾遥", "林澈", "唐栖", "许棠", "孟舟", "苏弦"];
const POPULATION_ROLES = ["流动修复师", "旧档案抄写员", "夜班药剂师", "旅店账房", "巡路测绘员"];
const RELATIONSHIP_KINDS: Array<NPCProfile["relationships"][string]> = ["friend", "debt", "secret", "rival", "family"];
const SCHEDULE_TIMES = ["08:00", "12:00", "16:00", "20:00"];

function stableHash(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hashHex(input: string) {
  return stableHash(input).toString(16).padStart(8, "0");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function locationAt(world: WorldState, index: number) {
  const locations = world.locations;
  if (!locations.length) throw new Error("population flow requires at least one world location");
  return locations[((index % locations.length) + locations.length) % locations.length];
}

function validTime(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(":").map(Number);
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60;
}

function existingPopulationRecord(runtime: PersistentTownRuntime, flowKey: string, id: string) {
  return (runtime.populationFlowLedger || []).find((item) => item.flowKey === flowKey || item.id === id);
}

function finiteInteger(value: unknown, fallback: number, minimum: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(minimum, Math.floor(value)) : fallback;
}

export function normalizePopulationFlowPolicy(value: unknown, fallback: PopulationFlowPolicy = DEFAULT_POPULATION_FLOW_POLICY): PopulationFlowPolicy {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<PopulationFlowPolicy> : {};
  return {
    enabled: source.enabled === true,
    cadenceTicks: finiteInteger(source.cadenceTicks, fallback.cadenceTicks, 1),
    maxResidents: finiteInteger(source.maxResidents, fallback.maxResidents, 1),
    maxFlowsPerTick: Math.min(8, finiteInteger(source.maxFlowsPerTick, fallback.maxFlowsPerTick, 1)),
    minSourceAgeTicks: finiteInteger(source.minSourceAgeTicks, fallback.minSourceAgeTicks, 0),
    newcomerFirstActionWindowTicks: finiteInteger(source.newcomerFirstActionWindowTicks, fallback.newcomerFirstActionWindowTicks, 1)
  };
}

function clockMinutes(day: number, time: string) {
  const [hours, minutes] = /^\d{2}:\d{2}$/.test(time) ? time.split(":").map(Number) : [0, 0];
  return Math.max(1, Math.floor(day || 1)) * 24 * 60 + hours * 60 + minutes;
}

function sourceEventEligible(event: WorldEvent) {
  if (event.type === "arrival" || event.tags.includes("population_flow")) return false;
  return event.tags.includes("population_source") || (
    event.type === "incident" && event.tags.includes("source_backed")
  );
}

function candidateIdForSource(runtime: PersistentTownRuntime, eventId: string) {
  return runtime.candidates
    .filter((candidate) => candidate.triggeredEventId === eventId)
    .sort((left, right) => left.id.localeCompare(right.id))[0]?.id;
}

/** Select source-backed population opportunities without using actor rank or wall-clock metadata. */
export function selectPopulationFlowInputs(
  world: WorldState,
  runtime: PersistentTownRuntime,
  events: WorldEvent[] = [],
  policy: PopulationFlowPolicy = normalizePopulationFlowPolicy(runtime.populationFlowPolicy)
): PopulationFlowInput[] {
  if (!policy.enabled) return [];
  const livingCount = world.npcs.filter((npc) => npc.alive !== false).length;
  const remainingCapacity = Math.max(0, policy.maxResidents - livingCount);
  if (!remainingCapacity) return [];
  const existingSourceIds = new Set((runtime.populationFlowLedger || []).map((record) => record.sourceEventId));
  const nowMinute = clockMinutes(runtime.currentDay, runtime.currentTime);
  const minimumAgeMinutes = policy.minSourceAgeTicks * Math.max(1, runtime.tickIntervalMinutes || 1);
  return events
    .filter((event) => sourceEventEligible(event) && !existingSourceIds.has(event.id))
    .filter((event) => nowMinute - clockMinutes(event.day, event.time) >= minimumAgeMinutes)
    .sort((left, right) => clockMinutes(left.day, left.time) - clockMinutes(right.day, right.time) || left.id.localeCompare(right.id))
    .slice(0, Math.min(policy.maxFlowsPerTick, remainingCapacity))
    .map((event) => ({
      sourceEventId: event.id,
      sourceCandidateId: candidateIdForSource(runtime, event.id),
      reason: "受控人口流动策略只接受已存在、可定位且达到最小年龄的来源事件。"
    }));
}

/** Apply the opt-in cadence as a bounded, replayable sequence of explicit flow commands. */
export function advancePopulationFlowCadence(
  world: WorldState,
  runtime: PersistentTownRuntime,
  events: WorldEvent[] = []
): PopulationFlowCadenceResult {
  const policy = normalizePopulationFlowPolicy(runtime.populationFlowPolicy);
  runtime.populationFlowPolicy = policy;
  if (!policy.enabled) return { world, runtime, events, createdRecords: [], createdEvents: [], skippedReason: "disabled" };
  if (runtime.tick <= 0 || runtime.tick % policy.cadenceTicks !== 0) {
    return { world, runtime, events, createdRecords: [], createdEvents: [], skippedReason: "cadence" };
  }
  if (world.npcs.filter((npc) => npc.alive !== false).length >= policy.maxResidents) {
    return { world, runtime, events, createdRecords: [], createdEvents: [], skippedReason: "population-cap" };
  }
  const inputs = selectPopulationFlowInputs(world, runtime, events, policy);
  if (!inputs.length) return { world, runtime, events, createdRecords: [], createdEvents: [], skippedReason: "no-source" };

  let nextWorld = world;
  let nextRuntime = runtime;
  let nextEvents = events;
  const createdRecords: PopulationFlowRecord[] = [];
  const createdEvents: WorldEvent[] = [];
  for (const input of inputs) {
    const result = applyPopulationFlow(nextWorld, nextRuntime, nextEvents, input);
    nextWorld = result.world;
    nextRuntime = result.runtime;
    nextEvents = [...nextEvents, ...result.createdEvents];
    if (result.created) {
      createdRecords.push(result.record);
      createdEvents.push(...result.createdEvents);
    }
  }
  (nextWorld as RuntimeWorld).persistentRuntime = nextRuntime;
  return { world: nextWorld, runtime: nextRuntime, events: nextEvents, createdRecords, createdEvents };
}

/**
 * Apply one source-backed newcomer to a cloned world/runtime boundary.
 *
 * The operation is intentionally explicit: a caller chooses the source event,
 * and the same `(world, sourceEventId, sourceCandidateId)` can be replayed
 * without creating a second resident. No wall-clock value participates in an
 * identity, schedule, relationship, or event payload.
 */
export function applyPopulationFlow(
  world: WorldState,
  runtime: PersistentTownRuntime,
  events: WorldEvent[] = [],
  input: PopulationFlowInput
): PopulationFlowResult {
  if (!input || typeof input.sourceEventId !== "string" || !input.sourceEventId) throw new Error("population flow sourceEventId is required");
  if (input.agentActionId !== undefined && (typeof input.agentActionId !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,127}$/.test(input.agentActionId))) throw new Error("population flow agentActionId must be 3-128 characters using letters, numbers, '.', '_', ':', or '-'");
  if (input.agentSourceRefs !== undefined && (!Array.isArray(input.agentSourceRefs) || input.agentSourceRefs.length < 1 || input.agentSourceRefs.length > 12 || input.agentSourceRefs.some((ref) => typeof ref !== "string" || !ref.trim() || ref.length > 240))) throw new Error("population flow agentSourceRefs must contain 1-12 non-empty strings of at most 240 characters");
  if (input.sourceCandidateId !== undefined && typeof input.sourceCandidateId !== "string") throw new Error("population flow sourceCandidateId must be a string");
  if (input.reason !== undefined && typeof input.reason !== "string") throw new Error("population flow reason must be a string");
  if (input.arrivalLocationId !== undefined && typeof input.arrivalLocationId !== "string") throw new Error("population flow arrivalLocationId must be a string");
  if (input.day !== undefined && (typeof input.day !== "number" || !Number.isFinite(input.day))) throw new Error("population flow day must be a finite number");
  if (input.time !== undefined && !validTime(input.time)) throw new Error("population flow time must be a valid HH:MM value");
  if (runtime.worldId !== world.id) throw new Error(`population flow runtime belongs to another world: ${runtime.worldId}`);
  const sourceEvent = events.find((event) => event.id === input.sourceEventId);
  if (!sourceEvent) throw new Error(`population flow source event not found: ${input.sourceEventId}`);
  if (sourceEvent.worldId !== world.id) throw new Error(`population flow source event belongs to another world: ${input.sourceEventId}`);

  const flowKey = `${world.id}|${input.sourceEventId}|${input.sourceCandidateId || ""}`;
  const flowId = `population-flow-${hashHex(flowKey)}`;
  const arrivalEventId = `${flowId}:arrival`;
  const nextWorld = clone(world) as RuntimeWorld;
  const nextRuntime = clone(runtime);
  const nextEvents = clone(events);
  nextRuntime.populationFlowLedger ||= [];

  const prior = existingPopulationRecord(nextRuntime, flowKey, flowId);
  if (prior) {
    if (input.agentActionId && !prior.agentActionId) {
      throw new Error(`population flow ${prior.id} was already created outside Agent action ${input.agentActionId}`);
    }
    if (input.agentActionId && prior.agentActionId !== input.agentActionId) {
      throw new Error(`population flow ${prior.id} is already bound to Agent action ${prior.agentActionId}`);
    }
    const existingNpc = nextWorld.npcs.find((npc) => npc.id === prior.npcId);
    const existingEvent = nextEvents.find((event) => event.id === prior.arrivalEventId);
    if (!existingNpc || !existingEvent) {
      throw new Error(`population flow ledger is not replayable: ${prior.id}`);
    }
    nextWorld.persistentRuntime = nextRuntime;
    return {
      world: nextWorld,
      runtime: nextRuntime,
      event: existingEvent,
      record: prior,
      created: false,
      createdEvents: []
    };
  }

  if (nextWorld.npcs.some((npc) => npc.id === `npc-pop-${hashHex(flowKey)}`)) {
    throw new Error(`population flow identity collision: ${flowId}`);
  }
  if (nextEvents.some((event) => event.id === arrivalEventId)) {
    throw new Error(`population flow event identity collision: ${arrivalEventId}`);
  }

  const flowHash = hashHex(flowKey);
  const numericHash = stableHash(flowKey);
  const npcId = `npc-pop-${flowHash}`;
  const arrivalLocation = input.arrivalLocationId
    ? nextWorld.locations.find((location) => location.id === input.arrivalLocationId)
    : nextWorld.locations.find((location) => location.id === sourceEvent.locationId);
  const resolvedArrivalLocation = arrivalLocation || locationAt(nextWorld, numericHash);
  const aliveNpcIds = nextWorld.npcs.filter((npc) => npc.alive !== false).sort((left, right) => left.id.localeCompare(right.id));
  const relationshipNpcIds = aliveNpcIds.length
    ? Array.from({ length: Math.min(3, aliveNpcIds.length) }, (_, index) => aliveNpcIds[(numericHash + index * 7) % aliveNpcIds.length].id)
    : [];
  const sourceNpcIds = uniqueSorted([
    ...sourceEvent.actorIds,
    ...sourceEvent.relatedCharacterIds,
    ...relationshipNpcIds
  ]);
  const baseName = POPULATION_NAMES[numericHash % POPULATION_NAMES.length];
  const name = nextWorld.npcs.some((npc) => npc.name === baseName) ? `${baseName}·${flowHash.slice(0, 4)}` : baseName;
  const homeLocationId = `home-pop-${flowHash}`;
  const scheduleLocations = SCHEDULE_TIMES.map((_, index) => locationAt(nextWorld, numericHash + index + 1).id);
  const newcomerHome: WorldLocation = {
    id: homeLocationId,
    name: `${name}的临时住处`,
    kind: "home",
    description: "由来源事件触发、可在回放中定位的临时居所。",
    connectedLocationIds: [resolvedArrivalLocation.id]
  };
  nextWorld.locations = nextWorld.locations.map((location) => location.id === resolvedArrivalLocation.id
    ? { ...location, connectedLocationIds: Array.from(new Set([...location.connectedLocationIds, homeLocationId])) }
    : location);
  nextWorld.locations.push(newcomerHome);
  const schedule: Record<string, string> = {
    [SCHEDULE_TIMES[0]]: scheduleLocations[0],
    [SCHEDULE_TIMES[1]]: resolvedArrivalLocation.id,
    [SCHEDULE_TIMES[2]]: scheduleLocations[2],
    [SCHEDULE_TIMES[3]]: scheduleLocations[3],
    "23:00": homeLocationId
  };
  const relationships = Object.fromEntries(
    relationshipNpcIds.map((targetId, index) => [targetId, RELATIONSHIP_KINDS[(numericHash + index) % RELATIONSHIP_KINDS.length]])
  ) as NPCProfile["relationships"];
  const day = Math.max(1, Math.floor(input.day ?? nextRuntime.currentDay ?? nextWorld.day ?? sourceEvent.day ?? 1));
  const time = validTime(input.time) ? input.time : validTime(nextRuntime.currentTime) ? nextRuntime.currentTime : validTime(sourceEvent.time) ? sourceEvent.time : "08:00";
  const reason = input.reason || "已存在的世界事件为一名新居民提供了可回放的抵达机会。";
  const newNpc: NPCProfile = {
    id: npcId,
    name,
    role: POPULATION_ROLES[numericHash % POPULATION_ROLES.length],
    homeLocationId,
    schedule,
    relationships,
    secret: `${name}掌握一条与${resolvedArrivalLocation.name}有关、尚未公开的旧记录。`,
    motiveSeed: `${name}希望在镇上建立新的可信关系，同时避免旧记录被追问。`,
    skills: [numericHash % 2 === 0 ? "local_knowledge" : "mechanical", numericHash % 3 === 0 ? "social" : "forensics"],
    memoryEventIds: [arrivalEventId, sourceEvent.id],
    liePolicy: "会保护自己的来历，但只陈述亲自观察到的事件。",
    alive: true
  };
  // Arrival creates the newcomer's prior knowledge of local residents. It does
  // not silently rewrite an authored resident's social graph before that
  // resident has observed or interacted with the newcomer. This keeps the
  // first arrival causally local and lets a later authored event establish the
  // reverse edge with visible provenance.
  nextWorld.npcs.push(newNpc);

  const arrivalEvent: WorldEvent = {
    id: arrivalEventId,
    worldId: nextWorld.id,
    day,
    time,
    type: "arrival",
    actorIds: [npcId],
    locationId: resolvedArrivalLocation.id,
    summary: `${name}携带一只旧行李箱抵达${resolvedArrivalLocation.name}，登记信息与来源事件相连。`,
    publicSummary: `${name}在${resolvedArrivalLocation.name}出现，镇上的登记留下了新的来客记录。`,
    hidden: false,
    // Source residents remain provenance in the ledger and causedByEventIds;
    // they are not participants in the arrival itself. Treating them as
    // related characters would make authored agents count every arrival as
    // their own event before any observable interaction occurs.
    relatedCharacterIds: [npcId],
    tags: ["arrival", "population_flow", "source_backed"],
    intentId: `intent-${arrivalEventId}`,
    causedByEventIds: [sourceEvent.id],
    goalId: `goal-${npcId}-establish-place`,
    explanation: reason
  };
  nextEvents.push(arrivalEvent);
  nextWorld.memories = [
    ...(nextWorld.memories || []),
    {
      id: `memory-${arrivalEventId}`,
      worldId: nextWorld.id,
      npcId,
      kind: "direct",
      eventId: arrivalEventId,
      day,
      summary: arrivalEvent.publicSummary,
      sourceNpcId: sourceEvent.actorIds[0],
      confidence: 1,
      visibleToPlayer: true,
      challengeableEvidenceIds: []
    }
  ];
  const record: PopulationFlowRecord = {
    id: flowId,
    flowKey,
    worldId: nextWorld.id,
    ...(input.agentActionId ? { agentActionId: input.agentActionId } : {}),
    ...(input.agentSourceRefs ? { agentSourceRefs: [...input.agentSourceRefs] } : {}),
    sourceEventId: sourceEvent.id,
    sourceCandidateId: input.sourceCandidateId,
    sourceNpcIds,
    npcId,
    arrivalEventId,
    arrivalLocationId: resolvedArrivalLocation.id,
    createdAtTick: Math.max(0, Math.floor(nextRuntime.tick || 0)),
    createdAtDay: day,
    createdAtTime: time,
    schedule: clone(schedule),
    relationshipNpcIds: [...relationshipNpcIds],
    reason
  };
  nextRuntime.populationFlowLedger = [...(nextRuntime.populationFlowLedger || []), record];
  nextRuntime.agentStates = [
    ...(nextRuntime.agentStates || []).filter((state) => state.npcId !== npcId),
    deriveNpcAgentState(nextWorld, newNpc, nextEvents, nextRuntime)
  ];
  nextWorld.persistentRuntime = nextRuntime;
  return {
    world: nextWorld,
    runtime: nextRuntime,
    event: arrivalEvent,
    record,
    created: true,
    createdEvents: [arrivalEvent]
  };
}
