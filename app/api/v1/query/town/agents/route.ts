import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { loadRuntimeWorld } from "@/app/api/v1/_town-runtime";

export async function GET(request: Request) {
  try {
    const worldId = new URL(request.url).searchParams.get("worldId");
    if (!worldId) return fail("BAD_REQUEST", "worldId is required");
    const loaded = loadRuntimeWorld(worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    return ok({ agents: loaded.runtime.agentStates, runtimeId: loaded.runtime.id });
  } catch (error) {
    return errorResponse(error);
  }
}
