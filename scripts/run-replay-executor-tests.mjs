import assert from "node:assert/strict";
import { loadEngineForTool } from "./load-engine-for-tools.mjs";

const engine = await loadEngineForTool("replay-executor");
const world = engine.createInitialWorld("replay-executor-seed", { mode: "advanced", npcCount: 8, timelineHours: 24 });
const simulated = engine.simulateDailyLife(world, 1, []);
const startSnapshot = engine.createTownStateSnapshot(simulated.world, simulated.events, {
  id: "snapshot-replay-executor-contract",
  label: "Replay executor contract",
  mode: "checkpoint"
});
const commands = [{
  id: "command-replay-executor-contract",
  runId: "run-replay-executor-contract",
  branchId: "branch-a",
  type: "scenario-intervention",
  createdAt: "2040-01-01T00:00:00.000Z",
  payload: {
    atTickOffset: 1,
    intervention: { actorId: simulated.world.npcs[0].id, kind: "resource", value: "resource:contract" }
  }
}];
const first = engine.executeReplayFromCheckpoint({
  runId: "run-replay-executor-contract",
  branchId: "branch-a",
  world: simulated.world,
  events: simulated.events,
  startSnapshot,
  commands,
  steps: 3
});
assert.equal(first.status, "evidence-insufficient", "execution without an expected receipt stays evidence-insufficient");
assert.equal(first.appliedCommandIds.length, 1);
const second = engine.executeReplayFromCheckpoint({
  runId: "run-replay-executor-contract",
  branchId: "branch-a",
  world: simulated.world,
  events: simulated.events,
  startSnapshot,
  commands,
  steps: 3,
  expectedDigest: first.digest
});
assert.equal(second.status, "verified", "same checkpoint and command stream reproduce the digest");
assert.equal(second.digest?.combinedDigest, first.digest?.combinedDigest);
assert.equal(simulated.world.persistentRuntime, undefined, "isolated replay does not attach runtime to the source world");

const driftedWorld = structuredClone(simulated.world);
driftedWorld.persistentRuntime = structuredClone(startSnapshot.checkpoint.runtime);
driftedWorld.persistentRuntime.currentExperiment.ruleCatalogHash = "h-rule-catalog-drift";
const compatibilityMismatch = engine.executeReplayFromCheckpoint({
  runId: "run-replay-executor-contract",
  branchId: "branch-a",
  world: driftedWorld,
  events: simulated.events,
  startSnapshot,
  commands,
  steps: 3,
  expectedDigest: first.digest
});
assert.equal(compatibilityMismatch.status, "mismatch", "live world package drift is rejected before execution");
assert.equal(compatibilityMismatch.failures[0].code, "compatibility-mismatch");

const missingCheckpoint = engine.executeReplayFromCheckpoint({
  runId: "run-replay-executor-contract",
  branchId: "branch-a",
  world: simulated.world,
  events: simulated.events,
  startSnapshot: { ...startSnapshot, checkpoint: undefined },
  commands
});
assert.equal(missingCheckpoint.status, "evidence-insufficient");
assert.equal(missingCheckpoint.failures[0].code, "checkpoint-required");

console.log(JSON.stringify({
  ok: true,
  suite: "replay-executor",
  status: second.status,
  digest: second.digest?.combinedDigest,
  appliedCommandIds: second.appliedCommandIds
}));
