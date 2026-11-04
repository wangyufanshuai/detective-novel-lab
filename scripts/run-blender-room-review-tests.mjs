import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { validateWorldAssetManifest } from '../packages/engine/src/world-asset-manifest.ts';

const root = process.cwd();
const dir = path.join(root, 'docs/3d-rooms/candidates/blender-v3');
const read = async name => JSON.parse(await fs.readFile(path.join(dir, name), 'utf8'));
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fileDigest = async file => digest(await fs.readFile(file));
const receipt = await read('render-receipt.json');
const manifest = await read('asset-manifest.json');
const ledger = await read('license-ledger.json');
const audit = await read('geometry-audit.json');
const result = validateWorldAssetManifest(manifest, 'fog-lamp-evidence-room');
assert.equal(result.ok, true, result.errors.join('; '));
assert.equal(receipt.background, true);
for (const [name, key] of [
  ['fog-lamp-evidence-room.blend', 'blendSha256'], ['review-room-candidate.glb', 'reviewGlbSha256'],
  ['composition.json', 'compositionSha256'], ['geometry-audit.json', 'geometryAuditSha256'],
  ['lighting-manifest.json', 'lightingManifestSha256']
]) assert.equal(await fileDigest(path.join(dir, name)), receipt[key], `stale ${name}`);
assert.equal(await fileDigest(path.join(root, 'scripts/build-blender-room-review.py')), receipt.scriptSha256, 'stale authoring script');
assert.equal(await fileDigest(path.join(root, 'scripts/lib/blender_room_spatial_review.py')), receipt.spatialAuditScriptSha256, 'stale spatial audit');
assert.equal(await fileDigest(path.join(dir, '../authored-v2/authored-candidate.json')), receipt.sourceCandidateSha256, 'stale source');

const expected = ['production','arrival-wide','low-hero','corner-sw','corner-se','corner-nw','corner-ne','ceiling-up','ceiling-oblique-a','ceiling-oblique-b','clay-production'];
assert.deepEqual(receipt.renders.map(r => r.view).sort(), [...expected].sort(), 'complete current render batch required');
for (const image of receipt.renders) {
  const bytes = await fs.readFile(path.join(dir, image.path));
  assert.equal(digest(bytes), image.sha256, `stale render ${image.view}`);
  assert.equal(bytes.subarray(1,4).toString(), 'PNG');
  assert.equal(bytes.readUInt32BE(16), image.size[0]);
  assert.equal(bytes.readUInt32BE(20), image.size[1]);
  if (image.view.startsWith('corner-')) assert.ok(Math.abs(image.horizontalFovDegrees - 120) < .01);
}
const glb = await fs.readFile(path.join(dir, 'review-room-candidate.glb'));
assert.equal(glb.readUInt32LE(0), 0x46546c67);
assert.equal(glb.readUInt32LE(4), 2);
assert.equal(glb.readUInt32LE(8), glb.length);
const doc = JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
assert.match(doc.asset.generator, /Blender/);
let triangles = 0;
for (const mesh of doc.meshes) for (const primitive of mesh.primitives) {
  assert.ok(!('COLOR_0' in primitive.attributes), 'legacy colors must not multiply the authored PBR colors');
  triangles += doc.accessors[primitive.indices].count / 3;
}
assert.equal(triangles, audit.trianglesEvaluated, 'export must include the audited evaluated geometry');
assert.ok(triangles <= 120000, 'room polygon budget');
assert.ok(glb.length <= 8000000, 'review GLB budget');
for (const name of ['Walnut','Walnut Edge','Archive Felt','Plaster','Stone','Ceiling']) {
  const material = doc.materials.find(m => m.name === name);
  assert.ok(material?.pbrMetallicRoughness?.baseColorFactor, `${name} lost its authored base color on export`);
  assert.ok(material.pbrMetallicRoughness.baseColorFactor.slice(0,3).some(v => v < .6), `${name} is incorrectly white`);
}
assert.ok(!(doc.images || []).some(image => image.uri), 'no untracked external textures');
for (const entry of manifest.assets) {
  assert.equal(entry.bytes, glb.length);
  assert.equal(entry.sha256, digest(glb));
  assert.equal(entry.status, 'candidate-only');
  assert.equal(entry.humanApproval, false);
  assert.equal(entry.runtimeVerified, false);
}
assert.deepEqual(ledger.assets, manifest.assets);
assert.equal(ledger.externalDownloads, false);
assert.equal(ledger.runtimeEligible, false);
assert.deepEqual(audit.nonManifoldObjects, []);
assert.equal(audit.spatialReview.passed, true, JSON.stringify(audit.spatialReview));
assert.equal(audit.heroFullyFramedWithMargin, true);
assert.equal(receipt.humanApproval, false);
assert.equal(receipt.runtimeVerified, false);
let browserScreenshots = 0;
const browserPath = path.join(dir, 'browser-review-receipt.json');
const browserExists = await fs.stat(browserPath).then(() => true, error => {
  if (error.code === 'ENOENT') return false;
  throw error;
});
if (browserExists) {
  const browser = JSON.parse(await fs.readFile(browserPath, 'utf8'));
  assert.equal(browser.reviewGlbSha256, digest(glb), 'stale browser GLB');
  assert.equal(browser.localSmokePassed, true);
  for (const key of ['humanApproval', 'runtimeEligible', 'artAcceptance', 'targetDeviceAcceptance', 'physicalPhoneTested', 'gameIntegrationVerified']) assert.equal(browser[key], false);
  for (const input of browser.inputs) {
    assert.equal(await fileDigest(path.join(root, input.path)), input.sha256, `stale browser input ${input.path}`);
  }
  for (const sample of [browser.report.desktop, browser.report.mobileViewport]) {
    assert.equal(sample.assetSha256, digest(glb));
    assert.equal(sample.networkBytesVerified, true);
    assert.equal(sample.overflow, 0);
    assert.ok(sample.sampleSeconds >= 10);
    assert.deepEqual(sample.errors, []);
  }
  assert.deepEqual(browser.report.warnings, []);
  assert.deepEqual(browser.report.errors, []);
  assert.deepEqual(browser.report.externalRequests, []);
  assert.equal(browser.report.contextLostFallback.visible, true);
  assert.deepEqual(browser.screenshots.map(s => s.path).sort(), ['browser/comparison.png', 'browser/desktop.png', 'browser/fallback.png', 'browser/mobile.png']);
  for (const capture of browser.screenshots) {
    const bytes = await fs.readFile(path.join(dir, capture.path));
    assert.equal(digest(bytes), capture.sha256, `stale browser capture ${capture.path}`);
    assert.equal(bytes.readUInt32BE(16), capture.size[0]);
    assert.equal(bytes.readUInt32BE(20), capture.size[1]);
  }
  browserScreenshots = browser.screenshots.length;
}
console.log(JSON.stringify({ok:true,suite:'blender-room-review',views:expected.length,triangles,glbBytes:glb.length,
  minimumRouteClearWidth:Math.min(...audit.spatialReview.routes.map(r=>r.conservativeClearWidthMeters)),
  independentBVHIntersections:audit.spatialReview.independentPropBVHIntersections.length,
  browserScreenshots,status:'candidate-only',textureBake:'not-yet',humanApproval:false}));
