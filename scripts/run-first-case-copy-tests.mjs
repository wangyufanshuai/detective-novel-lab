import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";

async function loadActual(relative) {
  const source = await fs.readFile(new URL(`../${relative}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

const [catalog, gold, registry] = await Promise.all([
  loadActual("app/localization/locale-catalog.ts"),
  loadActual("app/localization/midnight-chorus-gold-slice-locale.ts"),
  loadActual("app/campaign/investigation-action-registry.ts")
]);
// Same public-text then authored-text order used by AppLocaleProvider. These
// samples concern UI text only; no truth ledger or answer keys are supplied.
function localize(value, locale = "zh-CN") {
  const publicText = catalog.localizePublicText(value, locale);
  return gold.localizeMidnightChorusGoldSlice(publicText, locale) || publicText;
}

const actions = {
  join: "加入调查", observe: "观察现场", search: "搜索证据", question: "询问证人",
  challenge: "质证证词", "edit-theory": "组织推理", submit: "提交结论", review: "复核解答"
};
let checks = 0;
for (const [kind, expected] of Object.entries(actions)) {
  const action = registry.getInvestigationActionDefinition(kind);
  assert.equal(localize(action.label), expected, `${kind} uses one clear action label`);
  assert.doesNotMatch(localize(action.detail), /[A-Za-z]|认证|处理器|权威|会话/, `${kind} explains the player action without implementation terms`);
  assert.equal(localize(action.label, "en-US"), action.label);
  checks += 3;
}

const samples = [
  ["Open Source Review", "复核解答"], ["Review source record", "复核解答"],
  ["Source Review", "复核解答"], ["Source复核", "复核解答"],
  ["Submit revised theory", "提交修订结论"],
  ["Source review completed", "解答已复核"],
  ["motive: Motive proof", "动机依据"], ["means: Means proof", "手法依据"],
  ["No persistent world change", "本次没有小镇变化"],
  ["No world change has been confirmed for this action.", "本次尚未确认小镇变化。"],
  ["This clue did not reveal a new contradiction in this testimony.", "这条证据未能揭示证词中的新矛盾。"],
  ["Evidence exposed a contradiction; NPC testimony was corrected.", "证据揭示了矛盾，证人已修正陈述。"],
  ["The theory still has proof gaps. Review the evidence and try again.", "结论仍缺少证据支持，请核对证据后重试。"],
  ["Theory accepted. Answer review unlocked.", "结论已通过，可以复核解答。"],
  ["Action not confirmed", "行动结果未确认"],
  ["The existing command handler is resolving.", "正在执行行动，请稍候。"],
  ["The action could not confirm a result. Review the current investigation before retrying.", "本次行动结果未确认，请查看当前调查状态后再重试。"],
  ["2/7 certified steps", "2/7 个调查步骤"],
  ["Resolve Observe case window first.", "先完成“观察现场”。"],
  ["Missing: Motive proof needs assigned evidence., Method proof needs assigned evidence.", "待补充的依据：尚未选择支持动机的证据。 尚未选择支持手法的证据。"],
  ["Theory rejected: Motive evidence assignments do not close the required proof for the accused character.", "结论未通过：所选动机证据尚不能支持对该嫌疑人的判断。"],
  ["Can challenge testimony or timeline: Present this clue to 方以恒, 韩照, 秦露 and check whether the statement still holds.", "可用于检验证词或时间线：向方以恒、韩照、秦露出示这条证据，检查原陈述是否仍然成立。"],
  ["受限铅字块 can test this public claim.", "受限铅字块可以用来检验这条陈述。"],
  ...[
    ["Restricted type block", "受限铅字块"],
    ["Cancelled billing notice", "撤销署名通知"],
    ["Box-office handoff", "售票处交接"],
    ["Replaced display sheet", "被替换的展示页"]
  ].flatMap(([en, zh]) => [
    [`${en} can test this public claim.`, `${zh}可以用来检验这条陈述。`],
    [`${en}可以用来检验这条陈述。`, `${zh}可以用来检验这条陈述。`]
  ]),
  ...[
    ["韩照 repeated a partial account of recent events.", "韩照转述了近期事件的部分情况。"],
    ["方以恒 was found dead after a series of visible town tensions.", "方以恒在小镇接连出现紧张迹象后被发现死亡。"],
    ["A public rollcall excludes residents who were away from the scene.", "公开点名记录排除了当时不在现场的居民。"]
  ].flatMap(([en, zh]) => [
    [`Read each clue as one stage in a public account's revision and distribution. ${en}`, `把每条线索视为公开说法修改与传播过程中的一个环节. ${zh}`],
    [`Read each clue as one stage in a public account's revision and distribution. ${zh}`, `把每条线索视为公开说法修改与传播过程中的一个环节. ${zh}`]
  ]),
  ["韩照, where were you during the crime window, and what unusual details do you remember?", "韩照，案发时段你在哪里？你还记得哪些异常细节？"],
  ["Public duties or recent case contact are limiting attention.", "公务或近期案件接触占用了他的注意力。"],
  ["scheduled", "已安排"],
  ["Reviewing this summary does not write another event.", "查看这份摘要不会新增事件记录。"],
  ["Please explain this evidence and whether it changes your earlier statement.", "请解释这条证据，并说明它是否会改变你之前的陈述。"],
  ["Where were you during the incident window, and what did you observe?", "案发时段你在哪里？你看到了什么？"],
  ["韩照's public statement changed after a certified challenge.", "韩照在质证后修正了公开陈述。"],
  ["温室 / 10:00 韩照 REPEATED A PARTIAL ACCOUNT OF RECENT EVENTS.", "温室 / 10:00 韩照转述了近期事件的部分情况。"],
  ["把每条线索视为公开说法修改与传播过程中的一个环节. 方以恒 WAS FOUND DEAD AFTER A SERIES OF VISIBLE TOWN TENSIONS.", "把每条线索视为公开说法修改与传播过程中的一个环节. 方以恒在小镇接连出现紧张迹象后被发现死亡。"],
  ["雾灯广场 / 23:00 A PUBLIC ROLLCALL EXCLUDES RESIDENTS WHO WERE AWAY FROM THE SCENE.", "雾灯广场 / 23:00 公开点名记录排除了当时不在现场的居民。"],
  ["The rejected public theory strained confidence in the inquiry while its certified proof gaps remain open. Recovery action ready", "这次未获支持的公开结论削弱了对调查的信任，尚缺的证据依据仍需补齐。恢复行动已就绪。"],
  ["Questioning 已记录 · follow-up remains route-bound", "询问已记录，后续仍按调查步骤推进"],
  ["Local Gazette", "本地报社"],
  ["1/3 steps", "1/3 步已完成"],
  ["0 clue(s)", "0 条证据"],
  ["Recovery scheduled for the next legal institution cycle", "恢复已安排在下一次机构行动周期"],
  ["Advance Persistent Town until the next institution cycle completes the recovery.", "推进小镇，等待下一次机构行动周期完成恢复。"],
  ["Between cases: 1/3 campaign cases closed", "案间准备：1/3 案已结案"],
  ["1/3 campaign cases closed", "1/3 案已结案"],
  ["Press Network standing is temporarily reduced by 3 until one legal institution cycle completes; truth and proof remain unchanged.", "新闻网络的关系评价暂时降低 3 点，在下一次机构行动周期后恢复；案件事实与证据要求不变。"],
  ["Choose Headquarters preparation", "选择总部准备事项"],
  ["Choose one available Headquarters direction before extracting the next case.", "开始下一案前，选择一项可用的总部准备方向。"],
  ["Start this recovery or defer it; the 当前 certified truth path remains available.", "可以开始或暂缓这次恢复行动，当前调查仍可继续。"],
  ["Resolve Complete one public theory-review interval first.", "先完成一次公开结论复核。"],
  ["Resolve Review conclusion first.", "先完成“复核解答”。"],
  ["复核 conclusion. 打开 the certified conclusion after the existing judgement accepts the theory.", "复核解答。结论通过后，可查看证据与完整解答的对应关系。"],
  ["复核 does not rewrite the accepted judgement or reveal private runtime bindings.", "复核只展示已有解答，不改变已通过的结论。"],
  ["Guided run and journal", "分步调查与记录"],
  ["Proof and source review", "证据与解答复核"],
  ["Exposed testimony contradiction", "已揭示的证词矛盾"],
  ["hear witness · 2/7 个调查步骤", "听取证词 · 2/7 个调查步骤"],
  ["building", "建筑"],
  ["Agent", "角色决策"]
];
for (const [original, expected] of samples) {
  assert.equal(localize(original), expected, original);
  assert.equal(localize(localize(original)), expected, `double projection is stable: ${original}`);
  assert.equal(localize(original, "en-US"), catalog.localizePublicText(original, "en-US"), `new projections preserve the established English output: ${original}`);
  checks += 3;
}

