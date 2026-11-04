import * as THREE from "three";
import type { TownPoint } from "../../lib/riverbend-navigation.ts";

/** Small pose-only layer over the authored rig. It never changes positions,
 * identity, world time, memories or what a resident is allowed to say. */
export function createResidentEncounter(people: ReadonlyMap<string, THREE.Object3D>) {
  let active = "", phase = 0;
  const joints = new Map<string, Map<string, THREE.Object3D>>();
  for (const [id, actor] of people) {
    const parts = new Map<string, THREE.Object3D>();
    actor.traverse(object => { if (typeof object.userData.joint === "string") parts.set(object.userData.joint, object); });
    joints.set(id, parts);
  }
  function reset(id: string) { for (const joint of joints.get(id)?.values() ?? []) joint.rotation.set(0, 0, 0); }
  return {
    update(actorId: string | null, player: TownPoint, delta: number, reducedMotion: boolean) {
      const actor = actorId ? people.get(actorId) : undefined;
      const next = actor?.visible ? actorId! : "";
      if (active !== next) { if (active) reset(active); active = next; phase = 0; }
      if (!active || !actor || !Number.isFinite(delta) || delta <= 0 || delta > .1) return;
      const heading = Math.atan2(player[0] - actor.position.x, -player[1] - actor.position.z);
      const angle = Math.atan2(Math.sin(heading - actor.rotation.y), Math.cos(heading - actor.rotation.y));
      actor.rotation.y += angle * (reducedMotion ? 1 : Math.min(1, delta * 7));
      phase += delta;
      for (const [name, joint] of joints.get(active) ?? []) {
        // Stop mid-stride feet before a stationary conversation.
        joint.rotation.set(0, 0, 0);
        if (name === "head" && !reducedMotion) { joint.rotation.x = Math.sin(phase * 1.5) * .035; joint.rotation.z = Math.sin(phase * .7) * .02; }
        if (name === "arm_right" && !reducedMotion) joint.rotation.x = -.10 + Math.sin(phase * 1.2) * .035;
      }
    },
  };
}
