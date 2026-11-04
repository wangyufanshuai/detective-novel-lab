import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createNoirTestLoader} from './noir-player-test-loader.mjs';
import {residentLifeQuality} from './lib/resident-life-quality.mjs';

const root=process.cwd(),out=process.env.RESIDENT_LIFE_REVIEW_DIR??'docs/agent-first-v2';fs.mkdirSync(out,{recursive:true});
const {load}=createNoirTestLoader(root),{createRiverbendWorld}=load('packages/engine/src/riverbend-world.ts');
const life=load('packages/engine/src/town/resident-life.ts');
const {advancePersistentTownTick,createTownStateSnapshot,rollbackTownRuntimeToSnapshot,normalizePersistentTownRuntime}=load('packages/engine/src/persistent-town.ts');
const {buildWorldReplayDigest}=load('packages/engine/src/town/replay-contract.ts');
const checks=[],seedRuns=[];
const mode=process.env.RESIDENT_LIFE_PLANNER_MODE??'rules';assert(['rules','offline-agent'].includes(mode));
const fixture=(seed,now='2026-10-30T00:00:00.000Z')=>createRiverbendWorld({worldId:'life-check-world',seed,now}).world;
function advance(world,events,steps){if(world.persistentRuntime.residentLife&&world.persistentRuntime.residentLife.planner.mode!==mode)life.setResidentLifePlannerMode(world.persistentRuntime,mode);const r=advancePersistentTownTick(world,events,{steps,status:'paused',cloneInput:false});world=r.world;world.persistentRuntime=r.runtime;events.push(...r.events);return world;}
function digest(world,events){return buildWorldReplayDigest(world,events,world.persistentRuntime).combinedDigest;}
function assertSources(world,events){
  const index=new Map(events.map(e=>[e.id,e]));assert.equal(index.size,events.length,'duplicate event IDs');
  for(const m of world.memories){const e=index.get(m.eventId);assert(e,`missing memory source ${m.id}`);assert(e.actorIds.includes(m.npcId),`unwitnessed direct memory ${m.id}`);}
  for(const e of events)for(const cause of e.causedByEventIds??[])assert(index.has(cause),`missing cause ${cause}`);
  for(const change of world.persistentRuntime.residentLife.relationshipChanges){const e=index.get(change.eventId);assert(e?.tags.includes('life_completed')&&e.tags.includes('socialize'));assert(e.actorIds.includes(change.from)&&e.actorIds.includes(change.to));assert(change.after>=change.before&&change.after<=10);}
}

const legacy=fixture('legacy');assert(!legacy.persistentRuntime.residentLife&&legacy.persistentRuntime.maxTicks===288);
const normalized=normalizePersistentTownRuntime(legacy,[],legacy.persistentRuntime);assert(!normalized.residentLife);
const upgraded=life.enableTownResidentLife(legacy,legacy.persistentRuntime);assert.equal(upgraded.endTick,864);
assert.equal(life.enableTownResidentLife(legacy,legacy.persistentRuntime),upgraded);assert.equal(legacy.persistentRuntime.maxTicks,864);
checks.push('explicit-idempotent-policy-opt-in-and-legacy-read-preservation');

// Needs alter the real commute, with the current road edge still paid in full.
let hungry=fixture('hungry');life.enableTownResidentLife(hungry,hungry.persistentRuntime);
const id='rb-xu-zhiwei';hungry.persistentRuntime.residentLife.people[id].needs.hunger=85;
const hungryEvents=[];hungry=advance(hungry,hungryEvents,1);
assert.equal(hungry.persistentRuntime.agentStates.find(a=>a.npcId===id).locationId,'cafe');
assert(!hungry.persistentRuntime.residentWork.active[id],'Specialist worked while going for a meal');
hungry=advance(hungry,hungryEvents,4);assert(hungry.persistentRuntime.residentLife.people[id].needs.hunger<45);
assert(hungryEvents.some(e=>e.actorIds.includes(id)&&e.tags.includes('eat')&&e.tags.includes('life_completed')));
assert.throws(()=>life.finishResidentLifeInterval(hungry,hungry.persistentRuntime),/stale|already/);
checks.push('hunger-replans-road-travel-meal-and-no-double-specialist-work');

// A genuine external appointment interrupts a local activity rather than
// manufacturing a social outcome or direct memory from absent participants.
let interrupted=fixture('interrupt');life.enableTownResidentLife(interrupted,interrupted.persistentRuntime);
const interruptionEvents=[];interrupted=advance(interrupted,interruptionEvents,1);
const active=Object.values(interrupted.persistentRuntime.residentLife.active)[0];assert(active);
interrupted.persistentRuntime.dailyRoutine.holds[active.npcIds[0]]={untilTick:2,reason:'External appointment'};
interrupted=advance(interrupted,interruptionEvents,1);
assert(interruptionEvents.some(e=>e.id===`${active.id}-interrupted`));
checks.push('external-hold-interrupts-activity-without-fabricating-completion');

