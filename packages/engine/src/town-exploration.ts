import { advancePersistentTownTick, type PersistentTownRuntime } from "./persistent-town";
import type { TownMapPack } from "./town-map-pack";
import type { WorldEvent, WorldState } from "./world-types";
import { residentWorkPlayerView } from "./town/resident-work";
import { residentLifePlayerActivity } from "./town/resident-life";

export type TownExplorationBinding = {
  schema: "town-exploration-binding.v1";
  worldId: string;
  mapId: string;
  revision: string;
  assetSha256: string;
  initialLocationId: string;
  places: { sceneId: string; locationId: string }[];
  residents: { actorId: string; npcId: string }[];
};

export type TownSighting = { npcId: string; locationId: string; day: number; time: string; tick: number };
export type TownExplorationState = {
  schema: "town-exploration-state.v1";
  worldId: string;
  sessionId: string;
  bindingRevision: string;
  locationId: string;
  revision: number;
  sightings: TownSighting[];
  lastArrival?: { actionId: string; from: string; to: string; minutes: number; tick: number };
};

type Clock = Pick<PersistentTownRuntime, "worldId" | "tick" | "currentDay" | "currentTime" | "tickIntervalMinutes" | "commandRevision" | "maxTicks">;
type ObservedRuntime = Clock & Pick<PersistentTownRuntime, "agentStates" | "dailyRoutine" | "residentWork" | "residentLife">;

export type TownArrivalPlan = {
  actionId: string;
  worldId: string;
  sessionId: string;
  bindingRevision: string;
  expectedSessionRevision: number;
  expectedWorldRevision: number;
  from: string;
  to: string;
  path: string[];
  routeMinutes: number;
  chargedMinutes: number;
  steps: number;
  fromTick: number;
  fromAbsoluteMinute: number;
};

function requireThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function absoluteMinute(clock: Clock) {
  requireThat(Number.isInteger(clock.currentDay) && clock.currentDay >= 1 && /^([01]\d|2[0-3]):[0-5]\d$/.test(clock.currentTime), "Invalid world clock");
  const [hour, minute] = clock.currentTime.split(":").map(Number);
  return (clock.currentDay - 1) * 1440 + hour * 60 + minute;
}

/** Binding belongs to one authored map/world version. It never infers identities
 * from mesh order, NPC role labels, hidden events, or a client's requested name. */
export function validateTownExplorationBinding(world: WorldState, map: TownMapPack, binding: TownExplorationBinding) {
  requireThat(binding.schema === "town-exploration-binding.v1" && binding.worldId === world.id && binding.mapId === map.manifest.id, "Exploration binding does not match this world and map");
  requireThat(Boolean(binding.revision) && /^[a-f0-9]{64}$/.test(binding.assetSha256), "Exploration binding needs an asset identity");
  const worldLocations = new Set(world.locations.map(location => location.id));
  const mapLocations = new Set(map.locations.map(location => location.id));
  const npcs = new Set(world.npcs.map(npc => npc.id));
  requireThat(worldLocations.has(binding.initialLocationId) && mapLocations.has(binding.initialLocationId), "Exploration spawn is not a world location");
  requireThat(binding.places.length > 0 && new Set(binding.places.map(place => place.sceneId)).size === binding.places.length && new Set(binding.places.map(place => place.locationId)).size === binding.places.length, "Place bindings must be explicit and unique");
  requireThat(binding.places.some(place => place.locationId === binding.initialLocationId), "Exploration spawn needs an explicit scene binding");
  for (const place of binding.places) requireThat(Boolean(place.sceneId) && worldLocations.has(place.locationId) && mapLocations.has(place.locationId), "A scene place has no matching world location");
  requireThat(new Set(binding.residents.map(actor => actor.actorId)).size === binding.residents.length && new Set(binding.residents.map(actor => actor.npcId)).size === binding.residents.length, "Resident bindings must be one-to-one");
  for (const actor of binding.residents) requireThat(Boolean(actor.actorId) && npcs.has(actor.npcId), "A scene resident has no matching world person");
  const edges = new Set<string>();
  for (const edge of map.connections) {
    const key = [edge.from, edge.to].sort().join("\u0000");
    requireThat(worldLocations.has(edge.from) && worldLocations.has(edge.to) && mapLocations.has(edge.from) && mapLocations.has(edge.to) && edge.from !== edge.to, "Road has an invalid endpoint");
    requireThat(Number.isInteger(edge.travelMinutes) && edge.travelMinutes > 0 && edge.travelMinutes <= 1440, "Road travel time must be positive whole minutes");
    requireThat(!edges.has(key), "Road has ambiguous duplicate travel times");
    edges.add(key);
  }
}

