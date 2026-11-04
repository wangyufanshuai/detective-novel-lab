import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=process.cwd(),dir=path.join(root,'docs/3d-rooms/candidates/blender-v8');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const hash=async file=>digest(await fs.readFile(path.join(root,file)));
const old=JSON.parse(await fs.readFile(path.join(root,'outputs/blender-v7-grip-uv-diagnostic.json'),'utf8'));
assert.equal(old.sourceBlendSha256,await hash('docs/3d-rooms/candidates/blender-v7/runtime-baked.blend'));
assert.equal(old.verifierSha256,await hash('scripts/inspect-blender-grip-atlas.py'));
const current=JSON.parse(await fs.readFile(path.join(dir,'prop-bake-coverage.json'),'utf8'));
const raw=await fs.readFile(path.join(root,'outputs/blender-v8-material-components.log'),'utf8');
const match=raw.match(/### Result\r?\n([\s\S]+?)\r?\n### Ran Playwright code/);assert.ok(match);
const browser=JSON.parse(match[1]);
assert.equal(browser.assetSha256,await hash('docs/3d-rooms/candidates/blender-v8/review-room-candidate.glb'));
const baseline={...old};delete baseline.allRows;delete baseline.blackExamples;
baseline.totalAreaPixels=old.allRows.reduce((sum,row)=>sum+row.areaPixels,0);
const inputs=[];
for(const file of ['scripts/inspect-blender-grip-atlas.py','scripts/verify-blender-prop-atlas.py','scripts/capture-blender-material-components.cjs',
  'scripts/record-blender-microtexture-review.mjs','docs/3d-rooms/candidates/blender-v7/runtime-baked.blend',
  'docs/3d-rooms/candidates/blender-v7/browser/matched-baked-lens.png',
  'docs/3d-rooms/candidates/blender-v8/prop-bake-coverage.json','docs/3d-rooms/candidates/blender-v8/prop-atlas-topology.json',
  'docs/3d-rooms/candidates/blender-v8/runtime-baked.blend','docs/3d-rooms/candidates/blender-v8/review-room-candidate.glb',
  'docs/3d-rooms/candidates/blender-v8/browser-review-receipt.json'])inputs.push({path:file,sha256:await hash(file)});
await fs.mkdir(path.join(dir,'diagnostics'),{recursive:true});
const screenshots=[];
for(const capture of browser.captures){
  const target=`diagnostics/${capture.mode}.png`,bytes=await fs.readFile(path.join(root,capture.file));
  await fs.writeFile(path.join(dir,target),bytes);screenshots.push({mode:capture.mode,path:target,sha256:digest(bytes)});
}
const now=current.materials['Oxblood Leather'];
const report={schema:'game-room.microtexture-review.v1',baseline,current:now,
  gripAtlasAreaRatio:now.totalAreaPixels/baseline.totalAreaPixels,
  inputs,screenshots,browserAssetSha256:browser.assetSha256,
  observation:'The v8 actual-browser baked, albedo and lightmap macro captures no longer show the v7 grip black slashes; remaining tray-edge artifacts are out of this repaired prop scope.',
  humanApproval:false,artAcceptance:false,runtimeEligible:false};
await fs.writeFile(path.join(dir,'microtexture-review.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({blackSamplesBefore:old.sampleBlackCount,blackSamplesAfter:now.blackSamples,samples:now.samples,
  gripAreaBefore:baseline.totalAreaPixels,gripAreaAfter:now.totalAreaPixels,areaRatio:report.gripAtlasAreaRatio,screenshots:screenshots.length}));
