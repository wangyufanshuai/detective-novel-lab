import assert from "node:assert/strict";
import { loadEngineForTool } from "./load-engine-for-tools.mjs";

const engine = await loadEngineForTool("population-flow-cadence");
const seed = "population-flow-cadence-seed";
const policy = {
  enabled: true,
  cadenceTicks: 5,
  maxResidents: 11,
  maxFlowsPerTick: 1,
  minSourceAgeTicks: 1
};

function makeState({ worldId, createdAt, enabled = true }) {
  const world = engine.createInitialWorld(seed, { mode: "advanced", npcCount: 10, timelineHours: 72 });
  world.id = worldId;
  world.createdAt = createdAt;
  world.updatedAt = createdAt;
  const sourceEvent = {
    id: "population-source-cadence",
    worldId,
    day: 1,
    time: "08:00",
    type: "incident",
    actorIds: [world.npcs[0].id, world.npcs[1].id],
    locationId: world.locations[0].id,
    summary: "A source-backed registry incident creates a traceable arrival opportunity.",
    publicSummary: "A registry incident leaves a public trace.",
    hidden: false,
    relatedCharacterIds: [world.npcs[0].id, world.npcs[1].id],
    tags: ["population_source", "source_backed"],
    causedByEventIds: []
  };
  const events = [sourceEvent];
  const runtime = engine.createPersistentTownRuntime(world, events, {
    now: createdAt,
    maxTicks: 100,
    caseTriggerPolicy: "source-signaled"
  });
  runtime.maxTicks = 100;
  runtime.populationFlowPolicy = enabled ? { ...policy } : { ...policy, enabled: false };
  world.persistentRuntime = runtime;
  return { world, events, runtime };
}

function runHundredTicks(state) {
  let world = state.world;
  let events = state.events;
  let runtime = state.runtime;
  for (let index = 0; index < 100; index += 1) {
    const advanced = engine.advancePersistentTownTick(world, events, { steps: 1, status: "running" });
    world = advanced.world;
    runtime = advanced.runtime;
    events = [...events, ...advanced.events];
  }
  return { world, events, runtime };
}

const disabled = runHundredTicks(makeState({ worldId: "world-population-disabled", createdAt: "2040-01-01T00:00:00.000Z", enabled: false }));
assert.equal(disabled.runtime.populationFlowLedger?.length, 0, "the default-off policy never creates automatic newcomers");
assert.equal(disabled.world.npcs.length, 10, "disabled population cadence preserves authored population");

const first = runHundredTicks(makeState({ worldId: "world-population-cadence", createdAt: "2040-01-01T00:00:00.000Z" }));
const second = runHundredTicks(makeState({ worldId: "world-population-cadence", createdAt: "2041-09-09T09:09:09.000Z" }));
for (const result of [first, second]) {
  assert.equal(result.runtime.populationFlowLedger?.length, 1, "one source event creates one bounded newcomer");
  assert.equal(result.world.npcs.length, 11, "resident cap stops further automatic growth");
  const record = result.runtime.populationFlowLedger[0];
  assert.equal(record.sourceEventId, "population-source-cadence", "newcomer keeps the source event identity");
  assert.equal(record.createdAtTick, 5, "cadence waits for the first legal five-tick boundary");
  assert.equal(result.events.filter((event) => event.type === "arrival" && event.tags.includes("population_flow")).length, 1, "automatic cadence emits one arrival event");
  const newcomerId = record.npcId;
  const firstAction = result.events
    .filter((event) => event.actorIds.includes(newcomerId) && event.id !== record.arrivalEventId)
    .sort((left, right) => left.day - right.day || left.time.localeCompare(right.time) || left.id.localeCompare(right.id))[0];
  assert.ok(firstAction?.tags.includes("observe"), "automatic newcomer first action uses a low-impact observation");
}

const firstDigest = engine.buildWorldReplayDigest(first.world, first.events, first.runtime);
const secondDigest = engine.buildWorldReplayDigest(second.world, second.events, second.runtime);
assert.deepEqual(firstDigest, secondDigest, "same seed and policy replay to the same digest across wall-clock metadata");

const savedWorld = JSON.parse(JSON.stringify(first.world));
const savedEvents = JSON.parse(JSON.stringify(first.events));
const savedRuntime = engine.normalizePersistentTownRuntime(savedWorld, savedEvents, JSON.parse(JSON.stringify(first.runtime)));
assert.deepEqual(
  engine.buildWorldReplayDigest(savedWorld, savedEvents, savedRuntime),
  firstDigest,
  "population cadence remains stable after JSON save/load normalization"
);

console.log(JSON.stringify({
  ok: true,
  suite: "population-flow-cadence",
  ticks: 100,
  createdRecords: first.runtime.populationFlowLedger.length,
  population: first.world.npcs.length,
  arrivalEventId: first.runtime.populationFlowLedger[0].arrivalEventId,
  createdAtTick: first.runtime.populationFlowLedger[0].createdAtTick,
  digest: firstDigest.combinedDigest,
  disabledPolicyPopulation: disabled.world.npcs.length
}));
