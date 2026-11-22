import type { CasePack } from "../case-pack";

const SHEN = "rb-shen-ying", XU = "rb-xu-zhiwei", HAN = "rb-han-shuo", JIANG = "rb-jiang-zhi";
const LU = "rb-lu-xingzhou", GU = "rb-gu-yuanshan", LIN = "rb-lin-ali", SONG = "rb-song-tang";
const CHEN = "rb-chen-hui", ZHOU = "rb-zhou-yan", BAI = "rb-bai-lu", CHENG = "rb-cheng-du";

/** 第十宗。被改动的地图把嫌疑推向修复师，实际是记者为核实母亲旧话而越权取走覆片。 */
export const MAP_WITHOUT_NORTH: CasePack = {
  revision: "riverbend-map-without-north.v1",
  key: "map-without-north",
  ordinal: "第十宗",
  title: "没有北面的地图",
  theme: "寻找真相也要让被保护的人知道你动过什么",
  premise: "第三天清晨，旧书店展台上的旧地图少了印着北箭头的透明覆片，卡槽里多出一张红线描图。消失的覆片上还有修复师祖父的手记，镇上有人认为是许知微亲手把它藏了起来。",
  publicCaseFile: "展台框槽没有被撬开，地图本体也没有破损，只有可拆的透明覆片被取走。许知微的修复登记、警务所的档案借阅单和车站旧测绘纸各自记着不同的北向标记，请找出是谁取走覆片，又想让谁背下这次改动。",
  question: "谁取走了旧地图的北向覆片",
  verdict: "{person}取走了旧地图的北向覆片",
  commission: { hook: "旧地图没有北面了", detail: "旧书店展台少了印着北箭头的透明覆片，原处多了一张无方向的红线描图。请到旧书店或警务所查问。", openAt: ["books", "police"], refusal: "请到旧书店或警务所领取旧地图改动的调查手记。" },
  after: "second-seven-receipt",
  day: 3,
  window: { from: "07:15", to: "07:55" },
  ids: { clue: "rb10-clue", search: "rb10-search" },
  historyTag: "riverbend-authored-history",
  historyNote: "第 3 天旧地图北向覆片被取走前后的案前记录。",
  timelineSource: "原创第 3 天旧地图覆片调换案事实 v1",
  culpritId: SHEN,
  witnessId: LIN,
  suspectIds: [SHEN, XU, HAN, JIANG],
  culprit: {
    motive: "母亲的笔记提到洪水时曾走过一条避难路。她想把路线和覆片上的旧门牌对照，请仍住在镇上的当事人认领这段记忆。覆片马上要公开展出，她担心门牌被认出，想先私下核实。",
    means: "她对照警务所收存的测绘副图，在旅馆借来的裁余描图纸上抄下路线。她抽走带北箭头、门牌和祖父落款的覆片，换进省去方向与住户标记的红线描图。",
    opportunity: "07:15 她在警务所查到旧地图档案，07:25 回旅馆取描图纸，07:37 到旧书店时许知微正在修复桌旁，几分钟内就能接触展台。"
  },
  others: { motive: "与旧地图、钟表校向或书店展品有往来，尚需核对。", means: "可能接触展台覆片、修复纸或旧测绘档案。", opportunity: "第三天清晨的实际行踪需要核对。" },
  statements: {
    [SHEN]: "我七点十五在警务所查的是母亲采访的旧档案，之后只在旅馆整理稿纸，没有进旧书店。那条红线像修复师为方便读图画的辅助线。",
    [XU]: "我按修复桌的校准钟在七点零六封好原图。祖父的落款写在这张覆片上，我不同意公开门牌，但展台不是我拆的。七点四十五回展台时，卡槽里只剩一张红线纸。",
    [HAN]: "我早上在警务所整理钟表工具，旧地图的北向标记和钟楼校向不是一回事。谁要查老档案，应当在借阅单上留下名字。",
    [JIANG]: "我六点五十分还在咖啡馆，后来去书店还课程册。展台的红线不是我画的，我只注意到框槽边有一小片透明碎屑。",
    [LU]: "七点十五沈映确实来查过旧地图档案，她说要核对一条旧路线。档案借阅单由我保管，之后她有没有回书店，要看别的记录。",
    [GU]: "我按站台电波钟记的七点三十五，核对了车站留存的洪水测绘纸。右边那枚蓝墨箭头是原件上的，警务所的副图与它同号。后来书店的展台换成了什么，我当时没见到。",
    [LIN]: "七点二十五沈映到前台要了一张描图纸和一支红铅笔，说要整理采访材料。七点二十后我一直在旅馆前台，没有去旧书店。",
    [SONG]: "我第三天早上在咖啡馆开门，没有给沈映送纸。旧书店那张地图是什么样，我是听江老师后来提起的。",
    [CHEN]: "我在邮局分拣退回件，描图纸没有经过邮局。若是寄来的修复材料，邮局会留下尺寸和封套登记。",
    [ZHOU]: "我只送普通件，没去旧书店。旧地图档案的借阅名字应以警务所登记为准。",
    [BAI]: "我第三天早上没有去书店，红铅笔路线不像花摊记货用的标记。沈记者有没有拿地图，我没有见到。",
    [CHENG]: "我在车站处理完木料后去了广场，没碰过书店展台。北向箭头这种东西，不能拿一把木工尺就猜出来。"
  },
  revisions: {
    [LIN]: { 7: "我是七点三十七到书店的，本想取回借给沈映的红铅笔。我看见她从右侧抽走透明片，又塞进一张纸。我说没离开过前台，是怕把借纸借笔也说成了我帮她换展品。" }
  },
  evidence: [
    { n: 1, at: "books", title: "缺失的北向覆片", text: "展台框槽没有撬痕，地图本体也没有破口。右侧抽拉槽内压着红线纸，左侧的展签仍写着『覆片：北箭头及旧门牌，许氏旧注』。原图上的蓝墨桥脚线没有被改动。", meaning: "动过的是可抽出的覆片，红线画在替换的纸上。", related: [SHEN, XU], search: "检查展台右侧的覆片卡槽" },
    { n: 2, at: "books", title: "修复桌的压纸顺序", text: "修复登记记着 07:06 用无色胶固定原图，覆片可从右侧抽出。新塞的描图纸折成两层，左缘缺一枚半月；纸上的红线只画了转弯，没抄覆片原有的路名与门牌。", meaning: "填回卡槽的是裁余描图纸；它保留路线，却遮去了把线路指向具体住户的信息。", related: [XU, SHEN], search: "核对修复桌上的压纸顺序" },
    { n: 3, at: "inn", title: "旅馆描图纸借用记录", text: "前台电波钟 07:25：林阿梨将一张裁余描图纸和一支红铅笔交给沈映。留在登记夹里的一小片弃纸凸出半月形，和红线纸左缘的缺口严丝合缝；当早只裁过这一张。", meaning: "展台替换件来自沈映领取的那张纸，缺口和弃纸比颜色更能识别来源。", related: [SHEN, LIN], search: "翻看前台的描图纸和借用记录" },
    { n: 4, at: "police", title: "旧地图档案借阅单", text: "值班室电波钟 07:15：沈映查阅 1963 年洪水测绘档案，副图编号 H-63。申请附言是『与书店覆片核对旧门牌；涉及住户，请不要先公开』。档案原件未外借。", meaning: "查档对象和保密请求显示，她要核对路线对应的居民。", related: [SHEN, LU], search: "查看值班桌上的旧地图借阅单" },
    { n: 5, at: "station", title: "旧测绘纸的蓝墨箭头", text: "值班柜台留存的正本同样编号 H-63，北箭头是蓝墨三角。红线纸上的两处直角与仓库旁一段后来封闭的便道吻合，那段便道没有画在展台的原图上。", meaning: "红线取自洪水测绘档案，可结合借阅记录辨认来路。", related: [GU, SHEN], search: "核对值班柜台的旧测绘纸" },
    { n: 6, at: "inn", title: "母亲旧话的折页", text: "前台封套写着『沈映留作查档说明』。里面的旧折页写：『洪水后，先找没有北面的路；找到了门，也别把姓写上报。』旁边画了两个转弯，和测绘纸的便道折角相同。", meaning: "她来确认母亲曾走过的路，也想遵守母亲留下的保密请求。", related: [SHEN], search: "翻看旅馆前台封套里的旧话折页" },
    { n: 7, at: "books", title: "清晨访客副联", text: "修复桌夹着清晨访客副联。柜台电波钟一栏记着 07:37，来访人签『林阿梨，收回借物』。她在离店栏添了『红笔未收，见记者动右框』，没有把整张副联报给警务所。", meaning: "访客签名证明林阿梨到过展台，可以问她究竟看见了什么。", related: [LIN, SHEN], contradicts: [LIN], search: "翻看修复桌上的清晨访客副联" },
    { n: 8, at: "police", title: "北向标记比对记录", text: "值班室电波钟 07:55，陆行舟收下许知微抄来的现场记录。记录附 07:45 江芷的还书签收，注明借书人入门前展台已无覆片。韩朔在旁注：红线是街巷路径，不是钟楼校向记号。", meaning: "江芷首次到店时覆片已经不见，红线也与韩朔的校时工作无关。", related: [LU, HAN, JIANG, XU], search: "核对值班桌上的北向标记比对记录" }
  ],
  history: [
    { key: "archive-request", time: "07:15", at: "police", type: "conflict", actors: [SHEN, LU], summary: "沈映在警务所查阅 1963 年洪水测绘档案，向陆行舟说明要核对母亲旧话中的北向路线。", tags: ["motive"], clue: 4 },
    { key: "borrow-tracing", time: "07:25", at: "inn", type: "obtain_item", actors: [SHEN, LIN], summary: "林阿梨裁去描图纸破损的边角，把成张裁余纸和红铅笔交给沈映，夹存裁下的小片。", clue: 3 },
    { key: "read-mother-note", time: "07:27", at: "inn", type: "obtain_item", actors: [SHEN], summary: "沈映翻看母亲遗下的折页，在裁余纸上画下测绘档案中的便道弯折，再把折页留给前台备查。", clue: 6 },
    { key: "survey-match", time: "07:35", at: "station", type: "forensic_clue", actors: [GU], summary: "顾远山按站台电波钟核对车站保存的 H-63 正本，记下蓝墨北箭头与洪水便道。", clue: 5 },
    { key: "witness-entry", time: "07:37", at: "books", type: "witness", actors: [LIN, SHEN], summary: "林阿梨去书店取红铅笔，在来访副联上签了名字，留在展台附近。", clue: 7, publicVersion: "林阿梨称七点二十后一直在旅馆前台。", contradictedBy: [7] },
    { key: "remove-overlay", time: "07:38", at: "books", type: "obtain_item", actors: [SHEN], summary: "沈映从展台右侧卡槽抽出透明北向覆片，收进采访文件夹。", tags: ["means", "opportunity"], clue: 1 },
    { key: "stage-tracing", time: "07:39", at: "books", type: "obtain_item", actors: [SHEN], summary: "沈映把红铅笔描图压进框槽下方，留下故意缺失北箭头的路线。", tags: ["means", "staging"], clue: 2 },
    { key: "witness-note", time: "07:40", at: "books", type: "forensic_clue", actors: [LIN], summary: "林阿梨见沈映抽走覆片、塞进描图，在访客副联末尾补了一句，随后离店。", clue: 7 },
    { key: "discover", time: "07:45", at: "books", type: "incident", actors: [XU, JIANG], summary: "江芷到书店归还课程册，许知微重新查看展台时发现北向覆片已经不见。", tags: ["nonfatal_incident"] },
    { key: "police-reconcile", time: "07:55", at: "police", type: "forensic_clue", actors: [LU, HAN, XU], summary: "许知微送来现场记录和江芷的签收时间，韩朔备注红线并非钟楼校向记号。", clue: 8 }
  ],
  scenes: ["books", "inn", "police", "station", "cafe", "post"],
  relationships: [
    { from: SHEN, to: XU, label: "采访旧地图与祖父的覆片" },
    { from: SHEN, to: LIN, label: "描图纸借用与前台登记" },
    { from: SHEN, to: LU, label: "母亲旧话与洪水档案" }
  ],
  exclusions: [
    { characterId: XU, reason: "许知微祖父的落款的确在覆片上；替换纸的缺口却与林阿梨交给沈映的那张吻合。林阿梨见到换片的人也不是许知微。", clues: [2, 3, 7] },
    { characterId: HAN, reason: "韩朔只确认红线不是钟表校向符号，校时工具和地图描图材料没有交集。", clues: [5, 8] },
    { characterId: JIANG, reason: "还书签收与现场记录都记在 07:45，江芷首次到展台前覆片就已不见。", clues: [1, 8] }
  ],
  reasoning: [
    { id: "rb10-overlay", conclusion: "展台没有撬痕，说明被取走的是可拆覆片；红铅笔压痕与许知微的无色修复材料不符。", clues: [1, 2] },
    { id: "rb10-motive", conclusion: "洪水档案借阅单和母亲旧话折页说明沈映在找一条未署名的旧路线，动机是核实来源并保护可能被牵连的人。", clues: [4, 6] },
    { id: "rb10-means", conclusion: "旅馆留存的弃纸与替换纸吻合，红线又只包括 H-63 正本所画的便道，材料和路线都有独立来路。", clues: [3, 5] },
    { id: "rb10-opportunity", conclusion: "沈映 07:15 在警务所查档，07:25 在旅馆取纸，07:37 到书店，目击与取片窗口连续可走。", clues: [3, 4, 7] },
    { id: "rb10-reversal", conclusion: "林阿梨隐去的是自己到过展台的经过。她的目击与纸张缺口、档案编号互相印证，许家落款不能说明谁抽走了覆片。", clues: [1, 3, 5, 7] },
  ],
  redHerrings: ["许知微的祖父曾在原图上写过注记，最像为了遮掩家族关系而拆掉北向覆片。", "韩朔熟悉镇上的校向符号，红线看起来像钟楼校时留下的标记。", "江芷承认看见透明碎屑，却是在覆片被取走后才到书店。"],
  decisive: [1, 3, 4, 5, 6, 7, 8],
  answer: { motive: [4, 6], method: [3, 5] },
  sources: { motive: 4, means: 1, opportunity: 1, staging: 2, trace: 3, groupAlibi: 5 },
  events: { trigger: "discover", motive: "archive-request", means: ["remove-overlay", "stage-tracing"], opportunity: "remove-overlay", staging: "stage-tracing", trace: "borrow-tracing", groupAlibi: "survey-match", scene: "books", prep: "books" },
  ending: [
    "沈映交回了采访夹里的透明覆片，旧书店先收存原件，再公开一份遮住门牌的副图。红线纸也留下了，还在原来的卡槽旁，只是不再冒充修复师做的展签。",
    "许知微讲了祖父为何在洪水后补写门牌，林阿梨也补交了访客副联。那条路终于有了两家的说法；曾从那里避难的人仍可以决定，自己的名字要不要写进去。",
    "沈映承担取走覆片和私画路线的责任，继续写报道，但必须把查档、借纸和改动展品的每一步写进交接单。她终于知道，保护一个人的方法不能靠让另一个人背上嫌疑。"
  ]
};
