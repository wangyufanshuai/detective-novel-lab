import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const out='docs/agent-first-v4',read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const production=['packages/engine/src/town/resident-cognition.ts','packages/engine/src/town/resident-life.ts','packages/engine/src/town/resident-work.ts','packages/engine/src/persistent-town.ts','packages/engine/src/town/agent-observation.ts','packages/engine/src/town/agent-intent.ts','packages/engine/src/town-exploration.ts','lib/world/town-exploration-store.ts','lib/world/resident-decision-provider.ts','lib/world/resident-life-provider.ts','lib/world/agent-first-store.ts','lib/town-play-contract.ts','app/api/v1/town-play/agent-first/route.ts','app/town-play/agent-first/AgentFirstTown.tsx','app/town-play/agent-first/useAgentFirst.ts','app/town-play/agent-first/MapCanvas.tsx','app/town-play/agent-first/agent-first.module.css'];
const sourceHashes=Object.fromEntries(production.map(f=>[f,hash(f)]));
if(process.argv.includes('--browser-start')) {
  fs.writeFileSync(`${out}/runtime/browser-source-start.json`,JSON.stringify({startedAt:new Date().toISOString(),sourceHashes},null,2)+'\n');
  console.log('Browser source identity recorded.');process.exit(0);
}
const reports={provider:read(`${out}/provider-review.json`),life:read(`${out}/life-review.json`),edge:read(`${out}/edge-review.json`),api:read(`${out}/api-review.json`),cognition:read(`${out}/cognition-review.json`),player:read(`${out}/player-checks/contract-review.json`)};
const workLog=fs.readFileSync(`${out}/runtime/work-regression.log`,'utf8'),workEntry=workLog.split(/\r?\n/).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line)).find(v=>v.passed&&v.report);
assert(workEntry);reports.work=read(workEntry.report);
for(const [name,report] of Object.entries(reports)) {
  assert.equal(report.passed,true,`${name} failed`);
  for(const [file,sha] of Object.entries(report.sourceHashes??report.sources??report.sourceFiles)) assert.equal(hash(file),sha,`${name} source changed: ${file}`);
}
assert.equal(reports.life.seedRuns.length,5);assert.equal(reports.provider.evidence.liveExternalCalls,0);
assert.equal(fs.readFileSync(`${out}/runtime/typecheck.log`,'utf8').trim(),'');
const browserStart=read(`${out}/runtime/browser-source-start.json`);
assert.deepEqual(browserStart.sourceHashes,sourceHashes,'Source changed since browser capture began');
const browserFile='output/playwright/resident-provider-v4-browser.txt';
const match=/### Result\r?\n([^\r\n]+)/.exec(fs.readFileSync(browserFile,'utf8'));assert(match,'Missing browser result');
const browser=JSON.parse(match[1]);assert(browser.passed&&browser.reloadReadOnly&&browser.reservedModelAttempts===0&&browser.pageErrors.length===0&&browser.consoleErrors.length===0);
const screenshot='output/playwright/resident-provider-v4-panel.png';assert(fs.statSync(screenshot).size>1000);
const evidence=Object.fromEntries(['provider-review.json','life-review.json','edge-review.json','api-review.json','cognition-review.json','player-checks/contract-review.json'].map(f=>[f,hash(`${out}/${f}`)]));
const files=[...production,'scripts/run-resident-life-provider-checks.mjs','scripts/review-resident-provider-browser.cjs','scripts/record-resident-provider-review.mjs',`${out}/README.zh-CN.md`];
const summary={schema:'resident-life-provider-package-review.v1',checkedAt:new Date().toISOString(),passed:true,
  scope:'Fourth-round bounded server-side life proposals; public visitor route stays rule-driven.',
  checks:{providerGroups:reports.provider.checks.length,threeDaySeeds:reports.life.seedRuns.length,midrunRestores:5,lifeEdgeGroups:reports.edge.checks.length,apiGroups:reports.api.checks.length,cognitionGroups:reports.cognition.checks.length,workGroups:reports.work.checks.length,playerGroups:reports.player.checks.length,scopedTypecheck:true,publicRulesBrowser:true,liveModel:false,liveExternalModelCalls:0},
  sourceHashes:Object.fromEntries(files.map(f=>[f,hash(f)])),evidence,
  workEvidence:{file:workEntry.report,sha256:hash(workEntry.report)},browser:{...browser,startedAt:browserStart.startedAt,raw:{file:browserFile,sha256:hash(browserFile)},screenshot:{file:screenshot,sha256:hash(screenshot)}},
  pending:['Live model choice quality, cost and timeout acceptance.','Semantic memory, personal long-term goals, reflection, rumor distortion and fair-play cases.','24/100 resident load, packaged Windows game, physical devices and human approval.'],
  evidenceBoundaries:{controlledTransport:true,actualEngineAndSQLite:true,liveModel:false,providerBrowserIntegration:false,humanApproved:false,productionRelease:false}};
fs.writeFileSync(`${out}/review.json`,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({passed:true,report:`${out}/review.json`,checks:summary.checks}));
