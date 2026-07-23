import type { MemoryRecord, WorldEvent } from "../world-types";
import type { NpcAgentState, TownTickIndex } from "../persistent-town";

export function memoriesForNpc(memories: MemoryRecord[], npcId: string, index?: TownTickIndex) {
  return index?.memoryByNpcId.get(npcId) || memories.filter((memory) => memory.npcId === npcId);
}

export function eventsForNpc(events: WorldEvent[], npcId: string, index?: TownTickIndex) {
  return index?.eventsByActorId.get(npcId) || events.filter((event) => event.actorIds.includes(npcId));
}

export function cacheNpcAgentState(index: TownTickIndex | undefined, state: NpcAgentState) {
  index?.agentStateByNpcId.set(state.npcId, state);
  return state;
}
