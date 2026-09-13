import { errorResponse, fail, adminOk, adminGuard, readJson } from "@/app/api/v1/_utils";
import { loadRuntimeWorld, selectCurrentExperiment, startNewRunFromCurrentExperiment } from "@/app/api/v1/_town-runtime";

export async function POST(request: Request) {
  try {
    const unauthorized = adminGuard(request);
    if (unauthorized) return unauthorized;
    const body = await readJson<{ worldId?: string; scenarioPackId?: string; mapPackId?: string; ruleCatalogId?: string }>(request, {});
    if (!body.worldId) return fail("BAD_REQUEST", "worldId is required");
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    if (body.scenarioPackId || body.mapPackId || body.ruleCatalogId) selectCurrentExperiment(loaded.world, loaded.runtime, body);
    return adminOk(startNewRunFromCurrentExperiment(loaded.world, loaded.runtime));
  } catch (error) {
    if (error instanceof Error && error.name === "EXPERIMENT_PACK_NOT_FOUND") return fail("EXPERIMENT_PACK_NOT_FOUND", error.message, 404);
    return errorResponse(error);
  }
}
