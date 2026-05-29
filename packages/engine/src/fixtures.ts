import type { DeductionCase, EvalCase } from "./types";

export function createShowcaseCase(topic = "Showcase: campus observatory death message"): DeductionCase {
  return {
    id: "showcase-north-star",
    title: "北极星不在天上",
    theme: topic,
    premise: "校庆前夜，暴雨封山。天体物理教授林远舟死在圆顶观测室，门禁显示案发时段无人进入。死者手边留下半张圈出北极星的星图。",
    publicCaseFile:
      "山顶天文台发生命案。林远舟教授被发现倒在圆顶观测室内，门禁记录显示 20:15 到 20:30 没有外人进入。死者手边有半张旧星图，红笔圈出“北极星”，旁边写着“这里不动”。当晚暴雨，天空不可见星光。玩家需要搜索天文台、询问相关人员，并解释死亡留言到底指向什么。",
    truth: {
      culpritId: "assistant",
      motive: "陆青长期篡改观测数据并挪用维护经费，林远舟准备在校庆演讲中公开证据。",
      method:
        "陆青利用备用电源切换制造四分钟监控空白，进入圆顶观测室杀害教授，再把望远镜转向固定校准刻度，让死亡留言看似指向天体，实际指向他常用的固定工作位。",
      opportunity: "陆青掌握控制室维护钥匙，能在 20:18 触发备用电源切换，并在监控空白中进入观测室。",
      decisiveEvidenceIds: ["e-power-log", "e-base-mark", "e-dust"],
      trueTimeline: [
        {
          id: "t1",
          time: "20:10",
          event: "陆青借口检查备用电源进入控制室。",
          characterIds: ["assistant"],
          isPublic: false,
          source: "真实时间线",
          publicVersion: "陆青称自己 20:00 后一直在档案室整理星图。",
          contradictedByEvidenceIds: ["e-dust", "e-power-log"]
        },
        {
          id: "t2",
          time: "20:18",
          event: "备用电源被人为切换，监控出现四分钟空白。",
          characterIds: ["assistant"],
          isPublic: true,
          source: "电源日志",
          publicVersion: "管理员最初认为这是暴雨导致的普通故障。",
          contradictedByEvidenceIds: ["e-power-log"]
        },
        {
          id: "t3",
          time: "20:20",
          event: "林远舟在圆顶观测室遇害。",
          characterIds: ["victim", "assistant"],
          isPublic: false,
          source: "真实时间线",
          publicVersion: "门禁记录显示没有人进入观测室。",
          contradictedByEvidenceIds: ["e-power-log", "e-base-mark"]
        },
        {
          id: "t4",
          time: "20:24",
          event: "陆青把望远镜停在北侧固定校准刻度，制造“北极星”死亡留言。",
          characterIds: ["assistant"],
          isPublic: false,
          source: "望远镜基座",
          publicVersion: "众人以为死者想指向天空中的北极星。",
          contradictedByEvidenceIds: ["e-base-mark"]
        }
      ]
    },
    characters: [
      {
        id: "assistant",
        name: "陆青",
        role: "教授助理",
        publicBio: "负责观测日志、仪器维护排班和星图档案。",
        secret: "长期篡改观测数据并挪用维护经费。",
        motive: "担心造假和经费问题被教授公开。",
        means: "熟悉备用电源、控制室钥匙和望远镜校准方式。",
        opportunity: "案发时能进入控制室并制造监控空白。",
        isCulprit: true,
        alibi: "声称案发时一直在档案室整理星图。",
        initialStatement: "林教授今晚只关心校庆演讲，我不知道他为什么会去观测室。",
        knowledgeScope: ["维护记录", "星图档案", "备用电源"],
        liePolicy: "先否认进入控制室；被电源日志和档案灰尘质询后，会承认检查过电源但仍否认杀人。",
        contradictionTriggers: ["e-power-log", "e-dust"]
      },
      {
        id: "rival",
        name: "周衡",
        role: "竞争教授",
        publicBio: "与林远舟竞争同一重点项目。",
        secret: "曾举报林远舟论文瑕疵。",
        motive: "项目竞争激烈，但没有杀人的必要风险。",
        means: "没有控制室权限，也不懂备用电源切换细节。",
        opportunity: "案发时在会议室与两名学生争论。",
        isCulprit: false,
        alibi: "两名学生能证明他 20:10 到 20:35 在会议室。",
        initialStatement: "我讨厌林远舟，但不会在校庆前夜毁掉整个学院。",
        knowledgeScope: ["项目竞争", "会议室争论"],
        liePolicy: "会隐瞒举报论文的事，但不会伪造案发时间。",
        contradictionTriggers: ["e-meeting-note"]
      },
      {
        id: "admin",
        name: "何岚",
        role: "仪器管理员",
        publicBio: "负责望远镜硬件和圆顶机械维护。",
        secret: "隐瞒过一次设备事故。",
        motive: "害怕旧事故被追责。",
        means: "懂仪器，但没有备用电源后台权限。",
        opportunity: "案发前离开天文台去取备件。",
        isCulprit: false,
        alibi: "维修车 GPS 和门卫登记能证明她离开过山顶。",
        initialStatement: "望远镜指向北极星不奇怪，奇怪的是暴雨夜没人需要校准。",
        knowledgeScope: ["望远镜基座", "维修车", "设备事故"],
        liePolicy: "会隐瞒旧事故，若被维修车记录质询会承认离开。",
        contradictionTriggers: ["e-van-gps"]
      }
    ],
    evidence: [
      {
        id: "e-power-log",
        title: "备用电源日志",
        location: "control",
        visibleDescription: "20:18 出现四分钟电源切换记录，切换命令来自维护终端。",
        trueMeaning: "监控空白不是自然故障，而是熟悉控制室的人制造的机会。",
        relatedCharacterIds: ["assistant"],
        relatedTime: "20:18",
        discoverable: true,
        isKey: true,
        unlocks: ["challenge-assistant-power"],
        contradicts: ["assistant", "t1", "t2", "t3"],
        supportsConclusion: ["method", "opportunity"],
        discoveryDifficulty: "easy"
      },
      {
        id: "e-base-mark",
        title: "望远镜基座刻度",
        location: "dome",
        visibleDescription: "望远镜没有指向天空，而是停在北侧固定校准刻度。",
        trueMeaning: "“北极星”指的不是星体，而是固定不动的校准点和常用工作位。",
        relatedCharacterIds: ["assistant", "admin"],
        relatedTime: "20:24",
        discoverable: true,
        isKey: true,
        unlocks: ["challenge-admin-base"],
        contradicts: ["t4"],
        supportsConclusion: ["method", "death-message"],
        discoveryDifficulty: "medium"
      },
      {
        id: "e-dust",
        title: "档案盒灰尘",
        location: "archive",
        visibleDescription: "陆青声称整理过的星图盒没有新近翻动痕迹，灰尘完整。",
        trueMeaning: "陆青案发时在档案室的不在场证明是假的。",
        relatedCharacterIds: ["assistant"],
        discoverable: true,
        isKey: true,
        unlocks: ["challenge-assistant-alibi"],
        contradicts: ["assistant", "t1"],
        supportsConclusion: ["culprit", "opportunity"],
        discoveryDifficulty: "easy"
      },
      {
        id: "e-meeting-note",
        title: "会议室白板记录",
        location: "meeting",
        visibleDescription: "白板上保留着周衡与学生争论项目预算的时间记录。",
        trueMeaning: "周衡有动机，但案发关键时间段被多人和白板记录排除。",
        relatedCharacterIds: ["rival"],
        relatedTime: "20:20",
        discoverable: true,
        isKey: false,
        unlocks: [],
        contradicts: ["rival"],
        supportsConclusion: ["exclude-rival"],
        discoveryDifficulty: "easy"
      },
      {
        id: "e-van-gps",
        title: "维修车 GPS",
        location: "gate",
        visibleDescription: "维修车 20:12 离开山顶，20:38 返回。",
        trueMeaning: "何岚能接触望远镜，但案发时不在现场。",
        relatedCharacterIds: ["admin"],
        relatedTime: "20:12-20:38",
        discoverable: true,
        isKey: false,
        unlocks: [],
        contradicts: ["admin"],
        supportsConclusion: ["exclude-admin"],
        discoveryDifficulty: "medium"
      }
    ],
    scenes: [
      { id: "dome", name: "圆顶观测室", description: "死者倒在望远镜旁，旧星图被雨水打湿一角。", evidenceIds: ["e-base-mark"] },
      { id: "control", name: "控制室", description: "监控、电源和门禁终端都集中在这里。", evidenceIds: ["e-power-log"] },
      { id: "archive", name: "星图档案室", description: "陆青声称案发时一直待在这里。", evidenceIds: ["e-dust"] },
      { id: "meeting", name: "会议室", description: "周衡和学生在这里争执项目问题。", evidenceIds: ["e-meeting-note"] },
      { id: "gate", name: "山门岗亭", description: "门卫保存车辆进出记录。", evidenceIds: ["e-van-gps"] }
    ],
    relationships: [
      { from: "assistant", to: "victim", label: "助理/教授" },
      { from: "rival", to: "victim", label: "项目竞争" },
      { from: "admin", to: "victim", label: "设备维护" }
    ],
    logicPuzzle: {
      suspectMatrix: [
        { characterId: "assistant", name: "陆青", motive: true, means: true, opportunity: true, excludedByEvidenceIds: [], completeAndUnexcluded: true, isCulprit: true },
        { characterId: "rival", name: "周衡", motive: true, means: false, opportunity: false, excludedByEvidenceIds: ["e-meeting-note"], completeAndUnexcluded: false, isCulprit: false },
        { characterId: "admin", name: "何岚", motive: true, means: true, opportunity: false, excludedByEvidenceIds: ["e-van-gps"], completeAndUnexcluded: false, isCulprit: false }
      ],
      exclusionChains: [
        { characterId: "rival", reason: "会议室白板和学生证词排除周衡案发时进入圆顶。", evidenceIds: ["e-meeting-note"] },
        { characterId: "admin", reason: "维修车 GPS 排除何岚案发时在山顶。", evidenceIds: ["e-van-gps"] }
      ],
      criticalReasoningChain: [
        { id: "r1", conclusion: "监控空白由人为制造。", evidenceIds: ["e-power-log"] },
        { id: "r2", conclusion: "死亡留言指向固定校准点，不是天上的北极星。", evidenceIds: ["e-base-mark"] },
        { id: "r3", conclusion: "陆青的不在场证明为假。", evidenceIds: ["e-dust"] },
        { id: "r4", conclusion: "其他嫌疑人被证据排除，只剩陆青完整满足动机、手段、机会。", evidenceIds: ["e-meeting-note", "e-van-gps"] }
      ],
      redHerrings: ["周衡的项目竞争", "何岚隐瞒的旧设备事故"],
      requiredClueOrder: ["e-power-log", "e-base-mark", "e-dust", "e-meeting-note", "e-van-gps"]
    }
  };
}

