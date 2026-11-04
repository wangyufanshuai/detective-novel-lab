import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = path.join(root, 'docs', '3d-rooms');
const candidateRoot = path.join(packageRoot, 'candidates', 'procedural-v1');
const manifestPath = path.join(candidateRoot, 'procedural-candidate.json');

async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

async function inputSha256() {
  const hash = createHash('sha256');
  for (const name of ['room-brief.json', 'room-layout.json', 'openings.json', 'props.json']) {
    hash.update(name, 'utf8');
    hash.update('\0', 'utf8');
    hash.update(await readFile(path.join(packageRoot, name)));
    hash.update('\0', 'utf8');
  }
  return hash.digest('hex');
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
assert.equal(manifest.schema, 'game-room.procedural-candidate.v1');
assert.equal(manifest.roomId, 'fog-lamp-evidence-room');
assert.equal(manifest.status, 'candidate-only');
assert.equal(manifest.humanApproval, false);
assert.equal(manifest.externalAssets, false);
assert.equal(manifest.meshGeneration, 'procedural-primitives');
assert.equal(manifest.generator.inputSha256, await inputSha256());

for (const [assetId, asset] of Object.entries(manifest.assets)) {
  assert.equal(asset.status, 'procedural-candidate', `${assetId} status`);
  const filePath = path.join(candidateRoot, asset.path);
  const info = await stat(filePath);
  assert.ok(info.size > 0, `${assetId} GLB is non-empty`);
  assert.equal(await sha256(filePath), asset.sha256, `${assetId} hash`);
  assert.ok(asset.stats.meshCount > 0, `${assetId} mesh count`);
  assert.ok(asset.stats.triangleCount > 0, `${assetId} triangle count`);
}

const roomPath = path.join(candidateRoot, manifest.room.path);
const roomInfo = await stat(roomPath);
assert.ok(roomInfo.size > 0, 'room GLB is non-empty');
assert.equal(await sha256(roomPath), manifest.room.sha256, 'room hash');
assert.deepEqual(manifest.room.openingsApplied, ['primary-archive-door', 'fog-courtyard-window']);
assert.deepEqual(manifest.room.stats.boundsMeters, [12, 8, 4.2]);
assert.ok(manifest.room.stats.meshCount >= 10);
assert.ok(manifest.room.stats.triangleCount >= 1000);
assert.equal(manifest.gateBoundary.function, 'pending-human-review');
assert.equal(manifest.gateBoundary.form, 'blocked-until-approved-glb-and-review-renders');
assert.equal(manifest.gateBoundary.runtime, 'blocked-until-browser-capture-and-performance-receipt');

console.log(JSON.stringify({
  ok: true,
  suite: 'procedural-room-candidate',
  schema: manifest.schema,
  inputSha256: manifest.generator.inputSha256,
  room: manifest.room.stats,
  assets: Object.keys(manifest.assets),
  gates: manifest.gateBoundary,
}));
