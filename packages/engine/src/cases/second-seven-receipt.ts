import type { CasePack } from "../case-pack";

const SONG = "rb-song-tang", JIANG = "rb-jiang-zhi", CHEN = "rb-chen-hui", LIN = "rb-lin-ali";
const ZHOU = "rb-zhou-yan", BAI = "rb-bai-lu", SHEN = "rb-shen-ying", GU = "rb-gu-yuanshan";
const LU = "rb-lu-xingzhou", XU = "rb-xu-zhiwei", HAN = "rb-han-shuo", CHENG = "rb-cheng-du";

/** 第九宗。两张相同时间的收据掩盖的是店主自己挪用的租金。 */
export const SECOND_SEVEN_RECEIPT: CasePack = {
  revision: "riverbend-second-seven-receipt.v1",
  key: "second-seven-receipt",
  ordinal: "第九宗",
  title: "两张七点收据",
  theme: "自救的谎言也会把无辜的人推上柜台",
  premise: "第三天清晨，咖啡馆的账册上夹着两张编号相同的早餐收据，其中一张被当成了给江芷的两百元退款凭证。江芷否认领钱，花摊预订的货款却确实少了两百元。",
  publicCaseFile: "两张收据都标着 07:05，只有一张进过机器流水。旅馆的租金签收单和邮局的汇款回执也各有一笔两百元。请把这几笔钱按时间排开，再核对退款见证栏。",
  question: "谁用第二张收据掩盖了花款的去向",
  verdict: "{person}把垫进租金的花款写成了顾客退款",
  commission: { hook: "咖啡馆出现两张七点收据", detail: "江芷否认领过账上那笔两百元退款。请到警务所或河湾咖啡馆领取手记，核对当天的流水。", openAt: ["police", "cafe"], refusal: "请到警务所或河湾咖啡馆领取收银记录的调查手记。" },
  after: "borrowed-bridge-seal",
  day: 3,
  window: { from: "07:05", to: "07:55" },
  ids: { clue: "rb9-clue", search: "rb9-search" },
  historyTag: "riverbend-authored-history",
  historyNote: "第 3 天咖啡馆收银条与租金信封的案前记录。",
  timelineSource: "原创第 3 天咖啡账目调换案事实 v1",
  culpritId: SONG,
  witnessId: LIN,
  suspectIds: [SONG, JIANG, CHEN, LIN],
  culprit: {
    motive: "妹妹寄来 200 元，请宋棠替她付给白露作花款。咖啡馆今天要交 1,200 元租金，宋棠只凑到 1,000 元，便先挪用了这笔花款，打算营业后补回。",
    means: "她从抽屉的花款夹取出 200 元凑齐租金。回店后，她用旧纸手抄江芷早餐收据的编号，再在退款栏写『代领 200』，把租金支出伪装成支给江芷的退款。",
    opportunity: "07:05 江芷付完早餐钱就到窗边备课。07:08 营业抽屉仍由宋棠独自看管，她取钱后于 07:18 到旅馆交租，07:28 回店填了退款栏。"
  },
  others: { motive: "与咖啡馆、花摊货款或旅馆租金有往来，尚需核对。", means: "可能接触收银机、租金信封或退款栏。", opportunity: "第 3 天早晨的实际行踪需要核对。" },
  statements: {
    [SONG]: "七点零五我给江老师打了一张早餐收据。抽屉少的两百是她代花摊领走的退款，另一张收据是留底。我的租金是另外凑的，你可以去问林老板。",
    [JIANG]: "我拿的是早餐，不是花。七点零五付完热茶钱，我就坐到窗边改讲义。店里后来有没有补写什么，我没看见。账册上那个『江』字也不是我签的。",
    [CHEN]: "我在邮局分拣退回件，咖啡馆的收银纸不经过邮局。若是顾客退款，通常会在当天营业账上留下原因。",
    [LIN]: "前台电波钟七点十八，宋棠当面交齐一千二。她先拿出一千，又从一只蓝纸夹里抽了两张一百；我把两笔分开写在同一张交接单上。",
    [ZHOU]: "我第三天早上只送普通件，没去咖啡馆。收据编号是店里的流水，邮局不能替它证明哪一张是真的。",
    [BAI]: "我没把花送到咖啡馆，江芷若说有人拿她当借口，我也不知道是哪笔钱。",
    [SHEN]: "我那阵子在查另一份档案，没进咖啡馆。听说江老师被怀疑拿了钱，可一张收据通常只能说明买过什么，谁拿过钱要另外核对。",
    [GU]: "七点四十二我按车站电波钟抄好的时间到咖啡馆。只看见一张早餐收据，没在退款栏签过字；钱给过谁，我没看到。",
    [LU]: "我按值班室的电波钟记的，早上七点五十五收齐两张票和租金、汇款的副本。先别把退款栏里的『江』当签名，这几笔钱得分别核对。",
    [XU]: "我在旧书店整理地图册，收据纸卷的边缘若被剪过，切口会比正常出单更平。",
    [HAN]: "我早上在警务所归还验收章，没去咖啡馆。两张相同编号的收据不可能都来自同一次机器出单。",
    [CHENG]: "我处理完桥修木料才去广场，没见到咖啡馆的租金信封。"
  },
  revisions: {
    [LIN]: { 2: "我确实在七点五十看见第二张收据。宋棠让我把前台副联放回柜台，又当着我的面把手抄件夹进退款栏。我怕旅馆的租金副本也被牵扯进来，才说自己只在前台见过她。" }
  },
  evidence: [
    { n: 1, at: "cafe", title: "收银账册副本", text: "07:05 早餐入账后，抽屉清点为 860 元，含蓝纸夹花款 200 元；07:28 复点剩 660 元。两次清点间没有别笔现金交易。退款行写『C-207，代领 200，江』，签收栏却空着。", meaning: "少的是预留给花摊的现金；『江』写在经办备注里，不能证明江芷领款。", related: [LU, JIANG, SONG], search: "阅读收银台里的咖啡馆账册副本" },
    { n: 2, at: "cafe", title: "两张相同编号的收据", text: "收银流水只有 07:05 的早餐单 C-207。第二张用旧花单的背面手抄了日期、时间和编号，底下添了『见到两张纸』，有顾远山签名和他按站台电波钟校过的 07:42 手表时间。", meaning: "第二张是手抄的假退款附件。顾远山签字证明纸张数，可以问清他当时看见什么。", related: [SONG, JIANG, GU], contradicts: [LIN], search: "比对收银台封存的两张七点收据" },
    { n: 3, at: "inn", title: "租金交接单复写联", text: "旅馆前台电波钟 07:18：咖啡馆本月租金实收 1,200 元。林阿梨在复写联分记『租金袋 1,000』『蓝纸夹 200』。两笔由宋棠当面点交，蓝纸夹边沿还有半个白露花摊的印记。", meaning: "租金足额，差的两百是在交租时从花款里补上的。", related: [SONG, LIN, BAI], search: "查看前台桌上的租金交接单复写联" },
    { n: 4, at: "post", title: "邮局汇款回执复写联", text: "陈蕙按邮局电波钟于 07:30 调出回执：寄款人是宋棠的妹妹，收款人是宋棠，金额 200 元。附言为『请替我给白露，花钱已凑齐』。签收栏是宋棠的名字，没有转交记录。", meaning: "这两百元本来是给白露的花款，并非江芷付过的款或可以退款给她的钱。", related: [SONG, CHEN, BAI], search: "核对分拣台上的邮局入账回执复写联" }
  ],
  history: [
    { key: "open-register", time: "07:05", at: "cafe", type: "conversation", actors: [SONG, JIANG], summary: "江芷用现金买热茶，拿到唯一一张机器收据。宋棠复点抽屉，在账上记下 860 元。", clue: 1 },
    { key: "duplicate", time: "07:08", at: "cafe", type: "obtain_item", actors: [SONG], summary: "宋棠趁江芷在窗边备课，从抽屉的蓝纸夹取出两百元，连纸夹带去旅馆。", tags: ["means", "opportunity"], clue: 1 },
    { key: "rent-envelope", time: "07:18", at: "inn", type: "conflict", actors: [SONG, LIN], summary: "林阿梨按租约收齐一千二；宋棠先交租金袋里的一千，再从蓝纸夹抽出两张一百补齐。", tags: ["motive"], clue: 3 },
    { key: "rent-return", time: "07:20", at: "inn", type: "forensic_clue", actors: [LIN], summary: "林阿梨把两笔款和蓝纸夹上的花摊印记写入交接单。" },
    { key: "cafe-return", time: "07:28", at: "cafe", type: "obtain_item", actors: [SONG, JIANG], summary: "宋棠回店时江芷还在备课。宋棠照早餐流水手抄了一张同号单，在账册里把短款写成江芷代领的退款。", tags: ["means", "staging"], clue: 2 },
    { key: "transfer-file", time: "07:30", at: "post", type: "forensic_clue", actors: [CHEN], summary: "陈蕙应租金对账请求调出带花款附言的汇款回执，发给警务所。", clue: 4 },
    { key: "register-note", time: "07:50", at: "cafe", type: "witness", actors: [LIN, SONG], summary: "林阿梨七点五十到咖啡馆送回前台副联，看见宋棠把手抄件插进退款栏。", clue: 2, publicVersion: "林阿梨称自己只在旅馆前台见过宋棠。", contradictedBy: [2] },
    { key: "police-copy", time: "07:55", at: "police", type: "incident", actors: [LU, GU], summary: "顾远山把两张票和账册副本送到警务所。陆行舟对照旅馆和邮局先传来的副本，发现退款无签收，登记调查。", tags: ["nonfatal_incident"], clue: 1 }
  ],
  scenes: ["cafe", "inn", "post", "police", "station", "books"],
  relationships: [
    { from: SONG, to: JIANG, label: "咖啡馆收银与课程整理" },
    { from: SONG, to: LIN, label: "租金交接与前台记录" },
    { from: SONG, to: CHEN, label: "妹妹汇款与邮局入账" }
  ],
  exclusions: [
    { characterId: JIANG, reason: "营业流水只有她付过早餐钱。所谓退款单是手抄件，江芷没有签收，顾远山也只确认见过两张纸。", clues: [1, 2] },
    { characterId: CHEN, reason: "邮局回执只记收汇，收款签名属于宋棠；之后两百元已在旅馆由宋棠当面交付。", clues: [3, 4] },
    { characterId: LIN, reason: "林阿梨把两笔租金分记在账，旧纸假收据却是在宋棠回店之后插入退款栏。", clues: [2, 3] }
  ],
  reasoning: [
    { id: "rb9-duplicate", conclusion: "机器只出过一张早餐单；同号纸条抄到的是早餐流水，不能作为第二笔现金交易凭证。", clues: [1, 2] },
    { id: "rb9-motive", conclusion: "两百元随蓝纸夹计入实收租金。邮局附言说明它原本是白露的花款，宋棠需要它来凑齐租金。", clues: [3, 4] },
    { id: "rb9-opportunity", conclusion: "07:05 抽屉仍有花款，07:18 旅馆已收进租金，07:28 店账才把缺口写成退款。", clues: [1, 3] },
    { id: "rb9-means", conclusion: "宋棠取走花款，用手抄同号收据和无签收的退款行补齐账面；见证签字只确认纸张数。", clues: [1, 2] },
    { id: "rb9-exclusion", conclusion: "邮局只经手汇款，旅馆只签收租金，江芷只付过早餐钱，三个环节对得上宋棠的经手顺序。", clues: [1, 2, 3, 4] }
  ],
  redHerrings: ["退款行的『江』让人误以为江芷签过字。", "顾远山在第二张票上签了名，却只确认看见两张纸。", "两个地点都有二百元记录，但只有旅馆真的收过这笔现金。"],
  decisive: [1, 2, 3, 4],
  answer: { motive: [3, 4], method: [1, 2] },
  sources: { motive: 3, means: 1, opportunity: 1, staging: 2, trace: 2, groupAlibi: 1 },
  events: { trigger: "police-copy", motive: "rent-envelope", means: ["duplicate", "cafe-return"], opportunity: "duplicate", staging: "cafe-return", trace: "duplicate", groupAlibi: "open-register", scene: "cafe", prep: "inn" },
  ending: [
    "咖啡馆划掉了江芷名下的退款，把手抄单和机器单并排封存。账本重新写清那两百元去了哪里，花摊没有少交货，江芷也不必再解释自己只买过一杯茶。",
    "宋棠按真实的交租顺序给妹妹回了信，也请白露到店里核过花单。林阿梨在前台留下两段收据，以后交租和代收货款各用自己的纸夹，不再借同一个抽屉记账。",
    "宋棠从次日营业款里补齐花钱，亲手改正了错账。顾远山划掉原来的见证签名，在旁边写明他究竟看见了什么。两张七点的纸留下来，谁也没拿它再证明有一笔退款。"
  ]
};
