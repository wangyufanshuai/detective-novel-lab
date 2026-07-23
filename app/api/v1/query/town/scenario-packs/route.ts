import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { listScenarioPacks, loadRuntimeWorld } from "@/app/api/v1/_town-runtime";

export async function GET(request: Request) {
  try {
    const worldId = new URL(request.url).searchParams.get("worldId");
    if (!worldId) return fail("BAD_REQUEST", "worldId is required");
    const loaded = loadRuntimeWorld(worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    return ok({ packs: listScenarioPacks(loaded.world, loaded.runtime) });
  } catch (error) {
    return errorResponse(error);
  }
}
