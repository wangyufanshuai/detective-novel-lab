import * as THREE from "three";
import { createTownNavigator, type TownNavigationData, type TownPoint } from "../../lib/riverbend-navigation.ts";

type VisiblePerson = { actorId: string; visibility: "observed" | "last-seen"; sceneId: string | null };
type LocalResident = {
  actor: THREE.Object3D; sceneId: string; position: TownPoint; path: TownPoint[];
  waypoint: number; pause: number; phase: number; blocked: number; walking: boolean;
  joints: Map<string, { object: THREE.Object3D; rest: THREE.Euler }>;
  /** Standing life: where the head looks, an occasional hand gesture, breathing. */
  idle: { look: number; lookTarget: number; nextLook: number; gesture: number; nextGesture: number; side: "arm_left" | "arm_right"; clock: number };
};
/** A standing resident turns to face the player inside this distance. */
const NOTICE_DISTANCE = 3.4;
// Includes the full foot/satchel envelope over the measured walk cycle, not just a torso.
export const RESIDENT_RADIUS = .63;
const distance = (a: TownPoint, b: TownPoint) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Presentation within an already observed place. This has no clock, NPC schedule,
 * private destination, case data, or ability to call an engine command. */
export function createResidentMotion(people: Map<string, THREE.Object3D>, data: TownNavigationData) {
  const nav = createTownNavigator({ ...data, player: { ...data.player, radius: RESIDENT_RADIUS } });
  const locals = new Map<string, LocalResident>();
  /** Eased weather from the scene: rain hurries walkers and raises umbrellas; fog slows them. */
  const air = { rain: 0, fog: 0, umbrella: 0 };
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
      const local: LocalResident = { actor, sceneId: person.sceneId, position: [...path[0]], path, waypoint: path.length > 1 ? 1 : 0, pause: 1.3 + seed % 5 * .8, phase: seed * 1.7, blocked: 0, walking: false, joints,
        idle: { look: 0, lookTarget: 0, nextLook: 1 + seed % 4, gesture: 0, nextGesture: 5 + seed % 7 * 1.3, side: seed % 2 ? "arm_left" : "arm_right", clock: seed * .9 } };
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
        const step = Math.min(remaining, delta * .66 * (1 + air.rain * .45) * (1 - air.fog * .25));
        if (remaining < .025) {
          local.waypoint = (local.waypoint + 1) % local.path.length;
          // Nobody lingers in the rain; fog makes people stop and peer.
          local.pause = (2.5 + local.phase % 3.5) * (1 - air.rain * .6) * (1 + air.fog * .5);
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
      const idle = local.idle;
      if (!local.walking) {
        idle.clock += delta;
        // Notice the player: the body turns slowly, the head leads.
        const near = distance(local.position, player) < NOTICE_DISTANCE;
        if (near) {
          const heading = Math.atan2(player[0] - local.position[0], -(player[1] - local.position[1]));
          const angle = Math.atan2(Math.sin(heading - local.actor.rotation.y), Math.cos(heading - local.actor.rotation.y));
          local.actor.rotation.y += angle * Math.min(1, delta * 2.2);
          idle.lookTarget = THREE.MathUtils.clamp(angle * .8, -.5, .5);
        } else if (idle.clock > idle.nextLook) {
          idle.lookTarget = Math.sin(idle.clock * 12.9898 + local.phase) * .5 * (Math.abs(idle.lookTarget) > .2 ? .3 : 1);
          idle.nextLook = idle.clock + 2.2 + (local.phase * 7 + idle.clock) % 3.5;
        }
        // Now and then a small gesture: a hand to the collar, a glance at a watch.
        if (!near && idle.clock > idle.nextGesture) { idle.gesture = 1.6; idle.nextGesture = idle.clock + 7 + (local.phase * 3 + idle.clock) % 8; idle.side = idle.side === "arm_left" ? "arm_right" : "arm_left"; }
      } else { idle.lookTarget = 0; idle.gesture = 0; }
      idle.look += (idle.lookTarget - idle.look) * Math.min(1, delta * 3.5);
      idle.gesture = Math.max(0, idle.gesture - delta);
      const lift = idle.gesture > 0 ? Math.sin(Math.min(1, (1.6 - idle.gesture) / 1.6) * Math.PI) : 0;
      // Breathing, kept well under a centimetre of rise.
      local.actor.scale.y = local.walking ? 1 : 1 + Math.sin(idle.clock * 1.6 + local.phase) * .006;
      for (const [name, joint] of local.joints) {
        joint.object.rotation.copy(joint.rest);
        if (name === "arm_right" && air.umbrella > .05) {
          // Holding the umbrella: forearm up and in, steady while walking.
          joint.object.rotation.x -= air.umbrella * .95;
          joint.object.rotation.z += air.umbrella * .18;
          continue;
        }
        const stride = Math.sin(local.phase + (name.endsWith("right") ? Math.PI : 0));
        if (local.walking) {
          if (name.startsWith("leg_")) joint.object.rotation.x += stride * .30;
          if (name.startsWith("knee_")) joint.object.rotation.x -= Math.max(0, -stride) * .42;
          if (name.startsWith("arm_")) joint.object.rotation.x -= stride * .23;
        } else if (name === "head") {
          joint.object.rotation.y += idle.look;
          // Heads dip a little against the rain.
          joint.object.rotation.x += Math.sin(idle.clock * .8 + local.phase) * .025 + air.rain * .12;
        } else if (name === idle.side && lift > 0) {
          joint.object.rotation.x -= lift * .55;
          joint.object.rotation.z += (name === "arm_left" ? -1 : 1) * lift * .12;
        } else if (name.startsWith("arm_")) joint.object.rotation.x += Math.sin(idle.clock * 1.6 + local.phase) * .02;
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
  function weather(rain: number, fog: number, umbrella: number) { air.rain = rain; air.fog = fog; air.umbrella = umbrella; }
  const actors = () => [...locals].map(([actorId, local]) => ({ object: local.actor, seed: Number(actorId.slice(-2)) || 1 }));
  return { reconcile, update, constrainPlayer, weather, actors,
    snapshot: () => [...locals].map(([actorId, local]) => ({ actorId, sceneId: local.sceneId, position: [...local.position], walking: local.walking, path: local.path.map(point => [...point]), jointAngles: [...local.joints].map(([name, joint]) => ({ name, x: joint.object.rotation.x, y: joint.object.rotation.y })) })),
  };
}
