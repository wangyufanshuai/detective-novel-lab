import { fail } from "@/app/api/v1/_utils";
import {
  advancePersistentTownTick,
  applyTownRuntimeIntervention,
  buildTownEmergenceQueue,
  createPersistentTownRuntime,
  extractPlayableCaseFromCandidate,
  type CaseCandidate,
  type PersistentTownRuntime,
  type TownRuntimeIntervention,
  type WorldEvent,
  type WorldState
} from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";

export type RuntimeWorld = WorldState & { persistentRuntime?: PersistentTownRuntime };

export function loadRuntimeWorld(worldId: string) {
  const world = worldRepository.getWorld(worldId) as RuntimeWorld | null;
  if (!world) return null;
  const events = worldRepository.getEvents(worldId);
  if (!world.persistentRuntime) {
    world.persistentRuntime = createPersistentTownRuntime(world, events);
    worldRepository.saveWorld(world);
  }
  return { world, events, runtime: world.persistentRuntime };
}

export function persistRuntimeWorld(world: RuntimeWorld, eventsToAdd: WorldEvent[] = []) {
  worldRepository.saveWorld(world);
  if (eventsToAdd.length) worldRepository.addEvents(eventsToAdd);
  return world;
}

export function runtimeNotFound() {
  return fail("WORLD_NOT_FOUND", "World not found", 404);
}

export function getRuntimeCandidate(runtime: PersistentTownRuntime, candidateId?: string | null): CaseCandidate | null {
  if (!runtime.candidates.length) return null;
  if (!candidateId) return runtime.candidates.find((candidate) => candidate.validation.valid) || runtime.candidates[0];
  return runtime.candidates.find((candidate) => candidate.id === candidateId) || null;
}

export function stepRuntime(world: RuntimeWorld, events: WorldEvent[], steps = 1, status: "running" | "paused" = "running") {
  const result = advancePersistentTownTick(world, events, { steps, status });
  const nextWorld = result.world as RuntimeWorld;
  nextWorld.persistentRuntime = result.runtime;
  persistRuntimeWorld(nextWorld, result.events);
  return result;
}

export function applyRuntimeIntervention(world: RuntimeWorld, intervention: Omit<TownRuntimeIntervention, "id" | "tick" | "createdAt" | "branch" | "impact">) {
  const result = applyTownRuntimeIntervention(world, intervention);
  const nextWorld = result.world as RuntimeWorld;
  nextWorld.persistentRuntime = result.runtime;
  persistRuntimeWorld(nextWorld);
  return result;
}

export function extractCase(world: RuntimeWorld, events: WorldEvent[], candidate: CaseCandidate) {
  const result = extractPlayableCaseFromCandidate(world, events, candidate);
  const nextWorld = result.world as RuntimeWorld;
  nextWorld.persistentRuntime = world.persistentRuntime;
  if (nextWorld.persistentRuntime) {
    nextWorld.persistentRuntime.candidates = [
      result.candidate,
      ...nextWorld.persistentRuntime.candidates.filter((item) => item.id !== result.candidate.id)
    ];
  }
  persistRuntimeWorld(nextWorld, result.events.filter((event) => !events.some((existing) => existing.id === event.id)));
  worldRepository.saveCase(result.activeCase);
  return { ...result, world: nextWorld, queue: buildTownEmergenceQueue(nextWorld, result.events, nextWorld.persistentRuntime) };
}
