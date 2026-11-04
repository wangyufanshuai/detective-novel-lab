import type { TownDestination, TownPoint } from "../../lib/riverbend-navigation.ts";

export type TownContact = { actorId: string; npcId: string; name: string; role: string; sceneId: string };
type Witness = Omit<TownContact, "sceneId"> & { sceneId: string | null; visibility: "observed" | "last-seen" };
export type TownInteraction = { kind: "resident"; person: TownContact } | { kind: "place"; place: TownDestination };

/** Client proximity selects an affordance only. The owned server command still
 * checks the actual world's co-location and discovered evidence independently. */
export function chooseTownInteraction(input: {
  position: TownPoint; sceneId: string; confirmedSceneId: string | null;
  residents: readonly Witness[]; actorPositions: ReadonlyMap<string, TownPoint>;
  nearby: TownDestination | null; valid: (x: number, y: number) => boolean;
}): TownInteraction | null {
  if (input.sceneId !== input.confirmedSceneId) return null;
  const door = input.nearby?.id === input.confirmedSceneId ? input.nearby : null;
  let person: TownContact | null = null, nearest = 1.85;
  for (const witness of input.residents) {
    if (witness.visibility !== "observed" || witness.sceneId !== input.confirmedSceneId) continue;
    const point = input.actorPositions.get(witness.actorId);
    if (!point) continue;
    const distance = Math.hypot(point[0] - input.position[0], point[1] - input.position[1]);
    if (distance > nearest) continue;
    // A nearby body across a wall must not create a conversation prompt.
    const steps = Math.max(1, Math.ceil(distance / .1));
    let clear = true;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (!input.valid(input.position[0] + (point[0] - input.position[0]) * t, input.position[1] + (point[1] - input.position[1]) * t)) { clear = false; break; }
    }
    if (!clear) continue;
    person = { actorId: witness.actorId, npcId: witness.npcId, name: witness.name, role: witness.role, sceneId: witness.sceneId! };
    nearest = distance;
  }
  // At a doorway, the nearer door wins. Walking towards a resident selects that
  // resident; merely loading new models cannot steal an existing door action.
  if (door && (!person || Math.hypot(door.entrance[0] - input.position[0], door.entrance[1] - input.position[1]) < nearest)) return { kind: "place", place: door };
  return person ? { kind: "resident", person } : door ? { kind: "place", place: door } : null;
}

export function interactionKey(value: TownInteraction | null) {
  return value?.kind === "resident" ? `person:${value.person.actorId}` : value?.kind === "place" ? `place:${value.place.id}` : "";
}
