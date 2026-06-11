import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { getNovelCorrectionContext, revertCorrection } from "@/app/api/v1/_novel-correction";

type Body = {
  projectId?: string;
  patchId?: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<Body>(request, {});
    const context = getNovelCorrectionContext(body.projectId);
    if (!context) return fail("NOVEL_PROJECT_NOT_FOUND", "Novel project not found", 404);
    const nextRecord = revertCorrection(context.record, body.patchId);
    if (!nextRecord) return fail("BAD_REQUEST", "No applied correction patch is available to revert");
    const nextContext = getNovelCorrectionContext(nextRecord.project.id);
    return ok({
      projectId: nextRecord.project.id,
      correctionSet: nextRecord.correctionSet,
      auditReport: nextContext?.auditReport,
      correctedProject: nextContext?.correctedProject,
      updatedAt: nextRecord.updatedAt
    });
  } catch (error) {
    return errorResponse(error);
  }
}
