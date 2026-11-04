import * as THREE from "three";

/** Keep the complete building in the shadow pass while the camera sees a cutaway. */
export function createCutawayShadows(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  // The tiny colour target and empty camera frustum avoid drawing the complete
  // building twice. A normal renderer.render still initializes Three's render
  // state and renders the directional shadow map through its public API.
  const scratch = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false });
  const camera = new THREE.PerspectiveCamera(30, 1, .1, .2);
  camera.position.set(0, 1000, 0); camera.lookAt(0, 1001, 0);
  let updates = 0;
  let occluders: string[] = [];
  return {
    update(cutawayRoots: THREE.Object3D[]) {
      const hidden = cutawayRoots.filter(root => !root.visible);
      occluders = hidden.map(root => root.name);
      if (hidden.length === 0) { renderer.shadowMap.autoUpdate = true; return; }
      const target = renderer.getRenderTarget();
      const face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
      try {
        for (const root of hidden) root.visible = true;
        renderer.shadowMap.autoUpdate = true;
        renderer.setRenderTarget(scratch);
        renderer.render(scene, camera);
        updates++;
      } finally {
        for (const root of hidden) root.visible = false;
        renderer.setRenderTarget(target, face, mip);
        // Reuse this complete-shell shadow map in the colour and AO passes.
        renderer.shadowMap.autoUpdate = false;
      }
    },
    diagnostics() { return { mode: occluders.length ? "complete-shell" : "normal", updates, occluders: [...occluders] }; },
    dispose() { scratch.dispose(); },
  };
}