const seedList=(process.env.RESIDENT_LIFE_SEEDS??'river-life-01,river-life-02,river-life-03,river-life-04,river-life-05').split(',').map(seed=>seed.trim()).filter(Boolean);
for(const seed of seedList){
  const started=performance.now();let world=fixture(seed);life.enableTownResidentLife(world,world.persistentRuntime);
  const events=[],timings=[];let restored,restoreEvents;
  for(let tick=0;tick<864;tick+=12){
    const at=performance.now();world=advance(world,events,12);timings.push((performance.now()-at)/12);
    if(world.persistentRuntime.tick===432){
      restored=JSON.parse(JSON.stringify(world));restoreEvents=JSON.parse(JSON.stringify(events));
      restored.persistentRuntime=normalizePersistentTownRuntime(restored,restoreEvents,restored.persistentRuntime);
    }else if(world.persistentRuntime.tick>432)restored=advance(restored,restoreEvents,12);
    if(world.persistentRuntime.tick%144===0)console.log(JSON.stringify({seed,phase:'primary-with-restore',tick:world.persistentRuntime.tick,events:events.length}));
  }
  const rt=world.persistentRuntime;assert.equal(rt.tick,864);assert.equal(rt.currentDay,4);assert.equal(rt.currentTime,'08:00');
  assert.equal(digest(world,events),digest(restored,restoreEvents),'Mid-run durable restore changed outcome');
  const final=digest(world,events);assertSources(world,events);
  const residents=world.npcs.map(npc=>{
    const p=rt.residentLife.people[npc.id];
    for(const n of Object.values(p.needs))assert(Number.isFinite(n)&&n>=0&&n<=100);
    assert(p.completed.eat>=3&&p.completed.sleep>=6,`${npc.id} lacks sustained meals/sleep: ${JSON.stringify(p.completed)}`);
    assert(p.completed.socialize>=1,`${npc.id} has no relationship encounter`);
    assert(world.memories.filter(m=>m.npcId===npc.id).length>=10);
    return{id:npc.id,role:npc.role,needs:p.needs,completed:p.completed,memoryCount:world.memories.filter(m=>m.npcId===npc.id).length};
  });
  for(const [id,station] of Object.entries(rt.residentWork.stations)){assert(station.completed>=12,'Daily specialist supply was not worked');const deliveries=events.filter(e=>e.tags.includes('daily_delivery')&&e.actorIds.includes(id));assert.equal(deliveries.length,2,'The half-open 08:00-to-08:00 window should deliver on day 2 and 3');assert.equal(station.pending+station.reserved+station.completed,6*(1+deliveries.length),'Work material conservation failed');}
  assert.equal(rt.residentWork.modelBudget.used,0);
  // A separate run begins from the seed with different wall-clock metadata.
  let replay=fixture(seed,'2026-11-01T00:00:00.000Z'),replayEvents=[];life.enableTownResidentLife(replay,replay.persistentRuntime);
  for(let tick=0;tick<864;tick+=12)replay=advance(replay,replayEvents,12);
  assert.equal(digest(replay,replayEvents),final,'Same seed/input changed canonical replay');
  const sorted=[...timings].sort((a,b)=>a-b);
  const result={seed,ticks:864,elapsedGameMinutes:4320,digest:final,replayDigest:digest(replay,replayEvents),restoredDigest:digest(restored,restoreEvents),
    eventCount:events.length,memoryCount:world.memories.length,actionMix:Object.fromEntries(['eat','sleep','rest','socialize','occupation'].map(kind=>[kind,events.filter(e=>e.tags.includes(kind)&&e.tags.includes('life_completed')).length])),
    residents,specialistCompleted:Object.fromEntries(Object.entries(rt.residentWork.stations).map(([id,s])=>[id,s.completed])),relationshipChanges:rt.residentLife.relationshipChanges.length,
    measuredBatchAverageTickP95Ms:sorted[Math.floor(sorted.length*.95)],runAndReplayMs:performance.now()-started,modelCalls:0,quality:residentLifeQuality(world,events)};
  seedRuns.push(result);console.log(JSON.stringify({seed,passed:true,digest:final,events:events.length,ms:Math.round(result.runAndReplayMs)}));
}
assert(new Set(seedRuns.map(r=>r.digest)).size===seedList.length,'Seeds did not change simulation');
checks.push('five-seeds-72-hours-12-residents-full-replay-and-midrun-restore','every-resident-meals-sleep-social-memory-and-bounded-needs','daily-work-material-conservation','source-backed-direct-memory-causal-events-and-trust','no-model-offline-loop-and-cross-seed-divergence');
const files=['packages/engine/src/town/resident-social-beliefs.ts','packages/engine/src/town/resident-appointments.ts','packages/engine/src/town/resident-agenda.ts','packages/engine/src/town/resident-cognition.ts','packages/engine/src/town/resident-life.ts','packages/engine/src/town/resident-work.ts','packages/engine/src/town/daily-routine.ts','packages/engine/src/persistent-town.ts','packages/engine/src/riverbend-world.ts','packages/engine/src/town/replay-contract.ts','scripts/run-resident-life-checks.mjs','scripts/lib/resident-life-quality.mjs'];
const report={schema:'resident-life-review.v1',checkedAt:new Date().toISOString(),passed:true,mode,checks,seedRuns,
  sources:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')])),
  limits:['Rule or deterministic goal-scoring policy as labelled; no live LLM or model quality comparison.','Measurements are isolated 12-resident engine runs, not 24/100-resident or browser performance.','Proposal quality measures cover the retained last-512 ledger; completion measures cover the whole window.','Direct memories and trust cite real encounters; no case fairness or novel export acceptance.']};
fs.writeFileSync(`${out}/life-review.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,groups:checks.length,seeds:seedRuns.length,report:`${out}/life-review.json`}));
