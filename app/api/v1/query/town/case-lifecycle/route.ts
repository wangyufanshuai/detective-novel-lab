import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { loadRuntimeWorld } from "@/app/api/v1/_town-runtime";
import type { TownCaseLifecycleState } from "@/lib/engine";

function defaultLifecycle(): TownCaseLifecycleState {
  return {
    activeCaseIds: [],
    solvedCaseIds: [],
    failedCaseIds: [],
    caseCooldownByNpcId: {},
    casePressureByInstitutionId: {},
    nextCaseWeights: {},
    caseAftermathLog: []
  };
}

export async function GET(request: Request) {
  try {
    const worldId = new URL(request.url).searchParams.get("worldId");
    if (!worldId) return fail("BAD_REQUEST", "worldId is required");
    const loaded = loadRuntimeWorld(worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const lifecycle = loaded.runtime.caseLifecycle || defaultLifecycle();
    return ok({
      worldId: loaded.world.id,
      tick: loaded.runtime.tick,
      lifecycle,
      summary: {
        activeCaseCount: lifecycle.activeCaseIds.length,
        solvedCaseCount: lifecycle.solvedCaseIds.length,
        failedCaseCount: lifecycle.failedCaseIds.length,
        aftermathCount: lifecycle.caseAftermathLog.length,
        cooldownNpcCount: Object.keys(lifecycle.caseCooldownByNpcId).length,
        pressureInstitutionCount: Object.keys(lifecycle.casePressureByInstitutionId).length
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
