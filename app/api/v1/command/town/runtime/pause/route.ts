import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { persistRuntimeWorld, loadRuntimeWorld } from "@/app/api/v1/_town-runtime";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ worldId?: string }>(request, {});
    if (!body.worldId) return fail("BAD_REQUEST", "worldId is required");
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    loaded.runtime.status = "paused";
    loaded.runtime.updatedAt = new Date().toISOString();
    loaded.world.persistentRuntime = loaded.runtime;
    persistRuntimeWorld(loaded.world);
    return ok({ runtime: loaded.runtime });
  } catch (error) {
    return errorResponse(error);
  }
}
