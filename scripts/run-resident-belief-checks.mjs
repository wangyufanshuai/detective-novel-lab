import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createNoirTestLoader} from './noir-player-test-loader.mjs';
const {load}=createNoirTestLoader(process.cwd()),out='docs/agent-first-v7';fs.mkdirSync(out,{recursive:true});
const {createRiverbendWorld}=load('packages/engine/src/riverbend-world.ts'),life=load('packages/engine/src/town/resident-life.ts');
const beliefs=load('packages/engine/src/town/resident-social-beliefs.ts'),cognition=load('packages/engine/src/town/resident-cognition.ts');
const engine=load('packages/engine/src/persistent-town.ts'),{buildWorldReplayDigest}=load('packages/engine/src/town/replay-contract.ts');
const pair=['rb-bai-lu','rb-cheng-du'],checks=[];
const step=(world,events,n=1)=>{const r=engine.advancePersistentTownTick(world,events,{steps:n,status:'paused',cloneInput:false});events.push(...r.events);return{...r.world,persistentRuntime:r.runtime};};
const digest=(w,e)=>buildWorldReplayDigest(w,e,w.persistentRuntime).combinedDigest;
function fixture(){const {world}=createRiverbendWorld({worldId:'belief-check',seed:'appointment-check',now:'2026-11-03T00:00:00.000Z'});life.enableTownResidentLife(world,world.persistentRuntime);life.setResidentLifePlannerMode(world.persistentRuntime,'offline-agent');
  for(const npc of world.npcs){world.persistentRuntime.residentLife.people[npc.id].needs={hunger:20,energy:85,loneliness:0};if(pair.includes(npc.id)){npc.schedule={'00:00':'town-square'};world.persistentRuntime.agentStates.find(a=>a.npcId===npc.id).locationId='town-square';world.persistentRuntime.residentLife.people[npc.id].needs.loneliness=55;}}return world;}
const records=w=>Object.values(w.persistentRuntime.residentLife.socialBeliefs?.records??{});
const own=(w,id)=>records(w).find(b=>b.npcId===id);
let initial=fixture(),events=[];initial=step(initial,events,3);
const contract=initial.persistentRuntime.residentLife.appointments.items[0],waiter=contract.npcIds[0],absent=contract.npcIds[1];
assert(records(initial).every(b=>b.observation==='agreed'));assert.equal(records(initial).length,2);
const contextSources=new Map(events.map(e=>[e.id,e]));
const before=beliefs.projectResidentSocialBeliefs(initial,initial.persistentRuntime,waiter,contextSources);
const hidden=structuredClone(initial);hidden.persistentRuntime.residentLife.appointments.items[0].reason='PRIVATE_CAUSE_SENTINEL';hidden.persistentRuntime.residentLife.appointments.items[0].status='cancelled';
assert.deepEqual(beliefs.projectResidentSocialBeliefs(hidden,hidden.persistentRuntime,waiter,contextSources),before);
assert(!JSON.stringify(before).includes('PRIVATE_CAUSE_SENTINEL'));
checks.push('belief-starts-from-owned-agreement-memory-and-does-not-copy-global-outcome-or-reason');
let multiple=structuredClone(initial),multiEvents=structuredClone(events);const secondPair=['rb-zhou-yan','rb-chen-hui'];
for(const [id,p] of Object.entries(multiple.persistentRuntime.residentLife.people))p.needs.loneliness=0;
for(const id of secondPair){const r=multiple.persistentRuntime,p=r.residentLife.people[id];if(p.activeId)delete r.residentLife.active[p.activeId];p.activeId=null;p.needs={hunger:20,energy:85,loneliness:55};r.agentStates.find(a=>a.npcId===id).locationId='post';multiple.npcs.find(n=>n.id===id).schedule={'00:00':'post'};}
multiple=step(multiple,multiEvents,3);assert.equal(multiple.persistentRuntime.residentLife.appointments.items.length,2);assert.equal(records(multiple).length,4);
beliefs.validateResidentSocialBeliefs(multiple,multiple.persistentRuntime,new Map(multiEvents.map(e=>[e.id,e])));
assert(records(multiple).filter(b=>secondPair.includes(b.npcId)).every(b=>b.appointmentId!==contract.id));
checks.push('multiple-real-conversations-bind-identifier-free-responses-to-the-correct-appointment');

