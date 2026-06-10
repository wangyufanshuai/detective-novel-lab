import { NextRequest, NextResponse } from "next/server";
import {
  createFallbackEvidenceIndex,
  createNovelLongChapterText,
  validateEvidenceSnippets,
  type NovelEvidenceIndex,
  type NovelLongChapterText,
  type Provider
} from "@/lib/engine";

type EvidenceIndexBody = {
  provider?: Provider;
  chapter?: { id: string; order: number; title: string; rawText: string };
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
Required fields: chapterId,paragraphCount,snippets,warnings.
snippets item: id,source,keywords.
source requires chapterId,paragraphId,quote,summary,confidence.
Use only the provided paragraph ids. quote must be a short excerpt no more than 120 characters.
Do not reproduce long passages.`;

function extractJsonObject(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("The model did not return a parseable JSON object.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalizeIndex(input: unknown, chapter: NovelLongChapterText): NovelEvidenceIndex {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const fallback = createFallbackEvidenceIndex(chapter);
  return {
    chapterId: typeof raw.chapterId === "string" ? raw.chapterId : chapter.chapterId,
    paragraphCount: typeof raw.paragraphCount === "number" ? raw.paragraphCount : chapter.paragraphs.length,
    snippets: Array.isArray(raw.snippets) ? raw.snippets as NovelEvidenceIndex["snippets"] : fallback.snippets,
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : []
  };
}

async function callModel(body: EvidenceIndexBody, chapter: NovelLongChapterText) {
  const provider = body.provider || (process.env.AI_PROVIDER as Provider) || "deepseek";
  const config = providerConfig[provider] || providerConfig.deepseek;
  if (!config.apiKey) return { mock: true, json: createFallbackEvidenceIndex(chapter), content: "" };

  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 8192,
      messages: [
        { role: "system", content: "Build a paragraph-level evidence index for a long novel workbench. Stay concise and cite only provided paragraph ids." },
        {
          role: "user",
          content: `${schemaInstruction}

Chapter: ${chapter.title}
Paragraphs:
${chapter.paragraphs.map((paragraph) => `${paragraph.id}: ${paragraph.text}`).join("\n\n")}`
        }
      ]
    })
  });

  if (!response.ok) throw new Error(`Model API returned ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return { mock: false, json: null, content: data?.choices?.[0]?.message?.content || "" };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as EvidenceIndexBody;
    if (!body.chapter?.id) throw new Error("chapter.id is required.");
    const chapter = createNovelLongChapterText({ chapterId: body.chapter.id, order: body.chapter.order || 1, title: body.chapter.title || "Untitled chapter", rawText: body.chapter.rawText || "" });
    const result = await callModel(body, chapter);
    const index = normalizeIndex(result.mock ? result.json : extractJsonObject(result.content), chapter);
    const validation = validateEvidenceSnippets(index.snippets, [chapter]);
    if (!validation.valid && !result.mock) {
      const fallback = createFallbackEvidenceIndex(chapter);
      return NextResponse.json({ ok: true, data: { mock: true, chapter, index: fallback, validation: validateEvidenceSnippets(fallback.snippets, [chapter]), repaired: true } });
    }
    return NextResponse.json({ ok: true, data: { mock: result.mock, chapter, index, validation, repaired: false } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { code: "NOVEL_EVIDENCE_INDEX_FAILED", message: error instanceof Error ? error.message : "Unknown error" } },
      { status: 500 }
    );
  }
}
