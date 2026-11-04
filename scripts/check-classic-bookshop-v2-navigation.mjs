import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
const root=process.cwd(),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const source=fs.readFileSync('app/town-play/art-sample/sample-navigation.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {createSampleNavigator}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const manifest=read('public/assets/classic-bookshop/v2/manifest.json');
const navFile=path.join(root,'public',manifest.navigationUrl ?? manifest.navigation?.url ?? '/assets/classic-bookshop/v2/navigation.json');
const data=read(navFile),cast=read('public/assets/classic-bookshop/v2/cast.json');
for(const entry of cast.entries){
  data.colliders.push({id:'art_'+entry.actorId,center:entry.position,size:[.62,.44],angle:-entry.yaw});
  data.interactions.push({id:'art_'+entry.actorId,position:entry.observationPosition,roomId:entry.roomId});
  const actor=read(path.join(root,'public',entry.manifestUrl));
  if(actor.workAction){const c=actor.workAction.collider,angle=-entry.yaw;
    data.colliders.push({id:'workplace_'+entry.actorId,size:c.size,angle,center:[entry.position[0]+Math.cos(angle)*c.center[0]-Math.sin(angle)*c.center[1],entry.position[1]+Math.sin(angle)*c.center[0]+Math.cos(angle)*c.center[1]]});}
}
const goals=[...cast.entries.map(e=>({id:e.actorId,position:e.observationPosition,near:'art_'+e.actorId})),{id:'shop-staff-passage',position:[.6,3.3],near:null}];
const nav=createSampleNavigator(data),step=.09,origin=data.player.spawn,queue=[[0,0]],seen=new Set(['0,0']),found={};
if(!nav.valid(origin))throw new Error('Spawn invalid');
for(let head=0;head<queue.length;head++){
  const [x,y]=queue[head],p=[origin[0]+x*step,origin[1]+y*step];
  for(const e of goals)if(!found[e.id]&&Math.hypot(p[0]-e.position[0],p[1]-e.position[1])<.13&&(!e.near||nav.nearest(p)?.id===e.near))found[e.id]=p;
  if(Object.keys(found).length===goals.length)break;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const q=[x+dx,y+dy],key=q.join(',');if(seen.has(key))continue;seen.add(key);
    const next=[origin[0]+q[0]*step,origin[1]+q[1]*step],moved=nav.move(p,next[0]-p[0],next[1]-p[1]);
    if(Math.hypot(moved[0]-next[0],moved[1]-next[1])<1e-6)queue.push(q);
  }
}
if(Object.keys(found).length!==goals.length)throw new Error('Observation route blocked: '+JSON.stringify(found));
const station=data.colliders.find(c=>c.id==='workplace_resident-03');if(!station||nav.valid(station.center))throw new Error('Workstation is not solid');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const report={passed:true,scope:'Static Function review using the same movement and collision implementation as the browser.',castSha256:hash('public/assets/classic-bookshop/v2/cast.json'),navigationSha256:hash(navFile),navigatorSha256:hash('app/town-play/art-sample/sample-navigation.ts'),routes:found,visitedNodes:queue.length,workstation:station};
fs.writeFileSync('docs/3d-town/classic-bookshop-v2/navigation-review.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
