import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { NextRequest } from "next/server.js";
import { createNoirTestLoader } from "./noir-player-test-loader.mjs";

const root=process.cwd(), run=fs.mkdtempSync(path.join(root,"outputs","agent-first-"));
process.env.DATABASE_URL=path.join(run,"isolated.db");
const {load}=createNoirTestLoader(root), checks=[];
const {GET,POST}=load("app/api/v1/town-play/agent-first/route.ts");
const {worldRepository:repo,getDb,closeDatabase}=load("lib/world/repository.ts");
const {withPrivateWorldAccess:access}=load("lib/world/private-world-access.ts");
const {createRiverbendWorld}=load("packages/engine/src/riverbend-world.ts");
const {buildWorldReplayDigest}=load("packages/engine/src/town/replay-contract.ts");
const {projectExplorationObservation}=load("packages/engine/src/town/agent-observation.ts");
const {enableTownResidentWork,prepareResidentWorkDecision,residentWorkDecisionId}=load("packages/engine/src/town/resident-work.ts");
const {admitResidentIntent}=load("packages/engine/src/town/agent-intent.ts");
const {advancePersistentTownTick}=load("packages/engine/src/persistent-town.ts");
const {validateCaseStoryLink}=load("packages/engine/src/town/case-bridge.ts");
const navigation=load("app/town-play/agent-first/agent-first-map.ts");
const origin="http://localhost:3187",url=origin+"/api/v1/town-play/agent-first";
const check=name=>checks.push(name);
const send=async(body,cookie,from=origin)=>{const response=await POST(new NextRequest(url,{method:"POST",headers:{"Content-Type":"application/json",Origin:from,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)}));return {status:response.status,headers:response.headers,value:await response.json()};};
const read=async cookie=>{const response=await GET(new NextRequest(url,{headers:cookie?{Cookie:cookie}:{}}));return {status:response.status,value:await response.json()};};
try {
  const initial=await send({kind:"start"});assert.equal(initial.status,200,JSON.stringify(initial.value));
  const cookie=initial.headers.get("set-cookie").split(";")[0];let view=initial.value.data.observation;
  assert.equal(view.places.length,5);assert.equal(view.simulation.modelCalls,0);assert.equal(view.sceneId,"town-square");
  const worldId=view.worldId;
  const snapshot=()=>access(worldId,()=>JSON.stringify({world:repo.getWorld(worldId),events:repo.getEvents(worldId),session:getDb().prepare("select data from town_exploration_sessions where world_id=?").get(worldId)}));
  const intent=(action,id)=>({schema:"agent-first-intent.v1",actionId:id,expectedSessionRevision:view.revision,expectedWorldRevision:view.worldRevision,sourceRefs:[view.sourceRef],reason:"contract check",action});
  const first=intent({kind:"arrive",sceneId:"cafe"},"first-cafe"),before=snapshot();
  const changes=getDb().prepare("select total_changes() as n").get().n;
  assert.equal((await send({kind:"propose",intent:first},cookie)).value.data.proposal.mutates,false);
  assert.equal(snapshot(),before);assert.equal(getDb().prepare("select total_changes() as n").get().n,changes);
  check("proposal-and-get-are-read-only");
  const arrived=await send({kind:"commit",intent:first},cookie);assert.equal(arrived.status,200,JSON.stringify(arrived.value));view=arrived.value.data.observation;
  assert.equal(view.sceneId,"cafe");assert.equal(view.time,"08:05");assert(view.residents.some(p=>p.visibility==="observed"));
  assert.equal((await send({kind:"commit",intent:first},cookie)).value.data.replayed,true);
  assert.equal((await read(cookie)).value.data.observation.time,"08:05");
  check("real-engine-travel-and-durable-identical-retry");
  for(const [patch,code]of [[{sourceRefs:[]},"MISSING_SOURCE"],[{sourceRefs:["observation:other"]},"UNKNOWN_SOURCE"],[{expectedWorldRevision:999},"STATE_CHANGED"],[{truth:{culpritId:"x"}},"FORBIDDEN_FIELD"],[{action:{kind:"arrive",sceneId:"house-east"}},"PLACE_CLOSED"],[{action:{kind:"wait",minutes:0}},"BAD_INTENT"]]){
    const rejected=await send({kind:"commit",intent:{...intent({kind:"wait",minutes:15},`bad-${code}`),...patch}},cookie);
    assert.equal(rejected.value.error.code,code);assert.equal(rejected.value.error.schema,"agent-first-refusal.v1");
  }
  const reused=await send({kind:"commit",intent:{...first,reason:"different action"}},cookie);assert.equal(reused.value.error.code,"ACTION_REUSED");
  assert.equal((await send({kind:"commit",intent:intent({kind:"wait",minutes:15},"cross-site")},cookie,"https://other.invalid")).status,403);
  const foreign=await send({kind:"start"});const otherCookie=foreign.headers.get("set-cookie").split(";")[0];
  assert.equal((await send({kind:"commit",intent:first},otherCookie)).value.error.code,"UNKNOWN_SOURCE");
  assert.equal((await read(cookie.slice(0,-64)+"0".repeat(64))).status,401);
  check("strict-fields-sources-CAS-reuse-origin-and-session-refusals");
  const safe=JSON.stringify(view);
  for(const field of ["secret","motiveSeed","schedule","dailyRoutine","agentStates","truth","sourceEventIds","decisionTraces","owner_hash"])assert(!safe.includes(`"${field}"`),field);
  const raw=access(worldId,()=>repo.getWorld(worldId));const poisoned=structuredClone(raw);poisoned.npcs.forEach(p=>{p.secret="SENTINEL_PRIVATE";p.motiveSeed="SENTINEL_PRIVATE";});
  const {townExplorationPlayerView}=load("packages/engine/src/town-exploration.ts");
  const saved=JSON.parse(getDb().prepare("select data from town_exploration_sessions where world_id=?").get(worldId).data);
  assert.deepEqual(projectExplorationObservation(townExplorationPlayerView(poisoned,saved.binding,saved.state,poisoned.persistentRuntime)),view);
  assert.equal(repo.getWorld(worldId),null);
  check("public-whitelist-and-hidden-state-noninterference");
  const current=snapshot();const wait=intent({kind:"wait",minutes:15},"atomic-wait");
  getDb().exec("create trigger fail_agent_receipt before insert on agent_first_receipts begin select raise(abort, 'intentional receipt failure'); end;");
  assert.equal((await send({kind:"commit",intent:wait},cookie)).status,500);assert.equal(snapshot(),current);
  getDb().exec("drop trigger fail_agent_receipt;");
  assert.equal((await send({kind:"commit",intent:wait},cookie)).status,200);
  const persisted=(await read(cookie)).value.data.observation;
  closeDatabase();assert.deepEqual((await read(cookie)).value.data.observation,persisted);
  assert.equal((await send({kind:"commit",intent:wait},cookie)).value.data.replayed,true);
  check("receipt-failure-atomic-rollback-save-reopen-and-retry");

  // An offline proposal changes real work behaviour: choose rest while work is available.
  function replay(now) {
    const {world}=createRiverbendWorld({worldId:"agent-first-replay",now});enableTownResidentWork(world,world.persistentRuntime);
    const context=prepareResidentWorkDecision(world,world.persistentRuntime,"rb-xu-zhiwei");assert(context);
    const id=residentWorkDecisionId(context),proposal={schema:"resident-intent.v1",actionId:id,sourceRefs:[`observation:${id}`],reason:"休息后再处理旧书",context,choice:{candidateId:"rest",source:"offline"}};
    assert.throws(()=>admitResidentIntent(world,world.persistentRuntime,{...proposal,sourceRefs:[]}),/来源/);
    const rejected=error=>error.code==="RESIDENT_REFUSED"&&error.schema==="agent-first-refusal.v1";
    const beforeRejected=JSON.stringify(world);
    assert.throws(()=>admitResidentIntent(world,world.persistentRuntime,{...proposal,choice:{candidateId:"invent-truth",source:"offline"}}),rejected);
    assert.throws(()=>admitResidentIntent(world,world.persistentRuntime,{...proposal,choice:{candidateId:"rest",source:"model"}}),rejected);
    assert.equal(JSON.stringify(world),beforeRejected);
    admitResidentIntent(world,world.persistentRuntime,proposal);
    assert.throws(()=>admitResidentIntent(world,world.persistentRuntime,{...proposal,choice:{candidateId:"repair-book",source:"offline"}}),rejected);
    const result=advancePersistentTownTick(world,[],{steps:1,status:"paused"});
    assert.equal(result.runtime.residentWork.decisions.find(d=>d.context.npcId===context.npcId).choice.candidateId,"rest");
    assert(result.events.some(e=>e.actorIds.includes(context.npcId)&&e.tags.includes("resident_work")));
    return buildWorldReplayDigest(result.world,result.events,result.runtime).combinedDigest;
  }
  const digest=replay("2026-10-30T00:00:00.000Z");assert.equal(replay("2026-10-31T00:00:00.000Z"),digest);
  check("resident-intent-changes-existing-engine-action-and-replays-across-wall-clock");
  const source={worldId:"story-world",worldRevision:7,caseId:"case-a",truthRevision:"truth-a",discoveredEvidenceIds:["letter"]};
  const link={schema:"case-story-link.v1",surface:"player",worldId:"story-world",worldRevision:7,caseId:"case-a",truthRevision:"truth-a",branchId:"branch-a",chapterId:"chapter-1",facts:[{id:"letter",sourceRef:"evidence:letter",firstVisibleChapter:2}]};
  assert.deepEqual(validateCaseStoryLink(link,source),link);
  for(const bad of [{...link,truthRevision:"stale"},{...link,worldRevision:8},{...link,truth:{culprit:"x"}},{...link,facts:[{id:"unfound",sourceRef:"evidence:unfound",firstVisibleChapter:1}]},{...link,facts:[{...link.facts[0],firstVisibleChapter:0}]}])assert.throws(()=>validateCaseStoryLink(bad,source));
  check("case-bridge-versions-discovery-and-reader-disclosure");
  for(const p of navigation.places){const start=navigation.door("town-square"),target=navigation.door(p.id);assert(navigation.walkable(target));const route=navigation.routeTo(start,target);assert(route.length,p.id);assert(route.every(navigation.walkable));}
  assert(!navigation.walkable({x:200,y:420}));assert(!navigation.walkable({x:450,y:290}));
  assert.deepEqual(navigation.movePoint({x:450,y:343},0,-100),{x:450,y:333});
  check("five-walkable-doors-and-building-river-collision");
  const files=["packages/engine/src/town/agent-observation.ts","packages/engine/src/town/agent-intent.ts","packages/engine/src/town/case-bridge.ts","lib/world/agent-first-store.ts","app/api/v1/town-play/agent-first/route.ts","app/town-play/agent-first/agent-first-map.ts","scripts/run-agent-first-checks.mjs"];
  const receipt={schema:"agent-first-contract-checks.v1",checkedAt:new Date().toISOString(),passed:true,checks,digest,
    sourceFiles:Object.fromEntries(files.map(f=>[f,crypto.createHash("sha256").update(fs.readFileSync(path.join(root,f))).digest("hex")])),
    scope:"Real route functions, real SQLite and engine in isolated test DB; no external model calls. Case bridge is contract-only; no P2/P3/P4 or human play approval claimed."};
  const reviewDir=process.env.AGENT_FIRST_REVIEW_DIR??"docs/agent-first-v1";
  fs.mkdirSync(path.join(root,reviewDir),{recursive:true});
  fs.writeFileSync(path.join(root,reviewDir,"contract-review.json"),JSON.stringify(receipt,null,2)+"\n");
  console.log(JSON.stringify({passed:true,checks,digest}));
} finally {closeDatabase();}