for (const text of ["My theory is that the note is forged.", "Challenge testimony-template-42", "Missing: An unknown player phrase.", "Theory rejected: Unknown explanation.", "The witnesses disagree about the method."]) {
  assert.equal(localize(text), text, "unknown prose is not rewritten by a broad translation rule");
  checks += 1;
}
for (const key of ["error.join", "error.search", "error.question", "error.submit", "error.generic"]) {
  assert.match(catalog.formatLocaleMessage("zh-CN", key), /未能确认|尚未确认/);
  assert.doesNotMatch(catalog.formatLocaleMessage("zh-CN", key), /未保存|未新增|未改变|认证|处理器/);
  checks += 2;
}
assert.match(catalog.formatLocaleMessage("zh-CN", "gap.motive"), /动机证据组/);
assert.match(catalog.formatLocaleMessage("zh-CN", "gap.method"), /手法证据组/);
checks += 2;
const board = await fs.readFile(new URL("../app/components/CinematicDeductionBoard.tsx", import.meta.url), "utf8");
const chineseCopy = board.slice(board.indexOf("const copy = cn ? {"), board.indexOf("} : {", board.indexOf("const copy = cn ? {")));
assert.doesNotMatch(chineseCopy, /认证|权威|处理器|复用|提交将产生世界后果/);
checks += 1;

