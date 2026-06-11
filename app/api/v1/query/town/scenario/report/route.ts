import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { findScenario, loadRuntimeWorld } from "@/app/api/v1/_town-runtime";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const worldId = url.searchParams.get("worldId");
    const scenarioId = url.searchParams.get("scenarioId");
    if (!worldId) return fail("BAD_REQUEST", "worldId is required");
    const loaded = loadRuntimeWorld(worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const run = findScenario(loaded.runtime, scenarioId);
    if (!run) return fail("SCENARIO_NOT_FOUND", "Scenario not found", 404);
    return ok({ report: run.report });
  } catch (error) {
    return errorResponse(error);
  }
}
