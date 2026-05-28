import { NextRequest, NextResponse } from "next/server";
import { DeductionCase, createFallbackCase, validateCase } from "@/lib/deduction";

type Provider = "deepseek" | "siliconflow";

type GenerateBody = {
  provider?: Provider;
  stage: string;
  stageLabel?: string;
  brief: string;
  currentDraft?: Record<string, string>;
  selectedCaseType?: string;
  hiddenTruthMode?: boolean;
  userDirection?: string;
  lengthTarget?: string;
};

const providerConfig = {
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat"
  },
  siliconflow: {
    apiKey: process.env.SILICONFLOW_API_KEY,
    baseUrl: process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1",
    model: process.env.SILICONFLOW_MODEL || "deepseek-ai/DeepSeek-V3.2-Exp"
  }
};

const jsonSchemaInstruction = `只输出一个 JSON object，不要 Markdown，不要解释。
字段必须包含：
- id,title,theme,premise,publicCaseFile,truth,characters,evidence,scenes,relationships,logicPuzzle
- truth: culpritId,motive,method,opportunity,decisiveEvidenceIds,trueTimeline
- trueTimeline 每项: id,time,event,characterIds,isPublic,source,publicVersion,contradictedByEvidenceIds
- characters 每项: id,name,role,publicBio,secret,motive,means,opportunity,isCulprit,alibi,initialStatement,knowledgeScope,liePolicy,contradictionTriggers
- evidence 每项: id,title,location,visibleDescription,trueMeaning,relatedCharacterIds,relatedTime,discoverable,isKey,unlocks,contradicts,supportsConclusion,discoveryDifficulty
- scenes 每项: id,name,description,evidenceIds
- relationships 每项: from,to,label
- logicPuzzle: suspectMatrix,exclusionChains,criticalReasoningChain,redHerrings,requiredClueOrder
硬性要求：凶手唯一；至少 3 名嫌疑人；至少 3 条可发现关键证据；每个非凶手必须有可发现排除证据；公开证词时间线必须能被证据揭示矛盾；关键推理链不得依赖玩家无法发现的信息。`;

const stageInstructions: Record<string, string> = {
  gameTruthSeed: `生成一个可玩的本格推理游戏案件。${jsonSchemaInstruction}`,
  gameLogicRepair: `修复用户给出的结构化案件 JSON，使其通过本地规则校验。必须保持同一题材，但可以调整人物、证据、时间线和 logicPuzzle。${jsonSchemaInstruction}`,
  gameCaseFile:
    "把结构化案件改写成玩家可见案卷。不要泄露凶手、幕后真相、证据真实含义和完整排除链。输出包含案件摘要、公开人物信息、可搜索场景、初始线索、调查目标。",
  gameDialogue:
    "根据案件结构、角色身份、玩家已发现证据和玩家问题，生成该角色的一段回答。回答必须符合角色知识范围，可以隐瞒或回避，但不能泄露只有作者才知道的完整真相。",
  gameEvidenceChallenge:
    "根据本地规则给出的质询命中结果，生成角色被证据质询时的回答。不能改变规则结论。命中矛盾时可表现为紧张、修正证词、局部承认；未命中时只给有限信息。",
  gameJudgement:
    "根据规则引擎判定结果，用自然语言解释玩家推理为什么成立或不成立。不得改变规则结论。失败时只解释缺口，不要泄露完整真相。",
  gameSolutionReveal:
    "玩家已经通过规则判定。生成完整解答篇：凶手、动机、手法、真实时间线、关键证据链、其他嫌疑人的排除理由、误导线索解释。",
  quickSynopsis:
    "根据用户输入的大纲生成标准版故事大概，约1200-2000字。包含标题、可见故事梗概、主要人物、核心谜面、幕后真相、凶手动机、关键诡计、公平线索、误导线索、漏洞与修正建议。不要写完整正文。",
  quickOutline:
    "把已确认的故事大概改写成可用于生成全文的章节大纲。按用户目标篇幅规划章节数、每章篇幅、场景、信息增量、线索投放、误导、揭晓点。",
  quickChapter:
    "只生成用户指定的单个章节正文。严格承接已确认的故事大概、章节大纲和前文，不要输出创作说明或总大纲。"
};

