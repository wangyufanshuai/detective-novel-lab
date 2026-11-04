import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createNoirTestLoader } from './noir-player-test-loader.mjs';

const root=process.cwd(),out=process.env.RESIDENT_PROVIDER_REVIEW_DIR??'docs/agent-first-v4';fs.mkdirSync(`${out}/runtime`,{recursive:true});
const run=fs.mkdtempSync(path.join(root,out,'runtime','provider-'));process.env.DATABASE_URL=path.join(run,'isolated.db');
const {load}=createNoirTestLoader(root);
const {createRiverbendWorld}=load('packages/engine/src/riverbend-world.ts');
const life=load('packages/engine/src/town/resident-life.ts');
const cognition=load('packages/engine/src/town/resident-cognition.ts');
const engine=load('packages/engine/src/persistent-town.ts');
const {buildWorldReplayDigest}=load('packages/engine/src/town/replay-contract.ts');
const {chooseResidentLife}=load('lib/world/resident-life-provider.ts');
const {chooseResidentWork,residentDecisionProviderFromEnv}=load('lib/world/resident-decision-provider.ts');
const store=load('lib/world/town-exploration-store.ts'),repo=load('lib/world/repository.ts');
const {withPrivateWorldAccess:access}=load('lib/world/private-world-access.ts');
const {projectExplorationObservation}=load('packages/engine/src/town/agent-observation.ts');
const checks=[],clone=value=>JSON.parse(JSON.stringify(value));
const provider={name:'local',baseUrl:'http://127.0.0.1:9999/v1',model:'controlled-selector',apiKey:'FIXTURE-NOT-A-REAL-KEY'};
const make=(seed='provider-seed')=>{const {world}=createRiverbendWorld({worldId:'life-provider-check',seed,now:'2026-11-01T00:00:00.000Z'});life.enableTownResidentLife(world,world.persistentRuntime);return world;};
const step=(w,events=[],steps=1)=>{const r=engine.advancePersistentTownTick(w,events,{steps,status:'paused',cloneInput:false});events.push(...r.events);return {...r.world,persistentRuntime:r.runtime};};
const body=content=>new Response(JSON.stringify({choices:[{message:{content}}]}));
let world=make(),runtime=world.persistentRuntime;
world.npcs.find(n=>n.id==='rb-xu-zhiwei').secret='OTHER-SECRET-CANARY';
world.memories.push({id:'private-other',worldId:world.id,npcId:'rb-xu-zhiwei',day:1,kind:'secret',eventId:'other',summary:'OTHER-MEMORY-CANARY',confidence:1,visibleToPlayer:false,challengeableEvidenceIds:[]});
const before=JSON.stringify(world),contexts=life.prepareResidentLifeDecisions(world,runtime);
assert.equal(JSON.stringify(world),before,'Planning preview mutated authoritative state');assert(contexts.length>0);
const context=contexts[0];assert(context.candidates.length>=2);assert(!JSON.stringify(context).includes('CANARY'));
assert(context.candidates.every(c=>c.npcIds.length===1&&c.npcIds[0]===context.npcId));
assert(!('npcs' in context)&&!('schedule' in context)&&!('secret' in context.self));
assert(context.memories.length<=6);assert(context.memories.every(m=>m.npcId===context.npcId));
checks.push('real-planner-preview-is-read-only-private-and-has-multiple-legal-solo-options');

