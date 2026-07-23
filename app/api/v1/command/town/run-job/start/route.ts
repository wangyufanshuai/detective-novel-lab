import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { loadRuntimeWorld, startRunJob } from "@/app/api/v1/_town-runtime";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ worldId?: string; kind?: "scenario" | "benchmark"; scenarioId?: string; seedCount?: 10 | 20 }>(request, {});
    if (!body.worldId) return fail("BAD_REQUEST", "worldId is required");
    const kind = body.kind || "scenario";
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    return ok({ job: startRunJob(loaded.world, loaded.runtime, kind, body.scenarioId, body.seedCount) });
  } catch (error) {
    return errorResponse(error);
  }
}
