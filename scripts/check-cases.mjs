// Case author's self-check. Run after every edit to a case file:
//
//   node scripts/check-cases.mjs              rules + series + auto-playthrough of every case
//   node scripts/check-cases.mjs --no-play    rules and series only (seconds)
//   node scripts/check-cases.mjs --reference  rewrite docs/cases/riverbend-world-reference.md
//
// Exit code 0 means every case is valid, consistent with the others, and can be
// played from commission to accepted verdict through the real game commands.
// See docs/cases/CASE-AUTHORING.md.
import fs from "node:fs";
import path from "node:path";
import { createNoirTestLoader } from "./noir-player-test-loader.mjs";

const args = new Set(process.argv.slice(2));
const root = process.cwd();
const run = fs.mkdtempSync(path.join(root, "outputs", "check-cases-"));
process.env.DATABASE_URL = path.join(run, "isolated.db");
const { load } = createNoirTestLoader(root);
const { createRiverbendWorld, RIVERBEND_PLAY_DAYS, RIVERBEND_VISITABLE_SCENES } = load("packages/engine/src/riverbend-world.ts");
const { RIVERBEND_CASES } = load("packages/engine/src/riverbend-case.ts");
const { buildCasePackage, validateCaseSeries } = load("packages/engine/src/case-pack.ts");
const { buildTravelConstraint, shortestTravelMinutes } = load("packages/engine/src/world-analysis.ts");
// Interior rooms live in the client bundle (three.js geometry); only their spot keywords are read here.
process.noDeprecation = true;
const { ROOMS, spotForLabel } = load("app/town-play/interior-rooms.ts");
const { weatherAt, weatherWord, washesAwayAt, thickFogHours, evidenceWeatherBlock } = load("packages/engine/src/riverbend-weather.ts");

const world = createRiverbendWorld({ worldId: "case-check", now: "2026-10-08T08:00:00Z" }).world;
const roads = buildTravelConstraint(world);
const npcName = id => world.npcs.find(n => n.id === id)?.name ?? id;
const placeName = id => world.locations.find(l => l.id === id)?.name ?? id;
const travel = (a, b) => shortestTravelMinutes(roads, a, b);
const minutes = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const dayOf = pack => pack.day ?? 1;
/** Minutes since day 1 00:00: a day-2 move comes after every day-1 move. */
const at = (day, time) => (day - 1) * 1440 + minutes(time);
const when = (day, time) => `第 ${day} 天 ${time}`;
const visitable = new Set(RIVERBEND_VISITABLE_SCENES);
const problems = [];
const report = (pack, message) => problems.push(`[${pack?.key ?? "series"}] ${message}`);

