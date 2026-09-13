import type { LocalizedSafeText } from "@/lib/engine";

const ENTRIES = [
  ["Town Hall", "市政厅"],
  ["Objective updated", "目标已更新"],
  ["Institution", "机构"],
  ["Pressure", "压力"],
  ["Reaction", "反应"],
  ["Advance Town held", "暂缓推进小镇"],
  ["Follow the single Current world action; case truth and route certification remain unchanged.", "继续执行当前行动；案件真相和调查规则不会改变。"],
  ["Follow the single 当前 world action; case truth and route certification remain unchanged.", "继续执行当前行动；案件真相和调查规则不会改变。"],
  ["Use the existing certified handler for search; map selection costs no town time and only Advance Town moves the simulation clock.", "搜索所选地点。切换地图对象不消耗时间；只有“推进小镇”会推动小镇时钟。"],
  ["session pending", "等待加入调查"],
  ["Character reference", "角色编号"],
  ["Evidence reference", "证据引用"],
  ["Memory reference", "记忆引用"],
  ["Event reference", "事件引用"],
  ["case window", "案发时段"],
  ["Merchants Guild", "商人公会"],
  ["Keeping a careful public watch while pressure remains visible.", "公开压力尚未消退，正在谨慎关注周围动向。"],
  ["Available with public pressure", "承受公开压力，仍可交谈"],
  ["neutral · no recorded player-authoritative change", "中立 · 尚无玩家行动引起的立场变化"],
  ["current", "当前"],
  ["Another command is still resolving.", "另一项行动仍在结算，请稍候。"],
  ["The current investigation command is still resolving.", "当前调查行动仍在结算，请稍候。"],
  ["Follow the single current world action; case truth and route certification remain unchanged.", "继续执行当前行动；案件真相和调查规则不会改变。"],
  ["Playable case extracted. Review the Case Intake, then join the investigation.", "案件已就绪。请先阅读接案信息，再加入调查。"],
  ["Volume III · Midnight Signals", "第三卷 · 午夜信号"],
  ["Midnight Chorus", "午夜合唱"],
  ["Public performance, backstage access, and night-watch accountability", "公开演出、后台通行与夜巡问责"],
  ["Public Reckoning", "公开追责"],
  ["Follow public testimony, printed records, and night-watch procedure through the theatre district.", "沿公开证词、印刷记录与夜巡程序推进剧院街区调查。"],
  ["Lantern Inquiry", "灯岗调查"],
  ["Compare public accountability with a backstage route built from private leverage, controlled access, and absence.", "对照公开问责路线与由私人杠杆、受控通行及失踪线索构成的后台路线。"],
  ["Theatre Night Market", "剧院夜市"],
  ["midnight playbill", "午夜节目单"],
  ["theatre publicity → public accountability", "剧院公开信息 → 公开问责"],
  ["playbills, corrections, and public accounts / attendance, movement, and corroboration / watch logs, testimony, and exclusion", "节目单、更正记录与公开说法 / 出席、行动与相互印证 / 巡查日志、证词与排除项"],

  ["Case 1", "第一案"],
  ["Case 2", "第二案"],
  ["Case 3", "第三案"],
  ["Opening case", "开场案件"],
  ["Join investigation", "加入调查"],
  ["Create the player session used by the existing certified investigation route.", "加入本案后，可以搜索现场并询问证人。"],
  ["Starts the existing player session without changing case authority.", "开始记录你在本案发现的证据与证词。"],
  ["Joining reveals no hidden answer or raw case binding.", "加入后，解答仍需通过调查获得。"],
  ["Undiscovered clue", "未发现线索"],
  ["Question a witness to establish a public statement.", "询问证人以建立公开陈述。"],
  ["Question this witness to record a public statement.", "询问这名证人以记录公开陈述。"],
  ["Draft incomplete", "理论草稿不完整"],
  ["Ready to submit", "可以提交"],
  ["Recovery required", "需要恢复行动"],
  ["Theory accepted", "结论已通过"],
  ["Case truth, evidence coverage, the certified route, judgement, and NPC legal actions remain unchanged.", "案件事实和判定规则固定；结论必须有证据支持。"],
  ["No recovery required", "无需恢复行动"],
  ["Submit a theory to test the current proof chain.", "提交理论以检验当前证明链。"],
  ["No recovery cost", "无恢复成本"],
  ["Continue the current certified step.", "继续当前调查步骤。"],
  ["Repair one public proof gap", "修复一个公开证明缺口"],
  ["Review one visible gap, revise the theory manually, and submit again.", "复核一个可见缺口，手动修订理论后再次提交。"],
  ["No hidden evidence or automatic answer is granted.", "不会提供隐藏证据或自动答案。"],
  ["Return to the visible evidence chain and revise one incomplete field.", "返回可见证据链并修订一项不完整字段。"],

  ["Observe case window", "观察现场"],
  ["Review the public event window before acting on the certified route.", "先核对案发时段，了解现场发生了什么。"],
  ["Search location", "搜索证据"],
  ["Focus search location", "定位搜索地点"],
  ["Focus Greenhouse and use the existing certified Search action.", "前往温室，搜索证据。"],
  ["Question character", "询问证人"],
  ["Ask the prepared focused question through the existing memory-scoped interrogation handler.", "向证人提问，记录他在案发时段的见闻。"],
  ["Advances the existing certified investigation route.", "继续推进本案调查。"],
  ["Truth, coverage, judgement, and legal actions remain unchanged.", "案件事实和判定规则不会改变。"],
  ["No action resolved", "尚无行动结算"],
  ["No result has been recorded yet.", "尚未记录行动结果。"],
  ["Civic Records Office lead", "市政档案处线索"],
  ["Selected public character. Only legal investigation actions are shown.", "已选择人物，可查看当前能够进行的调查行动。"],
  ["Selected public location. Available actions remain governed by the certified investigation route.", "已选择地点，可查看当前可用的调查行动。"],
  ["Following an ordinary public routine without a current town signal.", "正在执行日常公开活动，当前没有城镇信号。"],
  ["Available for current action", "可执行当前行动"],
  ["Prepared for the current certified action", "已准备执行当前调查行动"],
  ["Public posture guides presentation only; case truth and legal actions remain unchanged.", "公开姿态只影响表现；案件真相与合法行动保持不变。"],

  ["Search the next linked scene", "搜索下一个关联现场"],
  ["Search the linked scene for a required clue.", "在关联现场搜索一条必要线索。"],
  ["Search operation resolved", "搜索行动已结算"],
  ["No reserved capacity spent; Manual First remained legal. 60 minutes of case operations time.", "未消耗预留能力；人工优先仍为合法路线。本次案件行动耗时 60 分钟。"],
  ["Certified investigation progress was preserved through the slower route. The extra town-time interval remains part of this case's bounded tempo.", "较慢路线仍保留认证调查进度；额外的城镇时间区间继续计入本案的限定节奏。"],
  ["Choose World Lead response", "选择世界线索响应"],
  ["Prioritize the next legal certified witness question.", "接下来先询问证人。"],
  ["Resolve Search the next linked scene first.", "先完成“搜索下一个关联现场”。"],
  ["Selected discovered clue. Theory and challenge actions reuse the existing case handlers.", "已选择线索，可以用它质证或加入推理。"],
  ["Add clue to theory", "把线索加入理论"],
  ["Add or remove this discovered clue from the current theory evidence set.", "在当前理论证据集中加入或移除这条已发现线索。"],
  ["Open theory workspace", "组织推理"],
  ["Review the current culprit, motive, method, and selected evidence fields.", "复核当前的嫌疑人、动机、手法与已选证据字段。"],
  ["Guided Journal", "引导日志"],
  ["Investigation session opened.", "已加入调查。"],
  ["World Event", "世界事件"],
  ["Evidence found: Restricted type block", "已发现证据：受限铅字块"],
  ["POLICE TIME", "警务时间"],
  ["INFORMANT TRUST", "线人信任"],
  ["EVIDENCE INTEGRITY", "证据完整度"],
  ["TOWN TIME", "城镇时间"],
  ["OPERATIONS", "调查行动"],
  ["INSTITUTION PRESSURE", "机构压力"],
  ["No active pressure", "暂无压力"],
  ["unavailable", "不可用"],
  ["manual first", "人工优先"],
  ["ample", "充足"],
  ["advance available", "可推进"],
  ["townwide", "全镇"],
  ["RECORDED", "已记录"],
  ["INTAKE", "接案"],
  ["FIELDWORK", "现场调查"],
  ["DEDUCTION", "推理"],
  ["REVIEW", "复核"],
  ["CURRENT", "当前"],
  ["INSTITUTION", "机构"],
  ["PRESSURE", "压力"],
  ["REACTION", "反应"],
  ["Pass", "通过"],
  ["location ready", "地点就绪"],
  ["BUILDING", "建筑"],

  // Safe projections for shared command-deck and transition copy that can
  // surface while the Gold Slice is active. Keep both title-case and the
  // legacy all-caps variants because authored payloads may arrive in either
  // form from the existing certified handlers.
  ["Police Time", "警务时间"],
  ["Informant Trust", "线人信任"],
  ["Evidence Integrity", "证据完整度"],
  ["Town Time", "城镇时间"],
  ["Operations", "调查行动"],
  ["Institution Pressure", "机构压力"],
  ["Civic Records Office", "市政档案处"],
  ["World Lead: Civic Records Office lead", "世界线索：市政档案处线索"],
  ["Intake", "接案"],
  ["Fieldwork", "现场调查"],
  ["Deduction", "推理"],
  ["Review", "复核"],
  ["Current", "当前"],
  ["Ready", "就绪"],
  ["Held", "暂缓"],
  ["Open", "打开"],
  ["Pass", "通过"],
  ["Case opened", "案件已开启"],
  ["Certified action", "调查行动"],
  ["World choice", "世界选择"],
  ["Chapter transition", "章节过渡"],
  ["Finale ready", "终章就绪"],
  ["Campaign completed", "Campaign 已完成"],
  ["Resolving the current action", "正在结算当前行动"],
  ["No persistent world change", "本次没有小镇变化"],
  ["Action returned safely", "已收到行动结果"],
  ["World consequence", "世界后果"],
  ["Next objective", "下一目标"],
  ["The existing typed handler is resolving without changing presentation authority.", "正在执行行动，请稍候。"],
  ["The existing command returned a safe visible result.", "已收到本次行动结果。"],
  ["The public world context remains stable.", "小镇情况保持稳定。"],
  ["Continue with the next legal action.", "继续下一步调查。"],
  ["Existing authority confirmed", "行动结果已确认"],
  ["The existing route advances.", "现有路线继续推进。"],
  ["No additional world cost is created by this presentation.", "本次演出不会产生额外世界成本。"],
  ["Playable case extracted.", "可游玩案件已提取。"],
  ["Case opened", "案件已开启"],
  ["action resolving", "行动结算中"],
  ["Certified action", "调查行动"],
  ["Consequence", "后果"],
  ["Next", "下一步"],
  ["Resolve Join investigation first.", "先完成“加入调查”。"],
  ["Resolve 复核案发时段 first.", "先完成“观察现场”。"],
  ["Review latest result", "复核最新结果"],
  ["The authoritative investigation objective has advanced.", "调查目标已推进。"],
  ["Plan Investigation Operations", "规划调查行动"],
  ["Use the existing certified handler for question; map selection costs no town time and only Advance Town moves the simulation clock.", "询问所选证人。切换地图对象不消耗时间；只有“推进小镇”会推动小镇时钟。"],
  ["Greenhouse pruning blade case", "温室修枝刀案件"],
  ["idle", "空闲"],
  ["resolving", "结算中"],
  ["recorded", "已记录"],
  ["scheduled", "已安排"],
  ["Reviewing this summary does not write another event.", "查看这份摘要不会新增事件记录。"],
  ["completed", "已完成"],
  ["blocked", "受阻"],
  ["updated", "已更新"],
  ["failed-safe", "结果未确认"],
  ["neutral · steady", "中立 · 稳定"],
  ["Join required before case contact", "需先加入调查才能接触案件"],
  ["Observe the public case window first", "先复核公开案发时段"],
  ["Guarded", "戒备"],
  ["Busy", "忙碌"],
  ["Public duties or recent case contact are limiting attention.", "公务或近期案件接触占用了他的注意力。"],
  ["Please explain this evidence and whether it changes your earlier statement.", "请解释这条证据，并说明它是否会改变你之前的陈述。"],
  ["Where were you during the incident window, and what did you observe?", "案发时段你在哪里？你看到了什么？"],
  ["Avoiding", "回避"],
  ["Routine", "日常"],
  ["Certified Case Rhythm", "调查步骤"],
  ["Minimum Recovery", "最低恢复行动"],
  ["step", "步骤"],
  ["Manual First: this rhythm focuses existing legal actions and never fills a theory, reveals truth, or changes route authority.", "按步骤自行调查、整理证据并提出结论。这里不会自动填写答案。"],

  ["Separate what the audience repeated from what the printing desk, box office, and night market could verify. The surviving publication route will determine which public witness can be protected in the next chapter.", "把观众转述的内容与印刷台、售票处和夜市能够核实的事实分开。最终成立的传播路线将决定下一章能够保护哪一名公开证人。"],

  ["Printed Whisper", "印刷低语"],
  ["Establish which public account crossed from the theatre noticeboard into the midnight crowd.", "查明哪一版公开说法从剧院告示板传入午夜人群。"],
  ["playbills, corrections, and public accounts", "节目单、更正记录与公开说法"],
  ["theatre publicity", "剧院公开信息"],
  ["Missing Chorus", "失踪合唱"],
  ["Reconstruct a witness route between rehearsal, the market arcade, and the public square.", "重建证人在排练厅、市场拱廊与公共广场之间的行动路线。"],
  ["attendance, movement, and corroboration", "出席、行动与相互印证"],
  ["public witness safety", "公开证人安全"],
  ["Resolve the night-watch error through certified proof and a public procedural record.", "通过认证证据与公开程序记录纠正夜巡错误。"],
  ["watch logs, testimony, and exclusion", "巡查日志、证词与排除项"],
  ["public accountability", "公开问责"],

  ["The Printed Whisper", "印刷低语"],
  ["A rumor becomes actionable only when its revisions and public handoffs can be reconstructed.", "只有能够重建一则传闻的修改过程与公开交接，它才可以成为可调查的线索。"],
  ["A theatre notice, a corrected playbill, and three conflicting accounts spread through the town square before midnight.", "午夜前，一张剧院告示、一份更正节目单与三种相互冲突的说法传遍城镇广场。"],
  ["Separate what the audience repeated from what the printing desk, box office, and night market could verify.", "把观众转述的内容与印刷台、售票处和夜市能够核实的事实分开。"],
  ["The surviving publication route will determine which public witness can be protected in the next chapter.", "最终成立的传播路线将决定下一章能够保护哪一名公开证人。"],
  ["Performers, printers, vendors, and watch officers must protect their livelihoods while correcting a public story.", "演员、印刷工、摊贩与巡警既要维持生计，也必须纠正公开流传的说法。"],
  ["Read each clue as one stage in a public account's revision and distribution", "把每条线索视为公开说法修改与传播过程中的一个环节"],
  ["Restricted type block", "受限铅字块"],
  ["Cancelled billing notice", "撤销署名通知"],
  ["Box-office handoff", "售票处交接"],
  ["Replaced display sheet", "被替换的展示页"],
  ["Fresh ink transfer", "新鲜油墨转印"],
  ["Rehearsal call ledger", "排练点名簿"],
  ["A critic repeats the damaging claim but leaves before the corrected sheet reaches the display frame.", "一名评论家转述了有害说法，却在更正页送达展示框之前便已离开。"],
  ["A vendor handles the first playbill while the print-room log excludes access to the decisive revision.", "一名摊贩接触过首版节目单，但印刷间日志排除了其接触关键更正版的可能。"],
  ["The witness distinguishes the phrase heard in the square from the wording printed beside the theatre doors.", "证人能够区分广场上听到的说法与剧院门旁实际印出的文字。"],
  ["Compare revision time and public handoff before treating repetition as authorship.", "先核对修改时间与公开交接，再判断重复某句话是否等同于创作源头。"],
  ["A verified public account becomes the foundation of the theatre district inquiry.", "经核实的公开说法成为剧院街区调查的基础。"],

  ["The Missing Chorus", "失踪合唱"],
  ["A missing witness leaves a public rhythm of arrivals, pauses, and avoided checkpoints.", "一名失踪证人留下了由抵达、停顿与绕开检查点组成的公开行动节奏。"],
  ["One chorus member misses the final rehearsal after crossing the market arcade, while the public watch records an ordinary departure.", "一名合唱演员穿过市场拱廊后缺席最终排练，而公开巡查记录却记载其正常离开。"],
  ["Reconstruct the route from rehearsal call to market sighting without turning crowd memory into certified fact.", "从排练点名重建到市场目击的路线，不得把人群记忆当作认证事实。"],
  ["The recovered movement sequence will decide whether the night watch enters the final inquiry as witness or subject.", "复原后的行动序列将决定夜巡人员在最终调查中是证人还是调查对象。"],
  ["Stage staff, market porters, and patrol officers face pressure to preserve schedules without exposing private arrangements.", "舞台人员、市场搬运行与巡警承受着维持排班、同时避免暴露私人安排的压力。"],
  ["Treat attendance, movement, and checkpoint time as one witness-safety route", "把出席、行动与检查点时间视为同一条证人安全路线"],
  ["Service-door restraint", "服务门束缚装置"],
  ["Withdrawn witness request", "被撤回的证人申请"],
  ["Arcade crossing account", "拱廊穿行证词"],
  ["Signed departure board", "签字离场板"],
  ["Costume-thread snag", "服装线头挂痕"],
  ["Public fountain roster", "公共喷泉值守名册"],
  ["A stage rival benefits from the absence but performs in public throughout the service-door interval.", "一名舞台竞争者因失踪获益，但在服务门相关时段始终公开演出。"],
  ["A porter changes a route description while the fountain roster excludes the hidden passage window.", "一名搬运行改口描述路线，但喷泉值守名册排除了其进入暗道的时段。"],
  ["The witness recalls where the chorus member stopped responding to greetings, not where the crowd assumed the journey ended.", "证人记得合唱演员从何处开始不再回应招呼，而不是人群猜测其行程终点的位置。"],
  ["Search the service route and public checkpoints together before assigning intent to the absence.", "先同时调查服务路线与公开检查点，再判断这次失踪背后的意图。"],
  ["A protected movement record carries the missing chorus into a public night-watch review.", "受保护的行动记录把失踪合唱事件带入公开夜巡复核。"],
  ["Chapter 1: A verified public account becomes the foundation of the theatre district inquiry.", "第一章：经核实的公开说法成为剧院街区调查的基础。"],
  ["Chapter 2: A protected movement record carries the missing chorus into a public night-watch review.", "第二章：受保护的行动记录把失踪合唱事件带入公开夜巡复核。"],

  ["The Lantern Inquiry", "灯岗调查"],
  ["Public safety fails when a plausible patrol account is accepted before its exclusions are tested.", "如果在检验排除项之前就接受看似合理的巡逻说法，公共安全便会失守。"],
  ["The town convenes an inquiry after a lantern checkpoint, a theatre alarm, and a public detention describe incompatible midnight routes.", "灯岗检查、剧院警报与公开拘留记录描述了彼此不相容的午夜路线，城镇因此召开调查。"],
  ["Determine which procedural shortcut converted an uncertain public sighting into an official conclusion.", "查明哪一步程序捷径把不确定的公开目击变成了官方结论。"],
  ["The inquiry joins publication custody and witness movement into one auditable account of the district's midnight response.", "调查把出版物保管链与证人行动合并为一份可审计的街区午夜处置记录。"],
  ["Watch officers, civic clerks, and theatre stewards must distinguish institutional loyalty from defensible procedure.", "巡警、市政职员与剧院管理人员必须区分机构忠诚和经得起辩护的程序。"],
  ["Audit patrol timing, recorded grounds, and excluded routes as one procedural chain", "把巡逻时序、记载依据与已排除路线作为同一条程序链审计"],
  ["Watch-room seal", "巡查室封印"],
  ["Suppressed correction request", "被压下的更正申请"],
  ["Lantern-post interval", "灯岗时段"],
  ["Retimed alarm entry", "被改时的警报条目"],
  ["Checkpoint wax fragment", "检查点封蜡碎片"],
  ["Square patrol muster", "广场巡逻点名"],
  ["A dismissed steward attacks the patrol publicly but cannot reach the alarm ledger during the disputed interval.", "一名被解雇的管理人员公开抨击巡逻队，却无法在争议时段接触警报账簿。"],
  ["A reporter receives an early correction while the press route excludes control of the watch-room seal.", "一名记者提前收到更正稿，但出版路线排除了其控制巡查室封印的可能。"],
  ["The witness separates the person seen beneath the lantern from the conclusion later entered in the watch record.", "证人把灯下看到的人与后来写入巡查记录的结论明确区分开来。"],
  ["Challenge the recorded conclusion against the checkpoint exclusions; confidence is not route integrity.", "用检查点排除项质疑记录结论；确信不等于路线完整。"],
  ["The Lantern Inquiry leaves a public standard for correcting night-watch error.", "灯岗调查为纠正夜巡错误留下了一项公开标准。"],
  ["Chapter 3: The Lantern Inquiry leaves a public standard for correcting night-watch error.", "第三章：灯岗调查为纠正夜巡错误留下了一项公开标准。"]
] as const;

