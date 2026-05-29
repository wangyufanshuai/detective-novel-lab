export type Provider = "deepseek" | "siliconflow";

export type Character = {
  id: string;
  name: string;
  role: string;
  publicBio: string;
  secret: string;
  motive: string;
  means: string;
  opportunity: string;
  isCulprit: boolean;
  alibi: string;
  initialStatement: string;
  knowledgeScope: string[];
  liePolicy: string;
  contradictionTriggers: string[];
};

export type Evidence = {
  id: string;
  title: string;
  location: string;
  visibleDescription: string;
  trueMeaning: string;
  relatedCharacterIds: string[];
  relatedTime?: string;
  discoverable: boolean;
  isKey: boolean;
  unlocks: string[];
  contradicts: string[];
  supportsConclusion: string[];
  discoveryDifficulty: "easy" | "medium" | "hard";
};

export type Scene = {
  id: string;
  name: string;
  description: string;
  evidenceIds: string[];
};

export type TimelineEvent = {
  id: string;
  time: string;
  event: string;
  characterIds: string[];
  isPublic: boolean;
  source: string;
  publicVersion: string;
  contradictedByEvidenceIds: string[];
};

export type Relationship = {
  from: string;
  to: string;
  label: string;
};

export type CaseTruth = {
  culpritId: string;
  motive: string;
  method: string;
  opportunity: string;
  decisiveEvidenceIds: string[];
  trueTimeline: TimelineEvent[];
};

export type SuspectMatrixRow = {
  characterId: string;
  name: string;
  motive: boolean;
  means: boolean;
  opportunity: boolean;
  excludedByEvidenceIds: string[];
  completeAndUnexcluded: boolean;
  isCulprit: boolean;
};

export type ExclusionChain = {
  characterId: string;
  reason: string;
  evidenceIds: string[];
};

export type ReasoningStep = {
  id: string;
  conclusion: string;
  evidenceIds: string[];
};

export type LogicPuzzle = {
  suspectMatrix: SuspectMatrixRow[];
  exclusionChains: ExclusionChain[];
  criticalReasoningChain: ReasoningStep[];
  redHerrings: string[];
  requiredClueOrder: string[];
};

export type DeductionCase = {
  id: string;
  title: string;
  theme: string;
  premise: string;
  publicCaseFile: string;
  truth: CaseTruth;
  characters: Character[];
  evidence: Evidence[];
  scenes: Scene[];
  relationships: Relationship[];
  logicPuzzle: LogicPuzzle;
};

export type PlayerTheory = {
  culpritId: string;
  motive: string;
  method: string;
  evidenceIds: string[];
};

export type TimelineContradiction = {
  eventId: string;
  time: string;
  publicVersion: string;
  trueEvent: string;
  evidenceIds: string[];
  revealed: boolean;
};

export type ReasoningCoverage = {
  requiredEvidenceIds: string[];
  coveredEvidenceIds: string[];
  missingEvidenceIds: string[];
  coverageRatio: number;
};

export type RuleReport = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  issues: string[];
  suspectMatrix: SuspectMatrixRow[];
  timelineContradictions: TimelineContradiction[];
  reasoningCoverage: ReasoningCoverage;
  fixSuggestions: string[];
};

export type CaseValidation = RuleReport;

export type Judgement = {
  accepted: boolean;
  score: number;
  missing: string[];
  contradictions: string[];
  explanation: string;
};

export type EvidenceChallenge = {
  hit: boolean;
  characterId: string;
  evidenceId: string;
  exposedContradictions: string[];
  guidance: string;
};

const emptyWords = new Set(["无", "没有", "未知", "不适用", "none", "no", ""]);

export function normalizeId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hasContent(value?: string) {
  const text = (value || "").trim().toLowerCase();
  return Boolean(text) && !emptyWords.has(text);
}

function textHits(userText: string, targetText: string) {
  const user = userText.trim();
  const target = targetText.trim();
  if (!user || !target) return false;
  if (user.length <= 6) return target.includes(user);
  return user.includes(target.slice(0, 8)) || target.includes(user.slice(0, 8));
}

function axisValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (["true", "yes", "有", "高", "强", "完整", "成立"].includes(text)) return true;
    if (["false", "no", "无", "低", "弱", "没有", "不成立"].includes(text)) return false;
  }
  return fallback;
}

function aliases(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") return [value];
  return [];
}

function evidenceMap(deductionCase: DeductionCase) {
  return new Map((deductionCase.evidence || []).map((item) => [item.id, item]));
}

function characterMap(deductionCase: DeductionCase) {
  return new Map((deductionCase.characters || []).map((item) => [item.id, item]));
}

function resolveCharacterId(deductionCase: DeductionCase, value: unknown) {
  if (typeof value !== "string") return "";
  if (deductionCase.characters.some((item) => item.id === value)) return value;
  return deductionCase.characters.find((item) => item.name === value)?.id || value;
}

function resolveEvidenceIds(deductionCase: DeductionCase, value: unknown) {
  const known = deductionCase.evidence || [];
  return aliases(value).map((raw) => known.find((item) => item.id === raw || item.title === raw)?.id || raw);
}

function evidenceIdsFromText(deductionCase: DeductionCase, text: string) {
  const hits = new Set<string>();
  for (const evidence of deductionCase.evidence || []) {
    if (text.includes(evidence.id) || text.includes(evidence.title)) {
      hits.add(evidence.id);
    }
    const short = evidence.id.match(/(?:^|[_-])([A-Z]?\d+)$/i)?.[1];
    if (short && new RegExp(`\\b${short}\\b`, "i").test(text)) {
      hits.add(evidence.id);
    }
  }
  return Array.from(hits);
}

function getReasoningStepEvidenceIds(deductionCase: DeductionCase, step: ReasoningStep | string | unknown) {
  if (typeof step === "string") return evidenceIdsFromText(deductionCase, step);
  const raw = (step || {}) as Record<string, unknown>;
  return resolveEvidenceIds(deductionCase, raw.evidenceIds || raw.evidence || raw.keyEvidence);
}

