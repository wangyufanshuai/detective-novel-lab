import * as THREE from "three";
import { createTownNavigator, type TownNavigationData, type TownPoint } from "../../lib/riverbend-navigation.ts";

type VisiblePerson = { actorId: string; visibility: "observed" | "last-seen"; sceneId: string | null };
type LocalResident = {
  actor: THREE.Object3D; sceneId: string; position: TownPoint; path: TownPoint[];
  waypoint: number; pause: number; phase: number; blocked: number; walking: boolean;
  joints: Map<string, { object: THREE.Object3D; rest: THREE.Euler }>;
};
// Includes the full foot/satchel envelope over the measured walk cycle, not just a torso.
export const RESIDENT_RADIUS = .63;
const distance = (a: TownPoint, b: TownPoint) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Presentation within an already observed place. This has no clock, NPC schedule,
 * private destination, case data, or ability to call an engine command. */
export function createResidentMotion(people: Map<string, THREE.Object3D>, data: TownNavigationData) {
  const nav = createTownNavigator({ ...data, player: { ...data.player, radius: RESIDENT_RADIUS } });
  const locals = new Map<string, LocalResident>();
  const offsets: TownPoint[] = [[-1.65,-2.0],[1.85,-2.6],[-3.4,-3.5],[3.5,-1.65],[.15,-4.3],[-2,-4.9],[3.4,-4.7],[0,-6.0]];
  function clearSegment(a: TownPoint, b: TownPoint) {
    const length = distance(a, b);
    for (let step = 0; step <= Math.ceil(length / .07); step++) {
      const t = Math.min(1, step * .07 / Math.max(.001, length));
      if (!nav.valid(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false;
    }
    return nav.valid(...b);
  }
  function routeAt(anchor: TownPoint, index: number, occupied: TownPoint[], player: TownPoint, sceneId: string): TownPoint[] | null {
    // The inn fronts the quay. Its walkable strip runs east-west, not into the river.
    const places: TownPoint[] = sceneId === "inn" ? [[-3.9,-1.15],[3.9,-1.15],[-1.3,-1.15],[1.3,-1.15],[-5.4,-.7],[5.4,-.7]] : offsets;
    for (let attempt = 0; attempt < places.length * 2; attempt++) {
      const offset = places[(index + attempt) % places.length];
      const start: TownPoint = [anchor[0] + offset[0], anchor[1] + offset[1] - (attempt >= places.length && sceneId !== "inn" ? .8 : 0)];
      if (!nav.valid(...start) || occupied.some(p => distance(p, start) < RESIDENT_RADIUS * 2 + .25) || distance(player, start) < RESIDENT_RADIUS + data.player.radius + .1) continue;
      // Small, measured sidewalk segments. Invalid or crowded destinations are
      // discarded; the actor stays still rather than cutting through furniture.
      const paths: TownPoint[][] = sceneId === "inn" ? [[start,[start[0]+.7,start[1]]],[start,[start[0]-.7,start[1]]]] : [
        [start, [start[0] + .85, start[1] - .35], [start[0] + .35, start[1] - .85]],
        [start, [start[0] - .80, start[1] - .30], [start[0] - .35, start[1] - .80]],
        [start, [start[0] + .1, start[1] - .90]],
      ];
      const selected = paths.find(path => path.every((point, i) => clearSegment(point, path[(i + 1) % path.length]) && occupied.every(other => distance(point, other) > RESIDENT_RADIUS * 2 + .15)));
      return selected ?? [start];
    }
    return null;
  }
  function reconcile(residents: readonly VisiblePerson[], player: TownPoint) {
    const observed = residents.filter((person): person is VisiblePerson & { sceneId: string } => person.visibility === "observed" && typeof person.sceneId === "string").sort((a, b) => a.actorId.localeCompare(b.actorId));
    const wanted = new Map(observed.map(person => [person.actorId, person.sceneId]));
    for (const [id, local] of locals) {
      if (wanted.get(id) !== local.sceneId) { local.actor.visible = false; locals.delete(id); }
    }
    for (const [id, actor] of people) if (!wanted.has(id)) actor.visible = false;
    for (const person of observed) {
      if (locals.has(person.actorId)) continue; // A refreshed view cannot reset a walk or jitter a resident.
      const actor = people.get(person.actorId);
      const anchor: TownPoint | undefined = person.sceneId === "town-square" ? [-1.5, .5] : data.destinations.find(place => place.id === person.sceneId)?.entrance;
      if (!actor || !anchor) continue;
      const seed = Number(person.actorId.slice(-2)) || 1;
      const occupied = [...locals.values()].flatMap(local => local.path);
      const path = routeAt(anchor, seed % offsets.length, occupied, player, person.sceneId);
      if (!path) { actor.visible = false; continue; }
      const joints = new Map<string, { object: THREE.Object3D; rest: THREE.Euler }>();
      actor.traverse(object => { if (typeof object.userData.joint === "string") joints.set(object.userData.joint, { object, rest: new THREE.Euler(0, 0, 0) }); });
      const local: LocalResident = { actor, sceneId: person.sceneId, position: [...path[0]], path, waypoint: path.length > 1 ? 1 : 0, pause: 1.3 + seed % 5 * .8, phase: seed * 1.7, blocked: 0, walking: false, joints };
      locals.set(person.actorId, local);
      actor.position.set(local.position[0], nav.height(local.position) - .04, -local.position[1]);
      actor.rotation.y = (seed % 3 - 1) * .35;
      actor.visible = true;
    }
  }
  function update(delta: number, player: TownPoint, paused: boolean, reducedMotion: boolean) {
    if (!Number.isFinite(delta) || delta <= 0 || delta > .1) return;
    for (const local of locals.values()) {
      if (paused || reducedMotion) { local.walking = false; continue; }
      local.pause = Math.max(0, local.pause - delta);
      local.walking = false;
      if (local.pause === 0 && local.path.length > 1) {
        const target = local.path[local.waypoint];
        const remaining = distance(local.position, target);
        const step = Math.min(remaining, delta * .66);
        if (remaining < .025) {
          local.waypoint = (local.waypoint + 1) % local.path.length;
          local.pause = 2.5 + local.phase % 3.5;
        } else {
          const next: TownPoint = [local.position[0] + (target[0] - local.position[0]) / remaining * step, local.position[1] + (target[1] - local.position[1]) / remaining * step];
          const blocked = distance(next, player) < RESIDENT_RADIUS + data.player.radius + .10 || [...locals.values()].some(other => other !== local && distance(next, other.position) < RESIDENT_RADIUS * 2 + .08);
          if (blocked || !clearSegment(local.position, next)) {
            local.blocked += delta;
            if (local.blocked > 1.2) { local.waypoint = (local.waypoint + 1) % local.path.length; local.pause = 1.5; local.blocked = 0; }
          } else {
            const heading = Math.atan2(next[0] - local.position[0], -(next[1] - local.position[1]));
            const angle = Math.atan2(Math.sin(heading - local.actor.rotation.y), Math.cos(heading - local.actor.rotation.y));
            local.actor.rotation.y += angle * Math.min(1, delta * 9);
            local.position = next; local.walking = true; local.blocked = 0; local.phase += delta * 5.8;
          }
        }
      }
      local.actor.position.set(local.position[0], nav.height(local.position) - .04, -local.position[1]);
      for (const [name, joint] of local.joints) {
        joint.object.rotation.copy(joint.rest);
        const stride = Math.sin(local.phase + (name.endsWith("right") ? Math.PI : 0));
        if (local.walking) {
          if (name.startsWith("leg_")) joint.object.rotation.x += stride * .30;
          if (name.startsWith("knee_")) joint.object.rotation.x -= Math.max(0, -stride) * .42;
          if (name.startsWith("arm_")) joint.object.rotation.x -= stride * .23;
        } else if (name === "head") joint.object.rotation.y += Math.sin(local.phase + local.pause * .25) * .055;
      }
    }
  }
  function constrainPlayer(from: TownPoint, next: TownPoint): TownPoint {
    // Permit escape from an overlapping restored position; never trap the player.
    for (const local of locals.values()) {
      if (distance(next, local.position) < RESIDENT_RADIUS + data.player.radius && distance(next, local.position) < distance(from, local.position)) return [...from];
    }
    return next;
  }
  return { reconcile, update, constrainPlayer,
    snapshot: () => [...locals].map(([actorId, local]) => ({ actorId, sceneId: local.sceneId, position: [...local.position], walking: local.walking, path: local.path.map(point => [...point]), jointAngles: [...local.joints].map(([name, joint]) => ({ name, x: joint.object.rotation.x, y: joint.object.rotation.y })) })),
  };
}
