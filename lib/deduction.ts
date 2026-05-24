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
};

export type Scene = {
  id: string;
  name: string;
  description: string;
  evidenceIds: string[];
};

export type TimelineEvent = {
  time: string;
  event: string;
  characterIds: string[];
  isPublic: boolean;
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
};

export type PlayerTheory = {
  culpritId: string;
  motive: string;
  method: string;
  evidenceIds: string[];
};

export type SuspectMatrixRow = {
  characterId: string;
  name: string;
  motive: boolean;
  means: boolean;
  opportunity: boolean;
  isCulprit: boolean;
};

export type CaseValidation = {
  valid: boolean;
  issues: string[];
  suspectMatrix: SuspectMatrixRow[];
};

export type Judgement = {
  accepted: boolean;
  score: number;
  missing: string[];
  contradictions: string[];
  explanation: string;
};

export function normalizeId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createFallbackCase(topic: string): DeductionCase {
  const id = `case-${Date.now()}`;
  return {
    id,
    title: "北极星不在天上",
    theme: topic || "校园天文台死亡留言",
    premise:
      "暴雨夜，大学天文台教授死在圆顶观测室。死者留下圈出北极星的半张星图，但当晚根本看不见星空。",
    publicCaseFile:
      "校庆前夜，天文台教授林远舟死在圆顶观测室。监控显示案发时段无人进入，死者手边有半张圈出北极星的星图。玩家需要询问嫌疑人、搜索天文台场景，并解释死亡留言的真实含义。",
    truth: {
      culpritId: "assistant",
      motive: "教授助理担心伪造观测数据和经费挪用被教授在校庆演讲中公开。",
      method: "利用备用电源短暂停摆制造监控盲区，移动望远镜指向固定基座编号，让死亡留言指向助理常用的固定工位。",
      opportunity: "助理掌握观测室维护钥匙，并在停电检修记录中制造了短暂空档。",
      decisiveEvidenceIds: ["e-star-map", "e-power-log", "e-telescope-base"],
      trueTimeline: [
        { time: "20:10", event: "助理以检查备用电源为由进入控制室。", characterIds: ["assistant"], isPublic: false },
        { time: "20:18", event: "备用电源短暂停摆，监控缺失四分钟。", characterIds: ["assistant"], isPublic: true },
        { time: "20:20", event: "教授在圆顶观测室遇害。", characterIds: ["victim", "assistant"], isPublic: false },
        { time: "20:24", event: "望远镜被转向北极星校准基座，制造死亡留言。", characterIds: ["assistant"], isPublic: false }
      ]
    },
    characters: [
      {
        id: "detective",
        name: "沈砚",
        role: "玩家协助的逻辑学讲师",
        publicBio: "校庆临时受邀参加天文台开放夜。",
        secret: "无",
        motive: "无",
        means: "无",
        opportunity: "无",
        isCulprit: false,
        alibi: "案发时在山下礼堂。",
        initialStatement: "死亡留言如果指向天体，就必须先解释为什么雨夜能看见星。"
      },
      {
        id: "assistant",
        name: "陆青",
        role: "教授助理",
        publicBio: "负责观测日志和仪器维护。",
        secret: "长期篡改观测数据。",
        motive: "担心教授公开造假和经费问题。",
        means: "熟悉备用电源和观测室钥匙。",
        opportunity: "案发时能进入控制室并制造监控空档。",
        isCulprit: true,
        alibi: "声称一直在档案室整理星图。",
        initialStatement: "林教授今晚只关心校庆演讲，我不知道他为什么会去观测室。"
      },
      {
        id: "rival",
        name: "周衡",
        role: "竞争教授",
        publicBio: "与死者争夺重点项目。",
        secret: "曾举报死者论文问题。",
        motive: "项目竞争",
        means: "无维护权限",
        opportunity: "案发时在会议室与多人争论。",
        isCulprit: false,
        alibi: "有两名学生证明。",
        initialStatement: "我讨厌林远舟，但不会在校庆前夜毁掉整个学院。"
      },
      {
        id: "admin",
        name: "何岚",
        role: "仪器管理员",
        publicBio: "掌管望远镜和圆顶机械维护。",
        secret: "隐瞒过一次设备事故。",
        motive: "害怕追责",
        means: "懂仪器",
        opportunity: "案发前离开天文台去取备件。",
        isCulprit: false,
        alibi: "维修车记录可查。",
        initialStatement: "望远镜指向北极星不奇怪，奇怪的是雨夜没人需要校准。"
      }
    ],
    evidence: [
      {
        id: "e-star-map",
        title: "半张星图",
        location: "dome",
        visibleDescription: "红笔圈出北极星，旁边写着“这里不动”。",
        trueMeaning: "提示固定参照物，而非真实星空。",
        relatedCharacterIds: ["assistant"],
        relatedTime: "20:24",
        discoverable: true,
        isKey: true
      },
      {
        id: "e-power-log",
        title: "备用电源日志",
        location: "control",
        visibleDescription: "20:18 出现四分钟电源切换记录。",
        trueMeaning: "监控缺口不是故障，而是人为制造。",
        relatedCharacterIds: ["assistant"],
        relatedTime: "20:18",
        discoverable: true,
        isKey: true
      },
      {
        id: "e-telescope-base",
        title: "望远镜基座编号",
        location: "dome",
        visibleDescription: "望远镜没有指向天空，而是停在北侧固定校准刻度。",
        trueMeaning: "北极星指代“固定不动的位置”。",
        relatedCharacterIds: ["assistant", "admin"],
        relatedTime: "20:24",
        discoverable: true,
        isKey: true
      },
      {
        id: "e-archive-dust",
        title: "档案室灰尘",
        location: "archive",
        visibleDescription: "陆青声称整理过的星图盒没有新近翻动痕迹。",
        trueMeaning: "陆青的不在场证明虚假。",
        relatedCharacterIds: ["assistant"],
        discoverable: true,
        isKey: false
      }
    ],
    scenes: [
      { id: "dome", name: "圆顶观测室", description: "教授死亡地点，望远镜停在异常角度。", evidenceIds: ["e-star-map", "e-telescope-base"] },
      { id: "control", name: "控制室", description: "监控和备用电源记录所在地。", evidenceIds: ["e-power-log"] },
      { id: "archive", name: "星图档案室", description: "嫌疑人声称的不在场地点。", evidenceIds: ["e-archive-dust"] }
    ],
    relationships: [
      { from: "assistant", to: "victim", label: "助理/教授" },
      { from: "rival", to: "victim", label: "项目竞争" },
      { from: "admin", to: "victim", label: "设备维护" }
    ]
  };
}

