import { adminGuard, adminOk, errorResponse, fail, readJson } from "@/app/api/v1/_utils";
import { applyPopulationFlow, type PopulationFlowInput } from "@/lib/engine";
import { loadRuntimeWorld, persistRuntimeWorld, publicRuntime, publicWorld } from "@/app/api/v1/_town-runtime";

export async function POST(request: Request) {
  try {
    const unauthorized = adminGuard(request);
    if (unauthorized) return unauthorized;
    const body = await readJson<Partial<PopulationFlowInput> & { worldId?: string }>(request, {});
    if (typeof body.worldId !== "string" || !body.worldId || typeof body.sourceEventId !== "string" || !body.sourceEventId) {
      return fail("BAD_REQUEST", "worldId and sourceEventId are required");
    }
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    if (!loaded.events.some((event) => event.id === body.sourceEventId)) {
      return fail("BAD_REQUEST", "sourceEventId must resolve in the authoritative world event log");
    }
    const result = applyPopulationFlow(loaded.world, loaded.runtime, loaded.events, {
      sourceEventId: body.sourceEventId,
      sourceCandidateId: body.sourceCandidateId,
      reason: body.reason,
      arrivalLocationId: body.arrivalLocationId,
      day: body.day,
      time: body.time
    });
    const nextWorld = result.world as typeof loaded.world;
    nextWorld.persistentRuntime = result.runtime;
    if (result.created) persistRuntimeWorld(nextWorld, result.createdEvents);
    return adminOk({
      created: result.created,
      populationFlow: result.record,
      arrivalEvent: result.event,
      runtime: publicRuntime(result.runtime),
      world: publicWorld(nextWorld)
    });
  } catch (error) {
    return errorResponse(error);
  }
}
