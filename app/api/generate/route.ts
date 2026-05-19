import { NextRequest, NextResponse } from "next/server";

type Provider = "deepseek" | "siliconflow";

type GenerateBody = {
  provider?: Provider;
  stage: string;
  stageLabel: string;
  brief: string;
  currentDraft: Record<string, string>;
  selectedCaseType: string;
  hiddenTruthMode: boolean;
  userDirection?: string;
  variants?: number;
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
  quickSynopsis:
    "根据用户输入的大纲生成标准版故事大概，约1200-2000字。必须包含：故事标题、可见故事梗概、主要人物、核心谜面、幕后真相、凶手动机、关键诡计、公平线索、误导线索、可能漏洞与修正建议。不要写完整正文。",
  quickOutline:
    "把已确认的故事大概改写成可用于生成全文的章节大纲。按用户目标篇幅规划章节数、每章篇幅、场景、信息增量、线索投放、误导、揭晓点。必须包含挑战读者或等价的公平推理停顿。",
  quickChapter:
    "只生成用户指定的单个章节正文。严格承接已确认的故事大概、章节大纲和前文，不要输出创作说明、总大纲或后续章节。不要在结尾新增未铺垫的关键证据。",
  material:
    "整理用户素材，补全缺口，不要直接写小说。输出：素材摘要、可保留设定、建议补强点、3个可追问但不强制的问题。",
  schemes:
    "生成3个差异明显的短篇本格案件方案。每个方案包含标题、核心谜面、案件类型、嫌疑人结构、隐藏真相、读者挑战点、风险提示。",
  truth:
    "基于已选方向生成真相骨架。必须明确凶手、动机、手法、诡计原理、关键证据、反证路径、为什么其他嫌疑人不是凶手。",
  timeline:
    "生成嫌疑人与时间线。要求列出案发前后关键时间点、每个人的行动、谎言、可被证实的事实、不在场证明漏洞。",
  clues:
    "设计线索与红鲱鱼。必须分成真线索、伪线索、双关线索、伏笔位置、揭晓时回收方式。确保关键线索不会只在结尾突然出现。",
  fairness:
    "执行公平推理审计。找出逻辑漏洞、信息不公平、偶然性过强、动机不足、时间线矛盾，并给出修正后的版本。",
  outline:
    "生成章节大纲。目标8000-15000字中文短篇，必须包含挑战读者章节。每章给出篇幅、场景、信息增量、误导、读者可推理点。",
  chapter:
    "只生成用户指定的单个章节正文。严格承接已确认设定和上一章内容，不要输出总大纲、创作说明、方案说明或后续章节。保持中文小说正文质感，并确保本章提供的线索符合公平推理。",
  prose:
    "按已确认设定生成完整中文短篇小说草稿。保留逻辑至上、古典本格、挑战读者、终局推演。不要仿写具体作家的原句或可识别文风。"
};

function buildPrompt(body: GenerateBody) {
  const context = Object.entries(body.currentDraft || {})
    .filter(([, value]) => value?.trim())
    .map(([key, value]) => `【${key}】\n${value}`)
    .join("\n\n");

  return [
    {
      role: "system",
      content:
        "你是中文本格推理小说创作总编辑，擅长逻辑至上、公平推理、读者挑战、多嫌疑人演绎和证据链重组。你可以借鉴古典推理的结构特征，但不得逐句模仿任何具体作者的可识别表达。输出必须清晰、可编辑、以创作者为对象。"
    },
    {
      role: "user",
      content: `项目目标：生成中文本格推理小说。
目标篇幅：${body.lengthTarget || "8000-15000字"}
当前阶段：${body.stageLabel}
阶段要求：${stageInstructions[body.stage] || "继续完善推理小说项目。"}
案件类型偏好：${body.selectedCaseType}
是否隐藏幕后真相：${body.hiddenTruthMode ? "界面会隐藏，但你仍需为创作者生成完整幕后逻辑。" : "否"}

用户大纲/素材：
${body.brief || "用户没有提供更多素材，请给出可执行的合理随机方案。"}

用户本轮修改要求：
${body.userDirection || "无"}

已确认/已生成内容：
${context || "暂无"}

输出要求：
- 使用中文。
- 推理必须公平，避免结尾突然新增关键证据。
- 不要仿写任何具体作者的原句或可识别文风。
- 如果是故事大概，必须显示幕后真相，方便创作者确认。
- 如果是单章正文，只写正文，不要写“收到”“以下是”等说明。`
    }
  ];
}

function mockResponse(body: GenerateBody) {
  if (body.stage === "quickSynopsis") {
    return `# 故事大概：雪夜第十三把钥匙

## 可见故事
暴雪封山的旧别墅里，一位信托律师在二楼书房被杀。门内插着唯一的书房钥匙，窗外新雪没有脚印，死者手边却留下“十三”二字。众人以为这是死亡留言，真正的矛盾却在大厅钥匙柜：本应只有十二把钥匙，案发后却多出了一把“书房”钥匙。

## 幕后真相
凶手预先配出第十三把书房钥匙，利用旧锁可从外侧上锁的特点制造密室。死者写下“十三”，指的是钥匙数量异常。凶手又拨慢座钟十三分钟，试图把“十三”误导成时间线。

## 公平线索
钥匙柜空钩、假钥匙做旧痕迹、窗外无脚印只排除窗户路径、旧锁结构、座钟内铜屑、凶手懂锁具与钟表。`;
  }

  if (body.stage === "quickOutline") {
    return `# 章节大纲

1. 雪封别墅：人物到齐，律师取走书房钥匙。
2. 门内钥匙：尸体出现，密室成立。
3. 多出的钥匙：发现第十三把钥匙。
4. 九点证词：嫌疑人证词互相咬合。
5. 十三分钟：座钟和假钥匙暴露破绽。
6. 挑战读者：列出所有公平线索。
7. 终局推理：揭露凶手与密室原理。`;
  }

  if (body.stage === "quickChapter") {
    return `# 示例章节

雪从傍晚开始封住山路。听雪馆的灯在风里摇晃，像一座旧案卷的封蜡。许文谦在众目睽睽下打开钥匙柜，取走第十二号书房钥匙。顾晏初注意到钥匙离开后，木板上留下一个干净的空痕。`;
  }

  return `# ${body.stageLabel}（离线示例）

当前没有可用 API Key。填写 .env 后会调用真实模型。`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateBody;
    const provider = body.provider || (process.env.AI_PROVIDER as Provider) || "deepseek";
    const config = providerConfig[provider] || providerConfig.deepseek;

    if (!config.apiKey) {
      return NextResponse.json({ ok: true, mock: true, content: mockResponse(body) });
    }

    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: buildPrompt(body),
        temperature: body.stage === "fairness" ? 0.35 : 0.72,
        max_tokens: body.stage === "quickChapter" || body.stage === "prose" ? 8192 : 4096
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        { ok: false, error: `模型接口返回错误：${response.status}`, detail },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";

    return NextResponse.json({ ok: true, mock: false, content });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    );
  }
}
