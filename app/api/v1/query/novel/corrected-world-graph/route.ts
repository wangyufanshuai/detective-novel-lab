import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { getNovelCorrectionContext } from "@/app/api/v1/_novel-correction";

export async function GET(request: Request) {
  try {
    const projectId = new URL(request.url).searchParams.get("projectId");
    const context = getNovelCorrectionContext(projectId);
    if (!context) return fail("NOVEL_PROJECT_NOT_FOUND", "Novel project not found", 404);
    return ok({
      projectId: context.record.project.id,
      mode: context.correctionSet.patches.some((patch) => patch.status === "applied") ? "corrected" : "original",
      project: context.correctedProject,
      graph: context.correctedProject.mergedGraph,
      correctionSet: context.correctionSet,
      validation: context.correctedValidation,
      auditReport: context.auditReport,
      causalitySummary: {
        claims: context.causality.claims.length,
        edges: context.causality.edges.length,
        chains: context.causality.chains.length,
        gaps: context.causality.gaps.length,
        warnings: context.causality.warnings
      },
      originalGraphCounts: {
        entities: context.record.project.mergedGraph.entities.length,
        relationships: context.record.project.mergedGraph.relationships.length,
        events: context.record.project.mergedGraph.events.length
      },
      correctedGraphCounts: {
        entities: context.correctedProject.mergedGraph.entities.length,
        relationships: context.correctedProject.mergedGraph.relationships.length,
        events: context.correctedProject.mergedGraph.events.length
      },
      updatedAt: context.record.updatedAt
    });
  } catch (error) {
    return errorResponse(error);
  }
}