let requests=0;
const fetchAnswer=content=>async(_url,options)=>{requests++;const sent=JSON.parse(options.body);assert.equal(sent.max_tokens,96);assert.deepEqual(JSON.parse(sent.messages[1].content),context);return body(content);};
const alternative=context.candidates.find(c=>c.id!==context.preferredId).id;
assert.equal((await chooseResidentLife({context,provider:null,budgetReserved:false,fetcher:fetchAnswer('')})).choice.source,'offline');
assert.equal((await chooseResidentLife({context,provider,budgetReserved:false,fetcher:fetchAnswer('')})).choice.source,'budget');assert.equal(requests,0);
assert.equal(residentDecisionProviderFromEnv({}),null);
checks.push('missing-provider-and-unreserved-budget-do-not-call-transport');
for(const content of ['null','[]','not json','```json\n{"candidateId":"rest"}\n```','{"candidateId":"invent-truth"}',
  JSON.stringify({candidateId:alternative,evidence:'fake'}),`{"candidateId":"${alternative}","candidateId":"${context.preferredId}"}`,JSON.stringify({candidateId:'x'.repeat(257)})]) {
  const outcome=await chooseResidentLife({context,provider,budgetReserved:true,fetcher:fetchAnswer(content)});
  assert.equal(outcome.choice.source,'invalid');assert.equal(outcome.choice.candidateId,context.preferredId);
}
const valid=await chooseResidentLife({context,provider,budgetReserved:true,fetcher:fetchAnswer(JSON.stringify({candidateId:alternative}))});
assert.equal(valid.choice.source,'model');assert.equal(valid.choice.candidateId,alternative);assert(!JSON.stringify(valid).includes(provider.apiKey));
checks.push('single-key-JSON-rejects-duplicates-extra-fields-unknown-options-and-oversized-content');
for(const fetcher of [async()=>new Response('bad',{status:503}),async()=>new Response('not json'),async()=>body('x'.repeat(17000)),async()=>{throw Error(provider.apiKey);}]) {
  const outcome=await chooseResidentLife({context,provider,budgetReserved:true,fetcher});assert.equal(outcome.choice.source,'error');assert.equal(outcome.choice.candidateId,context.preferredId);assert(!JSON.stringify(outcome).includes(provider.apiKey));
}
const timeout=await chooseResidentLife({context,provider,budgetReserved:true,timeoutMs:15,fetcher:async()=>new Promise(()=>{})});assert.equal(timeout.choice.source,'timeout');assert.equal(timeout.choice.candidateId,context.preferredId);
const streamTimeout=await chooseResidentLife({context,provider,budgetReserved:true,timeoutMs:15,fetcher:async()=>new Response(new ReadableStream({start(){}}))});assert.equal(streamTimeout.choice.source,'timeout');
const badURL=await chooseResidentLife({context,provider:{...provider,baseUrl:'file:///secret'},budgetReserved:true,fetcher:fetchAnswer('')});assert.equal(badURL.choice.source,'error');
const beforeLarge=requests;
const huge=await chooseResidentLife({context:{...context,self:{...context.self,goal:'x'.repeat(17000)}},provider,budgetReserved:true,fetcher:fetchAnswer('')});
assert.equal(huge.choice.source,'invalid');assert.equal(huge.diagnostic.attempted,false);assert.equal(requests,beforeLarge);
const secondPreferred={...context,preferredId:alternative};
assert.equal((await chooseResidentLife({context:secondPreferred,provider:null,budgetReserved:false})).choice.candidateId,alternative);
checks.push('bounded-stream-HTTP-failure-invalid-envelope-timeout-and-errors-preserve-rule-fallback');

assert.throws(()=>life.queueResidentLifeDecision(world,runtime,context,valid.choice),e=>e.code==='BUDGET_EXHAUSTED');
assert(cognition.reserveResidentLifeModelAttempt(runtime,context));assert.equal(cognition.reserveResidentLifeModelAttempt(runtime,context),false);
life.queueResidentLifeDecision(world,runtime,context,valid.choice);
assert.throws(()=>life.queueResidentLifeDecision(world,runtime,{...context,policyVersion:'forged'},valid.choice),e=>e.code==='STALE_CONTEXT');
const baseline=step(make()),events=[];const snapshot=engine.createTownStateSnapshot(world,[],{id:'provider-checkpoint',label:'Queued controlled proposal',mode:'checkpoint'});
const chosen=step(world,events);assert.equal(chosen.persistentRuntime.residentLife.planner.providerDecisions[0].choice.candidateId,alternative);
const action=w=>Object.values(w.persistentRuntime.residentLife.active).find(a=>a.npcIds.includes(context.npcId));
assert.notEqual(action(chosen)?.kind,action(baseline)?.kind,'Only metadata changed; no real action difference');
const rolled=engine.rollbackTownRuntimeToSnapshot(chosen,snapshot),replayEvents=[];const replayed=step({...rolled.world,persistentRuntime:rolled.runtime},replayEvents);
assert.equal(buildWorldReplayDigest(chosen,events,chosen.persistentRuntime).combinedDigest,buildWorldReplayDigest(replayed,replayEvents,replayed.persistentRuntime).combinedDigest);
assert.deepEqual(replayed.persistentRuntime.residentLife,chosen.persistentRuntime.residentLife);
checks.push('reserved-controlled-choice-changes-real-action-and-replays-from-checkpoint-without-network');

