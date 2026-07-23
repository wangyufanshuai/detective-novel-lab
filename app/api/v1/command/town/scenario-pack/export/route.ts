import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { exportScenarioPack, loadRuntimeWorld } from "@/app/api/v1/_town-runtime";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ worldId?: string; packId?: string; scenarioId?: string }>(request, {});
    if (!body.worldId) return fail("BAD_REQUEST", "worldId is required");
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const pack = exportScenarioPack(loaded.world, loaded.runtime, { packId: body.packId, scenarioId: body.scenarioId });
    return ok({ pack, fileName: `${pack.manifest.id}.scenario-pack.json` });
  } catch (error) {
    return errorResponse(error);
  }
}
