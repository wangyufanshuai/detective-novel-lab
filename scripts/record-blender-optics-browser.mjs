import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'docs/3d-rooms/candidates/blender-v7');
const rawPath = path.resolve(root, process.argv[2] || 'outputs/blender-v7-browser-capture.log');
const raw = await fs.readFile(rawPath, 'utf8');
const match = raw.match(/### Result\r?\n([\s\S]+?)\r?\n### Ran Playwright code/);
assert.ok(match, 'The Playwright CLI log must contain an actual returned report.');
const report = JSON.parse(match[1]);
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fileDigest = async file => digest(await fs.readFile(file));
const render = JSON.parse(await fs.readFile(path.join(dir, 'render-receipt.json'), 'utf8'));
const glbPath = path.join(dir, 'review-room-candidate.glb');
const glbHash = await fileDigest(glbPath);
const bake=JSON.parse(await fs.readFile(path.join(dir,'material-bake-receipt.json'),'utf8'));
const lightHash=await fileDigest(path.join(dir,bake.lightmap.path));
const probe=JSON.parse(await fs.readFile(path.join(dir,'reflection-probe-receipt.json'),'utf8'));
const probeHash=await fileDigest(path.join(dir,probe.path));
assert.equal(glbHash, render.reviewGlbSha256);
for (const sample of [report.desktop, report.mobileViewport,report.lensMacro]) {
  assert.equal(sample.ready, true);
  assert.equal(sample.networkBytesVerified, true, 'Must hash the fetched GLB bytes in the browser.');
  assert.equal(sample.assetSha256, glbHash);
  assert.equal(sample.assetBytes, (await fs.stat(glbPath)).size);
  assert.ok(sample.sampleCount > 100 && sample.sampleSeconds >= 10);
  assert.ok(sample.p95FrameMs > 0 && Number.isFinite(sample.p95FrameMs));
  assert.equal(sample.overflow, 0);
  assert.deepEqual(sample.errors, []);
  const material=sample.materials.find(entry=>entry.name==='Room Baked PBR');
  assert.ok(material, 'The browser must actually load the baked material.');
  for(const channel of ['albedo','normal','roughness','metallic']) assert.equal(material[channel],true,`Missing loaded ${channel} map`);
  assert.equal(sample.lightmap.sha256,lightHash);assert.equal(sample.lightmap.networkBytesVerified,true);
  assert.equal(sample.lightmap.shaderCompiled,true);assert.equal(sample.lightmap.receivers,12);
  assert.equal(sample.lightmap.duplicateDynamicDiffuseSuppressed,true);
  assert.equal(sample.lightingMode,'baked');
  assert.equal(sample.reflectionProbe.sha256,probeHash);assert.equal(sample.reflectionProbe.networkBytesVerified,true);
  assert.equal(sample.reflectionProbe.shaderCompiled,true);assert.equal(sample.reflectionProbe.prefilteredForRoughness,true);
  assert.equal(sample.reflectionProbe.directSpecularSuppressed,false);assert.equal(sample.reflectionProbe.parallaxCorrected,false);
  assert.equal(sample.reflectionProbe.areaSourceMode,'receiver-position disk LTC');
  assert.equal(sample.reflectionProbe.directSpecularReceivers,'metallic atlas texels and retained glass');
  assert.equal(sample.reflectionProbe.areaOcclusionVerified,false);
  assert.equal(sample.diskLightCalibration.passed,true);
  for(const measurement of [...sample.diskLightCalibration.mirrors,...sample.diskLightCalibration.diffuse])assert.ok(measurement.passed&&measurement.relativeError<.06);
  assert.equal(sample.reflectionProbe.duplicateEnvironmentDiffuseSuppressed,true);
  assert.equal(sample.reflectionProbe.calibratedAreaSources,5);
  assert.equal(sample.reflectionCalibration.passed,true);
  assert.equal(sample.reflectionCalibration.samples.length,6);
  for(const axis of sample.reflectionCalibration.samples)assert.ok(axis.passed&&axis.maximumError<.15);
  const glass=sample.materials.find(entry=>entry.name==='Optical Glass');
  assert.equal(glass.transmission,1);assert.ok(Math.abs(glass.thickness-.012)<1e-7);
  assert.ok(Math.abs(glass.ior-1.52)<1e-6);assert.ok(Math.abs(glass.roughnessFactor-.025)<1e-6);
}
assert.deepEqual(report.desktop.viewport, [1440, 960]);
assert.deepEqual(report.mobileViewport.viewport, [390, 844]);
assert.equal(report.mobileViewport.reducedMotion, true);
assert.equal(report.controls.arrivalCamera, 'arrival');
assert.equal(report.controls.heroCamera, 'hero-detail');
assert.equal(report.controls.ceilingCamera, 'ceiling');
assert.equal(report.controls.resetCamera, 'production');
assert.equal(report.lightingComparison.camera,'production');assert.equal(report.lightingComparison.bakedMode,'baked');
assert.equal(report.lightingComparison.dynamicMode,'dynamic');
assert.equal(report.lightingComparison.canvas.width,1600);assert.equal(report.lightingComparison.canvas.height,900);
assert.equal(report.lightingComparison.heroCamera,'hero-detail');
assert.equal(report.lightingComparison.heroCanvas.width,1600);assert.equal(report.lightingComparison.heroCanvas.height,900);
assert.equal(report.lightingComparison.lensCamera,'lens-macro');
assert.equal(report.lightingComparison.lensCanvas.width,1600);assert.equal(report.lightingComparison.lensCanvas.height,900);
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
  'scripts/lib/blender-optics-pass-viewer.html', 'scripts/serve-blender-room-optics-pass.mjs',
  'scripts/lib/blender-optics-disk-light.mjs','scripts/lib/blender-optics-disk-calibration.mjs','scripts/calibrate-blender-disk-falloff.py',
  'scripts/capture-blender-optics-browser.cjs', 'scripts/record-blender-optics-browser.mjs',
  'docs/3d-rooms/candidates/blender-v7/composition.json',
  'docs/3d-rooms/candidates/blender-v7/asset-manifest.json',
  'docs/3d-rooms/candidates/blender-v7/lighting-manifest.json',
  'docs/3d-rooms/candidates/blender-v7/render-receipt.json',
  'docs/3d-rooms/candidates/blender-v7/material-bake-receipt.json',
  'docs/3d-rooms/candidates/blender-v7/lightmap-calibration.json',
  'docs/3d-rooms/candidates/blender-v7/reflection-probe-receipt.json',
  'docs/3d-rooms/candidates/blender-v7/reflection-calibration.json',
  'docs/3d-rooms/candidates/blender-v7/optics-audit.json',
  'docs/3d-rooms/candidates/blender-v7/disk-falloff-calibration.json',
  'docs/3d-rooms/candidates/blender-v7/calibration/panorama-axes.exr',
  'node_modules/three/examples/jsm/loaders/EXRLoader.js', 'node_modules/three/examples/jsm/libs/fflate.module.js',
  'node_modules/three/build/three.module.js', 'node_modules/three/build/three.core.js',
  ...['EffectComposer','RenderPass','SMAAPass','OutputPass','Pass','ShaderPass','MaskPass'].map(name=>'node_modules/three/examples/jsm/postprocessing/'+name+'.js'),
  ...['CopyShader','SMAAShader','OutputShader'].map(name=>'node_modules/three/examples/jsm/shaders/'+name+'.js')
  , 'node_modules/three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js', 'node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm'
];
const inputs = [];
for (const file of inputPaths) inputs.push({path: file, sha256: await fileDigest(path.join(root, file))});
await fs.mkdir(path.join(dir, 'browser'), {recursive: true});
const screenshots = [];
for (const name of ['desktop', 'hero', 'mobile', 'comparison', 'fallback','matched-baked','matched-dynamic','matched-baked-hero','matched-dynamic-hero','matched-baked-lens','matched-dynamic-lens']) {
  const source = path.join(root, `outputs/blender-v7-browser-${name}.png`);
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
  lightmapSha256:lightHash,
  reflectionProbeSha256:probeHash,
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


