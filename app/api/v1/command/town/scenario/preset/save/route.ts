import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { listScenarioArtifacts, loadRuntimeWorld, saveScenarioPreset } from "@/app/api/v1/_town-runtime";
import type { ScenarioPreset } from "@/lib/engine";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ worldId?: string; preset?: ScenarioPreset; overwrite?: boolean }>(request, {});
    if (!body.worldId) return fail("BAD_REQUEST", "worldId is required");
    if (!body.preset?.id || !body.preset?.name) return fail("BAD_REQUEST", "preset id and name are required");
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const result = saveScenarioPreset(loaded.world, loaded.runtime, body.preset, Boolean(body.overwrite));
    return ok({ preset: result.preset, ...listScenarioArtifacts(loaded.world, loaded.runtime) });
  } catch (error) {
    if (error instanceof Error && error.name === "SCENARIO_PRESET_CONFLICT") {
      return fail("SCENARIO_PRESET_CONFLICT", error.message, 409);
    }
    if (error instanceof Error && error.name === "SCENARIO_PRESET_READ_ONLY") {
      return fail("SCENARIO_PRESET_READ_ONLY", error.message, 400);
    }
    return errorResponse(error);
  }
}
