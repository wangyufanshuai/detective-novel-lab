import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { buildRuntimeReplayBundle, loadRuntimeWorld } from "@/app/api/v1/_town-runtime";

export async function GET(request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const worldId = new URL(request.url).searchParams.get("worldId");
    const { runId } = await context.params;
    if (!worldId) return fail("BAD_REQUEST", "worldId is required");
    const loaded = loadRuntimeWorld(worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const bundle = buildRuntimeReplayBundle(loaded.runtime, runId);
    if (!bundle) return fail("RUN_NOT_FOUND", "Run not found", 404);
    return ok({ bundle, fileName: `${runId}.replay-bundle.json` });
  } catch (error) {
    return errorResponse(error);
  }
}
