import { errorResponse, fail, adminOk, adminGuard, readJson } from "@/app/api/v1/_utils";
import { createRuntimeForWorld, loadRuntimeWorld, persistRuntimeWorld, publicRuntime } from "@/app/api/v1/_town-runtime";

export async function POST(request: Request) {
  try {
    const unauthorized = adminGuard(request);
    if (unauthorized) return unauthorized;
    const body = await readJson<{ worldId?: string }>(request, {});
    if (!body.worldId) return fail("BAD_REQUEST", "worldId is required");
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    // Reset replaces the simulation state while preserving the persisted CAS
    // counter. A fresh runtime starts without a revision by design, but the
    // repository still contains the previous commandRevision; carrying it
    // forward lets persistRuntimeWorld advance the counter atomically instead
    // of treating a normal reset as a stale write.
    const currentRevision = loaded.runtime.commandRevision || 0;
    const resetRuntime = createRuntimeForWorld(loaded.world, loaded.events);
    resetRuntime.commandRevision = currentRevision;
    loaded.world.persistentRuntime = resetRuntime;
    persistRuntimeWorld(loaded.world);
    return adminOk({ runtime: publicRuntime(loaded.world.persistentRuntime) });
  } catch (error) {
    return errorResponse(error);
  }
}
