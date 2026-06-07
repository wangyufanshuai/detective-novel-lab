import {
  buildNpcKnowledgeContext,
  type CaseFromLog,
  type DeductionCase,
  type DialogueSafetyFlag,
  type NpcDialogueEvalReport,
  type PlayerSession,
  type PromptAuditReport,
  type RevealContractHit,
  type RevealContractMiss,
  type RevealEvalReport,
  type RevealFactContract,
  type WorldEvent,
  type WorldState
} from "@/lib/engine";

type Provider = "deepseek" | "siliconflow" | "mock";

const providerConfig = {
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash"
  },
  siliconflow: {
    apiKey: process.env.SILICONFLOW_API_KEY,
    baseUrl: process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1",
    model: process.env.SILICONFLOW_MODEL || "deepseek-ai/DeepSeek-V3.2-Exp"
  },
  mock: {
    apiKey: "",
    baseUrl: "",
    model: "rule-bound-mock"
  }
};

export function getAiModelName(provider: Provider = ((process.env.AI_PROVIDER as Provider) || "deepseek")) {
  return (providerConfig[provider] || providerConfig.deepseek).model;
}

function compactKeywords(text: string, limit = 5) {
  const normalized = text.replace(/[，。；：、,.!?！？\s()[\]（）【】"“”'‘’]/g, " ");
  return Array.from(new Set(normalized.split(" ").map((part) => part.trim()).filter((part) => part.length >= 4))).slice(0, limit);
}

export function buildRevealFactContract(caseFromLog: CaseFromLog): RevealFactContract {
  const truth = caseFromLog.deductionCase.truth;
  const culprit = caseFromLog.deductionCase.characters.find((item) => item.id === truth.culpritId);
  return {
    sourceLocked: true,
    culprit: {
      id: truth.culpritId,
      name: culprit?.name || truth.culpritId
    },
    motive: {
      text: truth.motive,
      keywords: compactKeywords(truth.motive)
    },
    method: {
      text: truth.method,
      keywords: compactKeywords(truth.method, 8)
    },
    decisiveEvidence: caseFromLog.deductionCase.evidence
      .filter((item) => truth.decisiveEvidenceIds.includes(item.id))
      .map((item) => ({ id: item.id, title: item.title })),
    sourceEventIds: caseFromLog.sourceEventIds.slice(0, 8)
  };
}

function buildFactLockLines(contract: RevealFactContract) {
  return [
    "FACT_LOCK_BEGIN",
    `culprit=${contract.culprit.id}|${contract.culprit.name}`,
    `motive_text=${contract.motive.text}`,
    `method_text=${contract.method.text}`,
    `evidence_ids=${contract.decisiveEvidence.map((item) => item.id).join(",")}`,
    `source_event_ids=${contract.sourceEventIds.slice(0, 4).join(",")}`,
    "FACT_LOCK_END"
  ];
}

export function buildGuardedNpcPromptPayload(input: {
  context: ReturnType<typeof buildNpcKnowledgeContext>;
  evidence?: DeductionCase["evidence"][number];
  question: string;
}) {
  const context = input.context;
  return {
    character: context.character
      ? {
          id: context.character.id,
          name: context.character.name,
          role: context.character.role,
          publicBio: context.character.publicBio,
          liePolicy: context.character.liePolicy,
          initialStatement: context.character.initialStatement
        }
      : null,
    visibleMemories: context.visibleMemories.map((memory) => ({
      day: memory.day,
      kind: memory.kind,
      confidence: memory.confidence,
      summary: memory.summary
    })),
    visibleEvidence: context.visibleEvidence.map((item) => ({
      id: item.id,
      title: item.title,
      visibleDescription: item.visibleDescription
    })),
    challengedEvidence: input.evidence
      ? {
          id: input.evidence.id,
          title: input.evidence.title,
          visibleDescription: input.evidence.visibleDescription
        }
      : null,
    playerQuestion: input.question,
    outputRule: "Use first-person Chinese, 80-160 Chinese characters. Only answer from this NPC's visible memory/evidence scope."
  };
}

export function auditPromptPayload(payload: unknown, caseFromLog?: CaseFromLog, characterId?: string): PromptAuditReport {
  const text = JSON.stringify(payload);
  const forbiddenFieldHits = ["truth", "culpritId", "trueTimeline", "decisiveEvidenceIds", "generationProfile", "sourceMap"].filter((field) =>
    text.includes(field)
  );
  const truth = caseFromLog?.deductionCase.truth;
  if (truth?.culpritId && truth.culpritId !== characterId && text.includes(truth.culpritId)) forbiddenFieldHits.push("truth.culpritId.value");
  if (truth?.method && text.includes(truth.method)) forbiddenFieldHits.push("truth.method.value");

  const memoryEventIds = new Set(
    typeof payload === "object" && payload && "visibleMemories" in payload
      ? ((payload as { visibleMemories?: Array<{ eventId: string }> }).visibleMemories || []).map((memory) => memory.eventId)
      : []
  );
  const hiddenEventLeakCount = caseFromLog
    ? caseFromLog.deductionCase.truth.trueTimeline.filter(
        (event) =>
          event.characterIds.includes(characterId || "") === false && !memoryEventIds.has(event.id) && (text.includes(event.id) || text.includes(event.event))
      ).length
    : 0;
  const memoryCount =
    typeof payload === "object" && payload && "visibleMemories" in payload
      ? ((payload as { visibleMemories?: unknown[] }).visibleMemories || []).length
      : 0;
  const evidenceCount =
    typeof payload === "object" && payload && "visibleEvidence" in payload
      ? ((payload as { visibleEvidence?: unknown[] }).visibleEvidence || []).length
      : 0;
  const containsForbiddenTruth = forbiddenFieldHits.length > 0 || hiddenEventLeakCount > 0;
  return {
    memoryCount,
    evidenceCount,
    forbiddenFieldHits: Array.from(new Set(forbiddenFieldHits)),
    containsForbiddenTruth,
    hiddenEventLeakCount,
    safe: !containsForbiddenTruth
  };
}

function redactForbiddenTruthFromPrompt<T>(payload: T, caseFromLog: CaseFromLog): T {
  const method = caseFromLog.deductionCase.truth.method;
  const culpritId = caseFromLog.deductionCase.truth.culpritId;
  const culpritName = caseFromLog.deductionCase.characters.find((item) => item.id === culpritId)?.name || "";
  const redactString = (value: string) =>
    value
      .replaceAll(method, "案发核心手法细节（已隐藏，NPC 只能回避或承认局部矛盾）")
      .replaceAll(`凶手是${culpritName}`, "有人被怀疑")
      .replaceAll(`凶手是 ${culpritName}`, "有人被怀疑");
  const visit = (value: unknown): unknown => {
    if (typeof value === "string") return redactString(value);
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item)]));
    return value;
  };
  return visit(payload) as T;
}