const visibleFlag = process.argv.indexOf("--visible-text");
let visibleTextAudit = { status: "not-run", reason: "No browser text capture supplied. Dictionary tests do not prove page completeness." };
if (visibleFlag >= 0) {
  const capturePath = process.argv[visibleFlag + 1];
  assert.ok(capturePath, "--visible-text requires a plain-text browser capture");
  const visibleText = await fs.readFile(capturePath, "utf8");
  assert.ok(visibleText.trim(), "browser text capture is not empty");
  const forbidden = /Challenge testimony|Submit theory|(?:Source\s*复核)|\b(?:certified|authority|handler)\b|认证处理器|案件权威|类型化处理器|第二套选择状态|Can challenge testimony or timeline|can test this public claim|Local Gazette|REPEATED A PARTIAL ACCOUNT|WAS FOUND DEAD AFTER|A PUBLIC ROLLCALL|The rejected public theory|Recovery action ready|Recovery scheduled|Advance Persistent Town until|Between cases:|Choose Headquarters preparation|Complete one public theory-review interval|Focus witness|hear witness|test statement|build proof chain|test theory|one safe gap|audit result|Guided run and journal|Proof and source review|Recorded testimony claim|当前 theory workspace|复核 conclusion|复核 does not rewrite|Exposed testimony contradiction/gi;
  const compositeLeaks = /(?:Restricted type block|Cancelled billing notice|Box-office handoff|Replaced display sheet)可以用来检验|Read each clue as one stage in a public account's revision and distribution|where were you during the crime window|Public duties or recent case contact are limiting attention/gi;
  const matches = [...visibleText.matchAll(forbidden), ...visibleText.matchAll(compositeLeaks)].map((match) => match[0]);
  assert.deepEqual(matches, [], "captured first-case UI contains no known mixed-language or implementation-copy defects");
  visibleTextAudit = { status: "passed", capturePath, characters: visibleText.length, limitation: "Checks this supplied capture only; it is not a full UI or human-comprehension result." };
}
console.log(JSON.stringify({ ok: true, suite: "first-case-copy", checks, scope: "Exact first-case action and result wording; no content clues or judgement rules changed.", visibleTextAudit }, null, 2));
