import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { loadRuntimeWorld, publicRuntime, publicSnapshot, publicWorld, runScenario } from "@/app/api/v1/_town-runtime";
import type { ScenarioConfig } from "@/lib/engine";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ worldId?: string; config?: ScenarioConfig }>(request, {});
    if (!body.worldId) return fail("BAD_REQUEST", "worldId is required");
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const result = runScenario(loaded.world, loaded.events, body.config || {});
    return ok({
      world: publicWorld(result.world),
      runtime: publicRuntime(result.runtime),
      events: result.events,
      run: result.run,
      report: result.report,
      snapshots: result.snapshots.map(publicSnapshot)
    });
  } catch (error) {
    return errorResponse(error);
  }
}