export function createFallbackCase(topic = "校园天文台死亡留言"): DeductionCase {
  return {
    id: "showcase-north-star",
    title: "北极星不在天上",
    theme: topic,
    premise:
      "校庆前夜，暴雨封山。天体物理教授林远舟死在圆顶观测室，门禁显示案发时段无人进入。死者手边留下半张圈出北极星的星图。",
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

export function deriveSuspectMatrix(deductionCase: DeductionCase): SuspectMatrixRow[] {
  const existing = Array.isArray(deductionCase.logicPuzzle?.suspectMatrix) ? deductionCase.logicPuzzle.suspectMatrix : [];
  const evidenceIds = new Set((deductionCase.evidence || []).map((item) => item.id));
  const exclusionByCharacter = new Map<string, string[]>();
  const exclusionChains = Array.isArray(deductionCase.logicPuzzle?.exclusionChains) ? deductionCase.logicPuzzle.exclusionChains : [];

  for (const chain of exclusionChains) {
    const raw = chain as unknown as Record<string, unknown>;
    const characterId = resolveCharacterId(deductionCase, chain.characterId || raw.suspectId || raw.suspect || raw.character);
    const ids = resolveEvidenceIds(deductionCase, chain.evidenceIds || raw.evidence).filter((id) => evidenceIds.has(id));
    if (characterId && ids.length) {
      exclusionByCharacter.set(characterId, Array.from(new Set([...(exclusionByCharacter.get(characterId) || []), ...ids])));
    }
  }

  return (deductionCase.characters || [])
    .filter((character) => character.id !== "detective" && character.id !== "victim")
    .map((character) => {
      const declared = existing.find((row) => {
        const raw = row as unknown as Record<string, unknown>;
        return row.characterId === character.id || raw.suspect === character.id || raw.suspect === character.name || raw.name === character.name;
      });
      const raw = (declared || {}) as unknown as Record<string, unknown>;
      const declaredExclusions = resolveEvidenceIds(deductionCase, declared?.excludedByEvidenceIds || raw.excludedBy || raw.exclusionEvidenceIds).filter((id) => evidenceIds.has(id));
      const excludedByEvidenceIds = declaredExclusions.length ? declaredExclusions : exclusionByCharacter.get(character.id) || [];
      const motive = axisValue(declared?.motive, hasContent(character.motive));
      const means = axisValue(declared?.means, hasContent(character.means));
      const opportunity = axisValue(declared?.opportunity, hasContent(character.opportunity));

      return {
        characterId: character.id,
        name: character.name,
        motive,
        means,
        opportunity,
        excludedByEvidenceIds,
        completeAndUnexcluded: motive && means && opportunity && excludedByEvidenceIds.length === 0,
        isCulprit: character.isCulprit
      };
    });
}

export function getTimelineContradictions(deductionCase: DeductionCase, discoveredEvidenceIds: string[] = []): TimelineContradiction[] {
  const discovered = new Set(discoveredEvidenceIds);
  return (deductionCase.truth?.trueTimeline || [])
    .filter((event) => event.publicVersion && event.contradictedByEvidenceIds?.length)
    .map((event) => ({
      eventId: event.id,
      time: event.time,
      publicVersion: event.publicVersion,
      trueEvent: event.event,
      evidenceIds: event.contradictedByEvidenceIds,
      revealed: event.contradictedByEvidenceIds.some((id) => discovered.has(id))
    }));
}

export function getReasoningCoverage(deductionCase: DeductionCase, selectedEvidenceIds: string[] = []): ReasoningCoverage {
  const required = new Set<string>();
  for (const id of deductionCase.truth?.decisiveEvidenceIds || []) required.add(id);
  const chain = Array.isArray(deductionCase.logicPuzzle?.criticalReasoningChain) ? deductionCase.logicPuzzle.criticalReasoningChain : [];
  for (const step of chain) {
    for (const id of getReasoningStepEvidenceIds(deductionCase, step)) required.add(id);
  }
  const selected = new Set(selectedEvidenceIds);
  const requiredEvidenceIds = Array.from(required);
  const coveredEvidenceIds = requiredEvidenceIds.filter((id) => selected.has(id));
  const missingEvidenceIds = requiredEvidenceIds.filter((id) => !selected.has(id));
  return {
    requiredEvidenceIds,
    coveredEvidenceIds,
    missingEvidenceIds,
    coverageRatio: requiredEvidenceIds.length ? coveredEvidenceIds.length / requiredEvidenceIds.length : 1
  };
}

export function validateCase(deductionCase: DeductionCase): CaseValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixSuggestions: string[] = [];
  const characters = characterMap(deductionCase);
  const evidence = evidenceMap(deductionCase);
  const culpritFlags = (deductionCase.characters || []).filter((character) => character.isCulprit);

  if (culpritFlags.length !== 1) {
    errors.push(`凶手字段必须唯一，当前为 ${culpritFlags.length} 个。`);
    fixSuggestions.push("确保 characters 中只有一个 isCulprit=true。");
  }

  const culprit = characters.get(deductionCase.truth?.culpritId);
  if (!culprit) {
    errors.push("truth.culpritId 必须对应一个人物。");
  } else if (!culprit.isCulprit) {
    errors.push("truth.culpritId 对应人物必须标记 isCulprit=true。");
  }

  const decisive = deductionCase.truth?.decisiveEvidenceIds || [];
  const missingDecisive = decisive.filter((id) => !evidence.has(id));
  if (missingDecisive.length) {
    errors.push(`关键证据不存在：${missingDecisive.join(", ")}。`);
  }

  const undiscoverableDecisive = decisive.filter((id) => evidence.has(id) && !evidence.get(id)?.discoverable);
  if (undiscoverableDecisive.length) {
    errors.push(`关键证据必须可发现：${undiscoverableDecisive.join(", ")}。`);
  }

  const discoverableKey = (deductionCase.evidence || []).filter((item) => item.isKey && item.discoverable);
  if (discoverableKey.length < 3) {
    errors.push("至少需要 3 条可发现关键证据。");
  }

  for (const scene of deductionCase.scenes || []) {
    for (const id of scene.evidenceIds || []) {
      if (!evidence.has(id)) {
        errors.push(`场景“${scene.name}”引用了不存在的证据 ${id}。`);
      }
    }
  }

  const suspectMatrix = deriveSuspectMatrix(deductionCase);
  const complete = suspectMatrix.filter((row) => row.completeAndUnexcluded);
  if (complete.length !== 1 || complete[0]?.characterId !== deductionCase.truth?.culpritId) {
    errors.push("规则矩阵必须只留下一个完整且未被反证排除的嫌疑人，并且必须是 truth.culpritId。");
    fixSuggestions.push("为每个非凶手补充排除证据，或降低其 motive/means/opportunity 中至少一项。");
  }

  for (const row of suspectMatrix) {
    if (!row.isCulprit && row.motive && row.means && row.opportunity && row.excludedByEvidenceIds.length === 0) {
      errors.push(`非凶手“${row.name}”具备动机/手段/机会，但缺少可发现排除证据。`);
    }
  }

  const exclusionChains = Array.isArray(deductionCase.logicPuzzle?.exclusionChains) ? deductionCase.logicPuzzle.exclusionChains : [];
  for (const chain of exclusionChains) {
    const raw = chain as unknown as Record<string, unknown>;
    const characterId = resolveCharacterId(deductionCase, chain.characterId || raw.suspectId || raw.suspect || raw.character);
    const ids = resolveEvidenceIds(deductionCase, chain.evidenceIds || raw.evidence);
    if (!characters.has(characterId)) errors.push(`排除链引用了不存在的人物 ${characterId || "undefined"}。`);
    if (!ids.length) errors.push(`排除链 ${characterId || "undefined"} 缺少证据。`);
    for (const id of ids) {
      if (!evidence.has(id) || !evidence.get(id)?.discoverable) {
        errors.push(`排除链 ${characterId} 使用了不可发现或不存在的证据 ${id}。`);
      }
    }
  }

  const criticalReasoningChain = Array.isArray(deductionCase.logicPuzzle?.criticalReasoningChain) ? deductionCase.logicPuzzle.criticalReasoningChain : [];
  for (const step of criticalReasoningChain) {
    const raw = (step || {}) as Record<string, unknown>;
    const conclusion = typeof step === "string" ? step : String(raw.conclusion || raw.step || raw.reason || "未命名推理");
    const ids = getReasoningStepEvidenceIds(deductionCase, step);
    if (!ids.length) errors.push(`关键推理“${conclusion}”缺少证据支撑。`);
    for (const id of ids) {
      if (!evidence.has(id) || !evidence.get(id)?.discoverable) {
        errors.push(`关键推理“${conclusion}”依赖不可发现或不存在的证据 ${id}。`);
      }
    }
  }

  const timelineContradictions = getTimelineContradictions(deductionCase);
  if (!deductionCase.truth?.trueTimeline?.length) errors.push("真实时间线不能为空。");
  if (!timelineContradictions.length) errors.push("至少需要一处证词/公开版本与证据可揭示的时间线矛盾。");

  const reasoningCoverage = getReasoningCoverage(deductionCase);
  if (reasoningCoverage.requiredEvidenceIds.length < 3) {
    warnings.push("关键推理链较短，建议至少覆盖 3 条证据。");
  }
  if ((deductionCase.logicPuzzle?.redHerrings || []).length < 2) {
    warnings.push("误导线索偏少，展示效果会弱。");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    issues: errors,
    suspectMatrix,
    timelineContradictions,
    reasoningCoverage,
    fixSuggestions
  };
}

export function evaluateEvidenceChallenge(deductionCase: DeductionCase, characterId: string, evidenceId: string): EvidenceChallenge {
  const character = characterMap(deductionCase).get(characterId);
  const evidence = evidenceMap(deductionCase).get(evidenceId);
  const exposedContradictions = getTimelineContradictions(deductionCase, [evidenceId])
    .filter((item) => item.revealed)
    .map((item) => item.eventId);
  const hit =
    Boolean(character && evidence) &&
    (evidence!.relatedCharacterIds.includes(characterId) ||
      evidence!.contradicts.includes(characterId) ||
      character!.contradictionTriggers.includes(evidenceId) ||
      exposedContradictions.length > 0);

  return {
    hit,
    characterId,
    evidenceId,
    exposedContradictions,
    guidance: hit
      ? "证据命中该角色的矛盾。回答应表现为回避、局部承认或被迫修正证词，但不能直接泄露完整真相。"
      : "证据没有直接命中该角色。回答应保持角色知识范围，只给有限信息。"
  };
}

export function evidenceByScene(deductionCase: DeductionCase, sceneId: string) {
  const scene = deductionCase.scenes.find((item) => item.id === sceneId);
  if (!scene) return [];
  const ids = new Set(scene.evidenceIds);
  return deductionCase.evidence.filter((item) => ids.has(item.id) && item.discoverable);
}

export function judgeTheory(deductionCase: DeductionCase, theory: PlayerTheory, discoveredEvidenceIds: string[]): Judgement {
  const missing: string[] = [];
  const contradictions: string[] = [];
  const discovered = new Set(discoveredEvidenceIds);
  const selected = new Set(theory.evidenceIds);
  const decisive = deductionCase.truth.decisiveEvidenceIds || [];

  if (theory.culpritId !== deductionCase.truth.culpritId) contradictions.push("指认的凶手与真相不符。");

  if (!theory.motive.trim()) missing.push("缺少动机说明。");
  else if (!textHits(theory.motive, deductionCase.truth.motive)) missing.push("动机说明没有覆盖真相中的核心动机。");

  if (!theory.method.trim()) missing.push("缺少手法说明。");
  else if (!textHits(theory.method, deductionCase.truth.method)) missing.push("手法说明没有覆盖真相中的核心作案机制。");

  for (const id of decisive) {
    if (!discovered.has(id)) missing.push(`尚未发现关键证据：${id}`);
    if (!selected.has(id)) missing.push(`推理链缺少关键证据：${id}`);
  }

  const matrix = deriveSuspectMatrix(deductionCase);
  for (const row of matrix.filter((item) => !item.isCulprit)) {
    if (row.excludedByEvidenceIds.length && !row.excludedByEvidenceIds.some((id) => selected.has(id) && discovered.has(id))) {
      missing.push(`缺少排除嫌疑人“${row.name}”的证据。`);
    }
  }

  const motiveHit = textHits(theory.motive, deductionCase.truth.motive);
  const methodHit = textHits(theory.method, deductionCase.truth.method);
  const coveredDecisive = decisive.filter((id) => selected.has(id) && discovered.has(id)).length;
  const excludedRows = matrix.filter((row) => !row.isCulprit && row.excludedByEvidenceIds.some((id) => selected.has(id) && discovered.has(id))).length;
  const nonCulprits = matrix.filter((row) => !row.isCulprit).length;

  const score =
    (theory.culpritId === deductionCase.truth.culpritId ? 30 : 0) +
    (motiveHit ? 18 : 0) +
    (methodHit ? 18 : 0) +
    Math.round((coveredDecisive / Math.max(decisive.length, 1)) * 24) +
    Math.round((excludedRows / Math.max(nonCulprits, 1)) * 10);

  const accepted = score >= 90 && contradictions.length === 0 && missing.length === 0;

  return {
    accepted,
    score,
    missing: Array.from(new Set(missing)),
    contradictions,
    explanation: accepted
      ? "推理成立：凶手、动机、手法、关键证据和排除链均闭合。"
      : "推理尚不成立：需要补齐凶手指认、动机、手法、关键证据或排除其他嫌疑人的证据链。"
  };
}
