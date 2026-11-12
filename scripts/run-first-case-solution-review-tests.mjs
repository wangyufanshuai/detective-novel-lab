import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

async function moduleUrl(relative, replacements = {}) {
  const source = await fs.readFile(new URL(`../${relative}`, import.meta.url), "utf8");
  let compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  for (const [specifier, target] of Object.entries(replacements)) compiled = compiled.replaceAll(JSON.stringify(specifier), JSON.stringify(target));
  return `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
}

const cinematicUrl = await moduleUrl("app/campaign/cinematic-deduction-model.ts");
const reviewUrl = await moduleUrl("app/campaign/first-case-solution-review-model.ts", { "./cinematic-deduction-model": cinematicUrl });
const { buildFirstCaseSolutionReview: build, isFirstCaseSolutionReview: enabled } = await import(reviewUrl);
const catalogUrl = await moduleUrl("app/localization/locale-catalog.ts");
const goldUrl = await moduleUrl("app/localization/midnight-chorus-gold-slice-locale.ts");
const localeModule = `import {localizePublicText} from ${JSON.stringify(catalogUrl)};
import {localizeMidnightChorusGoldSlice} from ${JSON.stringify(goldUrl)};
export const useAppLocale=()=>({locale:"zh-CN",text:(value)=>{const p=localizePublicText(value,"zh-CN"); return localizeMidnightChorusGoldSlice(p,"zh-CN")||p;}});`;
const localeUrl = `data:text/javascript;base64,${Buffer.from(localeModule).toString("base64")}`;
const assetsUrl = await moduleUrl("app/campaign/noir-player-assets.ts");
const cssUrl = `data:text/javascript;base64,${Buffer.from('export default new Proxy({}, { get: (_target, key) => String(key) });').toString("base64")}`;
const componentUrl = await moduleUrl("app/components/FirstCaseSolutionReview.tsx", {
  "@/app/campaign/first-case-solution-review-model": reviewUrl,
  "@/app/localization/locale-context": localeUrl,
  "@/app/campaign/noir-player-assets": assetsUrl,
  "./FirstCaseSolutionReview.module.css": cssUrl,
  "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
  "lucide-react": import.meta.resolve("lucide-react")
});
const { FirstCaseSolutionReview } = await import(componentUrl);
const { text: localize } = (await import(localeUrl)).useAppLocale();
const render = (input) => renderToStaticMarkup(React.createElement(FirstCaseSolutionReview, input));

// Synthetic format fixture; these are unit checks, never participant records.
const revealText = [
  "本地规则复盘：凶手是韩照（npc-09）。",
  "动机：秦露告诉方以恒，明早会公开一份足以暴露其秘密的旧档案。",
  "手法：方以恒 dies after a complete simulated pressure chain involving 韩照.",
  "关键证据链：ev-means/Restricted type block、ev-motive/Cancelled billing notice、ev-opportunity/Box-office handoff、ev-staging/Replaced display sheet、ev-trace/Fresh ink transfer。",
  "源事件：caseview-ev-means-d1-1220-npc-08-npc-18-daily、caseview-ev-death-scene-agent-case-showcase-seed-30-npc-09-npc-08。"
].join("\n");
const checks = [];
for (const input of [{ accepted: false, revealText }, { accepted: true, revealText: "" }, { accepted: true, revealText: " \n " }, { accepted: false }]) {
  assert.deepEqual(build(input), { state: "locked" });
  assert.doesNotMatch(render(input), /韩照|秦露|方以恒|Restricted|受限铅字块/);
}
checks.push("accepted-and-returned-reveal-required");

const projected = build({ accepted: true, revealText, localize });
assert.equal(projected.state, "structured");
assert.equal(projected.culprit, "韩照");
assert.equal(projected.motive, "秦露告诉方以恒，明早会公开一份足以暴露其秘密的旧档案。");
assert.equal(projected.method, "方以恒在一系列涉及韩照的施压事件完整形成后死亡。");
assert.deepEqual(projected.evidenceTitles, ["受限铅字块", "撤销署名通知", "售票处交接", "被替换的展示页", "新鲜油墨转印"]);
assert.doesNotMatch(JSON.stringify(projected), /npc-|ev-|caseview-|agent-|mem-/);
const html = render({ accepted: true, revealText });
assert.match(html, /韩照/);
assert.match(html, /旧档案/);
assert.match(html, /施压事件完整形成后死亡/);
assert.match(html, /被替换的展示页/);
assert.match(html, /尚未逐条说明/);
assert.doesNotMatch(html, /npc-|ev-|caseview-|agent-|mem-|dies after|Restricted type/);
checks.push("returned-facts-and-all-evidence-preserved-without-internal-ids");

const changedFacts = revealText.replace("凶手是韩照", "凶手是林澈").replace("动机：秦露告诉方以恒，明早会公开一份足以暴露其秘密的旧档案。", "动机：返回记录中的不同动机。");
const changed = build({ accepted: true, revealText: changedFacts, localize, theory: { culpritId: "npc-09", motive: "不可作为答案的草稿" } });
assert.equal(changed.culprit, "林澈");
assert.equal(changed.motive, "返回记录中的不同动机。");
assert.doesNotMatch(JSON.stringify(changed), /不可作为答案的草稿/);
checks.push("facts-follow-returned-answer-never-editable-theory");

const extraNarrative = `${revealText}\n补充说明：此处保留返回的条件与限制。`;
const extra = build({ accepted: true, revealText: extraNarrative, localize });
assert.equal(extra.state, "returned-text");
assert.match(extra.paragraphs.join("\n"), /补充说明：此处保留返回的条件与限制/);
assert.match(extra.paragraphs.join("\n"), /旧档案/);
assert.match(extra.paragraphs.join("\n"), /受限铅字块/);
assert.doesNotMatch(extra.paragraphs.join("\n"), /npc-|ev-|caseview-/);
assert.match(render({ accepted: true, revealText: extraNarrative }), /其他格式/);
checks.push("unknown-or-extended-format-preserves-full-narrative");

const unfamiliar = "结论仍有条件：林澈的说法需要结合公开记录。\n补记：ev-unknown/陌生证据仍应保留。\n方法并未具体说明。";
const fallback = build({ accepted: true, revealText: unfamiliar, localize });
assert.equal(fallback.state, "returned-text");
assert.deepEqual(fallback.paragraphs, ["结论仍有条件：林澈的说法需要结合公开记录。", "补记：证据引用 1/陌生证据仍应保留。", "方法并未具体说明。"]);
checks.push("unfamiliar-facts-are-not-invented-or-silently-dropped");

const bareReferences = build({ accepted: true, revealText: "npc-09 出示 ev-means。\n随后 npc-09 解释 ev-means。", localize });
assert.deepEqual(bareReferences.paragraphs, ["角色编号 09 出示 证据引用 2。", "随后 角色编号 09 解释 证据引用 2。"]);
checks.push("bare-references-keep-stable-subject-and-evidence-relationships");

const ordinaryEnglish = "An agent-based explanation preserves agent-led observations. Technical references: agent-showcase-seed-4-npc-09, agent-case-showcase-seed-30-npc-09, mem-d1-0800-npc-09-direct.";
const ordinaryProjection = build({ accepted: true, revealText: ordinaryEnglish });
assert.match(ordinaryProjection.paragraphs[0], /An agent-based explanation preserves agent-led observations\./);
assert.doesNotMatch(ordinaryProjection.paragraphs[0], /agent-showcase-|agent-case-|mem-d1-/);
checks.push("ordinary-agent-compounds-survive-technical-reference-filter");

const campaign = { campaignLabel: "Midnight Chorus", routeLabel: "Public Reckoning" };
assert.equal(enabled("server", campaign, "The Printed Whisper"), true);
for (const input of [["static", campaign, "The Printed Whisper"], ["server", campaign, "The Missing Chorus"], ["server", campaign, "Print Whisper"], ["server", { ...campaign, routeLabel: "Backstage Compact" }, "The Printed Whisper"], ["server", undefined, "The Printed Whisper"]]) assert.equal(enabled(...input), false);
const page = await fs.readFile(new URL("../app/legacy/page.tsx", import.meta.url), "utf8");
assert.match(page, /isFirstCaseSolutionReview\(runtimeMode, campaignSession \|\| townRuntime\?\.campaignSessionSummary, activeCase\?\.deductionCase\.title\)/);
assert.match(page, /<FirstCaseSolutionReview accepted=\{Boolean\(session\?\.judgement\?\.accepted && session\.caseId === activeCase\?\.id && session\.worldId === world\?\.id\)\} revealText=\{revealText\} \/>/);
checks.push("only-fixed-first-case-uses-new-review-and-existing-reveal-gate");

console.log(JSON.stringify({ ok: true, suite: "first-case-solution-review", checks, limitation: "Synthetic source and server-render checks; a browser capture is still required for page acceptance." }, null, 2));
