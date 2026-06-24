import {
  addNovelChapterAnalysis,
  applyNovelCorrectionOverlay,
  attachFallbackEvidenceToGraph,
  createFallbackEvidenceIndex,
  createFallbackNovelCharacterStates,
  createFallbackNovelThemeSignals,
  createFallbackNovelWorldGraph,
  createNovelCorrectionSet,
  createNovelLongChapterText,
  createNovelSimulationRun,
  createNovelWorldProject,
  createNovelProjectRevision,
  normalizeNovelBatchQueue,
  normalizeNovelCorrectionSet,
  normalizeNovelEntityIdentityRegistry,
  validateNovelWorldGraph,
  type NovelChapterAnalysis,
  type NovelEvidenceIndex,
  type NovelLongChapterText,
  type NovelPersistentWorkspace,
  type NovelProjectSummary,
  type NovelWorldProject
} from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";

export type NovelRuntimeRecord = NovelPersistentWorkspace;

function nowIso() {
  return new Date().toISOString();
}

function createDemoProject(): NovelRuntimeRecord {
  let project = createNovelWorldProject({ id: "living-world-lab-demo", title: "Rain Gate", genreTone: "Eastern fantasy / mystery" });
  const chapter = createNovelLongChapterText({
    chapterId: "chapter-1",
    order: 1,
    title: "Rain Gate Opens",
    rawText: [
      "Lin Yao entered Rain Gate City as the old formation lines glowed under the rain.",
      "Shen Qiu intercepted him near the gate and recognized the cracked jade slip from an old missing-person case.",
      "Before midnight, Qingyun Sect ordered outsiders surrendered and records destroyed."
    ].join("\n\n")
  });
  const evidenceIndex = createFallbackEvidenceIndex(chapter);
  const graph = attachFallbackEvidenceToGraph(createFallbackNovelWorldGraph("Rain Gate", "Eastern fantasy / mystery", chapter.rawText), chapter, evidenceIndex);
  const validation = validateNovelWorldGraph(graph);
  const characterStates = createFallbackNovelCharacterStates(graph, chapter, evidenceIndex);
  const themeSignals = createFallbackNovelThemeSignals(graph, characterStates, chapter, evidenceIndex, project.themeRegistry);
  const analysis: NovelChapterAnalysis = {
    input: { id: chapter.chapterId, order: chapter.order, title: chapter.title, fragment: chapter.rawText, genreTone: project.genreTone },
    status: "ready",
    graph,
    characterStates,
    themeSignals,
    validation,
    analyzedAt: nowIso()
  };
  project = addNovelChapterAnalysis(project, analysis);
  const run = createNovelSimulationRun(project, { seed: "living-world-lab-demo", mode: "grounded-replay" });
  return {
    version: 1,
    project,
    chapters: [chapter],
    evidenceIndexes: { [chapter.chapterId]: evidenceIndex },
    simulationRuns: [run],
    correctionSet: createNovelCorrectionSet(project),
    batchQueue: normalizeNovelBatchQueue(project),
    updatedAt: nowIso()
  };
}

export function getNovelRuntimeRecord(projectId?: string | null) {
  const record = projectId ? worldRepository.getNovelProject(projectId) : worldRepository.getLatestNovelProject();
  if (record) return record;
  if (!projectId && worldRepository.listNovelProjects().length === 0) {
    return saveNovelRuntimeRecord(createDemoProject());
  }
  return null;
}

export function saveNovelRuntimeRecord(record: NovelRuntimeRecord, expectedUpdatedAt?: string | null) {
  const project = {
    ...record.project,
    identityRegistry: normalizeNovelEntityIdentityRegistry(record.project.identityRegistry)
  };
  const correctionSet = normalizeNovelCorrectionSet(record.correctionSet, project);
  const effectiveProject = applyNovelCorrectionOverlay(project, correctionSet);
  const effectiveRevision = createNovelProjectRevision(effectiveProject);
  const next: NovelRuntimeRecord = {
    ...record,
    version: 1,
    project,
    correctionSet,
    simulationRuns: record.simulationRuns.map((run) => run.projectRevision && run.projectRevision !== effectiveRevision
      ? {
          ...run,
          status: "blocked",
          stale: true,
          staleReason: "The effective world graph changed after this replay was created. Rebuild the replay before advancing.",
          warnings: Array.from(new Set([...run.warnings, "Replay is stale because the effective project revision changed."]))
        }
      : run),
    batchQueue: normalizeNovelBatchQueue(project, record.batchQueue),
    updatedAt: record.updatedAt || nowIso()
  };
  return worldRepository.saveNovelProject(next, expectedUpdatedAt);
}

export function listNovelRuntimeProjects(): NovelProjectSummary[] {
  return worldRepository.listNovelProjects();
}

export function getEffectiveNovelProject(record: NovelRuntimeRecord) {
  return applyNovelCorrectionOverlay(
    { ...record.project, identityRegistry: normalizeNovelEntityIdentityRegistry(record.project.identityRegistry) },
    normalizeNovelCorrectionSet(record.correctionSet, record.project)
  );
}

export function updateNovelRuntimeRecord(projectId: string, updater: (record: NovelRuntimeRecord) => NovelRuntimeRecord) {
  const current = getNovelRuntimeRecord(projectId);
  if (!current) return null;
  return saveNovelRuntimeRecord(updater(current));
}

export function createNovelRuntimeFromProject(
  project: NovelWorldProject,
  chapters: NovelLongChapterText[] = [],
  evidenceIndexes: Record<string, NovelEvidenceIndex> = {}
) {
  const run = createNovelSimulationRun(project, { seed: `${project.id}:agent-runtime`, mode: "grounded-replay" });
  return saveNovelRuntimeRecord({
    version: 1,
    project,
    chapters,
    evidenceIndexes,
    simulationRuns: [run],
    correctionSet: createNovelCorrectionSet(project),
    batchQueue: normalizeNovelBatchQueue(project),
    updatedAt: nowIso()
  });
}