/** Author-facing rules, checked before the engine so messages say what to fix. */
function lint(pack) {
  const npcs = new Set(world.npcs.map(n => n.id)), places = new Set(world.locations.map(l => l.id));
  const say = message => report(pack, message);
  if (!/^\d\d:\d\d$/.test(pack.window.from) || !/^\d\d:\d\d$/.test(pack.window.to) || pack.window.from > pack.window.to) say(`window 应写成 { from: "HH:MM", to: "HH:MM" } 且 from ≤ to`);
  if (pack.window.to > "08:00") say(`window 必须在 08:00 之前结束：玩家每天 08:00 起在镇上活动，案发历史只能写在当天早上 8 点以前`);
  if (pack.day !== undefined && (!Number.isInteger(pack.day) || pack.day < 1 || pack.day > RIVERBEND_PLAY_DAYS)) say(`day 只能是 1—${RIVERBEND_PLAY_DAYS} 的整数（不写就是第 1 天）；现在是 ${pack.day}`);
  const before = RIVERBEND_CASES.find(p => p.key === pack.after);
  if (before && dayOf(pack) < dayOf(before)) say(`本案在第 ${dayOf(pack)} 天，却排在第 ${dayOf(before)} 天的 ${before.key} 之后；day 不能比前一宗早`);
  const numbers = pack.evidence.map(e => e.n);
  numbers.forEach((n, i) => { if (n !== i + 1) say(`evidence 的 n 必须从 1 开始连续编号；第 ${i + 1} 条写成了 ${n}`); });
  if (pack.evidence.length < 4) say(`至少需要 4 份物证（现在 ${pack.evidence.length} 份）`);
  const clue = n => pack.evidence.find(e => e.n === n);
  for (const e of pack.evidence) {
    if (!visitable.has(e.at)) say(`物证 ${e.n}「${e.title}」放在 ${e.at}，玩家进不去。只能放在：${[...visitable].join(", ")}`);
    for (const id of [...e.related, ...(e.contradicts ?? []), ...(e.needsPresent ? [e.needsPresent] : [])]) if (!npcs.has(id)) say(`物证 ${e.n} 提到了不存在的居民 ${id}`);
    const room = ROOMS[e.at];
    if (room && !e.search) say(`物证 ${e.n}「${e.title}」缺少 search（玩家在${room.title}里看到的搜查动作，例如「查看前台核页记录」）`);
    else if (room && !spotForLabel(room, e.search)) say(`物证 ${e.n} 的 search「${e.search}」在${room.title}里对不上任何家具。search 里要包含下列某个关键词：${room.spots.filter(sp => sp.keywords.length).map(sp => `${sp.name}（${sp.keywords.join("/")}）`).join("；")}`);
    if (!pack.history.some(h => h.clue === e.n)) say(`物证 ${e.n}「${e.title}」没有来源：history 里至少要有一条 clue: ${e.n}`);
  }
  for (const id of pack.commission.openAt) if (!visitable.has(id)) say(`commission.openAt 里的 ${id} 不是可进入的地点`);
  for (const h of pack.history) {
    if (!places.has(h.at)) say(`history「${h.key}」的地点 ${h.at} 不存在`);
    for (const id of h.actors) if (!npcs.has(id)) say(`history「${h.key}」提到了不存在的居民 ${id}`);
    if (h.time < pack.window.from || h.time > pack.window.to) say(`history「${h.key}」${h.time} 超出了本案的 window ${pack.window.from}—${pack.window.to}`);
    if (h.clue && !clue(h.clue)) say(`history「${h.key}」引用了不存在的物证 ${h.clue}`);
    for (const n of h.contradictedBy ?? []) if (!clue(n)) say(`history「${h.key}」的 contradictedBy 引用了不存在的物证 ${n}`);
  }
  const keys = pack.history.map(h => h.key);
  if (new Set(keys).size !== keys.length) say(`history 的 key 有重复`);
  for (const [name, key] of Object.entries(pack.events)) {
    if (name === "scene" || name === "prep") { if (!places.has(key)) say(`events.${name} 应是地点 id，${key} 不存在`); continue; }
    for (const k of [key].flat()) if (!keys.includes(k)) say(`events.${name} 指向不存在的 history「${k}」`);
  }
  if (pack.history.filter(h => h.type === "incident").length !== 1) say(`history 里必须恰好有一条 type: "incident"（被发现的那一刻）`);
  for (const npc of world.npcs) if (!pack.statements[npc.id]) say(`缺少 ${npc.name}（${npc.id}）的 statements：每位居民都要有一段可以当面询问的说法`);
  if (!pack.suspectIds.includes(pack.culpritId)) say(`culpritId 必须在 suspectIds 里`);
  for (const id of pack.suspectIds) if (id !== pack.culpritId && !pack.exclusions.some(x => x.characterId === id)) say(`嫌疑人 ${npcName(id)} 没有排除理由：exclusions 里要为每个非真凶的嫌疑人写一条`);
  if (!Object.keys(pack.revisions).length) say(`至少需要一处「物证改正说法」：revisions 不能为空`);
  for (const [npcId, byClue] of Object.entries(pack.revisions)) for (const n of Object.keys(byClue).map(Number)) {
    const e = clue(n);
    if (!e) { say(`revisions.${npcName(npcId)} 用了不存在的物证 ${n}`); continue; }
    if (!(e.contradicts ?? []).includes(npcId)) say(`物证 ${n} 能改正 ${npcName(npcId)} 的说法，所以它的 contradicts 里要写上 ${npcId}`);
    if (!pack.history.some(h => (h.contradictedBy ?? []).includes(n) && h.actors.includes(npcId))) say(`${npcName(npcId)} 被物证 ${n} 改正，需要一条有 ${npcName(npcId)} 参与、并写了 contradictedBy: [${n}] 和 publicVersion 的 history`);
  }
  for (const n of [...pack.answer.motive, ...pack.answer.method, ...pack.decisive]) if (!clue(n)) say(`answer/decisive 引用了不存在的物证 ${n}`);
  for (const e of pack.evidence) {
    if (e.weather === undefined) continue;
    if (e.weather !== "washes-away" && e.weather !== "needs-clear-air") { say(`物证 ${e.n} 的 weather 只能是 "washes-away" 或 "needs-clear-air"，现在是 ${JSON.stringify(e.weather)}`); continue; }
    if (e.weather === "washes-away" && [...pack.answer.motive, ...pack.answer.method, ...pack.decisive].includes(e.n)) say(`物证 ${e.n}「${e.title}」会被雨冲掉（weather: "washes-away"），不能放进 answer 或 decisive：玩家错过了就再也结不了案`);
    if (e.weather === "needs-clear-air" && !thickFogHours(dayOf(pack)).length) say(`物证 ${e.n} 写了 weather: "needs-clear-air"，可是第 ${dayOf(pack)} 天白天没有浓雾，这个条件不起作用`);
  }
}

