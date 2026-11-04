import { errorResponse, fail, playerOk } from "@/app/api/v1/_utils";
import { buildCityPulseWorldProjection, buildTownEmergenceQueue, buildTownSituationBrief } from "@/lib/engine";
import { loadRuntimeWorld } from "@/app/api/v1/_town-runtime";

export async function GET(request: Request) {
  try {
    const worldId = new URL(request.url).searchParams.get("worldId");
    if (!worldId) return fail("BAD_REQUEST", "worldId is required");
    const loaded = loadRuntimeWorld(worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const queue = buildTownEmergenceQueue(loaded.world, loaded.events, loaded.runtime);
    const brief = buildTownSituationBrief(loaded.world, loaded.events, loaded.runtime, queue);
    return playerOk({ brief, projection: buildCityPulseWorldProjection(brief, loaded.runtime.agentStates.length) });
  } catch (error) {
    return errorResponse(error);
  }
}
