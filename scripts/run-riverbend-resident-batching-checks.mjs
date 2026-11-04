import assert from "node:assert/strict";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { batchTownResidents } from "../app/town-play/resident-batching.ts";

const root = process.cwd();
const bytes = await fs.readFile(`${root}/public/assets/riverbend/v1/town.glb`);
const manifest = JSON.parse(await fs.readFile(`${root}/public/assets/riverbend/v1/manifest.json`, "utf8"));
assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), manifest.asset.sha256);
const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
scene.position.set(2, 0, -3);
scene.rotation.y = .3;
scene.updateWorldMatrix(true, true);
const player = scene.getObjectByName("actor_player");
const playerMeshes = [];
player.traverse(object => { if (object.isMesh) playerMeshes.push(object); });
const batch = batchTownResidents(scene);
assert.equal(batch.actorCount, 12, "all 12 original resident identities retained");
assert.ok(batch.batchCount < batch.sourceMeshCount);
assert.ok(playerMeshes.every(mesh => mesh.visible), "player and animated limbs remain independently rendered");

let comparedVertices = 0;
const actual = new THREE.Vector3(), expected = new THREE.Vector3(), matrix = new THREE.Matrix4();
for (const entry of batch.entries) {
  const geometryId = entry.batch.getGeometryIdAt(entry.instanceId);
  const range = entry.batch.getGeometryRangeAt(geometryId, {});
  const source = entry.source.geometry.attributes.position;
  assert.equal(range.vertexCount, source.count);
  assert.equal(range.indexCount, entry.source.geometry.index.count);
  assert.equal(entry.batch.material, entry.source.material, "material and color remain the authored material");
  entry.batch.getMatrixAt(entry.instanceId, matrix).premultiply(scene.matrixWorld);
  for (let i = 0; i < source.count; i++) {
    expected.fromBufferAttribute(source, i).applyMatrix4(entry.source.matrixWorld);
    actual.fromBufferAttribute(entry.batch.geometry.attributes.position, range.vertexStart + i).applyMatrix4(matrix);
    assert.ok(actual.distanceTo(expected) < .00002, "every batched vertex must keep its world position");
    comparedVertices++;
  }
}
const movedActor = scene.getObjectByName("actor_resident-01");
const before = batch.entries.map(entry => entry.batch.getMatrixAt(entry.instanceId, new THREE.Matrix4()));
movedActor.position.x += 2;
movedActor.rotation.y += .5;
batch.sync();
for (let i = 0; i < batch.entries.length; i++) {
  const entry = batch.entries[i];
  entry.batch.getMatrixAt(entry.instanceId, matrix);
  assert.equal(matrix.equals(before[i]), entry.actor !== movedActor, "moving one resident cannot move or freeze another");
}
movedActor.visible = false;
batch.sync();
for (const entry of batch.entries) assert.equal(entry.batch.getVisibleAt(entry.instanceId), entry.actor !== movedActor, "hidden actor must not remain visible through batching");
movedActor.visible = true;
batch.sync();
assert.ok(batch.entries.every(entry => entry.batch.getVisibleAt(entry.instanceId)));
const summary = { schema: "riverbend-resident-batching-checks.v1", passed: true, checkedAt: new Date().toISOString(), assetSha256: manifest.asset.sha256, actors: batch.actorCount, sourceMeshes: batch.sourceMeshCount, batches: batch.batchCount, comparedVertices, checks: ["asset-identity", "all-world-space-vertices", "index-count", "original-material", "player-limbs-independent", "resident-move-isolated", "hidden-resident-no-leak", "show-resident", "dispose-restores-source"] };
batch.dispose();
assert.equal(batch.group.parent, null);
assert.ok(batch.entries.every(entry => entry.source.visible));
await fs.writeFile(`${root}/docs/3d-town/riverbend-v1/resident-batching-review.json`, JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary));