export function evaluateNpcDialogue(input: {
  answer: string;
  caseFromLog: CaseFromLog;
  characterId: string;
  evidenceId?: string;
  promptAudit: PromptAuditReport;
  revealed?: boolean;
}): NpcDialogueEvalReport {
  const answer = input.answer || "";
  const flags: DialogueSafetyFlag[] = [];
  const truth = input.caseFromLog.deductionCase.truth;
  const culprit = input.caseFromLog.deductionCase.characters.find((item) => item.id === truth.culpritId);
  const mentionsCulprit = Boolean(
    answer && input.characterId !== truth.culpritId && (answer.includes(truth.culpritId) || (culprit?.name && answer.includes(culprit.name)))
  );
  const mentionsHiddenMethod = Boolean(truth.method && answer.includes(truth.method));
  const challengeCues = ["证据", "矛盾", "确实", "修正", "记错", "隐瞒", "不完整", "解释", "核实", "可疑", "对得上", "记录", "证明", "粉末", "鞋印", "痕迹", "登记", "承认", "challenge", "evidence"];
  const acknowledgesChallenge = input.evidenceId ? challengeCues.some((cue) => answer.includes(cue)) : true;
  const referencesVisibleMemory = input.promptAudit.memoryCount > 0 ? answer.trim().length > 0 : true;

  if (!input.promptAudit.safe) flags.push("prompt_contains_forbidden_truth");
  if (!answer.trim()) flags.push("answer_unavailable_model");
  if (!input.revealed && mentionsCulprit) flags.push("answer_mentions_culprit_before_reveal");
  if (!input.revealed && mentionsHiddenMethod) flags.push("answer_mentions_hidden_method");
  if (!referencesVisibleMemory) flags.push("answer_ignores_memory_scope");
  if (!acknowledgesChallenge) flags.push("answer_misses_evidence_challenge");

  return {
    score: Math.max(0, 100 - flags.length * 20),
    safetyFlags: Array.from(new Set(flags)),
    mentionsCulprit,
    mentionsHiddenMethod,
    referencesVisibleMemory,
    acknowledgesChallenge,
    answerLength: answer.length
  };
}

