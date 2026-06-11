import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { findCorrectionPatch, getNovelCorrectionContext, upsertCorrectionPatch } from "@/app/api/v1/_novel-correction";
import { validateNovelCorrectionSet } from "@/lib/engine";

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
    if (!patch) return fail("BAD_REQUEST", "No correction patch is available to apply");
    const candidateSet = { ...context.correctionSet, patches: [{ ...patch, status: "applied" as const }, ...context.correctionSet.patches.filter((item) => item.id !== patch.id)] };
    const validation = validateNovelCorrectionSet(candidateSet, context.record.project, context.record.chapters);
    if (!validation.valid) return fail("BAD_REQUEST", validation.errors[0] || "Correction patch failed validation");
    const nextRecord = upsertCorrectionPatch(context.record, patch, "applied");
    const nextContext = getNovelCorrectionContext(nextRecord.project.id);
    return ok({
      projectId: nextRecord.project.id,
      correctionSet: nextRecord.correctionSet,
      patch: nextRecord.correctionSet.patches.find((item) => item.id === patch.id),
      auditReport: nextContext?.auditReport,
      correctedProject: nextContext?.correctedProject,
      updatedAt: nextRecord.updatedAt
    });
  } catch (error) {
    return errorResponse(error);
  }
}