/** Every resident's moves across all cases, with the case that put them there. */
function journeys(packs) {
  const moves = new Map();
  for (const pack of packs) for (const h of pack.history) for (const id of h.actors) {
    if (!moves.has(id)) moves.set(id, []);
    moves.get(id).push({ day: dayOf(pack), time: h.time, at: h.at, key: h.key, case: pack.key });
  }
  for (const list of moves.values()) list.sort((a, b) => at(a.day, a.time) - at(b.day, b.time));
  return moves;
}
function journeyProblems(packs) {
  for (const [id, list] of journeys(packs)) for (let i = 1; i < list.length; i++) {
    const a = list[i - 1], b = list[i], need = travel(a.at, b.at), have = at(b.day, b.time) - at(a.day, a.time);
    if (need > have) report(null, `${npcName(id)} 赶不上：${when(a.day, a.time)} 在${placeName(a.at)}（${a.case}/${a.key}）→ ${when(b.day, b.time)} 在${placeName(b.at)}（${b.case}/${b.key}），只有 ${have} 分钟，路上至少要 ${need} 分钟`);
  }
}

function writeReference() {
  const ids = world.locations.map(l => l.id);
  const lines = ["# 河湾世界参考（自动生成）", "", "由 `node scripts/check-cases.mjs --reference` 生成，不要手改。写案件前先读这一页。", "",
    "## 地点", "", "| id | 名称 | 玩家能进入调查 |", "|---|---|---|", ...world.locations.map(l => `| \`${l.id}\` | ${l.name} | ${visitable.has(l.id) ? "是" : "否（只能出现在 history 里）"} |`), "",
    "## 步行时间（分钟，最短路线）", "", `| 从 \\ 到 | ${ids.map(id => `\`${id}\``).join(" | ")} |`, `|---|${ids.map(() => "---").join("|")}|`,
    ...ids.map(a => `| \`${a}\` | ${ids.map(b => travel(a, b)).join(" | ")} |`), "",
    "## 室内可搜查的家具", "", "物证的 `search` 文字里包含某件家具的关键词，搜查点就落在那件家具上；同时命中几件时，取下表里排在前面的那件。对不上任何关键词会被 check-cases 报错。", "",
    "| 地点 | 家具 | 关键词 |", "|---|---|---|",
    ...Object.values(ROOMS).flatMap(r => r.spots.filter(sp => sp.keywords.length).map(sp => `| \`${r.sceneId}\` ${r.title} | ${sp.name}${sp.desk ? "（领取手记处）" : ""} | ${sp.keywords.join("、")} |`)), "",
    "## 天气（固定，每位玩家都一样）", "",
    "物证可以写 `weather`：`\"washes-away\"` 表示户外痕迹，案件开始（当天 08:00）后的第一场大雨会冲掉它，之后就搜不到了，所以不能放进 answer 或 decisive；`\"needs-clear-air\"` 表示要隔着距离看的东西，浓雾时不能核对，雾散后就可以。案件历史（08:00 以前）里提到的天气要和下表一致。", "",
    "| 天 | 06:00 | 08:00 | 10:00 | 12:00 | 14:00 | 16:00 | 18:00 | 20:00 | 浓雾时段 | 第一场大雨（washes-away 的痕迹在此后消失） |", "|---|---|---|---|---|---|---|---|---|---|---|",
    ...Array.from({ length: RIVERBEND_PLAY_DAYS }, (_, i) => i + 1).map(d => `| ${d} | ${[6, 8, 10, 12, 14, 16, 18, 20].map(h => weatherWord(weatherAt(d, h), h)).join(" | ")} | ${thickFogHours(d).join("，") || "无"} | ${washesAwayAt(d, RIVERBEND_PLAY_DAYS) ?? "三天内不下大雨"} |`), "",
    "## 居民", "", `游戏共 ${RIVERBEND_PLAY_DAYS} 天。每天 08:00 起居民按日程走动，19:00 回家；玩家傍晚在旅馆过夜，醒来是第二天 08:00。案件历史只写某一天 08:00 以前（用 day 指定哪一天）。询问居民时，玩家要在游戏里找到他本人。`, "",
    "| id | 姓名 | 身份 | 家 | 08:00 | 12:00 | 14:00 | 16:00 | 19:00 | 私事（可以用作动机或隐瞒的理由） |", "|---|---|---|---|---|---|---|---|---|---|",
    ...world.npcs.map(n => `| \`${n.id}\` | ${n.name} | ${n.role} | ${n.homeLocationId} | ${n.schedule["08:00"]} | ${n.schedule["12:00"]} | ${n.schedule["14:00"]} | ${n.schedule["16:00"]} | ${n.schedule["19:00"]} | ${n.secret} |`), "",
    "## 已经写好的案件", "", "| 顺序 | key | 标题 | 第几天 | 时间窗 | 真凶 | 在哪里领取 |", "|---|---|---|---|---|---|---|",
    ...RIVERBEND_CASES.map((p, i) => `| ${i + 1} | \`${p.key}\` | ${p.title} | ${dayOf(p)} | ${p.window.from}—${p.window.to} | ${npcName(p.culpritId)} | ${p.commission.openAt.join(", ")} |`), "",
    "## 居民在已有案件里的行踪", "", "新案件里同一位居民的行踪必须和这里接得上（来得及走过去）。没有列出的时间都是空闲的。", ""];
  const moves = journeys(RIVERBEND_CASES);
  for (const npc of world.npcs) {
    const list = moves.get(npc.id) ?? [];
    lines.push(`- **${npc.name}**：${list.length ? list.map(m => `${when(m.day, m.time)} ${placeName(m.at)}（${m.case}）`).join("；") : "空闲"}`);
  }
  const file = path.join(root, "docs", "cases", "riverbend-world-reference.md");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join("\n") + "\n");
  console.log(`已写入 ${path.relative(root, file)}`);
}

