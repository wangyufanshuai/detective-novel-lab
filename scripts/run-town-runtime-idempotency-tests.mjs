import assert from "node:assert/strict";
import { startReleaseCandidateServer } from "./lib/release-candidate-server.mjs";

let server;
const request = async (baseUrl, path, body, headers = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
  const json = await response.json();
  return { response, json, data: json.data || json };
};

try {
  server = await startReleaseCandidateServer({
    prefix: "town-runtime-idempotency",
    healthPath: "/api/v1/query/runtime/status",
    env: { AI_PROVIDER: "mock", DEEPSEEK_API_KEY: "", SILICONFLOW_API_KEY: "" }
  });
  const created = await request(server.baseUrl, "/api/v1/command/town/create", {
    seed: `goal12-${Date.now()}`,
    mode: "showcase",
    caseMode: "generated",
    npcCount: 8,
    timelineHours: 24
  });
  assert.equal(created.response.status, 200);
  const worldId = created.data.world.id;

  const firstStart = await request(server.baseUrl, "/api/v1/command/town/runtime/start", { worldId, steps: 1, actionId: "start-1" }, { "Idempotency-Key": "goal12-start-1" });
  assert.equal(firstStart.response.status, 200);
  assert.equal(firstStart.data.replayed, false);
  const firstTick = firstStart.data.runtime.tick;
  const firstRevision = firstStart.data.runtime.revision;
  assert.ok(firstRevision, "runtime exposes a compare-and-swap revision");
  assert.deepEqual(firstStart.data.runtime.socialProfiles, [], "player projection does not expose social ledger");
  assert.deepEqual(firstStart.data.runtime.eventObservations, [], "player projection does not expose observation ledger");

  const replayStart = await request(server.baseUrl, "/api/v1/command/town/runtime/start", { worldId, steps: 1, actionId: "start-1" }, { "Idempotency-Key": "goal12-start-1" });
  assert.equal(replayStart.response.status, 200);
  assert.equal(replayStart.response.headers.get("x-idempotent-replay"), "true");
  assert.equal(replayStart.data.replayed, true);
  assert.equal(replayStart.data.runtime.tick, firstTick, "duplicate start does not advance the town twice");

  const conflictingKey = await request(server.baseUrl, "/api/v1/command/town/runtime/start", { worldId, steps: 2, actionId: "start-1" }, { "Idempotency-Key": "goal12-start-1" });
  assert.equal(conflictingKey.response.status, 409, "same idempotency key with another command is rejected");

  const step = await request(server.baseUrl, "/api/v1/command/town/runtime/step", { worldId, steps: 1, sessionRevision: firstRevision, actionId: "step-1" });
  assert.equal(step.response.status, 200);
  assert.ok(step.data.runtime.tick > firstTick);
  const stale = await request(server.baseUrl, "/api/v1/command/town/runtime/step", { worldId, steps: 1, sessionRevision: firstRevision, actionId: "stale-step" });
  assert.equal(stale.response.status, 409, "stale runtime revision is rejected before mutation");

  const keyedStepBody = { worldId, steps: 1, sessionRevision: step.data.runtime.revision, actionId: "step-2" };
  const keyedStep = await request(server.baseUrl, "/api/v1/command/town/runtime/step", keyedStepBody, { "Idempotency-Key": "goal12-step-2" });
  const keyedReplay = await request(server.baseUrl, "/api/v1/command/town/runtime/step", keyedStepBody, { "Idempotency-Key": "goal12-step-2" });
  assert.equal(keyedStep.response.status, 200);
  assert.equal(keyedReplay.response.status, 200);
  assert.equal(keyedReplay.data.replayed, true);
  assert.equal(keyedReplay.data.runtime.tick, keyedStep.data.runtime.tick, "duplicate step replays the original result");

  console.log(JSON.stringify({ ok: true, suite: "town-runtime-idempotency", checks: ["start-replay", "key-conflict", "revision-cas", "step-replay", "player-projection"] }, null, 2));
} finally {
  await server?.cleanup();
}
