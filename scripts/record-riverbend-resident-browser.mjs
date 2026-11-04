import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
const sha=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const read=file=>JSON.parse(fs.readFileSync(file,"utf8"));
const result=file=>{
  const line=fs.readFileSync(file,"utf8").split(/\r?\n/).find(line=>line.startsWith('{"status":'));
  assert(line,`No browser result in ${file}`);
  const value=JSON.parse(line);assert.equal(value.status,"passed");assert.deepEqual(value.errors,[]);assert.deepEqual(value.warnings,[]);return value;
};
const prefix="docs/3d-town/riverbend-residents-v2/";
const motion=result("output/playwright/riverbend-resident-browser.log");
const caseRun=result("output/playwright/riverbend-resident-case.log");
const performance=result("output/playwright/riverbend-resident-performance.log");
const sources=read("output/playwright/riverbend-residents-checked-sources.json");
for(const [file,hash] of Object.entries(sources))assert.equal(sha(file),hash,`Source changed after browser review: ${file}`);
const manifest=read("public/assets/riverbend/residents-v2/manifest.json");
assert.equal(sha("public"+manifest.asset.url),manifest.asset.sha256);
assert.equal(sha(prefix+"riverbend-residents.blend"),manifest.sourceSha256);
for(const [file,hash] of Object.entries(manifest.proofs))assert.equal(sha(prefix+file),hash,`Stale art gate: ${file}`);
for(const filename of ["authoring-receipt.json","function-review.json","asset-review.json"]){for(const input of read(prefix+filename).inputs)assert.equal(sha(input.path),input.sha256,`Stale measured input: ${input.path}`);}
assert.equal(caseRun.steps.filter(s=>s.name.startsWith("walk-")).map(s=>s.sceneId).filter((s,i,a)=>a.indexOf(s)===i).length,6);
assert(caseRun.steps.some(s=>s.name==="case-solved"&&s.solved&&s.clues===8));
assert(caseRun.steps.some(s=>s.name==="phone-emulated-case-book"&&!s.errors.length&&s.layouts.every(x=>x.scroll===x.viewport&&x.dialog===x.dialogScroll)));
assert.equal(caseRun.steps.find(s=>s.name==="resident-companion").asset,manifest.asset.sha256);
assert.equal(performance.observed.length,4);
assert.equal(performance.probes.length,2);
for(const probe of performance.probes){assert.equal(probe.residentAssetSha256,manifest.asset.sha256);assert(probe.allFramesCaptured&&probe.frames===probe.expectedFrames);}
const folder=fs.mkdtempSync("output/playwright/riverbend-resident-review-");
const preserve=file=>{const dest=path.join(folder,path.basename(file)).replaceAll("\\","/");fs.copyFileSync(file,dest);return {path:dest,sha256:sha(dest),bytes:fs.statSync(dest).size};};
const raw=["output/playwright/riverbend-resident-browser.log","output/playwright/riverbend-resident-case.log","output/playwright/riverbend-resident-performance.log"];
const runners=["output/playwright/riverbend-resident-browser.js","output/playwright/riverbend-resident-case.js","output/playwright/riverbend-resident-performance.js","output/playwright/riverbend-resident-walk.js"];
const screenshots=[...motion.shots,...caseRun.shots,...performance.shots].map(preserve);
const report={schema:"riverbend-resident-browser.v2",reviewedAt:new Date().toISOString(),status:"resident-art-and-local-motion-candidate-pass-full-goal-open",sourceFiles:sources,
  sourceCapture:preserve("output/playwright/riverbend-residents-checked-sources.json"),rawLogs:raw.map(preserve),runners:runners.map(preserve),screenshots,
  art:{sourceSha256:manifest.sourceSha256,assetSha256:manifest.asset.sha256,baseAssetSha256:manifest.baseAssetSha256,bytes:manifest.asset.bytes,actors:12,jointsPerActor:7},
  motion:{browser:motion.browser,worldId:motion.steps[0].worldId,checks:motion.steps.map(s=>s.name),observedActors:motion.steps[0].observed,scope:motion.scope},
  caseRegression:{worldId:caseRun.worldId,caseId:caseRun.caseId,finalTime:caseRun.finalTime,finalRevision:caseRun.finalRevision,steps:caseRun.steps,requests:caseRun.requests,errors:caseRun.errors,warnings:caseRun.warnings},
  performance:{worldId:performance.worldId,time:performance.time,observed:performance.observed,scope:"Two local development probes, actual elapsed durations below; four noon residents and a stationary player. Every frame is retained, including pauses and the cost of frequent read-only diagnostic retrieval. Not sustained full-game, production or physical-device acceptance.",probes:performance.probes.map(({motion,samples,...probe})=>({...probe,targetP95Ms:probe.quality==="high"?20:36,withinProbeTarget:probe.p95Ms<=(probe.quality==="high"?20:36)}))},
  retainedRunnerFailure:["output/playwright/riverbend-resident-case-buffer-stall.log","output/playwright/riverbend-resident-case-buffer-stall.js","output/playwright/riverbend-resident-case-buffer-stall.png","output/playwright/riverbend-resident-collision-escape.log","output/playwright/riverbend-resident-performance-rolling-buffer.log"].map(preserve),
  correction:"The keyboard test driver initially trapped itself inside its extra pathfinding clearance buffer. A real D-key escape succeeded without product changes; the test planner now permits an outward first step. Fresh complete six-place and case regression then passed. The first high-quality performance probe exceeded the 3600-frame diagnostic ring; its tail-only result is retained as incomplete. The accepted probes collect each second and verify captured frames against the total frame counter.",
  gates:{localArtCandidate:true,observedResidentMotion:true,completeAuthoredCaseRegression:true,phoneEmulatedCaseBook:true,productionBuild:false,sustainedFullGamePerformance:false,physicalDevice:false,humanArtApproved:false,novelWorkflow:false},
  limitations:["Local wandering is presentation within a witnessed place; inter-place commute bodies, direct NPC conversations, seated actions and indoor traversal remain unfinished.","Seven rigid joints per resident; no cloth skinning or foot inverse kinematics.","Production lighting, day/night and stronger role readability at distant camera remain open. The forward-biased camera and bottom toolbar can obscure a resident near the lower screen edge.","Performance captures are short development probes with a stationary player and frequent diagnostic reads. Each contains 61 frames over 50 ms; the long-frame causes have not been isolated. This is not the full-game sustained acceptance gate.","Mobile checks use browser emulation, not a physical phone.","The case is original and authored; novel workflow and shared-case 6-8 chapter draft remain open."]};
fs.writeFileSync(prefix+"browser-review.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({status:report.status,retained:folder,screenshots:screenshots.length,caseTime:caseRun.finalTime,probes:report.performance.probes.map(p=>({quality:p.quality,p95Ms:p.p95Ms,frames:p.frames,withinProbeTarget:p.withinProbeTarget}))}));
