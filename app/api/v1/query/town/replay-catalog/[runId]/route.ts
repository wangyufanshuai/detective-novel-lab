import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { worldRepository } from "@/lib/world/repository";

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await context.params;
    if (runId.includes("/") || runId.includes("\\") || runId.includes("..")) {
      return fail("BAD_REQUEST", "Invalid runId");
    }
    const detail = worldRepository.getReplayCatalogRun(runId);
    if (!detail) return fail("RUN_NOT_FOUND", "Replay catalog run not found", 404);
    return ok(detail);
  } catch (error) {
    return errorResponse(error);
  }
}
