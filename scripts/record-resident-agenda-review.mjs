import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const out='docs/agent-first-v5',read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const production=['packages/engine/src/town/resident-agenda.ts','packages/engine/src/town/resident-cognition.ts','packages/engine/src/town/resident-life.ts','packages/engine/src/town/resident-work.ts','packages/engine/src/persistent-town.ts','packages/engine/src/town/agent-observation.ts','packages/engine/src/town/agent-intent.ts','packages/engine/src/town-exploration.ts','lib/world/town-exploration-store.ts','lib/world/resident-decision-provider.ts','lib/world/resident-life-provider.ts','lib/world/agent-first-store.ts','lib/town-play-contract.ts','app/api/v1/town-play/agent-first/route.ts','app/town-play/agent-first/AgentFirstTown.tsx','app/town-play/agent-first/useAgentFirst.ts','app/town-play/agent-first/MapCanvas.tsx','app/town-play/agent-first/agent-first.module.css'];
const sourceHashes=Object.fromEntries(production.map(f=>[f,hash(f)]));
if(process.argv.includes('--browser-start')){
  fs.writeFileSync(`${out}/runtime/browser-source-start.json`,JSON.stringify({startedAt:new Date().toISOString(),sourceHashes},null,2)+'\n');console.log('Browser source identity recorded.');process.exit(0);
}
const files=['agenda-review.json','cognition-review.json','edge-review.json','api-review.json','provider-review.json','player-checks/contract-review.json','rules/life-review.json','preflight/life-review.json','goals-rest/life-review.json'];
const reports=Object.fromEntries(files.map(f=>[f,read(`${out}/${f}`)]));
const workEntry=fs.readFileSync(`${out}/runtime/work.log`,'utf8').split(/\r?\n/).filter(l=>l.startsWith('{')).map(l=>JSON.parse(l)).find(v=>v.passed&&v.report);assert(workEntry);
reports.work=read(workEntry.report);
for(const [name,report] of Object.entries(reports)){
  assert(report.passed,`${name} failed`);for(const [f,sha] of Object.entries(report.sourceHashes??report.sources??report.sourceFiles))assert.equal(hash(f),sha,`${name}: source changed ${f}`);
}
const rules=reports['rules/life-review.json'],goalParts=[reports['preflight/life-review.json'],reports['goals-rest/life-review.json']];
assert.equal(rules.mode,'rules');assert(goalParts.every(r=>r.mode==='offline-agent'));
const goals=goalParts.flatMap(r=>r.seedRuns);assert.equal(rules.seedRuns.length,5);assert.equal(goals.length,5);assert.equal(new Set(goals.map(r=>r.seed)).size,5);
const comparisons=rules.seedRuns.map(rule=>{
  const goal=goals.find(r=>r.seed===rule.seed);assert(goal);assert.equal(rule.ticks,864);assert.equal(goal.ticks,864);
  assert.equal(rule.digest,rule.replayDigest);assert.equal(rule.digest,rule.restoredDigest);assert.equal(goal.digest,goal.replayDigest);assert.equal(goal.digest,goal.restoredDigest);
  const changed=JSON.stringify(rule.actionMix)!==JSON.stringify(goal.actionMix);assert(changed,'Only metadata differs between modes');
  assert.equal(rule.quality.modelAttemptsReserved,0);assert.equal(goal.quality.modelAttemptsReserved,0);
  return{seed:rule.seed,rules:{digest:rule.digest,actionMix:rule.actionMix,quality:rule.quality},goals:{digest:goal.digest,actionMix:goal.actionMix,quality:goal.quality},actualActionMixChanged:changed};
});
const pool=runs=>{const sums=runs.reduce((a,r)=>({goals:a.goals+r.quality.completedGoals,totalGoals:a.totalGoals+r.quality.totalGoals,repeated:a.repeated+r.quality.repeatedWithin60Minutes,completions:a.completions+r.quality.discretionaryCompletions,credits:a.credits+r.quality.sourcedGoalCredits}),{goals:0,totalGoals:0,repeated:0,completions:0,credits:0});return{...sums,goalCompletionRate:sums.goals/sums.totalGoals,repetitionRate:sums.repeated/sums.completions};};
const pooled={rules:pool(rules.seedRuns),goals:pool(goals)};
const benchmark={schema:'resident-life-quality-comparison.v1',checkedAt:new Date().toISOString(),passed:true,comparisons,pooled,
  scope:'Five matched seeds, two deterministic modes, 72 hours each; all ten cells have midrun restore and complete independent replay.',
  cautions:['An observed difference is not proof of human enjoyment or LLM intelligence.','Repetition rate includes fixed specialist recovery; alternative action durations also affect this measure.','Fully observed goal days are days 2 and 3. Proposal-source coverage concerns the retained last-512 ledger.','This is a 12-resident engine comparison, not a browser performance or 100-resident qualification.'],sourceHashes};
