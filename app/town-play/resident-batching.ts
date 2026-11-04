import * as THREE from "three";

type Entry = {
  actor: THREE.Object3D;
  source: THREE.Mesh;
  batch: THREE.BatchedMesh;
  instanceId: number;
  matrix: THREE.Matrix4;
  visible: boolean;
};

/** Shares draw calls while keeping the authored actor graph available for schedules. */
export function batchTownResidents(model: THREE.Object3D) {
  const actors: THREE.Object3D[] = [];
  model.traverse(object => {
    if (typeof object.userData.actorId === "string" && /^resident-\d+$/.test(object.userData.actorId)) actors.push(object);
  });
  const group = new THREE.Group();
  group.name = "resident_render_batches";
  const materials = new Map<THREE.Material, { actor: THREE.Object3D; mesh: THREE.Mesh }[]>();
  model.updateWorldMatrix(true, true);
  for (const actor of actors) actor.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.SkinnedMesh || Array.isArray(object.material)) return;
    // Keep unsupported or customized meshes on the ordinary renderer path.
    const attributes = Object.keys(object.geometry.attributes).sort().join(",");
    if (!object.visible || object.material.transparent || object.morphTargetInfluences?.length || !object.geometry.index || attributes !== "normal,position" || object.matrixWorld.determinant() <= 0) return;
    const items = materials.get(object.material) ?? [];
    items.push({ actor, mesh: object }); materials.set(object.material, items);
  });
  const entries: Entry[] = [];
  for (const [material, sources] of materials) {
    if (sources.length < 2) continue;
    const vertexCount = sources.reduce((sum, { mesh }) => sum + mesh.geometry.attributes.position.count, 0);
    const indexCount = sources.reduce((sum, { mesh }) => sum + mesh.geometry.index!.count, 0);
    const batch = new THREE.BatchedMesh(sources.length, vertexCount, indexCount, material);
    batch.name = `resident_batch_${material.name}`;
    batch.castShadow = true; batch.receiveShadow = true;
    // The top-level bound would become stale when a resident moves. Each instance
    // still gets the renderer's normal camera/shadow frustum test.
    batch.frustumCulled = false;
    group.add(batch);
    for (const { actor, mesh } of sources) {
      const instanceId = batch.addInstance(batch.addGeometry(mesh.geometry));
      entries.push({ actor, source: mesh, batch, instanceId, matrix: new THREE.Matrix4().makeScale(0, 0, 0), visible: true });
      mesh.visible = false;
    }
  }
  model.add(group);
  const inverse = new THREE.Matrix4(), local = new THREE.Matrix4();
  function sync() {
    model.updateWorldMatrix(true, true);
    inverse.copy(model.matrixWorld).invert();
    for (const entry of entries) {
      let visible = true;
      // source.visible is intentionally false; semantic actor/parent visibility
      // remains authoritative and must also hide all its render instances.
      for (let node = entry.source.parent; node; node = node.parent) visible &&= node.visible;
      if (visible !== entry.visible) { entry.batch.setVisibleAt(entry.instanceId, visible); entry.visible = visible; }
      local.multiplyMatrices(inverse, entry.source.matrixWorld);
      if (!entry.matrix.equals(local)) {
        entry.batch.setMatrixAt(entry.instanceId, local);
        entry.matrix.copy(local);
      }
    }
  }
  sync();
  return {
    group, entries, sync,
    actorCount: new Set(entries.map(entry => entry.actor)).size,
    sourceMeshCount: entries.length,
    batchCount: group.children.length,
    dispose() {
      group.removeFromParent();
      for (const entry of entries) entry.source.visible = true;
      for (const batch of group.children) (batch as THREE.BatchedMesh).dispose();
    }
  };
}
