import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { createNoirTestLoader } from './noir-player-test-loader.mjs';

const root = process.cwd(), pilot = process.argv[2] ?? 'step-15';
const variant = process.argv[3] ?? 'raw';
const selectedActor = process.argv[4];
assert(['raw', 'optimized'].includes(variant));
assert(!selectedActor || ['resident-03', 'resident-06', 'resident-08'].includes(selectedActor));
const base = path.join(root, 'docs/3d-town/classic-motion-v2', pilot);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const helper = 'app/town-play/art-sample/character-grounding.ts';
const { createCharacterGrounding } = createNoirTestLoader(root).load(helper);
const study = read(path.join(base, 'blend-diagnostic.json'));
assert(study.complete && study.garmentPassed);
assert(!study.selectedActor || study.selectedActor === selectedActor);
const prefix = variant === 'raw' ? 'runtime-grounding' : 'optimized-runtime-grounding';
const output = path.join(base, prefix + '-diagnostic.json');
assert(!fs.existsSync(output), 'Preserve the preceding runtime diagnostic.');

// CPU geometry/animation inspection does not need image decoding. Remove only
// material references from the in-memory copy, keeping the binary, skins,
// morph targets and animations unchanged. The on-disk asset is untouched.
function geometryOnlyBuffer(file) {
  const raw = fs.readFileSync(file), length = raw.readUInt32LE(12);
  const doc = JSON.parse(raw.subarray(20, 20 + length).toString('utf8'));
  for (const mesh of doc.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  delete doc.materials; delete doc.images; delete doc.textures; delete doc.samplers;
  const json = Buffer.from(JSON.stringify(doc)), jsonLength = Math.ceil(json.length / 4) * 4;
  const tail = raw.subarray(20 + length);
  const buffer = Buffer.alloc(20 + jsonLength + tail.length, 0x20);
  raw.copy(buffer, 0, 0, 12); buffer.writeUInt32LE(buffer.length, 8); buffer.writeUInt32LE(jsonLength, 12); buffer.writeUInt32LE(0x4e4f534a, 16);
  json.copy(buffer, 20); tail.copy(buffer, 20 + jsonLength);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}
const rows = [], identities = {};
for (const actorId of selectedActor ? [selectedActor] : ['resident-03', 'resident-06', 'resident-08']) {
  const folder = path.join(base, 'export-candidate-02', actorId);
  const receipt = read(path.join(folder, 'export-review.json'));
  const asset = path.join(folder, variant === 'raw' ? 'resident-raw.glb' : 'optimized.glb');
  const optimization = variant === 'optimized' ? read(path.join(folder, 'optimization-review.json')) : null;
  const expectedHash = optimization?.optimized.sha256 ?? receipt.asset.sha256;
  assert(receipt.complete && expectedHash === hash(asset));
  if (optimization) assert(optimization.complete && optimization.sourceAssetSha256 === receipt.asset.sha256);
  identities[path.relative(root, asset).replaceAll('\\', '/')] = hash(asset);
  const loaded = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(geometryOnlyBuffer(asset), '');
  const stage = new THREE.Group(); stage.add(loaded.scene);
  const mixer = new THREE.AnimationMixer(loaded.scene), clips = new Map(loaded.animations.map(clip => [clip.name, clip]));
  assert.equal(clips.size, 6);
  const grounding = createCharacterGrounding(loaded.scene);
  const meshes = []; loaded.scene.traverse(object => { if (object.isSkinnedMesh) meshes.push(object); });
  const point = new THREE.Vector3();
  function actualBodyMinimum() {
    stage.updateMatrixWorld(true);
    let minimum = Infinity;
    for (const mesh of meshes) for (let index = 0; index < mesh.geometry.getAttribute('position').count; index++) {
      mesh.getVertexPosition(index, point).applyMatrix4(mesh.matrixWorld);
      minimum = Math.min(minimum, point.y);
    }
    return minimum;
  }
  function clipTime(name, seconds) {
    const duration = clips.get(name).duration;
    return name === 'Walk' || name === 'Idle' ? seconds % duration : Math.min(seconds, duration);
  }
  for (const plan of study.rows.filter(row => row.actorId === actorId)) {
    mixer.stopAllAction(); grounding.reset();
    const a = mixer.clipAction(clips.get(plan.outgoing[0])).play();
    const b = mixer.clipAction(clips.get(plan.incoming[0])).play();
    a.paused = true; b.paused = true;
    const count = Math.ceil(plan.durationSeconds * 60), samples = [];
    for (let index = 0; index <= count; index++) {
      const q = index / count, t = plan.durationSeconds * q, weight = q * q * (3 - 2 * q);
      a.time = clipTime(plan.outgoing[0], plan.outgoing[1] + t);
      b.time = clipTime(plan.incoming[0], plan.incoming[1] + t);
      a.setEffectiveWeight(1 - weight); b.setEffectiveWeight(weight);
      mixer.update(0);
      const lift = grounding.correct(), after = actualBodyMinimum();
      samples.push({ seconds: t, weight, liftMeters: lift, minimumBodyHeightMeters: after });
    }
    const row = { actorId, transition: plan.name, samples, maximumAppliedLiftMeters: Math.max(...samples.map(s => s.liftMeters)),
      minimumBodyHeightMeters: Math.min(...samples.map(s => s.minimumBodyHeightMeters)), supportVertices: grounding.diagnostics().supportVertices };
    row.passed = row.minimumBodyHeightMeters >= -.00001 && row.maximumAppliedLiftMeters <= .012;
    rows.push(row);
    console.log(JSON.stringify({ actorId, transition: row.transition, passed: row.passed, maximumAppliedLiftMeters: row.maximumAppliedLiftMeters }));
  }
  mixer.stopAllAction(); mixer.uncacheRoot(loaded.scene);
  for (const mesh of meshes) { mesh.geometry.dispose(); for (const material of [mesh.material].flat()) material.dispose(); }
  assert.equal(hash(asset), expectedHash);
}
assert.equal(rows.length, selectedActor ? 19 : 57);
const report = { schema: 'classic-runtime-grounding-diagnostic.v1', complete: true, selectedActor: selectedActor ?? null, passed: rows.every(row => row.passed), rows,
  assetVariant: variant,
  assetHashes: identities, helperSha256: hash(path.join(root, helper)), inspectorSha256: hash(new URL(import.meta.url)),
  blendPlanSha256: hash(path.join(base, 'blend-diagnostic.json')), sourceAssetsUnchanged: true, humanApproved: false,
  scope: `Actual Three.js AnimationMixer and skinned/morphed vertex evaluation of all six-clip ${variant} assets at 60 Hz prospective transitions. After correction, every body vertex is independently scanned against the local flat floor. Materials omitted in memory for CPU inspection. Not browser rendering, horizontal foot locking, room collision or target-device performance.` };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
fs.copyFileSync(new URL(import.meta.url), path.join(base, prefix + '-inspector.mjs'));
fs.copyFileSync(path.join(root, helper), path.join(base, prefix + '-helper.ts'));
console.log(JSON.stringify({ complete: true, transitions: rows.length, passed: report.passed, maximumAppliedLiftMeters: Math.max(...rows.map(r => r.maximumAppliedLiftMeters)) }));
