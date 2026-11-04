import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { validateWorldAssetManifest } from '../packages/engine/src/world-asset-manifest.ts';

const root=process.cwd(),dir=path.join(root,'docs/3d-rooms/candidates/blender-v4');
const read=async name=>JSON.parse(await fs.readFile(path.join(dir,name),'utf8'));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const hash=async file=>sha(await fs.readFile(file));
const receipt=await read('render-receipt.json'),audit=await read('geometry-audit.json');
const details=await read('art-detail-audit.json'),bake=await read('material-bake-receipt.json');
const manifest=await read('asset-manifest.json'),ledger=await read('license-ledger.json');
assert.equal(validateWorldAssetManifest(manifest,'fog-lamp-evidence-room').ok,true);
for(const input of receipt.inputs)assert.equal(await hash(path.join(root,input.path)),input.sha256,`stale authoring input ${input.path}`);
for(const [name,key] of [
  ['fog-lamp-evidence-room.blend','blendSha256'],['review-room-candidate.glb','reviewGlbSha256'],
  ['geometry-audit.json','geometryAuditSha256'],['art-detail-audit.json','detailAuditSha256'],
  ['lighting-manifest.json','lightingManifestSha256'],['material-bake-receipt.json','materialBakeReceiptSha256']
])assert.equal(await hash(path.join(dir,name)),receipt[key],`stale ${name}`);
assert.equal(await hash(path.join(dir,'runtime-baked.blend')),bake.runtimeBlendSha256);
assert.equal(receipt.background,true);
const expected=['production','arrival-wide','low-hero','corner-sw','corner-se','corner-nw','corner-ne','ceiling-up','ceiling-oblique-a','ceiling-oblique-b','hero-detail','clay-production'];
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
let triangles=0;
for(const mesh of doc.meshes)for(const primitive of mesh.primitives){
  triangles+=doc.accessors[primitive.indices].count/3;
  if(primitive.material===pbrIndex){
    assert.ok(Number.isInteger(primitive.attributes.TEXCOORD_0));
    assert.ok(Number.isInteger(primitive.attributes.TANGENT));
  }
}
assert.equal(triangles,audit.trianglesEvaluated,'semantic consolidation must retain the audited geometry');
assert.ok(triangles<=120000,'declared room triangle budget');
assert.ok(glb.length<=8000000,'declared low-tier byte budget');
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
assert.equal(bake.lightingBaked,false);
assert.equal(bake.ambientOcclusionBaked,false);
const roundtrip=await read('export-roundtrip-audit.json');
assert.equal(roundtrip.reviewGlbSha256,sha(glb));
assert.equal(roundtrip.sourceBlendSha256,receipt.blendSha256);
assert.equal(roundtrip.verifierSha256,await hash(path.join(root,'scripts/verify-blender-art-roundtrip.py')));
assert.equal(roundtrip.passed,true);
assert.equal(roundtrip.sourceTriangles,triangles);assert.equal(roundtrip.decodedTriangles,triangles);
for(const group of roundtrip.groups)assert.ok(Math.max(group.maxSourceToDecodedMeters,group.maxDecodedToSourceMeters)<=.00005);
assert.deepEqual(ledger.assets,manifest.assets);
assert.equal(ledger.externalDownloads,false);
for(const entry of manifest.assets){
  assert.equal(entry.sha256,sha(glb));assert.equal(entry.bytes,glb.length);
  assert.equal(entry.status,'candidate-only');assert.equal(entry.humanApproval,false);assert.equal(entry.runtimeVerified,false);
}
let browserScreenshots=0;
const exists=await fs.stat(path.join(dir,'browser-review-receipt.json')).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;});
if(exists){
  const browser=await read('browser-review-receipt.json');
  assert.equal(browser.reviewGlbSha256,sha(glb));
  for(const input of browser.inputs)assert.equal(await hash(path.join(root,input.path)),input.sha256,`stale browser input ${input.path}`);
  for(const sample of [browser.report.desktop,browser.report.mobileViewport]){
    assert.equal(sample.networkBytesVerified,true);assert.equal(sample.assetSha256,sha(glb));
    assert.equal(sample.overflow,0);assert.ok(sample.sampleSeconds>=10);assert.deepEqual(sample.errors,[]);
    const material=sample.materials.find(m=>m.name==='Room Baked PBR');
    for(const key of ['albedo','normal','roughness','metallic'])assert.equal(material[key],true,`browser ${key} map`);
    assert.equal(sample.renderSettings.postprocessing,'4x MSAA + SMAA');
    assert.ok(sample.renderSettings.maxSamples>=sample.renderSettings.requestedSamples);
  }
  assert.equal(browser.report.controls.heroCamera,'hero-detail');
  assert.deepEqual(browser.screenshots.map(shot=>shot.path).sort(),['browser/desktop.png','browser/hero.png','browser/mobile.png','browser/comparison.png','browser/fallback.png'].sort());
  assert.deepEqual(browser.report.errors,[]);assert.deepEqual(browser.report.warnings,[]);
  assert.deepEqual(browser.report.externalRequests,[]);assert.equal(browser.report.contextLostFallback.visible,true);
  for(const shot of browser.screenshots)assert.equal(await hash(path.join(dir,shot.path)),shot.sha256);
  assert.equal(browser.targetDeviceAcceptance,false);assert.equal(browser.runtimeEligible,false);assert.equal(browser.humanApproval,false);
  browserScreenshots=browser.screenshots.length;
}
console.log(JSON.stringify({ok:true,suite:'blender-room-art-pass',views:receipt.renders.length,triangles,glbBytes:glb.length,
  authoringMeshes:audit.meshObjects,runtimeMeshes:doc.meshes.length,archiveVolumes:details.archiveShelfClearance.length,
  bakedPbrChannels:bake.bakedChannels,browserScreenshots,humanApproval:false,lightingBaked:false}));
