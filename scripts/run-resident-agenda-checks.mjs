import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createNoirTestLoader} from './noir-player-test-loader.mjs';
const {load}=createNoirTestLoader(process.cwd()),out=process.env.RESIDENT_AGENDA_REVIEW_DIR??'docs/agent-first-v5';fs.mkdirSync(out,{recursive:true});
const {createRiverbendWorld}=load('packages/engine/src/riverbend-world.ts');
const life=load('packages/engine/src/town/resident-life.ts'),cognition=load('packages/engine/src/town/resident-cognition.ts'),agenda=load('packages/engine/src/town/resident-agenda.ts');
const engine=load('packages/engine/src/persistent-town.ts'),{buildWorldReplayDigest}=load('packages/engine/src/town/replay-contract.ts');
const checks=[],make=()=>{const {world}=createRiverbendWorld({worldId:'agenda-check',seed:'goals',now:'2026-11-02T00:00:00.000Z'});life.enableTownResidentLife(world,world.persistentRuntime);return world;};
const npcId='rb-bai-lu';
const event=(id,time,kind='occupation',phase='completed',actor=npcId)=>({id,worldId:'agenda-check',day:1,time,type:'work',actorIds:[actor],locationId:'town-square',summary:'PRIVATE_EVENT_DETAIL',publicSummary:'参与日常事务',hidden:true,relatedCharacterIds:[actor],tags:['resident_life',kind,`life_${phase}`]});
const memory=(e,id=e.id)=>({id:`memory-${id}`,worldId:e.worldId,npcId:e.actorIds[0],kind:'direct',eventId:e.id,day:e.day,summary:'自己的主观记录，不是案件真相。',confidence:1,visibleToPlayer:false,challengeableEvidenceIds:[]});
const world=make(),runtime=world.persistentRuntime;
const old=event('z-old','07:20'),recent=event('a-new','07:55'),future=event('future','08:05'),foreign=event('foreign','07:59','occupation','completed','rb-zhou-yan'),orphan=event('missing','07:58');
world.memories.push(...[old,recent,future,foreign,orphan].map(e=>memory(e)));
world.memories.push({...memory(foreign,'stolen'),npcId});
const events=new Map([old,recent,future,foreign].map(e=>[e.id,e]));
const original=JSON.stringify(world),hits=cognition.retrieveResidentMemories(world,runtime,npcId,{events,locationId:'town-square'});
assert.deepEqual(hits.map(h=>h.eventId),['a-new','z-old']);assert.deepEqual(hits.map(h=>h.ageMinutes),[5,40]);assert.equal(JSON.stringify(world),original);
assert(hits.every(h=>!h.summary.includes('PRIVATE_EVENT_DETAIL')));assert.equal(cognition.retrieveResidentMemories(world,runtime,npcId).length,0);
const invalidClock=event('bad-clock','25:01');world.memories.push(memory(invalidClock));events.set(invalidClock.id,invalidClock);assert(!cognition.retrieveResidentMemories(world,runtime,npcId,{events}).some(h=>h.eventId==='bad-clock'));
checks.push('event-time-order-location-and-age-replace-day-only-ranking-with-no-orphan-future-other-NPC-or-hidden-detail-enrichment');

function selection(withMemories,withGoal=true){
  const w=make(),r=w.persistentRuntime,npc=w.npcs.find(n=>n.id===npcId),p=r.residentLife.people[npcId];p.needs={hunger:40,energy:80,loneliness:30};
  p.agenda=agenda.ensureResidentAgenda({worldId:w.id,seed:w.seed,npcId,day:1});
  if(!withGoal)p.agenda.goals.forEach(g=>{g.status='completed';g.progress=g.target;});
  // Isolate the decision mechanism: need scores, goal priorities and completed
  // event chronology are controlled, while the production scorer is unchanged.
  const craft=p.agenda.goals.find(g=>g.kind==='craft'),recover=p.agenda.goals.find(g=>g.kind==='recover');craft.priority=26;recover.priority=24;
  if(withMemories)w.memories.push(memory(old),memory(recent));
  r.residentLife.planner.mode='offline-agent';
  const options=cognition.buildResidentLifeOptions(w,r,npc,[{id:'work',kind:'occupation',npcIds:[npcId],locationId:'town-square',durationMinutes:30,label:'做事',ruleReasons:['合法事务']},{id:'rest',kind:'rest',npcIds:[npcId],locationId:'town-square',durationMinutes:15,label:'歇脚',ruleReasons:['可休息']}],events);
  return {...cognition.proposeResidentLifeOption(w,r,npc,p.needs,options,'work',events),world:w,runtime:r,options};
}
const noMemory=selection(false),withMemory=selection(true);assert.equal(noMemory.option.id,'work');assert.equal(withMemory.option.id,'rest');assert(withMemory.proposal.evaluation.scores.find(s=>s.candidateId==='work').repetitionPenalty>20);
assert(withMemory.proposal.retrievedMemoryIds.includes('memory-a-new'));assert.notEqual(selection(false,false).proposal.evaluation.scores[0].goal,noMemory.proposal.evaluation.scores[0].goal);
checks.push('same-legal-options-and-needs-choose-different-action-from-sourced-recent-memory-and-goal-scoring');
const beforeForged=JSON.stringify(withMemory.runtime.residentLife.planner);
assert.throws(()=>cognition.admitResidentLifeProposal(withMemory.world,withMemory.runtime,{...withMemory.proposal,evaluation:{...withMemory.proposal.evaluation,goalId:'life-goal:another-person'}},withMemory.options,events),e=>e.code==='UNKNOWN_SOURCE');
assert.equal(JSON.stringify(withMemory.runtime.residentLife.planner),beforeForged);
checks.push('referee-rejects-forged-personal-goal-reference-without-writing');

