import type { Character, DeductionCase, Evidence } from "./types";
import type { CaseFromLog, MemoryRecord, WorldEvent, WorldState } from "./world-types";
import { validateWorldCase } from "./world-case";
import { buildCaseQualityReport, buildTravelConstraint, shortestTravelMinutes } from "./world-analysis";
import { certifyPlayableCase } from "./route-certificate";

/** PRIVATE authored candidate. Never import values from this module in a client.
 * The opening happened before the playable 08:00 clock. It is not an emergent
 * agent-generated crime. Persist this package once; do not regenerate a save. */
export const RIVERBEND_CASE_REVISION = "riverbend-seventh-minute.v1";
const XU = "rb-xu-zhiwei", SONG = "rb-song-tang", ZHOU = "rb-zhou-yan";
const HAN = "rb-han-shuo", SHEN = "rb-shen-ying";
const clue = (n: number) => `rb-clue-${String(n).padStart(2, "0")}`;

export type RiverbendCaseScript = {
  revision: string;
  targets: Array<{ id: string; sceneId: string; label: string; evidenceId: string }>;
  statements: Record<string, string>;
  revisions: Record<string, Record<string, string>>;
  ending: string[];
};

export type RiverbendCasePackage = {
  caseFromLog: CaseFromLog;
  events: WorldEvent[];
  memories: MemoryRecord[];
  script: RiverbendCaseScript;
};

