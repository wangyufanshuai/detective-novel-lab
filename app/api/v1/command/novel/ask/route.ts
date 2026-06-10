import { NextRequest, NextResponse } from "next/server";
import {
  buildNovelAskQueryPlan,
  createFallbackNovelAskAnswer,
  createNovelWorldProject,
  searchNovelAskEvidence,
  validateNovelAskAnswer,
  type NovelAskAnswer,
  type NovelAskEvidenceHit,
  type NovelAskQueryPlan,
  type NovelLongChapterText,
  type NovelWorldProject,
  type Provider
} from "@/lib/engine";

type AskBody = {
  provider?: Provider;
  project?: NovelWorldProject;
  chapters?: NovelLongChapterText[];
  question?: string;
  throughChapterId?: string;
  options?: { concise?: boolean };
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
Required top-level fields: id,question,status,answer,summaryBullets,evidenceHitIds,relatedObjectIds,warnings.
status must be answered, insufficient-evidence, or refused.
If status is answered, evidenceHitIds must cite ids from the provided evidenceHits only.
Do not cite paragraph ids directly unless they are inside an evidence hit. Do not invent evidence hit ids.
Do not answer from outside knowledge, future chapters, author biography, or general literary history.
Do not reproduce long passages. Use summaries and the provided short quotes only.`;

function safeProject(project?: NovelWorldProject) {
  return project?.version === 2 ? project : createNovelWorldProject({ title: "Untitled novel project", genreTone: "Unspecified" });
}

function extractJsonObject(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("The model did not return a parseable JSON object.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function normalizeAnswer(input: unknown, fallback: NovelAskAnswer, evidenceHits: NovelAskEvidenceHit[]): NovelAskAnswer {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const status = raw.status === "answered" || raw.status === "insufficient-evidence" || raw.status === "refused"
    ? raw.status
    : fallback.status;
  const evidenceIds = new Set(evidenceHits.map((hit) => hit.id));
  const evidenceHitIds = stringArray(raw.evidenceHitIds).filter((id) => evidenceIds.has(id));
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id : fallback.id,
    question: typeof raw.question === "string" && raw.question.trim() ? raw.question : fallback.question,
    status,
    answer: typeof raw.answer === "string" && raw.answer.trim() ? raw.answer : fallback.answer,
    summaryBullets: stringArray(raw.summaryBullets).slice(0, 6),
    evidenceHitIds: status === "answered" ? (evidenceHitIds.length ? evidenceHitIds : fallback.evidenceHitIds) : evidenceHitIds,
    relatedObjectIds: stringArray(raw.relatedObjectIds).slice(0, 12),
    warnings: stringArray(raw.warnings)
  };
}

function buildMessages(
  body: AskBody,
  project: NovelWorldProject,
  queryPlan: NovelAskQueryPlan,
  evidenceHits: NovelAskEvidenceHit[],
  repairContext?: { answer: NovelAskAnswer; errors: string[] }
) {
  return [
    {
      role: "system",
      content: "You answer questions about an analyzed novel only from provided evidence hits. If evidence is insufficient or the question asks for future/outside-book information, refuse or mark insufficient evidence."
    },
    {
      role: "user",
      content: `Task: ${repairContext ? "Repair the previous answer so local validation passes." : "Answer the user's book-internal question."}
${schemaInstruction}

Question: ${body.question || ""}
Through chapter id: ${body.throughChapterId || "all analyzed chapters"}
Options:
${JSON.stringify(body.options || {}, null, 2)}

Query plan:
${JSON.stringify(queryPlan, null, 2)}

Evidence hits:
${JSON.stringify(evidenceHits.map((hit) => ({
  id: hit.id,
  sourceType: hit.sourceType,
  sourceId: hit.sourceId,
  label: hit.label,
  chapterId: hit.chapterId,
  paragraphId: hit.paragraphId,
  quote: hit.quote,
  summary: hit.summary,
  confidence: hit.confidence,
  relatedObjectIds: hit.relatedObjectIds
})), null, 2)}

Project object labels:
${JSON.stringify({
  entities: project.mergedGraph.entities.map((entity) => ({ id: entity.id, kind: entity.kind, name: entity.name })),
  events: project.mergedGraph.events.map((event) => ({ id: event.id, title: event.title })),
  themes: project.themeRegistry || []
}, null, 2)}

Previous answer:
${repairContext ? JSON.stringify(repairContext.answer, null, 2) : "none"}

Validation errors:
${repairContext ? repairContext.errors.join("\n") : "none"}`
    }
  ];
}

async function callModel(
  body: AskBody,
  project: NovelWorldProject,
  queryPlan: NovelAskQueryPlan,
  evidenceHits: NovelAskEvidenceHit[],
  repairContext?: { answer: NovelAskAnswer; errors: string[] }
) {
  const provider = body.provider || (process.env.AI_PROVIDER as Provider) || "deepseek";
  const config = providerConfig[provider] || providerConfig.deepseek;
  if (!config.apiKey) return { mock: true, content: "", json: null };

  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: buildMessages(body, project, queryPlan, evidenceHits, repairContext),
      response_format: { type: "json_object" },
      temperature: 0.15,
      max_tokens: 4096
    })
  });

  if (!response.ok) throw new Error(`Model API returned ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return { mock: false, content: data?.choices?.[0]?.message?.content || "", json: null };
}

async function answerQuestion(body: AskBody) {
  const project = safeProject(body.project);
  const chapters = Array.isArray(body.chapters) ? body.chapters : [];
  const question = (body.question || "").trim();
  const queryPlan = buildNovelAskQueryPlan(project, question, body.throughChapterId);
  const { evidenceHits } = searchNovelAskEvidence(project, chapters, queryPlan, body.throughChapterId);
  const fallback = createFallbackNovelAskAnswer(project, question, evidenceHits, queryPlan);
  let answer = fallback;
  let validation = validateNovelAskAnswer(answer, evidenceHits, chapters);
  let mock = true;

  if (queryPlan.kind === "unsupported" || !evidenceHits.length) {
    return { mock: true, answer, queryPlan, evidenceHits, validation, repaired: false };
  }

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await callModel(body, project, queryPlan, evidenceHits, attempt > 0 ? { answer, errors: validation.errors } : undefined);
      mock = result.mock;
      if (result.mock) break;
      answer = normalizeAnswer(extractJsonObject(result.content), fallback, evidenceHits);
      validation = validateNovelAskAnswer(answer, evidenceHits, chapters);
      if (validation.valid) return { mock, answer, queryPlan, evidenceHits, validation, repaired: attempt > 0 };
    }
  } catch {
    answer = fallback;
  }

  answer = fallback;
  validation = validateNovelAskAnswer(answer, evidenceHits, chapters);
  return { mock: true, answer, queryPlan, evidenceHits, validation, repaired: true };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AskBody;
    const result = await answerQuestion(body);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { code: "NOVEL_ASK_FAILED", message: error instanceof Error ? error.message : "Unknown error" } },
      { status: 500 }
    );
  }
}
