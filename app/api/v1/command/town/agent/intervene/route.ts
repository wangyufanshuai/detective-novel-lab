import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { applyRuntimeIntervention, loadRuntimeWorld } from "@/app/api/v1/_town-runtime";
import type { TownRuntimeIntervention } from "@/lib/engine";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ worldId?: string; intervention?: Omit<TownRuntimeIntervention, "id" | "tick" | "createdAt" | "branch" | "impact"> }>(request, {});
    if (!body.worldId || !body.intervention?.actorId || !body.intervention.kind) return fail("BAD_REQUEST", "worldId and intervention are required");
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const result = applyRuntimeIntervention(loaded.world, body.intervention);
    return ok({ runtime: result.runtime, intervention: result.intervention, world: result.world });
  } catch (error) {
    return errorResponse(error);
  }
}
