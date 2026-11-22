import type { CasePack } from "../case-pack";

const LIN = "rb-lin-ali", ZHOU = "rb-zhou-yan", CHEN = "rb-chen-hui", LU = "rb-lu-xingzhou";
const JIANG = "rb-jiang-zhi", SONG = "rb-song-tang", GU = "rb-gu-yuanshan", BAI = "rb-bai-lu";
const XU = "rb-xu-zhiwei", SHEN = "rb-shen-ying", HAN = "rb-han-shuo", CHENG = "rb-cheng-du";

export const RETURNED_WINDOW: CasePack = {
  revision: "riverbend-returned-window.v1", key: "returned-window", ordinal: "第五宗", title: "错开的投递窗",
  theme: "保护别人的秘密，不能改写公共记录",
  premise: "第二天下午，邮局发现一封挂号信被盖成‘本人领取’，信封却仍在待寄抽屉。退回联上的日期压痕与补盖字迹没有对齐。",
  publicCaseFile: "挂号信内是旧住户准备离镇的租约副本，封口完整，收件人没有领取。退回联写着本人领取，邮局、警务所和车站的时间记录互相牵连，请核对日期戳、抽屉钥匙和清晨交接。",
  question: "谁把待寄信盖成了本人领取", verdict: "{person}把待寄信盖成了本人领取",
  commission: { hook: "退回联上的错误日期", detail: "一封挂号信仍在邮局抽屉，退回联却写着本人已经领取。第 2 天下午到邮局或警务所领取调查手记。", openAt: ["post", "police"], refusal: "请到邮局或警务所领取投递记录的调查手记。" },
  after: "same-numbered-luggage", day: 2, window: { from: "04:50", to: "07:30" }, ids: { clue: "rb5-clue", search: "rb5-search" },
  historyTag: "riverbend-authored-history", historyNote: "第 2 天邮局退回联与挂号信记录。", timelineSource: "原创第 2 天投递记录案事实 v1",
  culpritId: CHEN, witnessId: ZHOU, suspectIds: [CHEN, ZHOU, LU, JIANG],
  culprit: { motive: "她认出信中是旧住户的离镇租约，想让信件等到本人亲自来取。", means: "她先用旧日期戳压出轮廓，再用当天蓝色印油补盖本人领取字样，把信留在待寄抽屉。", opportunity: "05:20 后她独自在分拣台和退回抽屉之间工作，钥匙登记与印油都在她手里。" },
  others: { motive: "与信件、退回记录或公开告示有往来，尚需核对。", means: "接触过邮局或警务所的公开记录。", opportunity: "清晨实际行踪需要用交接记录排除。" },
  statements: {
    [SONG]: "第二天六点二十五分江老师到咖啡馆取早餐券，她坐在门边和我说了几句旧学生的事，没有去邮局。收银机打印了时间，我后来一直在柜台。挂号信的事我只听说过，没有看过信封。",
    [ZHOU]: "我四点五十分到邮局待寄栏，看到一张保密请求的备注，后来去车站和旅馆跑单。五点四十分回邮局时，陈蕙已经在分拣台。我没有打开退回抽屉，也没有拆任何挂号信。",
    [XU]: "我第二天早上在旧书店整理修复纸，没有去邮局。日期戳留下压痕并不奇怪，关键是先压什么、后盖什么。没有看过那张退回联之前，我不能替谁说字是怎么出现的。",
    [LU]: "六点十分我在警务所登记普通退回包裹，电波钟和蓝色印油都在值班桌上。退回抽屉的钥匙没有交给我，正式登记由邮局自己保管。",
    [CHEN]: "我清晨只是在邮局分拣，挂号信一直按流程等投递。退回联上的本人领取应该是系统漏录，信还在抽屉里不代表有人改过记录。那位旧住户的私事，我没有理由知道。",
    [GU]: "七点零五分我在车站交公文，之后才去邮局取公文回执。顾客信件没有经过我的手，我看到挂号信时它还在待寄抽屉，陈蕙说等系统修好再处理。",
    [BAI]: "我第二天早晨在家整理花篮，下午才去旅馆问育苗钱。邮局的退回联我不认识，别把我欠账的事和别人的信件混在一起。",
    [LIN]: "我在旅馆处理昨晚的行李账，没去邮局。那封信的收件人是否离镇，不该由任何替他保管东西的人替他决定。",
    [CHENG]: "我早上在河桥边修栏杆，没有进入邮局。日期戳和木工印章一样，都要看压痕和墨色的先后，不能只看最后一行字。",
    [SHEN]: "我在旅馆整理采访授权，没有看过挂号信。旧住户要不要离开是他的事，记者也不能用一张退回联替他宣布决定。",
    [HAN]: "我在家整理检修工具，没碰邮局的日期戳。旧戳若已经撤下，柜台上却出现相同压痕，就该查钥匙和领用记录。",
    [JIANG]: "我六点二十五去咖啡馆取早餐券，之后回家整理信件，没有去邮局。那封租约是不是我的旧学生的，我不认识封面，也没有拆过信。"
  },
  revisions: {
    [ZHOU]: { 1: "我把话说得太短，是不想让人追问我替谁读信。四点五十分我确实看见待寄栏的保密备注，五点四十分回邮局时陈蕙正在退回抽屉旁。我没有开柜，也没有看信里内容。" },
    [CHEN]: { 8: "旧日期戳是我拿的。我先压出旧日期的轮廓，再用分拣台的蓝色印油补盖‘本人领取’，想让信暂时留在抽屉，等收件人亲自来取。保护隐私不能让我改公共记录。" }
  },
  evidence: [
    { n: 1, at: "post", title: "分拣台退回联", text: "退回联上先有旧日期戳的凹痕，后盖的蓝色‘本人领取’字样压在凹痕边缘。旧日期的最后一位缺口与邮局抽屉里撤下的旧戳一致。", meaning: "证明先压旧戳、后补盖字，记录经过人为改写。", related: [CHEN, ZHOU], contradicts: [CHEN, ZHOU], search: "检查邮局分拣台的退回联" },
    { n: 2, at: "post", title: "分拣机与钥匙登记", text: "邮局电波钟记录 04:50—07:30 的分拣交接。退回抽屉钥匙只有陈蕙在 05:20 后签领，周砚只签了待寄栏备注。", meaning: "限定操作机会在陈蕙手中。", related: [CHEN, ZHOU], search: "核对邮局登记柜台的分拣机与钥匙登记" },
    { n: 3, at: "police", title: "普通退回登记", text: "警务所 06:10 的普通退回包裹使用全新的蓝色印油，纸边没有旧戳凹痕。陆行舟在电波钟旁签名，印油一直留在值班桌。", meaning: "排除陆行舟伪造旧日期压痕。", related: [LU], search: "翻阅警务所值班桌的普通退回登记" },
    { n: 4, at: "post", title: "待寄抽屉里的挂号信", text: "挂号信封口完整，仍在邮局待寄抽屉。收件栏写着旧住户姓名，信内租约副本没有被抽出，抽屉交接页没有本人领取签名。", meaning: "证明信没有被收件人领取，退回联与实物冲突。", related: [CHEN, ZHOU], search: "查看邮局待寄抽屉里的挂号信" },
    { n: 5, at: "cafe", title: "早餐券收银条", text: "咖啡馆收银机打印 06:25，江芷领取早餐券，宋棠在底栏签名。两人记录她坐到 06:35，咖啡馆到邮局最短步行十五分钟。", meaning: "排除江芷在 05:20 后进入邮局的可能，也解释她隐瞒私人道歉信。", related: [JIANG, SONG], search: "查看咖啡馆收银台的早餐券收银条" },
    { n: 6, at: "station", title: "公文交接页", text: "车站标准钟记录顾远山 07:05 交公文，07:30 才在邮局取回执。两次签名都有地点栏，车站到邮局步行二十分钟。", meaning: "给顾远山的发现路径提供时间来源，排除他在改戳窗口接触邮局抽屉。", related: [GU], search: "核对车站柜台的公文交接页" },
    { n: 7, at: "police", title: "退回抽屉钥匙领用单", text: "钥匙领用单写着 05:20 陈蕙签领、07:30 归还。周砚、陆行舟和顾远山没有领用记录，归还时钥匙上沾着蓝色印油。", meaning: "把退回联、抽屉和蓝色印油连到陈蕙。", related: [CHEN, ZHOU, LU, GU], search: "查看值班桌上的退回抽屉钥匙领用单" },
    { n: 8, at: "post", title: "旧日期戳与蓝色印油", text: "撤下的旧日期戳缺口与退回联凹痕相合，分拣台蓝色印油的边缘与后盖字样同色。旧戳从 05:20 到 07:30 没有别人领用。", meaning: "确认手法和操作工具来自邮局分拣台。", related: [CHEN], contradicts: [CHEN], search: "检查挂号柜台的旧日期戳与蓝色印油" }
  ],
  history: [
    { key: "remark", time: "04:50", at: "post", type: "conversation", actors: [ZHOU], summary: "周砚按邮局电波钟查看待寄栏，看到一张保密备注，没有打开挂号信。", clue: 4, publicVersion: "周砚称自己清晨没有到过邮局待寄栏。", contradictedBy: [1] },
    { key: "home-return", time: "05:05", at: "house-north-c", type: "move", actors: [CHEN], summary: "陈蕙从邮局后巷住宅取回自己的未寄辞职信，再回邮局上班。" },
    { key: "read-address", time: "05:20", at: "post", type: "conflict", actors: [CHEN], summary: "陈蕙在分拣台看到挂号信地址和租约标题，决定让收件人本人来取。", tags: ["motive"], clue: 2 },
    { key: "stamp", time: "05:28", at: "post", type: "obtain_item", actors: [CHEN], summary: "陈蕙取旧日期戳压出轮廓，再用蓝色印油补盖本人领取字样，把信留进待寄抽屉。", tags: ["means", "opportunity", "staging"], clue: 1 },
    { key: "stamp-tools", time: "05:29", at: "post", type: "forensic_clue", actors: [CHEN], summary: "陈蕙把旧戳放回抽屉，蓝色印油边缘和退回联上的补盖字保持同一方向。", clue: 8, publicVersion: "陈蕙称自己没有拿过旧日期戳，也没有改动退回联。", contradictedBy: [8] },
    { key: "return-file", time: "05:40", at: "post", type: "conversation", actors: [ZHOU, CHEN], summary: "周砚回邮局核对第一批投递袋，陈蕙把退回联夹进账册，没有把信交给他。" },
    { key: "police-log", time: "06:10", at: "police", type: "alibi", actors: [LU], summary: "陆行舟用警务所电波钟登记普通退回包裹，使用全新蓝色印油。", tags: ["alibi"], clue: 3 },
    { key: "breakfast", time: "06:25", at: "cafe", type: "alibi", actors: [JIANG, SONG], summary: "江芷在咖啡馆领取早餐券，坐到 06:35，没有进入邮局。", tags: ["alibi"], clue: 5 },
    { key: "file-return", time: "06:45", at: "post", type: "forensic_clue", actors: [CHEN], summary: "陈蕙把退回联夹进当天账册，挂号信仍留在待寄抽屉。", clue: 7 },
    { key: "station-doc", time: "07:05", at: "station", type: "move", actors: [GU], summary: "顾远山在车站交公文，准备之后去邮局取回执。", clue: 6 },
    { key: "discover", time: "07:30", at: "post", type: "incident", actors: [LU, CHEN], summary: "陆行舟到邮局核对退回记录，发现挂号信仍在抽屉，退回联却写着本人领取。", tags: ["nonfatal_incident"], clue: 4 }
  ],
  scenes: ["post", "police", "cafe", "station", "inn", "books"],
  relationships: [{ from: CHEN, to: ZHOU, label: "邮局交接与替人读信" }, { from: CHEN, to: LU, label: "退回登记与钥匙领用" }, { from: JIANG, to: SONG, label: "早餐券和旧学生的信" }],
  exclusions: [
    { characterId: ZHOU, reason: "他只看见待寄备注，05:40 与陈蕙核对投递袋，没有领用退回抽屉钥匙。", clues: [2, 7] },
    { characterId: LU, reason: "06:10 的普通退回使用全新印油，没有旧戳压痕，且钥匙领用单没有他的签名。", clues: [3, 7] },
    { characterId: JIANG, reason: "06:25—06:35 在咖啡馆，咖啡馆到邮局需十五分钟，不能进入 05:20 后的改戳窗口。", clues: [5, 7] }
  ],
  reasoning: [
    { id: "rb5-motive", conclusion: "挂号信内的租约副本和保密备注解释保护隐私的动机。", clues: [2, 4] },
    { id: "rb5-means", conclusion: "退回联的旧压痕先于蓝色补盖字，日期记录被人为改写。", clues: [1, 8] },
    { id: "rb5-object", conclusion: "信封仍在待寄抽屉且封口完整，证明本人领取记录不真实。", clues: [4] },
    { id: "rb5-opportunity", conclusion: "钥匙领用和分拣机交接把操作机会限定在陈蕙。", clues: [2, 7] },
    { id: "rb5-exclusion", conclusion: "警务所、咖啡馆和车站的连续记录排除其他三名嫌疑人。", clues: [3, 5, 6, 7] }
  ],
  redHerrings: ["周砚隐瞒自己看见待寄备注，实际没有拆信。", "陆行舟拥有蓝色印油，但他的退回联没有旧压痕。", "江芷隐瞒私人道歉信，却一直在咖啡馆。"],
  decisive: [1, 2, 3, 4, 7, 8], answer: { motive: [2, 4], method: [1, 8] },
  sources: { motive: 4, means: 8, opportunity: 2, staging: 1, trace: 7, groupAlibi: 2 },
  events: { trigger: "discover", motive: "read-address", means: ["stamp"], opportunity: "stamp", staging: "stamp", trace: "file-return", groupAlibi: "return-file", scene: "post", prep: "post" },
  ending: ["挂号信交给收件人本人，退回联恢复为待本人领取。邮局在账册旁补上真实时间，信件内容仍由收件人决定是否公开。", "周砚说明自己替人读信的范围，陆行舟补录正式退回流程。江芷把自己的道歉信交给真正的收件人，几个人没有再用沉默填空。", "陈蕙承认改戳和暂存信件，承担重做账册的责任。她仍想保护别人，但以后会把保密请求夹在信外，不再改写公共记录。"]
};