function assertState(state: TownExplorationState, binding: TownExplorationBinding, runtime: Clock) {
  requireThat(state.schema === "town-exploration-state.v1" && state.worldId === binding.worldId && runtime.worldId === state.worldId && state.bindingRevision === binding.revision, "Exploration state is from a different world or map version");
  requireThat(Boolean(state.sessionId) && Number.isSafeInteger(state.revision) && state.revision >= 0, "Invalid exploration session revision");
  requireThat(binding.places.some(place => place.locationId === state.locationId), "Player location has no scene binding");
  requireThat(Number.isSafeInteger(runtime.tick) && runtime.tick >= 0 && Number.isSafeInteger(runtime.commandRevision ?? 0) && (runtime.commandRevision ?? 0) >= 0, "Invalid world revision");
  absoluteMinute(runtime);
  requireThat(new Set(state.sightings.map(sighting => sighting.npcId)).size === state.sightings.length, "Duplicate remembered person");
  for (const sighting of state.sightings) {
    requireThat(Number.isSafeInteger(sighting.tick) && sighting.tick >= 0 && sighting.tick <= runtime.tick && Number.isInteger(sighting.day) && sighting.day >= 1 && /^([01]\d|2[0-3]):[0-5]\d$/.test(sighting.time), "Invalid remembered observation");
    requireThat(binding.residents.some(actor => actor.npcId === sighting.npcId) && binding.places.some(place => place.locationId === sighting.locationId), "Remembered observation has no scene binding");
    requireThat(absoluteMinute({ ...runtime, currentDay: sighting.day, currentTime: sighting.time }) <= absoluteMinute(runtime), "Remembered observation is ahead of the world clock");
  }
}

export function startTownExploration(world: WorldState, map: TownMapPack, binding: TownExplorationBinding, sessionId: string): TownExplorationState {
  validateTownExplorationBinding(world, map, binding);
  requireThat(Boolean(sessionId), "An investigation session is required");
  return { schema: "town-exploration-state.v1", worldId: world.id, sessionId, bindingRevision: binding.revision, locationId: binding.initialLocationId, revision: 0, sightings: [] };
}

/** Road edges are undirected, matching createTownMapPackFromWorld's canonical
 * connection pairs. The server computes this plan; clients cannot submit it. */
export function planTownArrival(world: WorldState, map: TownMapPack, binding: TownExplorationBinding, state: TownExplorationState, runtime: Clock, input: { actionId: string; sceneId: string; expectedSessionRevision: number }): TownArrivalPlan {
  validateTownExplorationBinding(world, map, binding);
  assertState(state, binding, runtime);
  requireThat(input.expectedSessionRevision === state.revision && Boolean(input.actionId) && input.actionId.length <= 200, "Arrival command is stale or lacks identity");
  requireThat(Number.isSafeInteger(runtime.tick) && runtime.tick >= 0 && Number.isInteger(runtime.tickIntervalMinutes) && runtime.tickIntervalMinutes > 0, "Invalid world tick");
  const target = binding.places.find(place => place.sceneId === input.sceneId);
  requireThat(target && world.locations.some(location => location.id === state.locationId), "Arrival has no mapped destination");
  const pending = [{ id: state.locationId, minutes: 0, path: [state.locationId] }];
  const settled = new Set<string>();
  let route: (typeof pending)[number] | undefined;
  while (pending.length) {
    pending.sort((a, b) => a.minutes - b.minutes || a.path.join("\u0000").localeCompare(b.path.join("\u0000"), "en"));
    const current = pending.shift()!;
    if (settled.has(current.id)) continue;
    settled.add(current.id);
    if (current.id === target.locationId) { route = current; break; }
    for (const edge of map.connections) {
      const next = edge.from === current.id ? edge.to : edge.to === current.id ? edge.from : null;
      if (next && !settled.has(next)) pending.push({ id: next, minutes: current.minutes + edge.travelMinutes, path: [...current.path, next] });
    }
  }
  requireThat(route, "Destination cannot be reached through the world road graph");
  const steps = Math.ceil(route.minutes / runtime.tickIntervalMinutes);
  requireThat(steps <= 60 && Number.isSafeInteger(runtime.maxTicks) && runtime.tick + steps <= runtime.maxTicks, "Journey exceeds the available world simulation window");
  return { actionId: input.actionId, worldId: state.worldId, sessionId: state.sessionId, bindingRevision: binding.revision, expectedSessionRevision: state.revision, expectedWorldRevision: runtime.commandRevision ?? 0, from: state.locationId, to: target.locationId, path: route.path, routeMinutes: route.minutes, chargedMinutes: steps * runtime.tickIntervalMinutes, steps, fromTick: runtime.tick, fromAbsoluteMinute: absoluteMinute(runtime) };
}

/** Apply a command to a defensive engine copy. Nothing is persisted here: the
 * server must atomically store this world, session and durable action receipt.
 * A same-place observation must not call the engine's steps=0 path (which ticks).
 */
