import { errorResponse, fail, adminOk, adminGuard, readJson } from "@/app/api/v1/_utils";
import { loadRuntimeWorld } from "@/app/api/v1/_town-runtime";
import { commandsForRun, executeReplayFromCheckpoint, snapshotsForRun, type WorldReplayDigest } from "@/lib/engine";

export async function POST(request: Request) {
  try {
    const unauthorized = adminGuard(request);
    if (unauthorized) return unauthorized;
    const body = await readJson<{
      worldId?: string;
      runId?: string;
      startSnapshotId?: string;
      targetSnapshotId?: string;
      branchId?: string;
      steps?: number;
      expectedDigest?: WorldReplayDigest | null;
    }>(request, {});
    if (!body.worldId || !body.runId || !body.startSnapshotId) {
      return fail("BAD_REQUEST", "worldId, runId, and startSnapshotId are required");
    }
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const runSnapshots = snapshotsForRun(loaded.runtime, body.runId);
    const startSnapshot = runSnapshots.find((snapshot) => snapshot.id === body.startSnapshotId);
    if (!startSnapshot) return fail("SNAPSHOT_NOT_FOUND", "Replay start snapshot not found", 404);
    const targetSnapshot = body.targetSnapshotId
      ? runSnapshots.find((snapshot) => snapshot.id === body.targetSnapshotId)
      : undefined;
    if (body.targetSnapshotId && !targetSnapshot) return fail("SNAPSHOT_NOT_FOUND", "Replay target snapshot not found", 404);
    const commands = commandsForRun(loaded.runtime, body.runId);
    const result = executeReplayFromCheckpoint({
      runId: body.runId,
      branchId: body.branchId,
      world: loaded.world,
      events: loaded.events,
      startSnapshot,
      commands,
      steps: body.steps ?? (targetSnapshot ? Math.max(1, targetSnapshot.tick - startSnapshot.tick) : undefined),
      expectedDigest: body.expectedDigest || targetSnapshot?.replayDigest || null
    });
    return adminOk({
      status: result.status,
      runId: result.runId,
      branchId: result.branchId,
      startSnapshotId: startSnapshot.id,
      targetSnapshotId: targetSnapshot?.id,
      steps: result.steps,
      appliedCommandIds: result.appliedCommandIds,
      digest: result.digest,
      failures: result.failures
    });
  } catch (error) {
    return errorResponse(error);
  }
}
