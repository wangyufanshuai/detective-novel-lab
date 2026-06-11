import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { getNovelCorrectionContext } from "@/app/api/v1/_novel-correction";

type Body = {
  projectId?: string;
  category?: string;
  severity?: string;
  limit?: number;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<Body>(request, {});
    const context = getNovelCorrectionContext(body.projectId);
    if (!context) return fail("NOVEL_PROJECT_NOT_FOUND", "Novel project not found", 404);
    const suggestions = context.suggestedPatches
      .filter((patch) => {
        const issue = context.auditReport.issues.find((item) => item.suggestedPatchId === patch.id || patch.id.includes(item.id.replace(/[^a-z0-9-]/gi, "-").toLowerCase()));
        if (body.category && issue?.category !== body.category) return false;
        if (body.severity && issue?.severity !== body.severity) return false;
        return true;
      })
      .slice(0, Math.max(1, Math.min(50, body.limit || 12)));
    return ok({
      projectId: context.record.project.id,
      auditReport: context.auditReport,
      suggestedPatches: suggestions,
      correctionSet: context.correctionSet,
      updatedAt: context.record.updatedAt
    });
  } catch (error) {
    return errorResponse(error);
  }
}