/** Plays every case in order through the real save and command handlers. */
function playthrough(bundles) {
  const repository = load("lib/world/repository.ts");
  const { startTownPlay, commandTownPlay } = load("lib/world/town-exploration-store.ts");
  try {
    const started = startTownPlay();
    let view = started.result.view, n = 0;
    const act = input => { view = commandTownPlay(started.credentials, { ...input, actionId: `check-${++n}`, expectedSessionRevision: view.revision, expectedWorldRevision: view.worldRevision }).view; return view; };
    const seen = id => view.residents.some(p => p.npcId === id && p.visibility === "observed");
    const find = (id, prefer) => {
      const order = [...new Set([prefer, ...RIVERBEND_VISITABLE_SCENES, "town-square"].filter(Boolean))];
      for (let round = 0; round < 10; round++) {
        for (const sceneId of prefer ? [prefer] : order) { act({ kind: "arrive", sceneId }); if (seen(id)) return; }
        act({ kind: "wait", minutes: 30 });
      }
      throw new Error(`游戏里找不到 ${npcName(id)}${prefer ? `（在${placeName(prefer)}等了五个小时）` : ""}`);
    };
    // A later-day case: go to the inn, wait for the evening, sleep until its morning.
    const sleepUntil = day => {
      while (view.day < day) {
        act({ kind: "arrive", sceneId: "inn" });
        while (!view.rest?.open) act({ kind: "wait", minutes: 60 });
        act({ kind: "rest" });
      }
    };
    for (const { pack } of bundles) {
      const step = label => { stepLabel = label; };
      let stepLabel = "";
      try {
        if (dayOf(pack) > view.day) { step(`在旅馆过夜，等到第 ${dayOf(pack)} 天早上`); sleepUntil(dayOf(pack)); }
        step(`在 ${pack.commission.openAt[0]} 领取委托`);
        act({ kind: "arrive", sceneId: pack.commission.openAt[0] });
        act({ kind: "case-open" });
        if (view.investigation?.title !== pack.title) throw new Error(`领取到的是「${view.investigation?.title}」，不是本案`);
        // Like a careful player: marks the rain will wash away first, and wait out thick fog.
        const order = pack.evidence.map((e, i) => ({ e, i })).sort((a, b) => Number(b.e.weather === "washes-away") - Number(a.e.weather === "washes-away"));
        for (const { e, i } of order) {
          step(`搜查物证 ${e.n}「${e.title}」`);
          if (e.needsPresent) find(e.needsPresent, e.at); else act({ kind: "arrive", sceneId: e.at });
          for (let round = 0; e.weather === "needs-clear-air" && evidenceWeatherBlock(e.weather, dayOf(pack), { day: view.day, currentTime: view.time }, RIVERBEND_PLAY_DAYS); round++) {
            if (round > 24) throw new Error(`等了十二个小时，雾还没散，搜不了物证 ${e.n}`);
            act({ kind: "wait", minutes: 30 });
          }
          act({ kind: "case-search", targetId: `${pack.ids.search}-${i + 1}` });
        }
        if (view.investigation.clues.length !== pack.evidence.length) throw new Error(`只找到 ${view.investigation.clues.length}/${pack.evidence.length} 份物证`);
        const wrong = pack.suspectIds.find(id => id !== pack.culpritId);
        const theory = culpritId => ({ culpritId, motive: "", method: "", evidenceIds: view.investigation.clues.map(c => c.id), proof: { motiveEvidenceIds: pack.answer.motive.map(n => `${pack.ids.clue}-${String(n).padStart(2, "0")}`), methodEvidenceIds: pack.answer.method.map(n => `${pack.ids.clue}-${String(n).padStart(2, "0")}`) } });
        step(`用错误的嫌疑人 ${npcName(wrong)} 提交（应被驳回）`);
        act({ kind: "case-submit", theory: theory(wrong) });
        if (view.investigation.solved) throw new Error(`指认 ${npcName(wrong)} 也能结案：排除依据不够`);
        for (const [npcId, byClue] of Object.entries(pack.revisions)) {
          step(`询问并核对 ${npcName(npcId)}`);
          find(npcId);
          act({ kind: "case-question", characterId: npcId });
          for (const n of Object.keys(byClue)) {
            act({ kind: "case-challenge", characterId: npcId, evidenceId: `${pack.ids.clue}-${String(n).padStart(2, "0")}` });
            if (!view.investigation.conversations.at(-1)?.corrected) throw new Error(`出示物证 ${n} 后，${npcName(npcId)} 的说法没有被改正`);
          }
        }
        step(`按 answer 提交正确结论`);
        act({ kind: "case-submit", theory: theory(pack.culpritId) });
        if (!view.investigation.solved) throw new Error(`正确结论没有被接受。检查 answer.motive / answer.method 是否就是证明动机和手法的物证，以及 decisive 和 reasoning`);
        console.log(`  ✓ ${pack.key}《${pack.title}》从领取到结案可以玩通（游戏内时间 第 ${view.day} 天 ${view.time}）`);
      } catch (error) {
        report(pack, `试玩卡在「${stepLabel}」：${error.message}`);
        return;
      }
    }
  } finally { repository.closeDatabase(); }
}

