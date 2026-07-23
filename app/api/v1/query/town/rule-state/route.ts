import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { loadRuntimeWorld } from "@/app/api/v1/_town-runtime";
import { buildTownRuleSnapshotSummary, ensureTownRuleRuntimeState } from "@/lib/engine";

export async function GET(request: Request) {
  try {
    const worldId = new URL(request.url).searchParams.get("worldId");
    if (!worldId) return fail("BAD_REQUEST", "worldId is required");
    const loaded = loadRuntimeWorld(worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const ruleState = ensureTownRuleRuntimeState(loaded.world, loaded.runtime);
    return ok({
      worldId: loaded.world.id,
      tick: loaded.runtime.tick,
      ruleState: buildTownRuleSnapshotSummary(ruleState)
    });
  } catch (error) {
    return errorResponse(error);
  }
}
