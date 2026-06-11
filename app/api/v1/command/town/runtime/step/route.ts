import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { loadRuntimeWorld, stepRuntime } from "@/app/api/v1/_town-runtime";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ worldId?: string; steps?: number }>(request, {});
    if (!body.worldId) return fail("BAD_REQUEST", "worldId is required");
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const result = stepRuntime(loaded.world, loaded.events, body.steps || 1, "running");
    return ok({ runtime: result.runtime, events: result.events, queue: result.queue, world: result.world });
  } catch (error) {
    return errorResponse(error);
  }
}
