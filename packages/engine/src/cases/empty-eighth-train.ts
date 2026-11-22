import type { CasePack } from "../case-pack";

const SHEN = "rb-shen-ying", GU = "rb-gu-yuanshan", ZHOU = "rb-zhou-yan", XU = "rb-xu-zhiwei";
const LU = "rb-lu-xingzhou", LIN = "rb-lin-ali", CHEN = "rb-chen-hui", SONG = "rb-song-tang";
const JIANG = "rb-jiang-zhi", HAN = "rb-han-shuo", BAI = "rb-bai-lu", CHENG = "rb-cheng-du";

/** 第七宗。第 3 天清晨，假造的登车记录掩盖了真正被拿走的旧档案页。 */
export const EMPTY_EIGHTH_TRAIN: CasePack = {
  revision: "riverbend-empty-eighth-train.v1",
  key: "empty-eighth-train",
  ordinal: "第七宗",
  title: "空白的第八班车",
  theme: "保留真相不等于有权替别人安排离开",
  premise: "第三天清晨，车站的第八班车档案袋送到站台时只剩一张空白复写联，原本夹在里面的旧乘客页不见了。警务所公告却贴着一张‘已登车’的便条，镇上先怀疑顾远山替某人抹掉了离镇记录。",
  publicCaseFile: "顾远山 06:35 开档，06:50 前后有人接触档案袋；站台封条没有破损，但内页少了一张。旧书店 07:05 收到一本旧地图册，旅馆还留着一笔私人代读记录。请核对档案袋的开封顺序、空白复写联的来源，以及便条究竟想让谁相信已离镇。",
  question: "谁把不存在的登车记录写进第八班车档案",
  verdict: "{person}把不存在的登车记录写进第八班车档案",
  commission: { hook: "第八班车档案只剩一张空白联", detail: "车站档案袋少了一页旧乘客记录，警务所却收到一张写着‘已登车’的便条。第 3 天早晨到车站或警务所领取调查手记。", openAt: ["station", "police"], refusal: "请到河湾车站或警务所领取第八班车档案的调查手记。" },
  after: "silent-tower-bell",
  day: 3,
  window: { from: "06:20", to: "07:30" },
  ids: { clue: "rb7-clue", search: "rb7-search" },
  historyTag: "riverbend-authored-history",
  historyNote: "第 3 天第八班车档案袋与旧乘客页的案前记录。",
  timelineSource: "原创第 3 天档案调包案事实 v1",
  culpritId: SHEN,
  witnessId: XU,
  suspectIds: [SHEN, GU, XU, ZHOU],
  culprit: {
    motive: "她从旧乘客页上认出母亲年轻时的姓，担心镇上把一段没有寄出的告别说成逃离，想先私下确认这段记录。她没有权利把空白写成有人已经登车。",
    means: "她凭采访授权接触档案袋，抽走原始旧乘客页，用记者便笺在复写联上压出‘已登车’，再把原页夹进送往旧书店的旧地图册。",
    opportunity: "06:40 顾远山去站台核对第八班车前，她在车站档案桌前独自留下了足够的开封、改写和藏页时间。"
  },
  others: { motive: "与车站档案、旧乘客记录或沈映的采访有往来，尚需核对。", means: "可能接触过档案袋、复写联或旧地图册。", opportunity: "第 3 天清晨的实际行踪需要核对。" },
  statements: {
    [SHEN]: "我六点二十在旅馆拿了采访授权，之后只到车站问第八班车的公开时刻。档案袋有顾远山看着，我没有拿走旧乘客页，也没有把谁写成已经登车。旧地图册是许知微的工作，我不该碰。",
    [GU]: "我六点三十五按站台电波钟开档，封条和内页都在。六点四十我让沈记者看了采访授权，随后去站台核对班次。回来时档案袋只剩空白复写联，站台上没人能替我打开抽屉。",
    [ZHOU]: "我第三天清晨只送普通件，没有替沈映读过旧信，也没碰车站的档案袋。她问过我母亲旧话的意思，我没有替她解释。",
    [XU]: "七点零五我收到旧地图册，只按修复编号登记，没打开中间夹页。里面有没有别的纸，我当时没有看见，更不知道它和车站的档案有什么关系。",
    [LU]: "七点二十五沈记者把一张‘已登车’的便条交到警务所，说是车站要公开的更正。我看见上面没有站台印章，也没有乘客姓名，先把它夹进值班记录。",
    [LIN]: "六点二十二我给沈映的采访授权签了存根，她拿走自己的黑色记事本就离开了旅馆。她没有说要取什么档案，我只知道她急着核对一件旧事。",
    [CHEN]: "我第三天早上一直在邮局分拣退回件，车站的档案不经过我的分拣台。周砚若拿过特殊文件，归档联上应该有登记。",
    [SONG]: "六点五十分我在咖啡馆开门，江芷来得比平时早。沈映没有进来，也没有在这里打印什么便条。",
    [JIANG]: "我六点五十分在咖啡馆等宋棠开门，钟楼没响的事还没说完。沈映若从车站走来，至少要经过广场，我没有见到她。",
    [HAN]: "我从警务所去旧书店整理钟表目录，没接触车站档案。那张便条的时间写得像记者稿，不像车站交接联。",
    [BAI]: "我第三天早上还在河边整理花篮，没去车站。有人要离镇也该留下真实的车票，空白复写联不能证明谁坐过车。",
    [CHENG]: "我在广场准备木料，没进车站。档案袋若是从站台出去，封条和交接章都该留在顾远山手里。"
  },
  revisions: {
    [ZHOU]: { 6: "……我确实在旅馆替沈映读过那张旧信便签。她听见‘等本人来取’几个字后，一直在问旧乘客页。我没说，是怕别人把我的私下代读和她的采访混在一起。" },
    [XU]: { 4: "……我说没打开夹页，是因为不想卷进沈映的家事。修复登记时我看见夹页中间多出一张折过的旧纸，红线头和档案纸边相同；那页是她放进来的，不是我修复时添的。" }
  },
  evidence: [
    { n: 1, at: "station", title: "空白复写联与开过的档案袋", text: "第八班车档案袋的封条外层仍在，内层切口有重新压平的痕迹。袋里只剩一张空白复写联，纸面上有被硬笔压出的‘已登车’字痕，真正的旧乘客页不见了。", meaning: "这不是乘客带着原页登车，而是有人在档案袋内先取走原页，再利用复写联制造一条不存在的登车记录。", related: [GU, SHEN], search: "检查值班柜台上的第八班车档案袋" },
    { n: 2, at: "station", title: "档案开柜与访问登记", text: "顾远山 06:35 按站台电波钟开柜，06:40 的访问栏写着‘沈映，采访授权一份’，06:50 后才补了一笔‘待核对’。钥匙交接栏显示顾远山 06:40 离桌去站台。", meaning: "档案袋的真实开封窗口在 06:40—06:50，沈映有登记过的接触机会，顾远山却在关键几分钟离开了档案桌。", related: [GU, SHEN], search: "翻看值班柜台的档案访问登记" },
    { n: 3, at: "inn", title: "采访授权存根", text: "旅馆前台存根写着 06:22，授权对象是沈映，背面记着‘携黑色记者便笺一册’。林阿梨签字确认她拿走自己的记事本后离店。", meaning: "沈映在进入车站前已经准备好可压写复写联的记者便笺，物证把她的动机、工具和时间接上。", related: [SHEN, LIN], search: "查看旅馆前台的采访授权存根" },
    { n: 4, at: "books", title: "旧地图册修复收件单", text: "旧书店 07:05 的收件单记录，一本旧地图册的中间夹页比封面厚一张，折痕朝外，红线头露在页边。许知微在登记后才把它夹回修复桌。", meaning: "旧乘客页在 07:05 前已被藏进地图册，许知微只是收到并登记了它，不能解释车站 06:40—06:50 的开封。", related: [XU, SHEN], contradicts: [XU], search: "核对旧地图册修复收件单" },
    { n: 5, at: "books", title: "被藏起的旧乘客页", text: "地图册夹页里的旧纸写着二十年前一班离镇车次，乘客栏的姓氏与沈映母亲留下的旧信相同，页脚还有‘待本人确认’的铅笔批注。纸边缺口与车站档案袋里的空位吻合。", meaning: "旧页解释沈映为什么要隐瞒这件事，也证明她藏的是原始记录，而不是替谁办理了真实车票。", related: [SHEN, XU], search: "查看书架上地图册里的乘客页" },
    { n: 6, at: "inn", title: "私人代读便签", text: "旅馆授权存根背面夹着周砚的代读便签，时间写 06:20，内容只记了旧信中的‘等本人来取’。便签上的缩写与周砚投递簿相同，他没有把它登记进邮局公事。", meaning: "周砚确实替沈映读过旧信，解释她为何知道旧乘客页可能与母亲有关；他的隐瞒是私下代读，不是偷走档案。", related: [ZHOU, SHEN], contradicts: [ZHOU], search: "翻看前台授权存根里的代读便签" },
    { n: 7, at: "station", title: "假便条的压痕与纸张", text: "‘已登车’便条没有车站章，背面压痕与采访授权存根上记录的黑色记者便笺相同。便条用语把‘旧乘客页’改写成了一个不存在姓名的乘客。", meaning: "便条是为掩盖取页而写的假记录，压痕和纸张把它连接到沈映的记者便笺，不能证明真的有人搭车。", related: [SHEN, GU], search: "比对发车钟旁的已登车便条" },
    { n: 8, at: "police", title: "警务所收件登记", text: "陆行舟 07:15 的收件登记写明便条由沈映亲手交来，来源栏却没有车站交接章和乘客姓名。她说‘先按公开记录挂上去’，没有带来任何车票或行李联。", meaning: "沈映把假便条主动送进警务所，是为了让镇上先接受‘有人已经离开’的解释；顾远山没有把它作为正式交接记录。", related: [LU, SHEN], search: "核对值班桌上的便条收件登记" }
  ],
  history: [
    { key: "read-letter", time: "06:20", at: "inn", type: "conversation", actors: [ZHOU, SHEN], summary: "周砚在旅馆替沈映读旧信便签，沈映听见‘等本人来取’后追问二十年前的离镇记录。", clue: 6, publicVersion: "周砚称自己没有替沈映读过旧信。", contradictedBy: [6] },
    { key: "authorization", time: "06:22", at: "inn", type: "obtain_item", actors: [SHEN, LIN], summary: "林阿梨给沈映签出采访授权，记下她带走黑色记者便笺。", clue: 3 },
    { key: "drawer-open", time: "06:35", at: "station", type: "conversation", actors: [GU], summary: "顾远山按站台电波钟打开第八班车档案柜，封条和旧乘客页都在。", clue: 2 },
    { key: "access", time: "06:40", at: "station", type: "conversation", actors: [SHEN, GU], summary: "沈映用采访授权登记查阅档案，顾远山离开档案桌去站台核对班次。", tags: ["opportunity"], clue: 2 },
    { key: "packet-open", time: "06:45", at: "station", type: "obtain_item", actors: [SHEN], summary: "沈映在档案桌前割开内层封条，抽走旧乘客页，留下空白复写联。", tags: ["means"], clue: 1 },
    { key: "false-entry", time: "06:50", at: "station", type: "conflict", actors: [SHEN], summary: "沈映用记者便笺压出‘已登车’字痕，把没有姓名的假便条夹进站台公告。", tags: ["means", "staging"], clue: 7 },
    { key: "map-drop", time: "07:05", at: "books", type: "obtain_item", actors: [SHEN, XU], summary: "沈映把旧乘客页夹进送到旧书店的地图册，许知微收件时看见夹页变厚。", clue: 4, publicVersion: "许知微称自己没有打开地图册中间夹页。", contradictedBy: [4] },
    { key: "archive-page", time: "07:06", at: "books", type: "forensic_clue", actors: [SHEN, XU], summary: "许知微登记地图册红线头与旧纸缺口，沈映没有带走夹页。", clue: 5 },
    { key: "police-note", time: "07:15", at: "police", type: "conversation", actors: [SHEN, LU], summary: "沈映把没有车站章的‘已登车’便条交给陆行舟，要求先按公开记录张贴。", clue: 8 },
    { key: "discover", time: "07:30", at: "station", type: "incident", actors: [GU, LU], summary: "顾远山和陆行舟回到车站复核档案袋，发现旧乘客页失踪，空白复写联却留下了假登车压痕。", tags: ["nonfatal_incident"], clue: 1 }
  ],
  scenes: ["station", "police", "books", "inn", "post", "cafe"],
  relationships: [
    { from: SHEN, to: GU, label: "采访授权与车站档案访问" },
    { from: SHEN, to: XU, label: "旧乘客页与地图册夹页" },
    { from: SHEN, to: ZHOU, label: "私人代读与母亲旧信" }
  ],
  exclusions: [
    { characterId: GU, reason: "顾远山 06:35 开柜后在访问登记留下沈映的授权，06:40 离桌去站台。假便条没有车站章，档案袋的空白复写联也不是他填写。", clues: [1, 2, 7] },
    { characterId: ZHOU, reason: "周砚隐瞒了私人代读，但便签只解释沈映的动机；他没有车站访问登记，档案袋的开封窗口由沈映的授权和记者便笺锁定。", clues: [2, 6, 7] },
    { characterId: XU, reason: "许知微 07:05 才收到已经变厚的地图册，登记记录保留了红线头和旧纸缺口，她没有机会在车站 06:40—06:50 取页。", clues: [2, 4, 5] }
  ],
  reasoning: [
    { id: "rb7-fake-departure", conclusion: "空白复写联、旧纸缺口和无车站章的便条共同证明‘已登车’是伪造的离开记录。", clues: [1, 5, 7] },
    { id: "rb7-motive", conclusion: "旅馆授权、私人代读便签和旧乘客页把沈映的家事动机连成一条可核对的链。", clues: [3, 5, 6] },
    { id: "rb7-window", conclusion: "06:35 开柜、06:40 访问登记和 07:05 地图册收件把取页窗口限制在沈映离开档案桌之后。", clues: [2, 4] },
    { id: "rb7-means", conclusion: "档案袋内层切口、记者便笺压痕和地图册夹页说明同一人完成取页、改写和藏页。", clues: [1, 4, 7] },
    { id: "rb7-exclusion", conclusion: "顾远山的站台登记、周砚的私人代读和许知微的收件时间分别排除三名看似有机会的人。", clues: [2, 4, 6, 7] }
  ],
  redHerrings: [
    "顾远山掌握车站档案钥匙，却在关键窗口留下了离桌和站台记录。",
    "周砚确实隐瞒了替沈映读旧信的私事，容易被误认为他也参与了取页。",
    "许知微接触到藏在地图册里的旧乘客页，却是在页面已经离开车站之后才收到它。"
  ],
  decisive: [1, 2, 3, 4, 5, 6, 7, 8],
  answer: { motive: [3, 5, 6], method: [1, 4, 7] },
  sources: { motive: 5, means: 1, opportunity: 2, staging: 7, trace: 4, groupAlibi: 2 },
  events: { trigger: "discover", motive: "read-letter", means: ["packet-open", "false-entry"], opportunity: "access", staging: "false-entry", trace: "map-drop", groupAlibi: "drawer-open", scene: "station", prep: "station" },
  ending: [
    "旧乘客页回到车站档案袋，警务所撤下没有车站章的‘已登车’便条。档案上补注了‘待本人确认’，没有再把空白解释成某个人已经离开。",
    "周砚承认替沈映读过旧信，许知微把地图册夹页的登记交给车站。沈映终于确认母亲留下的姓氏只是一个需要本人说明的旧记录，镇上没有替她编出一个结论。",
    "沈映承认取走旧页和伪造便条，接受记者身份不能替代档案授权的处理。车站把访问、取件和登车分成三栏，任何人都不能再用一张空白复写联替别人安排去向。"
  ]
};
