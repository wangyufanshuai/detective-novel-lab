import * as THREE from "three";

/**
 * Rain as one batch of short line streaks (a single draw call). Drops live in
 * world space and wrap inside a box that follows the camera, so walking through
 * rain never drags the rain along, and turning it off costs nothing.
 */
export function createRain(capacity = 2600) {
  const positions = new Float32Array(capacity * 6);
  const seeds = new Float32Array(capacity * 4);
  let s = 7;
  const random = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let i = 0; i < capacity * 4; i++) seeds[i] = random();
  const geometry = new THREE.BufferGeometry();
  const attribute = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", attribute);
  const material = new THREE.LineBasicMaterial({ color: "#d3dee6", transparent: true, opacity: 0, depthWrite: false, fog: false });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false; lines.renderOrder = 3; lines.visible = false;
  let time = 0;
  const wrap = (v: number, span: number) => ((v % span) + span) % span - span / 2;

  return {
    object: lines,
    /** `amount` 0–1; `span` is the width of ground the camera sees; `still` freezes the drops. */
    update(delta: number, focus: THREE.Vector3, amount: number, span: number, still: boolean) {
      lines.visible = amount > .02;
      if (!lines.visible) return;
      if (!still) time += delta;
      const count = Math.floor(capacity * Math.min(1, amount * 1.15));
      const height = 26, length = still ? .35 : 1.1, slant = .22, fall = 24;
      for (let i = 0; i < count; i++) {
        const sx = seeds[i * 4], sz = seeds[i * 4 + 1], sy = seeds[i * 4 + 2], sv = seeds[i * 4 + 3];
        const y = height - ((sy * height + time * fall * (.8 + sv * .4)) % height);
        const x = focus.x + wrap(sx * 400 - focus.x + y * slant, span), z = focus.z + wrap(sz * 400 - focus.z, span);
        const o = i * 6;
        positions[o] = x; positions[o + 1] = y + length; positions[o + 2] = z;
        positions[o + 3] = x - slant * length; positions[o + 4] = y; positions[o + 5] = z;
      }
      geometry.setDrawRange(0, count * 2);
      attribute.needsUpdate = true;
      material.opacity = .22 + amount * .3;
    },
    dispose() { geometry.dispose(); material.dispose(); }
  };
}
