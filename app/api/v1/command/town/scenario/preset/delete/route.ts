import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { deleteScenarioPreset, listScenarioArtifacts, loadRuntimeWorld } from "@/app/api/v1/_town-runtime";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ worldId?: string; presetId?: string }>(request, {});
    if (!body.worldId) return fail("BAD_REQUEST", "worldId is required");
    if (!body.presetId) return fail("BAD_REQUEST", "presetId is required");
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    deleteScenarioPreset(loaded.world, loaded.runtime, body.presetId);
    return ok(listScenarioArtifacts(loaded.world, loaded.runtime));
  } catch (error) {
    if (error instanceof Error && error.name === "SCENARIO_PRESET_READ_ONLY") {
      return fail("SCENARIO_PRESET_READ_ONLY", error.message, 400);
    }
    if (error instanceof Error && error.name === "SCENARIO_PRESET_NOT_FOUND") {
      return fail("SCENARIO_PRESET_NOT_FOUND", error.message, 404);
    }
    return errorResponse(error);
  }
}