function buildRuleSafeNpcFallback(input: {
  context: ReturnType<typeof buildNpcKnowledgeContext>;
  evidence?: DeductionCase["evidence"][number];
  evidenceId?: string;
}) {
  const name = input.context.character?.name || "NPC";
  const memoryLine = input.context.visibleMemories.length
    ? `I have ${input.context.visibleMemories.length} visible memory record(s) related to my own actions or direct observations.`
    : "I do not have a direct visible memory for that detail.";
  if (input.evidenceId) {
    return `${name}: This evidence record does affect my earlier statement. ${memoryLine} I can revise only my own testimony and cannot identify facts I did not personally observe.`;
  }
  return `${name}: I can only answer from my own memory scope. ${memoryLine}`;
}

export async function generateGuardedNpcReplyWithAudit(input: {
  provider?: Provider;
  world: WorldState;
  events: WorldEvent[];
  caseFromLog: CaseFromLog;
  deductionCase?: DeductionCase;
  characterId: string;
  question: string;
  discoveredEvidenceIds: string[];
  evidenceId?: string;
}) {
  const provider = input.provider || (process.env.AI_PROVIDER as Provider) || "deepseek";
  const config = providerConfig[provider] || providerConfig.deepseek;
  const deductionCase = input.deductionCase || input.caseFromLog.deductionCase;
  const context = buildNpcKnowledgeContext(input.world, input.events, deductionCase, input.characterId, input.discoveredEvidenceIds);
  const evidence = input.evidenceId ? deductionCase.evidence.find((item) => item.id === input.evidenceId) : undefined;
  const promptPayload = redactForbiddenTruthFromPrompt(buildGuardedNpcPromptPayload({ context, evidence, question: input.question }), input.caseFromLog);
  const promptAudit = auditPromptPayload(promptPayload, input.caseFromLog, input.characterId);
  let content = "";
  let mock = true;

  if (config.apiKey && context.character) {
    try {
      const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0.55,
          max_tokens: 900,
          messages: [
            {
              role: "system",
              content:
                "你是推理游戏里的 NPC，只能根据提供的角色资料、可见记忆、已发现证据回答。不得透露未提供的隐藏真相，不得自称知道系统规则，不得编造自己没看见的事实。"
            },
            { role: "user", content: JSON.stringify(promptPayload, null, 2) }
          ]
        })
      });
      if (response.ok) {
        const data = await response.json();
        content = data?.choices?.[0]?.message?.content || "";
        mock = !content;
      }
    } catch {
      content = "";
      mock = true;
    }
  }

  let dialogueEval = evaluateNpcDialogue({
    answer: content,
    caseFromLog: input.caseFromLog,
    characterId: input.characterId,
    evidenceId: input.evidenceId,
    promptAudit
  });
  if (dialogueEval.safetyFlags.length) {
    content = buildRuleSafeNpcFallback({ context, evidence, evidenceId: input.evidenceId });
    mock = true;
    dialogueEval = evaluateNpcDialogue({
      answer: content,
      caseFromLog: input.caseFromLog,
      characterId: input.characterId,
      evidenceId: input.evidenceId,
      promptAudit
    });
  }
  return {
    content,
    mock,
    promptAudit,
    dialogueEval,
    safetyFlags: dialogueEval.safetyFlags,
    memoryCount: promptAudit.memoryCount,
    evidenceCount: promptAudit.evidenceCount
  };
}

