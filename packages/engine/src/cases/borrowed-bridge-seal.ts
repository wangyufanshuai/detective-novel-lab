import type { CasePack } from "../case-pack";

const CHENG = "rb-cheng-du", BAI = "rb-bai-lu", GU = "rb-gu-yuanshan", HAN = "rb-han-shuo";
const LU = "rb-lu-xingzhou", SHEN = "rb-shen-ying", XU = "rb-xu-zhiwei", SONG = "rb-song-tang";
const CHEN = "rb-chen-hui", ZHOU = "rb-zhou-yan", LIN = "rb-lin-ali", JIANG = "rb-jiang-zhi";

/** 第八宗。看似伪造的验收牌，实际是未经授权的安全警告。 */
export const BORROWED_BRIDGE_SEAL: CasePack = {
  revision: "riverbend-borrowed-bridge-seal.v1",
  key: "borrowed-bridge-seal",
  ordinal: "第八宗",
  title: "借来的桥牌",
  theme: "阻止危险也要留下真实签名",
  premise: "第三天清晨，车站木料箱里的放行签被剪掉，换成一块没有编号的木牌。有一车补料因此停在站台。有人说是木工程渡想把合格木料扣下，给自己的私修争取补料。",
  publicCaseFile: "顾远山按站台电波钟在 06:35 开箱，签上仍写着放行；07:15 复核时，箱盖内侧只剩剪开的线和一块「待复检」木牌。请核对同一号木料的验收章、工具箱和桥修工单。",
  question: "谁把没有编号的桥牌放进木料箱",
  verdict: "{person}把没有编号的桥牌放进木料箱",
  commission: { hook: "木料箱里多了一块借来的桥牌", detail: "车站收到的桥修木料带着一块没有官方编号的‘待复检’木牌，镇上先怀疑程渡私刻验收标记。第 3 天早晨到车站或警务所领取调查手记。", openAt: ["station", "police"], refusal: "请到河湾车站或警务所领取桥修木料的调查手记。" },
  after: "empty-eighth-train",
  day: 3,
  window: { from: "06:25", to: "07:15" },
  ids: { clue: "rb8-clue", search: "rb8-search" },
  historyTag: "riverbend-authored-history",
  historyNote: "第 3 天桥修木料箱与验收牌的案前记录。",
  timelineSource: "原创第 3 天桥牌调包案事实 v1",
  culpritId: CHENG,
  witnessId: BAI,
  suspectIds: [CHENG, BAI, GU, HAN],
  culprit: {
    motive: "他在桥下发现一根承重梁有细裂缝，知道按工单送检会立刻停工，也会暴露自己曾替邻居做过一段没有登记的加固。他想先把危险木料拦下，再自己修完。",
    means: "他用从旅馆借的刻刀在补料废木上刻出「待复检」，剪去放行签，用从白露那里借来的麻线把无编号的木牌栓上去。",
    opportunity: "06:55 他领到开箱复量单；07:00 去旅馆借线，07:05 回站后，在复量独签的时段剪换箱签。",
  },
  others: { motive: "与木料、车站验收或桥梁检修有往来，尚需核对。", means: "可能接触木牌、封绳或官方验收章。", opportunity: "第 3 天清晨的实际行踪需要核对。" },
  statements: {
    [CHENG]: "我第三天早上只在警务所看了桥修工单，之后去车站看木料。箱子里的牌不是我的，我没有刻过‘待复检’，也没有把任何东西塞进封绳里。",
    [BAI]: "我六点多没有见过程渡，花篮一直在河边。那块木牌若是要绑绳，谁都可以从桥边捡到旧麻线，不能凭一根线认人。",
    [GU]: "站台电波钟六点三十五开箱，放行签在。六点五十我封存验收章，六点五十五把开箱桌留给程渡复量。我从七点起在旅客检票台，七点十五回来才看到木牌。",
    [HAN]: "程渡在警务所提过裂缝。六点五十我在站台见顾远山收好验收章，便带回警务所；值班室电波钟七点零六，我把停料条件一并写进记录。",
    [LU]: "我在警务所整理告示，七点半才因另一件报案到站。旧放行签只对指定箱号有效，如果有新裂缝，要由经手人实名暂停后再复检。",
    [SHEN]: "我那时在车站前厅，没看见开箱桌。站里那会儿同时在办几件事，不能只凭我见过谁在站里，就说那个人到过货箱旁。",
    [XU]: "我七点前一直在旧书店整理地图册，没接触木料。木牌上的木屑若来自桥边废料，修复桌不会留下同样的刨痕。",
    [SONG]: "我六点五十分在咖啡馆开门，白露没有来送花。桥修的木料是否被拦下，我是后来听说的。",
    [CHEN]: "我在邮局分拣退回件，官方验收章不经过邮局。若有人寄出复制牌，邮局的封套上应该有登记。",
    [ZHOU]: "我第三天早上没有去车站，程渡有没有拿木料标签，我只听过别人猜。",
    [LIN]: "我借给程渡的是小刻刀，不是桥上的公用工具。他在门廊还刀时，白露正要走；前台那页送花便签上原先写着两个人的名字。",
    [JIANG]: "我六点五十分在咖啡馆，没见过程渡。桥牌上的字若是警告，就该在工单上留下正式记录。"
  },
  revisions: {
    [BAI]: { 5: "……我确实在七点前见过程渡。他到旅馆后门向我借了一段麻线，说要把花篮绑紧。我怕他又替别人做没有工单的活，才说自己没见过他。" }
  },
  evidence: [
    { n: 1, at: "station", title: "没有编号的待复检木牌", text: "这块木牌刻着「待复检」，没有编号，也没有官方章的钢印。背面有一道半圆豁口，能拼进箱角旁一块弯曲的废料。箱外的封绳是复核后才上的。", meaning: "木牌是现场制作的警告，文字并非放行许可，也没有拆过封箱绳。", related: [CHENG, GU], search: "查看木料箱里的待复检木牌" },
    { n: 2, at: "station", title: "木料开箱登记", text: "站台电波钟 06:35，顾远山查得原放行签完好。06:55 复量单只签了程渡一人名。07:00—07:12 的检票流水由顾远山连续签收；07:15 封箱前，两人验出异样。", meaning: "换签发生在开箱之后；复量时只有程渡能接触内签，顾远山在另一处检票。", related: [GU, CHENG], search: "核对值班柜台的开箱和检票登记" },
    { n: 3, at: "station", title: "箱盖内侧的两截线", text: "原签被剪下，线头卡在箱盖内侧，木牌另栓了一截浅麻线。浅麻线绕着一股蓝线，线头呈斜切，与白露送花便签夹着的余线互补。两截线都在箱外封绳以内。", meaning: "替换发生在封箱前，牌上的线和白露借出的那截相连。", related: [CHENG, GU, BAI], search: "检查木料箱盖上新旧绑线" },
    { n: 4, at: "inn", title: "带豁口的刻刀", text: "门廊工具箱夹着借条：程渡 06:42 借小刻刀，07:00 还。刃口有一处豁缺，夹在刀背的木屑带灰蓝漆；牌上的字槽有连续双线，废料的一端也刷着这道漆。", meaning: "借条和刃口痕迹将做牌的工具跟唯一借出的人连起来。", related: [CHENG, LIN], search: "检查门廊工具箱里的刻刀木屑" },
    { n: 5, at: "inn", title: "借麻线的送花便签", text: "前台电波钟 07:00，林阿梨签收花篮。便签上一行虽被划掉，仍能辨认「白露借程渡半截蓝股线」，还夹有余线。背后白露补记 07:00—07:15 与林阿梨点清今天的桌花。", meaning: "便签能纠正白露的说法，余线和点花记录分别说明麻线去向与白露的行踪。", related: [BAI, CHENG, LIN], contradicts: [BAI], search: "翻看旅馆前台的麻线交接便签" },
    { n: 6, at: "police", title: "桥梁裂缝的未登记便签", text: "警务所工单背面有程渡 06:30 的铅笔记录：‘南侧第二梁，细裂，先停料’。这段检查没有进入正式工单。", meaning: "程渡有一个具体而急迫的动机，他想拦下危险木料，也在隐瞒一次未登记的加固检查。", related: [CHENG, HAN], search: "查看值班桌上工单背面的裂缝便签" },
    { n: 7, at: "police", title: "官方验收章回收簿", text: "站台电波钟 06:50，顾远山与韩朔双签，把验收章锁进交接匣。警务所 07:06 收到原封的匣子，韩朔在回收栏签名。正式章会压出编号钢印，木牌的字却只是刻槽。", meaning: "没有人用官方章盖这块牌。韩朔运章去警务所，未留在站台等复量。", related: [HAN, GU], search: "核对校时台暂存的验收章回收簿" },
    { n: 8, at: "police", title: "桥修工单的放行条件", text: "正式工单写明承重梁出现裂缝时必须停料复检，放行标签只能在复检签名后使用。程渡的便签没有签名，但与‘待复检’牌的处理方向一致。", meaning: "这块牌的内容与安全流程一致，解释了程渡为什么宁愿冒险私刻牌，也不愿让裂缝木料直接放行。", related: [CHENG, HAN], search: "阅读街区图下夹着的桥修工单" }
  ],
  history: [
    { key: "inspect-crack", time: "06:25", at: "police", type: "conflict", actors: [CHENG, HAN], summary: "程渡在警务所查看桥修工单，告诉韩朔南侧第二梁有细裂。", tags: ["motive"], clue: 6 },
    { key: "offbook-note", time: "06:30", at: "police", type: "obtain_item", actors: [CHENG], summary: "程渡把裂缝写在工单背面，没有登记进正式桥修记录。", tags: ["motive"], clue: 6 },
    { key: "freight-open", time: "06:35", at: "station", type: "conversation", actors: [GU], summary: "顾远山按站台电波钟开箱，原放行标签和封绳都在。", clue: 2 },
    { key: "borrow-knife", time: "06:42", at: "inn", type: "obtain_item", actors: [CHENG, LIN], summary: "程渡按前台电波钟借走小刻刀，林阿梨把姓名留在工具箱借条上。", clue: 4 },
    { key: "seal-return", time: "06:50", at: "station", type: "conversation", actors: [GU, HAN], summary: "两人封好验收章的交接匣，韩朔带匣返回警务所。", clue: 7 },
    { key: "carve-tag", time: "06:55", at: "station", type: "obtain_item", actors: [CHENG, GU], summary: "顾远山把开箱桌交给程渡独自复量。程渡用废木刻好待复检牌，再去旅馆归还小刻刀。", tags: ["means", "opportunity"], clue: 4 },
    { key: "borrow-twine", time: "07:00", at: "inn", type: "witness", actors: [CHENG, BAI, LIN], summary: "程渡还刀，向白露借蓝股麻线。白露留在前台和林阿梨点桌花，后来划掉便签上的借线记录。", clue: 5, publicVersion: "白露称自己没有见过程渡。", contradictedBy: [5] },
    { key: "relabel", time: "07:05", at: "station", type: "obtain_item", actors: [CHENG], summary: "程渡在木料箱封存前换下原放行标签，把待复检木牌绑进箱内。", tags: ["means", "staging"], clue: 3 },
    { key: "order-check", time: "07:06", at: "police", type: "forensic_clue", actors: [HAN], summary: "韩朔把桥修工单的停料条件补进值班记录。", clue: 8 },
    { key: "discover", time: "07:15", at: "station", type: "incident", actors: [GU, CHENG], summary: "顾远山复核木料箱时发现没有编号的待复检木牌，原放行标签被换下。", tags: ["nonfatal_incident"], clue: 1 }
  ],
  scenes: ["station", "police", "inn", "cafe", "books", "post"],
  relationships: [
    { from: CHENG, to: HAN, label: "未登记裂缝与桥修工单" },
    { from: CHENG, to: GU, label: "木料箱与车站验收" },
    { from: CHENG, to: BAI, label: "借麻线与花篮交接" }
  ],
  exclusions: [
    { characterId: GU, reason: "顾远山在换签时段连续在另一处检票；复量单上签的是程渡，工具借条和麻线也接不到顾远山手上。", clues: [2, 4, 5] },
    { characterId: BAI, reason: "带蓝股的麻线确实出自白露，但她借出线后一直与林阿梨点花，等她离开旅馆，箱签早已换过。", clues: [3, 5] },
    { characterId: HAN, reason: "韩朔保管官方验收章并留下回收簿，复制牌没有章面压痕，他没有理由或时间去刻牌换签。", clues: [1, 6, 7] }
  ],
  reasoning: [
    { id: "rb8-fake-seal", conclusion: "没有编号的木牌是复制件，但‘待复检’与正式安全流程一致，伪造的是权限而不是放行结论。", clues: [1, 7, 8] },
    { id: "rb8-motive", conclusion: "未登记裂缝、刻刀木屑和停料条件说明程渡既想拦下危险木料，也想掩住自己的私修。", clues: [4, 6, 8] },
    { id: "rb8-window", conclusion: "开箱、复量和检票是三份记录；签换在复量独签的时间内，07:00 的借线记录能把程渡接回现场。", clues: [2, 3, 5] },
    { id: "rb8-means", conclusion: "刨痕、麻线纤维和标签撬痕构成刻牌、换签、封箱的连续手法。", clues: [1, 3, 4, 5] },
    { id: "rb8-exclusion", conclusion: "顾远山、白露和韩朔分别被开箱记录、借线范围和官方章回收簿排除。", clues: [2, 4, 5, 7] }
  ],
  redHerrings: ["顾远山掌握木料箱和官方验收章，最像能伪造标签的人。", "白露划掉借线便签，像是在替程渡遮掩刻牌。", "韩朔保管官方印章，实际复制牌根本没有盖章。"],
  decisive: [1, 2, 3, 4, 5, 6, 7, 8],
  answer: { motive: [4, 6, 8], method: [1, 3, 4, 5] },
  sources: { motive: 6, means: 1, opportunity: 1, staging: 3, trace: 4, groupAlibi: 7 },
  events: { trigger: "discover", motive: "offbook-note", means: ["carve-tag", "relabel"], opportunity: "carve-tag", staging: "relabel", trace: "carve-tag", groupAlibi: "seal-return", scene: "station", prep: "police" },
  ending: [
    "木料箱被暂缓放行，桥梁裂缝由正式检修组复核。没有编号的待复检牌被收进安全档案，车站补上了换签时间和经手人。",
    "白露承认借过麻线，韩朔把未登记裂缝补进工单。程渡的警告确实拦下了危险木料，但他也承认安全不能靠一块无名木牌维持。",
    "程渡承担私刻牌和未登记检查的责任，继续参与桥修，却必须在每一次停料时留下正式签名。镇上保留那块复制牌，提醒所有人善意的越权也要能够被追溯。"
  ]
};
