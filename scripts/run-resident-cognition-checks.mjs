import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createNoirTestLoader } from './noir-player-test-loader.mjs';

const root=process.cwd(),out=process.env.RESIDENT_COGNITION_REVIEW_DIR??'docs/agent-first-v3';fs.mkdirSync(out,{recursive:true});
const {load}=createNoirTestLoader(root);
const {createRiverbendWorld}=load('packages/engine/src/riverbend-world.ts');
const cognition=load('packages/engine/src/town/resident-cognition.ts');
const life=load('packages/engine/src/town/resident-life.ts');
const {advancePersistentTownTick}=load('packages/engine/src/persistent-town.ts');
const {buildWorldReplayDigest}=load('packages/engine/src/town/replay-contract.ts');
const checks=[];
const make=(seed='cognition-check')=>{const {world}=createRiverbendWorld({worldId:'cognition-check-world',seed,now:'2026-10-30T00:00:00.000Z'});life.enableTownResidentLife(world,world.persistentRuntime);return world;};
const npc=world=>world.npcs.find(p=>p.id==='rb-lin-ali');
const options=(world,runtime,events)=>cognition.buildResidentLifeOptions(world,runtime,npc(world),[
  {id:'rest',kind:'rest',npcIds:['rb-lin-ali'],locationId:'inn',durationMinutes:30,label:'歇脚',ruleReasons:['低压力恢复']},
  {id:'occupation',kind:'occupation',npcIds:['rb-lin-ali'],locationId:'inn',durationMinutes:30,label:'整理登记簿',ruleReasons:['公开日程']}
],events);

const world=make(),runtime=world.persistentRuntime;
world.memories.push({id:'memory-owned-1',worldId:world.id,npcId:'rb-lin-ali',kind:'direct',eventId:'event-owned-1',day:1,summary:'旅馆老板记得一只未登记的行李箱。',confidence:.9,visibleToPlayer:false,challengeableEvidenceIds:[]});
world.memories.push({id:'memory-private-other',worldId:world.id,npcId:'rb-xu-zhiwei',kind:'secret',eventId:'event-other',day:1,summary:'PRIVATE_SENTINEL',confidence:1,visibleToPlayer:false,challengeableEvidenceIds:[]});
const sources=new Map([['event-owned-1',{id:'event-owned-1',worldId:world.id,day:1,time:'07:55',actorIds:['rb-lin-ali'],locationId:'inn',tags:['resident_life','occupation','life_completed'] }]]);
const hits=cognition.retrieveResidentMemories(world,runtime,'rb-lin-ali',{limit:6,events:sources});assert(hits.some(h=>h.memoryId==='memory-owned-1'));assert(hits.every(h=>h.npcId==='rb-lin-ali'&&!h.summary.includes('PRIVATE_SENTINEL')));assert.equal(hits[0].sourceRef,'memory:memory-owned-1');
checks.push('retrieval-is-private-bounded-and-source-labeled');

const candidates=options(world,runtime,sources),rule=cognition.proposeResidentLifeOption(world,runtime,npc(world),{hunger:40,energy:80,loneliness:30},candidates,'occupation',sources);
assert.equal(rule.proposal.mode,'rules');assert.equal(rule.option.id,'occupation');assert(rule.proposal.sourceRefs.some(ref=>ref.startsWith('life-policy:')));assert(rule.proposal.sourceRefs.every(ref=>ref.startsWith('life-policy:')||ref.startsWith('memory:')));
checks.push('rules-proposal-is-exact-candidate-and-carries-policy-memory-sources');

