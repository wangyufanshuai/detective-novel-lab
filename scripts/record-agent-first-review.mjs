import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const root=process.cwd(),out='docs/agent-first-v1',hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const write=(name,data)=>fs.writeFileSync(path.join(out,name),JSON.stringify(data,null,2)+'\n');
const checkedAt=new Date().toISOString();
function check(command,args,log){
  const result=spawnSync(process.execPath,[command,...args],{cwd:root,encoding:'utf8'});
  fs.writeFileSync(path.join(out,'runtime',log),(result.stdout??'')+(result.stderr??''));
  assert.equal(result.status,0,`${command}: ${result.stderr}`);
  return {command:`node ${command} ${args.join(' ')}`.trim(),exitCode:result.status,log:`runtime/${log}`};
}
const typecheck=check('node_modules/typescript/bin/tsc',['-p',`${out}/runtime/tsconfig.json`,'--noEmit'],'typecheck.log');
const contractRun=check('scripts/run-agent-first-checks.mjs',[],'contract-checks.log');
const regressionRun=check('scripts/run-resident-work-checks.mjs',[],'resident-work-regression.log');
const contracts=JSON.parse(fs.readFileSync(`${out}/contract-review.json`,'utf8'));
assert(contracts.passed&&contracts.checks.length===8);
for(const [f,sha]of Object.entries(contracts.sourceFiles))assert.equal(hash(f),sha,`Contract source changed: ${f}`);
const regressionSummary=JSON.parse(fs.readFileSync(`${out}/runtime/resident-work-regression.log`,'utf8').trim());
assert(regressionSummary.passed&&regressionSummary.checks===17&&!regressionSummary.evidence.liveModel);
const regression=JSON.parse(fs.readFileSync(regressionSummary.report,'utf8'));
for(const [f,sha]of Object.entries(regression.sources))assert.equal(hash(f),sha,`Regression source changed: ${f}`);
function browserResult(file){
  const text=fs.readFileSync(file,'utf8'),match=/### Result\r?\n([^\r\n]+)/.exec(text);
  assert(match,`No successful browser result in ${file}`);
  const value=JSON.parse(match[1]);assert(value.passed&&value.pageErrors.length===0,file);return value;
}
const interactionFile='output/playwright/agent-first-interactions-final.txt',cadenceFile='output/playwright/agent-first-cadence-final.txt',routesFile='output/playwright/agent-first-routes-final.txt';
const interactions=browserResult(interactionFile),cadence=browserResult(cadenceFile),routes=browserResult(routesFile);
assert(interactions.lostCommitResponseRetriedExactlyOnce&&interactions.noteRestored&&interactions.arrivalCommits===1&&interactions.localWalkingWrites===0);
assert.equal(interactions.consoleErrors.length,1);assert(interactions.consoleErrors[0].includes('ERR_FAILED')&&interactions.expectedNetworkAbort);
assert(cadence.dialogPausesWorld&&cadence.followStopsWhenOffscreen&&cadence.lastSeenHidesActivity&&cadence.narrowArrival&&cadence.renderAndWalkPosts===0);
assert(cadence.desktop.samples===600&&cadence.narrow.samples===600&&cadence.consoleErrors.length===0);
assert(routes.allFivePlacesVisitedAcrossScripts&&routes.groundPointerRoute&&routes.nativeVisibility.status==='pending'&&routes.consoleErrors.length===0);
assert.deepEqual(routes.additionalRoutes.map(p=>p.place),['station','cafe','town-square']);
const uiFiles=fs.readdirSync('app/town-play/agent-first').map(f=>`app/town-play/agent-first/${f}`);
const sources=[...new Set([...uiFiles,...Object.keys(contracts.sourceFiles),...Object.keys(regression.sources),
  'app/localization/locale-context.tsx','lib/world/private-world-access.ts','packages/engine/src/town/agent-control.ts','packages/engine/src/town/replay-contract.ts',
  'scripts/review-agent-first-browser.cjs','scripts/review-agent-first-cadence.cjs','scripts/review-agent-first-routes.cjs','scripts/record-agent-first-review.mjs',
  `${out}/README.zh-CN.md`,'docs/v12-agent-first-2d-roadmap.md',`${out}/runtime/tsconfig.json`])];
const sourceFiles=Object.fromEntries(sources.map(f=>[f,hash(f)]));
const shots=['desktop-final','interior','resident','notebook','narrow-final','narrow-map','narrow-person'].map(s=>`output/playwright/agent-first-${s}.png`);
const screenshots=Object.fromEntries(shots.map(f=>[f,{sha256:hash(f),bytes:fs.statSync(f).size}]));
const artExpected={v1:'a79c8c7f5cd4d9ff004bf8c697a1d8e18f8fa35135f4905c1fdb0f94bd4f2360',v2:'fc5995aec9a986922177f91d12d3f7e3f0ce0b8cbcc729bbc71b5c122d64854e',v3:'527f02e580e2bf0be21c1148cc0c8c22b876fbb103faa096f35262dcf905a3dd'};
const retainedArt=Object.fromEntries(Object.entries(artExpected).map(([version,expected])=>{
  const file=`docs/3d-town/snowbound-manor-${version}/snowbound-manor.blend`,actual=hash(file);assert.equal(actual,expected,`Retained art ${version}`);return [version,{file,sha256:actual,humanArtApproved:false}];
}));
write('verification-review.json',{schema:'agent-first-verification.v1',checkedAt,passed:true,typecheck,contractRun,regressionRun,
  contracts:{groups:8,digest:contracts.digest},residentWorkRegression:{groups:17,report:regressionSummary.report,sha256:hash(regressionSummary.report),liveModel:false},sourceFiles});
