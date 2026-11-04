import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const out='docs/agent-first-v6',read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const production=['packages/engine/src/town/resident-appointments.ts','packages/engine/src/town/resident-agenda.ts','packages/engine/src/town/resident-cognition.ts','packages/engine/src/town/resident-life.ts','packages/engine/src/town/daily-routine.ts','packages/engine/src/town/resident-work.ts','packages/engine/src/persistent-town.ts','packages/engine/src/town/agent-observation.ts','packages/engine/src/town/agent-intent.ts','packages/engine/src/town-exploration.ts','lib/world/town-exploration-store.ts','lib/world/agent-first-store.ts','lib/world/resident-decision-provider.ts','lib/world/resident-life-provider.ts','lib/town-play-contract.ts','app/api/v1/town-play/agent-first/route.ts','app/town-play/agent-first/AgentFirstTown.tsx','app/town-play/agent-first/useAgentFirst.ts','app/town-play/agent-first/MapCanvas.tsx','app/town-play/agent-first/agent-first.module.css'];
const sourceHashes=Object.fromEntries(production.map(f=>[f,hash(f)]));
if(process.argv.includes('--browser-start')){fs.writeFileSync(`${out}/runtime/browser-source-start.json`,JSON.stringify({startedAt:new Date().toISOString(),sourceHashes},null,2)+'\n');console.log('Browser source identity recorded.');process.exit(0);}
const files=['appointment-review.json','agenda-review.json','cognition-review.json','edge-review.json','api-review.json','provider-review.json','player-checks/contract-review.json','goals/life-review.json','rules/life-review.json'];
const reports=Object.fromEntries(files.map(f=>[f,read(`${out}/${f}`)]));
const workEntry=fs.readFileSync(`${out}/runtime/work.log`,'utf8').split(/\r?\n/).filter(l=>l.startsWith('{')).map(l=>JSON.parse(l)).find(v=>v.passed&&v.report);assert(workEntry);reports.work=read(workEntry.report);
for(const [name,report] of Object.entries(reports)){assert(report.passed,`${name} failed`);for(const [f,sha] of Object.entries(report.sourceHashes??report.sources??report.sourceFiles))assert.equal(hash(f),sha,`${name}: source changed ${f}`);}
const goals=reports['goals/life-review.json'],rules=reports['rules/life-review.json'];assert.equal(goals.mode,'offline-agent');assert.equal(goals.seedRuns.length,5);assert.equal(rules.mode,'rules');assert.equal(rules.seedRuns.length,1);
const outcomes=goals.seedRuns.map(run=>{assert.equal(run.ticks,864);assert.equal(run.digest,run.replayDigest);assert.equal(run.digest,run.restoredDigest);
  const a=run.quality.appointments;assert(a.total>0&&a.byStatus.completed>0,'No actual appointment fulfillment');assert.equal(a.total,Object.values(a.byStatus).reduce((sum,n)=>sum+n,0),'Unknown or proposed appointment left unresolved');assert.equal(a.byStatus.accepted,0);assert.equal(a.byStatus.running,0);assert.equal(run.quality.modelAttemptsReserved,0);return{seed:run.seed,digest:run.digest,appointments:a,eventCount:run.eventCount};});
