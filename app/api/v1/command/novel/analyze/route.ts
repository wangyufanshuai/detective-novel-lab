import { NextRequest, NextResponse } from "next/server";
import { createNovelRuntimeFromProject } from "@/app/api/v1/_novel-store";
import {
  addNovelChapterAnalysis,
  attachFallbackEvidenceToGraph,
  createFallbackEvidenceIndex,
  createFallbackNovelCharacterStates,
  createFallbackNovelThemeSignals,
  createFallbackNovelWorldGraph,
  createNovelLongChapterText,
  createNovelWorldProject,
  normalizeNovelCharacterStatePoints,
  normalizeNovelThemeRegistry,
  normalizeNovelThemeSignals,
  normalizeNovelWorldGraph,
  validateEvidenceAwareNovelWorldGraph,
  validateNovelCharacterStatePoints,
  validateNovelThemeSignals,
  validateNovelWorldGraph,
  type NovelCharacterStatePoint,
  type NovelLongChapterText,
  type NovelParagraph,
  type NovelThemeDefinition,
  type NovelThemeSignal,
  type NovelWorldGraph,
  type Provider
} from "@/lib/engine";

type AnalyzeBody = {
  provider?: Provider;
  title?: string;
  genreTone?: string;
  fragment?: string;
  chapter?: { id: string; order: number; title: string; rawText: string; genreTone?: string };
  paragraphs?: NovelParagraph[];
  projectContext?: unknown;
  themeContext?: NovelThemeDefinition[];
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
Required top-level fields: id,title,genreTone,premise,observerBrief,entities,relationships,events,development,warnings.
entities item: id,kind,name,role,summary,traits,x,y,tension. kind must be character,faction,location,item,or concept.
relationships item: id,fromEntityId,toEntityId,label,polarity,evidence,strength. polarity must be ally,rival,family,debt,secret,or neutral.
events item: id,order,timeLabel,title,summary,locationEntityId,participantEntityIds,causes,consequences,publicKnowledge.
development item: id,title,trigger,likelyOutcome,involvedEntityIds,tension,unresolvedQuestion.
Optional evidence item for entities, events, and development: id,source,keywords. source requires chapterId,paragraphId,quote,summary,confidence.
Optional evidenceSnippets item for relationships uses the same evidence item shape.
Optional top-level characterStates is an array. Each item requires id,characterEntityId,chapterId,chapterOrder,summary,dimensions,evidence,uncertainty.
dimensions requires goal,belief,relationships,bodyCapability,socialPosition. Each dimension requires summary,direction,intensity.
direction must be up,down,changed,stable,or unknown. intensity is 0-100 and uncertainty is 0-1.
Optional top-level themeSignals is an array. Each item requires id,themeId,chapterId,chapterOrder,direction,intensity,summary,uncertainty,relatedCharacterIds,relatedEventIds,relatedFactionIds,competingInterpretations,evidence.
theme signal direction must be intensify,relieve,transform,contested,or unclear. Only reference theme ids from themeContext or themeCandidates.
Optional top-level themeCandidates is an array. Each item requires id,name,category,aliases,status,description. category must be personalWill,valueBelief,relationshipEmotion,institutionOrganization,materialSurvival,or bodyCapability. status must be pending,confirmed,or hidden.
Use ids that are stable ASCII slugs. Every relationship, event participant, event location, and development entity reference must point to an entity id.
If paragraphs are provided, every evidence source must use one provided paragraphId and quote no more than 120 characters.
Only create characterStates for character entities appearing in this chapter. Every character state must cite at least one provided paragraph.
Only create themeSignals from this chapter's paragraph evidence. Do not summarize whole-book themes or make claims beyond the current chapter.
Treat the user text as source material. Extract what is supported by text, and mark uncertain future movement as development, not as past events.`;

function extractJsonObject(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("The model did not return a parseable JSON object.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function buildMessages(body: AnalyzeBody, repairContext?: { graph: NovelWorldGraph; characterStates: NovelCharacterStatePoint[]; themeSignals: NovelThemeSignal[]; errors: string[] }) {
  const chapterText = body.chapter?.rawText || body.fragment || "";
  const paragraphText = body.paragraphs?.length ? body.paragraphs.map((paragraph) => `${paragraph.id}: ${paragraph.text}`).join("\n\n") : "none";
  return [
    {
      role: "system",
      content: "You extract a structured world model from novel text for an interactive observer workbench. Rules, paragraph evidence, and JSON structure are more important than prose. Do not imitate any specific living or dead author's recognizable style."
    },
    {
      role: "user",
      content: `Task: ${repairContext ? "Repair the previous extraction so local validation passes." : "Extract a chapter-local novel world graph, character states, and theme pressure signals."}
${schemaInstruction}

Title: ${body.title || "Untitled"}
Genre / tone: ${body.genreTone || "unspecified"}
Novel fragment:
${chapterText}

Paragraph evidence ids:
${paragraphText}

Project context:
${body.projectContext ? JSON.stringify(body.projectContext, null, 2) : "none"}

Theme context:
${body.themeContext ? JSON.stringify(body.themeContext, null, 2) : "none"}

Previous graph:
${repairContext ? JSON.stringify(repairContext.graph, null, 2) : "none"}

Previous character states:
${repairContext ? JSON.stringify(repairContext.characterStates, null, 2) : "none"}

Previous theme signals:
${repairContext ? JSON.stringify(repairContext.themeSignals, null, 2) : "none"}

Validation errors:
${repairContext ? repairContext.errors.join("\n") : "none"}`
    }
  ];
}

async function callModel(body: AnalyzeBody, repairContext?: { graph: NovelWorldGraph; characterStates: NovelCharacterStatePoint[]; themeSignals: NovelThemeSignal[]; errors: string[] }) {
  const provider = body.provider || (process.env.AI_PROVIDER as Provider) || "deepseek";
  const config = providerConfig[provider] || providerConfig.deepseek;
  if (!config.apiKey) {
    return { mock: true, content: "", json: createFallbackNovelWorldGraph(body.title || body.chapter?.title, body.genreTone || body.chapter?.genreTone, body.chapter?.rawText || body.fragment) };
  }

  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.model, messages: buildMessages(body, repairContext), response_format: { type: "json_object" }, temperature: 0.25, max_tokens: 8192 })
  });
  if (!response.ok) throw new Error(`Model API returned ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return { mock: false, content: data?.choices?.[0]?.message?.content || "", json: null };
}

