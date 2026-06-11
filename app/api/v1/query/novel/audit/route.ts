import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { getNovelCorrectionContext } from "@/app/api/v1/_novel-correction";

export async function GET(request: Request) {
  try {
    const projectId = new URL(request.url).searchParams.get("projectId");
    const context = getNovelCorrectionContext(projectId);
    if (!context) return fail("NOVEL_PROJECT_NOT_FOUND", "Novel project not found", 404);
    return ok({
      projectId: context.record.project.id,
      auditReport: context.auditReport,
      correctionValidation: context.correctionValidation,
      correctedValidation: context.correctedValidation,
      suggestedPatches: context.suggestedPatches,
      updatedAt: context.record.updatedAt
    });
  } catch (error) {
    return errorResponse(error);
  }
}