assert.equal(rules.seedRuns[0].quality.appointments.total,0);assert.equal(rules.seedRuns[0].digest,rules.seedRuns[0].replayDigest);assert.equal(rules.seedRuns[0].digest,rules.seedRuns[0].restoredDigest);
assert.equal(fs.readFileSync(`${out}/runtime/typecheck.log`,'utf8').trim(),'');
const start=read(`${out}/runtime/browser-source-start.json`);assert.deepEqual(start.sourceHashes,sourceHashes,'Browser source identity changed');
const browserFile='output/playwright/resident-appointments-v6-browser.txt',match=/### Result\r?\n([^\r\n]+)/.exec(fs.readFileSync(browserFile,'utf8'));assert(match);
const browser=JSON.parse(match[1]);assert(browser.passed&&browser.naturalNewSave&&browser.ordinaryVisitorCommands&&browser.actualActivityRendered&&browser.meeting&&browser.reservedModelAttempts===0&&browser.pageErrors.length===0&&browser.consoleErrors.length===0);
const screenshots=['output/playwright/resident-appointments-v6-desktop.png','output/playwright/resident-appointments-v6-narrow.png'];for(const f of screenshots)assert(fs.statSync(f).size>1000);
const totals=outcomes.reduce((sum,o)=>{for(const [status,count] of Object.entries(o.appointments.byStatus))sum[status]=(sum[status]??0)+count;sum.total+=o.appointments.total;return sum;},{total:0});
const outcomeTable=['# 三日约定的实际结果','',
  '五个种子各运行 72 小时，并完成中途恢复与独立重放。以下为自然发生的邀请结果，包含接受后履约或未履约的情况；拒绝不算履约失败。','',
  '| 种子 | 提出 | 履约完成 | 婉拒 | 过期未开始 | 交谈取消 |','| --- | ---: | ---: | ---: | ---: | ---: |',
  ...outcomes.map(o=>`| ${o.seed} | ${o.appointments.total} | ${o.appointments.byStatus.completed} | ${o.appointments.byStatus.declined} | ${o.appointments.byStatus.missed} | ${o.appointments.byStatus.cancelled} |`),
  `| 合计 | ${totals.total} | ${totals.completed} | ${totals.declined} | ${totals.missed} | ${totals.cancelled} |`,'',
  '所有约定在窗口结束时均已终结，来源事件可解析。需要优先吃饭、休息或处理询问时，允许错过或中断，不能为了完成率跳过世界规则。拒绝、失约、中断和隐藏信息边界另有受控情境检查。','',
  '真实浏览器还在普通新手记中观察到第 1 日 13:05 的“赴约交谈”。所有这些检查使用确定性的本地策略，没有外部模型调用，不代表真人游玩或真实模型质量验收。'];
fs.writeFileSync(`${out}/outcomes.zh-CN.md`,outcomeTable.join('\n')+'\n');
const summary={schema:'resident-appointment-package-review.v1',checkedAt:new Date().toISOString(),passed:true,scope:'Source-backed social appointments on the existing roads and life clock; deterministic policy, no live model quality claim.',
  checks:{appointmentGroups:reports['appointment-review.json'].checks.length,goalSeeds:5,threeDayCells:6,midrunRestores:6,fullReplays:6,ruleRegressionSeeds:1,agendaGroups:reports['agenda-review.json'].checks.length,cognitionGroups:reports['cognition-review.json'].checks.length,edgeGroups:reports['edge-review.json'].checks.length,apiGroups:reports['api-review.json'].checks.length,providerGroups:reports['provider-review.json'].checks.length,workGroups:reports.work.checks.length,playerGroups:reports['player-checks/contract-review.json'].checks.length,scopedTypecheck:true,naturalBrowserMeeting:true,liveModel:false,liveExternalModelCalls:0},
  appointmentTotals:totals,seedOutcomes:outcomes,sourceHashes:{...sourceHashes,...Object.fromEntries(['packages/engine/src/index.ts','scripts/run-resident-appointment-checks.mjs','scripts/run-resident-life-checks.mjs','scripts/lib/resident-life-quality.mjs','scripts/review-resident-appointments-browser.cjs','scripts/record-resident-appointment-review.mjs',`${out}/README.zh-CN.md`].map(f=>[f,hash(f)]))},
  evidence:Object.fromEntries([...files,'outcomes.zh-CN.md'].map(f=>[f,hash(`${out}/${f}`)])),workEvidence:{file:workEntry.report,sha256:hash(workEntry.report)},browser:{...browser,startedAt:start.startedAt,raw:{file:browserFile,sha256:hash(browserFile)},screenshots:Object.fromEntries(screenshots.map(f=>[f,hash(f)]))},
  stoppedRun:{file:'runtime/preflight-stopped.json',acceptanceEvidence:false},
  pending:['Flexible meeting times, negotiation, errands and appointments beyond the authored cafe policy.','Witnessed communication of cancellations, participant beliefs, deliberate deception and sourced reputation consequences.','Live model decisions, case fairness, larger populations, production build, Windows package, physical devices and human acceptance.'],
  evidenceBoundaries:{actualRoadTravel:true,controlledMechanismTests:true,naturalBrowserMeeting:true,modelQualityProven:false,physicalPhone:false,humanApproved:false,productionRelease:false}};
fs.writeFileSync(`${out}/review.json`,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({passed:true,report:`${out}/review.json`,checks:summary.checks,appointmentTotals:totals}));
