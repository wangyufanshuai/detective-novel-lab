import {
  addNovelChapterAnalysis,
  attachFallbackEvidenceToGraph,
  createFallbackEvidenceIndex,
  createFallbackNovelCharacterStates,
  createFallbackNovelThemeSignals,
  createFallbackNovelWorldGraph,
  createNovelLongChapterText,
  createNovelSimulationRun,
  createNovelWorldProject,
  normalizeNovelBatchQueue,
  validateNovelWorldGraph,
  type NovelBatchQueueState,
  type NovelChapterAnalysis,
  type NovelEvidenceIndex,
  type NovelLongChapterText,
  type NovelSimulationRun,
  type NovelWorldProject
} from "@/lib/engine";

export type NovelRuntimeRecord = {
  project: NovelWorldProject;
  chapters: NovelLongChapterText[];
  evidenceIndexes: Record<string, NovelEvidenceIndex>;
  simulationRuns: NovelSimulationRun[];
  batchQueue?: NovelBatchQueueState;
  updatedAt: string;
};

type NovelRuntimeStore = {
  records: Map<string, NovelRuntimeRecord>;
  latestProjectId?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __detectiveTownNovelRuntimeStore: NovelRuntimeStore | undefined;
}

function store() {
  if (!globalThis.__detectiveTownNovelRuntimeStore) {
    globalThis.__detectiveTownNovelRuntimeStore = { records: new Map() };
  }
  return globalThis.__detectiveTownNovelRuntimeStore;
}

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
    project,
    chapters: [chapter],
    evidenceIndexes: { [chapter.chapterId]: evidenceIndex },
    simulationRuns: [run],
    batchQueue: normalizeNovelBatchQueue(project),
    updatedAt: nowIso()
  };
}

export function getNovelRuntimeRecord(projectId?: string | null) {
  const runtime = store();
  const id = projectId || runtime.latestProjectId;
  if (id && runtime.records.has(id)) return runtime.records.get(id) || null;
  if (!runtime.latestProjectId) {
    const demo = createDemoProject();
    saveNovelRuntimeRecord(demo);
    return demo;
  }
  return null;
}

export function saveNovelRuntimeRecord(record: NovelRuntimeRecord) {
  const runtime = store();
  const next = { ...record, updatedAt: nowIso() };
  runtime.records.set(next.project.id, next);
  runtime.latestProjectId = next.project.id;
  return next;
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
    project,
    chapters,
    evidenceIndexes,
    simulationRuns: [run],
    batchQueue: normalizeNovelBatchQueue(project),
    updatedAt: nowIso()
  });
}