fs.writeFileSync(`${out}/quality-review.json`,JSON.stringify(benchmark,null,2)+'\n');
const percent=n=>`${(100*n).toFixed(1)}%`;
fs.writeFileSync(`${out}/quality.zh-CN.md`,[
  '# 两种生活安排的实际对照','',
  '五个相同种子，每种安排各运行 72 小时，并完成中途恢复和独立重放。以下为十个运行单元的汇总。','',
  '| 指标 | 按日程生活 | 按目标安排 |','| --- | ---: | ---: |',
  `| 完整观察日的目标完成 | ${pooled.rules.goals}/${pooled.rules.totalGoals} (${percent(pooled.rules.goalCompletionRate)}) | ${pooled.goals.goals}/${pooled.goals.totalGoals} (${percent(pooled.goals.goalCompletionRate)}) |`,
  `| 日常完成记录中，60 分钟内重复同类的比例 | ${percent(pooled.rules.repetitionRate)} | ${percent(pooled.goals.repetitionRate)} |`,
  `| 有完成事件支撑的目标进度记录 | ${pooled.rules.credits} | ${pooled.goals.credits} |`,
  '| 外部模型调用 | 0 | 0 |','',
  '两种模式在全部五个种子中产生了不同的实际行动组合。目标完成率按完整的第 2、3 日统计；第 1 日从 08:00 开始、第 4 日在 08:00 结束，均不充当完整观察日。','',
  '重复率包含规则固定的工作后休息，且行动时长也会影响它。它用于发现循环行为，不能单独证明策略更聪明。目标本身是明确编写的日常配额；尚未验证长期人格、反思、案件推理或真人游玩体验。','',
  '完整数据、每个种子的行动组合和每位居民的结果见 `quality-review.json`。'
].join('\n')+'\n');
assert.equal(fs.readFileSync(`${out}/runtime/typecheck.log`,'utf8').trim(),'');
const capture=read(`${out}/runtime/browser-source-start.json`);assert.deepEqual(capture.sourceHashes,sourceHashes,'Browser capture source changed');
const browserFile='output/playwright/resident-agenda-v5-browser.txt',match=/### Result\r?\n([^\r\n]+)/.exec(fs.readFileSync(browserFile,'utf8'));assert(match);
const browser=JSON.parse(match[1]);assert(browser.passed&&browser.modeSwitch&&browser.reloadPreservesMode&&browser.switchBackWithoutTick&&browser.reservedModelAttempts===0&&browser.pageErrors.length===0&&browser.consoleErrors.length===0);
const screenshots=['output/playwright/resident-agenda-v5-desktop.png','output/playwright/resident-agenda-v5-narrow.png'];for(const f of screenshots)assert(fs.statSync(f).size>1000);
const summary={schema:'resident-agenda-package-review.v1',checkedAt:new Date().toISOString(),passed:true,
  scope:'Fifth-round event-sourced recent memory, authored daily goals, deterministic local planning switch and matched quality comparison.',
  checks:{agendaGroups:reports['agenda-review.json'].checks.length,matchedSeeds:5,modes:2,threeDayCells:10,fullReplays:10,midrunRestores:10,providerGroups:reports['provider-review.json'].checks.length,apiGroups:reports['api-review.json'].checks.length,edgeGroups:reports['edge-review.json'].checks.length,cognitionGroups:reports['cognition-review.json'].checks.length,workGroups:reports.work.checks.length,playerGroups:reports['player-checks/contract-review.json'].checks.length,scopedTypecheck:true,browserModeSwitch:true,liveModel:false,liveExternalModelCalls:0},
  pooledQuality:pooled,sourceHashes:{...sourceHashes,...Object.fromEntries(['packages/engine/src/index.ts','scripts/run-resident-agenda-checks.mjs','scripts/run-resident-life-checks.mjs','scripts/lib/resident-life-quality.mjs','scripts/review-resident-agenda-browser.cjs','scripts/record-resident-agenda-review.mjs',`${out}/README.zh-CN.md`].map(f=>[f,hash(f)]))},
  evidence:Object.fromEntries([...files,'quality-review.json','quality.zh-CN.md'].map(f=>[f,hash(`${out}/${f}`)])),workEvidence:{file:workEntry.report,sha256:hash(workEntry.report)},
  browser:{...browser,startedAt:capture.startedAt,raw:{file:browserFile,sha256:hash(browserFile)},screenshots:Object.fromEntries(screenshots.map(f=>[f,hash(f)]))},
  pending:['Semantic memory summaries and source-preserving long-term reflection.','Personal commitments with routes, appointments and case pressure beyond authored daily quotas.','Bounded live-model quality/cost comparison, 24/100 residents, Windows package, physical devices and human acceptance.'],
  evidenceBoundaries:{deterministicLocalPlanning:true,liveModel:false,modelQualityProven:false,humanApproved:false,productionRelease:false}};
fs.writeFileSync(`${out}/review.json`,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({passed:true,report:`${out}/review.json`,checks:summary.checks,pooledQuality:pooled}));