export async function generateGuardedNpcReply(input: {
  provider?: Provider;
  world: WorldState;
  events: WorldEvent[];
  caseFromLog?: CaseFromLog;
  deductionCase: DeductionCase;
  characterId: string;
  question: string;
  discoveredEvidenceIds: string[];
  evidenceId?: string;
}) {
  if (input.caseFromLog) {
    const result = await generateGuardedNpcReplyWithAudit({ ...input, caseFromLog: input.caseFromLog });
    return result.content;
  }
  const context = buildNpcKnowledgeContext(input.world, input.events, input.deductionCase, input.characterId, input.discoveredEvidenceIds);
  const evidence = input.evidenceId ? input.deductionCase.evidence.find((item) => item.id === input.evidenceId) : undefined;
  const promptPayload = buildGuardedNpcPromptPayload({ context, evidence, question: input.question });
  const provider = input.provider || (process.env.AI_PROVIDER as Provider) || "deepseek";
  const config = providerConfig[provider] || providerConfig.deepseek;
  if (!config.apiKey || !context.character) return "";
  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.55,
      max_tokens: 900,
      messages: [
        { role: "system", content: "你是推理游戏 NPC，只能按传入可见信息回答。" },
        { role: "user", content: JSON.stringify(promptPayload, null, 2) }
      ]
    })
  });
  if (!response.ok) return "";
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "";
}

export function makeLocalReveal(caseFromLog: CaseFromLog) {
  const contract = buildRevealFactContract(caseFromLog);
  return [
    `本地规则复盘：凶手是${contract.culprit.name}（${contract.culprit.id}）。`,
    `动机：${contract.motive.text}`,
    `手法：${contract.method.text}`,
    `关键证据链：${contract.decisiveEvidence.map((item) => `${item.id}/${item.title}`).join("、")}。`,
    `源事件：${contract.sourceEventIds.join("、")}。`
  ].join("\n");
}

function addHit(hits: RevealContractHit[], field: RevealContractHit["field"], value: string) {
  hits.push({ field, value });
}

function addMiss(misses: RevealContractMiss[], field: RevealContractMiss["field"], expected: string) {
  misses.push({ field, expected });
}

