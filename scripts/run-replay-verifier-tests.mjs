import assert from "node:assert/strict";
import { loadEngineForTool } from "./load-engine-for-tools.mjs";

const engine = await loadEngineForTool("replay-verifier");
const seed = "replay-verifier-seed";

function makeFixture() {
  const world = engine.createInitialWorld(seed, { mode: "advanced", npcCount: 10, timelineHours: 24 });
  world.id = "world-replay-verifier";
  world.createdAt = "2040-01-01T00:00:00.000Z";
  world.updatedAt = world.createdAt;
  const simulated = engine.simulateDailyLife(world, 1, []);
  const events = simulated.events;
  const runtime = engine.createPersistentTownRuntime(simulated.world, events, {
    now: world.createdAt,
    maxTicks: 24
  });
  runtime.id = "runtime-replay-verifier";
  runtime.createdAt = world.createdAt;
  runtime.updatedAt = world.createdAt;
  return { world: simulated.world, events, runtime };
}

const fixture = makeFixture();
const digest = engine.buildWorldReplayDigest(fixture.world, fixture.events, fixture.runtime);
const verified = engine.verifyWorldReplayDigest({
  world: fixture.world,
  events: fixture.events,
  runtime: fixture.runtime,
  expectedDigest: digest
});
assert.equal(verified.status, "verified", "a matching stored digest verifies successfully");
assert.deepEqual(verified.comparedFields, ["schema", "compatibility", "seed", "tick", "eventCount", "stateDigest", "eventDigest", "combinedDigest"]);

const changedWorld = structuredClone(fixture.world);
changedWorld.name = `${changedWorld.name} · divergence`;
const mismatch = engine.verifyWorldReplayDigest({
  world: changedWorld,
  events: fixture.events,
  runtime: fixture.runtime,
  expectedDigest: digest
});
assert.equal(mismatch.status, "mismatch", "a semantic world change fails digest verification");
assert.equal(mismatch.failures.some((failure) => failure.code === "state-digest-mismatch"), true, "state mismatch is reported with a stable failure code");

const changedCompatibility = structuredClone(digest);
changedCompatibility.compatibility.ruleCatalogHash = "h-rule-catalog-drift";
const compatibilityMismatch = engine.verifyWorldReplayDigest({
  world: fixture.world,
  events: fixture.events,
  runtime: fixture.runtime,
  expectedDigest: changedCompatibility
});
assert.equal(compatibilityMismatch.status, "mismatch", "a changed rule catalog receipt fails compatibility verification");
assert.equal(compatibilityMismatch.failures.some((failure) => failure.code === "compatibility-mismatch"), true, "compatibility drift is reported with a stable failure code");

const invalidCompatibility = structuredClone(digest);
invalidCompatibility.compatibility.tickIntervalMinutes = "30";
const invalidCompatibilityResult = engine.verifyWorldReplayDigest({
  world: fixture.world,
  events: fixture.events,
  runtime: fixture.runtime,
  expectedDigest: invalidCompatibility
});
assert.equal(invalidCompatibilityResult.status, "mismatch", "an invalid compatibility receipt fails closed");
assert.equal(invalidCompatibilityResult.failures[0].code, "invalid-expected-digest");

const insufficient = engine.verifyWorldReplayDigest({ world: fixture.world, events: fixture.events, runtime: fixture.runtime });
assert.equal(insufficient.status, "evidence-insufficient", "a live digest without a stored receipt is not promoted to verified");
assert.equal(insufficient.failures[0].code, "missing-expected-digest");
const incomplete = engine.verifyWorldReplayDigest({
  world: fixture.world,
  events: fixture.events,
  runtime: fixture.runtime,
  expectedDigest: { schema: digest.schema, combinedDigest: digest.combinedDigest }
});
assert.equal(incomplete.status, "evidence-insufficient", "a partial receipt is evidence-insufficient instead of a false verification");
assert.equal(incomplete.failures.some((failure) => failure.code === "incomplete-expected-digest"), true);

const commandSequence = [
  { id: "command-replay-verifier-1", runId: "run-replay-verifier", type: "scenario-intervention", createdAt: "2040-01-01T00:00:00.000Z" },
  { id: "command-replay-verifier-2", runId: "run-replay-verifier", type: "reviewer-action", createdAt: "2040-01-01T00:00:01.000Z" }
];
assert.equal(engine.verifyReplayCommandSequence(commandSequence, "run-replay-verifier").status, "verified", "valid command envelopes verify");
const badCommands = engine.verifyReplayCommandSequence([
  ...commandSequence,
  { ...commandSequence[0], runId: "other-run" }
], "run-replay-verifier");
assert.equal(badCommands.status, "mismatch", "cross-run command reuse fails closed");
assert.equal(badCommands.failures.some((failure) => failure.code === "command-id-duplicate"), true);
assert.equal(badCommands.failures.some((failure) => failure.code === "command-run-mismatch"), true);

