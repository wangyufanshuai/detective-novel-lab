import type { CasePack } from "../case-pack";

/** PRIVATE authored case 3. All events precede the other two cases on day 1.
 * A torn shared record, a promise of privacy, and an innocent private errand.
 * Never import this pack in a client. */
const GU = "rb-gu-yuanshan", ZHOU = "rb-zhou-yan", SHEN = "rb-shen-ying", BAI = "rb-bai-lu";
const CHENG = "rb-cheng-du", LU = "rb-lu-xingzhou", SONG = "rb-song-tang", LIN = "rb-lin-ali";

export const MISSING_FAREWELL_PAGE: CasePack = {
  revision: "riverbend-missing-farewell-page.v1",
  key: "missing-farewell-page",
  ordinal: "第三宗",
  title: "撕下的那一页",
  theme: "记住一个人，是否就有权公开他的去向",
  premise: "车站保管的离镇留言册缺了第十七页，今天重印用的展示夹里只剩一道纸茬。缺页前来过的邮差不肯说明清晨的去向，记者的借阅预约上又恰好圈着这一页。",
  publicCaseFile: "留言册由历年旅客共同写成，镇档案室委托车站保管，原定今天中午送印。交接清单列着顾远山、周砚、白露和沈映。请核对书页最后完整的时间、展示夹的接触记录，以及每个人实际到过的地方。预约和来信都只能说明意图。",
  question: "谁取走了留言册第十七页",
  verdict: "{person}取走了留言册第十七页",
  commission: { hook: "车站留言册少了一页", detail: "准备重印的离镇留言册缺了第十七页，纸茬还留在展示夹里。去车站或警务所领取调查手记，先核对交接时的原件。", openAt: ["station", "police"], refusal: "请先到河湾车站或警务所，领取留言册缺页的调查手记。" },
  after: "borrowed-chisel",
  window: { from: "05:00", to: "05:59" },
  ids: { clue: "rb3-clue", search: "rb3-search" },
  historyTag: "riverbend-authored-history",
  historyNote: "河湾车站留言册缺页的案前记录。",
  timelineSource: "原创锁定案前事实 v1",
  culpritId: GU,
  witnessId: ZHOU,
  suspectIds: [GU, ZHOU, SHEN, BAI],
  culprit: { motive: "不愿让留言册重印公开一位旧旅客的去向，也怕自己当年未把保密请求转交档案室的疏忽被发现。", means: "沿展示夹边缘撕下第十七页，折进自己记录离镇旅客的作废时刻册，再把展示夹扣回。", opportunity: "05:16 程渡验过完整书页离开后，到 05:26 返回发现缺页之间，独自在站内值班。" },
  others: { motive: "与留言册的交接或重印有往来，尚需核对。", means: "登记在展示夹接触清单上的人。", opportunity: "清晨的实际行踪需要核对。" },
  statements: {
    [SONG]: "白露五点十八分进来买热豆浆，坐到五点半才走。我按收银机打印的时间记，不看钟楼。她带着空花篮，说刚在车站换过花；我只见到她进店后的事，没看过那本留言册。",
    [ZHOU]: "我五点多沿警务所外面去了邮局，没有进去停留。车站那只投递袋我五点整就交走了，里面没有散页。我帮人送私人信件，不方便把信里的话当作街谈；但信件内容和留言册不是一回事。",
    "rb-xu-zhiwei": "这本留言册不是我的修复项目，我没去过车站看原件。纸页如果沿夹边撕开，边上会留下纸茬；至于什么时候撕的、是谁拿走的，单靠这种常见痕迹我不能替你下判断。",
    [LU]: "五点十六到二十六，周砚在警务所门廊的公用桌旁写字，我替他压着会卷起来的复写纸，没有中途走开。我用值班电波钟记了起止时间，具体写给谁，应由他自己决定要不要告诉你。",
    "rb-chen-hui": "五点四十一分周砚把一封私人回信交进邮局，我按柜台电波钟在收件联上记了时间。那是封好的普通信，我没读内容，也不知道他之前在哪里写；车站的留言册我今天没有经手。",
    [GU]: "程渡来验过夹子，后来发现少页。我一直在车站值班，可他验完到回来之间，我没有再打开过展示夹。那本作废时刻册是我的私人笔记，记着从前离镇的人，别因为旧书多就认定里面藏了东西。",
    [BAI]: "五点零八分我给车站送了桌花，交接清单上签过名；那时展示夹还没扣好，我看见过第十七页。我随后去咖啡馆，没再回站。花篮放在柜边，不代表我碰过夹子里的每一张纸。",
    [LIN]: "沈映五点十二分开始和我核对旅馆旧照片背面的编号，到五点三十二分才停。我们一人报号一人翻页，前台电波钟记时；她的车站预约是之后能不能去的计划，不是已经去过的证明。",
    [CHENG]: "五点十六分我在站里试过展示夹的新扣子，亲眼看见第十七页和骑缝铅笔线都完整。离开去门外量告示架，五点二十六分回来交尺寸，书页就少了。我两次都看站台电波钟，中间看不见柜台。",
    [SHEN]: "我预约拍第十七页，是因为那页记录过旧桥通车后的送别，不是为了拿走它。五点多我还在旅馆跟林老板对照片编号，没有赴约；我没见过今早的原件，也不知道那页写着谁如今的地址。",
    "rb-han-shuo": "留言册的事我没在场，不能拿钟楼给谁作证。车站和警务所都有电波钟，你应先认清每条记录用的哪一块钟。我的钟楼检修在七点，不能用那次校时倒推出谁五点进过车站。",
    "rb-jiang-zhi": "天亮前我在家整理旧学生的信，没有出门看留言册。别人托人读信或抄信，有时只是眼睛不好，不愿让整条街都知道。谁撒了谎要核对，为什么不肯说也要听清，不能把两件事直接画等号。"
  },
  revisions: {
    [ZHOU]: { 7: "我确实在警务所停过。旧住户托我把回信誊成大字，我怕问来问去又问到收信人，才说只是路过。陆行舟替我压纸，从落笔到封信一直在旁边；我没去车站，也没见过被撕下的那页。" },
    [GU]: { 3: "那页是我折进去的。验完夹子以后，我又打开过它。我当年答应过那位旅客不公开去向，却没把请求转给档案室，今天才想用藏页补救。旧书是我的，留言册不是；不能拿自己的承诺替大家作决定。" }
  },
  evidence: [
    { n: 1, at: "station", title: "展示夹里的纸茬", text: "留言册第十七页沿夹边留下不规则纸茬，铅笔骑缝线断在右下角。程渡的验扣条记着：站台电波钟 05:16，书页与线均完整；05:26 返回，原页不见。前后两条均有他和顾远山的签名。", meaning: "缺页发生在 05:16—05:26，不能解释为原先就少了一页；断线可与寻回的原页核验。", related: [CHENG, GU], search: "检查展示夹的纸茬" },
    { n: 2, at: "station", title: "压在夹背的折纸条", text: "展示夹背压着一条作废时刻表纸，两个折角夹住刚脱落的纸屑。纸条页码是四十八，另一边有半个红色方框；柜台值班本列着顾远山自用的旧册编号 G04，注明第四十八页已剪作书签。", meaning: "用作折叠护条的是顾远山旧册中的纸，但纸条可被别人取用，需与原页所在的旧册合看。", related: [GU], search: "翻看展示夹背的折纸条" },
    { n: 3, at: "station", title: "旧时刻册中的折页", text: "顾远山在场翻开自用的 G04 作废时刻册，夹层里有折起的第十七页。撕口和展示夹纸茬吻合，骑缝铅笔线接得上；册内第四十八页的缺口与折纸条红框相合。双方把三处接缝记入清点联，原件重新封存。", meaning: "同一旧册的护条留在展示夹，原页藏在册内，构成从打开夹子到折页藏匿的连续物证；不是只凭旧书归属定罪。", related: [GU, CHENG], contradicts: [GU], search: "与站员共同清点旧时刻册", needsPresent: GU },
    { n: 4, at: "post", title: "保密请求的留底联", text: "邮局留底联上，一位旧旅客请顾远山不要公开留言册第十七页所写的去向。顾远山签收并回写『我会转交』，转交栏空白。今早送达的重印通知写着中午截稿；他的回条只有『能否不印此页』，尚未寄出。", meaning: "他有保护旅客隐私和掩盖未转交请求的双重动机；信件本身不证明他撕了书页。", related: [GU, ZHOU], search: "核对保密请求的留底联" },
    { n: 5, at: "cafe", title: "05:18 的豆浆小票", text: "收银机打印的小票记着 05:18，白露买热豆浆。宋棠在留底上补记：白露进门后坐到 05:30，花篮一直放在她脚边。门旁的步行导引标明，车站到咖啡馆沿最短的路也要五分钟。", meaning: "白露最晚 05:13 已离开车站，早于 05:16 书页仍完整的交接；窗口内她不可能往返。", related: [BAI, SONG], search: "查看收银机的豆浆小票" },
    { n: 6, at: "inn", title: "照片背面的双人核号页", text: "旅馆前台的核号页由林阿梨和沈映交替写了十六个编号，起止为电波钟 05:12—05:32。两人在页底注明全程一人报号、一人找图，没有交接或离开；附着的车站拍摄预约单盖着『未到』。", meaning: "连续双人工作覆盖整个缺页窗口，拍摄预约不能证明沈映到过车站。", related: [SHEN, LIN], search: "核对前台的照片编号页" },
    { n: 7, at: "police", title: "门廊桌上的复写底页", text: "复写底页留着周砚誊写回信的大字笔画和封口试压痕，私人称谓被纸套遮住。陆行舟签记：值班电波钟 05:16—05:26，全程为周砚压纸，无人离桌。门廊到车站的最短步行时间为十五分钟。", meaning: "周砚隐瞒的是代写私人回信；他在整个窗口都在警务所，无法到车站取页。", related: [ZHOU, LU], contradicts: [ZHOU], search: "查看门廊桌的复写底页" },
    { n: 8, at: "station", title: "展示夹交接清单", text: "清单列出可在柜台内开夹的四人：值班员顾远山、送交接袋的周砚、换桌花的白露和预约拍照的沈映；程渡只在验扣时由站员陪同。05:00 投递袋已交清，05:16—05:26 值班无交接，顾远山签名在岗。", meaning: "界定接触范围与顾远山独自保管的时段；结合另外三人的行踪，不能把机会泛指为所有居民。", related: [GU, ZHOU, BAI, SHEN, CHENG], search: "阅读柜台的展示夹交接清单" }
  ],
  history: [
    { key: "notice", time: "05:00", at: "station", type: "conflict", actors: [GU], summary: "顾远山读到中午截稿的重印通知，想起未转交的保密请求，写下不印第十七页的回条，未寄出。", tags: ["motive"], clue: 4 },
    { key: "mailbag", time: "05:00", at: "station", type: "conversation", actors: [ZHOU, GU], summary: "周砚交清投递袋，顾远山签收展示夹交接清单，并托他将保密请求留底和未封口的回条带回邮局待寄栏。", clue: 8 },
    { key: "flowers", time: "05:08", at: "station", type: "witness", actors: [BAI, GU], summary: "白露换桌花并签交接清单，看见展示夹中的第十七页；随后离站去咖啡馆。" },
    { key: "photos", time: "05:12", at: "inn", type: "alibi", actors: [SHEN, LIN], summary: "沈映与林阿梨开始连续核对旧照片编号，到 05:32 才结束，沈映没有赴车站预约。", tags: ["alibi"], clue: 6 },
    { key: "intact", time: "05:16", at: "station", type: "witness", actors: [CHENG, GU], summary: "程渡验好展示夹扣子，看见第十七页与骑缝线完整，和顾远山签字后去门外量告示架。", tags: ["opportunity"], clue: 1 },
    { key: "private-letter", time: "05:16", at: "police", type: "alibi", actors: [ZHOU, LU], summary: "周砚在警务所门廊誊写旧住户的私人回信，陆行舟全程压纸，到 05:26 封信才停。", tags: ["alibi"], clue: 7, publicVersion: "周砚称只是路过警务所，没有进去停留。", contradictedBy: [7] },
    { key: "coffee", time: "05:18", at: "cafe", type: "alibi", actors: [BAI, SONG], summary: "白露买豆浆后坐到 05:30，收银机打印 05:18 的小票。", tags: ["alibi"], clue: 5 },
    { key: "fold-strip", time: "05:19", at: "station", type: "obtain_item", actors: [GU], summary: "顾远山拿自己 G04 旧时刻册第四十八页剪成的书签做折纸护条，重新打开展示夹。", tags: ["means"], clue: 2 },
    { key: "remove-page", time: "05:20", at: "station", type: "obtain_item", actors: [GU], summary: "顾远山沿夹边撕下第十七页，折进 G04 旧册夹层，把展示夹扣回，折纸护条留在夹背。", tags: ["means", "staging"], clue: 1 },
    { key: "hide-page", time: "05:21", at: "station", type: "forensic_clue", actors: [GU], summary: "顾远山将夹有原页的 G04 旧册放回柜台抽屉，原页和护条的接缝均留存。", tags: ["trace"], clue: 3, publicVersion: "顾远山称验扣后到发现缺页前，自己没有再打开展示夹。", contradictedBy: [3] },
    { key: "found", time: "05:26", at: "station", type: "incident", actors: [CHENG, GU], summary: "程渡回来交告示架尺寸，发现第十七页不见，两人在验扣条上补签缺页的时间。", tags: ["nonfatal_incident"] },
    { key: "post-letter", time: "05:41", at: "post", type: "conversation", actors: [ZHOU, "rb-chen-hui"], summary: "周砚把誊好的私人回信交到邮局，陈蕙按柜台电波钟记下收件时间，没有拆阅内容。" },
    { key: "pending-reply", time: "05:42", at: "post", type: "conversation", actors: [ZHOU], summary: "周砚按顾远山的委托，把保密请求留底和未封口的回条放入待寄栏；回条未正式寄出。", clue: 4 },
    { key: "report", time: "05:45", at: "police", type: "conversation", actors: [CHENG, LU], summary: "程渡到警务所报留言册缺页，提交验扣条的副联。" }
  ],
  scenes: ["station", "post", "cafe", "inn", "police", "books"],
  relationships: [{ from: GU, to: ZHOU, label: "车站交接与私人信件" }, { from: SHEN, to: LIN, label: "共同核对旧照片" }, { from: CHENG, to: GU, label: "展示夹维修与验收" }],
  exclusions: [
    { characterId: ZHOU, reason: "05:16—05:26 与陆行舟在警务所连续誊信，整段覆盖缺页窗口；到车站单程还需十五分钟。", clues: [1, 7] },
    { characterId: SHEN, reason: "05:12—05:32 与林阿梨在旅馆连续核号，未赴车站预约。", clues: [1, 6] },
    { characterId: BAI, reason: "05:18 已进入咖啡馆，最晚 05:13 离站；05:16 书页仍完整，之后她也没有足够时间往返。", clues: [1, 5] }
  ],
  reasoning: [
    { id: "rb3-window", conclusion: "同一站台电波钟下的两次签收，将取页限制在 05:16—05:26。", clues: [1] },
    { id: "rb3-motive", conclusion: "签收却未转交的保密请求与中午截稿通知，解释顾远山为何急于藏页。", clues: [4] },
    { id: "rb3-means", conclusion: "夹背的护条来自 G04，原页也在 G04 中；撕口、骑缝线和红框把取页与藏页接成一条链。", clues: [1, 2, 3] },
    { id: "rb3-opportunity", conclusion: "交接清单限定接触者，窗口中顾远山独自保管展示夹。", clues: [1, 8] },
    { id: "rb3-private", conclusion: "周砚确实隐瞒了停留，复写底页却同时证明他没有取页的机会。", clues: [7] },
    { id: "rb3-exclusion", conclusion: "豆浆小票、双人核号页和誊信记录，分别排除白露、沈映与周砚。", clues: [1, 5, 6, 7] }
  ],
  redHerrings: ["沈映预约拍第十七页，预约单却没有到站签字。", "周砚谎称只路过警务所，隐瞒的是替旧住户誊写私人回信。", "白露签过接触清单，但书页在她离开后仍完整。"],
  decisive: [1, 2, 3, 4, 8],
  answer: { motive: [4], method: [1, 2, 3] },
  sources: { motive: 4, means: 2, opportunity: 8, staging: 1, trace: 3, groupAlibi: 7 },
  events: { trigger: "found", motive: "notice", means: ["fold-strip", "remove-page"], opportunity: "intact", staging: "remove-page", trace: "hide-page", groupAlibi: "private-letter", scene: "station", prep: "station" },
  ending: [
    "第十七页和留言册一起送回镇档案室，破口由修复师另行登记。重印暂缓，公开版本先遮去私人去向，逐一征求原留言人的意见。原件仍完整保存；愿意记住往事的人，也要给当事人留下选择怎样被记住的余地。",
    "周砚只向警务所说明了誊信的时间，没有交出信里的私人称谓。白露的小票和沈映的核号页也都随卷留存。陆行舟在记录里补上一句：隐瞒私事的说法需要改正，那件私事本身不因此成为别人的谈资。",
    "顾远山承认撕页和藏匿，承担修复费用，暂交留言册的保管工作。他补转了那封迟到的保密请求，也把自己的作废时刻册收回家。下次再有人要离开河湾，他仍会认真记住，只是会先问一句：这些话可以留下给谁看。"
  ]
};