const forgedWorld=make(),fr=forgedWorld.persistentRuntime,fn=forgedWorld.npcs.find(n=>n.id===context.npcId);
const fresh=life.prepareResidentLifeDecisions(forgedWorld,fr)[0];
const proposal=cognition.proposeResidentLifeOption(forgedWorld,fr,fn,fr.residentLife.people[fn.id].needs,fresh.candidates,fresh.preferredId).proposal;
for(const patch of [{sourceRefs:[...proposal.sourceRefs,'life-policy:forged']},{retrievedMemoryIds:['private-other']},{confidence:NaN}]) {
  const saved=JSON.stringify(fr.residentLife.planner);assert.throws(()=>cognition.admitResidentLifeProposal(forgedWorld,fr,{...proposal,...patch},fresh.candidates));assert.equal(JSON.stringify(fr.residentLife.planner),saved);
}
const staleWorld=make(),sr=staleWorld.persistentRuntime,sc=life.prepareResidentLifeDecisions(staleWorld,sr)[0];
cognition.reserveResidentLifeModelAttempt(sr,sc);life.queueResidentLifeDecision(staleWorld,sr,sc,{candidateId:sc.candidates.find(c=>c.id!==sc.preferredId).id,source:'model',provider:'local',model:'controlled-selector'});
sr.residentLife.people[sc.npcId].needs.hunger+=1;const stale=step(staleWorld);
assert.equal(stale.persistentRuntime.residentLife.planner.providerDecisions[0].choice.source,'stale');
checks.push('referee-rejects-forged-policy-memory-confidence-and-rechecks-stale-choices-at-execution');

// Exhaust a deliberately small local score budget, then complete all 72 hours.
let local=make('offline-long');local.persistentRuntime.residentLife.planner.mode='offline-agent';local.persistentRuntime.residentLife.planner.modelBudget.limit=1;
const localEvents=[];for(let i=0;i<864;i+=12)local=step(local,localEvents,12);
assert.equal(local.persistentRuntime.tick,864);assert.equal(local.persistentRuntime.residentLife.planner.modelBudget.used,1);
assert(Object.values(local.persistentRuntime.residentLife.people).every(p=>p.completed.eat>0&&p.completed.sleep>0));
checks.push('offline-score-budget-exhaustion-continues-full-72-hour-life');

