import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { findCorrectionPatch, getNovelCorrectionContext, upsertCorrectionPatch } from "@/app/api/v1/_novel-correction";

type Body = {
  projectId?: string;
  patchId?: string;
  patch?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<Body>(request, {});
    const context = getNovelCorrectionContext(body.projectId);
    if (!context) return fail("NOVEL_PROJECT_NOT_FOUND", "Novel project not found", 404);
    const patch = findCorrectionPatch(context, body.patchId, body.patch);
    if (!patch) return fail("BAD_REQUEST", "No correction patch is available to dismiss");
    const nextRecord = upsertCorrectionPatch(context.record, patch, "dismissed");
    return ok({
      projectId: nextRecord.project.id,
      correctionSet: nextRecord.correctionSet,
      patch: nextRecord.correctionSet.patches.find((item) => item.id === patch.id),
      updatedAt: nextRecord.updatedAt
    });
  } catch (error) {
    return errorResponse(error);
  }
}