async function analyzeNovelWorld(body: AnalyzeBody) {
  const evidenceChapter = body.chapter ? createNovelLongChapterText({ chapterId: body.chapter.id, order: body.chapter.order, title: body.chapter.title, rawText: body.chapter.rawText }) : null;
  const evidenceChapters: NovelLongChapterText[] = evidenceChapter ? [{ ...evidenceChapter, paragraphs: body.paragraphs?.length ? body.paragraphs : evidenceChapter.paragraphs }] : [];
  const sourceText = body.chapter?.rawText || body.fragment || "";
  const baseThemeRegistry = normalizeNovelThemeRegistry(body.themeContext);

  let graph: NovelWorldGraph | null = null;
  let characterStates: NovelCharacterStatePoint[] = [];
  let themeSignals: NovelThemeSignal[] = [];
  let themeCandidates: NovelThemeDefinition[] = [];
  let validation = null as ReturnType<typeof validateNovelWorldGraph> | null;
  let characterValidation = null as ReturnType<typeof validateNovelCharacterStatePoints> | null;
  let themeValidation = null as ReturnType<typeof validateNovelThemeSignals> | null;
  let mock = false;

  if (!sourceText.trim()) {
    graph = createFallbackNovelWorldGraph(body.title || body.chapter?.title, body.genreTone || body.chapter?.genreTone, sourceText);
    const evidenceIndex = evidenceChapter ? createFallbackEvidenceIndex(evidenceChapter) : undefined;
    if (evidenceChapter && evidenceIndex) graph = attachFallbackEvidenceToGraph(graph, evidenceChapter, evidenceIndex);
    characterStates = createFallbackNovelCharacterStates(graph, evidenceChapter || undefined, evidenceIndex);
    themeSignals = createFallbackNovelThemeSignals(graph, characterStates, evidenceChapter || undefined, evidenceIndex, baseThemeRegistry);
    validation = evidenceChapter ? validateEvidenceAwareNovelWorldGraph(graph, evidenceChapters) : validateNovelWorldGraph(graph);
    characterValidation = validateNovelCharacterStatePoints(characterStates, graph, evidenceChapters);
    themeValidation = validateNovelThemeSignals(themeSignals, baseThemeRegistry, graph, evidenceChapters);
    return { mock: true, graph, characterStates, themeSignals, themeCandidates, validation: combineValidation(validation, characterValidation, themeValidation), characterValidation, themeValidation, repaired: false };
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const repairErrors = [...(validation?.errors || []), ...(characterValidation?.errors || []), ...(themeValidation?.errors || [])];
    const result = await callModel(body, attempt > 0 && graph ? { graph, characterStates, themeSignals, errors: repairErrors } : undefined);
    mock = result.mock;
    const parsed = result.mock ? result.json : extractJsonObject(result.content);
    graph = normalizeNovelWorldGraph(parsed);
    characterStates = normalizeNovelCharacterStatePoints((parsed as Record<string, unknown>)?.characterStates);
    themeCandidates = normalizeNovelThemeRegistry((parsed as Record<string, unknown>)?.themeCandidates).filter((theme) => theme.status === "pending");
    const themeRegistry = normalizeNovelThemeRegistry([...baseThemeRegistry, ...themeCandidates]);
    themeSignals = normalizeNovelThemeSignals((parsed as Record<string, unknown>)?.themeSignals, themeRegistry);
    const evidenceIndex = evidenceChapter ? createFallbackEvidenceIndex(evidenceChapter) : undefined;
    if (evidenceChapter && result.mock && evidenceIndex) graph = attachFallbackEvidenceToGraph(graph, evidenceChapter, evidenceIndex);
    if (result.mock || (evidenceChapter && !characterStates.length)) characterStates = createFallbackNovelCharacterStates(graph, evidenceChapter || undefined, evidenceIndex);
    if (result.mock || (evidenceChapter && !themeSignals.length)) themeSignals = createFallbackNovelThemeSignals(graph, characterStates, evidenceChapter || undefined, evidenceIndex, themeRegistry);
    validation = evidenceChapter ? validateEvidenceAwareNovelWorldGraph(graph, evidenceChapters) : validateNovelWorldGraph(graph);
    characterValidation = validateNovelCharacterStatePoints(characterStates, graph, evidenceChapters);
    themeValidation = validateNovelThemeSignals(themeSignals, themeRegistry, graph, evidenceChapters);
    if (validation.valid && characterValidation.valid && themeValidation.valid) {
      return { mock, graph, characterStates, themeSignals, themeCandidates, validation: combineValidation(validation, characterValidation, themeValidation), characterValidation, themeValidation, repaired: attempt > 0 };
    }
    if (result.mock) break;
  }

  if (!graph || !validation) {
    graph = createFallbackNovelWorldGraph(body.title || body.chapter?.title, body.genreTone || body.chapter?.genreTone, sourceText);
    const evidenceIndex = evidenceChapter ? createFallbackEvidenceIndex(evidenceChapter) : undefined;
    if (evidenceChapter && evidenceIndex) graph = attachFallbackEvidenceToGraph(graph, evidenceChapter, evidenceIndex);
    characterStates = createFallbackNovelCharacterStates(graph, evidenceChapter || undefined, evidenceIndex);
    themeSignals = createFallbackNovelThemeSignals(graph, characterStates, evidenceChapter || undefined, evidenceIndex, baseThemeRegistry);
    validation = evidenceChapter ? validateEvidenceAwareNovelWorldGraph(graph, evidenceChapters) : validateNovelWorldGraph(graph);
    characterValidation = validateNovelCharacterStatePoints(characterStates, graph, evidenceChapters);
    themeValidation = validateNovelThemeSignals(themeSignals, baseThemeRegistry, graph, evidenceChapters);
    mock = true;
  } else if (!characterValidation?.valid || !themeValidation?.valid) {
    const evidenceIndex = evidenceChapter ? createFallbackEvidenceIndex(evidenceChapter) : undefined;
    if (!characterValidation?.valid) characterStates = createFallbackNovelCharacterStates(graph, evidenceChapter || undefined, evidenceIndex);
    characterValidation = validateNovelCharacterStatePoints(characterStates, graph, evidenceChapters);
    themeSignals = createFallbackNovelThemeSignals(graph, characterStates, evidenceChapter || undefined, evidenceIndex, baseThemeRegistry);
    themeValidation = validateNovelThemeSignals(themeSignals, baseThemeRegistry, graph, evidenceChapters);
    mock = true;
  }

  return { mock, graph, characterStates, themeSignals, themeCandidates, validation: combineValidation(validation, characterValidation, themeValidation), characterValidation, themeValidation, repaired: true };
}

