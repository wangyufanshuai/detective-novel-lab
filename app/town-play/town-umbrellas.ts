import * as THREE from "three";

/** Muted cloth colours; each resident keeps the same one. */
const CLOTH = ["#2f4a5a", "#6b2f2a", "#3c4a32", "#1f2629", "#7a5a2e", "#4a3c5a", "#5a6468", "#8a3d34"];

/** One canopy with its shaft, merged so a whole street of umbrellas is a single draw. */
function umbrellaGeometry() {
  const canopy = new THREE.ConeGeometry(.64, .26, 10, 1, true);
  canopy.translate(0, 1.02, 0);
  const shaft = new THREE.CylinderGeometry(.012, .012, 1.06, 5);
  shaft.translate(0, .51, 0);
  const tip = new THREE.CylinderGeometry(.01, .016, .1, 5);
  tip.translate(0, 1.19, 0);
  const parts = [canopy, shaft, tip].map(g => g.toNonIndexed());
  const count = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const position = new Float32Array(count * 3), normal = new Float32Array(count * 3);
  let at = 0;
  for (const g of parts) {
    position.set(g.attributes.position.array as Float32Array, at * 3);
    normal.set(g.attributes.normal.array as Float32Array, at * 3);
    at += g.attributes.position.count; g.dispose();
  }
  canopy.dispose(); shaft.dispose(); tip.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  return geometry;
}

/**
 * Umbrellas open over walkers once the rain is real, and fold away as it
 * eases. Presentation only: it reads actor transforms and the eased rain.
 */
export function createUmbrellas(max: number) {
  const material = new THREE.MeshStandardMaterial({ roughness: .75, metalness: 0, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(umbrellaGeometry(), material, max);
  mesh.name = "resident_umbrellas"; mesh.castShadow = true; mesh.frustumCulled = false; mesh.count = 0;
  const color = new THREE.Color(), hold = new THREE.Matrix4(), out = new THREE.Matrix4(), scale = new THREE.Vector3();
  // Held at the right hand, shaft rising past the shoulder.
  hold.makeTranslation(.2, 1.2, .04);
  // Colours exist before the first draw so the shader is built with them.
  for (let i = 0; i < max; i++) mesh.setColorAt(i, color.set(CLOTH[0]));
  let open = 0;
  return {
    object: mesh,
    /** True once the canopy is up enough for an arm to hold it. */
    get open() { return open; },
    update(delta: number, rain: number, actors: Array<{ object: THREE.Object3D; seed: number }>, reducedMotion: boolean) {
      const target = rain > .32 ? 1 : 0;
      open = reducedMotion ? target : open + (target - open) * Math.min(1, delta * 2.4);
      if (open < .02) { mesh.count = 0; return; }
      let n = 0;
      for (const { object, seed } of actors) {
        if (!object.visible || n >= max) continue;
        object.updateWorldMatrix(true, false);
        // Canopies spread as they open; the shaft never shrinks below the hand.
        scale.set(.35 + open * .65, 1, .35 + open * .65);
        out.multiplyMatrices(object.matrixWorld, hold).scale(scale);
        mesh.setMatrixAt(n, out);
        mesh.setColorAt(n, color.set(CLOTH[seed % CLOTH.length]));
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    dispose() { mesh.geometry.dispose(); material.dispose(); mesh.dispose(); },
  };
}
