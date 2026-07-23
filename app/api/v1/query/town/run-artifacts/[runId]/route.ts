import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { loadRunArtifactManifest } from "@/app/api/v1/_run-artifacts";
import { worldRepository } from "@/lib/world/repository";

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await context.params;
    const catalogDetail = worldRepository.getReplayCatalogRun(runId);
    if (catalogDetail) return ok({ artifact: catalogDetail.run, source: "sqlite-replay-catalog" });
    const artifact = loadRunArtifactManifest(runId);
    if (!artifact) return fail("RUN_NOT_FOUND", "Run artifact not found", 404);
    return ok({ artifact });
  } catch (error) {
    return errorResponse(error);
  }
}
