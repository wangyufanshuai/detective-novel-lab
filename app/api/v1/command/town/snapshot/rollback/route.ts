import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { findSnapshot, loadRuntimeWorld, publicRuntime, publicSnapshot, publicWorld, rollbackToSnapshot } from "@/app/api/v1/_town-runtime";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ worldId?: string; snapshotId?: string }>(request, {});
    if (!body.worldId || !body.snapshotId) return fail("BAD_REQUEST", "worldId and snapshotId are required");
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const snapshot = findSnapshot(loaded.runtime, body.snapshotId);
    if (!snapshot) return fail("SNAPSHOT_NOT_FOUND", "Snapshot not found", 404);
    const result = rollbackToSnapshot(loaded.world, snapshot);
    return ok({ world: publicWorld(result.world), runtime: publicRuntime(result.runtime), snapshot: publicSnapshot(snapshot) });
  } catch (error) {
    return errorResponse(error);
  }
}