function extractJsonObject(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("模型没有返回可解析的 JSON 对象。");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

function buildMessages(body: GenerateBody) {
  const context = Object.entries(body.currentDraft || {})
    .filter(([, value]) => value?.trim())
    .map(([key, value]) => `【${key}】\n${value}`)
    .join("\n\n");

  return [
    {
      role: "system",
      content:
        "你是 Deduction Engine 的案件生成器。核心原则：结构化真相优先，规则校验优先，文本生成服从结构；推理必须公平；凶手必须唯一；时间线必须自洽；不要模仿任何具体作者的可识别文风。"
    },
    {
      role: "user",
      content: `阶段：${body.stageLabel || body.stage}
阶段要求：${stageInstructions[body.stage] || "继续生成推理内容。"}
题材/约束：${body.brief || "随机生成一个现代本格推理案件。"}
案件类型：${body.selectedCaseType || "随机组合"}
目标篇幅：${body.lengthTarget || "3000-6000字"}
本轮要求：${body.userDirection || "无"}

已生成内容：
${context || "暂无"}`
    }
  ];
}

async function callModel(body: GenerateBody) {
  const provider = body.provider || (process.env.AI_PROVIDER as Provider) || "deepseek";
  const config = providerConfig[provider] || providerConfig.deepseek;

  if (!config.apiKey) {
    return { mock: true, content: "", json: createFallbackCase(body.brief) };
  }

  const wantsJson = body.stage === "gameTruthSeed" || body.stage === "gameLogicRepair";
  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: buildMessages(body),
      response_format: wantsJson ? { type: "json_object" } : undefined,
      temperature: wantsJson ? 0.28 : 0.7,
      max_tokens: body.stage === "quickChapter" || wantsJson ? 8192 : 4096
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`模型接口返回错误：${response.status} ${detail}`);
  }

  const data = await response.json();
  return {
    mock: false,
    content: data?.choices?.[0]?.message?.content || "",
    json: null
  };
}

async function generateValidatedCase(body: GenerateBody) {
  let lastCase: DeductionCase | null = null;
  let lastValidation = null as ReturnType<typeof validateCase> | null;
  let lastContent = "";
  let mock = false;
  let lastParseError = "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await callModel({
      ...body,
      stage: attempt === 0 ? "gameTruthSeed" : "gameLogicRepair",
      stageLabel: attempt === 0 ? "gameTruthSeed" : `gameLogicRepair-${attempt}`,
      currentDraft:
        attempt === 0
          ? body.currentDraft
          : {
              structuredCase: JSON.stringify(lastCase, null, 2),
              rawModelOutput: lastContent,
              parseError: lastParseError,
              validationIssues: JSON.stringify(lastValidation?.issues || [], null, 2)
            }
    });

    mock = result.mock;
    lastContent = result.mock ? JSON.stringify(result.json, null, 2) : result.content;
    try {
      lastCase = (result.mock ? result.json : extractJsonObject(result.content)) as DeductionCase;
      lastParseError = "";
    } catch (error) {
      lastCase = null;
      lastValidation = {
        valid: false,
        issues: [`JSON 解析失败：${error instanceof Error ? error.message : "未知解析错误"}`],
        suspectMatrix: [],
        timelineContradictions: []
      };
      lastParseError = error instanceof Error ? error.message : "未知解析错误";
      continue;
    }
    lastValidation = validateCase(lastCase);

    if (lastValidation.valid) {
      return { mock, content: lastContent, json: lastCase, validation: lastValidation, repaired: attempt > 0 };
    }
  }

  return { mock, content: lastContent, json: lastCase, validation: lastValidation, repaired: true };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateBody;

    if (body.stage === "gameTruthSeed") {
      const result = await generateValidatedCase(body);
      if (!result.json || !result.validation) {
        throw new Error("案件生成失败，未得到结构化结果。");
      }
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.stage === "gameLogicRepair") {
      const result = await callModel(body);
      const deductionCase = (result.mock ? result.json : extractJsonObject(result.content)) as DeductionCase;
      const validation = validateCase(deductionCase);
      return NextResponse.json({
        ok: true,
        mock: result.mock,
        content: result.mock ? JSON.stringify(deductionCase, null, 2) : result.content,
        json: deductionCase,
        validation
      });
    }

    const result = await callModel(body);

    if (result.mock) {
      const fallback = createFallbackCase(body.brief);
      const content =
        body.stage === "gameCaseFile"
          ? fallback.publicCaseFile
          : body.stage === "gameSolutionReveal"
            ? `解答篇：凶手是陆青。动机是掩盖数据造假和经费问题；手法是制造备用电源切换造成监控空白，并利用望远镜固定校准刻度伪装死亡留言。`
            : "当前没有可用 API Key。填写 .env 后会调用真实模型。";
      return NextResponse.json({ ok: true, mock: true, content });
    }

    return NextResponse.json({ ok: true, mock: false, content: result.content });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "未知错误"
      },
      { status: 500 }
    );
  }
}