if (args.has("--reference")) { writeReference(); process.exit(0); }

console.log(`检查 ${RIVERBEND_CASES.length} 个案件：${RIVERBEND_CASES.map(p => p.key).join(", ")}`);
const bundles = [];
for (const pack of RIVERBEND_CASES) {
  const before = problems.length;
  lint(pack);
  if (problems.length > before) continue;
  try { bundles.push({ pack, bundle: buildCasePackage(world, pack, world.createdAt) }); }
  catch (error) {
    // Journey problems are reported below in plain words; keep the engine's other findings.
    const rest = error.message.replace(/^Case [^ ]+ authoring failed: /, "").split("; ").filter(m => !m.startsWith("Impossible historical journey"));
    if (rest.length) report(pack, `引擎校验未通过：${rest.join("；")}`);
  }
}
journeyProblems(RIVERBEND_CASES);
if (bundles.length === RIVERBEND_CASES.length) for (const message of validateCaseSeries(world, bundles)) if (!message.startsWith("Across cases: Impossible")) report(null, message);
if (!problems.length && !args.has("--no-play")) { console.log("自动试玩（真实存档与命令，约一到两分钟）："); playthrough(bundles); }

if (problems.length) {
  console.log(`\n✗ ${problems.length} 个问题：`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
fontNotice();
console.log(`\n✓ 全部通过${args.has("--no-play") ? "（未试玩）" : ""}`);

/** Not a failure: missing characters still render, from the larger "rest" font file. */
function fontNotice() {
  let core = "";
  try { core = JSON.parse(fs.readFileSync(path.join(root, "public/fonts/noir/sources.json"), "utf8")).split?.coreHanChars ?? ""; } catch { return; }
  if (!core) return;
  const have = new Set(core);
  const text = fs.readdirSync(path.join(root, "packages/engine/src/cases")).map(f => fs.readFileSync(path.join(root, "packages/engine/src/cases", f), "utf8")).join("");
  const missing = [...new Set([...text].filter(c => /\p{Script=Han}/u.test(c) && !have.has(c)))];
  if (missing.length) console.log(`\n提示：案件里有 ${missing.length} 个字不在首屏字体里（${missing.slice(0, 20).join("")}${missing.length > 20 ? "…" : ""}）。能正常显示，但会多下载一份字体。请告诉前端负责人运行 python scripts/split-noir-fonts.py。`);
}
