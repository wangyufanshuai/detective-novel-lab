import assert from "node:assert/strict";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { batchTownResidents } from "../app/town-play/resident-batching.ts";

const prefix = "docs/3d-town/riverbend-residents-v2/";
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const manifest = JSON.parse(await fs.readFile("public/assets/riverbend/residents-v2/manifest.json","utf8"));
const form = JSON.parse(await fs.readFile(prefix+"form-review.json","utf8"));
const bytes = await fs.readFile("public"+manifest.asset.url);
assert.equal(hash(bytes),manifest.asset.sha256);
const {scene} = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),"");
let actorCount = 0;
for (const measured of form.actors) {
  const actor = scene.getObjectByName("actor_"+measured.actorId);
  assert(actor && actor.userData.actorId === measured.actorId);
  actorCount++;
  const box = new THREE.Box3().setFromObject(actor);
  assert(Math.abs(box.max.y - measured.bounds[2][1]) < .0001, "Export changed height or Y-up conversion");
  assert(Math.abs(box.min.y - measured.bounds[2][0]) < .0001, "Export changed ground contact");
  assert.deepEqual(actor.position.toArray(),[0,0,0], "Companion must not embed stale private-world positions");
  const joints = [];
  actor.traverse(o=>{if(o.userData.joint) joints.push(o);});
  assert.equal(joints.length,7);
  assert(joints.every(o=>o.rotation.toArray().slice(0,3).every(x=>Math.abs(x)<.000001)),"Rest joints must remain neutral");
  const knee = joints.find(o=>o.userData.joint==="knee_left");
  assert.equal(knee.parent.userData.joint,"leg_left","Knees must follow hips");
}
scene.position.set(2,0,-3); scene.rotation.y=.3;
const batch = batchTownResidents(scene);
assert.equal(batch.actorCount,12);
assert(batch.batchCount<=12 && batch.sourceMeshCount>200,"Articulated cast retains shared material batching");
let comparedVertices=0;
const expected=new THREE.Vector3(),actual=new THREE.Vector3(),matrix=new THREE.Matrix4();
function checkVertices() {
  scene.updateWorldMatrix(true,true);
  for(const entry of batch.entries) {
    const range=entry.batch.getGeometryRangeAt(entry.batch.getGeometryIdAt(entry.instanceId),{});
    const source=entry.source.geometry.attributes.position;
    entry.batch.getMatrixAt(entry.instanceId,matrix).premultiply(scene.matrixWorld);
    for(let i=0;i<source.count;i++) {
      expected.fromBufferAttribute(source,i).applyMatrix4(entry.source.matrixWorld);
      actual.fromBufferAttribute(entry.batch.geometry.attributes.position,range.vertexStart+i).applyMatrix4(matrix);
      assert(actual.distanceTo(expected)<.00002,"Batch diverged from the original GLB joint geometry"); comparedVertices++;
    }
  }
}
checkVertices();
const actor=scene.getObjectByName("actor_resident-01"), joint=scene.getObjectByName("resident-01_leg_left");
assert(joint);
const before=batch.entries.map(entry=>entry.matrix.clone());
joint.rotation.x=.29; actor.position.x=1.2;
batch.sync(); checkVertices();
for(let i=0;i<batch.entries.length;i++) assert.equal(batch.entries[i].matrix.equals(before[i]),batch.entries[i].actor!==actor,"One moving actor cannot alter another actor");
actor.visible=false; batch.sync();
for(const entry of batch.entries) assert.equal(entry.batch.getVisibleAt(entry.instanceId),entry.actor!==actor,"Batched limbs cannot leak a hidden resident");
actor.visible=true; batch.sync();
assert(batch.entries.every(entry=>entry.batch.getVisibleAt(entry.instanceId)));
const result={schema:"riverbend-resident-asset-checks.v2",passed:true,checkedAt:new Date().toISOString(),assetSha256:manifest.asset.sha256,
  actors:actorCount,meshes:batch.sourceMeshCount,batches:batch.batchCount,comparedVertices,
  inputs:await Promise.all(["app/town-play/resident-batching.ts","scripts/run-riverbend-resident-asset-checks.mjs"].map(async path=>({path,sha256:hash(await fs.readFile(path))}))),
  checks:["original-GLB-height-and-ground","neutral-local-positions","articulated-knee-parent","every-rest-and-posed-world-vertex","actor-isolation","hidden-limbs-absent","ordinary-mesh-path-preserved"]};
batch.dispose();assert(batch.entries.every(entry=>entry.source.visible));
await fs.writeFile(prefix+"asset-review.json",JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify(result));
