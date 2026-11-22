import type { CasePack } from "../case-pack";

const HAN = "rb-han-shuo", LU = "rb-lu-xingzhou", XU = "rb-xu-zhiwei", JIANG = "rb-jiang-zhi";
const GU = "rb-gu-yuanshan", SONG = "rb-song-tang", CHEN = "rb-chen-hui", ZHOU = "rb-zhou-yan";
const LIN = "rb-lin-ali", BAI = "rb-bai-lu", SHEN = "rb-shen-ying", CHENG = "rb-cheng-du";

export const SILENT_TOWER_BELL: CasePack = {
  revision: "riverbend-silent-tower-bell.v1", key: "silent-tower-bell", ordinal: "第六宗", title: "没响的钟",
  theme: "修正误差需要公开承认误差",
  premise: "第三天清晨，钟楼没有报时，警务所却准备张贴‘已校准’的开门告示。车站和邮局的标准钟都比钟楼快七分钟。",
  publicCaseFile: "钟楼校时册写着已完成校准，检修层却少了一张待更换零件便笺。请核对车站、咖啡馆和警务所的时间来源，找出谁改动了公共记录。",
  question: "谁把钟楼未完成的校准写成了已完成", verdict: "{person}把钟楼未完成的校准写成了已完成",
  commission: { hook: "钟楼没有报时", detail: "警务所的公开告示写着钟楼已经校准，车站标准钟却快了七分钟。第 3 天早晨到警务所或车站领取调查手记。", openAt: ["police", "station"], refusal: "请到警务所或车站领取钟楼校时记录的调查手记。" },
  after: "returned-window", day: 3, window: { from: "05:20", to: "07:45" }, ids: { clue: "rb6-clue", search: "rb6-search" },
  historyTag: "riverbend-authored-history", historyNote: "第 3 天钟楼校时册与标准钟记录。", timelineSource: "原创第 3 天公共校时记录案事实 v1",
  culpritId: HAN, witnessId: XU, suspectIds: [HAN, LU, XU, JIANG],
  culprit: { motive: "他发现校时器摆锤磨损，担心镇上认为自己失职，想把更换零件拖到下午。", means: "他把原始待更换便笺折进旧地图册，再把正式校时册的待办栏改成已校准。", opportunity: "05:35 到 06:05 他独自在警务所和钟楼检修层之间，工具、册页和油布都在手边。" },
  others: { motive: "与告示、车站标准钟或旧地图册有往来，尚需核对。", means: "可能接触过公开校时记录。", opportunity: "第 3 天清晨的实际地点需要核对。" },
  statements: {
    [HAN]: "我第三天早晨只整理钟楼工具，校时册上的已校准是上一班留下的记录。摆锤若有磨损，钟会慢一点，但我没有拿走任何便笺。旧地图册在书店，和钟楼没有关系。",
    [LU]: "五点五十分我在警务所用电波钟印公开告示，册上写的是已校准。韩朔来过检修层，但我没有看他改册。告示的时间来源写在印刷栏里，不靠钟楼报时。",
    [XU]: "六点二十分我在旧书店收到一本旧地图册，夹页里有一张带油痕的便笺。我没有拆开看，只按修复编号登记。钟楼的记录是否正确，要交给维修工说明。",
    [JIANG]: "六点五十分我在咖啡馆听见钟楼没有报时，宋棠也在场。我只是想把课程时间往后改十分钟，没有去警务所，也没有见过校时册。",
    [GU]: "六点三十五分我在车站标准钟下登记第一班车告示，车站钟和邮局钟一致。我没有拿过警务所的册子，之后才听说钟楼没有响。",
    [SONG]: "江老师六点五十分到咖啡馆时，钟楼没有报时。我按收银机写下时间，她坐到七点才走。她没有带校时册，也没有问过车站的钟。",
    [CHEN]: "我第三天早上在邮局整理退回件，邮局电波钟一直正常。钟楼快慢和我的分拣没有关系，我没见过韩朔的工具。",
    [ZHOU]: "我在邮局和咖啡馆之间送信，听见有人说钟楼没响。告示上的时间我只按邮局钟看，没有去警务所翻册。",
    [LIN]: "我早上在旅馆整理房间，没有去钟楼。公共时间应该交给能修钟的人记录，旅馆不替钟楼作证。",
    [BAI]: "我第三天早上在河边整理花篮，没有听见钟楼报时。车站和邮局的钟谁更准，我没有亲自核过。",
    [SHEN]: "我在旅馆整理采访授权，没有去警务所。钟楼慢七分钟的说法需要两块标准钟一起证明，单独一人的便笺不能定罪。",
    [CHENG]: "我在河桥边修栏杆，没有进钟楼。工具油痕只能说明工具接触过纸，真正关键是工具是谁签领、纸后来去了哪里。"
  },
  revisions: {
    [HAN]: { 1: "摆锤确实磨损，我把待更换便笺折进旧地图册，又把正式册改成已校准，想等下午拿到零件再补做。钟楼没有报时不是告示能遮住的误差。" },
    [XU]: { 4: "我说没有拆开便笺，是因为不想替别人解释私人物件。物证上的修复编号和油痕都在登记时看见了，便笺是夹在地图册里送来的，不是我放进去的。" }
  },
  evidence: [
    { n: 1, at: "police", title: "正式校时册", text: "校时册写着‘已校准’，补写墨水比前一页的登记新，‘已’字下方留有被刮平的纤维。正式册的 05:50 印刷登记与补写时间不一致。", meaning: "证明公共记录被后补改写。", related: [HAN, LU], contradicts: [HAN], search: "检查警务所校时登记柜的正式校时册" },
    { n: 2, at: "police", title: "摆锤磨损清单", text: "零件清单写着摆锤边缘磨损、建议更换，签领人是韩朔，签领时刻为 05:20。工具箱少了一块旧油布，清单没有维修完成签名。", meaning: "提供韩朔的动机和手法材料来源。", related: [HAN], search: "核对警务所检修桌的摆锤磨损清单" },
    { n: 3, at: "station", title: "车站标准钟登记", text: "车站标准钟记录 06:35，第一班车告示由顾远山签名。旁栏写着钟楼显示 06:28，两个钟相差七分钟，纸上有站台电波钟校验号。", meaning: "证明钟楼真实慢七分钟。", related: [GU], search: "查看车站柜台的标准钟登记" },
    { n: 4, at: "books", title: "旧地图册夹页", text: "许知微 06:20 的修复登记显示，旧地图册送达时夹着一张校时便笺。便笺边缘有警务所检修编号和钟表油痕，折痕与正式册被刮平的纸屑相合。", meaning: "把原始待更换记录连接到韩朔的检修工具和被改的正式册。", related: [XU, HAN], contradicts: [XU], search: "翻看书架上的旧地图册夹页" },
    { n: 5, at: "cafe", title: "无报时收银条", text: "收银机打印 06:50，江芷与宋棠在场。宋棠写下钟楼没有报时，咖啡馆门外的邮局电波钟显示 06:57，两个来源相差七分钟。", meaning: "证明异常被公开听见，排除江芷伪造告示的可能。", related: [JIANG, SONG], search: "查看咖啡馆收银台的无报时收银条" },
    { n: 6, at: "police", title: "公开告示印刷登记", text: "警务所电波钟记录 05:50，陆行舟签名印出市场开门告示。登记栏注明时间来源是电波钟，不是钟楼，校时册当时已经写着已校准。", meaning: "排除陆行舟改变校时记录。", related: [LU, HAN], search: "核对警务所值班桌的公开告示印刷登记" },
    { n: 7, at: "station", title: "第一班车公文交接", text: "顾远山 06:15 从邮局后巷住宅出发，06:35 在车站标准钟下签收公文。交接页没有警务所或钟楼的盖章，说明他没有接触校时册。", meaning: "排除顾远山在改册窗口进入警务所。", related: [GU], search: "阅读值班柜台的第一班车公文交接" },
    { n: 8, at: "books", title: "修复桌油痕登记", text: "修复桌登记 06:20 收到地图册，便笺上的油痕来自钟表工具，许知微只做了编号和封套登记。她的修复笔没有接触正式校时册。", meaning: "排除许知微改动公共记录，并固定便笺转入书店的时间。", related: [XU], search: "查看旧书店修复桌的油痕登记" }
  ],
  history: [
    { key: "signout", time: "05:20", at: "police", type: "conversation", actors: [HAN], summary: "韩朔按警务所电波钟签领摆锤磨损清单和校时工具。", clue: 2 },
    { key: "tower-check", time: "05:35", at: "police", type: "conflict", actors: [HAN], summary: "韩朔在钟楼检修层发现摆锤磨损，留下待更换便笺。正式地点归入警务所建筑。", tags: ["motive"], clue: 2 },
    { key: "告示", time: "05:50", at: "police", type: "conversation", actors: [LU, HAN], summary: "陆行舟用电波钟印出公开告示，校时册上已经出现已校准字样。", clue: 6, publicVersion: "韩朔称自己没有改动正式校时册。", contradictedBy: [1] },
    { key: "rewrite", time: "06:05", at: "police", type: "obtain_item", actors: [HAN], summary: "韩朔把原始便笺折进旧地图册，把正式册的待更换栏改成已校准。", tags: ["means", "opportunity", "staging"], clue: 1 },
    { key: "books-arrival", time: "06:20", at: "books", type: "conversation", actors: [XU], summary: "许知微收到夹着原始便笺的旧地图册，按修复登记记录油痕和编号。", clue: 4, publicVersion: "许知微称自己没有拆开或看见地图册夹页。", contradictedBy: [4] },
    { key: "books-register", time: "06:21", at: "books", type: "forensic_clue", actors: [XU], summary: "许知微把地图册和夹页编号写进修复登记，油痕仍在便笺边缘，没有碰过正式校时册。", clue: 8 },
    { key: "station-time", time: "06:35", at: "station", type: "alibi", actors: [GU], summary: "顾远山在车站标准钟下登记第一班车公文，记录钟楼显示慢七分钟。", tags: ["alibi"], clue: 3 },
    { key: "station-file", time: "06:36", at: "station", type: "forensic_clue", actors: [GU], summary: "顾远山把第一班车公文交接页夹进车站值班册，交接栏没有警务所盖章。", clue: 7 },
    { key: "cafe-silence", time: "06:50", at: "cafe", type: "witness", actors: [JIANG, SONG], summary: "江芷和宋棠听见钟楼没有报时，咖啡馆收银机与门外电波钟记录了时间。", clue: 5 },
    { key: "discover", time: "07:45", at: "police", type: "incident", actors: [LU], summary: "陆行舟张贴告示时发现钟楼仍慢七分钟，正式校时册却写着已校准。", tags: ["nonfatal_incident"] }
  ],
  scenes: ["police", "station", "books", "cafe", "post", "inn"],
  relationships: [{ from: HAN, to: LU, label: "钟楼检修与公开告示" }, { from: HAN, to: XU, label: "校时便笺与旧地图册" }, { from: GU, to: LU, label: "标准钟与公共时间" }],
  exclusions: [
    { characterId: LU, reason: "05:50 使用电波钟印告示，登记栏明确时间来源，且没有检修册钥匙。", clues: [6, 1] },
    { characterId: XU, reason: "06:20 才收到夹有原始便笺的地图册，修复登记显示她没有接触正式校时册。", clues: [4, 8] },
    { characterId: JIANG, reason: "06:50 在咖啡馆听见异常，收银条和电波钟记录她没有进入警务所。", clues: [5, 6] }
  ],
  reasoning: [
    { id: "rb6-error", conclusion: "车站、咖啡馆和电波钟共同证明钟楼慢七分钟。", clues: [3, 5] },
    { id: "rb6-motive", conclusion: "摆锤磨损清单和待更换零件解释韩朔为何想延迟承认故障。", clues: [2] },
    { id: "rb6-means", conclusion: "原始便笺的油痕、编号和正式册刮痕构成从工具到改写的链条。", clues: [1, 2, 4] },
    { id: "rb6-opportunity", conclusion: "韩朔在 05:35—06:05 独自持有工具和校时册，其他人都有连续记录。", clues: [1, 6, 8] },
    { id: "rb6-exclusion", conclusion: "告示印刷、地图册登记和咖啡馆收银条排除陆行舟、许知微与江芷。", clues: [5, 6, 8] }
  ],
  redHerrings: ["陆行舟负责公开告示，容易被怀疑想让警务所准时开门。", "许知微接触带油痕的旧地图册，实际只做了修复登记。", "江芷想把课程往后改十分钟，却没有碰过公共校时册。"],
  decisive: [1, 2, 3, 4, 5, 6, 8], answer: { motive: [2], method: [1, 2, 4] },
  sources: { motive: 2, means: 4, opportunity: 1, staging: 1, trace: 4, groupAlibi: 6 },
  events: { trigger: "discover", motive: "tower-check", means: ["rewrite"], opportunity: "rewrite", staging: "rewrite", trace: "books-arrival", groupAlibi: "告示", scene: "police", prep: "police" },
  ending: ["钟楼暂时停止报时，市场告示改用车站和邮局标准钟。校时册添上双钟来源，居民重新知道哪些时间可以相信。", "陆行舟保留告示记录，许知微归还原始便笺，江芷把课程调整的理由写进自己的信。公共误差被公开承认后，没人再替别人补写过去。", "韩朔承认延迟登记，承担更换摆锤的费用。警务所把检修、校准和公开告示分成三栏，他继续修钟，但每次都留下原始读数。"]
};