const bundleVerification = engine.verifyReplayBundle({
  runId: "run-replay-verifier",
  bundle: {
    manifest: { runId: "run-replay-verifier" },
    replayDigest: digest,
    commands: commandSequence,
    snapshots: [{ id: "checkpoint-0", mode: "checkpoint", tick: digest.tick, replayDigest: digest }]
  },
  world: fixture.world,
  events: fixture.events,
  runtime: fixture.runtime
});
assert.equal(bundleVerification.status, "verified", "bundle verification combines digest, manifest, and command checks");
assert.equal(bundleVerification.checkpoints.receiptCount, 1, "checkpoint receipt is counted without exposing checkpoint state");
const manifestMismatch = engine.verifyReplayBundle({
  runId: "run-replay-verifier",
  bundle: { manifest: { runId: "other-run" }, replayDigest: digest, commands: commandSequence },
  world: fixture.world,
  events: fixture.events,
  runtime: fixture.runtime
});
assert.equal(manifestMismatch.status, "mismatch", "a bundle from another run fails closed");
assert.equal(manifestMismatch.failures[0].code, "manifest-run-mismatch");
const liveBundleVerification = engine.verifyReplayBundle({
  runId: "run-replay-verifier",
  bundle: {
    manifest: { runId: "run-replay-verifier" },
    replayDigest: digest,
    replayDigestSource: "computed-live",
    commands: commandSequence,
    snapshots: [{ id: "checkpoint-0", mode: "checkpoint", tick: digest.tick, replayDigest: digest }]
  },
  world: fixture.world,
  events: fixture.events,
  runtime: fixture.runtime
});
assert.equal(liveBundleVerification.status, "evidence-insufficient", "a query-time digest is labeled as evidence-insufficient until persisted");
assert.equal(liveBundleVerification.digestSource, "computed-live");
const legacyCheckpoint = engine.verifyReplayCheckpointReceipts([{ id: "legacy-checkpoint", mode: "checkpoint", tick: digest.tick }]);
assert.equal(legacyCheckpoint.status, "evidence-insufficient", "legacy checkpoint without a receipt stays evidence-insufficient");

const startSnapshot = engine.createTownStateSnapshot(fixture.world, fixture.events, {
  id: "snapshot-replay-executor-start",
  label: "Replay executor start",
  mode: "checkpoint"
});
const replayCommands = [{
  id: "command-replay-executor-branch-1",
  runId: "run-replay-executor",
  branchId: "branch-a",
  type: "scenario-intervention",
  createdAt: "2040-01-01T00:00:00.000Z",
  payload: {
    atTickOffset: 1,
    intervention: { actorId: fixture.world.npcs[0].id, kind: "resource", value: "resource:replay-executor" }
  }
}];
const firstExecution = engine.executeReplayFromCheckpoint({
  runId: "run-replay-executor",
  branchId: "branch-a",
  world: fixture.world,
  events: fixture.events,
  startSnapshot,
  commands: replayCommands,
  steps: 3
});
assert.equal(firstExecution.status, "evidence-insufficient", "execution without an expected receipt is not promoted");
assert.deepEqual(firstExecution.appliedCommandIds, ["command-replay-executor-branch-1"]);
assert.equal(fixture.world.persistentRuntime?.tick || 0, 0, "isolated replay does not mutate the source world");
const secondExecution = engine.executeReplayFromCheckpoint({
  runId: "run-replay-executor",
  branchId: "branch-a",
  world: fixture.world,
  events: fixture.events,
  startSnapshot,
  commands: replayCommands,
  steps: 3,
  expectedDigest: firstExecution.digest
});
assert.equal(secondExecution.status, "verified", "same checkpoint and commands reproduce the expected digest");
assert.equal(secondExecution.digest?.combinedDigest, firstExecution.digest?.combinedDigest);
const branchRequired = engine.executeReplayFromCheckpoint({
  runId: "run-replay-executor",
  world: fixture.world,
  events: fixture.events,
  startSnapshot,
  commands: replayCommands,
  steps: 3
});
assert.equal(branchRequired.status, "mismatch", "branch-scoped command streams require an explicit branch id");
assert.equal(branchRequired.failures[0].code, "branch-required");

const driftedLiveWorld = structuredClone(fixture.world);
driftedLiveWorld.persistentRuntime = structuredClone(startSnapshot.checkpoint.runtime);
driftedLiveWorld.persistentRuntime.currentExperiment.ruleCatalogHash = "h-live-rule-drift";
const liveCompatibilityMismatch = engine.executeReplayFromCheckpoint({
  runId: "run-replay-executor",
  branchId: "branch-a",
  world: driftedLiveWorld,
  events: fixture.events,
  startSnapshot,
  commands: replayCommands,
  steps: 3,
  expectedDigest: firstExecution.digest
});
assert.equal(liveCompatibilityMismatch.status, "mismatch", "live package drift is rejected before replay execution");
assert.equal(liveCompatibilityMismatch.failures[0].code, "compatibility-mismatch");

console.log(JSON.stringify({
  ok: true,
  suite: "replay-verifier",
  schema: digest.schema,
  digest: digest.combinedDigest,
  verified: verified.status,
  mismatch: mismatch.status,
  insufficient: insufficient.status,
  commandCount: bundleVerification.commands.commandCount
}));
