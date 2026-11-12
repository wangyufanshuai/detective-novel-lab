import type { CasePack } from "../case-pack";

/** PRIVATE authored case 1. The opening happened before the playable 08:00
 * clock; it is not an emergent agent-generated crime. Never import in a client. */
const XU = "rb-xu-zhiwei", SONG = "rb-song-tang", ZHOU = "rb-zhou-yan";
const HAN = "rb-han-shuo", SHEN = "rb-shen-ying";

export const SEVENTH_MINUTE: CasePack = {
  revision: "riverbend-seventh-minute.v1",
  key: "seventh-minute",
  ordinal: "第一宗",
  title: "第七分钟",
  theme: "被谁保管的历史",
  premise: "旧书店的旧桥测绘原图在揭幕前被换成描图纸。一只长纸筒、一座不准的钟，让小镇首先怀疑了邮差。",
  publicCaseFile: "原图属于镇档案室，今天十四点原定在旧书店公开。接触展台的预约名单上有许知微、周砚、韩朔和沈映；其余来客隔着柜台。请走访六处地点，核对原图最后出现和替代品被发现的时间。所有钟表记录都需要说明来源。",
  question: "谁移走了原图",
  verdict: "{person}移走了原图",
  commission: { hook: "旧桥原图不见了", detail: "揭幕前，旧书店的原图被换成了描图纸。去书店或警务所领取调查手记，沿着六处地点查下去。", openAt: ["books", "police"], refusal: "请先到旧书店或警务所，领取原图失踪的调查手记。" },
  window: { from: "07:00", to: "08:00" },
  ids: { clue: "rb-clue", search: "rb-search" },
  historyTag: "riverbend-authored-history",
  historyNote: "河湾旧桥展品的案前记录。",
  timelineSource: "原创锁定案前事实 v1",
  culpritId: XU,
  witnessId: SONG,
  suspectIds: [XU, ZHOU, HAN, SHEN],
  culprit: { motive: "拖延原图公开，避免祖父删去西岸住户的批注在缺少说明时曝光。", means: "修复糊揭封、描图替换、R17 修复纸筒携走原图。", opportunity: "07:30 江芷离开后至 07:35 宋棠发现替代品之间。" },
  others: { motive: "与展览有接触或意见分歧，尚需核对。", means: "列在展台接触登记中的预约者。", opportunity: "早晨的实际行踪需要核对。" },
  statements: {
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
  },
  revisions: {
    [SONG]: { 4: "是我把钟面当成标准时间了。慢七分钟，要加回去：看见周砚是 07:18，送咖啡发现描图是 07:35。我能修正这两个时间，不能补上后巷里没看见的人。" },
    [XU]: { 7: "……我去过车站。说整早没离开，是我撒了谎。原图没有被毁，我只是想让揭幕晚一天。你还要核对怎样取出、什么时候取出的，不能把我的这句话当作所有问题的答案。" }
  },
  evidence: [
    { n: 1, at: "books", title: "断开的蓝封条", text: "展台封条从背面用湿淀粉糊揭起，重新贴合处留下修复用的纤维。许知微的修复纸包编号 R17，外包缺了一块三角纸角。入店登记写明只有四名预约访客能接触展台，其他人由柜台隔开。", meaning: "封条能由修复工具无声揭开；需要与车站纸筒的断口一起证明使用者。", related: [XU], search: "检查展台的封条" },
    { n: 2, at: "books", title: "没有寄出的延期信", text: "许知微署名的信写着：『请把揭幕推迟一天。我还没找到祖父为何删去西岸住户的说明。把那条批注印出去，大家只会记得他划过谁的家。』展品委托书要求原图今天十四点公开。", meaning: "她想夺回公开历史的时间控制；这解释动机，不能单独证明盗取。", related: [XU, SHEN], search: "整理修复桌上的信件" },
    { n: 3, at: "cafe", title: "早餐便笺上的两次钟面", text: "宋棠随手记着『钟楼 07:11，邮差出门』『钟楼 07:28，送咖啡时只剩描图』。两行都注明看的是钟楼；她未给手表对时。咖啡交接单由书店与咖啡馆各留一份。", meaning: "目击时间共用慢七分钟的钟；实际为 07:18 与 07:35。", related: [SONG, ZHOU], search: "查看早餐便笺" },
    { n: 4, at: "police", title: "钟楼校时便笺", text: "电波校时器与车站、邮局标准钟一致。韩朔写明『07:10 检测：钟楼慢 7 分；07:45 调准』。陆行舟全程在检修层复核，两人签字。此间他们没有离开，书店不在检修层出口旁。", meaning: "纠正宋棠的两次目击时间，也排除检修期间的韩朔。", related: [HAN, "rb-lu-xingzhou", SONG], contradicts: [SONG], search: "核对钟楼检修记录" },
    { n: 5, at: "post", title: "连续的挂号清点页", text: "邮局电波钟记时 07:28—07:40，陈蕙与周砚交替逐件签了十二个编号，无离岗交接。随件清单和陈蕙验收栏说明：长筒装的是空白海报纸，数量齐全。", meaning: "周砚在原图仍在展台之后一直位于邮局，纸筒是误导。", related: [ZHOU, "rb-chen-hui"], search: "核对挂号清点记录" },
    { n: 6, at: "inn", title: "前台双人核页记录", text: "林阿梨与沈映从 07:20 到 07:50 互报旧客簿页码，逐页写下同一处错号。前台电波钟记时，期间无休息或交接。沈映的书店摄影预约旁盖着『未到』。", meaning: "预约只是计划；连续的双人工作记录排除沈映。", related: [SHEN, "rb-lin-ali"], search: "查看前台核页记录" },
    { n: 7, at: "station", title: "寄存柜里的原图", text: "顾远山与你共同开柜：原图的双水印、蓝桥脚线和档案章都在。纸筒包纸标为 R17，撕口与书店纸包缺角吻合。07:42 的存根由许知微当面签字，顾远山与她交谈过，不是凭衣服认人。原图由站员重新封存，等待警方接收；你带走的是共同清点的收据。", meaning: "原图和特定修复纸的连续保管链，把揭封、携走与寄存连起来，否定许知微未离店的说法。", related: [XU, "rb-gu-yuanshan"], contradicts: [XU], search: "与站员共同核对寄存物", needsPresent: "rb-gu-yuanshan" },
    { n: 8, at: "books", title: "展品交接页", text: "江芷按刚校准的手表写下『07:30 离店，原图双水印仍在』。宋棠写下『送咖啡时钟楼 07:28，已是描图』。后巷可通咖啡馆再到车站，全程十分钟。07:30 之后柜台没有接待其他预约访客。", meaning: "盗取窗口是 07:30—07:35；07:32 离店的人足以在 07:42 到车站。", related: [XU, "rb-jiang-zhi", SONG], search: "阅读展品交接页" }
  ],
  history: [
    { key: "delay", time: "07:05", at: "books", type: "conflict", actors: [XU], summary: "许知微读到拒绝延期的答复，把未寄出的延期信留在修复桌上。", tags: ["motive"], clue: 2 },
    { key: "repair", time: "07:10", at: "police", type: "alibi", actors: [HAN, "rb-lu-xingzhou"], summary: "韩朔与陆行舟进入检修层，记录钟楼慢七分钟；两人到 07:45 才离开。", tags: ["clock", "alibi"], clue: 4 },
    { key: "inn", time: "07:20", at: "inn", type: "alibi", actors: [SHEN, "rb-lin-ali"], summary: "沈映与林阿梨开始连续核页，直到 07:50，期间无人离开。", tags: ["alibi"], clue: 6 },
    { key: "courier", time: "07:18", at: "cafe", type: "witness", actors: [SONG], summary: "宋棠从咖啡馆门口看见周砚离开书店，钟楼显示 07:11。", clue: 3, publicVersion: "宋棠按钟楼记为 07:11。", contradictedBy: [4] },
    { key: "courier-depart", time: "07:18", at: "books", type: "move", actors: [ZHOU], summary: "周砚离开书店，经过警务所去邮局。" },
    { key: "courier-via", time: "07:23", at: "police", type: "move", actors: [ZHOU], summary: "周砚经过警务所外道路。" },
    { key: "mail", time: "07:28", at: "post", type: "alibi", actors: [ZHOU, "rb-chen-hui"], summary: "周砚与陈蕙开始逐件清点，至 07:40 未离岗。海报纸在两人面前验收。", tags: ["alibi"], clue: 5 },
    { key: "last-original", time: "07:30", at: "books", type: "witness", actors: [XU, "rb-jiang-zhi"], summary: "江芷离店时看见原图。许知微独自在修复桌与展台之间，柜台未再接待预约访客。", tags: ["opportunity"], clue: 8 },
    { key: "seal", time: "07:31", at: "books", type: "obtain_item", actors: [XU], summary: "许知微用修复糊揭起封条，以描图替换原图，把原图装进 R17 修复纸包裹的纸筒。", tags: ["means", "staging"], clue: 1 },
    { key: "leave", time: "07:32", at: "books", type: "move", actors: [XU], summary: "许知微由后巷离开，沿咖啡馆前道路走向车站。" },
    { key: "copy-found", time: "07:35", at: "books", type: "incident", actors: [SONG], summary: "宋棠送到咖啡，发现展台只剩描图纸，钟楼显示 07:28。", tags: ["nonfatal_incident"] },
    { key: "via-cafe", time: "07:37", at: "cafe", type: "move", actors: [XU], summary: "许知微经过咖啡馆外道路，继续去车站。" },
    { key: "deposit", time: "07:42", at: "station", type: "forensic_clue", actors: [XU, "rb-gu-yuanshan"], summary: "许知微当面签字寄存原图；顾远山锁柜，保留存根。", tags: ["trace", "means"], clue: 7, publicVersion: "许知微称整个早晨未离开书店。", contradictedBy: [7] },
    { key: "depart-station", time: "07:47", at: "station", type: "move", actors: [XU], summary: "许知微离开车站，原路返回书店。" },
    { key: "return-cafe", time: "07:52", at: "cafe", type: "move", actors: [XU], summary: "许知微回程经过咖啡馆外道路。" },
    { key: "return-books", time: "07:57", at: "books", type: "move", actors: [XU], summary: "许知微回到书店。" },
    { key: "notice", time: "08:00", at: "police", type: "conversation", actors: ["rb-lu-xingzhou"], summary: "警务所张贴旧桥原图失踪的受理通知。" }
  ],
  scenes: ["books", "cafe", "police", "post", "inn", "station"],
  relationships: [{ from: XU, to: SHEN, label: "为旧地图报道有过争执" }, { from: ZHOU, to: "rb-chen-hui", label: "一起清点邮件" }, { from: HAN, to: "rb-lu-xingzhou", label: "一起校准钟楼" }],
  exclusions: [
    { characterId: ZHOU, reason: "07:30—07:35 盗取窗口内，周砚在邮局连续清点。", clues: [5, 8, 4] },
    { characterId: HAN, reason: "07:10—07:45 与陆行舟在检修层，覆盖盗取窗口。", clues: [4, 8] },
    { characterId: SHEN, reason: "07:20—07:50 在旅馆连续双人核页，预约并非实际到店。", clues: [6, 8] }
  ],
  reasoning: [
    { id: "rb-motive", conclusion: "延期信解释她为何想阻止今天公开。", clues: [2] },
    { id: "rb-means", conclusion: "揭封痕迹与原图寄存筒的 R17 撕口连接修复桌和车站。", clues: [1, 7] },
    { id: "rb-opportunity", conclusion: "两份交接记录将替换限制在 07:30—07:35。", clues: [8] },
    { id: "rb-clock", conclusion: "慢七分钟使 07:11 和 07:28 变为 07:18 与 07:35。", clues: [3, 4] },
    { id: "rb-exclusion", conclusion: "邮局、旅馆与检修层的连续记录排除其余三人。", clues: [4, 5, 6, 8] }
  ],
  redHerrings: ["周砚携带的长筒装着空白海报纸。", "韩朔的校时遗漏造成误会，不能由此推定盗取。", "沈映预约拍图，却并未到店。"],
  decisive: [1, 2, 3, 7, 8],
  answer: { motive: [2], method: [1, 7] },
  sources: { motive: 2, means: 1, opportunity: 8, staging: 1, trace: 7, groupAlibi: 5 },
  events: { trigger: "copy-found", motive: "delay", means: ["seal", "deposit"], opportunity: "last-original", staging: "seal", trace: "deposit", groupAlibi: "mail", scene: "books", prep: "books" },
  ending: [
    "原图回到镇档案室的保管箱。原定十四点的揭幕暂缓；再次公开时，旁边多了一张说明：当年的地图还留着未被解释的空白，批注应与居民的口述一起阅读。",
    "宋棠在早餐便笺上划掉两个钟面时间，添了“慢七分钟”四个字。周砚照旧送信，韩朔补齐了校时登记。误会没有使他们成为另一个案件的罪人。",
    "许知微承认揭封、替换与寄存。她把祖父的旧信交给档案室，并为擅自移走公有原图承担后续责任。沈映答应把原文和争议都写进去；谁也没有答应替历史删掉难看的那一页。"
  ]
};
