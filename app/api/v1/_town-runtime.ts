import { fail } from "@/app/api/v1/_utils";
import {
  advancePersistentTownTick,
  applyTownRuntimeIntervention,
  buildTownEmergenceQueue,
  createPersistentTownRuntime,
  diffTownStateSnapshots,
  extractPlayableCaseFromCandidate,
  rollbackTownRuntimeToSnapshot,
  runTownScenario,
  type CaseCandidate,
  type PersistentTownRuntime,
  type ScenarioConfig,
  type TownStateSnapshot,
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
  worldRepository.saveWorldBundle({ world, events: eventsToAdd });
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

export function runScenario(world: RuntimeWorld, events: WorldEvent[], config: ScenarioConfig) {
  const result = runTownScenario(world, events, config);
  const nextWorld = result.world as RuntimeWorld;
  nextWorld.persistentRuntime = result.runtime;
  persistRuntimeWorld(nextWorld, result.events);
  return result;
}

export function findScenario(runtime: PersistentTownRuntime, scenarioId?: string | null) {
  const runs = runtime.scenarioRuns || [];
  if (!scenarioId) return runs[0] || null;
  return runs.find((run) => run.id === scenarioId) || null;
}

export function findSnapshot(runtime: PersistentTownRuntime, snapshotId?: string | null) {
  if (!snapshotId) return null;
  return (runtime.snapshots || []).find((snapshot) => snapshot.id === snapshotId) || null;
}

export function publicSnapshot(snapshot: TownStateSnapshot) {
  const { checkpoint: _checkpoint, ...visible } = snapshot;
  return visible;
}

export function publicRuntime(runtime: PersistentTownRuntime) {
  return {
    ...runtime,
    snapshots: (runtime.snapshots || []).map(publicSnapshot)
  };
}

export function publicWorld(world: RuntimeWorld) {
  return {
    ...world,
    persistentRuntime: world.persistentRuntime ? publicRuntime(world.persistentRuntime) : undefined
  };
}

export function diffSnapshots(runtime: PersistentTownRuntime, fromId: string, toId: string) {
  const from = findSnapshot(runtime, fromId);
  const to = findSnapshot(runtime, toId);
  if (!from || !to) return null;
  return { from, to, diff: diffTownStateSnapshots(from, to) };
}

export function rollbackToSnapshot(world: RuntimeWorld, snapshot: TownStateSnapshot) {
  const result = rollbackTownRuntimeToSnapshot(world, snapshot);
  const nextWorld = result.world as RuntimeWorld;
  nextWorld.persistentRuntime = result.runtime;
  persistRuntimeWorld(nextWorld);
  return { ...result, world: nextWorld };
}
