import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { getScenarioPack, loadRuntimeWorld } from "@/app/api/v1/_town-runtime";

export async function GET(request: Request, context: { params: Promise<{ packId: string }> }) {
  try {
    const worldId = new URL(request.url).searchParams.get("worldId");
    const { packId } = await context.params;
    if (!worldId) return fail("BAD_REQUEST", "worldId is required");
    const loaded = loadRuntimeWorld(worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const pack = getScenarioPack(loaded.world, loaded.runtime, packId);
    if (!pack) return fail("SCENARIO_PACK_NOT_FOUND", "ScenarioPack not found", 404);
    return ok({ pack });
  } catch (error) {
    return errorResponse(error);
  }
}
