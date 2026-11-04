import * as THREE from "three";

/** Deterministic exterior snowfall. The building envelope stays free of flakes. */
export function createManorWeather(high: boolean, storm: boolean) {
  const count = storm ? (high ? 4800 : 2200) : (high ? 1800 : 850);
  const positions = new Float32Array(count * 3), seeds = new Float32Array(count);
  let seed = 1447;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < count; i++) {
    positions[i * 3] = random() * 68 - 34;
    positions[i * 3 + 1] = random() * 17;
    positions[i * 3 + 2] = random() * 74 - 32;
    seeds[i] = random();
    if (inside(i)) positions[i * 3 + 1] = 17;
  }
  function inside(i: number) {
    const j = i * 3;
    return Math.abs(positions[j]) < 12.6 && positions[j + 2] > -13 && positions[j + 2] < 3.4 && positions[j + 1] < 11.5;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("flakeSeed", new THREE.BufferAttribute(seeds, 1));
  const uniforms = { viewportHeight: { value: 900 } };
  const material = storm ? new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, toneMapped: false,
    vertexShader: `
      attribute float flakeSeed;
      uniform float viewportHeight;
      varying float vSeed;
      varying float vDepth;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        vSeed = flakeSeed;
        vDepth = -view.z;
        gl_PointSize = clamp(viewportHeight * (0.025 + flakeSeed * 0.034) / max(1.0, -view.z), 1.0, 16.0);
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `
      varying float vSeed;
      varying float vDepth;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        p = mat2(0.81, -0.586, 0.586, 0.81) * p;
        p.x *= mix(1.7, 2.9, vSeed);
        p.y *= 0.92;
        float edge = 1.0 - smoothstep(0.06, 0.49, length(p));
        float depthFade = 1.0 - smoothstep(32.0, 85.0, vDepth);
        float alpha = edge * depthFade * mix(0.25, 0.69, vSeed);
        if (alpha < 0.015) discard;
        gl_FragColor = vec4(0.78, 0.86, 0.94, alpha);
        #include <colorspace_fragment>
      }`,
  }) : new THREE.PointsMaterial({ color: "#e6edf0", size: .045, transparent: true, opacity: .7, depthWrite: false });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return {
    points, count,
    update(dt: number, seconds: number, height: number) {
      uniforms.viewportHeight.value = height;
      const gust = storm ? 4.5 + Math.sin(seconds * .37) * 1.1 + Math.sin(seconds * .91) * .5 : 2.8;
      for (let i = 0; i < count; i++) {
        const j = i * 3;
        positions[j] += dt * (gust + (storm ? seeds[i] * 2.4 : 0));
        positions[j + 1] -= dt * (storm ? 1.9 + seeds[i] * 2.0 : 1.7 + i % 5 * .17);
        positions[j + 2] += dt * (storm ? 1.0 + seeds[i] * .35 : .65);
        if (positions[j] > 34) positions[j] = -34;
        if (positions[j + 2] > 42) positions[j + 2] = -32;
        if (positions[j + 1] < -.1 || inside(i)) positions[j + 1] = 17;
      }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}