function combineValidation(
  graphValidation: ReturnType<typeof validateNovelWorldGraph>,
  characterValidation: ReturnType<typeof validateNovelCharacterStatePoints> | null,
  themeValidation: ReturnType<typeof validateNovelThemeSignals> | null = null
) {
  return {
    valid: graphValidation.valid && (characterValidation?.valid ?? true) && (themeValidation?.valid ?? true),
    errors: [...graphValidation.errors, ...(characterValidation?.errors || []), ...(themeValidation?.errors || [])],
    warnings: [...graphValidation.warnings, ...(characterValidation?.warnings || []), ...(themeValidation?.warnings || [])]
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnalyzeBody;
    const result = await analyzeNovelWorld(body);
    let runtime = null;
    if (body.chapter?.id && result.graph) {
      const chapter = createNovelLongChapterText({ chapterId: body.chapter.id, order: body.chapter.order || 1, title: body.chapter.title || result.graph.title, rawText: body.chapter.rawText || body.fragment || "" });
      const project = addNovelChapterAnalysis(createNovelWorldProject({ title: result.graph.title, genreTone: result.graph.genreTone }), {
        input: { id: chapter.chapterId, order: chapter.order, title: chapter.title, fragment: chapter.rawText, genreTone: result.graph.genreTone },
        status: "ready",
        graph: result.graph,
        characterStates: result.characterStates,
        themeSignals: result.themeSignals,
        validation: result.validation,
        analyzedAt: new Date().toISOString()
      });
      runtime = createNovelRuntimeFromProject(project, [chapter], { [chapter.chapterId]: createFallbackEvidenceIndex(chapter) });
    }
    return NextResponse.json({ ok: true, data: { ...result, runtime: runtime ? { projectId: runtime.project.id, simulationRunId: runtime.simulationRuns[0]?.id } : null } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: { code: "NOVEL_ANALYZE_FAILED", message: error instanceof Error ? error.message : "Unknown error" } }, { status: 500 });
  }
}
