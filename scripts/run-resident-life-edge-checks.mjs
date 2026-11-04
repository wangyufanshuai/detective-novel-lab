import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createNoirTestLoader} from './noir-player-test-loader.mjs';
const {load}=createNoirTestLoader(process.cwd());
const {createRiverbendWorld}=load('packages/engine/src/riverbend-world.ts');
const {enableTownResidentLife}=load('packages/engine/src/town/resident-life.ts');
const {advancePersistentTownTick,createTownStateSnapshot,rollbackTownRuntimeToSnapshot}=load('packages/engine/src/persistent-town.ts');
const {buildWorldReplayDigest}=load('packages/engine/src/town/replay-contract.ts');
const fixture=()=>{const {world}=createRiverbendWorld({worldId:'life-edge-world',now:'2026-10-30T00:00:00.000Z',seed:'edge'});enableTownResidentLife(world,world.persistentRuntime);return world;};
const digest=(w,e)=>buildWorldReplayDigest(w,e,w.persistentRuntime).combinedDigest;
const step=(world,events,steps=1)=>{const r=advancePersistentTownTick(world,events,{steps,status:'paused'});events.push(...r.events);return {...r.world,persistentRuntime:r.runtime};};
const checks=[];
const out=process.env.RESIDENT_LIFE_REVIEW_DIR??'docs/agent-first-v2';fs.mkdirSync(out,{recursive:true});
let tired=fixture();const id='rb-xu-zhiwei';tired.persistentRuntime.residentLife.people[id].needs.energy=10;const fatigueBefore=JSON.stringify(tired),te=[];
let next=step(tired,te);assert.equal(JSON.stringify(tired),fatigueBefore,'Engine mutated caller input');
assert.equal(next.persistentRuntime.agentStates.find(a=>a.npcId===id).locationId,'house-north-b');
next=step(next,te,12);assert(next.persistentRuntime.residentLife.people[id].needs.energy>25);
assert(te.some(e=>e.actorIds.includes(id)&&e.tags.includes('sleep')&&e.tags.includes('life_completed')));
checks.push('low-energy-replans-home-and-recovers-with-defensive-clone');

let social=fixture();const pair=['rb-bai-lu','rb-cheng-du'];
for(const [npcId,p]of Object.entries(social.persistentRuntime.residentLife.people))p.needs.loneliness=pair.includes(npcId)?60:0;
const beforeTrust=pair.map(id=>social.persistentRuntime.socialProfiles.find(p=>p.npcId===id).trust[pair.find(other=>other!==id)]??5),se=[];
social=step(social,se,3);
const encounter=se.find(e=>e.tags.includes('socialize')&&e.tags.includes('life_completed'));assert(encounter);assert.deepEqual([...encounter.actorIds].sort(),[...pair].sort());
for(const [index,id]of pair.entries()){
  const trust=social.persistentRuntime.socialProfiles.find(p=>p.npcId===id).trust[pair.find(other=>other!==id)];assert(trust>beforeTrust[index]);
  const memory=social.memories.find(m=>m.npcId===id&&m.eventId===encounter.id);assert(memory?.kind==='direct'&&memory.confidence===1);
  assert(social.persistentRuntime.agentStates.find(a=>a.npcId===id).knownFactIds.includes(encounter.id));
}
assert.equal(social.persistentRuntime.residentLife.relationshipChanges.filter(c=>c.eventId===encounter.id).length,2);
checks.push('co-present-conversation-updates-both-trust-and-source-backed-own-memory');

// A participant on an unfinished road edge is not available for conversation.
let transit=fixture();for(const [id,p]of Object.entries(transit.persistentRuntime.residentLife.people))p.needs.loneliness=pair.includes(id)?60:0;
transit.persistentRuntime.dailyRoutine.journeys[pair[1]]={from:'town-square',to:'cafe',remainingMinutes:5,goalLocationId:'cafe'};
const transitEvents=[];transit=step(transit,transitEvents);
assert(!transitEvents.some(e=>e.tags.includes('socialize')&&e.actorIds.includes(pair[0])));
checks.push('in-transit-resident-cannot-join-local-conversation');

let isolated=fixture();const lonely='rb-lin-ali';
for(const [id,p]of Object.entries(isolated.persistentRuntime.residentLife.people)){p.needs.loneliness=id===lonely?99:id==='rb-song-tang'?40:0;p.needs.hunger=20;p.needs.energy=90;}
const isolatedEvents=[];isolated=step(isolated,isolatedEvents,12);
assert(isolatedEvents.some(e=>e.tags.includes('socialize')&&e.tags.includes('life_completed')&&e.actorIds.includes(lonely)),'An isolated resident stayed trapped in work/phase-offset waiting');
assert(isolatedEvents.some(e=>e.tags.includes('road_arrival')&&e.locationId==='cafe'&&e.actorIds.includes(lonely)),'Social urgency did not use actual road travel');
checks.push('social-deprivation-replans-commute-and-waits-for-busy-partner');

const snapshot=createTownStateSnapshot(social,se,{mode:'checkpoint'}),pastLife=JSON.stringify(social.persistentRuntime.residentLife);
const branchEvents=[...se],branch=step(social,branchEvents,12),rolled=rollbackTownRuntimeToSnapshot(branch,snapshot);
assert.equal(JSON.stringify(rolled.runtime.residentLife),pastLife);
const replayEvents=[...se],replayed=step({...rolled.world,persistentRuntime:rolled.runtime},replayEvents,12);
assert.equal(digest(branch,branchEvents),digest(replayed,replayEvents));
checks.push('checkpoint-rollback-preserves-active-plans-needs-memories-and-replay');

const files=['packages/engine/src/town/resident-life.ts','packages/engine/src/town/snapshots.ts','packages/engine/src/persistent-town.ts','scripts/run-resident-life-edge-checks.mjs'];
fs.writeFileSync(`${out}/edge-review.json`,JSON.stringify({schema:'resident-life-edge-checks.v1',checkedAt:new Date().toISOString(),passed:true,checks,
  sources:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]))},null,2)+'\n');console.log(JSON.stringify({passed:true,groups:checks.length}));
