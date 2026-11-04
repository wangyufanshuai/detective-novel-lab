import assert from "node:assert/strict";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { chooseTownInteraction } from "../app/town-play/town-interaction.ts";
import { createResidentEncounter } from "../app/town-play/resident-encounter.ts";
import { createTownNavigator } from "../lib/riverbend-navigation.ts";

const prefix="docs/3d-town/riverbend-encounters-v1/";
const hash=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");
const data=JSON.parse(await fs.readFile("public/assets/riverbend/v1/navigation.json","utf8"));
const nav=createTownNavigator(data);
const person={actorId:"resident-03",npcId:"rb-xu-zhiwei",name:"许知微",role:"旧书修复师",sceneId:"books",visibility:"observed"};
const door=data.destinations.find(d=>d.id==="books");
const positions=new Map([[person.actorId,[-1.2,4.7]]]);
const choose=(extra={})=>chooseTownInteraction({position:[-.2,4.7],sceneId:"books",confirmedSceneId:"books",residents:[person],actorPositions:positions,nearby:door,valid:nav.valid,...extra});
assert.equal(choose().kind,"resident");
assert.equal(choose({position:[.3,6.7]}).kind,"place");
assert.equal(choose({residents:[{...person,visibility:"last-seen"}],nearby:null}),null);
assert.equal(choose({residents:[{...person,sceneId:"post"}],nearby:null}),null);
assert.equal(choose({actorPositions:new Map(),nearby:null}),null);
assert.equal(choose({position:[-8,4.7],nearby:null}),null);
assert.equal(choose({confirmedSceneId:"town-square"}),null);
assert.equal(choose({valid:(x,y)=>nav.valid(x,y)&&x>-.6,nearby:null}),null,"A wall blocks physical affordance");

const manifest=JSON.parse(await fs.readFile("public/assets/riverbend/residents-v2/manifest.json","utf8"));
const bytes=await fs.readFile("public"+manifest.asset.url);
assert.equal(hash(bytes),manifest.asset.sha256);
const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),"");
const actors=new Map();scene.traverse(o=>{if(o.userData.actorId)actors.set(o.userData.actorId,o);});
const encounter=createResidentEncounter(actors);
let maxRadius=0,minY=Infinity,verticesChecked=0;
for(const [id,actor]of actors){
  actor.position.set(2,0,-3);const origin=actor.position.clone();
  for(let frame=0;frame<64;frame++){
    encounter.update(id,[2+Math.sin(frame*.3)*1.5,3+Math.cos(frame*.3)*1.5],.05,false);
    scene.updateMatrixWorld(true);
    actor.traverse(o=>{if(!o.isMesh)return;const positions=o.geometry.attributes.position;const p=new THREE.Vector3();for(let i=0;i<positions.count;i++){
      p.fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld).sub(origin);maxRadius=Math.max(maxRadius,Math.hypot(p.x,p.z));minY=Math.min(minY,p.y);verticesChecked++;
    }});
  }
  assert.deepEqual(actor.position.toArray(),origin.toArray(),"Conversation cannot move a resident or its world location");
  assert(maxRadius<manifest.collisionRadius,"Conversation exceeds the authored walk envelope");
  assert(minY>=-.012,"Conversation feet penetrate the ground");
  encounter.update(id,[3,3],.05,true);
  actor.traverse(o=>{if(o.userData.joint)assert(o.rotation.toArray().slice(0,3).every(x=>x===0),"Reduced motion must remove gestures");});
  const rotation=actor.rotation.toArray();actor.visible=false;encounter.update(id,[20,20],.05,false);assert.deepEqual(actor.rotation.toArray(),rotation,"Hidden actor cannot turn toward a player it cannot observe");assert.deepEqual(actor.position.toArray(),origin.toArray());actor.visible=true;
}
encounter.update(null,[0,0],.05,false);
const inputs=await Promise.all(["app/town-play/town-interaction.ts","app/town-play/resident-encounter.ts","scripts/run-riverbend-encounter-checks.mjs","lib/riverbend-navigation.ts"].map(async path=>({path,sha256:hash(await fs.readFile(path))})));
const result={schema:"riverbend-encounter-checks.v1",passed:true,checkedAt:new Date().toISOString(),inputs,assetSha256:manifest.asset.sha256,actors:actors.size,verticesChecked,maxRadius,minY,
  checks:["observed-and-physical-body-only","same-confirmed-place","proximity","wall-block","nearest-door-priority","no-world-position-mutation","articulated-gesture-envelope","feet-on-ground","reduced-motion","hidden-body-inactive"],
  scope:"Actual exported resident geometry plus deterministic public-affordance controls; browser interaction, server authority and artistic judgment are separate"};
await fs.mkdir(prefix,{recursive:true});await fs.writeFile(prefix+"function-form-review.json",JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result));
