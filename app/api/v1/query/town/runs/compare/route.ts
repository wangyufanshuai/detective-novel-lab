import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { compareRuntimeRuns, loadRuntimeWorld } from "@/app/api/v1/_town-runtime";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const worldId = url.searchParams.get("worldId");
    const left = url.searchParams.get("left");
    const right = url.searchParams.get("right");
    if (!worldId || !left || !right) return fail("BAD_REQUEST", "worldId, left, and right are required");
    const loaded = loadRuntimeWorld(worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const comparison = compareRuntimeRuns(loaded.runtime, left, right);
    if (!comparison) return fail("RUN_NOT_FOUND", "One or both runs were not found", 404);
    return ok({ comparison });
  } catch (error) {
    return errorResponse(error);
  }
}
