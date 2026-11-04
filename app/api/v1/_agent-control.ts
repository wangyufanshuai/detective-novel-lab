import {
  resolveAgentSourceRefs,
  type PersistentTownRuntime,
  type WorldEvent,
  type WorldState
} from "@/lib/engine";

/** Build the only source index that Agent v1 commands may use for provenance. */
export function buildAgentSourceIndex(world: WorldState, runtime: PersistentTownRuntime, events: WorldEvent[]) {
  const available = new Set<string>([
    `world:${world.id}`,
    `brief:${world.id}`
  ]);
  for (const event of events) available.add(`event:${event.id}`);
  for (const npc of world.npcs) available.add(`agent:${npc.id}`);
  for (const memory of world.memories) available.add(`memory:${memory.id}`);
  for (const candidate of runtime.candidates) {
    available.add(`candidate:${candidate.id}`);
    if (candidate.caseId) available.add(`case:${candidate.caseId}`);
    for (const memoryId of candidate.memoryIds || []) available.add(`memory:${memoryId}`);
  }
  if (world.activeCaseId) available.add(`case:${world.activeCaseId}`);
  for (const observation of runtime.eventObservations || []) available.add(`observation:${observation.id}`);
  for (const intervention of runtime.interventions || []) {
    available.add(`intervention:${intervention.id}`);
    if (intervention.actionId) available.add(`intervention:${intervention.actionId}`);
  }
  if (runtime.currentExperiment?.worldPackageId) available.add(`package:${runtime.currentExperiment.worldPackageId}`);
  return available;
}

export function resolveRuntimeAgentSourceRefs(input: {
  world: WorldState;
  runtime: PersistentTownRuntime;
  events: WorldEvent[];
  sourceRefs: string[];
}) {
  return resolveAgentSourceRefs({
    sourceRefs: input.sourceRefs,
    availableRefs: buildAgentSourceIndex(input.world, input.runtime, input.events)
  });
}
