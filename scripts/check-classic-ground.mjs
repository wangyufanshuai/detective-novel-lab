import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createNoirTestLoader} from './noir-player-test-loader.mjs';
const {load}=createNoirTestLoader(process.cwd());
const {createGroundSampler}=load('app/town-play/art-sample/sample-ground.ts');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const groundPath='public/assets/classic-motion/v1/ground.json',data=read(groundPath),navPath='public/assets/classic-bookshop/v2/navigation.json',nav=read(navPath);
const identity={sourceSha256:nav.sourceSha256,assetSha256:nav.assetSha256,navigationSha256:sha(navPath)};
const sampler=createGroundSampler(data,identity),cast=read('public/assets/classic-occupations/v2/cast.json').entries;
assert.throws(()=>createGroundSampler({...data,assetSha256:'wrong'},identity));
assert.throws(()=>createGroundSampler({...data,heights:[NaN]},identity));
assert.equal(sampler.at([NaN,0]),null);assert.equal(sampler.at([-100,0]),null);
const hole={...data,width:2,height:2,heights:[180,null,180,180]};
assert.equal(createGroundSampler(hole,identity).at(data.origin),null);
const anchors=cast.map(e=>({actorId:e.actorId,position:e.position,height:sampler.at(e.position)}));
for(const e of anchors)assert(Math.abs(e.height-nav.floor)<.005,'Workplace support changed: '+e.actorId);
const paths=read('docs/3d-town/classic-motion-v1/routes.json');
const routes=paths.routes.map(route=>{
 let previous=null,maxHeightStep=0;
 const trace=route.trace.map(row=>{
  const z=sampler.at(row.position),surfaceZ=sampler.surface(row.position);assert(z!==null,route.passage.id+' lost ground support');
  if(previous!==null)maxHeightStep=Math.max(maxHeightStep,Math.abs(previous-z));previous=z;
  return {...row,z,surfaceZ};
 });
 return {...route,trace,maxHeightStep};
});
// The source has narrow threshold joints; a point ray can see the substrate
// while the shoe is supported on either side. Keep these facts separate.
const threshold=[-.7652111866,.285157671],thresholdSurface=sampler.surface(threshold),thresholdSupport=sampler.at(threshold);
assert(thresholdSurface<nav.floor-.04&&thresholdSupport>thresholdSurface+.04);
const lowFixture={...data,width:2,height:2,heights:[-10,-10,-10,-10]};
assert.equal(createGroundSampler(lowFixture,identity).at(data.origin),-.01);
const sources=['app/town-play/art-sample/sample-ground.ts','scripts/bake-classic-ground.py','scripts/check-classic-ground.mjs',groundPath,navPath,'docs/3d-town/classic-motion-v1/routes.json'];
const report={passed:true,checkedAt:new Date().toISOString(),scope:'Source-bound floor sampling and 42 controller routes; not foot IK or material/mesh acceptance.',anchors,threshold:{position:threshold,surface:thresholdSurface,support:thresholdSupport},routes,sources:Object.fromEntries(sources.map(p=>[p,sha(p)]))};
fs.writeFileSync('docs/3d-town/classic-motion-v1/ground-routes.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:true,routes:routes.length,anchors,threshold:report.threshold,maximumHeightStep:Math.max(...routes.map(r=>r.maxHeightStep))}));
