import assert from "node:assert/strict";
import { loadEngineForTool } from "./load-engine-for-tools.mjs";

const engine = await loadEngineForTool("population-flow-contract");
const initial = engine.createInitialWorld("population-flow-contract", { mode: "advanced", npcCount: 10, timelineHours: 24 });
const daily = engine.simulateDailyLife(initial, 1, []);
const sourceEvent = daily.events.find((event) => event.actorIds.length > 0);
assert.ok(sourceEvent, "contract needs a source-backed event");
const runtime = engine.createPersistentTownRuntime(daily.world, daily.events, { now: daily.world.updatedAt });
const input = {
  sourceEventId: sourceEvent.id,
  sourceCandidateId: "population-contract-candidate",
  reason: "合同测试验证来源事件、登记抵达与回放身份保持一致。"
};
assert.throws(
  () => engine.applyPopulationFlow(daily.world, { ...runtime, worldId: "world-other" }, daily.events, input),
  /belongs to another world/,
  "population flow fails closed when runtime and world identities diverge"
);
assert.throws(
  () => engine.applyPopulationFlow(daily.world, runtime, daily.events, { ...input, time: "99:99" }),
  /valid HH:MM/,
  "population flow rejects an invalid clock override"
);

const first = engine.applyPopulationFlow(daily.world, runtime, daily.events, input);
assert.equal(first.created, true, "first application creates a newcomer");
assert.equal(first.createdEvents.length, 1, "first application emits one arrival event");
assert.equal(first.event.type, "arrival", "population flow emits an arrival event");
assert.ok(first.event.tags.includes("population_flow"), "arrival event is explicitly tagged as population flow");
assert.ok(first.event.tags.includes("source_backed"), "arrival event keeps source-backed provenance");
assert.deepEqual(first.event.causedByEventIds, [sourceEvent.id], "arrival points back to the source event");
assert.equal(first.record.sourceEventId, sourceEvent.id, "ledger stores the source event identity");
assert.equal(first.record.sourceCandidateId, input.sourceCandidateId, "ledger stores the optional candidate identity");
assert.equal(first.record.npcId, first.event.actorIds[0], "ledger newcomer identity matches the arrival actor");
assert.equal(first.record.arrivalEventId, first.event.id, "ledger arrival identity matches the event");
assert.equal(first.record.schedule["12:00"], first.record.arrivalLocationId, "schedule includes the arrival location");
assert.ok(Object.values(first.record.schedule).every((locationId) => first.world.locations.some((location) => location.id === locationId)), "newcomer schedule locations resolve in the world graph");
assert.ok(first.world.locations.some((location) => location.id === first.record.schedule["23:00"] && location.kind === "home"), "population flow persists a deterministic newcomer home location");
assert.ok(first.record.relationshipNpcIds.every((id) => daily.world.npcs.some((npc) => npc.id === id)), "relationship targets resolve in the source world");
assert.ok(first.world.npcs.some((npc) => npc.id === first.record.npcId), "newcomer is persisted in the world");
assert.ok(first.world.memories.some((memory) => memory.eventId === first.event.id && memory.npcId === first.record.npcId), "newcomer receives a source-linked memory");
for (const authoredNpc of daily.world.npcs) {
  const after = first.world.npcs.find((npc) => npc.id === authoredNpc.id);
  assert.deepEqual(after?.relationships, authoredNpc.relationships, "arrival does not silently rewrite an authored resident relationship graph");
}
const newcomer = first.world.npcs.find((npc) => npc.id === first.record.npcId);
assert.ok(newcomer && first.record.relationshipNpcIds.every((npcId) => Object.hasOwn(newcomer.relationships, npcId)), "newcomer keeps deterministic prior-knowledge relationship edges");

const replay = engine.applyPopulationFlow(daily.world, runtime, daily.events, input);
assert.equal(replay.created, true, "replaying from the same pre-flow snapshot remains a deterministic creation");
assert.deepEqual(replay.record, first.record, "same source tuple produces the same ledger identity");
assert.deepEqual(replay.event, first.event, "same source tuple produces the same arrival event");
assert.deepEqual(replay.world.npcs, first.world.npcs, "same source tuple produces the same newcomer and relationship updates");

const persistedWorld = JSON.parse(JSON.stringify(first.world));
delete persistedWorld.persistentRuntime;
const persistedEvents = [...daily.events, ...first.createdEvents];
const persistedRuntime = engine.normalizePersistentTownRuntime(
  persistedWorld,
  persistedEvents,
  JSON.parse(JSON.stringify(first.runtime))
);
assert.equal(persistedRuntime.populationFlowLedger?.length, 1, "save/load normalization preserves the population ledger");
const afterLoad = engine.applyPopulationFlow(persistedWorld, persistedRuntime, persistedEvents, input);
assert.equal(afterLoad.created, false, "save/load replay is idempotent");
assert.deepEqual(afterLoad.record, first.record, "save/load preserves population provenance");
assert.deepEqual(afterLoad.event, first.event, "save/load preserves the arrival event");
assert.equal(afterLoad.createdEvents.length, 0, "idempotent replay emits no duplicate event");
assert.equal(afterLoad.world.npcs.filter((npc) => npc.id === first.record.npcId).length, 1, "idempotent replay keeps one newcomer");

const second = engine.applyPopulationFlow(daily.world, runtime, daily.events, { ...input, sourceCandidateId: "population-contract-candidate-2" });
assert.equal(second.created, true, "a distinct source candidate can create a distinct flow");
assert.notEqual(second.record.id, first.record.id, "distinct source candidates have distinct replay identities");
assert.notEqual(second.record.npcId, first.record.npcId, "distinct source candidates have distinct newcomers");

console.log(JSON.stringify({
  ok: true,
  suite: "population-flow-contract",
  sourceEventId: sourceEvent.id,
  firstFlowId: first.record.id,
  newcomerId: first.record.npcId,
  arrivalEventId: first.event.id,
  relationshipCount: first.record.relationshipNpcIds.length,
  schedule: first.record.schedule,
  saveLoadReplay: afterLoad.created === false,
  idempotentDuplicateCount: afterLoad.world.npcs.filter((npc) => npc.id === first.record.npcId).length
}));
