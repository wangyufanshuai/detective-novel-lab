import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { extractCase, getRuntimeCandidate, loadRuntimeWorld, publicWorld } from "@/app/api/v1/_town-runtime";
import { buildTownEmergenceQueue } from "@/lib/engine";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ worldId?: string; candidateId?: string }>(request, {});
    if (!body.worldId) return fail("BAD_REQUEST", "worldId is required");
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const fallbackQueue = buildTownEmergenceQueue(loaded.world, loaded.events, loaded.runtime);
    const candidate =
      getRuntimeCandidate(loaded.runtime, body.candidateId) ||
      fallbackQueue.candidates.find((item) => body.candidateId && item.id === body.candidateId) ||
      fallbackQueue.candidates[0] ||
      null;
    if (!candidate) return fail("BAD_REQUEST", "No case candidate is available", 404);
    const result = extractCase(loaded.world, loaded.events, candidate);
    return ok({ world: publicWorld(result.world), events: result.events, activeCase: result.activeCase, candidate: result.candidate, queue: result.queue });
  } catch (error) {
    return errorResponse(error);
  }
}
