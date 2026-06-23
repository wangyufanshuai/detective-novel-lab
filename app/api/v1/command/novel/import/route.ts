import { errorResponse, ok, readJson } from "@/app/api/v1/_utils";
import { createNovelRuntimeFromProject, saveNovelRuntimeRecord } from "@/app/api/v1/_novel-store";
import {
  addNovelChapterAnalysis,
  attachFallbackEvidenceToGraph,
  commitNovelImportDraftToProject,
  createFallbackEvidenceIndex,
  createFallbackNovelCharacterStates,
  createFallbackNovelThemeSignals,
  createFallbackNovelWorldGraph,
  createNovelBatchQueue,
  normalizeNovelImportDraft,
  splitWholeNovelIntoChapterCandidates,
  validateEvidenceAwareNovelWorldGraph,
  validateNovelImportDraft
} from "@/lib/engine";

type ImportBody = {
  title?: string;
  sourceNote?: string;
  rawText?: string;
  genreTone?: string;
  maxCandidates?: number;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<ImportBody>(request, {});
    const rawText = body.rawText?.trim() || [
      "Chapter 1 Rain Gate",
      "Lin Yao entered Rain Gate City as old formation lines glowed under the rain.",
      "",
      "Chapter 2 Intercept",
      "Shen Qiu intercepted him near the gate and recognized the cracked jade slip from an old missing-person case.",
      "",
      "Chapter 3 Sect Order",
      "Before midnight, Qingyun Sect ordered outsiders surrendered and records destroyed."
    ].join("\n");
    const draft = splitWholeNovelIntoChapterCandidates({ title: body.title || "Rain Gate", sourceNote: body.sourceNote || "Agent API import", rawText });
    const limitedDraft = normalizeNovelImportDraft({
      ...draft,
      candidates: draft.candidates.slice(0, Math.max(1, Math.min(24, body.maxCandidates || draft.candidates.length)))
    });
    const importValidation = validateNovelImportDraft(limitedDraft);
    const committed = commitNovelImportDraftToProject(limitedDraft, { genreTone: body.genreTone || "Living world / mystery" });
    const evidenceIndexes = Object.fromEntries(committed.chapters.map((chapter) => [chapter.chapterId, createFallbackEvidenceIndex(chapter)]));
    let project = committed.project;
    for (const chapter of committed.chapters) {
      const evidenceIndex = evidenceIndexes[chapter.chapterId];
      const graph = attachFallbackEvidenceToGraph(createFallbackNovelWorldGraph(chapter.title, project.genreTone, chapter.rawText), chapter, evidenceIndex);
      const characterStates = createFallbackNovelCharacterStates(graph, chapter, evidenceIndex);
      const themeSignals = createFallbackNovelThemeSignals(graph, characterStates, chapter, evidenceIndex, project.themeRegistry);
      project = addNovelChapterAnalysis(project, {
        input: { id: chapter.chapterId, order: chapter.order, title: chapter.title, fragment: chapter.rawText, genreTone: project.genreTone },
        status: "ready",
        graph,
        characterStates,
        themeSignals,
        validation: validateEvidenceAwareNovelWorldGraph(graph, [chapter]),
        analyzedAt: new Date().toISOString()
      });
    }
    const created = createNovelRuntimeFromProject(project, committed.chapters, evidenceIndexes);
    const record = saveNovelRuntimeRecord({ ...created, batchQueue: createNovelBatchQueue(created.project, 3) });
    return ok({
      project: record.project,
      chapters: record.chapters.map((chapter) => ({ chapterId: chapter.chapterId, order: chapter.order, title: chapter.title, paragraphCount: chapter.paragraphs.length })),
      importDraft: limitedDraft,
      importValidation,
      simulationRunId: record.simulationRuns[0]?.id,
      updatedAt: record.updatedAt
    });
  } catch (error) {
    return errorResponse(error);
  }
}