export function executeTownArrival(world: WorldState & { persistentRuntime: PersistentTownRuntime }, events: WorldEvent[], map: TownMapPack, binding: TownExplorationBinding, state: TownExplorationState, input: Parameters<typeof planTownArrival>[5]) {
  const plan = planTownArrival(world, map, binding, state, world.persistentRuntime, input);
  const result = plan.steps > 0
    ? advancePersistentTownTick(world, events, { steps: plan.steps, status: "paused" })
    : { world: structuredClone(world), runtime: structuredClone(world.persistentRuntime), events: [] as WorldEvent[] };
  const nextWorld = result.world as WorldState & { persistentRuntime: PersistentTownRuntime };
  nextWorld.persistentRuntime = result.runtime;
  const arrived = completeTownArrival(state, binding, plan, result.runtime);
  return { world: nextWorld, runtime: result.runtime, events: result.events, state: observeTownResidents(nextWorld, binding, arrived, result.runtime), plan };
}

/** The caller runs advancePersistentTownTick and commits world/session plus the
 * idempotency receipt in one transaction. This helper cannot advance time. */
export function completeTownArrival(state: TownExplorationState, binding: TownExplorationBinding, plan: TownArrivalPlan, after: Clock): TownExplorationState {
  assertState(state, binding, after);
  requireThat(plan.worldId === state.worldId && plan.sessionId === state.sessionId && plan.bindingRevision === binding.revision && plan.expectedSessionRevision === state.revision && plan.from === state.locationId, "Arrival result belongs to another session revision");
  requireThat((after.commandRevision ?? 0) === plan.expectedWorldRevision, "World revision changed during the planned journey");
  requireThat(after.tick === plan.fromTick + plan.steps && absoluteMinute(after) === plan.fromAbsoluteMinute + plan.chargedMinutes, "World did not complete the required travel ticks");
  return { ...state, locationId: plan.to, revision: state.revision + 1, sightings: state.sightings.map(sighting => ({ ...sighting })), lastArrival: { actionId: plan.actionId, from: plan.from, to: plan.to, minutes: plan.chargedMinutes, tick: after.tick } };
}

/** Save only direct, same-location observations. A schedule or an off-screen
 * position is never promoted to the player's remembered whereabouts. */
export function observeTownResidents(world: WorldState, binding: TownExplorationBinding, state: TownExplorationState, runtime: ObservedRuntime): TownExplorationState {
  assertState(state, binding, runtime);
  requireThat(world.id === state.worldId, "Observation belongs to another world");
  const sightings = new Map(state.sightings.map(sighting => [sighting.npcId, { ...sighting }]));
  for (const actor of binding.residents) {
    const agent = runtime.agentStates.find(agent => agent.npcId === actor.npcId);
    if (agent?.locationId === state.locationId && !runtime.dailyRoutine?.journeys[actor.npcId] && world.npcs.some(npc => npc.id === actor.npcId && npc.alive)) sightings.set(actor.npcId, { npcId: actor.npcId, locationId: state.locationId, day: runtime.currentDay, time: runtime.currentTime, tick: runtime.tick });
  }
  const next = [...sightings.values()].sort((a, b) => a.npcId.localeCompare(b.npcId, "en"));
  const changed = JSON.stringify(next) !== JSON.stringify(state.sightings);
  return { ...state, revision: state.revision + Number(changed), sightings: next };
}

export function townExplorationPlayerView(world: WorldState, binding: TownExplorationBinding, state: TownExplorationState, runtime: ObservedRuntime) {
  assertState(state, binding, runtime);
  requireThat(world.id === state.worldId, "Player view belongs to another world");
  for (const sighting of state.sightings) requireThat(sighting.tick <= runtime.tick && world.locations.some(location => location.id === sighting.locationId) && binding.residents.some(actor => actor.npcId === sighting.npcId), "Remembered location is invalid for this world revision");
  const residents = binding.residents.flatMap(actor => {
    const npc = world.npcs.find(npc => npc.id === actor.npcId);
    const agent = runtime.agentStates.find(agent => agent.npcId === actor.npcId);
    const lastSeen = state.sightings.find(sighting => sighting.npcId === actor.npcId);
    const visible = npc?.alive && agent?.locationId === state.locationId && !runtime.dailyRoutine?.journeys[actor.npcId];
    if (!npc || (!visible && !lastSeen)) return [];
    const locationId = visible ? state.locationId : lastSeen!.locationId;
    return [{ actorId: actor.actorId, npcId: npc.id, name: npc.name, role: npc.role, visibility: visible ? "observed" as const : "last-seen" as const, sceneId: binding.places.find(place => place.locationId === locationId)?.sceneId ?? null, locationName: world.locations.find(location => location.id === locationId)?.name ?? "", day: visible ? runtime.currentDay : lastSeen!.day, time: visible ? runtime.currentTime : lastSeen!.time,
      ...(visible && runtime.residentWork ? { work: residentWorkPlayerView(runtime, npc.id) } : {}),
      ...(visible && runtime.residentLife ? { activity: residentLifePlayerActivity(runtime,npc.id)?.label } : {}) }];
  });
  return { worldId: world.id, sessionId: state.sessionId, revision: state.revision, worldRevision: runtime.commandRevision ?? 0, bindingRevision: binding.revision, day: runtime.currentDay, time: runtime.currentTime, sceneId: binding.places.find(place => place.locationId === state.locationId)?.sceneId ?? null, residents };
}
