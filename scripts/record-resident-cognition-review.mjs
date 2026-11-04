import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const root=process.cwd(),out='docs/agent-first-v3',hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const life=read('docs/agent-first-v2/life-review.json');
const cognition=read(`${out}/cognition-review.json`);
const edge=read('docs/agent-first-v2/edge-review.json');
const api=read('docs/agent-first-v2/api-review.json');
assert(life.passed&&life.seedRuns.length===5&&life.checks.includes('five-seeds-72-hours-12-residents-full-replay-and-midrun-restore'));
for(const [file,sha] of Object.entries(life.sources)) assert.equal(hash(file),sha,`life source changed: ${file}`);
assert(cognition.passed&&cognition.checks.length===5);
for(const [file,sha] of Object.entries(cognition.sources)) assert.equal(hash(file),sha,`cognition source changed: ${file}`);
assert(edge.passed&&edge.checks.length>=5);for(const [file,sha] of Object.entries(edge.sources))assert.equal(hash(file),sha,`edge source changed: ${file}`);
assert(api.passed&&api.checks.length===3);for(const [file,sha] of Object.entries(api.sources))assert.equal(hash(file),sha,`api source changed: ${file}`);
assert.equal(fs.readFileSync('docs/agent-first-v3-typecheck.log','utf8').trim(),'');
const browserFile='output/playwright/resident-cognition-browser.txt',browserText=fs.readFileSync(browserFile,'utf8'),match=/### Result\r?\n([^\r\n]+)/.exec(browserText);assert(match,'Missing cognition browser result');const browser=JSON.parse(match[1]);assert(browser.passed&&browser.proposalSummaryVisible&&browser.privateMemoryAbsent&&browser.pageErrors.length===0&&browser.consoleErrors.length===0);
const artExpected={v1:'a79c8c7f5cd4d9ff004bf8c697a1d8e18f8fa35135f4905c1fdb0f94bd4f2360',v2:'fc5995aec9a986922177f91d12d3f7e3f0ce0b8cbcc729bbc71b5c122d64854e',v3:'527f02e580e2bf0be21c1148cc0c8c22b876fbb103faa096f35262dcf905a3dd'};
const retainedArt=Object.fromEntries(Object.entries(artExpected).map(([version,expected])=>{const file=`docs/3d-town/snowbound-manor-${version}/snowbound-manor.blend`;assert.equal(hash(file),expected);return[version,{file,sha256:expected,humanArtApproved:false}];}));
const files=[...new Set([...Object.keys(life.sources),...Object.keys(cognition.sources),...Object.keys(edge.sources),...Object.keys(api.sources),
  'packages/engine/src/town/agent-observation.ts','packages/engine/src/town/agent-intent.ts','packages/engine/src/town/case-bridge.ts','packages/engine/src/town-exploration.ts',
  'lib/world/agent-first-store.ts','lib/world/town-exploration-store.ts','lib/town-play-contract.ts','app/town-play/agent-first/AgentFirstTown.tsx','app/town-play/agent-first/useAgentFirst.ts',
  'app/town-play/agent-first/agent-first.module.css','scripts/run-resident-cognition-checks.mjs','scripts/run-resident-life-checks.mjs','scripts/review-resident-cognition-browser.cjs',
  'scripts/record-resident-cognition-review.mjs','docs/agent-first-v3/README.zh-CN.md'])];
const sources=Object.fromEntries(files.map(f=>[f,hash(f)]));
const screenshots=Object.fromEntries(['output/playwright/resident-cognition-panel.png','output/playwright/resident-life-desktop.png','output/playwright/resident-life-narrow.png','output/playwright/resident-life-observation.png'].map(f=>[f,{sha256:hash(f),bytes:fs.statSync(f).size}]));
const checkedAt=new Date().toISOString();
fs.writeFileSync(`${out}/browser-review.json`,JSON.stringify({schema:'resident-cognition-browser-review.v1',checkedAt,passed:true,result:browser,raw:{file:browserFile,sha256:hash(browserFile)},screenshots,sources,scope:'Local Windows Chromium dev server; player-safe rules mode; no live model, phone, long browser soak, or human approval.'},null,2)+'\n');
const summary={schema:'resident-cognition-package-review.v1',checkedAt,passed:true,scope:'P2 resident-life foundation plus P2.1 sourced candidate/referee layer; no full model/case/scale qualification.',
  checks:{fullThreeDaySeeds:5,midrunRestores:5,lifeEdgeGroups:edge.checks.length,lifeApiGroups:api.checks.length,cognitionGroups:cognition.checks.length,rulesDigest:cognition.modes.rules.digest,offlineAgentDigest:cognition.modes.offlineAgent.digest,offlineAgentBudgetUsed:cognition.modes.offlineAgent.budgetUsed,modelCalls:0,scopedTypecheck:true,browserInteraction:true},
  lifeSeeds:life.seedRuns.map(s=>({seed:s.seed,digest:s.digest,eventCount:s.eventCount,memoryCount:s.memoryCount,actionMix:s.actionMix,minimumMeals:Math.min(...s.residents.map(p=>p.completed.eat)),minimumSleep:Math.min(...s.residents.map(p=>p.completed.sleep)),minimumSocial:Math.min(...s.residents.map(p=>p.completed.socialize)),batchAverageTickP95Ms:s.measuredBatchAverageTickP95Ms})),
  candidateLayer:{retrievalPrivate:true,sourceRefs:['life-policy','memory'],refusals:['STALE_CONTEXT','UNKNOWN_SOURCE','ILLEGAL_CANDIDATE','BUDGET_EXHAUSTED','ACTION_REUSED'],defaultMode:'rules',offlineMode:'offline-agent',liveModel:false},
  retainedArt,sources,screenshots,evidence:Object.fromEntries(['cognition-review.json','browser-review.json','../agent-first-v2/life-review.json','../agent-first-v2/edge-review.json','../agent-first-v2/api-review.json'].map(f=>[f,hash(path.join(out,f))])),
  pending:['Replace offline-agent scoring with a bounded live model provider and compare acceptance/source coverage under timeout and fallback.', 'Long-term memory summaries, rumor distortion, case pressure and full fair-play investigation.', '24/100 resident scale, production build, native tab visibility, physical devices and human approval.'],
  notes:['The v2 life report was regenerated from the current source after a segmented run temporarily overwrote it.', 'Blender candidates remain retained and humanArtApproved=false.', 'Candidate proposals are intents and never world truth.']};
fs.writeFileSync(`${out}/review.json`,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({passed:true,report:`${out}/review.json`,checks:summary.checks}));
