import * as THREE from "three";

/** Keep the actual skinned soles above the character's authored floor while
 * clips blend. This only corrects small vertical interpolation errors; routes
 * and horizontal foot planting remain the motion controller's responsibility. */
export function createCharacterGrounding(root: THREE.Object3D, maximumLiftMeters = .012) {
  if (!Number.isFinite(maximumLiftMeters) || maximumLiftMeters <= 0 || maximumLiftMeters > .02) throw new Error("人物贴地范围无效");
  const supports: { mesh: THREE.SkinnedMesh; indices: number[] }[] = [];
  const joints = new THREE.Vector4(), weights = new THREE.Vector4();
  root.traverse(object => {
    const mesh = object as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const skinIndex = mesh.geometry.getAttribute("skinIndex"), skinWeight = mesh.geometry.getAttribute("skinWeight");
    if (!skinIndex || !skinWeight) return;
    const indices: number[] = [];
    for (let index = 0; index < skinIndex.count; index++) {
      joints.set(skinIndex.getX(index), skinIndex.getY(index), skinIndex.getZ(index), skinIndex.getW(index));
      weights.set(skinWeight.getX(index), skinWeight.getY(index), skinWeight.getZ(index), skinWeight.getW(index));
      let total = 0;
      for (let component = 0; component < 4; component++) {
        const name = mesh.skeleton.bones[joints.getComponent(component)]?.name;
        if (name === "foot_L" || name === "foot_R") total += weights.getComponent(component);
      }
      if (total > .5) indices.push(index);
    }
    if (indices.length) supports.push({ mesh, indices });
  });
  if (!supports.length) throw new Error("人物鞋底定位信息不完整");
  const baseY = root.position.y, point = new THREE.Vector3(), inverse = new THREE.Matrix4();
  const supportVertices = supports.reduce((count, item) => count + item.indices.length, 0);
  let appliedLift = 0, maximumAppliedLift = 0, minimumBeforeLift = 0;
  function updateMatrices() {
    root.updateWorldMatrix(true, false);
    // SkinnedMesh.updateMatrixWorld also refreshes its attached bind inverse.
    root.updateMatrixWorld(true);
  }
  return {
    correct() {
      root.position.y = baseY;
      updateMatrices();
      inverse.copy(root.matrixWorld).invert();
      let minimum = Infinity;
      for (const { mesh, indices } of supports) for (const index of indices) {
        mesh.getVertexPosition(index, point).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
        minimum = Math.min(minimum, point.y);
      }
      const lift = Math.max(0, -minimum);
      if (!Number.isFinite(lift) || lift > maximumLiftMeters) throw new Error("人物动作超出了已验收的贴地范围");
      minimumBeforeLift = minimum; appliedLift = lift; maximumAppliedLift = Math.max(maximumAppliedLift, lift);
      root.position.y = baseY + lift;
      updateMatrices();
      return lift;
    },
    reset() { root.position.y = baseY; appliedLift = 0; updateMatrices(); },
    diagnostics() { return { supportVertices, minimumBeforeLift, appliedLift, maximumAppliedLift, maximumLiftMeters }; },
  };
}