let missed=structuredClone(initial),me=structuredClone(events);missed.persistentRuntime.dailyRoutine.holds[absent]={untilTick:100,reason:'PRIVATE_CAUSE_SENTINEL'};
while(missed.persistentRuntime.tick<65)missed=step(missed,me);
assert.equal(own(missed,waiter).observation,'unfulfilled-observed');assert.equal(own(missed,waiter).peerWasPresent,false);assert.equal(own(missed,absent).observation,'agreed');
const failure=me.find(e=>e.tags.includes('appointment_missed'));assert(!missed.memories.some(m=>m.npcId===absent&&m.eventId===failure.id));
while(missed.persistentRuntime.tick<68)missed=step(missed,me);
assert.equal(own(missed,absent).observation,'self-unfulfilled');const self=me.find(e=>e.tags.includes('self_unfulfilled'));
assert(self.hidden&&self.actorIds.length===1&&self.actorIds[0]===absent);assert(!self.summary.includes('PRIVATE_CAUSE_SENTINEL'));
assert.equal(beliefs.residentSocialCaution(missed.persistentRuntime,waiter,absent),.3);assert.equal(beliefs.residentSocialCaution(missed.persistentRuntime,absent,waiter),0);
checks.push('witness-absence-and-own-missed-clock-are-different-private-observations-with-no-remote-memory');

function arrange(w,third=false){
  const r=w.persistentRuntime;r.residentLife.active={};r.dailyRoutine.journeys={};r.dailyRoutine.holds={};
  for(const npc of w.npcs){const p=r.residentLife.people[npc.id];p.activeId=null;p.needs={hunger:20,energy:80,loneliness:0};}
  for(const id of [...pair,...(third?['rb-jiang-zhi']:[])]){w.npcs.find(n=>n.id===id).schedule={'00:00':'cafe'};r.agentStates.find(a=>a.npcId===id).locationId='cafe';r.residentLife.people[id].needs.loneliness=id===waiter?90:30;}
  const profile=r.socialProfiles.find(p=>p.npcId===waiter);profile.trust[absent]=5;profile.trust['rb-jiang-zhi']=5;
  return w;
}
const caution=arrange(structuredClone(missed),true),amnesiac=structuredClone(caution);
delete amnesiac.persistentRuntime.residentLife.socialBeliefs.records[`${contract.id}:${waiter}`];
const ce=structuredClone(me),ae=structuredClone(me),c=step(caution,ce),a=step(amnesiac,ae);
const partner=w=>Object.values(w.persistentRuntime.residentLife.active).find(a=>a.kind==='socialize'&&a.npcIds.includes(waiter))?.npcIds.find(id=>id!==waiter);
assert.equal(partner(c),'rb-jiang-zhi');assert.equal(partner(a),absent);
checks.push('owned-unresolved-observation-changes-an-actual-peer-choice-with-equal-trust-and-legal-options');

let follow=arrange(structuredClone(missed)),fe=structuredClone(me);follow=step(follow,fe,3);
const account=fe.find(e=>e.tags.includes('social_account'));assert(account);assert(account.tags.includes(`speaker:${absent}`));
assert.equal(own(follow,waiter).observation,'unfulfilled-observed');assert.equal(own(follow,waiter).reports.length,1);assert.equal(own(follow,waiter).reports[0].verification,'unverified');
assert.equal(follow.persistentRuntime.residentLife.appointments.items[0].status,'missed');assert.equal(beliefs.residentSocialCaution(follow.persistentRuntime,waiter,absent),.1);
assert(fe.some(e=>e.tags.includes('life_started')&&e.summary.includes('核对上次约定')));assert(!account.summary.includes('PRIVATE_CAUSE_SENTINEL'));
const fsources=new Map(fe.map(e=>[e.id,e]));beliefs.validateResidentSocialBeliefs(follow,follow.persistentRuntime,fsources);
const dto=beliefs.projectResidentSocialBeliefs(follow,follow.persistentRuntime,waiter,fsources);assert(dto.every(b=>b.peerId!==waiter));assert.equal(dto.find(b=>b.appointmentId===contract.id).accounts[0].verification,'unverified');
const speakerDto=beliefs.projectResidentSocialBeliefs(follow,follow.persistentRuntime,absent,fsources);assert.equal(speakerDto.find(b=>b.appointmentId===contract.id).observation,'self-unfulfilled');
const observerNpc=follow.npcs.find(n=>n.id===waiter),modelOptions=cognition.buildResidentLifeOptions(follow,follow.persistentRuntime,observerNpc,[{id:'rest',kind:'rest',npcIds:[waiter],locationId:'cafe',durationMinutes:15,label:'歇脚',ruleReasons:['合法的单人候选']}],fsources);
const modelContext=cognition.buildResidentLifeContext(follow,follow.persistentRuntime,observerNpc,modelOptions,'rest',fsources);assert.equal(modelContext.policyVersion,'resident-life-policy.v4');assert.deepEqual(modelContext.socialBeliefs,dto);assert(modelContext.socialBeliefs.length<=4);assert(!JSON.stringify(modelContext).includes('PRIVATE_CAUSE_SENTINEL'));
assert(!JSON.stringify(dto).includes('reason'));assert.deepEqual(beliefs.completeResidentFollowup(follow,follow.persistentRuntime,fe.find(e=>e.id===account.causedByEventIds[0])),[]);
checks.push('real-co-present-followup-records-unverified-account-and-eases-caution-without-retroactive-fulfillment');

