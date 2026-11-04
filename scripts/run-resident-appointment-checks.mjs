import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createNoirTestLoader} from './noir-player-test-loader.mjs';
const out=process.env.RESIDENT_APPOINTMENT_REVIEW_DIR??'docs/agent-first-v6';fs.mkdirSync(out,{recursive:true});
const {load}=createNoirTestLoader(process.cwd()),{createRiverbendWorld}=load('packages/engine/src/riverbend-world.ts');
const life=load('packages/engine/src/town/resident-life.ts'),appointments=load('packages/engine/src/town/resident-appointments.ts');
const engine=load('packages/engine/src/persistent-town.ts'),{buildWorldReplayDigest}=load('packages/engine/src/town/replay-contract.ts');
const pair=['rb-bai-lu','rb-cheng-du'],checks=[];
const step=(world,events,steps=1)=>{const r=engine.advancePersistentTownTick(world,events,{steps,status:'paused',cloneInput:false});events.push(...r.events);return {...r.world,persistentRuntime:r.runtime};};
function fixture(){const {world}=createRiverbendWorld({worldId:'appointment-check',seed:'appointment-check',now:'2026-11-02T00:00:00.000Z'});life.enableTownResidentLife(world,world.persistentRuntime);life.setResidentLifePlannerMode(world.persistentRuntime,'offline-agent');
  for(const npc of world.npcs){world.persistentRuntime.residentLife.people[npc.id].needs={hunger:20,energy:85,loneliness:0};if(pair.includes(npc.id)){npc.schedule={'00:00':'town-square'};world.persistentRuntime.agentStates.find(a=>a.npcId===npc.id).locationId='town-square';world.persistentRuntime.residentLife.people[npc.id].needs.loneliness=55;}}
  return world;
}
const digest=(w,e)=>buildWorldReplayDigest(w,e,w.persistentRuntime).combinedDigest;
let initial=fixture(),events=[];initial=step(initial,events,3);
const contract=initial.persistentRuntime.residentLife.appointments?.items[0];assert(contract&&contract.status==='accepted');
const origin=events.find(e=>e.id===contract.sourceEventIds[0]);assert(origin.tags.includes('life_completed')&&origin.tags.includes('socialize'));
const proposed=events.find(e=>e.tags.includes('appointment_proposed')),accepted=events.find(e=>e.tags.includes('appointment_accepted'));assert(proposed&&accepted);
assert.equal(proposed.locationId,'town-square');assert.equal(accepted.locationId,'town-square');assert.equal(contract.locationId,'cafe');assert.equal(contract.meetMinute,780);
assert(proposed.causedByEventIds.includes(origin.id)&&accepted.causedByEventIds.includes(proposed.id));
assert.deepEqual(appointments.proposeResidentAppointment(initial,initial.persistentRuntime,origin,new Map(events.map(e=>[e.id,e]))),[]);
checks.push('actual-completed-conversation-creates-distinct-proposal-response-and-future-place-with-no-duplicate');

const sources=new Map(events.map(e=>[e.id,e]));
appointments.validateResidentAppointments(initial,initial.persistentRuntime,sources);
const poisoned=structuredClone(initial);poisoned.persistentRuntime.residentLife.appointments.items[0].sourceEventIds.push('forged-source');assert.throws(()=>appointments.validateResidentAppointments(poisoned,poisoned.persistentRuntime,sources),/Unresolved/);
const foreign=structuredClone(initial);foreign.persistentRuntime.residentLife.appointments.items[0].worldId='other-world';assert.throws(()=>appointments.validateResidentAppointments(foreign,foreign.persistentRuntime,sources),/Invalid appointment context/);
const forged=structuredClone(initial);delete forged.persistentRuntime.residentLife.appointments;
assert.deepEqual(appointments.proposeResidentAppointment(forged,forged.persistentRuntime,{...origin,summary:'forged'},sources),[]);
assert.deepEqual(appointments.proposeResidentAppointment(forged,forged.persistentRuntime,origin,new Map()),[]);
const unfit=structuredClone(forged);unfit.persistentRuntime.residentLife.people[origin.actorIds[1]].needs.energy=10;
const refusal=appointments.proposeResidentAppointment(unfit,unfit.persistentRuntime,origin,sources);assert.equal(refusal[1].tags.includes('appointment_declined'),true);assert.equal(unfit.persistentRuntime.residentLife.appointments.items[0].reason,'needs-first');
const unreachable=structuredClone(forged),rt=unreachable.persistentRuntime,map=rt.mapPacks.find(m=>m.manifest.id===rt.dailyRoutine.mapId);map.connections=map.connections.filter(e=>e.from!=='cafe'&&e.to!=='cafe');
appointments.proposeResidentAppointment(unreachable,rt,origin,sources);assert.equal(rt.residentLife.appointments.items[0].reason,'unreachable-in-window');
const beyond=structuredClone(forged);beyond.persistentRuntime.residentLife.endTick=beyond.persistentRuntime.tick+6;assert.deepEqual(appointments.proposeResidentAppointment(beyond,beyond.persistentRuntime,origin,sources),[]);
const hiddenLoss=structuredClone(initial);hiddenLoss.npcs.find(n=>n.id===contract.npcIds[1]).alive=false;
assert.deepEqual(appointments.expireResidentAppointments(hiddenLoss,hiddenLoss.persistentRuntime),[]);assert.equal(hiddenLoss.persistentRuntime.residentLife.appointments.items[0].status,'accepted');
checks.push('referee-refuses-forged-or-missing-origin-and-declines-needs-unreachable-or-out-of-horizon-plans');

