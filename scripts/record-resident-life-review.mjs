import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const out='docs/agent-first-v2',hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(`${out}/${f}`,'utf8'));
const life=read('life-review.json'),api=read('api-review.json'),edges=read('edge-review.json'),contracts=read('contract-review.json');
for(const report of [life,api,edges,contracts]){
  assert.equal(report.passed,true);
  for(const [file,sha]of Object.entries(report.sources??report.sourceFiles))assert.equal(hash(file),sha,`Stale evidence: ${file}`);
}
assert.equal(life.seedRuns.length,5);assert(new Set(life.seedRuns.map(s=>s.eventCount)).size>1,'No observed behavioural variation between seeds');
for(const seed of life.seedRuns){
  assert.equal(seed.ticks,864);assert.equal(seed.elapsedGameMinutes,4320);assert.equal(seed.modelCalls,0);
  assert.equal(seed.digest,seed.replayDigest);assert.equal(seed.digest,seed.restoredDigest);assert.equal(seed.residents.length,12);
  assert(seed.residents.every(p=>p.completed.eat>=3&&p.completed.sleep>=6&&p.completed.socialize>=1&&p.memoryCount>=10));
}
assert.equal(fs.readFileSync(`${out}/runtime/typecheck.log`,'utf8').trim(),'');
const regression=JSON.parse(fs.readFileSync(`${out}/runtime/resident-work-regression.log`,'utf8').trim());assert(regression.passed&&regression.checks===17&&!regression.evidence.liveModel);
const workReport=JSON.parse(fs.readFileSync(regression.report,'utf8'));for(const [f,sha]of Object.entries(workReport.sources))assert.equal(hash(f),sha,`Stale work check: ${f}`);
const daily=JSON.parse(fs.readFileSync(`${out}/runtime/daily-routine-regression.log`,'utf8').trim());assert(daily.passed&&daily.checks.length===8);
const session=JSON.parse(fs.readFileSync(`${out}/runtime/session-regression.log`,'utf8').trim());assert(session.passed&&session.checks.length===14);
const sessionReport=JSON.parse(fs.readFileSync('docs/3d-town/riverbend-v1/session-review.json','utf8'));for(const [f,sha]of Object.entries(sessionReport.sources))assert.equal(hash(f),sha,`Stale session check: ${f}`);
const browserFile='output/playwright/resident-life-browser.txt',browserText=fs.readFileSync(browserFile,'utf8'),match=/### Result\r?\n([^\r\n]+)/.exec(browserText);assert(match,'Missing browser result');const browser=JSON.parse(match[1]);
assert(browser.passed&&browser.explicitOptIn&&browser.realActivity&&browser.reloadPreservesLife&&browser.pageErrors.length===0&&browser.consoleErrors.length===0);
const files=[...new Set([...Object.keys(life.sources),...Object.keys(api.sources),...Object.keys(edges.sources),...Object.keys(contracts.sourceFiles),...Object.keys(workReport.sources),...Object.keys(sessionReport.sources),
  'app/town-play/agent-first/AgentFirstTown.tsx','app/town-play/agent-first/useAgentFirst.ts','app/town-play/agent-first/MapCanvas.tsx','app/town-play/agent-first/agent-first.module.css',
  'scripts/review-resident-life-browser.cjs','scripts/record-resident-life-review.mjs',`${out}/README.zh-CN.md`,'docs/v12-agent-first-2d-roadmap.md'])];
const sources=Object.fromEntries(files.map(f=>[f,hash(f)]));
const images=['desktop','observation','narrow'].map(s=>`output/playwright/resident-life-${s}.png`),screenshots=Object.fromEntries(images.map(f=>[f,hash(f)]));
const expectedArt={v1:'a79c8c7f5cd4d9ff004bf8c697a1d8e18f8fa35135f4905c1fdb0f94bd4f2360',v2:'fc5995aec9a986922177f91d12d3f7e3f0ce0b8cbcc729bbc71b5c122d64854e',v3:'527f02e580e2bf0be21c1148cc0c8c22b876fbb103faa096f35262dcf905a3dd'};
const retainedArt=Object.fromEntries(Object.entries(expectedArt).map(([version,expected])=>{const file=`docs/3d-town/snowbound-manor-${version}/snowbound-manor.blend`;assert.equal(hash(file),expected);return[version,{file,sha256:expected,humanArtApproved:false}];}));
const checkedAt=new Date().toISOString();
fs.writeFileSync(`${out}/browser-review.json`,JSON.stringify({schema:'resident-life-browser-review.v1',checkedAt,passed:true,result:browser,rawOutput:{file:browserFile,sha256:hash(browserFile)},screenshots,sources,
  visualReview:{reviewer:'Codex',inspected:true,humanApproved:false},scope:'Local Next dev server on Windows Chromium; 1280x720 and resized 390x844; no physical phone or full 72-hour browser soak.'},null,2)+'\n');
const summary={schema:'resident-life-package-review.v1',checkedAt,passed:true,scope:'P2 rule-life foundation, not full cognition/model/scale/case qualification',
  checks:{threeDaySeeds:5,completeReplayRuns:5,midrunRestores:5,edgeGroups:edges.checks.length,apiGroups:api.checks.length,previousContractGroups:contracts.checks.length,
    specialistRegressionGroups:17,commuteRegressionGroups:8,ownedSessionRegressionGroups:14,scopedTypecheck:true,browserInteraction:true},
  seeds:life.seedRuns.map(s=>({seed:s.seed,digest:s.digest,eventCount:s.eventCount,memoryCount:s.memoryCount,actionMix:s.actionMix,batchAverageTickP95Ms:s.measuredBatchAverageTickP95Ms,runAndReplayMs:s.runAndReplayMs})),
  needsCoverage:{residentsPerSeed:12,everyResidentAteSleptAndSocialized:true,everyMemoryHasSource:true,modelCalls:0},retainedArt,sources,
  evidence:Object.fromEntries(['life-review.json','api-review.json','edge-review.json','contract-review.json','browser-review.json'].map(f=>[f,hash(`${out}/${f}`)])),
  pending:['Long-term memory retrieval/reflection and memory-content-driven multi-step plans.','Model-vs-rule decision quality, budget and controlled intervention experiments.','24/100-resident scale and long real-browser soak.','Full fair-play case loop, novel persistence and revision propagation.','Native browser visibility hide/resume, real devices, Windows packaging and human play/art approval.'],
  notes:['Previous P0/P1 artifacts are historical and bound to their own source hashes.','Failed inventory assertion, social-starvation run and pre-idle-refinement run remain in runtime/ and are excluded from passing evidence.','Different seed event counts demonstrate behaviour variation; canonical digest uniqueness alone would also include the seed value.']};
fs.writeFileSync(`${out}/review.json`,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({passed:true,seeds:5,report:`${out}/review.json`,checks:summary.checks}));
