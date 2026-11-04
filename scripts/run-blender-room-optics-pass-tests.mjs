import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { validateWorldAssetManifest } from '../packages/engine/src/world-asset-manifest.ts';

const root=process.cwd(),dir=path.join(root,'docs/3d-rooms/candidates/blender-v7');
const read=async name=>JSON.parse(await fs.readFile(path.join(dir,name),'utf8'));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const hash=async file=>sha(await fs.readFile(file));
const receipt=await read('render-receipt.json'),audit=await read('geometry-audit.json');
const details=await read('art-detail-audit.json'),bake=await read('material-bake-receipt.json');
const manifest=await read('asset-manifest.json'),ledger=await read('license-ledger.json');
const capsule=await read('capsule-review.json'),dressing=await read('dressing-audit.json'),calibration=await read('lightmap-calibration.json');
const surface=await read('surface-audit.json'),probe=await read('reflection-probe-receipt.json');
const optics=await read('optics-audit.json'),reflectionCalibration=await read('reflection-calibration.json');
assert.equal(optics.passed,true);assert.equal(optics.humanApproval,false);assert.equal(optics.decorativeScaleIsWorldEvidence,false);
for(const mesh of optics.geometry)assert.ok(mesh.closed&&mesh.signedVolumeMeters3>0);
assert.ok(optics.checks.glassToCardGapMeters>0&&optics.checks.radialSeatClearanceMeters>0);
for(const key of ['housingSupportGapMeters','gripSupportGapMeters'])assert.ok(optics.checks[key]>0&&optics.checks[key]<.001);
assert.ok(optics.lens.centerThicknessMeters>optics.lens.edgeThicknessMeters);
assert.equal(reflectionCalibration.passed,true);assert.equal(reflectionCalibration.cameraOnlyProxy.passed,true);
assert.equal(reflectionCalibration.sourceSha256,await hash(path.join(root,'scripts/calibrate-blender-optics.py')));
assert.equal(probe.calibrationSha256,await hash(path.join(dir,'reflection-calibration.json')));
for(const artifact of reflectionCalibration.artifacts)assert.equal(artifact.sha256,await hash(path.join(root,artifact.path)));
assert.equal(reflectionCalibration.axes.length,6);
for(const axis of reflectionCalibration.axes)assert.equal(axis.passed,true);
assert.equal(probe.cameraOnlyAreaProxies.length,5);
assert.equal(probe.sourceProxyComparison.runtimeAsset,false);
assert.equal(probe.sourceProxyComparison.sha256,await hash(path.join(dir,probe.sourceProxyComparison.path)));
const falloff=await read('disk-falloff-calibration.json');
assert.equal(falloff.passed,true);assert.equal(falloff.sourceSha256,await hash(path.join(root,'scripts/calibrate-blender-disk-falloff.py')));
for(const record of falloff.records)assert.equal(record.sha256,await hash(path.join(root,record.path)));
for(const proxy of probe.cameraOnlyAreaProxies){assert.equal(proxy.cameraOnly,true);assert.equal(proxy.emissionSampling,'NONE');assert.ok(proxy.radiance>0);}
assert.equal(surface.passed,true);assert.deepEqual(surface.negativeVolumeObjects,[]);assert.deepEqual(surface.nonClosedObjects,[]);
assert.deepEqual(surface.correctedSurfaces.map(item=>item.object).sort(),['archive-lamp-left_shade','archive-lamp-right_shade','envelope_flap']);
for(const item of surface.correctedSurfaces)assert.ok(item.closed&&item.beforeSignedVolumeMeters3<0&&item.afterSignedVolumeMeters3>0);
assert.equal(surface.envelopeBottomTopNormals[0][2],-1);assert.equal(surface.envelopeBottomTopNormals[1][2],1);
assert.equal(surface.pencils.length,2);
for(const pencil of surface.pencils)assert.ok(pencil.insidePadXY&&pencil.supportGapMeters>=0&&pencil.supportGapMeters<.001);
assert.equal(capsule.passed,true);assert.equal(capsule.capsule.heightMeters,1.78);
assert.equal(capsule.routes.length,3);assert.equal(capsule.negativeControls.length,3);
for(const route of capsule.routes)assert.ok(route.clear&&route.conservativeEnvelopeMarginMeters>0);
for(const blocked of capsule.negativeControls)assert.ok(!blocked.clear&&blocked.conservativeEnvelopeMarginMeters<0);
assert.equal(dressing.passed,true);
for(const contact of dressing.wallAttachments)assert.ok(contact.passed&&Math.abs(contact.supportGapMeters)<=.005);
assert.equal(calibration.passed,true);assert.equal(calibration.sourceSha256,await hash(path.join(root,'scripts/calibrate-blender-optics-bake.py')));
assert.equal(bake.lightmap.calibrationSha256,await hash(path.join(dir,'lightmap-calibration.json')));
assert.ok(Math.abs(bake.lightmap.threeLightMapIntensity-Math.PI)<1e-12);
assert.equal(validateWorldAssetManifest(manifest,'fog-lamp-evidence-room').ok,true);
for(const input of receipt.inputs)assert.equal(await hash(path.join(root,input.path)),input.sha256,`stale authoring input ${input.path}`);
for(const [name,key] of [
  ['fog-lamp-evidence-room.blend','blendSha256'],['review-room-candidate.glb','reviewGlbSha256'],
  ['geometry-audit.json','geometryAuditSha256'],['art-detail-audit.json','detailAuditSha256'],
  ['lighting-manifest.json','lightingManifestSha256'],['material-bake-receipt.json','materialBakeReceiptSha256'],
  ['dressing-audit.json','dressingAuditSha256'],['capsule-review.json','capsuleAuditSha256'],
  ['surface-audit.json','surfaceAuditSha256'],['reflection-probe-receipt.json','reflectionProbeReceiptSha256'],
  ['optics-audit.json','opticsAuditSha256'],['reflection-calibration.json','reflectionCalibrationSha256']
])assert.equal(await hash(path.join(dir,name)),receipt[key],`stale ${name}`);
assert.equal(await hash(path.join(dir,'runtime-baked.blend')),bake.runtimeBlendSha256);
assert.equal(receipt.background,true);
const expected=['production','arrival-wide','low-hero','corner-sw','corner-se','corner-nw','corner-ne','ceiling-up','ceiling-oblique-a','ceiling-oblique-b','hero-detail','lens-macro','clay-production'];
assert.deepEqual(receipt.renders.map(r=>r.view).sort(),expected.sort());
for(const render of receipt.renders){
  const bytes=await fs.readFile(path.join(dir,render.path));
  assert.equal(sha(bytes),render.sha256);
  assert.equal(bytes.subarray(1,4).toString(),'PNG');
  assert.equal(bytes.readUInt32BE(16),render.size[0]);
  assert.equal(bytes.readUInt32BE(20),render.size[1]);
  if(render.view.startsWith('corner-'))assert.ok(Math.abs(render.horizontalFovDegrees-120)<.01);
}
assert.equal(audit.spatialReview.passed,true);
assert.equal(audit.heroFullyFramedWithMargin,true);
assert.deepEqual(audit.nonManifoldObjects,[]);
assert.equal(details.internalShelfClearancePassed,true);
assert.ok(details.archiveShelfClearance.length>=40);
for(const volume of details.archiveShelfClearance){
  assert.ok(volume.bottom>=volume.shelfTop-.001);
  assert.ok(volume.top<=volume.nextShelfUnderside-.009);
}
assert.equal(details.desk.decorativeTextIsWorldEvidence,false);
assert.ok(details.desk.features.includes('retained glass lens'));
const glb=await fs.readFile(path.join(dir,'review-room-candidate.glb'));
assert.equal(glb.readUInt32LE(0),0x46546c67);
assert.equal(glb.readUInt32LE(8),glb.length);
const jsonLength=glb.readUInt32LE(12);
const doc=JSON.parse(glb.subarray(20,20+jsonLength).toString());
const binary=glb.subarray(20+jsonLength+8);
const pbrIndex=doc.materials.findIndex(m=>m.name==='Room Baked PBR');
assert.ok(pbrIndex>=0);
assert.ok(doc.extensionsRequired.includes('KHR_draco_mesh_compression'));
assert.equal(bake.compression.quantizationBits.position,20);
assert.equal(bake.compression.simplification,false);
const pbr=doc.materials[pbrIndex];
for(const texture of [pbr.pbrMetallicRoughness.baseColorTexture,pbr.pbrMetallicRoughness.metallicRoughnessTexture,pbr.normalTexture])assert.ok(Number.isInteger(texture?.index));
assert.ok(doc.materials.some(m=>m.extensions?.KHR_materials_transmission?.transmissionFactor>.5),'glass must retain physical transmission');
const glass=doc.materials.find(m=>m.name==='Optical Glass');
assert.equal(glass.extensions.KHR_materials_transmission.transmissionFactor,1);
assert.ok(Math.abs(glass.extensions.KHR_materials_volume.thicknessFactor-.012)<1e-7);
assert.ok(Math.abs(glass.extensions.KHR_materials_ior.ior-1.52)<1e-6);
assert.ok(Math.abs(glass.pbrMetallicRoughness.roughnessFactor-.025)<1e-6);
let triangles=0;
for(const mesh of doc.meshes)for(const primitive of mesh.primitives){
  triangles+=doc.accessors[primitive.indices].count/3;
  if(primitive.material===pbrIndex){
    assert.ok(Number.isInteger(primitive.attributes.TEXCOORD_0));
    assert.ok(Number.isInteger(primitive.attributes.TEXCOORD_1),'Actual exported lighting UV channel');
    assert.ok(Number.isInteger(primitive.attributes.TANGENT));
  }
}
assert.equal(triangles,audit.trianglesEvaluated,'semantic consolidation must retain the audited geometry');
assert.ok(triangles<=120000,'declared room triangle budget');
assert.ok(glb.length<=8000000,'GLB-only candidate budget; companion lighting is counted separately');
assert.equal(doc.meshes.length,bake.runtimeMeshObjects);
assert.ok(doc.meshes.length<35,'semantic consolidation should reduce hundreds of separate objects');
for(const group of bake.semanticGroups)assert.ok(doc.nodes.some(n=>n.extras?.review_group===group),`missing semantic group ${group}`);
assert.equal(doc.images.length,3);
for(const image of doc.images){
  assert.equal(image.uri,undefined);
  assert.equal(image.mimeType,'image/png');
  const view=doc.bufferViews[image.bufferView];
  const bytes=binary.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);
  assert.equal(bytes.subarray(1,4).toString(),'PNG');
  assert.equal(bytes.readUInt32BE(16),bake.atlasSize[0]);
  assert.equal(bytes.readUInt32BE(20),bake.atlasSize[1]);
}
for(const texture of bake.textures){
  const bytes=await fs.readFile(path.join(dir,texture.path));
  assert.equal(sha(bytes),texture.sha256);
  assert.equal(bytes.length,texture.bytes);
}
assert.equal(bake.reviewGlbSha256,sha(glb));
assert.equal(bake.lightingBaked,true);
assert.equal(bake.ambientOcclusionBaked,false);
const exr=await fs.readFile(path.join(dir,bake.lightmap.path));
assert.equal(exr.readUInt32LE(0),20000630,'Actual OpenEXR magic, not an extension claim');
assert.equal(sha(exr),bake.lightmap.sha256);assert.equal(exr.length,bake.lightmap.bytes);
assert.equal(bake.lightmap.encoding,'OpenEXR RGB half-float ZIP');
const decodedLight=new EXRLoader().parse(exr.buffer.slice(exr.byteOffset,exr.byteOffset+exr.byteLength));
assert.deepEqual([decodedLight.width,decodedLight.height],bake.atlasSize);
assert.deepEqual(decodedLight.header.channels.map(channel=>channel.name).sort(),['B','G','R']);
for(const channel of decodedLight.header.channels)assert.equal(channel.pixelType,1,'Actual half-float EXR channel');
assert.equal(decodedLight.header.compression,'ZIP_COMPRESSION');
assert.ok(decodedLight.data.every(value=>(value&0x7c00)!==0x7c00),'Decoded half-float samples are finite');
assert.ok(decodedLight.data.some(value=>value>0x3c00&&value<0x7c00),'Light energy above 1 survives HDR export');
assert.equal(await hash(path.join(dir,bake.lightmap.denoising.rawPath)),bake.lightmap.denoising.rawSha256);
assert.equal(bake.lightmap.sourceLightingManifestSha256,receipt.lightingManifestSha256);
assert.equal(bake.lightmap.surfaceColorIncluded,false);
assert.equal(bake.lightmap.statistics.finite,true);assert.ok(bake.lightmap.statistics.nonzeroPixels>200000);
const probeBytes=await fs.readFile(path.join(dir,probe.path));
assert.equal(sha(probeBytes),probe.sha256);assert.equal(probeBytes.length,probe.bytes);
assert.equal(probe.sourceBlendSha256,receipt.blendSha256);assert.equal(probe.externalSource,false);assert.equal(probe.humanApproval,false);
const probeDecoded=new EXRLoader().parse(probeBytes.buffer.slice(probeBytes.byteOffset,probeBytes.byteOffset+probeBytes.byteLength));
assert.deepEqual([probeDecoded.width,probeDecoded.height],[1024,512]);
for(const channel of probeDecoded.header.channels)assert.equal(channel.pixelType,1);
assert.equal(probeDecoded.header.compression,'ZIP_COMPRESSION');
assert.ok(probeDecoded.data.every(value=>(value&0x7c00)!==0x7c00));
assert.ok(probeDecoded.data.some(value=>value>0x3c00&&value<0x7c00));
const roundtrip=await read('export-roundtrip-audit.json');
assert.equal(roundtrip.reviewGlbSha256,sha(glb));
assert.equal(roundtrip.sourceBlendSha256,receipt.blendSha256);
assert.equal(roundtrip.verifierSha256,await hash(path.join(root,'scripts/verify-blender-optics-roundtrip.py')));
assert.equal(roundtrip.passed,true);
assert.equal(roundtrip.sourceTriangles,triangles);assert.equal(roundtrip.decodedTriangles,triangles);
assert.equal(roundtrip.envelopeTopNormals.source.passed,true);assert.equal(roundtrip.envelopeTopNormals.decoded.passed,true);
assert.equal(roundtrip.lensGeometry.source.passed,true);assert.equal(roundtrip.lensGeometry.decoded.passed,true);
for(const lens of Object.values(roundtrip.lensGeometry))assert.ok(lens.centerThicknessMeters>lens.edgeThicknessMeters*4);
for(const group of roundtrip.groups)assert.ok(Math.max(group.maxSourceToDecodedMeters,group.maxDecodedToSourceMeters)<=.00005);
assert.deepEqual(ledger.assets,manifest.assets);
assert.equal(ledger.externalDownloads,false);
for(const entry of manifest.assets){
  const bytes=await fs.readFile(path.join(dir,entry.path));
  assert.equal(entry.sha256,sha(bytes));assert.equal(entry.bytes,bytes.length);
  assert.equal(entry.status,'candidate-only');assert.equal(entry.humanApproval,false);assert.equal(entry.runtimeVerified,false);
}
let browserScreenshots=0;
let relativeMAEReduction=null;
const exists=await fs.stat(path.join(dir,'browser-review-receipt.json')).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;});
if(exists){
  const browser=await read('browser-review-receipt.json');
  assert.equal(browser.reviewGlbSha256,sha(glb));
  for(const input of browser.inputs)assert.equal(await hash(path.join(root,input.path)),input.sha256,`stale browser input ${input.path}`);
  for(const sample of [browser.report.desktop,browser.report.mobileViewport,browser.report.lensMacro]){
    assert.equal(sample.networkBytesVerified,true);assert.equal(sample.assetSha256,sha(glb));
    assert.equal(sample.overflow,0);assert.ok(sample.sampleSeconds>=10);assert.deepEqual(sample.errors,[]);
    const material=sample.materials.find(m=>m.name==='Room Baked PBR');
    for(const key of ['albedo','normal','roughness','metallic'])assert.equal(material[key],true,`browser ${key} map`);
    assert.equal(sample.lightmap.sha256,sha(exr));assert.equal(sample.lightmap.networkBytesVerified,true);
    assert.equal(sample.lightmap.shaderCompiled,true);assert.equal(sample.lightmap.receivers,12);
    assert.equal(sample.lightmap.duplicateDynamicDiffuseSuppressed,true);
    assert.equal(sample.lightingMode,'baked');
    assert.equal(sample.reflectionProbe.sha256,probe.sha256);assert.equal(sample.reflectionProbe.networkBytesVerified,true);
    assert.equal(sample.reflectionProbe.shaderCompiled,true);assert.equal(sample.reflectionProbe.prefilteredForRoughness,true);
    assert.equal(sample.reflectionProbe.duplicateEnvironmentDiffuseSuppressed,true);assert.equal(sample.reflectionProbe.directSpecularSuppressed,false);
    assert.equal(sample.reflectionProbe.areaSourceMode,'receiver-position disk LTC');
    assert.equal(sample.reflectionProbe.directSpecularReceivers,'metallic atlas texels and retained glass');
    assert.equal(sample.reflectionProbe.areaOcclusionVerified,false);
    assert.equal(sample.diskLightCalibration.passed,true);
    assert.equal(sample.diskLightCalibration.mirrors.length,4);assert.equal(sample.diskLightCalibration.diffuse.length,3);
    for(const measurement of [...sample.diskLightCalibration.mirrors,...sample.diskLightCalibration.diffuse])assert.ok(measurement.passed&&measurement.relativeError<.06);
    assert.equal(sample.reflectionProbe.parallaxCorrected,false);
    assert.equal(sample.reflectionProbe.calibratedAreaSources,5);
    assert.equal(sample.reflectionCalibration.passed,true);assert.equal(sample.reflectionCalibration.samples.length,6);
    for(const axis of sample.reflectionCalibration.samples)assert.ok(axis.passed&&axis.maximumError<.15);
    const glass=sample.materials.find(m=>m.name==='Optical Glass');
    assert.equal(glass.transmission,1);assert.ok(Math.abs(glass.thickness-.012)<1e-7&&Math.abs(glass.ior-1.52)<1e-6);
    assert.equal(sample.renderSettings.postprocessing,'4x MSAA + SMAA');
    assert.ok(sample.renderSettings.maxSamples>=sample.renderSettings.requestedSamples);
  }
  assert.equal(browser.report.controls.heroCamera,'hero-detail');
  assert.deepEqual(browser.screenshots.map(shot=>shot.path).sort(),['browser/desktop.png','browser/hero.png','browser/mobile.png','browser/comparison.png','browser/fallback.png','browser/matched-baked.png','browser/matched-dynamic.png','browser/matched-baked-hero.png','browser/matched-dynamic-hero.png','browser/matched-baked-lens.png','browser/matched-dynamic-lens.png'].sort());
  assert.deepEqual(browser.report.errors,[]);assert.deepEqual(browser.report.warnings,[]);
  assert.deepEqual(browser.report.externalRequests,[]);assert.equal(browser.report.contextLostFallback.visible,true);
  for(const shot of browser.screenshots)assert.equal(await hash(path.join(dir,shot.path)),shot.sha256);
  assert.equal(browser.targetDeviceAcceptance,false);assert.equal(browser.runtimeEligible,false);assert.equal(browser.humanApproval,false);
  assert.equal(browser.physicalPhoneTested,false);assert.equal(browser.gameIntegrationVerified,false);assert.equal(browser.artAcceptance,false);
  const comparison=await read('lighting-image-comparison.json');
  assert.equal(comparison.sourceSha256,await hash(path.join(root,'scripts/compare-blender-optics-frames.py')));
  assert.equal(comparison.camera,'production');assert.deepEqual(comparison.size,[1600,900]);
  assert.equal(comparison.humanApproval,false);
  assert.deepEqual(comparison.inputs.map(input=>input.role).sort(),['baked','dynamic','reference']);
  for(const input of comparison.inputs){
    const bytes=await fs.readFile(path.join(dir,input.path));
    assert.equal(sha(bytes),input.sha256,`stale comparison input ${input.path}`);
    assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],comparison.size);
  }
  for(const mode of ['baked','dynamic'])for(const metric of ['meanAbsoluteRGBError','rootMeanSquareRGBError'])
    assert.ok(Number.isFinite(comparison.metrics[mode][metric])&&comparison.metrics[mode][metric]>0);
  relativeMAEReduction=1-comparison.metrics.baked.meanAbsoluteRGBError/comparison.metrics.dynamic.meanAbsoluteRGBError;
  assert.ok(Math.abs(relativeMAEReduction-comparison.metrics.relativeMAEReduction)<1e-12);
  assert.ok(relativeMAEReduction>0,'Measured same-camera RGB difference improves; not an art acceptance gate');
  assert.equal(comparison.hero.camera,'hero-detail');assert.deepEqual(comparison.hero.size,[1600,900]);
  for(const input of comparison.hero.inputs)assert.equal(await hash(path.join(dir,input.path)),input.sha256);
  const heroReduction=1-comparison.hero.metrics.baked.meanAbsoluteRGBError/comparison.hero.metrics.dynamic.meanAbsoluteRGBError;
  assert.ok(Math.abs(heroReduction-comparison.hero.metrics.relativeMAEReduction)<1e-12&&heroReduction>0);
  assert.equal(comparison.lens.camera,'lens-macro');assert.deepEqual(comparison.lens.size,[1600,900]);
  for(const input of comparison.lens.inputs)assert.equal(await hash(path.join(dir,input.path)),input.sha256);
  // Macro image error is reported even if the approximation is worse; the
  // whole-image statistic is not a substitute for close-up glass inspection.
  for(const mode of ['baked','dynamic'])assert.ok(Number.isFinite(comparison.lens.metrics[mode].meanAbsoluteRGBError));
  browserScreenshots=browser.screenshots.length;
}
console.log(JSON.stringify({ok:true,suite:'blender-room-optics-pass',views:receipt.renders.length,triangles,glbBytes:glb.length,
  lightmapBytes:exr.length,reflectionBytes:probeBytes.length,totalAssetBytes:glb.length+exr.length+probeBytes.length,surfaceChecksPassed:surface.passed,capsuleEnvelopePassed:capsule.passed,relativeMAEReduction,
  authoringMeshes:audit.meshObjects,runtimeMeshes:doc.meshes.length,archiveVolumes:details.archiveShelfClearance.length,
  bakedPbrChannels:bake.bakedChannels,browserScreenshots,humanApproval:false,lightingBaked:true}));

