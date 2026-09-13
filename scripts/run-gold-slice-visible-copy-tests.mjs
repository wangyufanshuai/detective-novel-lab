import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";
import { sha256Json } from "./v11-alpha-evidence-lib.mjs";

// Independent red/green regression for strings captured in the production UI.
// No engine fixture, server, build output, or authority input is modified.
const source = await fs.readFile(new URL("../app/localization/midnight-chorus-gold-slice-locale.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { localizeMidnightChorusGoldSlice: localize } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const fixtures = [
  ["Town Hall", "市政厅"],
  ["Objective updated", "目标已更新"],
  ["Institution", "机构"],
  ["Pressure", "压力"],
  ["Reaction", "反应"],
  ["Advance Town held", "暂缓推进小镇"],
  ["Follow the single Current world action; case truth and route certification remain unchanged.", "继续执行当前行动；案件真相和调查规则不会改变。"],
  ["Follow the single 当前 world action; case truth and route certification remain unchanged.", "继续执行当前行动；案件真相和调查规则不会改变。"],
  ["Resolve Observe case window first.", "先完成“观察现场”。"],
  ["Resolve 观察现场 first.", "先完成“观察现场”。"],
  ["Resolve 复核案发时段 first.", "先完成“观察现场”。"],
  ["Use the existing certified handler for search; map selection costs no town time and only Advance Town moves the simulation clock.", "搜索所选地点。切换地图对象不消耗时间；只有“推进小镇”会推动小镇时钟。"],
  ["session pending", "等待加入调查"],
  ["case window", "案发时段"],
  ["Merchants Guild", "商人公会"],
  ["Keeping a careful public watch while pressure remains visible.", "公开压力尚未消退，正在谨慎关注周围动向。"],
  ["Available with public pressure", "承受公开压力，仍可交谈"],
  ["neutral · no recorded player-authoritative change", "中立 · 尚无玩家行动引起的立场变化"],
  ["3 / current", "3 / 当前"],
  ["Another command is still resolving.", "另一项行动仍在结算，请稍候。"],
  ["The current investigation command is still resolving.", "当前调查行动仍在结算，请稍候。"],
  ["Follow the single current world action; case truth and route certification remain unchanged.", "继续执行当前行动；案件真相和调查规则不会改变。"],
  ["Playable case extracted. Review the Case Intake, then join the investigation.", "案件已就绪。请先阅读接案信息，再加入调查。"],
  ["Evidence found: Cancelled billing notice", "已发现证据：撤销署名通知"],
  ["发现证据: Cancelled billing notice", "已发现证据：撤销署名通知"],
  ["2/7 certified steps", "2/7 个调查步骤"]
];
const results = [];
function check(label, run) {
  try { run(); results.push({ label, status: "automated-pass" }); }
  catch (error) { results.push({ label, status: "failed", actual: error.actual, expected: error.expected }); }
}
for (const [english, chinese] of fixtures) {
  check(`zh-CN: ${english}`, () => assert.equal(localize(english, "zh-CN"), chinese));
  check(`en-US preserved: ${english}`, () => assert.equal(localize(english, "en-US") ?? english, english));
}
for (const unknown of ["stepwise", "unrecorded", "current-location", "candidate-step-12", "npc-Guarded", "Unknown player-authored sentence.", "Resolve mystery-control first."]) {
  check(`unknown preserved: ${unknown}`, () => assert.equal(localize(unknown, "zh-CN"), undefined));
}
const failures = results.filter((item) => item.status === "failed");
const body = {
  suite: "gold-slice-visible-copy",
  sourceHash: sha256Json(source),
  sourceEvidence: "outputs/v11-alpha/gold-slice-zh-visible-20260906.json",
  ok: failures.length === 0,
  checks: results.length,
  passed: results.length - failures.length,
  failed: failures.length,
  failures,
  results
};
const report = { schema: "detective-town.gold-slice-visible-copy.v1", generatedAt: new Date().toISOString(), ...body, evidenceHash: sha256Json(body) };
if (process.argv.includes("--evidence")) {
  const directory = new URL("../outputs/v11-alpha/", import.meta.url);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(new URL("gold-slice-visible-copy.json", directory), `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
