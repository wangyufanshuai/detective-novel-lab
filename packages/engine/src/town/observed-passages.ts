import type { TownExplorationBinding, TownExplorationState } from "../town-exploration";
import type { DailyRoutinePassage } from "./daily-routine";

export type ObservedTownPassage = {
  id: string; actorId: string; npcId: string; kind: "departure" | "arrival";
  sceneId: string; portalSceneId: string | null; day: number; time: string;
};
export type TownObservedMotion = {
  id: string; sessionId: string; sceneId: string; fromWorldRevision: number; toWorldRevision: number;
  passages: ObservedTownPassage[];
};

/** A stationary observer can see a person cross their own room threshold, or
 * a public street entrance. Never send the private road, final destination,
 * schedule, work state, or a passage observed while the player was travelling.
 * GET never replays these records; the command receipt carries the one batch.
 */
export function observedTownPassages(binding: TownExplorationBinding, state: TownExplorationState,
  beforeTick: number, afterTick: number, privatePassages: readonly DailyRoutinePassage[], publicStreetScene: string,
  visiblePortalScenes: readonly string[]): ObservedTownPassage[] {
  const sceneId = binding.places.find(p => p.locationId === state.locationId)?.sceneId;
  if (!sceneId || afterTick <= beforeTick) return [];
  return privatePassages.filter(p => p.tick > beforeTick && p.tick <= afterTick &&
    (p.kind === "departure" ? p.from : p.to) === state.locationId).flatMap(p => {
    const actor = binding.residents.find(actor => actor.npcId === p.npcId);
    if (!actor) return [];
    const adjacent = binding.places.find(place => place.locationId === (p.kind === "departure" ? p.to : p.from))?.sceneId;
    return [{ id: p.id, actorId: actor.actorId, npcId: actor.npcId, kind: p.kind, sceneId,
      portalSceneId: sceneId === publicStreetScene && adjacent && visiblePortalScenes.includes(adjacent) ? adjacent : null,
      day: p.day, time: p.time }];
  }).sort((a, b) => a.day - b.day || a.time.localeCompare(b.time, "en") || a.id.localeCompare(b.id, "en"));
}

/** Remember the witnessed threshold, never the hidden next location. A final
 * same-location observation at the end of the command takes precedence. */
export function rememberTownPassages(state: TownExplorationState, passages: readonly ObservedTownPassage[], tick: number): TownExplorationState {
  if (!passages.length) return state;
  const sightings = new Map(state.sightings.map(p => [p.npcId, { ...p }]));
  for (const p of passages) {
    const old = sightings.get(p.npcId);
    if (!old || old.day < p.day || (old.day === p.day && old.time < p.time))
      sightings.set(p.npcId, { npcId: p.npcId, locationId: state.locationId, day: p.day, time: p.time, tick });
  }
  const next = [...sightings.values()].sort((a, b) => a.npcId.localeCompare(b.npcId, "en"));
  return JSON.stringify(next) === JSON.stringify(state.sightings) ? state : { ...state, revision: state.revision + 1, sightings: next };
}
