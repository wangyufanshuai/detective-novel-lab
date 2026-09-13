import { errorResponse, fail, adminOk, adminGuard, readJson } from "@/app/api/v1/_utils";
import { loadRuntimeWorld, updateRunJobStatus } from "@/app/api/v1/_town-runtime";

export async function POST(request: Request) {
  try {
    const unauthorized = adminGuard(request);
    if (unauthorized) return unauthorized;
    const body = await readJson<{ worldId?: string; jobId?: string }>(request, {});
    if (!body.worldId || !body.jobId) return fail("BAD_REQUEST", "worldId and jobId are required");
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const job = updateRunJobStatus(loaded.world, loaded.runtime, body.jobId, "running");
    if (!job) return fail("RUN_JOB_NOT_FOUND", "Run job not found", 404);
    return adminOk({ job });
  } catch (error) {
    return errorResponse(error);
  }
}
