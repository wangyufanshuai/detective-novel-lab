import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { diffSnapshots, loadRuntimeWorld, publicSnapshot } from "@/app/api/v1/_town-runtime";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const worldId = url.searchParams.get("worldId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!worldId || !from || !to) return fail("BAD_REQUEST", "worldId, from, and to are required");
    const loaded = loadRuntimeWorld(worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const result = diffSnapshots(loaded.runtime, from, to);
    if (!result) return fail("SNAPSHOT_NOT_FOUND", "Snapshot not found", 404);
    return ok({ from: publicSnapshot(result.from), to: publicSnapshot(result.to), diff: result.diff });
  } catch (error) {
    return errorResponse(error);
  }
}
