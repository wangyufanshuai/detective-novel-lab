import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createNoirTestLoader} from './noir-player-test-loader.mjs';
const {load}=createNoirTestLoader(process.cwd());
const {planObservedPassage,createObservedMotionPlayback,advanceObservedWalker}=load('app/town-play/art-sample/living-motion.ts');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const data=read('public/assets/classic-bookshop/v2/navigation.json'),cast=read('public/assets/classic-occupations/v2/cast.json');
for(const e of cast.entries){const m=read('public'+e.manifestUrl),c=m.workAction.collider;data.colliders.push({id:'workplace_'+e.actorId,center:[e.position[0]+c.center[0],e.position[1]+c.center[1]],size:c.size,angle:0});}
const routes=[];
const scenes=[...['books','station','inn'].map(sceneId=>({sceneId,portalSceneId:null})),...['books','station','inn',null].map(portalSceneId=>({sceneId:'town-square',portalSceneId}))];
for(const e of cast.entries)for(const {sceneId,portalSceneId} of scenes)for(const kind of ['departure','arrival']){
 const passage={id:[e.actorId,sceneId,portalSceneId,kind].join('-'),actorId:e.actorId,npcId:e.actorId,kind,sceneId,portalSceneId,day:1,time:'12:00'};
 const route=planObservedPassage(data,e,passage),play=createObservedMotionPlayback(data,cast.entries,{id:passage.id,passages:[passage]});
 let done=false,previous=null,maximumStep=0,frames=0,trace=[];
 while(!done&&frames++<2400){done=play.update(1/60,[-20,-7],[]);const pose=play.poses.get(e.actorId);if(previous)maximumStep=Math.max(maximumStep,Math.hypot(pose.position[0]-previous[0],pose.position[1]-previous[1]));previous=[...pose.position];trace.push({t:frames/60,position:previous,yaw:pose.yaw,moved:pose.frameDistance,visible:pose.visible});}
 assert(done,passage.id);assert(maximumStep<=1.05/60+1e-7);assert.equal(play.poses.get(e.actorId).visible,kind==='arrival');
 routes.push({passage,...route,frames,maximumStep,trace});
}
const stopped=advanceObservedWalker([0,0],[1,0],.02,[[.55,0]]);assert(stopped.blocked&&stopped.distance===0);
const resumed=advanceObservedWalker(stopped.position,[1,0],.02,[[0,1]]);assert(!resumed.blocked&&resumed.distance>0);
assert(advanceObservedWalker([0,0],[5,0],10,[]).distance<=.045*1.05+1e-8);
const sources=['app/town-play/art-sample/living-motion.ts','app/town-play/art-sample/motion-clearance.ts','app/town-play/art-sample/living-presentation.ts','lib/classic-living-contract.ts','app/town-play/art-sample/sample-navigation.ts','public/assets/classic-occupations/v2/cast.json','public/assets/classic-bookshop/v2/navigation.json',...cast.entries.map(e=>'public'+e.manifestUrl),'scripts/check-classic-motion-routes.mjs'];
fs.mkdirSync('docs/3d-town/classic-motion-v1',{recursive:true});
fs.writeFileSync('docs/3d-town/classic-motion-v1/routes.json',JSON.stringify({passed:true,scope:'Geometry routes and same distance-driven playback used by the renderer. World authorization tested separately. Mesh validation is separate.',floor:data.floor,routes,sources:Object.fromEntries(sources.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]))},null,2));
console.log(JSON.stringify({passed:true,routes:routes.length,blockedAndResumed:true,maximumStep:Math.max(...routes.map(r=>r.maximumStep))}));