const forged=structuredClone(follow);own(forged,waiter).reports[0].verification='verified';assert.throws(()=>beliefs.validateResidentSocialBeliefs(forged,forged.persistentRuntime,fsources),/Invalid belief/);
const foreign=structuredClone(follow);own(foreign,absent).observedEventId=failure.id;assert.throws(()=>beliefs.validateResidentSocialBeliefs(foreign,foreign.persistentRuntime,fsources),/Unresolved|Invalid/);
const old=structuredClone(follow);delete old.persistentRuntime.residentLife.socialBeliefs;beliefs.seedResidentSocialBeliefs(old,old.persistentRuntime,fsources);assert.deepEqual(records(old).sort((a,b)=>a.npcId.localeCompare(b.npcId)),records(follow).sort((a,b)=>a.npcId.localeCompare(b.npcId)));
const unknown=structuredClone(initial);delete unknown.persistentRuntime.residentLife.socialBeliefs;unknown.memories=[];beliefs.seedResidentSocialBeliefs(unknown,unknown.persistentRuntime,contextSources);assert.equal(records(unknown).length,0);
checks.push('referee-rejects-false-certainty-and-foreign-experience-and-legacy-reconstruction-requires-owned-memory');

const checkpoint=engine.createTownStateSnapshot(missed,me,{id:'uncertain-promise',label:'Two different personal observations',mode:'checkpoint'});
let one=structuredClone(missed),two=JSON.parse(JSON.stringify(missed)),oe=structuredClone(me),te=structuredClone(me);two.persistentRuntime=engine.normalizePersistentTownRuntime(two,te,two.persistentRuntime);
one=step(one,oe,24);two=step(two,te,24);assert.equal(digest(one,oe),digest(two,te));
const rollback=engine.rollbackTownRuntimeToSnapshot(one,checkpoint);let replay={...rollback.world,persistentRuntime:rollback.runtime},re=structuredClone(me);replay=step(replay,re,24);assert.equal(digest(one,oe),digest(replay,re));
assert.equal(one.persistentRuntime.residentLife.planner.providerBudget.used,0);
checks.push('uncertain-beliefs-survive-normalize-save-checkpoint-and-world-replay-with-zero-model-attempts');
const files=['packages/engine/src/town/resident-social-beliefs.ts','packages/engine/src/town/resident-appointments.ts','packages/engine/src/town/resident-life.ts','packages/engine/src/town/resident-cognition.ts','packages/engine/src/persistent-town.ts','scripts/run-resident-belief-checks.mjs'];
const report={schema:'resident-belief-checks.v1',checkedAt:new Date().toISOString(),passed:true,checks,example:{waiter:own(follow,waiter).observation,absent:own(follow,absent).observation,reportVerification:'unverified',cautionBefore:.3,cautionAfter:.1},sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),limits:['Controlled social scenario and counterfactual belief-record ablation use the real clock; original events and memories remain present. Natural multi-seed evidence is separate.','Accounts are authored acknowledgments, not verified causes, generated dialogue, deception or live LLM reasoning.']};
fs.writeFileSync(`${out}/belief-review.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,groups:checks.length,report:`${out}/belief-review.json`}));
