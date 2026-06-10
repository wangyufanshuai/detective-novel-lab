import { NextRequest, NextResponse } from "next/server";
import {
  createFallbackNovelChapterBlueprint,
  createNovelWorldProject,
  normalizeNovelChapterBlueprint,
  validateEvidenceAwareNovelChapterBlueprint,
  validateNovelChapterBlueprint,
  type NovelChapterBlueprint,
  type NovelBlueprintOptions,
  type NovelLongChapterText,
  type NovelWorldProject,
  type Provider
} from "@/lib/engine";

type BlueprintBody = {
  provider?: Provider;
  project?: NovelWorldProject;
  chapters?: NovelLongChapterText[];
  afterChapterId?: string;
  options?: Partial<NovelBlueprintOptions>;
};

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
  }
};

const schemaInstruction = `Only output one JSON object. Do not output Markdown.
Required top-level fields: id,afterChapterId,targetChapterTitle,wordCountRange,narrativePerspective,pacing,chapterGoal,sceneBeats,characterMotivations,conflictEscalation,foreshadowingPayoffs,writingRisks,summary,warnings.
sceneBeats item: id,order,title,purpose,locationEntityId,involvedEntityIds,sourceEventIds,tension,outcome.
foreshadowingPayoffs item: id,setup,payoff,relatedEntityIds,relatedEventIds,urgency. urgency must be low,medium,or high.
writingRisks item: id,severity,message,mitigation,relatedEntityIds. severity must be low,medium,or high.
Optional evidence item: id,source,keywords. source must include chapterId,paragraphId,quote,summary,confidence. If chapter evidence is provided, only cite existing chapterId/paragraphId pairs and keep quote under 120 Chinese characters.
pacing must be quiet,balanced,or high-tension.
Use only entity ids and event ids that exist in the provided project. If a reference is uncertain, leave the id array empty.
This is read-only writing guidance. Do not create a draft chapter and do not mutate the project.`;

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
    throw new Error("The model did not return a parseable JSON object.");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

function safeProject(project?: NovelWorldProject) {
  return project?.version === 2 ? project : createNovelWorldProject({ title: "Untitled novel project", genreTone: "Unspecified" });
}

function buildMessages(body: BlueprintBody, project: NovelWorldProject, repairContext?: { blueprint: NovelChapterBlueprint; errors: string[] }) {
  return [
    {
      role: "system",
      content:
        "You are a writing-room assistant for a novel world graph workbench. Produce structured, practical next-chapter planning JSON. Do not imitate any specific living or dead author's recognizable style."
    },
    {
      role: "user",
      content: `Task: ${repairContext ? "Repair the previous next-chapter blueprint so local validation passes." : "Generate a read-only next-chapter blueprint."}
${schemaInstruction}

After chapter id: ${body.afterChapterId || "latest analyzed chapter"}
Options:
${JSON.stringify(body.options || {}, null, 2)}

Project:
${JSON.stringify(project, null, 2)}

Chapter evidence library:
${JSON.stringify((body.chapters || []).map((chapter) => ({
  chapterId: chapter.chapterId,
  order: chapter.order,
  title: chapter.title,
  paragraphs: chapter.paragraphs.map((paragraph) => ({
    id: paragraph.id,
    order: paragraph.order,
    text: paragraph.text.slice(0, 220)
  }))
})), null, 2)}

Previous blueprint:
${repairContext ? JSON.stringify(repairContext.blueprint, null, 2) : "none"}

Validation errors:
${repairContext ? repairContext.errors.join("\n") : "none"}`
    }
  ];
}

async function callModel(body: BlueprintBody, project: NovelWorldProject, repairContext?: { blueprint: NovelChapterBlueprint; errors: string[] }) {
  const provider = body.provider || (process.env.AI_PROVIDER as Provider) || "deepseek";
  const config = providerConfig[provider] || providerConfig.deepseek;
  if (!config.apiKey) {
    return { mock: true, content: "", json: createFallbackNovelChapterBlueprint(project, body.afterChapterId, body.options) };
  }

  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: buildMessages(body, project, repairContext),
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 8192
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Model API returned ${response.status}: ${detail}`);
  }

  const data = await response.json();
  return { mock: false, content: data?.choices?.[0]?.message?.content || "", json: null };
}

async function generateBlueprint(body: BlueprintBody) {
  const project = safeProject(body.project);
  const chapters = Array.isArray(body.chapters) ? body.chapters : [];
  const validateBlueprint = (candidate: NovelChapterBlueprint) => chapters.length
    ? validateEvidenceAwareNovelChapterBlueprint(candidate, project, chapters)
    : validateNovelChapterBlueprint(candidate, project);
  let blueprint: NovelChapterBlueprint | null = null;
  let validation = null as ReturnType<typeof validateNovelChapterBlueprint> | null;
  let mock = false;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await callModel(body, project, attempt > 0 && blueprint && validation ? { blueprint, errors: validation.errors } : undefined);
    mock = result.mock;
    blueprint = normalizeNovelChapterBlueprint(result.mock ? result.json : extractJsonObject(result.content));
    validation = validateBlueprint(blueprint);
    if (validation.valid) return { mock, blueprint, validation, repaired: attempt > 0 };
    if (result.mock) break;
  }

  if (!blueprint || !validation) {
    blueprint = createFallbackNovelChapterBlueprint(project, body.afterChapterId, body.options);
    validation = validateBlueprint(blueprint);
    mock = true;
  }
  return { mock, blueprint, validation, repaired: true };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BlueprintBody;
    const result = await generateBlueprint(body);
    return NextResponse.json({
      ok: true,
      data: result
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "NOVEL_BLUEPRINT_FAILED",
          message: error instanceof Error ? error.message : "Unknown error"
        }
      },
      { status: 500 }
    );
  }
}