const daily=agenda.ensureResidentAgenda({worldId:world.id,seed:world.seed,npcId,day:1});
assert.equal(agenda.ensureResidentAgenda({worldId:world.id,seed:world.seed,npcId,day:1,previous:daily}),daily);
agenda.commitResidentGoal(daily,'occupation');const committed=daily.commitmentId;
assert.equal(agenda.creditResidentGoal(daily,event('start','08:30','occupation','started'),'occupation',480,30),false);
assert.equal(agenda.creditResidentGoal(daily,event('interrupt','08:30','occupation','interrupted'),'occupation',480,30),false);
assert.equal(agenda.creditResidentGoal(daily,{...event('wrong-world','08:30'),worldId:'foreign'},'occupation',480,30),false);
const done=event('completed-1','08:30');assert(agenda.creditResidentGoal(daily,done,'occupation',480,30));assert.equal(daily.commitmentId,committed);assert.equal(daily.goals[0].progress,30);
assert.equal(agenda.creditResidentGoal(daily,done,'occupation',480,30),false);assert(agenda.creditResidentGoal(daily,event('completed-2','09:00'),'occupation',510,30));assert.equal(daily.goals[0].status,'completed');assert.equal(daily.commitmentId,null);
const nextDay=agenda.ensureResidentAgenda({worldId:world.id,seed:world.seed,npcId,day:2,previous:daily});assert.equal(nextDay.history[0].goals.find(g=>g.kind==='connect').status,'expired');assert.equal(nextDay.goals[0].progress,0);
assert.throws(()=>agenda.ensureResidentAgenda({worldId:world.id,seed:world.seed,npcId:'other',day:1,previous:daily}),/owner mismatch/);
const midnight={...event('midnight','00:20','sleep'),day:2};assert(agenda.creditResidentGoal(nextDay,midnight,'sleep',1420,40));assert.equal(nextDay.goals.find(g=>g.kind==='recover').progress,20);
checks.push('daily-goals-persist-until-completion-expire-honestly-credit-once-and-clip-cross-midnight-minutes');

let w=make(),es=[];life.setResidentLifePlannerMode(w.persistentRuntime,'offline-agent');
const advance=(value,log,steps)=>{const r=engine.advancePersistentTownTick(value,log,{steps,status:'paused'});log.push(...r.events);return {...r.world,persistentRuntime:r.runtime};};
w=advance(w,es,12);const beforeSave=JSON.stringify(w.persistentRuntime.residentLife.people);
const saved=JSON.parse(JSON.stringify(w));saved.persistentRuntime=engine.normalizePersistentTownRuntime(saved,es,saved.persistentRuntime);assert.equal(JSON.stringify(saved.persistentRuntime.residentLife.people),beforeSave);
const savedEvents=structuredClone(es),a=advance(w,es,12),b=advance(saved,savedEvents,12);
assert.equal(buildWorldReplayDigest(a,es,a.persistentRuntime).combinedDigest,buildWorldReplayDigest(b,savedEvents,b.persistentRuntime).combinedDigest);
for(const person of Object.values(a.persistentRuntime.residentLife.people))for(const goal of person.agenda.goals)for(const credit of goal.credits)assert(es.some(e=>e.id===credit.eventId&&e.actorIds.includes(person.agenda.npcId)));
assert.equal(a.persistentRuntime.residentLife.planner.providerBudget.used,0);
checks.push('actual-clock-goal-credits-save-normalize-and-replay-remain-source-backed-with-zero-provider-attempts');
const files=['packages/engine/src/town/resident-agenda.ts','packages/engine/src/town/resident-cognition.ts','packages/engine/src/town/resident-life.ts','packages/engine/src/persistent-town.ts','scripts/run-resident-agenda-checks.mjs'];
const report={schema:'resident-agenda-checks.v1',checkedAt:new Date().toISOString(),passed:true,checks,controlledMemoryEffect:{withoutMemory:noMemory.option.id,withMemory:withMemory.option.id},sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),limits:['Controlled mechanism tests and a short real-clock replay; three-day qualification is reported separately.','No model, embeddings, semantic memory summaries, reflection or case truth generation.']};
fs.writeFileSync(`${out}/agenda-review.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,groups:checks.length,report:`${out}/agenda-review.json`}));