const offlineWorld=make(),offlineRuntime=offlineWorld.persistentRuntime;
offlineRuntime.residentLife.planner.mode='offline-agent';offlineRuntime.residentLife.planner.modelBudget={limit:1,used:0};
const offlineOptions=options(offlineWorld,offlineRuntime);
const agent=cognition.proposeResidentLifeOption(offlineWorld,offlineRuntime,npc(offlineWorld),{hunger:40,energy:80,loneliness:30},offlineOptions,'rest');
assert.equal(agent.proposal.mode,'offline-agent');assert.equal(offlineRuntime.residentLife.planner.modelBudget.used,1);assert(agent.option.id==='rest'||agent.option.id==='occupation');
const fallback=cognition.proposeResidentLifeOption(offlineWorld,offlineRuntime,npc(offlineWorld),{hunger:40,energy:80,loneliness:30},offlineOptions,'rest');
assert.equal(fallback.option.id,'rest');assert.equal(offlineRuntime.residentLife.planner.modelBudget.used,1);
checks.push('offline-agent-exhaustion-falls-back-to-rule-choice-without-another-attempt');

const forged={...rule.proposal,sourceRefs:['life-policy:forged']};assert.throws(()=>cognition.admitResidentLifeProposal(world,runtime,forged,candidates,sources),error=>error.code==='UNKNOWN_SOURCE');
const fakeMemory={...rule.proposal,sourceRefs:[rule.proposal.sourceRefs.find(ref=>ref.startsWith('life-policy:')), 'memory:forged-memory']};assert.throws(()=>cognition.admitResidentLifeProposal(world,runtime,fakeMemory,candidates,sources),error=>error.code==='UNKNOWN_SOURCE');
const stale={...rule.proposal,tick:rule.proposal.tick+1};assert.throws(()=>cognition.admitResidentLifeProposal(world,runtime,stale,candidates),error=>error.code==='STALE_CONTEXT');
const illegal={...rule.proposal,candidateId:'invent-truth'};assert.throws(()=>cognition.admitResidentLifeProposal(world,runtime,illegal,candidates),error=>error.code==='ILLEGAL_CANDIDATE');
checks.push('referee-rejects-forged-stale-and-illegal-proposals-without-writing');

function run(seed,mode){let w=make(seed);w.persistentRuntime.residentLife.planner.mode=mode;const events=[];for(let i=0;i<24;i++){const r=advancePersistentTownTick(w,events,{steps:1,status:'paused',cloneInput:false});events.push(...r.events);w.persistentRuntime=r.runtime;w=r.world;}return {digest:buildWorldReplayDigest(w,events,w.persistentRuntime).combinedDigest,world:w,events};}
const rulesA=run('cognition-replay','rules'),rulesB=run('cognition-replay','rules');assert.equal(rulesA.digest,rulesB.digest);
const agentA=run('cognition-replay','offline-agent'),agentB=run('cognition-replay','offline-agent');assert.equal(agentA.digest,agentB.digest);assert.notEqual(agentA.digest,rulesA.digest,'Planner mode did not affect bounded proposal replay');
assert(agentA.world.persistentRuntime.residentLife.planner.proposals.length>0);assert(agentA.world.persistentRuntime.residentLife.planner.modelBudget.used<=48);assert(agentA.world.persistentRuntime.residentLife.planner.proposals.every(p=>p.sourceRefs.some(ref=>ref.startsWith('life-policy:'))));
checks.push('rules-and-offline-agent-modes-are-deterministic-and-replay-distinct');

const files=['packages/engine/src/town/resident-cognition.ts','packages/engine/src/town/resident-life.ts','packages/engine/src/town/replay-contract.ts','packages/engine/src/persistent-town.ts','scripts/run-resident-cognition-checks.mjs'];
const report={schema:'resident-cognition-checks.v1',checkedAt:new Date().toISOString(),passed:true,checks,
  modes:{rules:{digest:rulesA.digest,proposals:rulesA.world.persistentRuntime.residentLife.planner.proposals.length},offlineAgent:{digest:agentA.digest,proposals:agentA.world.persistentRuntime.residentLife.planner.proposals.length,modelCalls:0,budgetUsed:agentA.world.persistentRuntime.residentLife.planner.modelBudget.used}},
  sources:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),
  limits:['Offline-agent mode is deterministic local candidate scoring, not a live LLM call.','No proposal is exposed as player truth; action admission remains bounded to server-built candidates.','This is a 24-tick comparison, not a three-day quality gate or case fairness result.']};
fs.writeFileSync(`${out}/cognition-review.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,groups:checks.length,report:`${out}/cognition-review.json`}));
