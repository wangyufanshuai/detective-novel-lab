import type { CasePack } from "../case-pack";

const LIN = "rb-lin-ali", ZHOU = "rb-zhou-yan", GU = "rb-gu-yuanshan", BAI = "rb-bai-lu";
const SONG = "rb-song-tang", CHENG = "rb-cheng-du", LU = "rb-lu-xingzhou", CHEN = "rb-chen-hui";
const XU = "rb-xu-zhiwei", SHEN = "rb-shen-ying", HAN = "rb-han-shuo", JIANG = "rb-jiang-zhi";

/** 第四宗。第 2 天清晨，旅馆寄存号与车站当日寄运号恰好同为 17。 */
export const SAME_NUMBERED_LUGGAGE: CasePack = {
  revision: "riverbend-same-numbered-luggage.v1",
  key: "same-numbered-luggage",
  ordinal: "第四宗",
  title: "同号行李",
  theme: "替别人保守秘密，不能替别人改写去向",
  premise: "第二天清晨，车站收到一只标着 17 的布袋，里面只有衬纸。旅馆里真正的棕色皮箱还挂着 17 号铜牌，镇上先怀疑有人把寄存行李偷换成了空袋。",
  publicCaseFile: "车站交接联记着 17 号布袋来自桥畔旅馆，开袋后没有衣物。旅馆账页却记着一只带月牙补丁的皮箱仍在寄存架。请核对两种 17 号的签发单位、封装时间和经手人。",
  question: "谁把空袋冒充成寄存行李送站",
  verdict: "{person}以空袋冒充了寄存行李",
  commission: { hook: "车站收到一只空行李袋", detail: "车站清点 17 号布袋时只找到衬纸，旅馆里同号铜牌仍挂在客人的皮箱上。第 2 天早晨到车站或警务所领取调查手记。", openAt: ["station", "police"], refusal: "请到河湾车站或警务所领取 17 号行李的调查手记。" },
  after: "missing-farewell-page",
  day: 2,
  window: { from: "05:45", to: "07:40" },
  ids: { clue: "rb4-clue", search: "rb4-search" },
  historyTag: "riverbend-authored-history",
  historyNote: "第 2 天旅馆与车站 17 号行李的交接记录。",
  timelineSource: "原创第 2 天行李调包案事实 v1",
  culpritId: LIN,
  witnessId: ZHOU,
  suspectIds: [LIN, ZHOU, GU, BAI],
  culprit: { motive: "匿名客人只请求她不要公开去向，她想保护客人，却擅自制造一份寄运记录。", means: "她在旅馆把空袋写成代装衣物并封好，交给周砚送站，之后用碰巧相同的 17 号回执应付追问。", opportunity: "06:20 后她独自在前台填写 P06 纸签，06:40 把已经封好的袋子交给周砚。" },
  others: { motive: "与旅馆、车站或行李交接有往来，尚需核对。", means: "能够接触交接联、寄存账或纸签的人。", opportunity: "第 2 天清晨的实际行踪需要逐项核对。" },
  statements: {
    [SONG]: "第二天六点十五分白露进来，我们剪了四批桌花，每装好一批就用收银机打张报时条。六点四十五才清点完，她一直在窗边和我换手数枝。我没去旅馆，谁把袋子封起来，我没有见过。",
    [ZHOU]: "我第二天六点起只在邮局和车站跑单，没从旅馆拿过匿名客人的东西。那些信已经够让人追问了，我不想再替谁解释行李。你要核对车站的纸牌，可以去问顾远山，我只记经手的单子。",
    [XU]: "我没经手那只皮箱，也没去车站看袋子。书店给修复纸编号，和车站给寄运物编号各用各的册，数字一样很常见。你可以把两种标牌的发放规则放在一起看，光看一个十七，我说不出是谁的东西。",
    [LU]: "第二天七点十分我去旅馆复核皮箱，月牙补丁和铜牌都对得上，箱子还在寄存架。林阿梨给我看车站回执，说十七号已经送站。我只在复核账上写了看见的皮箱，后来才收到车站的清点消息。",
    [CHEN]: "周砚第二天七点十分把签收回联送回邮局，林阿梨的名字在上面，收件时刻是六点。我按邮局电波钟登记归档，原信里客人请她等本人来取箱。我没去过旅馆，之后有没有另外代寄，我这里没收到新委托。",
    [GU]: "我第二天六点二十到六点三十五和周砚连续点夜间积件，十二个编号都有双方签记。六点五十他送来封好的布袋，我给它编了今天的十七号。纸牌只跟这只袋子，旅馆那块铜牌我没有领回来。",
    [BAI]: "我第二天一早在咖啡馆剪桌花，四批都和宋棠一起清点，六点四十五才收拾花篮。育苗钱还欠着林阿梨，我想着下午再去说还款的事。今早我没进旅馆，也没有见过那只要送站的布袋。",
    [LIN]: "客人让我不要公开去向，我就照着保密。第二天十七号已经送到车站，收据也在，周砚经手过。我没有把空袋登记成客人的行李，前台只是照常做了两张单。你要问客人去了哪里，我答应过，不能说。",
    [CHENG]: "第二天七点四十分顾远山请我一起剪封绳、点袋里东西，里面两张衬纸，我都写进清点联。签着 P06 的绳结也封存了。我没看见袋子在旅馆怎么装，单凭绳子常见，认不出谁系的。",
    [SHEN]: "第二天六点二十我和林阿梨在旅馆前台点过物件，皮箱有月牙补丁，空布袋摊着，P06 双联纸签没写字。看完我到旁边会客桌整理照片，没看她之后怎么装袋。核物页已经交给陆行舟，你可以看原记录。",
    [HAN]: "我第二天早晨在家整理钟楼检修工具，没去旅馆，也没参加车站的交接。我的校时器没有借出去，柜里的日期戳也没有人来取过。你若见到检修纸条，可以拿来让我认笔迹，没看过的单据，我不能替它作保。",
    [JIANG]: "我第二天早晨在家整理旧学生的信，天亮后才准备去咖啡馆。那位匿名客人托了谁，我没见过，也不能替他答应。陆行舟来问过我认不认识皮箱上的字，我没有认出来，箱里放什么也不知道。"
  },
  revisions: {
    [ZHOU]: { 1: "我刚才把话缩成只跑两处，是怕有人顺着问我替客人读了什么。第二天六点四十分我确实从林阿梨手上拿过封好的布袋，六点五十分交给顾远山。我拿袋时没有拆绳，也没有见她装过衣物。" },
    [LIN]: { 8: "P06 是我写的，那时袋里只有衬纸，我却填了代装衣物。我想先拿一张寄运回执，让追问的人以为行李已经离店。回执碰巧也是十七号，我就只说号码。客人让我保密，没有让我代寄，更没有让我编一份去向。" }
  },
  evidence: [
    { n: 1, at: "station", title: "17 号布袋交接联", text: "站台电波钟记时 06:50，周砚签认布袋 06:40 取自桥畔旅馆，顾远山签收，纸牌为今日第 17 号。联上注明纸签 P06、红蜡封绳完整，清点未开袋。联后印着纸牌每日从 01 起编，未登记皮箱。", meaning: "周砚确实取袋并把它交到车站，收站的对象是布袋。交接联没有证明袋中是客人的皮箱。", related: [ZHOU, GU, LIN], contradicts: [ZHOU], search: "核对车站柜台的 17 号布袋交接联" },
    { n: 2, at: "inn", title: "铜牌皮箱复核账", text: "寄存账画着一只棕皮箱，左角有月牙补丁，铜牌 17 系在箱把上。沈映、林阿梨在 06:20 核过箱与铜牌，07:10 陆行舟再核仍在。账页注明铜牌随寄存物保留，寄存号与车站纸牌各自编排。", meaning: "真正的皮箱在两次复核时都还在旅馆，旅馆铜牌和车站纸牌属于两套编号。", related: [LIN, SHEN, LU], search: "翻看旅馆前台柜台的铜牌皮箱复核账" },
    { n: 3, at: "station", title: "开袋清点联", text: "顾远山和程渡按站台电波钟写下 07:40，共同剪开带 P06 纸签的红蜡封绳。袋内只有两张衬纸，没有衣物。剪下的绳结与 06:50 封样同在清点袋里，两人签记收站后袋口未动。", meaning: "空袋在车站收到后没有被换过，错误的物件对应关系在旅馆封装时已经形成。", related: [GU, CHENG], search: "查看值班柜台的开袋清点联" },
    { n: 4, at: "post", title: "保密请求回联", text: "客人的转交请求写着棕皮箱、月牙补丁和旅馆铜牌 17，请林阿梨暂不公开自己的去向，等本人取箱。06:00 签收回联上有林阿梨签名，周砚送回邮局留底，附页没有代寄行李的委托。", meaning: "它解释林阿梨想保护客人的动机，也明确客人只要求保密，没有授权她制造寄运去向。", related: [LIN, ZHOU, CHEN], search: "核对邮局转交柜台的保密请求回联" },
    { n: 5, at: "cafe", title: "逐瓶桌花清点条", text: "收银机报时条依次为 06:15、06:25、06:35、06:45，白露与宋棠在每栏交替签下花枝数。页底写明四批连续剪枝装瓶，无人离开。门旁导引标着咖啡馆到旅馆最短步行十分钟。", meaning: "白露在准备窗口一直留在咖啡馆，她的欠款是误导，不能把她送到旅馆封袋。", related: [BAI, SONG], search: "查看咖啡馆收银台的逐瓶桌花清点条" },
    { n: 6, at: "station", title: "车站交接及编号册", text: "顾远山与周砚在 06:20—06:35 交替核过十二件积件，逐件签名，无离岗交接。后页依次登记今日寄运号，17 对应布袋，签发为 06:50。册边贴着车站到旅馆步行五分钟的导引。", meaning: "顾远山和周砚在封袋准备前都在车站，周砚随后才有时间去旅馆取已经封好的袋子。", related: [GU, ZHOU], search: "核对车站值班柜台的交接及编号册" },
    { n: 7, at: "police", title: "前台核物记录", text: "沈映递交的核物页记着旅馆电波钟 06:20，铜牌皮箱在架，另有空布袋和空白 P06 双联纸签。她与林阿梨共同清点，离开时布袋未封。页底附林阿梨 06:40 向周砚交袋的前台登记。", meaning: "它锁定林阿梨在填写和封袋前后独占前台的机会，并证明沈映离开时纸签还是空白。", related: [SHEN, LIN, ZHOU], search: "翻阅警务所值班桌的前台核物记录" },
    { n: 8, at: "inn", title: "P06 装袋纸签留底", text: "抽屉里夹着 P06 纸签的复写留底，林阿梨签记‘本店寄存 17，代装衣物’，经手时刻为旅馆电波钟 06:27。纸签留底与车站袋上同号，物件栏填的是布袋，棕皮箱一栏空着。", meaning: "林阿梨把空袋写成代装衣物，亲手制造了错误对应关系。她的初始说法被自己留下的纸签改正。", related: [LIN], contradicts: [LIN], search: "检查旅馆前台抽屉的 P06 装袋纸签留底" }
  ],
  history: [
    { key: "request-arrives", time: "05:45", at: "post", type: "conversation", actors: [ZHOU, CHEN], summary: "周砚把匿名客人的保密请求带到邮局待办栏，陈蕙看见回联仍未归档。", clue: 4 },
    { key: "request-signed", time: "06:00", at: "inn", type: "conversation", actors: [ZHOU, LIN], summary: "周砚在旅馆把请求交给林阿梨，她按旅馆电波钟签下回联，请客人等本人来取箱。", tags: ["motive"], clue: 4 },
    { key: "lin-decides", time: "06:02", at: "inn", type: "conflict", actors: [LIN], summary: "林阿梨独自读请求附言，因害怕有人追问客人去向，决定先做一份寄运记录。", tags: ["motive"] },
    { key: "station-start", time: "06:10", at: "station", type: "move", actors: [ZHOU, GU], summary: "周砚从旅馆赶到车站，和顾远山准备清点夜间积件。" },
    { key: "flowers-start", time: "06:15", at: "cafe", type: "alibi", actors: [BAI, SONG], summary: "白露与宋棠开始按收银机报时清点四批桌花，直到 06:45 没有人离开。", tags: ["alibi"], clue: 5 },
    { key: "station-count", time: "06:20", at: "station", type: "alibi", actors: [ZHOU, GU], summary: "周砚和顾远山交替核对十二件积件，双方逐件签名，没有离岗交接。", tags: ["alibi", "opportunity"], clue: 6 },
    { key: "inn-check", time: "06:20", at: "inn", type: "witness", actors: [LIN, SHEN], summary: "沈映和林阿梨核对皮箱、空布袋与空白 P06 纸签，皮箱铜牌为 17，纸签尚未填写。", clue: 7 },
    { key: "fill-bag", time: "06:27", at: "inn", type: "obtain_item", actors: [LIN], summary: "林阿梨在前台填写 P06 纸签，写下本店寄存 17、代装衣物，把衬纸装进空袋并封上红蜡绳。", tags: ["means", "opportunity", "staging"], clue: 8 },
    { key: "leave-station", time: "06:35", at: "station", type: "move", actors: [ZHOU, GU], summary: "车站积件清点结束，周砚带着取件登记步行去旅馆。" },
    { key: "pickup", time: "06:40", at: "inn", type: "conversation", actors: [ZHOU, LIN], summary: "周砚在前台签字取走已经封好的 P06 布袋，袋口和纸签没有打开。", clue: 1, publicVersion: "周砚称自己没有从旅馆取过匿名客人的东西。", contradictedBy: [1] },
    { key: "station-arrival", time: "06:45", at: "station", type: "move", actors: [ZHOU, GU], summary: "周砚把封好的布袋带回车站，顾远山核对纸签和封口。" },
    { key: "receipt", time: "06:50", at: "station", type: "conversation", actors: [ZHOU, GU], summary: "顾远山按站台电波钟把这只布袋编为今日第 17 号，签收并开出回执。", clue: 1 },
    { key: "receipt-return", time: "06:55", at: "inn", type: "conversation", actors: [ZHOU, LIN], summary: "周砚把车站回执送回旅馆，林阿梨发现车站纸牌也写着 17，却只向他确认已经送站。" },
    { key: "police-check", time: "07:10", at: "inn", type: "forensic_clue", actors: [LIN, LU], summary: "陆行舟复核旅馆皮箱，月牙补丁和铜牌仍在。林阿梨称 17 号已经送站，没有说明箱子仍在。", clue: 2, publicVersion: "林阿梨称 17 号行李已送站，前台没有把空袋写成客人的行李。", contradictedBy: [8] },
    { key: "post-file", time: "07:10", at: "post", type: "conversation", actors: [ZHOU, CHEN], summary: "周砚把签收回联送回邮局，陈蕙按邮局电波钟归档，附页没有代寄行李的委托。", clue: 4 },
    { key: "police-file", time: "07:20", at: "police", type: "conversation", actors: [SHEN, LU], summary: "沈映把 06:20 的前台核物页交给陆行舟，记录显示她离开时 P06 纸签仍为空白。", clue: 7 },
    { key: "discover", time: "07:40", at: "station", type: "incident", actors: [GU, CHENG], summary: "顾远山和程渡共同开袋清点，发现只有两张衬纸，真正的衣物不在布袋中。", tags: ["nonfatal_incident"], clue: 3 }
  ],
  scenes: ["station", "inn", "post", "cafe", "police", "books"],
  relationships: [{ from: LIN, to: ZHOU, label: "旅馆保管与清晨取件" }, { from: LIN, to: GU, label: "寄存物与车站交接" }, { from: BAI, to: LIN, label: "育苗欠款与旅馆往来" }],
  exclusions: [
    { characterId: ZHOU, reason: "他隐瞒了 06:40 取袋，但 06:20—06:35 在车站有连续清点记录，取到的是已封好的袋子，无法解释纸签内容。", clues: [1, 6, 8] },
    { characterId: GU, reason: "他在车站连续接收布袋，06:50 才签发第 17 号纸牌，没有旅馆前台钥匙，也没有打开封口。", clues: [1, 3, 6] },
    { characterId: BAI, reason: "她 06:15—06:45 与宋棠在咖啡馆逐批清点桌花，旅馆到咖啡馆需十分钟，不能在封装窗口往返。", clues: [5, 7] }
  ],
  reasoning: [
    { id: "rb4-object", conclusion: "旅馆铜牌和车站纸牌都写 17，但账册、材质和签发单位证明它们属于不同物件。", clues: [1, 2, 6] },
    { id: "rb4-motive", conclusion: "保密请求解释林阿梨想保护客人的去向，却没有授权她制造寄运记录。", clues: [4] },
    { id: "rb4-window", conclusion: "06:20 的核物页、06:27 的纸签留底和 06:40 的取件登记把封装限制在旅馆前台。", clues: [7, 8, 1] },
    { id: "rb4-means", conclusion: "P06 留底写明代装衣物，车站清点却只有衬纸，说明错误的物件对应关系在旅馆形成。", clues: [3, 8] },
    { id: "rb4-exclusion", conclusion: "车站连续清点、咖啡馆逐瓶记录和封口未动的清点联排除了周砚、顾远山与白露。", clues: [1, 3, 5, 6] }
  ],
  redHerrings: ["周砚否认取袋，实际隐瞒的是替客人读信和搬运已经封好的布袋。", "白露欠旅馆育苗钱，清晨又与宋棠连续清点桌花。", "两个 17 号看起来像同一行李，车站纸牌和旅馆铜牌其实各有编号规则。"],
  decisive: [1, 2, 3, 4, 6, 7, 8],
  answer: { motive: [4], method: [3, 8] },
  sources: { motive: 4, means: 8, opportunity: 7, staging: 8, trace: 3, groupAlibi: 6 },
  events: { trigger: "discover", motive: "lin-decides", means: ["fill-bag", "pickup"], opportunity: "inn-check", staging: "fill-bag", trace: "discover", groupAlibi: "station-count", scene: "inn", prep: "inn" },
  ending: [
    "客人亲自核对月牙补丁和箱内物品后，重新签下寄存期限。林阿梨撤回装袋单上的衣物说明，车站在空袋收据旁补齐物件特征。两枚十七号各回各的账，真正的行李按客人的决定继续保管。",
    "周砚把替人读信的私事与清晨搬袋的交接分别说明，交接簿只留下搬运事实。白露把桌花收入和育苗欠款摊开来谈，宋棠替她收好逐瓶清点条。几个人各自解释清楚，没有再把别人的沉默填成自己的猜测。",
    "林阿梨承担了空袋清点和重开单据的费用，也向客人说明自己擅填寄运的经过。旅馆前台添了一页委托事项，保密、保管、代寄分别签字。她仍愿意替人守口，先学会把决定留给物主。"
  ]
};
