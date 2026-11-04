import { errorResponse, fail, playerOk } from "@/app/api/v1/_utils";
import { buildTownAgentControlManifest } from "@/lib/engine";
import { loadRuntimeWorld, runtimeRevision } from "@/app/api/v1/_town-runtime";

export async function GET(request: Request) {
  try {
    const worldId = new URL(request.url).searchParams.get("worldId");
    if (!worldId) return fail("BAD_REQUEST", "worldId is required");
    const loaded = loadRuntimeWorld(worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    return playerOk({
      manifest: buildTownAgentControlManifest(loaded.runtime),
      world: {
        id: loaded.world.id,
        revision: runtimeRevision(loaded.runtime),
        tick: loaded.runtime.tick,
        status: loaded.runtime.status
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
