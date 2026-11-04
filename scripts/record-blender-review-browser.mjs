import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'docs/3d-rooms/candidates/blender-v3');
const rawPath = path.resolve(root, process.argv[2] || 'outputs/blender-v3-browser-capture.log');
const raw = await fs.readFile(rawPath, 'utf8');
const match = raw.match(/### Result\r?\n([\s\S]+?)\r?\n### Ran Playwright code/);
assert.ok(match, 'The Playwright CLI log must contain an actual returned report.');
const report = JSON.parse(match[1]);
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fileDigest = async file => digest(await fs.readFile(file));
const render = JSON.parse(await fs.readFile(path.join(dir, 'render-receipt.json'), 'utf8'));
const glbPath = path.join(dir, 'review-room-candidate.glb');
const glbHash = await fileDigest(glbPath);
assert.equal(glbHash, render.reviewGlbSha256);
for (const sample of [report.desktop, report.mobileViewport]) {
  assert.equal(sample.ready, true);
  assert.equal(sample.networkBytesVerified, true, 'Must hash the fetched GLB bytes in the browser.');
  assert.equal(sample.assetSha256, glbHash);
  assert.equal(sample.assetBytes, (await fs.stat(glbPath)).size);
  assert.ok(sample.sampleCount > 100 && sample.sampleSeconds >= 10);
  assert.ok(sample.p95FrameMs > 0 && Number.isFinite(sample.p95FrameMs));
  assert.equal(sample.overflow, 0);
  assert.deepEqual(sample.errors, []);
}
assert.deepEqual(report.desktop.viewport, [1440, 960]);
assert.deepEqual(report.mobileViewport.viewport, [390, 844]);
assert.equal(report.mobileViewport.reducedMotion, true);
assert.equal(report.controls.arrivalCamera, 'arrival');
assert.equal(report.controls.ceilingCamera, 'ceiling');
assert.equal(report.controls.resetCamera, 'production');
for (const name of ['desktopPickStatus', 'mobilePickStatus']) assert.ok(report.controls[name].includes('已选中证据桌'));
assert.equal(report.controls.comparisonVisible, true);
assert.equal(report.controls.comparisonReturned, true);
assert.equal(report.contextLostFallback.visible, true);
assert.equal(report.contextLostFallback.metrics.contextLost, true);
assert.deepEqual(report.warnings, []);
assert.deepEqual(report.errors, []);
assert.deepEqual(report.externalRequests, []);
assert.equal(report.humanApproval, false);
assert.equal(report.runtimeEligible, false);

const inputPaths = [
  'scripts/lib/blender-review-viewer.html', 'scripts/serve-blender-room-review.mjs',
  'scripts/capture-blender-review-browser.cjs', 'scripts/record-blender-review-browser.mjs',
  'docs/3d-rooms/candidates/blender-v3/composition.json',
  'docs/3d-rooms/candidates/blender-v3/asset-manifest.json',
  'docs/3d-rooms/candidates/blender-v3/lighting-manifest.json',
  'docs/3d-rooms/candidates/blender-v3/render-receipt.json',
  'node_modules/three/build/three.module.js', 'node_modules/three/build/three.core.js'
];
const inputs = [];
for (const file of inputPaths) inputs.push({path: file, sha256: await fileDigest(path.join(root, file))});
await fs.mkdir(path.join(dir, 'browser'), {recursive: true});
const screenshots = [];
for (const name of ['desktop', 'mobile', 'comparison', 'fallback']) {
  const source = path.join(root, `outputs/blender-v3-browser-${name}.png`);
  const bytes = await fs.readFile(source);
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
  const file = `browser/${name}.png`;
  await fs.copyFile(source, path.join(dir, file));
  screenshots.push({path: file, sha256: digest(bytes), size: [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]});
}
const three = JSON.parse(await fs.readFile(path.join(root, 'node_modules/three/package.json'), 'utf8'));
const receipt = {
  schema: 'game-room.blender-browser-review.v1',
  status: 'measured-local-candidate',
  reviewGlbSha256: glbHash,
  threeVersion: three.version,
  inputs, screenshots, report,
  localSmokePassed: true,
  gameIntegrationVerified: false,
  physicalPhoneTested: false,
  targetDeviceAcceptance: false,
  artAcceptance: false,
  humanApproval: false,
  runtimeEligible: false
};
await fs.writeFile(path.join(dir, 'browser-review-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ok: true, scope: receipt.status, screenshots: screenshots.length,
  desktopP95Ms: report.desktop.p95FrameMs, desktopDrawCalls: report.desktop.drawCalls,
  mobileViewportP95Ms: report.mobileViewport.p95FrameMs, targetDeviceAcceptance: false}));
