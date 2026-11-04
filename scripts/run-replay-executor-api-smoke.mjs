import assert from "node:assert/strict";
import { startReleaseCandidateServer } from "./lib/release-candidate-server.mjs";

const token = "replay-executor-smoke-token";
const server = await startReleaseCandidateServer({
  prefix: "replay-executor-api-smoke",
  env: { RUNTIME_ADMIN_TOKENS: token }
});

async function request(path, options = {}) {
  const response = await fetch(`${server.baseUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

try {
  const created = await request("/api/v1/command/town/create", {
    method: "POST",
    headers: { "x-runtime-admin-token": token },
    body: JSON.stringify({ seed: "replay-executor-api-smoke", mode: "showcase", caseMode: "generated", npcCount: 8, timelineHours: 24 })
  });
  assert.equal(created.response.status, 200);
  const worldId = created.body.data.world.id;
  const actorId = created.body.data.world.npcs[0].id;

  const scenario = await request("/api/v1/command/town/scenario/run", {
    method: "POST",
    headers: { "x-runtime-admin-token": token },
    body: JSON.stringify({
      worldId,
      config: {
        id: "replay-executor-api-scenario",
        name: "Replay executor API smoke",
        seed: "replay-executor-api-scenario-seed",
        baselineSteps: 3,
        branches: [{
          id: "resource-branch",
          name: "Resource branch",
          steps: 3,
          interventions: [{ atTickOffset: 1, intervention: { actorId, kind: "resource", value: "resource:api-smoke" } }]
        }]
      }
    })
  });
  assert.equal(scenario.response.status, 200, JSON.stringify(scenario.body));
  const snapshots = scenario.body.data.snapshots;
  const branchStart = snapshots.find((snapshot) => snapshot.branchId === "resource-branch" && snapshot.label.endsWith("start"));
  const branchEnd = snapshots.find((snapshot) => snapshot.branchId === "resource-branch" && snapshot.label.endsWith("end"));
  assert.ok(branchStart?.id && branchEnd?.id, "scenario response exposes branch snapshot ids");
  assert.equal(branchStart.checkpoint, undefined, "public scenario response does not expose checkpoint state");

  const missingAuth = await request("/api/v1/command/town/replay/execute", {
    method: "POST",
    body: JSON.stringify({ worldId, runId: "replay-executor-api-scenario", startSnapshotId: branchStart.id, branchId: "resource-branch" })
  });
  assert.equal(missingAuth.response.status, 401, "replay execution requires admin auth");

  const replay = await request("/api/v1/command/town/replay/execute", {
    method: "POST",
    headers: { "x-runtime-admin-token": token },
    body: JSON.stringify({
      worldId,
      runId: "replay-executor-api-scenario",
      startSnapshotId: branchStart.id,
      targetSnapshotId: branchEnd.id,
      branchId: "resource-branch"
    })
  });
  assert.equal(replay.response.status, 200, JSON.stringify(replay.body));
  assert.equal(replay.body.data.status, "verified", JSON.stringify(replay.body.data));
  assert.equal(replay.body.data.appliedCommandIds.length, 1);
  assert.ok(replay.body.data.digest?.combinedDigest, "replay returns a canonical digest");

  const sourceState = await request(`/api/v1/query/town/runtime?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(sourceState.response.status, 200);
  assert.equal(sourceState.body.data.runtime.tick, 3, "isolated replay does not advance the source runtime");

  console.log(JSON.stringify({
    ok: true,
    suite: "replay-executor-api-smoke",
    status: replay.body.data.status,
    runId: replay.body.data.runId,
    startSnapshotId: branchStart.id,
    targetSnapshotId: branchEnd.id,
    digest: replay.body.data.digest.combinedDigest,
    sourceTick: sourceState.body.data.runtime.tick
  }));
} finally {
  await server.cleanup();
}