export function createRiverbendCase(world: WorldState, now: string): RiverbendCasePackage {
  const id = `${world.id}-seventh-minute-v1`;
  const eventId = (suffix: string) => `${id}-${suffix}`;
  const statements: Record<string, string> = {
    [SONG]: "我看见周砚抱着长纸筒离开书店，钟楼是七点十一分。后来我送咖啡过去，发现展台上变成了薄薄的描图纸；钟楼那时是七点二十八分。我一直按那个钟记的时间。两回我都只看见前门，没看见后巷。",
    [ZHOU]: "我拿的是邮局订的空白海报纸，纸筒也不是密封的。离开书店后，我在邮局跟陈蕙清点挂号件。不能只凭一根长纸筒就说里面有地图，请核对连续登记和收件内容。",
    [XU]: "原图是镇上暂存在这里的，我只是负责修复。江老师离开后我一直在修复桌边，早晨没有去车站。有人想把祖父的批注写进报道，我不喜欢那种口气，但不喜欢不等于拿走。",
    "rb-lu-xingzhou": "失踪的是镇档案室寄放的旧桥测绘原图，公众只能在展台前看。今早能接触展台和封条的有修复者、取纸的邮差、来校钟的维修工和预约拍照的记者。其他人隔着柜台。七点十分到七点四十五分，我和韩朔在钟楼的检修层互相照看。",
    "rb-chen-hui": "七点二十八到七点四十分，我与周砚一件一件核对挂号编号。他如果中途离开，我得独自保管他的投递袋；这段时间没有交接。我们用邮局的电波钟，不看钟楼。纸筒里的空白纸我当面数过。",
    "rb-gu-yuanshan": "七点四十二分，许知微把一只纸筒交进寄存柜。我们还说起一本没还的书，我认的是她本人。她在存根上签字，说下午回来取。寄存柜还没到开锁时间，你可以和我一起核对里面的物件。",
    "rb-bai-lu": "我忙着给桥头换花，没进过书店。旧桥图的展览牌是我昨天绑的，原来定在下午两点揭幕。若要问今早的时间，我帮不上忙；我的手机没电了。",
    "rb-lin-ali": "记者沈映今早在旅馆帮我核对旧客簿，七点二十到七点五十都坐在前台。两个人互报页码才勾得完，那不是她一个人的签名可以证明的。登记本和前台电波钟都在。",
    "rb-cheng-du": "我送过展台的木框，不是今天。旧书店到车站，沿咖啡馆那条路步行约十分钟，绕桥反而更远。地图大小可以卷入修复用的纸筒，但这只能说明放得下，不能说明谁拿过。",
    [SHEN]: "我预约了早晨拍摄，但被旅馆的客簿绊住了。许知微昨天请求我把祖父的批注从报道里拿掉，我没答应。文章想问的是当年的决定，不是给她祖父贴坏人的标签。林阿梨能说明我实际去了哪里。",
    [HAN]: "我早晨校了钟。七点十分到四十五分一直和陆行舟在检修层，拆出的停摆片、校时便笺和双方签字都在警务所。请读便笺上的误差方向，慢七分钟和快七分钟会得到相反的时间。",
    "rb-jiang-zhi": "我七点三十分离开书店，最后看了一眼原图：右下有祖父画的双水印和蓝色桥脚线，不是描图纸。我的表刚与车站标准钟对过。送咖啡的宋棠随后发现了替代品，我们各自在展品交接页写下时间。"
  };
  const evidenceRows: Array<[number, string, string, string, string, string[]]> = [
    [1, "books", "断开的蓝封条", "展台封条从背面用湿淀粉糊揭起，重新贴合处留下修复用的纤维。许知微的修复纸包编号 R17，外包缺了一块三角纸角。入店登记写明只有四名预约访客能接触展台，其他人由柜台隔开。", "封条能由修复工具无声揭开；需要与车站纸筒的断口一起证明使用者。", [XU]],
    [2, "books", "没有寄出的延期信", "许知微署名的信写着：『请把揭幕推迟一天。我还没找到祖父为何删去西岸住户的说明。把那条批注印出去，大家只会记得他划过谁的家。』展品委托书要求原图今天十四点公开。", "她想夺回公开历史的时间控制；这解释动机，不能单独证明盗取。", [XU, SHEN]],
    [3, "cafe", "早餐便笺上的两次钟面", "宋棠随手记着『钟楼 07:11，邮差出门』『钟楼 07:28，送咖啡时只剩描图』。两行都注明看的是钟楼；她未给手表对时。咖啡交接单由书店与咖啡馆各留一份。", "目击时间共用慢七分钟的钟；实际为 07:18 与 07:35。", [SONG, ZHOU]],
    [4, "police", "钟楼校时便笺", "电波校时器与车站、邮局标准钟一致。韩朔写明『07:10 检测：钟楼慢 7 分；07:45 调准』。陆行舟全程在检修层复核，两人签字。此间他们没有离开，书店不在检修层出口旁。", "纠正宋棠的两次目击时间，也排除检修期间的韩朔。", [HAN, "rb-lu-xingzhou", SONG]],
    [5, "post", "连续的挂号清点页", "邮局电波钟记时 07:28—07:40，陈蕙与周砚交替逐件签了十二个编号，无离岗交接。随件清单和陈蕙验收栏说明：长筒装的是空白海报纸，数量齐全。", "周砚在原图仍在展台之后一直位于邮局，纸筒是误导。", [ZHOU, "rb-chen-hui"]],
    [6, "inn", "前台双人核页记录", "林阿梨与沈映从 07:20 到 07:50 互报旧客簿页码，逐页写下同一处错号。前台电波钟记时，期间无休息或交接。沈映的书店摄影预约旁盖着『未到』。", "预约只是计划；连续的双人工作记录排除沈映。", [SHEN, "rb-lin-ali"]],
    [7, "station", "寄存柜里的原图", "顾远山与你共同开柜：原图的双水印、蓝桥脚线和档案章都在。纸筒包纸标为 R17，撕口与书店纸包缺角吻合。07:42 的存根由许知微当面签字，顾远山与她交谈过，不是凭衣服认人。原图由站员重新封存，等待警方接收；你带走的是共同清点的收据。", "原图和特定修复纸的连续保管链，把揭封、携走与寄存连起来，否定许知微未离店的说法。", [XU, "rb-gu-yuanshan"]],
    [8, "books", "展品交接页", "江芷按刚校准的手表写下『07:30 离店，原图双水印仍在』。宋棠写下『送咖啡时钟楼 07:28，已是描图』。后巷可通咖啡馆再到车站，全程十分钟。07:30 之后柜台没有接待其他预约访客。", "盗取窗口是 07:30—07:35；07:32 离店的人足以在 07:42 到车站。", [XU, "rb-jiang-zhi", SONG]]
  ];
  const evidence: Evidence[] = evidenceRows.map(([n, location, title, visibleDescription, trueMeaning, relatedCharacterIds]) => ({ id: clue(n), title, location, visibleDescription, trueMeaning, relatedCharacterIds, discoverable: true, isKey: true, unlocks: [], contradicts: n === 4 ? [SONG] : n === 7 ? [XU] : [], supportsConclusion: [], discoveryDifficulty: "easy" }));
  const events: WorldEvent[] = [];
  const add = (suffix: string, time: string, locationId: string, type: WorldEvent["type"], actorIds: string[], summary: string, tags: string[] = [], evidenceNumber?: number) => {
    const event: WorldEvent = { id: eventId(suffix), worldId: world.id, day: 1, time, locationId, type, actorIds, relatedCharacterIds: [...actorIds], summary, publicSummary: "河湾旧桥展品的案前记录。", hidden: true, tags: ["riverbend-authored-history", ...tags], ...(evidenceNumber ? { evidenceId: clue(evidenceNumber) } : {}) };
    events.push(event); return event;
  };
  add("delay", "07:05", "books", "conflict", [XU], "许知微读到拒绝延期的答复，把未寄出的延期信留在修复桌上。", ["motive"], 2);
  add("repair", "07:10", "police", "alibi", [HAN, "rb-lu-xingzhou"], "韩朔与陆行舟进入检修层，记录钟楼慢七分钟；两人到 07:45 才离开。", ["clock", "alibi"], 4);
  add("inn", "07:20", "inn", "alibi", [SHEN, "rb-lin-ali"], "沈映与林阿梨开始连续核页，直到 07:50，期间无人离开。", ["alibi"], 6);
  add("courier", "07:18", "cafe", "witness", [SONG], "宋棠从咖啡馆门口看见周砚离开书店，钟楼显示 07:11。", [], 3);
  add("courier-depart", "07:18", "books", "move", [ZHOU], "周砚离开书店，经过警务所去邮局。");
  add("courier-via", "07:23", "police", "move", [ZHOU], "周砚经过警务所外道路。");
  add("mail", "07:28", "post", "alibi", [ZHOU, "rb-chen-hui"], "周砚与陈蕙开始逐件清点，至 07:40 未离岗。海报纸在两人面前验收。", ["alibi"], 5);
  add("last-original", "07:30", "books", "witness", [XU, "rb-jiang-zhi"], "江芷离店时看见原图。许知微独自在修复桌与展台之间，柜台未再接待预约访客。", ["opportunity"], 8);
  add("seal", "07:31", "books", "obtain_item", [XU], "许知微用修复糊揭起封条，以描图替换原图，把原图装进 R17 修复纸包裹的纸筒。", ["means", "staging"], 1);
  add("leave", "07:32", "books", "move", [XU], "许知微由后巷离开，沿咖啡馆前道路走向车站。");
  add("copy-found", "07:35", "books", "incident", [SONG], "宋棠送到咖啡，发现展台只剩描图纸，钟楼显示 07:28。", ["nonfatal_incident"]);
  add("via-cafe", "07:37", "cafe", "move", [XU], "许知微经过咖啡馆外道路，继续去车站。");
  add("deposit", "07:42", "station", "forensic_clue", [XU, "rb-gu-yuanshan"], "许知微当面签字寄存原图；顾远山锁柜，保留存根。", ["trace", "means"], 7);
  add("depart-station", "07:47", "station", "move", [XU], "许知微离开车站，原路返回书店。");
  add("return-cafe", "07:52", "cafe", "move", [XU], "许知微回程经过咖啡馆外道路。");
  add("return-books", "07:57", "books", "move", [XU], "许知微回到书店。");
  add("notice", "08:00", "police", "conversation", ["rb-lu-xingzhou"], "警务所张贴旧桥原图失踪的受理通知。");

  const revisions: RiverbendCaseScript["revisions"] = {
    [SONG]: { [clue(4)]: "是我把钟面当成标准时间了。慢七分钟，要加回去：看见周砚是 07:18，送咖啡发现描图是 07:35。我能修正这两个时间，不能补上后巷里没看见的人。" },
    [XU]: { [clue(7)]: "……我去过车站。说整早没离开，是我撒了谎。原图没有被毁，我只是想让揭幕晚一天。你还要核对怎样取出、什么时候取出的，不能把我的这句话当作所有问题的答案。" }
  };
  const suspectIds = [XU, ZHOU, HAN, SHEN];
  const characters: Character[] = world.npcs.map(npc => ({
    id: npc.id, name: npc.name, role: npc.role, publicBio: `${npc.name}是河湾的${npc.role}。`,
    secret: npc.secret, motive: npc.id === XU ? "拖延原图公开，避免祖父删去西岸住户的批注在缺少说明时曝光。" : "与展览有接触或意见分歧，尚需核对。",
    means: npc.id === XU ? "修复糊揭封、描图替换、R17 修复纸筒携走原图。" : "列在展台接触登记中的预约者。",
    opportunity: npc.id === XU ? "07:30 江芷离开后至 07:35 宋棠发现替代品之间。" : "早晨的实际行踪需要核对。",
    isCulprit: npc.id === XU, isSuspect: suspectIds.includes(npc.id), alibi: statements[npc.id], initialStatement: statements[npc.id],
    knowledgeScope: events.filter(e => e.actorIds.includes(npc.id)).map(e => e.id), liePolicy: npc.liePolicy,
    contradictionTriggers: Object.keys(revisions[npc.id] || {})
  }));
  const deductionCase: DeductionCase = {
    id, triggerKind: "nonfatal_incident", title: "第七分钟", theme: "被谁保管的历史",
    premise: "旧书店的旧桥测绘原图在揭幕前被换成描图纸。一只长纸筒、一座不准的钟，让小镇首先怀疑了邮差。",
    publicCaseFile: "原图属于镇档案室，今天十四点原定在旧书店公开。接触展台的预约名单上有许知微、周砚、韩朔和沈映；其余来客隔着柜台。请走访六处地点，核对原图最后出现和替代品被发现的时间。所有钟表记录都需要说明来源。",
    truth: { culpritId: XU, motive: characters.find(c => c.id === XU)!.motive, method: characters.find(c => c.id === XU)!.means, opportunity: characters.find(c => c.id === XU)!.opportunity,
      decisiveEvidenceIds: [1, 2, 3, 7, 8].map(clue),
      trueTimeline: events.map(e => ({ id: e.id, time: e.time, event: e.summary, characterIds: e.actorIds, isPublic: false, source: "原创锁定案前事实 v1", publicVersion: e.id === eventId("courier") ? "宋棠按钟楼记为 07:11。" : e.id === eventId("deposit") ? "许知微称整个早晨未离开书店。" : "", contradictedByEvidenceIds: e.id === eventId("courier") ? [clue(4)] : e.id === eventId("deposit") ? [clue(7)] : [] })) },
    characters, evidence,
    scenes: ["books", "cafe", "police", "post", "inn", "station"].map(locationId => ({ id: locationId, name: world.locations.find(l => l.id === locationId)!.name, description: world.locations.find(l => l.id === locationId)!.description, evidenceIds: evidence.filter(e => e.location === locationId).map(e => e.id) })),
    relationships: [{ from: XU, to: SHEN, label: "为旧地图报道有过争执" }, { from: ZHOU, to: "rb-chen-hui", label: "一起清点邮件" }, { from: HAN, to: "rb-lu-xingzhou", label: "一起校准钟楼" }],
    logicPuzzle: {
      suspectMatrix: [],
      exclusionChains: [
        { characterId: ZHOU, reason: "07:30—07:35 盗取窗口内，周砚在邮局连续清点。", evidenceIds: [clue(5), clue(8), clue(4)] },
        { characterId: HAN, reason: "07:10—07:45 与陆行舟在检修层，覆盖盗取窗口。", evidenceIds: [clue(4), clue(8)] },
        { characterId: SHEN, reason: "07:20—07:50 在旅馆连续双人核页，预约并非实际到店。", evidenceIds: [clue(6), clue(8)] }
      ],
      criticalReasoningChain: [
        { id: "rb-motive", conclusion: "延期信解释她为何想阻止今天公开。", evidenceIds: [clue(2)] },
        { id: "rb-means", conclusion: "揭封痕迹与原图寄存筒的 R17 撕口连接修复桌和车站。", evidenceIds: [clue(1), clue(7)] },
        { id: "rb-opportunity", conclusion: "两份交接记录将替换限制在 07:30—07:35。", evidenceIds: [clue(8)] },
        { id: "rb-clock", conclusion: "慢七分钟使 07:11 和 07:28 变为 07:18 与 07:35。", evidenceIds: [clue(3), clue(4)] },
        { id: "rb-exclusion", conclusion: "邮局、旅馆与检修层的连续记录排除其余三人。", evidenceIds: [clue(4), clue(5), clue(6), clue(8)] }
      ], redHerrings: ["周砚携带的长筒装着空白海报纸。", "韩朔的校时遗漏造成误会，不能由此推定盗取。", "沈映预约拍图，却并未到店。"], requiredClueOrder: []
    }
  };
  const memories: MemoryRecord[] = characters.flatMap(character => events.filter(e => e.actorIds.includes(character.id)).map(e => ({ id: `${e.id}-memory-${character.id}`, worldId: world.id, npcId: character.id, kind: "direct" as const, eventId: e.id, day: 1, summary: e.summary, confidence: 1, visibleToPlayer: false, challengeableEvidenceIds: character.contradictionTriggers })));
  const testimonies = characters.map(character => ({ id: `${id}-testimony-${character.id}`, caseId: id, characterId: character.id, initialStatement: character.initialStatement, currentStatement: character.initialStatement, contradictionEvidenceIds: character.contradictionTriggers, exposedContradictions: [], revised: false, memoryIds: memories.filter(m => m.npcId === character.id).map(m => m.id) })).filter(t => t.memoryIds.length > 0);
  const sourceMap: CaseFromLog["sourceMap"] = {
    motiveEvidenceId: clue(2), meansEvidenceId: clue(1), opportunityEvidenceId: clue(8), stagingEvidenceId: clue(1), traceEvidenceId: clue(7), groupAlibiEvidenceId: clue(5), sourceEventIds: events.map(e => e.id), triggeredEventId: eventId("copy-found"),
    evidenceSourceEventIds: Object.fromEntries(evidence.map(e => [e.id, events.filter(v => v.evidenceId === e.id).map(v => v.id)])),
    chainStageSourceEventIds: { motive: [eventId("delay")], means: [eventId("seal"), eventId("deposit")], opportunity: [eventId("last-original")] }, memorySourceIds: memories.map(m => m.id)
  };
  const generationProfile: CaseFromLog["generationProfile"] = {
    seed: RIVERBEND_CASE_REVISION, triggerKind: "nonfatal_incident", triggerEventId: eventId("copy-found"),
    // Legacy profile requires this field even for nonfatal incidents. No weapon
    // is instantiated or inferred from it; triggerKind is authoritative.
    archetype: "blade", victimId: "", culpritId: XU, witnessId: SONG, focusSuspectIds: suspectIds,
    sceneLocationId: "books", prepLocationId: "books", motiveEventId: eventId("delay"), meansEventId: eventId("seal"), opportunityEventId: eventId("last-original"), deathEventId: "", stagingEventId: eventId("seal"), traceEventId: eventId("deposit"), groupAlibiEventId: eventId("mail"), decisiveEvidenceIds: deductionCase.truth.decisiveEvidenceIds
  };
  const enrichedWorld = { ...world, memories: [...world.memories, ...memories] };
  const caseFromLog: CaseFromLog = { id, worldId: world.id, sourceEventIds: events.map(e => e.id), deathEventId: "", triggeredEventId: eventId("copy-found"), triggerKind: "nonfatal_incident", generationProfile, sourceMap, testimonies, deductionCase, qualityReport: buildCaseQualityReport(enrichedWorld, events, { deductionCase, generationProfile, testimonies }), validation: validateWorldCase(enrichedWorld, events, deductionCase), createdAt: now };
  const script: RiverbendCaseScript = {
    revision: RIVERBEND_CASE_REVISION, statements, revisions,
    targets: ["检查展台的封条", "整理修复桌上的信件", "查看早餐便笺", "核对钟楼检修记录", "核对挂号清点记录", "查看前台核页记录", "与站员共同核对寄存物", "阅读展品交接页"].map((label, index) => ({ id: `rb-search-${index + 1}`, sceneId: evidence[index].location, label, evidenceId: evidence[index].id })),
    ending: [
      "原图回到镇档案室的保管箱。原定十四点的揭幕暂缓；再次公开时，旁边多了一张说明：当年的地图还留着未被解释的空白，批注应与居民的口述一起阅读。",
      "宋棠在早餐便笺上划掉两个钟面时间，添了“慢七分钟”四个字。周砚照旧送信，韩朔补齐了校时登记。误会没有使他们成为另一个案件的罪人。",
      "许知微承认揭封、替换与寄存。她把祖父的旧信交给档案室，并为擅自移走公有原图承担后续责任。沈映答应把原文和争议都写进去；谁也没有答应替历史删掉难看的那一页。"
    ]
  };
  const bundle = { caseFromLog, events, memories, script };
  const problems = validateRiverbendCasePackage(world, bundle);
  if (problems.length) throw new Error(`Riverbend case authoring failed: ${problems.join("; ")}`);
  return bundle;
}

