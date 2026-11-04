import assert from "node:assert/strict";
import { loadEngineForTool } from "./load-engine-for-tools.mjs";

const engine = await loadEngineForTool("replay-contract");
const seed = "replay-contract-seed";

function makeFixture(worldId, runtimeId, createdAt) {
  const initial = engine.createInitialWorld(seed, { mode: "advanced", npcCount: 10, timelineHours: 24 });
  initial.id = worldId;
  initial.createdAt = createdAt;
  initial.updatedAt = createdAt;
  const daily = engine.simulateDailyLife(initial, 1, []);
  const runtime = engine.createPersistentTownRuntime(daily.world, daily.events, { now: createdAt, maxTicks: 24 });
  runtime.id = runtimeId;
  runtime.createdAt = createdAt;
  runtime.updatedAt = createdAt;
  return { world: daily.world, events: daily.events, runtime };
}

const first = makeFixture("world-replay-a", "runtime-replay-a", "2040-01-01T00:00:00.000Z");
const second = makeFixture("world-replay-b", "runtime-replay-b", "2041-09-09T09:09:09.000Z");

const firstDigest = engine.buildWorldReplayDigest(first.world, first.events, first.runtime);
const secondDigest = engine.buildWorldReplayDigest(second.world, second.events, second.runtime);
assert.equal(firstDigest.schema, "world-replay.v1", "digest declares the canonical replay schema");
assert.equal(firstDigest.compatibility.schema, "world-replay-compat.v1", "digest declares the compatibility receipt schema");
assert.equal(firstDigest.compatibility.engineVersion, "persistent-town.v1", "digest binds the persistent-town engine version");
assert.equal(firstDigest.compatibility.randomSourceVersion, "persistent-town-lcg.v1", "digest binds the persistent-town random source version");
assert.deepEqual(
  [firstDigest.compatibility, firstDigest.seed, firstDigest.tick, firstDigest.eventCount, firstDigest.stateDigest, firstDigest.eventDigest, firstDigest.combinedDigest],
  [secondDigest.compatibility, secondDigest.seed, secondDigest.tick, secondDigest.eventCount, secondDigest.stateDigest, secondDigest.eventDigest, secondDigest.combinedDigest],
  "same seed and simulation remain stable across world/runtime ids and wall-clock metadata"
);
const attachedWorld = structuredClone(first.world);
attachedWorld.persistentRuntime = structuredClone(first.runtime);
assert.deepEqual(
  engine.buildWorldReplayDigest(attachedWorld, first.events, first.runtime),
  firstDigest,
  "an embedded runtime attachment is not double-counted as world truth"
);

const firstCanonical = engine.buildCanonicalReplayState(first.world, first.events, first.runtime);
const secondCanonical = engine.buildCanonicalReplayState(second.world, second.events, second.runtime);
assert.equal(engine.compareCanonicalReplayStates(firstCanonical, secondCanonical), null, "canonical save-independent states compare equal");

const savedWorld = JSON.parse(JSON.stringify(first.world));
const savedEvents = JSON.parse(JSON.stringify(first.events));
const savedRuntime = JSON.parse(JSON.stringify(first.runtime));
savedWorld.updatedAt = "2055-05-05T05:05:05.000Z";
savedRuntime.updatedAt = "2055-05-05T05:05:06.000Z";
const restoredRuntime = engine.normalizePersistentTownRuntime(savedWorld, savedEvents, savedRuntime);
const restoredDigest = engine.buildWorldReplayDigest(savedWorld, savedEvents, restoredRuntime);
assert.deepEqual(restoredDigest, firstDigest, "JSON save/load normalization preserves the replay digest");

const changedWorld = structuredClone(first.world);
changedWorld.name = "雾灯镇·回放分歧";
const changedDigest = engine.buildWorldReplayDigest(changedWorld, first.events, first.runtime);
assert.notEqual(changedDigest.combinedDigest, firstDigest.combinedDigest, "a meaningful world mutation changes the combined digest");
const divergence = engine.compareCanonicalReplayStates(
  firstCanonical,
  engine.buildCanonicalReplayState(changedWorld, first.events, first.runtime)
);
assert.equal(divergence?.path, "$.world.name", "first divergence reports the stable semantic path");
assert.equal(divergence?.reason, "value", "first divergence identifies a value change");

const changedEvents = structuredClone(first.events);
changedEvents[0].summary = `${changedEvents[0].summary}（回放分歧）`;
const changedEventDigest = engine.buildWorldReplayDigest(first.world, changedEvents, first.runtime);
assert.notEqual(changedEventDigest.eventDigest, firstDigest.eventDigest, "a meaningful event mutation changes the event digest");
assert.throws(
  () => engine.buildWorldReplayDigest({ ...first.world, day: Number.NaN }, first.events, first.runtime),
  /non-finite number/,
  "non-finite simulation values fail closed instead of entering a replay receipt"
);

console.log(JSON.stringify({
  ok: true,
  suite: "replay-contract",
  schema: firstDigest.schema,
  seed: firstDigest.seed,
  tick: firstDigest.tick,
  eventCount: firstDigest.eventCount,
  stateDigest: firstDigest.stateDigest,
  eventDigest: firstDigest.eventDigest,
  combinedDigest: firstDigest.combinedDigest,
  saveLoadStable: restoredDigest.combinedDigest === firstDigest.combinedDigest,
  firstDivergence: divergence
}));
