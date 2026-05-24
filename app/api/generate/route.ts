import { NextRequest, NextResponse } from "next/server";
import { createFallbackCase, DeductionCase, validateCase } from "@/lib/deduction";

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

const stageInstructions: Record<string, string> = {
  gameTruthSeed:
    "生成一个可玩的本格推理游戏案件。必须只输出一个 JSON object，不要 Markdown，不要解释，不要代码块。JSON 必须符合字段：id,title,theme,premise,publicCaseFile,truth,characters,evidence,scenes,relationships。truth 包含 culpritId,motive,method,opportunity,decisiveEvidenceIds,trueTimeline。characters 每个包含 id,name,role,publicBio,secret,motive,means,opportunity,isCulprit,alibi,initialStatement。evidence 每个包含 id,title,location,visibleDescription,trueMeaning,relatedCharacterIds,relatedTime,discoverable,isKey。scenes 每个包含 id,name,description,evidenceIds。relationships 每个包含 from,to,label。要求唯一凶手、至少4名嫌疑人、至少3个关键证据、至少3个可搜索场景。",
  gameCaseFile:
    "把结构化案件改写成玩家可见案卷。不要泄露凶手、幕后真相、证据真实含义。输出包含案件摘要、公开人物信息、可搜索场景、初始证据、玩家目标。",
  gameDialogue:
    "根据案件结构、角色身份、玩家已发现证据和玩家问题，生成该角色的一段回答。回答要符合角色已知信息，可以撒谎或回避，但不能泄露只有凶手/作者才知道的全部真相。",
  gameJudgement:
    "根据规则引擎判定结果，用自然语言解释玩家推理为什么成立或不成立。不要改变规则结论。",
  quickSynopsis:
    "根据用户输入的大纲生成标准版故事大概，约1200-2000字。必须包含故事标题、可见故事梗概、主要人物、核心谜面、幕后真相、凶手动机、关键诡计、公平线索、误导线索、可能漏洞与修正建议。不要写完整正文。",
  quickOutline:
    "把已确认的故事大概改写成可用于生成全文的章节大纲。按用户目标篇幅规划章节数、每章篇幅、场景、信息增量、线索投放、误导、揭晓点。必须包含挑战读者或等价的公平推理停顿。",
  quickChapter:
    "只生成用户指定的单个章节正文。严格承接已确认的故事大概、章节大纲和前文，不要输出创作说明、总大纲或后续章节。不要在结尾新增未铺垫的关键证据。"
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
        "你是 Deduction Engine 的案件生成器。核心原则：先构造结构化真相，再生成玩家可见文本；推理必须公平；凶手必须唯一；时间线必须自洽；不要模仿任何具体作者的可识别文风。"
    },
    {
      role: "user",
      content: `阶段：${body.stageLabel || body.stage}
阶段要求：${stageInstructions[body.stage] || "继续生成推理内容。"}
题材/约束：
${body.brief || "随机生成一个现代本格推理案件。"}

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

  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
      body: JSON.stringify({
        model: config.model,
        messages: buildMessages(body),
        response_format: body.stage === "gameTruthSeed" ? { type: "json_object" } : undefined,
        temperature: body.stage === "gameTruthSeed" ? 0.35 : 0.72,
        max_tokens: body.stage === "quickChapter" || body.stage === "gameTruthSeed" ? 8192 : 4096
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateBody;

    if (body.stage === "gameTruthSeed") {
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
      return NextResponse.json({
        ok: true,
        mock: true,
        content:
          body.stage === "gameCaseFile"
            ? createFallbackCase(body.brief).publicCaseFile
            : "当前没有可用 API Key。填写 .env 后会调用真实模型。"
      });
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
