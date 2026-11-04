import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createNoirTestLoader} from './noir-player-test-loader.mjs';
const {load}=createNoirTestLoader(process.cwd());
const {createSampleNavigator}=load('app/town-play/art-sample/sample-navigation.ts');
const {classicMotionClearance}=load('app/town-play/art-sample/motion-clearance.ts');
const {residentSceneAnchor}=load('app/town-play/art-sample/living-presentation.ts');
const {classicWorldScene}=load('lib/classic-living-contract.ts');
const base='docs/3d-town/classic-motion-v2',pilot=process.argv[2]??'step-04';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const data=read(base+'/layout-01/navigation-candidate.json'),cast=read(base+'/layout-01/cast-candidate.json').entries;
const integrity=read(base+'/layout-01/layout-integrity.json');assert(integrity.passed&&integrity.sourceSha256===hash(base+'/layout-01/room.blend'));
const renders=read(base+'/'+pilot+'/renders/render-review.json');assert(renders.complete);for(const r of renders.renders)assert.equal(hash(base+'/'+pilot+'/renders/'+r.path),r.sha256);
data.player.radius=.38;data.colliders=data.colliders.filter(c=>!c.id.startsWith('art_'));
// These overhangs were independently verified unchanged by layout-integrity.
data.colliders.push(...classicMotionClearance.colliders);
for(const e of cast){const m=read('public'+e.manifestUrl),c=m.workAction.collider;data.colliders.push({id:'workplace_'+e.actorId,center:[e.position[0]+c.center[0],e.position[1]+c.center[1]],size:c.size,angle:0});}
const nav=createSampleNavigator(data),dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function line(a,b,valid){const n=Math.max(1,Math.ceil(dist(a,b)/.03));for(let i=0;i<=n;i++)if(!valid(lerp(a,b,i/n)))return false;return true;}
function path(start,portal,valid){
 assert(valid(start),'Route start is blocked: '+start);assert(valid(portal),'Portal is blocked: '+portal);
 const step=.12,key=(x,y)=>`${x},${y}`,point=(x,y)=>[x*step,y*step],open=[],parents=new Map();
 for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const x=Math.round(start[0]/step)+dx,y=Math.round(start[1]/step)+dy;if(line(start,point(x,y),valid)){open.push([x,y]);parents.set(key(x,y),null);}}
 let end=null;
 for(let i=0;i<open.length&&i<100000;i++){
  const [x,y]=open[i],p=point(x,y),id=key(x,y);
  if(dist(p,portal)<.25&&line(p,portal,valid)){end=id;break;}
  for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=key(nx,ny);if(!parents.has(k)&&line(p,point(nx,ny),valid)){parents.set(k,id);open.push([nx,ny]);}}
 }
 assert(end,'No path for '+start+' to '+portal);const reverse=[portal];for(let id=end;id!==null;id=parents.get(id)){const [x,y]=id.split(',').map(Number);reverse.push(point(x,y));}
 const raw=[start,...reverse.reverse()],simple=[start];
 for(let i=0;i<raw.length-1;){let next=raw.length-1;while(next>i+1&&!line(raw[i],raw[next],valid))next--;simple.push(raw[next]);i=next;}
 return simple;
}
const routes=[],failures=[];
const scenes=[...['books','station','inn'].map(sceneId=>({sceneId,portalSceneId:null})),...['books','station','inn',null].map(portalSceneId=>({sceneId:'town-square',portalSceneId}))];
for(const actor of cast)for(const {sceneId,portalSceneId}of scenes)for(const kind of ['departure','arrival']){
 const passage={id:[actor.actorId,sceneId,portalSceneId,kind].join('-'),actorId:actor.actorId,sceneId,portalSceneId,kind};
 try{
  const home=sceneId===classicWorldScene(actor.roomId),inside=sceneId!=='town-square',room=nav.rooms.find(r=>classicWorldScene(r.id)===(inside?sceneId:portalSceneId));
  const anchor=residentSceneAnchor(actor,sceneId),portal=room?[room.door[0],room.door[1]-.45]:[data.bounds[1]-.65,-3.05];
  const valid=p=>nav.valid(p)&&(inside?(nav.roomAt(p)?.id===room?.id||(!nav.roomAt(p)&&Math.abs(p[0]-portal[0])<.65&&p[1]>=portal[1]-.12)):!nav.roomAt(p));
  const retreat=home?[anchor[0],anchor[1]+actor.retreatMeters]:anchor,lead=home?[retreat[0]-.60,retreat[1]]:anchor;
  if(home)assert(line(retreat,lead,valid),'No clearance for authored turn and leftward first step');
  let points=path(lead,portal,valid);if(home)points=[retreat,...points];if(kind==='arrival')points.reverse();
  const meta=read(base+'/'+pilot+'/'+actor.actorId+'/authoring-review.json'),manifest=read('public'+actor.manifestUrl),trace=[];let time=0,distance=0;
  function authored(clip,basePosition,baseYaw){
   const spec=meta.clips.find(c=>c.clip===clip),n=Math.round(spec.durationSeconds*60);
   for(let i=0;i<=n;i++){const t=i/n,frame=1+t*(spec.frames-1),index=Math.min(spec.rootMotion.length-2,Math.floor(t*(spec.frames-1))),q=t*(spec.frames-1)-index,a=spec.rootMotion[index],b=spec.rootMotion[index+1],p=lerp(a.position,b.position,q),yaw=a.yaw+(b.yaw-a.yaw)*q;
    trace.push({t:time+i/60,clip,frame,basePosition,baseYaw,position:[basePosition[0]+Math.cos(baseYaw)*p[0]-Math.sin(baseYaw)*p[1],basePosition[1]+Math.sin(baseYaw)*p[0]+Math.cos(baseYaw)*p[1]],yaw:baseYaw+yaw});
   }time+=spec.durationSeconds;
  }
  if(home&&kind==='departure'){authored('BackAway',anchor,0);authored('TurnLeft',retreat,0);}
  for(let j=1;j<points.length;j++){
   const a=points[j-1],b=points[j],length=dist(a,b),steps=Math.max(1,Math.ceil(length/1.05*60)),yaw=Math.atan2(b[0]-a[0],-(b[1]-a[1]));
   for(let i=1;i<=steps;i++){distance+=length/steps;const position=lerp(a,b,i/steps);trace.push({t:time+i/60,clip:'Walk',frame:1+(distance/manifest.animation.strideMeters*24)%24,basePosition:position,baseYaw:yaw,position,yaw});}time+=steps/60;
  }
  if(home&&kind==='arrival'){authored('TurnLeft',retreat,Math.PI/2);authored('ApproachWork',retreat,0);}
  routes.push({passage,home,points,seconds:time,trace});
 }catch(error){failures.push({passage,message:error.message});}
}
const sources=['scripts/check-classic-egress-routes.mjs','app/town-play/art-sample/sample-navigation.ts','app/town-play/art-sample/motion-clearance.ts','app/town-play/art-sample/living-presentation.ts','lib/classic-living-contract.ts',base+'/layout-01/navigation-candidate.json',base+'/layout-01/cast-candidate.json',base+'/layout-01/layout-integrity.json',base+'/'+pilot+'/renders/render-review.json',...cast.map(e=>base+'/'+pilot+'/'+e.actorId+'/authoring-review.json')];
const report={schema:'classic-egress-route-candidate.v1',passed:failures.length===0&&routes.length===42,routes,failures,floor:data.floor,sourceHashes:Object.fromEntries(sources.map(p=>[p,hash(p)])),scope:'Candidate route Function check after source renders. Explicit retreat/turn/approach clips and conservative walking clearance. Not yet browser-integrated; source mesh and transition checks remain.',humanApproved:false};
fs.writeFileSync(base+'/'+pilot+'/routes.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,routes:routes.length,failures}));