export function evaluateReveal(content: string, caseFromLog: CaseFromLog): RevealEvalReport {
  const contract = buildRevealFactContract(caseFromLog);
  const hits: RevealContractHit[] = [];
  const misses: RevealContractMiss[] = [];

  const culpritPreserved = content.includes(contract.culprit.id) || content.includes(contract.culprit.name);
  if (culpritPreserved) addHit(hits, "culprit", contract.culprit.name);
  else addMiss(misses, "culprit", `${contract.culprit.name} (${contract.culprit.id})`);

  const motiveKeywordHits = contract.motive.keywords.filter((keyword) => content.includes(keyword));
  const motivePreserved = content.includes(contract.motive.text) || motiveKeywordHits.length >= Math.min(2, Math.max(contract.motive.keywords.length, 1));
  if (motivePreserved) addHit(hits, "motive", motiveKeywordHits.join(", ") || contract.motive.text.slice(0, 16));
  else addMiss(misses, "motive", contract.motive.text);

  const methodKeywordHits = contract.method.keywords.filter((keyword) => content.includes(keyword));
  const methodPreserved = content.includes(contract.method.text) || methodKeywordHits.length >= Math.min(2, Math.max(contract.method.keywords.length, 1));
  if (methodPreserved) addHit(hits, "method", methodKeywordHits.join(", ") || contract.method.text.slice(0, 16));
  else addMiss(misses, "method", contract.method.text);

  const evidenceMatches = contract.decisiveEvidence.filter((item) => content.includes(item.id) || content.includes(item.title));
  const evidencePreserved = evidenceMatches.length >= Math.min(3, contract.decisiveEvidence.length);
  for (const item of evidenceMatches) addHit(hits, "evidence", item.id);
  for (const item of contract.decisiveEvidence.filter((item) => !evidenceMatches.some((match) => match.id === item.id))) addMiss(misses, "evidence", item.id);

  const sourceEventMatches = contract.sourceEventIds.filter((id) => content.includes(id));
  const sourceEventsPreserved = sourceEventMatches.length >= Math.min(2, contract.sourceEventIds.length);
  for (const id of sourceEventMatches) addHit(hits, "sourceEvent", id);
  for (const id of contract.sourceEventIds.filter((id) => !sourceEventMatches.includes(id)).slice(0, 4)) addMiss(misses, "sourceEvent", id);

  const factContractScore =
    (culpritPreserved ? 20 : 0) +
    (motivePreserved ? 20 : 0) +
    (methodPreserved ? 25 : 0) +
    Math.round((Math.min(evidenceMatches.length, 3) / 3) * 20) +
    Math.round((Math.min(sourceEventMatches.length, 2) / 2) * 15);
  const warnings: string[] = [];
  if (!culpritPreserved) warnings.push("Reveal did not preserve local culprit.");
  if (!motivePreserved) warnings.push("Reveal did not preserve local motive.");
  if (!methodPreserved) warnings.push("Reveal did not preserve local method.");
  if (!evidencePreserved) warnings.push("Reveal did not preserve at least 3 decisive evidence items.");
  if (!sourceEventsPreserved) warnings.push("Reveal did not preserve at least 2 source event ids.");

  return {
    sourceLocked: true,
    score: factContractScore,
    factContractScore,
    culpritPreserved,
    motivePreserved,
    methodPreserved,
    evidencePreserved,
    sourceEventsPreserved,
    contractHits: hits,
    contractMisses: misses,
    warnings
  };
}

export async function generateCaseRevealWithEval(input: { provider?: Provider; caseFromLog: CaseFromLog; session: PlayerSession }) {
  const provider = input.provider || (process.env.AI_PROVIDER as Provider) || "deepseek";
  const config = providerConfig[provider] || providerConfig.deepseek;
  const factContract = buildRevealFactContract(input.caseFromLog);
  const requiredFactLockLines = buildFactLockLines(factContract);
  let content = "";
  let mock = true;
  if (config.apiKey) {
    const truth = input.caseFromLog.deductionCase.truth;
    try {
      const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0.28,
          max_tokens: 1400,
          messages: [
            {
              role: "system",
              content:
                "你是本格推理游戏的事实锁定复盘员。只能根据 sourceLocked factContract 和本地 judgement 复盘。不得改变凶手、动机、手法、证据链或时间线。输出必须以 requiredFactLockLines 逐行原样开头，不得翻译、改写、删减这些行。随后再写 300-600 字中文复盘。"
            },
            {
              role: "user",
              content: JSON.stringify(
                {
                  sourceLocked: true,
                  factContract,
                  requiredFactLockLines,
                  caseTitle: input.caseFromLog.deductionCase.title,
                  judgement: input.session.judgement,
                  truth,
                  decisiveEvidence: input.caseFromLog.deductionCase.evidence
                    .filter((item) => truth.decisiveEvidenceIds.includes(item.id))
                    .map((item) => ({ id: item.id, title: item.title, trueMeaning: item.trueMeaning })),
                  trueTimeline: truth.trueTimeline
                },
                null,
                2
              )
            }
          ]
        })
      });
      if (response.ok) {
        const data = await response.json();
        content = data?.choices?.[0]?.message?.content || "";
        mock = !content;
      }
    } catch {
      content = "";
      mock = true;
    }
  }
  const fallbackReveal = makeLocalReveal(input.caseFromLog);
  if (!content) content = fallbackReveal;
  return { content, mock, sourceLocked: true as const, factContract, fallbackReveal, revealEval: evaluateReveal(content, input.caseFromLog) };
}

export async function generateCaseReveal(input: { provider?: Provider; caseFromLog: CaseFromLog; session: PlayerSession }) {
  const result = await generateCaseRevealWithEval(input);
  return result.mock ? "" : result.content;
}