/** Stronger than structural references alone: every clue resolves to real
 * source events, all sources use this world and actual actors/places, and
 * dialogue revisions have corresponding testimony evidence. */
export function validateRiverbendCasePackage(world: WorldState, bundle: RiverbendCasePackage): string[] {
  const errors: string[] = [];
  const { caseFromLog: c, events, memories, script } = bundle;
  const eventIds = new Set(events.map(e => e.id)), npcIds = new Set(world.npcs.map(n => n.id)), places = new Set(world.locations.map(l => l.id));
  if (eventIds.size !== events.length) errors.push("Duplicate source identity");
  for (const e of events) {
    if (e.worldId !== world.id || !places.has(e.locationId) || e.actorIds.some(id => !npcIds.has(id))) errors.push(`Invalid source ownership ${e.id}`);
    if (e.day !== 1 || !/^0[7-8]:[0-5]\d$/.test(e.time) || e.time > "08:00") errors.push(`Invalid opening time ${e.id}`);
  }
  const clock = (e: WorldEvent) => Number(e.time.slice(0, 2)) * 60 + Number(e.time.slice(3));
  for (const t of c.deductionCase.truth.trueTimeline) {
    const source = events.find(e => e.id === t.id);
    if (!source || source.time !== t.time || source.summary !== t.event || JSON.stringify(source.actorIds) !== JSON.stringify(t.characterIds)) errors.push(`Timeline drift ${t.id}`);
  }
  const roads = buildTravelConstraint(world);
  for (const npcId of npcIds) {
    const route = events.filter(e => e.actorIds.includes(npcId)).sort((a, b) => clock(a) - clock(b));
    for (let i = 1; i < route.length; i++) if (shortestTravelMinutes(roads, route[i - 1].locationId, route[i].locationId) > clock(route[i]) - clock(route[i - 1])) errors.push(`Impossible historical journey ${npcId}: ${route[i].id}`);
  }
  for (const e of c.deductionCase.evidence) {
    const refs = c.sourceMap.evidenceSourceEventIds?.[e.id] || [];
    if (!refs.length || refs.some(id => !events.some(v => v.id === id && v.evidenceId === e.id))) errors.push(`Unbacked clue ${e.id}`);
    if (!script.targets.some(t => t.evidenceId === e.id && t.sceneId === e.location)) errors.push(`Unsearchable clue ${e.id}`);
  }
  for (const m of memories) if (!eventIds.has(m.eventId) || m.worldId !== world.id || !events.some(e => e.id === m.eventId && e.actorIds.includes(m.npcId))) errors.push(`Unsupported direct memory ${m.id}`);
  for (const [npcId, revisions] of Object.entries(script.revisions)) for (const evidenceId of Object.keys(revisions)) if (!c.testimonies.some(t => t.characterId === npcId && t.contradictionEvidenceIds.includes(evidenceId))) errors.push(`Unsupported revision ${npcId}`);
  const validation = validateWorldCase({ ...world, memories: [...world.memories, ...memories] }, events, c.deductionCase);
  if (!validation.valid) errors.push(...validation.issues);
  const certificate = certifyPlayableCase(c, events);
  if (!certificate.routeCertified || !certificate.sourceBacked) errors.push(...certificate.blockers.map(b => b.label), ...(!certificate.sourceBacked ? ["Incomplete proof sources"] : []));
  return errors;
}