export const MIDNIGHT_CHORUS_GOLD_SLICE_LOCALIZED_TEXT = Object.freeze(Object.fromEntries(
  ENTRIES.map(([en, zh]) => [en, Object.freeze({ "en-US": en, "zh-CN": zh })])
)) as Readonly<Record<string, LocalizedSafeText>>;

// Compile once, not for every label rendered by the command deck.
const FRAGMENT_PROJECTIONS = [...ENTRIES]
  .sort(([left], [right]) => right.length - left.length)
  .map(([source, target]) => {
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return [new RegExp(`(?<![A-Za-z0-9_-])${escaped}(?![A-Za-z0-9_-])`, "g"), target] as const;
  });

export function localizeMidnightChorusGoldSlice(value: string, locale: "en-US" | "zh-CN") {
  const exact = MIDNIGHT_CHORUS_GOLD_SLICE_LOCALIZED_TEXT[value]?.[locale];
  if (exact || locale === "en-US") return exact;
  const prerequisite = value.match(/^Resolve (.+) first\.$/);
  if (prerequisite) {
    const action = prerequisite[1];
    const translated = MIDNIGHT_CHORUS_GOLD_SLICE_LOCALIZED_TEXT[action]?.["zh-CN"]
      || (ENTRIES.some(([, chinese]) => chinese === action) ? action : undefined);
    if (translated) return `先完成“${translated}”。`;
    return undefined;
  }
  const evidenceStatus = value.match(/^(?:Evidence found|发现证据|已发现证据)[:：]\s*(.+)$/);
  if (evidenceStatus) {
    const evidenceTitle = MIDNIGHT_CHORUS_GOLD_SLICE_LOCALIZED_TEXT[evidenceStatus[1]]?.["zh-CN"] || evidenceStatus[1];
    return `已发现证据：${evidenceTitle}`;
  }
  // Exact public UI templates captured in the first-case browser preflight.
  // Only the supplied names/titles are retained; no new clue meaning is added.
  const testimonyHint = value.match(/^Can challenge testimony or timeline: Present this clue to ([^\n:]{1,200}) and check whether the statement still holds\.$/);
  if (testimonyHint) return `可用于检验证词或时间线：向${testimonyHint[1].replace(/, /g, "、")}出示这条证据，检查原陈述是否仍然成立。`;
  const claimHint = value.match(/^([^\n]{1,120})(?: can test this public claim\.|可以用来检验这条陈述。)$/);
  if (claimHint) {
    const title = MIDNIGHT_CHORUS_GOLD_SLICE_LOCALIZED_TEXT[claimHint[1]]?.["zh-CN"] || claimHint[1];
    return `${title}可以用来检验这条陈述。`;
  }
  const focusedQuestion = value.match(/^([^\n,]{1,60}), where were you during the crime window, and what unusual details do you remember\?$/);
  if (focusedQuestion) return `${focusedQuestion[1]}，案发时段你在哪里？你还记得哪些异常细节？`;
  const returnedMethod = value.match(/^([\p{Script=Han}]{2,4}) dies after a complete simulated pressure chain involving ([\p{Script=Han}]{2,4})\.$/u);
  if (returnedMethod) return `${returnedMethod[1]}在一系列涉及${returnedMethod[2]}的施压事件完整形成后死亡。`;
  const correctedStatement = value.match(/^([^\n]{1,60})'s public statement changed after a certified challenge\.$/);
  if (correctedStatement) return `${correctedStatement[1]}在质证后修正了公开陈述。`;
  const publicEventPatterns: ReadonlyArray<[RegExp, (boundary: string, name: string) => string]> = [
    [/(^|[.。:/：]\s*|\s)([\p{Script=Han}]{2,4}) repeated a partial account of recent events\.$/iu, (boundary, name) => `${boundary}${name}转述了近期事件的部分情况。`],
    [/(^|[.。:/：]\s*|\s)([\p{Script=Han}]{2,4}) was found dead after a series of visible town tensions\.$/iu, (boundary, name) => `${boundary}${name}在小镇接连出现紧张迹象后被发现死亡。`]
  ];
  let eventProjection = value;
  for (const [pattern, project] of publicEventPatterns) {
    eventProjection = eventProjection.replace(pattern, (_, boundary: string, name: string) => project(boundary, name));
  }
  const rollcall = /(^|[.。:/：]\s*|\s)A public rollcall excludes residents who were away from the scene\.$/i;
  eventProjection = eventProjection.replace(rollcall, (_, boundary: string) => `${boundary}公开点名记录排除了当时不在现场的居民。`);
  const metricPatterns: ReadonlyArray<[RegExp, (...matches: string[]) => string]> = [
    [/^(\d+)\/(\d+) certified steps$/, (done, total) => `${done}/${total} 个调查步骤`],
    [/^(\d+)\/(\d+) clues found$/, (done, total) => `${done}/${total} 条线索已发现`],
    [/^(\d+)\/(\d+) campaign cases closed$/, (done, total) => `${done}/${total} 案已结案`],
    [/^Between cases: (\d+)\/(\d+) campaign cases closed$/, (done, total) => `案间准备：${done}/${total} 案已结案`],
    [/^(\d+)\/(\d+) steps$/, (done, total) => `${done}/${total} 步已完成`],
    [/^(\d+) clue\(s\)$/, (count) => `${count} 条证据`],
    [/^(\d+) min$/, (minutes) => `${minutes} 分钟`]
  ];
  for (const [pattern, project] of metricPatterns) {
    const match = value.match(pattern);
    if (match) return project(...match.slice(1));
  }
  if (locale === "zh-CN") {
    // Payloads from the existing handlers often compose a status label and an
    // authored title (for example `发现证据: Cancelled billing notice`).
    // Project known authored fragments inside those composites as well as
    // exact strings, while still failing closed for unknown copy.
    // Event descriptions can share a line with an authored evidence-reading
    // prefix. Let the existing fragment projection finish that composed line.
    let authoredProjection = eventProjection;
    for (const [boundary, target] of FRAGMENT_PROJECTIONS) {
      // A label may appear inside composed public copy, but never inside a
      // larger word or identifier (stepwise, unrecorded, candidate-step-12).
      authoredProjection = authoredProjection.replace(boundary, () => target);
    }
    if (authoredProjection !== value) return authoredProjection;
  }
  return undefined;
}
