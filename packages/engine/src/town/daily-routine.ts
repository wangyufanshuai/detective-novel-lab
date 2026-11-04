import type { PersistentTownRuntime } from "../persistent-town";
import type { TownMapPack } from "../town-map-pack";
import type { NPCProfile, WorldEvent, WorldState } from "../world-types";

export type DailyRoutineJourney = { from: string; to: string; remainingMinutes: number; goalLocationId: string };
export type DailyRoutinePassage = { id: string; npcId: string; from: string; to: string; kind: "departure" | "arrival"; day: number; time: string; tick: number };
export type TownDailyRoutine = {
  schema: "town-daily-routine.v1";
  enabled: boolean;
  mapId: string;
  lastTick: number;
  journeys: Record<string, DailyRoutineJourney>;
  holds: Record<string, { untilTick: number; reason: string }>;
  /** Private, bounded facts. Player APIs must project only locally witnessed passages. */
  passages?: DailyRoutinePassage[];
};

export function townScheduleTarget(npc: NPCProfile, absoluteMinute: number) {
  const minute = ((absoluteMinute % 1440) + 1440) % 1440;
  const entries = Object.entries(npc.schedule).map(([time, id]) => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error(`Invalid routine time for ${npc.id}`);
    const [hours, minutes] = time.split(":").map(Number);
    return { minute: hours * 60 + minutes, id };
  }).sort((a, b) => a.minute - b.minute);
  return [...entries].reverse().find(entry => entry.minute <= minute)?.id ?? entries.at(-1)?.id ?? npc.homeLocationId;
}

function nextRoad(map: TownMapPack, start: string, target: string) {
  const pending = [{ id: start, minutes: 0, first: null as { to: string; minutes: number } | null }];
  const settled = new Set<string>();
  while (pending.length) {
    pending.sort((a, b) => a.minutes - b.minutes || a.id.localeCompare(b.id, "en"));
    const current = pending.shift()!;
    if (settled.has(current.id)) continue;
    settled.add(current.id);
    if (current.id === target) return current.first;
    for (const edge of map.connections) {
      const next = edge.from === current.id ? edge.to : edge.to === current.id ? edge.from : null;
      if (next && !settled.has(next)) pending.push({ id: next, minutes: current.minutes + edge.travelMinutes, first: current.first ?? { to: next, minutes: edge.travelMinutes } });
    }
  }
  return null;
}

/** Opt-in server routine phase. Schedule times mean departure times; each
 * elapsed minute is consumed once, even across midnight and multi-edge roads.
 * A persisted journey finishes its current edge before a new plan can reroute.
 * Holds are explicit world state, not a silent exception to the schedule.
 */
export function advanceTownDailyRoutines(world: WorldState, runtime: PersistentTownRuntime): WorldEvent[] {
  const routine = runtime.dailyRoutine;
  if (!routine?.enabled) return [];
  if (routine.schema !== "town-daily-routine.v1" || routine.lastTick !== runtime.tick - 1) throw new Error("Daily routine tick is stale or was already applied");
  const map = runtime.mapPacks?.find(pack => pack.manifest.id === routine.mapId);
  if (!map) throw new Error("Daily routine map is unavailable");
  const ids = new Set(world.locations.map(location => location.id));
  for (const edge of map.connections) if (!ids.has(edge.from) || !ids.has(edge.to) || !Number.isSafeInteger(edge.travelMinutes) || edge.travelMinutes < 1) throw new Error("Daily routine road is invalid");
  const [hours, minutes] = runtime.currentTime.split(":").map(Number);
  const endMinute = (runtime.currentDay - 1) * 1440 + hours * 60 + minutes;
  const startMinute = endMinute - runtime.tickIntervalMinutes;
  const events: WorldEvent[] = [];
  const passages = routine.passages ??= [];
  const record = (npcId: string, journey: DailyRoutineJourney, kind: DailyRoutinePassage["kind"], minute: number) => {
    const clock = ((minute % 1440) + 1440) % 1440;
    passages.push({ id: `passage-${world.id}-${npcId}-${minute}-${kind}`, npcId, from: journey.from, to: journey.to, kind,
      day: Math.floor(minute / 1440) + 1, time: `${String(Math.floor(clock / 60)).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}`, tick: runtime.tick });
  };
  for (const npc of world.npcs) {
    const agent = runtime.agentStates.find(agent => agent.npcId === npc.id);
    if (!agent || !npc.alive) { delete routine.journeys[npc.id]; continue; }
    if ((routine.holds[npc.id]?.untilTick ?? -1) >= runtime.tick) continue;
    delete routine.holds[npc.id];
    if (runtime.residentLife?.people[npc.id]?.activeId) continue;
    for (let minute = startMinute; minute < endMinute; minute++) {
      const target = runtime.residentLife?.people[npc.id]?.target ?? townScheduleTarget(npc, minute);
      if (!ids.has(target) || !ids.has(agent.locationId)) throw new Error(`Daily routine location is missing for ${npc.id}`);
      let journey = routine.journeys[npc.id];
      if (!journey && target !== agent.locationId) {
        const road = nextRoad(map, agent.locationId, target);
        if (!road) throw new Error(`Daily routine cannot reach ${target}`);
        journey = { from: agent.locationId, to: road.to, remainingMinutes: road.minutes, goalLocationId: target };
        routine.journeys[npc.id] = journey;
        record(npc.id, journey, "departure", minute);
      }
      if (!journey) continue;
      if (journey.from !== agent.locationId || !Number.isSafeInteger(journey.remainingMinutes) || journey.remainingMinutes < 1 || !map.connections.some(edge => (edge.from === journey.from && edge.to === journey.to) || (edge.to === journey.from && edge.from === journey.to))) throw new Error("Persisted daily journey is inconsistent");
      journey.remainingMinutes--;
      if (journey.remainingMinutes > 0) continue;
      agent.locationId = journey.to;
      delete routine.journeys[npc.id];
      const arrivedAt = minute + 1;
      record(npc.id, journey, "arrival", arrivedAt);
      const day = Math.floor(arrivedAt / 1440) + 1;
      const clock = ((arrivedAt % 1440) + 1440) % 1440;
      const time = `${String(Math.floor(clock / 60)).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}`;
      const destination = world.locations.find(location => location.id === journey.to)!;
      events.push({ id: `routine-${world.id}-${npc.id}-${arrivedAt}`, worldId: world.id, day, time, type: "move", actorIds: [npc.id], locationId: journey.to, summary: `${npc.name}沿道路从${journey.from}抵达${destination.name}。`, publicSummary: `${npc.name}经过${destination.name}。`, hidden: false, relatedCharacterIds: [npc.id], tags: ["daily_routine", "road_arrival"], explanation: `Authored schedule ${target}; one minute consumed per road minute.` });
    }
  }
  routine.lastTick = runtime.tick;
  if (passages.length > 4096) passages.splice(0, passages.length - 4096);
  return events;
}