export function validateCase(deductionCase: DeductionCase): CaseValidation {
  const issues: string[] = [];
  const culprits = deductionCase.characters.filter((character) => character.isCulprit);

  if (culprits.length !== 1) {
    issues.push(`凶手数量必须唯一，当前为 ${culprits.length}。`);
  }

  if (!deductionCase.truth.culpritId || !deductionCase.characters.some((character) => character.id === deductionCase.truth.culpritId)) {
    issues.push("真相结构中的 culpritId 必须对应一个人物。");
  }

  const evidenceIds = new Set(deductionCase.evidence.map((evidence) => evidence.id));
  const decisive = deductionCase.truth.decisiveEvidenceIds || [];
  const missingEvidence = decisive.filter((id) => !evidenceIds.has(id));
  if (missingEvidence.length > 0) {
    issues.push(`关键证据不存在：${missingEvidence.join(", ")}。`);
  }

  const discoverableKeyEvidence = deductionCase.evidence.filter((evidence) => evidence.isKey && evidence.discoverable);
  if (discoverableKeyEvidence.length < 3) {
    issues.push("至少需要 3 个可发现关键线索。");
  }

  for (const scene of deductionCase.scenes) {
    for (const evidenceId of scene.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        issues.push(`场景「${scene.name}」引用了不存在的证据 ${evidenceId}。`);
      }
    }
  }

  if (!deductionCase.truth.trueTimeline?.length) {
    issues.push("真实时间线不能为空。");
  }

  const suspectMatrix = deductionCase.characters
    .filter((character) => character.id !== "detective")
    .map((character) => ({
      characterId: character.id,
      name: character.name,
      motive: Boolean(character.motive && character.motive !== "无"),
      means: Boolean(character.means && character.means !== "无"),
      opportunity: Boolean(character.opportunity && character.opportunity !== "无"),
      isCulprit: character.isCulprit
    }));

  const fullSuspects = suspectMatrix.filter((row) => row.motive && row.means && row.opportunity);
  if (fullSuspects.filter((row) => row.isCulprit).length !== 1) {
    issues.push("机会/手段/动机矩阵必须能支持唯一真凶。");
  }

  return {
    valid: issues.length === 0,
    issues,
    suspectMatrix
  };
}

export function judgeTheory(deductionCase: DeductionCase, theory: PlayerTheory, discoveredEvidenceIds: string[]): Judgement {
  const missing: string[] = [];
  const contradictions: string[] = [];
  const discovered = new Set(discoveredEvidenceIds);
  const decisive = deductionCase.truth.decisiveEvidenceIds;
  const selected = new Set(theory.evidenceIds);

  if (theory.culpritId !== deductionCase.truth.culpritId) {
    contradictions.push("指认的凶手与真相不符。");
  }

  if (!theory.motive.trim()) {
    missing.push("缺少动机说明。");
  }

  if (!theory.method.trim()) {
    missing.push("缺少作案手法说明。");
  }

  for (const evidenceId of decisive) {
    if (!selected.has(evidenceId)) {
      missing.push(`缺少关键证据：${evidenceId}`);
    }
    if (!discovered.has(evidenceId)) {
      missing.push(`尚未发现关键证据：${evidenceId}`);
    }
  }

  const motiveHit =
    theory.motive.includes(deductionCase.truth.motive.slice(0, 6)) ||
    deductionCase.truth.motive.includes(theory.motive.trim().slice(0, 6));
  const methodHit =
    theory.method.includes(deductionCase.truth.method.slice(0, 6)) ||
    deductionCase.truth.method.includes(theory.method.trim().slice(0, 6));

  if (!motiveHit) {
    missing.push("动机解释没有覆盖真相中的核心动机。");
  }

  if (!methodHit) {
    missing.push("手法解释没有覆盖真相中的核心作案机制。");
  }

  const coveredEvidence = decisive.filter((id) => selected.has(id) && discovered.has(id)).length;
  const score =
    (theory.culpritId === deductionCase.truth.culpritId ? 35 : 0) +
    (motiveHit ? 20 : 0) +
    (methodHit ? 20 : 0) +
    Math.round((coveredEvidence / Math.max(decisive.length, 1)) * 25);

  const accepted = score >= 85 && contradictions.length === 0 && missing.length === 0;

  return {
    accepted,
    score,
    missing: Array.from(new Set(missing)),
    contradictions,
    explanation: accepted
      ? "推理成立：凶手、动机、手法和关键证据链均闭合。"
      : "推理尚不成立：需要补齐凶手指认、动机、手法或关键证据链。"
  };
}

export function evidenceByScene(deductionCase: DeductionCase, sceneId: string) {
  const scene = deductionCase.scenes.find((item) => item.id === sceneId);
  if (!scene) return [];
  const ids = new Set(scene.evidenceIds);
  return deductionCase.evidence.filter((item) => ids.has(item.id) && item.discoverable);
}
