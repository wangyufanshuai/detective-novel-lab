import type { PersistentTownRuntime } from "../persistent-town";
import type { WorldState } from "../world-types";

type RuntimeWorld = WorldState & { persistentRuntime?: PersistentTownRuntime };

export function cloneTownWorldForAdvance(world: WorldState): RuntimeWorld {
  const runtimeWorld = world as RuntimeWorld;
  const { persistentRuntime, ...worldState } = runtimeWorld;
  const copy = JSON.parse(JSON.stringify(worldState)) as RuntimeWorld;
  if (!persistentRuntime) return copy;
  const { snapshots = [], scenarioRuns = [], ...runtimeState } = persistentRuntime;
  copy.persistentRuntime = {
    ...(JSON.parse(JSON.stringify(runtimeState)) as Omit<PersistentTownRuntime, "snapshots" | "scenarioRuns">),
    snapshots: [...snapshots],
    scenarioRuns: [...scenarioRuns]
  };
  return copy;
}

export function cloneTownSnapshotRuntime(runtime: PersistentTownRuntime): Omit<PersistentTownRuntime, "snapshots" | "scenarioRuns"> {
  const { snapshots: _snapshots, scenarioRuns: _scenarioRuns, ...runtimeState } = runtime;
  return JSON.parse(JSON.stringify(runtimeState)) as Omit<PersistentTownRuntime, "snapshots" | "scenarioRuns">;
}

export function cloneTownSnapshotWorld(world: WorldState): WorldState {
  const { persistentRuntime: _persistentRuntime, ...worldState } = world as RuntimeWorld;
  return JSON.parse(JSON.stringify(worldState)) as WorldState;
}
