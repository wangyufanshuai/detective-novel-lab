import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { loadRuntimeWorld } from "@/app/api/v1/_town-runtime";

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const worldId = new URL(request.url).searchParams.get("worldId");
    const { jobId } = await context.params;
    if (!worldId) return fail("BAD_REQUEST", "worldId is required");
    const loaded = loadRuntimeWorld(worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const job = (loaded.runtime.runJobs || []).find((item) => item.id === jobId);
    if (!job) return fail("RUN_JOB_NOT_FOUND", "Run job not found", 404);
    return ok({ job });
  } catch (error) {
    return errorResponse(error);
  }
}