export function createFallbackCase(topic?: string) {
  return createShowcaseCase(topic);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function createEvalFixtures(): EvalCase[] {
  const valid = createShowcaseCase("fixture-valid");
  const doubleSuspect = clone(valid);
  doubleSuspect.id = "fixture-double-complete-suspect";
  const rival = doubleSuspect.logicPuzzle.suspectMatrix.find((row) => row.characterId === "rival");
  if (rival) {
    rival.means = true;
    rival.opportunity = true;
    rival.excludedByEvidenceIds = [];
    rival.completeAndUnexcluded = true;
  }
  doubleSuspect.logicPuzzle.exclusionChains = doubleSuspect.logicPuzzle.exclusionChains.filter((chain) => chain.characterId !== "rival");

  const missingKey = clone(valid);
  missingKey.id = "fixture-missing-key-evidence";
  missingKey.truth.decisiveEvidenceIds = [...missingKey.truth.decisiveEvidenceIds, "e-missing"];

  const undiscoverableKey = clone(valid);
  undiscoverableKey.id = "fixture-undiscoverable-key";
  const powerLog = undiscoverableKey.evidence.find((item) => item.id === "e-power-log");
  if (powerLog) powerLog.discoverable = false;

  const noTimelineContradiction = clone(valid);
  noTimelineContradiction.id = "fixture-no-timeline-contradiction";
  noTimelineContradiction.truth.trueTimeline = noTimelineContradiction.truth.trueTimeline.map((event) => ({
    ...event,
    publicVersion: "",
    contradictedByEvidenceIds: []
  }));

  const noReasoningEvidence = clone(valid);
  noReasoningEvidence.id = "fixture-no-reasoning-evidence";
  noReasoningEvidence.logicPuzzle.criticalReasoningChain = noReasoningEvidence.logicPuzzle.criticalReasoningChain.map((step) => ({ ...step, evidenceIds: [] }));

  const drift = clone(valid) as any;
  drift.id = "fixture-llm-field-drift";
  drift.logicPuzzle.exclusionChains = [
    { suspectId: "rival", reason: "会议室白板排除", evidence: ["e-meeting-note"] },
    { suspectId: "admin", reason: "维修车 GPS 排除", evidence: ["e-van-gps"] }
  ];
  drift.logicPuzzle.criticalReasoningChain = [
    "备用电源日志（e-power-log）证明监控空白可被人为制造。",
    "望远镜基座刻度（e-base-mark）证明死亡留言指向固定点。",
    "档案盒灰尘（e-dust）证明陆青不在场证明为假。"
  ];
  drift.logicPuzzle.suspectMatrix = [
    { suspect: "陆青", motive: "高", means: "有", opportunity: "有", isCulprit: true },
    { suspect: "周衡", motive: "高", means: "无", opportunity: "无", isCulprit: false },
    { suspect: "何岚", motive: "中", means: "有", opportunity: "无", isCulprit: false }
  ];

  return [
    { id: valid.id, name: "valid showcase", kind: "valid", expectValid: true, case: valid },
    { id: doubleSuspect.id, name: "two complete suspects", kind: "invalid", expectValid: false, case: doubleSuspect },
    { id: missingKey.id, name: "missing decisive evidence", kind: "invalid", expectValid: false, case: missingKey },
    { id: undiscoverableKey.id, name: "undiscoverable decisive evidence", kind: "invalid", expectValid: false, case: undiscoverableKey },
    { id: noTimelineContradiction.id, name: "no timeline contradiction", kind: "invalid", expectValid: false, case: noTimelineContradiction },
    { id: noReasoningEvidence.id, name: "reasoning chain without evidence", kind: "invalid", expectValid: false, case: noReasoningEvidence },
    { id: drift.id, name: "LLM field drift", kind: "drift", expectValid: true, case: drift }
  ];
}
