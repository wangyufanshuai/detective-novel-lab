import type { CasePack } from "../case-pack";

/** PRIVATE authored case 2. Its history is the same morning as case 1, an hour
 * earlier (06:00—06:59), so both histories stay walkable together. The point of
 * this case: a stamped tool that names the wrong person, and a witness who lies
 * for a reason that is not guilt. Never import in a client. */
const CHEN = "rb-chen-hui", CHENG = "rb-cheng-du", BAI = "rb-bai-lu", LIN = "rb-lin-ali";
const LU = "rb-lu-xingzhou", GU = "rb-gu-yuanshan", SONG = "rb-song-tang", SHEN = "rb-shen-ying";

export const BORROWED_CHISEL: CasePack = {
  revision: "riverbend-borrowed-chisel.v1",
  key: "borrowed-chisel",
  ordinal: "第二宗",
  title: "借来的凿子",
  theme: "离开小镇的代价",
  premise: "旧桥修缮的募捐箱在旅馆前台被撬开，1,240 元不见了。箱盖里卡着一把刻着「程」字的凿子，镇上的人先想到了木工程渡。",
  publicCaseFile: "募捐箱由桥畔旅馆代管，林阿梨 06:10 点过数。今早接触过旅馆门廊或前台的有程渡、白露、林阿梨；有人看见陈蕙清早往广场方向走。请走访各处地点，核对撬箱的时间窗口、凿子的来路和钱的去向。",
  question: "谁撬开了募捐箱",
  verdict: "{person}撬开了募捐箱",
  commission: { hook: "旅馆的募捐箱被撬了", detail: "旧桥修缮的募捐箱在旅馆前台被撬开，箱盖里卡着一把刻着「程」字的凿子。去旅馆或警务所领取调查手记。", openAt: ["inn", "police"], refusal: "请先到桥畔旅馆或警务所，领取募捐箱失窃的调查手记。" },
  after: "seventh-minute",
  window: { from: "06:00", to: "06:59" },
  ids: { clue: "rb2-clue", search: "rb2-search" },
  historyTag: "riverbend-authored-history",
  historyNote: "河湾旅馆募捐箱的案前记录。",
  timelineSource: "原创锁定案前事实 v1",
  culpritId: CHEN,
  witnessId: BAI,
  suspectIds: [CHEN, CHENG, BAI, LIN],
  culprit: { motive: "省城的租房中介要求今天寄齐 1,200 元押金，她想离开邮局去省城。", means: "从门廊没上锁的工具箱取走程渡的平口凿，撬开募捐箱，再用邮局报值挂号把钱寄出。", opportunity: "06:30 林阿梨锁箱进厨房后，到 06:45 发现之间。" },
  others: { motive: "与旅馆或募捐箱有往来，尚需核对。", means: "能接触旅馆门廊或前台的人。", opportunity: "清晨的实际行踪需要核对。" },
  statements: {
    [SONG]: "06:38 白露进门买了一杯热拿铁，坐在窗边到 06:50 才去花摊。她鞋上沾着木屑，像是刚从哪处门廊过来。这回我看的是收银机的时间，不是钟楼。",
    "rb-zhou-yan": "我七点前先去书店取海报纸，后来才回邮局。陈蕙一向最早到；不过平常六点半就该分完的省城早班邮件，今天一直堆在台上。",
    "rb-xu-zhiwei": "六点多我还在家，七点才去书店。募捐箱的事我只是听说，帮不上忙。",
    [LU]: "06:25 我在警务所门口巡逻，看见陈蕙穿着灰雨衣往广场走，她说去买早点。06:55 林阿梨来报案。凿子我暂时收着，刻的是程字，但还没问过程渡本人。",
    [CHEN]: "六点二十我就到邮局了，一个人提前分拣省城的早班邮件，分拣机会记下每一件。我没去过旅馆，也没见过什么募捐箱。",
    [GU]: "06:30 的木料车准点进站。我跟程渡一根一根点到 06:50，他一直在站台。签收单上有两个人的名字，站台的电波钟管时间。",
    [BAI]: "我今早没去旅馆，六点多就在咖啡馆了，宋棠可以作证。募捐箱的事我是听别人说的。",
    [LIN]: "06:10 我点过箱子，一千二百四十元。06:30 锁好箱子进厨房给沈映做早饭，06:45 出来就看见锁扣被撬开了。前台那十五分钟没人看着，是我的疏忽。",
    [CHENG]: "凿子是我的，刻着我的姓。六点一刻我修完旅馆门廊的栏杆——那活儿不在工单上——工具箱就留在门廊没锁，因为六点半要去车站接木料。那段时间我一直在站台。",
    [SHEN]: "我六点半在旅馆厨房吃早饭，林老板一直在灶台边，十五分钟没离开过。我在她的出餐单上签了名。我背对着前台，没看见谁进来。",
    "rb-han-shuo": "六点多我还在家，七点才去钟楼。募捐箱？我昨天还往里投过二十块。",
    "rb-jiang-zhi": "我七点前在家，没出门。六点四十左右下过一阵小雨，穿雨衣的人不少，别光凭一件雨衣认人。"
  },
  revisions: {
    [BAI]: { 3: "……我去过旅馆门廊，把桌花交给林老板就走了。我欠她育苗钱，怕她当面问起，才说没去。我走的时候募捐箱还锁着，前台没有别人；我是 06:28 从门廊出来的。" },
    [CHEN]: { 6: "……分拣机六点五十六才开机。我出去过。省城那家中介要我今天寄齐押金，不然房间就转给别人了。我想着下个月发了工资就还回去——我知道，这不叫借。" }
  },
  evidence: [
    { n: 1, at: "inn", title: "撬开的募捐箱", text: "旧桥修缮募捐箱的锁扣从缝里被撬开，木框上有一道约一厘米宽的平口压痕。林阿梨 06:10 的点数条写着 1,240 元，箱里只剩硬币。箱盖内侧卡着一小片深蓝色的纸屑。", meaning: "撬痕说明用了平口凿；深蓝纸屑与邮局报值挂号封套同色，要和邮局的记录一起读。", related: [LIN, CHEN], search: "检查前台的募捐箱" },
    { n: 2, at: "inn", title: "门廊工具箱里的凿子", text: "一把刻着「程」字的平口凿，刃宽与箱上的压痕一致。木柄上有新鲜的蓝色印油指印，是邮局盖挂号章用的那种。工具箱放在门廊，没有上锁。", meaning: "刻字只说明凿子属于程渡；没上锁的工具箱谁都能取用，印油指向邮局的人。", related: [CHENG, CHEN], search: "查看门廊的工具箱" },
    { n: 3, at: "inn", title: "厨房的出餐单", text: "林阿梨的出餐单：『06:25 白露送桌花（钱的事改天说）』『06:30 锁好募捐箱，进厨房给沈映做早饭』『06:45 出来，箱子已被撬』。沈映在单子下面补签：她吃早饭时，林阿梨一直在灶台边。", meaning: "把撬箱限制在 06:30—06:45；证明白露来过旅馆，但在箱子上锁之前；林阿梨与沈映互相作证。", related: [LIN, BAI, SHEN], contradicts: [BAI], search: "翻看厨房的出餐单" },
    { n: 4, at: "station", title: "木料签收单", text: "06:30 到站的木料货车，程渡与顾远山逐根清点签收。单上写着 06:30 开始、06:50 结束，两人轮流搬抬，没有人离开。站台电波钟记时。", meaning: "整个撬箱窗口里程渡都在车站。凿子是他的，动手的不是他。", related: [CHENG, GU], search: "核对木料签收单" },
    { n: 5, at: "cafe", title: "06:38 的咖啡小票", text: "宋棠的收银小票：06:38 白露买了一杯热拿铁，在窗边坐到 06:50 才去花摊。宋棠记得她进门时鞋上沾着门廊的木屑。", meaning: "旅馆到咖啡馆最快十分钟。06:38 进门的人，最晚 06:28 就离开了旅馆，早于募捐箱上锁。", related: [BAI, SONG], search: "查看收银小票" },
    { n: 6, at: "post", title: "分拣机日志", text: "邮局分拣机的开机记录：今天第一次开机是 06:56，刷的是陈蕙的工牌；06:20 到 06:55 之间没有任何邮件过机。", meaning: "否定陈蕙「六点二十起一直在分拣」的说法。", related: [CHEN], contradicts: [CHEN], search: "读取分拣机日志" },
    { n: 7, at: "police", title: "早班巡逻记录", text: "陆行舟的巡逻本：『06:25 警务所门前，邮局陈蕙穿灰雨衣往广场方向走，说去买早点。』从广场再走五分钟就是旅馆。", meaning: "撬箱窗口开始前，她不在邮局，正走向旅馆的方向。", related: [CHEN, LU], search: "翻阅早班巡逻记录" },
    { n: 8, at: "post", title: "报值挂号存根", text: "06:58 陈蕙自己寄出一封报值挂号信，寄往省城一家租房中介，报值 1,200 元，附言写着『押金，请勿转租』。用的是邮局的深蓝色挂号封套。", meaning: "钱的去向与动机；封套的颜色与箱内纸屑相同。", related: [CHEN], search: "核对今早的挂号存根" }
  ],
  history: [
    { key: "deadline", time: "06:05", at: "house-north-c", type: "conflict", actors: [CHEN], summary: "陈蕙又读了一遍省城中介的催款信：1,200 元押金今天必须寄到，否则房间转租。", tags: ["motive"], clue: 8 },
    { key: "count", time: "06:10", at: "inn", type: "conversation", actors: [LIN], summary: "林阿梨点过募捐箱，写下 1,240 元的点数条。" },
    { key: "porch", time: "06:15", at: "inn", type: "move", actors: [CHENG], summary: "程渡修完门廊栏杆，把没上锁的工具箱留在门廊，赶去车站接木料。" },
    { key: "flowers", time: "06:25", at: "inn", type: "witness", actors: [BAI, LIN], summary: "白露把桌花交给林阿梨，避开欠款的话题，06:28 离开门廊。募捐箱仍锁着。", clue: 3, publicVersion: "白露称今早没去旅馆。", contradictedBy: [3] },
    { key: "seen", time: "06:25", at: "police", type: "witness", actors: [CHEN, LU], summary: "陆行舟在警务所门前看见陈蕙穿灰雨衣往广场方向走。", tags: ["opportunity"], clue: 7 },
    { key: "kitchen", time: "06:30", at: "inn", type: "alibi", actors: [LIN, SHEN], summary: "林阿梨锁好募捐箱进厨房，为沈映做早饭，直到 06:45 没有离开灶台。", tags: ["alibi"], clue: 3 },
    { key: "freight", time: "06:30", at: "station", type: "alibi", actors: [CHENG, GU], summary: "程渡与顾远山开始清点木料，到 06:50 一直在站台。", tags: ["alibi"], clue: 4 },
    { key: "take-chisel", time: "06:35", at: "inn", type: "obtain_item", actors: [CHEN], summary: "陈蕙从门廊没上锁的工具箱里取出刻着「程」字的平口凿。", tags: ["means"], clue: 2 },
    { key: "pry", time: "06:36", at: "inn", type: "obtain_item", actors: [CHEN], summary: "陈蕙撬开募捐箱，取走纸币，把凿子卡在箱盖里。", tags: ["means", "staging"], clue: 1 },
    { key: "coffee", time: "06:38", at: "cafe", type: "alibi", actors: [BAI, SONG], summary: "白露在咖啡馆买热拿铁，坐到 06:50。", tags: ["alibi"], clue: 5 },
    { key: "leave", time: "06:40", at: "inn", type: "move", actors: [CHEN], summary: "陈蕙从门廊离开，经广场回邮局。" },
    { key: "found", time: "06:45", at: "inn", type: "incident", actors: [LIN], summary: "林阿梨从厨房出来，发现募捐箱被撬，纸币不见了。", tags: ["nonfatal_incident"] },
    { key: "report", time: "06:55", at: "police", type: "conversation", actors: [LIN, LU], summary: "林阿梨到警务所报案，陆行舟暂收凿子。" },
    { key: "first-scan", time: "06:56", at: "post", type: "forensic_clue", actors: [CHEN], summary: "陈蕙刷工牌打开分拣机，这是今天第一次开机。", tags: ["trace"], clue: 6, publicVersion: "陈蕙称六点二十起一直在邮局分拣。", contradictedBy: [6] },
    { key: "register", time: "06:58", at: "post", type: "forensic_clue", actors: [CHEN], summary: "陈蕙用深蓝挂号封套把 1,200 元报值寄往省城中介。", tags: ["trace", "means"], clue: 8 }
  ],
  scenes: ["inn", "station", "cafe", "post", "police", "books"],
  relationships: [{ from: BAI, to: LIN, label: "欠着育苗钱" }, { from: CHENG, to: GU, label: "一起清点木料" }, { from: LIN, to: SHEN, label: "旅馆老板与长住客" }],
  exclusions: [
    { characterId: CHENG, reason: "06:30—06:50 在车站与顾远山连续清点，覆盖撬箱窗口；凿子取自没上锁的工具箱。", clues: [4, 3, 2] },
    { characterId: BAI, reason: "06:38 已在咖啡馆；旅馆到咖啡馆最快十分钟，她在募捐箱 06:30 上锁之前就离开了旅馆。", clues: [5, 3] },
    { characterId: LIN, reason: "06:30—06:45 在厨房为沈映做早饭，沈映在出餐单上补签作证。", clues: [3] }
  ],
  reasoning: [
    { id: "rb2-motive", conclusion: "押金催款和挂号附言解释她为什么今天急需 1,200 元。", clues: [8] },
    { id: "rb2-means", conclusion: "凿柄上的邮局印油和箱内的深蓝纸屑，把凿子和撬箱连到邮局的人。", clues: [1, 2] },
    { id: "rb2-opportunity", conclusion: "出餐单把撬箱限制在 06:30—06:45，巡逻记录显示她 06:25 正走向旅馆。", clues: [3, 7] },
    { id: "rb2-alibi", conclusion: "分拣机 06:56 才开机，否定她六点二十起在邮局的说法。", clues: [6] },
    { id: "rb2-exclusion", conclusion: "木料签收单、咖啡小票与出餐单排除其余三人。", clues: [3, 4, 5] }
  ],
  redHerrings: ["凿子刻着程渡的姓，但工具箱没有上锁。", "白露欠林阿梨育苗钱，又隐瞒了到过旅馆。", "06:40 前后下过小雨，穿雨衣的人不止一个。"],
  decisive: [1, 2, 3, 6, 8],
  answer: { motive: [8], method: [1, 2] },
  sources: { motive: 8, means: 2, opportunity: 7, staging: 1, trace: 8, groupAlibi: 4 },
  events: { trigger: "found", motive: "deadline", means: ["take-chisel", "pry"], opportunity: "seen", staging: "pry", trace: "register", groupAlibi: "freight", scene: "inn", prep: "inn" },
  ending: [
    "1,200 元由省城中介原封退回，连同箱里剩下的硬币交还旧桥修缮会。林阿梨把募捐箱搬到厨房对面、从灶台就看得见的位置。",
    "程渡把凿子拿了回去，第一次把那段不在工单上的栏杆补记进账本。白露当面和林阿梨说起欠款，两人约好用一季的桌花来抵。",
    "陈蕙承认取凿、撬箱和寄钱，向修缮会交出了那封一直没寄出的辞职信。她最后还是会去省城——只是要等这笔账还清，从正门走。"
  ]
};
