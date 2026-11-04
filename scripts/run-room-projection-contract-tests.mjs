import assert from "node:assert/strict";
import { loadEngineForTool } from "./load-engine-for-tools.mjs";

const engine = await loadEngineForTool("room-projection-contract");
const showcase = engine.createPremiumShowcaseWorld("room-projection-contract", "archive-blunt");
const { activeCase, events } = showcase;
const triggerEvent = events.find((event) => event.id === activeCase.triggeredEventId);

const review = engine.buildInvestigationRoomProjection(activeCase, events, { mode: "review" });
assert.equal(review.schema, "investigation-room-projection.v1", "room projection schema is explicit");
assert.equal(review.roomId, "fog-lamp-evidence-room", "the first room binds to the drafted room package");
assert.equal(review.caseId, activeCase.id, "room projection keeps the case identity");
assert.equal(review.triggeredEventId, activeCase.triggeredEventId, "review projection exposes the trigger event identity");
assert.equal(review.mode, "review", "review projection is explicit about its visibility boundary");
assert.ok(review.routeStepIds.length > 0, "review projection contains certified route steps");
assert.ok(review.evidenceNodeIds.length > 0, "review projection contains evidence nodes");
assert.equal(review.routeStepIds.length, review.links.length, "each route step has one trace link");
assert.equal(review.integrity.sourceBacked, true, "showcase projection is source backed");
assert.equal(review.integrity.routeCertified, true, "showcase route is certified");
assert.equal(review.integrity.triggerResolved, Boolean(triggerEvent), "trigger resolution reports the provided world event");
assert.equal(review.integrity.sourceEventsResolved, true, "review source identifiers resolve against the provided event log");
assert.equal(review.integrity.traceable, Boolean(triggerEvent), "review projection is traceable only when the trigger is present");
assert.ok(review.sourceEventIds.every((id) => events.some((event) => event.id === id)), "review source identifiers are backed by the event log");

const player = engine.buildInvestigationRoomProjection(activeCase, events, { mode: "player" });
const playerAgain = engine.buildInvestigationRoomProjection(activeCase, events, { mode: "player" });
assert.deepEqual(player, playerAgain, "player projection is deterministic");
assert.equal(player.mode, "player", "player projection is explicit about its visibility boundary");
assert.deepEqual(player.sourceEventIds, [], "unsolved player projection does not expose source event identifiers");
assert.equal(player.integrity.traceable, false, "unsolved player projection cannot claim review traceability");
assert.ok(player.routeStepIds.every((id) => id.startsWith("route-step:")), "unsolved route steps are spoiler safe");
assert.ok(player.evidenceNodeIds.every((id) => id.startsWith("evidence-node:locked-")), "unsolved evidence nodes are spoiler safe");
if (triggerEvent?.hidden) assert.equal(player.triggeredEventId, undefined, "hidden trigger identity remains masked before solve");
if (triggerEvent?.hidden) assert.equal(player.locationId, activeCase.generationProfile.sceneLocationId, "hidden trigger location remains masked before solve");

const solvedPlayer = engine.buildInvestigationRoomProjection(activeCase, events, {
  mode: "player",
  solved: true,
  session: { interrogationLog: [], discoveredEvidenceIds: [], judgement: { accepted: true } }
});
assert.equal(solvedPlayer.triggeredEventId, activeCase.triggeredEventId, "solving unlocks the trigger identity in the player room");
assert.deepEqual(solvedPlayer.sourceEventIds, review.sourceEventIds, "solving unlocks the same source chain used by review mode");
assert.deepEqual(solvedPlayer.evidenceNodeIds, review.evidenceNodeIds, "solving unlocks the source-backed evidence node identities");
assert.deepEqual(solvedPlayer.routeStepIds, review.routeStepIds, "solving unlocks the certified route step identities");

console.log(JSON.stringify({
  ok: true,
  suite: "room-projection-contract",
  roomId: review.roomId,
  caseId: review.caseId,
  triggerKind: review.triggerKind,
  routeStepCount: review.routeStepIds.length,
  evidenceNodeCount: review.evidenceNodeIds.length,
  sourceEventCount: review.sourceEventIds.length,
  traceable: review.integrity.traceable
}));