write('browser-review.json',{schema:'agent-first-browser-review.v1',checkedAt,passed:true,
  endpoint:'http://127.0.0.1:3187/town-play/agent-first',interactions,cadence,routes,
  rawOutputs:Object.fromEntries([interactionFile,cadenceFile,routesFile].map(f=>[f,hash(f)])),screenshots,sourceFiles,
  machine:{os:'Windows',cpu:'Intel Core i9-13900HX',logicalProcessors:32,physicalMemoryBytes:16978403328},
  visualReview:{reviewer:'Codex',desktopAndNarrowInspected:true,humanApproved:false},
  limits:['Local Next webpack development server; short rolling 600-frame RAF samples, not GPU timing or a long soak.',
    '390x844 is a resized desktop Chromium viewport; no physical phone, production build, Windows package or human play approval.',
    'One intentional lost-response network error in recovery test; clean cadence and route checks report zero page/console errors.',
    'Native tab hide/resume remains pending: the CLI session reported document.hidden=false even for a minimized window. No synthetic visibility override was counted as browser acceptance.']});
const requirements=[
  ['P0-01','复用现有世界与 Agent 控制，未建立独立模拟器',['agent-first-store.ts -> town-exploration-store.ts','agent-intent.ts -> agent-control.ts / resident-work.ts','contract-review.json: real-engine travel and resident action; verification-review.json:17 resident-work groups']],
  ['P0-02','冻结观察、提案、拒绝、案件桥接合同',['README.zh-CN.md: P0 合同边界','agent-observation.ts / agent-intent.ts / case-bridge.ts','contract-review.json:8 groups']],
  ['P0-03','公开投影与身份隔离、版本/来源/字段校验',['contract-review.json: strict-fields-sources-CAS-reuse-origin-and-session-refusals','contract-review.json: public-whitelist-and-hidden-state-noninterference']],
  ['P0-04','确定性与写入幂等，失败整体回滚',['contract-review.json: digest '+contracts.digest,'contract-review.json: receipt-failure-atomic-rollback-save-reopen-and-retry','browser-review.json: lostCommitResponseRetriedExactlyOnce']],
  ['P0-05','居民提案实际影响行动，候选或无预算模型提案拒绝',['run-agent-first-checks.mjs: rest choice / real work events / RESIDENT_REFUSED / unchanged world after refusal']],
  ['P0-06','案件桥接绑定版本、已发现事实与披露章节',['contract-review.json: case-bridge-versions-discovery-and-reader-disclosure','README.zh-CN.md: contract-only; P4 pending']],
  ['P1-01','五地点轻量地图、角色移动、到访、近门交互',['browser-review.json: books+inn arrivals and station+cafe+square additionalRoutes','browser-review.json: keyboard, pointer control, ground route; localWalkingWrites=0']],
  ['P1-02','六格工具、人物观察、记录、案件本空壳与恢复',['browser-review.json: observedResident, noteRestored, followStopsWhenOffscreen,lastSeenHidesActivity','README.zh-CN.md: identity-only inquiry and case shell limits']],
  ['P1-03','暂停、自动推进、面板焦点及连接恢复',['browser-review.json: dialogMovementPaused, dialogFocusTrapped, automaticAdvanceCommits, pausedForMs, lost response retry; native visibility remains explicitly pending']],
  ['P1-04','桌面1280x720与窄窗口390x844实际浏览器检查',['browser-review.json: screenshots, cadence.layout, desktop/narrow samples=600','Codex visual inspection; human usability approval pending']],
  ['KEEP-01','保留 Blender v1/v2/v3 候选',['retained-art hashes in this audit; all match prior candidates']],
  ['SCOPE-01','明确未闭合门槛，留下可复现证据',['README.zh-CN.md: 尚未放行 and commands','v12-agent-first-2d-roadmap.md: P0/P1 scope note','contract-review.json / verification-review.json / browser-review.json']]
].map(([id,requirement,evidence])=>({id,requirement,status:'verified-for-bounded-goal',evidence}));
write('completion-audit.json',{schema:'agent-first-completion-audit.v1',checkedAt,goalScopeVerified:true,
  objective:'P0/P1 Agent-first detective-town contracts and lightweight 2D exploration shell, bounded tests/browser checks, retained art and explicit remaining gates.',
  requirements,retainedArt,sourceFiles,
  pending:{P2:'12-resident three-day needs/memory/relationship loops, 5-seed replay, behaviour diversity and scaling; current world cap remains 288 five-minute ticks.',
    P3:'Complete fair investigation, interrogation, theory, resolution and consequences in the 2D interface.',P4:'Novel workbench persistence, author access, cast/place mappings and revision impact propagation.',
    P5:'Art direction approval, production build qualification, Windows packaging, physical target devices and long soak.',nativeVisibility:'Background/minimized browser hide-and-resume acceptance pending due to CLI focus emulation; panel pause and explicit world pause are verified.',human:'No human UI/art/gameplay approval; no claim of top-tier Agent capability or measured new-user comprehension.'},
  evidenceFiles:Object.fromEntries(['contract-review.json','verification-review.json','browser-review.json','README.zh-CN.md'].map(f=>[f,hash(path.join(out,f))]))});
console.log(JSON.stringify({passed:true,contractGroups:8,residentRegressionGroups:17,browserSuites:3,requirements:requirements.length,digest:contracts.digest,report:`${out}/completion-audit.json`}));