let calls=0;
const controlledFetch=async(_url,options)=>{calls++;assert.equal(repo.getDb().inTransaction,false);const c=JSON.parse(JSON.parse(options.body).messages[1].content);assert.equal(c.schema,'resident-life-context.v1');return body(JSON.stringify({candidateId:c.candidates.find(o=>o.id!==c.preferredId).id}));};
const savedWorld=v=>access(v.worldId,()=>repo.worldRepository.getWorld(v.worldId));
const owner=()=>{const start=store.startTownPlay();const view=store.commandTownPlay(start.credentials,{kind:'life-enable',actionId:'life-enable',expectedSessionRevision:start.result.view.revision,expectedWorldRevision:start.result.view.worldRevision}).view;return {credentials:start.credentials,view};};
const command=(v,id)=>({kind:'work-step',actionId:id,expectedSessionRevision:v.revision,expectedWorldRevision:v.worldRevision});
try {
  const a=owner(),cmd=command(a.view,'controlled-life-step');
  const result=await store.commandTownLifeStep(a.credentials,cmd,{provider,fetcher:controlledFetch});
  const count=calls;assert(count>0);assert.equal(result.view.time,'08:05');
  const saved=savedWorld(result.view);assert.equal(saved.persistentRuntime.residentLife.planner.providerBudget.used,count);
  assert(saved.persistentRuntime.residentLife.planner.providerDecisions.every(d=>d.choice.source==='model'));
  assert(!JSON.stringify(saved).includes(provider.apiKey));assert.equal(result.view.residentLife.modelCalls,null);assert.equal(result.view.residentLife.modelAttemptsReserved,count);
  assert.equal(projectExplorationObservation(result.view).simulation.modelCalls,null);
  assert.deepEqual((await store.commandTownLifeStep(a.credentials,cmd,{provider,fetcher:controlledFetch})).view,clone(result.view));assert.equal(calls,count);
  repo.closeDatabase();assert.deepEqual(store.readTownPlay(a.credentials),result.view);
  assert.deepEqual((await store.commandTownLifeStep(a.credentials,cmd,{provider,fetcher:controlledFetch})).view,clone(result.view));assert.equal(calls,count);
  await assert.rejects(()=>store.commandTownLifeStep({...a.credentials,secret:'forged'},cmd,{provider,fetcher:controlledFetch}),e=>e.code==='SESSION_FORBIDDEN');
  await assert.rejects(()=>store.commandTownLifeStep(a.credentials,{...cmd,expectedWorldRevision:999},{provider,fetcher:controlledFetch}),e=>e.code==='ACTION_REUSED');
  checks.push('real-SQLite-reserves-before-await-caches-exact-owned-retry-across-reopen-and-does-not-leak-key');

  const b=owner();access(b.view.worldId,()=>{const w=repo.worldRepository.getWorld(b.view.worldId);w.persistentRuntime.residentLife.planner.providerBudget.limit=0;repo.worldRepository.saveWorld(w);});
  const budget=await store.commandTownLifeStep(b.credentials,command(b.view,'zero-budget'),{provider,fetcher:controlledFetch});assert.equal(calls,count);assert.equal(budget.view.time,'08:05');assert(savedWorld(budget.view).persistentRuntime.residentLife.planner.providerDecisions.every(d=>d.choice.source==='budget'));
  const offline=owner(),offlineCmd=command(offline.view,'offline-life');const offlineResult=await store.commandTownLifeStep(offline.credentials,offlineCmd,{provider:null,fetcher:controlledFetch});assert.equal(calls,count);assert.equal(offlineResult.view.residentLife.modelCalls,0);assert.equal((await store.commandTownLifeStep(offline.credentials,offlineCmd,{provider:null})).replayed,true);
  const disabled=owner(),oldEnv=process.env.RESIDENT_LIFE_AI_ENABLED;delete process.env.RESIDENT_LIFE_AI_ENABLED;
  try {const disabledResult=await store.commandTownLifeStep(disabled.credentials,command(disabled.view,'disabled-default'));assert.equal(disabledResult.view.residentLife.modelAttemptsReserved,0);}finally{if(oldEnv!==undefined)process.env.RESIDENT_LIFE_AI_ENABLED=oldEnv;}
  checks.push('durable-zero-budget-missing-provider-and-default-disabled-mode-advance-without-calls');

  const crashed=owner(),crashCmd=command(crashed.view,'crash-life');let release;
  const gate=new Promise(resolve=>{release=resolve;});let crashCalls=0;
  const waiting=store.commandTownLifeStep(crashed.credentials,crashCmd,{provider,timeoutMs:2000,fetcher:async()=>{crashCalls++;await gate;return body('{"candidateId":"rest-short"}');}});
  assert(crashCalls>0);
  await assert.rejects(()=>store.commandTownLifeStep(crashed.credentials,crashCmd,{provider,fetcher:controlledFetch}),e=>e.code==='WORK_BUSY');
  const mid=store.readTownPlay(crashed.credentials);
  assert.throws(()=>store.commandTownPlay(crashed.credentials,{...command(mid,'competing-clock'),kind:'wait',minutes:15}),e=>e.code==='WORK_BUSY');
  repo.getDb().prepare('update town_resident_work_batches set expires_at=0 where session_id=?').run(crashed.credentials.id);
  const recovered=await store.commandTownLifeStep(crashed.credentials,crashCmd,{provider,fetcher:controlledFetch});assert.equal(calls,count);assert.equal(recovered.view.time,'08:05');
  release();assert.equal((await waiting).replayed,true);
  const recoveredWorld=savedWorld(recovered.view);assert.equal(recoveredWorld.persistentRuntime.residentLife.planner.providerBudget.used,crashCalls);assert(recoveredWorld.persistentRuntime.residentLife.planner.providerDecisions.every(d=>d.choice.source==='error'));
  checks.push('in-flight-lease-blocks-competing-clock-and-expired-batch-recovers-without-rebilling-or-double-tick');

  // An administrator can bypass the visitor lease. The final world CAS must
  // still reject the old proposal and retain its already-spent reservation.
  const moved=owner(),movedCmd=command(moved.view,'admin-moved-life');let finish;
  const deferred=new Promise(resolve=>{finish=resolve;});let movedCalls=0;
  const pending=store.commandTownLifeStep(moved.credentials,movedCmd,{provider,timeoutMs:2000,fetcher:async()=>{movedCalls++;await deferred;return body('{"candidateId":"rest-short"}');}});
  const rejection=assert.rejects(()=>pending,e=>e.code==='STATE_CHANGED');
  access(moved.view.worldId,()=>{const w=repo.worldRepository.getWorld(moved.view.worldId);w.persistentRuntime.commandRevision++;repo.worldRepository.saveWorld(w);});
  finish();await rejection;
  const afterMove=savedWorld(moved.view);assert.equal(afterMove.persistentRuntime.tick,0);assert.equal(afterMove.persistentRuntime.residentLife.planner.providerBudget.used,movedCalls);assert.equal(afterMove.persistentRuntime.residentLife.planner.providerDecisions.length,0);
  await assert.rejects(()=>store.commandTownLifeStep(moved.credentials,movedCmd,{provider,fetcher:controlledFetch}),e=>e.code==='STATE_CHANGED');assert.equal(calls,count);
  checks.push('fresh-world-CAS-rejects-admin-changed-state-after-await-without-tick-or-repeat-charge');
} finally {repo.closeDatabase();}

const files=['packages/engine/src/town/resident-cognition.ts','packages/engine/src/town/resident-life.ts','packages/engine/src/town/resident-work.ts','packages/engine/src/persistent-town.ts','packages/engine/src/town/replay-contract.ts','packages/engine/src/town/agent-observation.ts','lib/world/town-exploration-store.ts','lib/world/resident-decision-provider.ts','lib/world/resident-life-provider.ts','lib/town-play-contract.ts','scripts/run-resident-life-provider-checks.mjs'];
const report={schema:'resident-life-provider-checks.v1',checkedAt:new Date().toISOString(),passed:true,checks,
  evidence:{actualEngine:true,isolatedSQLite:true,controlledTransport:true,liveModel:false,liveExternalCalls:0,browserThisRound:false,humanReview:false},
  sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),
  limits:['Provider entry point is server-only and default disabled; visitor planning modes do not initiate model calls.','Transport responses are controlled fixtures, not proof of model decision quality.','Model budget reservations are an upper bound; exact network calls after a crash are unknown.','Memory retrieval verifies own participation against source events; no embedding or semantic cognition claim.']};
fs.writeFileSync(`${out}/provider-review.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,groups:checks.length,report:`${out}/provider-review.json`}));
