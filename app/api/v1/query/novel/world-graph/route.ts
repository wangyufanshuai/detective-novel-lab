import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { getNovelRuntimeRecord } from "@/app/api/v1/_novel-store";
import { buildNovelCausalityReport, validateNovelWorldProject } from "@/lib/engine";

export async function GET(request: Request) {
  try {
    const projectId = new URL(request.url).searchParams.get("projectId");
    const record = getNovelRuntimeRecord(projectId);
    if (!record) return fail("NOVEL_PROJECT_NOT_FOUND", "Novel project not found", 404);
    const validation = validateNovelWorldProject(record.project);
    const causality = buildNovelCausalityReport(record.project);
    return ok({
      project: record.project,
      graph: record.project.mergedGraph,
      chapters: record.chapters.map((chapter) => ({ chapterId: chapter.chapterId, order: chapter.order, title: chapter.title, paragraphCount: chapter.paragraphs.length })),
      evidenceIndexes: Object.fromEntries(Object.entries(record.evidenceIndexes).map(([id, index]) => [id, { paragraphCount: index.paragraphCount, snippetCount: index.snippets.length, warnings: index.warnings }])),
      validation,
      causalitySummary: {
        claims: causality.claims.length,
        edges: causality.edges.length,
        chains: causality.chains.length,
        gaps: causality.gaps.length,
        warnings: causality.warnings
      },
      updatedAt: record.updatedAt
    });
  } catch (error) {
    return errorResponse(error);
  }
}