let fulfilled=structuredClone(initial),fe=structuredClone(events);
// Accepted promises survive an explicit switch back to the original schedule.
life.setResidentLifePlannerMode(fulfilled.persistentRuntime,'rules');
while(fulfilled.persistentRuntime.tick<67)fulfilled=step(fulfilled,fe);
const completed=fulfilled.persistentRuntime.residentLife.appointments.items[0];assert.equal(completed.status,'completed');
const source=fe.find(e=>e.id===completed.completionEventId);assert(source.tags.includes('life_completed')&&source.tags.includes('appointment_meeting'));assert.equal(source.time,'13:15');
assert.equal(fulfilled.persistentRuntime.residentLife.appointments.items.length,1,'A completed appointment recursively created another');
assert(fe.some(e=>e.tags.includes('road_arrival')&&pair.some(id=>e.actorIds.includes(id))&&e.locationId==='cafe'));
for(const id of pair)assert(fulfilled.memories.some(m=>m.npcId===id&&m.eventId===source.id));
assert.equal(appointments.finishResidentAppointment(fulfilled.persistentRuntime,completed.id,completed.actionId,source,true),false);
checks.push('accepted-promise-reroutes-along-real-roads-and-completes-one-joint-quarter-hour-even-after-mode-switch');

let missed=structuredClone(initial),me=structuredClone(events);const absent=contract.npcIds[1],waiter=contract.npcIds[0];
missed.persistentRuntime.dailyRoutine.holds[absent]={untilTick:100,reason:'An explicit conflicting appointment'};
while(missed.persistentRuntime.tick<66)missed=step(missed,me);
const noShow=missed.persistentRuntime.residentLife.appointments.items[0];assert.equal(noShow.status,'missed');
const expired=me.find(e=>e.tags.includes('appointment_missed'));assert(expired&&expired.actorIds.includes(waiter)&&!expired.actorIds.includes(absent));
assert(!missed.memories.some(m=>m.npcId===absent&&m.eventId===expired.id));assert(missed.memories.some(m=>m.npcId===waiter&&m.eventId===expired.id));
assert.deepEqual(appointments.expireResidentAppointments(missed,missed.persistentRuntime),[]);assert(!noShow.completionEventId);
checks.push('no-show-expires-once-without-ghost-completion-or-absent-person-memory');

let interrupted=structuredClone(initial),ie=structuredClone(events);while(interrupted.persistentRuntime.tick<61)interrupted=step(interrupted,ie);
const running=interrupted.persistentRuntime.residentLife.appointments.items[0];assert.equal(running.status,'running');
const count=interrupted.persistentRuntime.residentLife.people[pair[0]].completed.socialize;
interrupted.persistentRuntime.dailyRoutine.holds[pair[0]]={untilTick:62,reason:'Player questions resident'};interrupted=step(interrupted,ie);
assert.equal(interrupted.persistentRuntime.residentLife.appointments.items[0].status,'cancelled');assert.equal(interrupted.persistentRuntime.residentLife.people[pair[0]].completed.socialize,count);
assert(ie.some(e=>e.tags.includes('appointment_meeting')&&e.tags.includes('life_interrupted')));
checks.push('questioning-interrupts-joint-meeting-without-goal-completion-or-fulfilled-receipt');

const checkpoint=engine.createTownStateSnapshot(initial,events,{id:'accepted-promise',label:'Accepted future appointment',mode:'checkpoint'});
const restored=JSON.parse(JSON.stringify(initial));restored.persistentRuntime=engine.normalizePersistentTownRuntime(restored,events,restored.persistentRuntime);
let a=structuredClone(initial),b=restored,ae=structuredClone(events),be=structuredClone(events);
for(let i=0;i<64;i++){a=step(a,ae);b=step(b,be);}assert.equal(digest(a,ae),digest(b,be));
const rolled=engine.rollbackTownRuntimeToSnapshot(a,checkpoint);let replay={...rolled.world,persistentRuntime:rolled.runtime},re=structuredClone(events);for(let i=0;i<64;i++)replay=step(replay,re);
assert.equal(digest(a,ae),digest(replay,re));
for(const c of a.persistentRuntime.residentLife.appointments.items)for(const id of c.sourceEventIds)assert(ae.some(e=>e.id===id));
assert.equal(a.persistentRuntime.residentLife.planner.providerBudget.used,0);
checks.push('accepted-promise-save-restore-checkpoint-rollback-and-full-outcome-replay-match-without-models');
const files=['packages/engine/src/town/resident-appointments.ts','packages/engine/src/town/resident-life.ts','packages/engine/src/town/daily-routine.ts','packages/engine/src/town/resident-agenda.ts','packages/engine/src/persistent-town.ts','scripts/run-resident-appointment-checks.mjs'];
const report={schema:'resident-appointment-checks.v1',checkedAt:new Date().toISOString(),passed:true,checks,example:{meetTime:'13:00',completedAt:source.time,roadTravel:true,sourceEventIds:completed.sourceEventIds},sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),limits:['Invitation and response are deterministic policies, not live LLM reasoning.','Refusal and no-show causes are private; no automatic case evidence, accusation or reputation penalty.','Short lifecycle and replay tests; multi-seed three-day evidence is separate.']};
fs.writeFileSync(`${out}/appointment-review.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,groups:checks.length,report:`${out}/appointment-review.json`}));
