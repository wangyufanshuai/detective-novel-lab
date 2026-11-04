import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createNoirTestLoader } from "./noir-player-test-loader.mjs";

const root = process.cwd();
const { load } = createNoirTestLoader(root);
const api = load("packages/engine/src/town-exploration.ts");
const { createInitialWorld } = load("packages/engine/src/world-simulator.ts");
const { createTownMapPackFromWorld } = load("packages/engine/src/town-map-pack.ts");
const { createPersistentTownRuntime } = load("packages/engine/src/persistent-town.ts");
const { createRiverbendWorld, RIVERBEND_VISITABLE_SCENES } = load("packages/engine/src/riverbend-world.ts");
const { validateTownMapPack } = load("packages/engine/src/town-map-pack.ts");
const sha = file => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
const world = createInitialWorld("exploration-clock-and-knowledge", { npcCount: 12 });
world.id = "world-exploration-check";
world.persistentRuntime = createPersistentTownRuntime(world, [], { tickIntervalMinutes: 10, maxTicks: 120 });
world.persistentRuntime.commandRevision = 7;
const map = createTownMapPackFromWorld(world, { id: "test-explicit-scene-map" });
const binding = {
  schema: "town-exploration-binding.v1", worldId: world.id, mapId: map.manifest.id,
  revision: "authored-test-map-v1", assetSha256: "a".repeat(64), initialLocationId: "town-square",
  places: world.locations.map(location => ({ sceneId: `scene-${location.id}`, locationId: location.id })),
  residents: world.npcs.map((npc, i) => ({ actorId: `resident-${i}`, npcId: npc.id }))
};
assert.equal(binding.residents.length, 12);
const initial = api.startTownExploration(world, map, binding, "session-player-a");
const command = { actionId: "walk-1", sceneId: "scene-clinic", expectedSessionRevision: 0 };
const before = JSON.stringify({ world, map, binding, initial });
const plan = api.planTownArrival(world, map, binding, initial, world.persistentRuntime, command);
assert.deepEqual(plan.path, ["town-square", "archive", "clinic"]);
assert.equal(plan.routeMinutes, 20);
assert.equal(plan.steps, 2);
const applied = api.executeTownArrival(world, [], map, binding, initial, command);
assert.equal(applied.runtime.tick, 2);
assert.equal(applied.runtime.currentTime, "08:20");
assert.equal(applied.state.locationId, "clinic");
assert.equal(applied.runtime.agentStates.length, 12);
assert.equal(applied.state.lastArrival.minutes, 20);
assert.equal(JSON.stringify({ world, map, binding, initial }), before, "Travel mutated the caller's persisted state before commit");

const samePlace = api.executeTownArrival(world, [], map, binding, initial, { ...command, sceneId: "scene-town-square" });
assert.equal(samePlace.runtime.tick, 0, "Observation accidentally called the engine's minimum-one-tick path");
assert.equal(samePlace.runtime.currentTime, "08:00");
assert.equal(samePlace.events.length, 0);
assert.equal(samePlace.state.lastArrival.minutes, 0);
const reverse = api.planTownArrival(applied.world, map, binding, applied.state, applied.runtime, { actionId: "walk-back", sceneId: "scene-town-square", expectedSessionRevision: applied.state.revision });
assert.deepEqual(reverse.path, ["clinic", "archive", "town-square"], "Canonical map edges must be traversable in both directions");

const rejects = [];
function reject(label, action, match) { assert.throws(action, match, label); rejects.push(label); }
reject("stale-session", () => api.planTownArrival(world, map, binding, initial, world.persistentRuntime, { ...command, expectedSessionRevision: 99 }), /stale/);
reject("cross-world", () => api.planTownArrival({ ...world, id: "another-world" }, map, binding, initial, world.persistentRuntime, command), /match/);
reject("map-version", () => api.planTownArrival(world, map, { ...binding, revision: "other-version" }, initial, world.persistentRuntime, command), /different/);
reject("unmapped-destination", () => api.planTownArrival(world, map, binding, initial, world.persistentRuntime, { ...command, sceneId: "client-invented-room" }), /destination/);
reject("unreachable-road", () => api.planTownArrival(world, { ...map, connections: [] }, binding, initial, world.persistentRuntime, command), /cannot be reached/);
reject("negative-travel-time", () => api.validateTownExplorationBinding(world, { ...map, connections: [{ ...map.connections[0], travelMinutes: -5 }] }, binding), /positive/);
reject("ambiguous-road", () => api.validateTownExplorationBinding(world, { ...map, connections: [...map.connections, { ...map.connections[0], from: map.connections[0].to, to: map.connections[0].from }] }, binding), /duplicate/);
reject("duplicate-resident", () => api.validateTownExplorationBinding(world, map, { ...binding, residents: [...binding.residents, binding.residents[0]] }), /one-to-one/);
reject("unmapped-player", () => api.planTownArrival(world, map, binding, { ...initial, locationId: "not-a-location" }, world.persistentRuntime, command), /no scene binding/);
reject("simulation-window-ended", () => api.planTownArrival(world, map, binding, initial, { ...world.persistentRuntime, maxTicks: 1 }, command), /simulation window/);
reject("no-time-advance", () => api.completeTownArrival(initial, binding, plan, world.persistentRuntime), /required travel ticks/);
reject("world-revision-race", () => api.completeTownArrival(initial, binding, plan, { ...applied.runtime, commandRevision: 8 }), /World revision changed/);
reject("wrong-session-result", () => api.completeTownArrival(initial, binding, { ...plan, sessionId: "session-player-b" }, applied.runtime), /another session/);

// Observe only one co-located resident, then move them out of sight. The client's
// map must retain the witnessed place, even if their secret schedule says otherwise.
const observationClock = structuredClone(applied.runtime);
observationClock.agentStates.forEach((agent, index) => { agent.locationId = index === 0 ? "clinic" : "archive"; });
const cleanState = { ...applied.state, sightings: [] };
const observed = api.observeTownResidents(world, binding, cleanState, observationClock);
assert.equal(observed.sightings.length, 1);
const view = api.townExplorationPlayerView(world, binding, observed, observationClock);
assert.equal(view.residents.length, 1);
assert.equal(view.residents[0].visibility, "observed");
assert.equal(view.residents[0].sceneId, "scene-clinic");
assert.deepEqual(api.observeTownResidents(world, binding, observed, observationClock), observed, "Repeated observation is not idempotent");
observationClock.agentStates[0].locationId = "lake";
const lastSeen = api.townExplorationPlayerView(world, binding, observed, observationClock);
assert.equal(lastSeen.residents[0].visibility, "last-seen");
assert.equal(lastSeen.residents[0].sceneId, "scene-clinic");
assert(!JSON.stringify(lastSeen).includes("scene-lake"));
for (const hiddenField of ["schedule", "secret", "motiveSeed", "nextActionPreview", "decisionTraces", "secretRisk", "truth"]) assert(!JSON.stringify(lastSeen).includes(`"${hiddenField}"`), `${hiddenField} crossed the player projection`);
const poisonedWorld = structuredClone(world);
poisonedWorld.npcs[0].secret = "DO_NOT_LEAK_HIDDEN_LOCATION";
poisonedWorld.npcs[0].schedule["08:00"] = "lake";
assert.deepEqual(api.townExplorationPlayerView(poisonedWorld, binding, observed, observationClock), lastSeen, "Changing hidden state changed the player's remembered knowledge");
reject("future-sighting", () => api.townExplorationPlayerView(world, binding, { ...observed, sightings: [{ ...observed.sightings[0], tick: 999 }] }, observationClock), /Invalid remembered/);
reject("duplicate-sighting", () => api.observeTownResidents(world, binding, { ...observed, sightings: [...observed.sightings, observed.sightings[0]] }, observationClock), /Duplicate remembered/);

const midnightWorld = structuredClone(world);
midnightWorld.currentTime = midnightWorld.persistentRuntime.currentTime = "23:50";
const midnight = api.executeTownArrival(midnightWorld, [], map, binding, initial, command);
assert.equal(midnight.runtime.currentDay, 2);
assert.equal(midnight.runtime.currentTime, "00:10");

// Validate the original authored Riverbend world against the real exported GLB
// and public navigation identities, without pretending it is already in the UI.
const riverbend = createRiverbendWorld({ worldId: "riverbend-engine-review", now: "2026-10-08T00:00:00.000Z" });
assert.equal(validateTownMapPack(riverbend.map).ok, true);
assert.equal(riverbend.binding.assetSha256, sha("public/assets/riverbend/v1/town.glb"));
const glb = fs.readFileSync(path.join(root, "public/assets/riverbend/v1/town.glb"));
const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8"));
const actorNames = new Set(gltf.nodes.map(node => node.name));
assert.equal(riverbend.world.npcs.length, 12);
for (const actor of riverbend.binding.residents) assert(actorNames.has(`actor_${actor.actorId}`), `Missing authored GLB person ${actor.actorId}`);
const navigation = JSON.parse(fs.readFileSync(path.join(root, "public/assets/riverbend/v1/navigation.json"), "utf8"));
assert.deepEqual([...RIVERBEND_VISITABLE_SCENES].sort(), navigation.destinations.map(place => place.id).sort());
const ids = new Set(riverbend.world.locations.map(location => location.id));
for (const npc of riverbend.world.npcs) {
  assert(ids.has(npc.homeLocationId));
  assert(Object.values(npc.schedule).every(id => ids.has(id)));
  assert(Object.keys(npc.relationships).every(id => riverbend.world.npcs.some(other => other.id === id)));
}
let current = riverbend.world;
let state = api.startTownExploration(current, riverbend.map, riverbend.binding, "riverbend-player-review");
let events = [];
const arrivals = [];
for (const sceneId of RIVERBEND_VISITABLE_SCENES) {
  const result = api.executeTownArrival(current, events, riverbend.map, riverbend.binding, state, { actionId: `arrive-${sceneId}`, sceneId, expectedSessionRevision: state.revision });
  assert(result.runtime.agentStates.every(agent => ids.has(agent.locationId)), "Agent moved to a Fog Lamp location absent from Riverbend");
  assert(result.events.every(event => ids.has(event.locationId)), "World event has an unmapped location");
  state = result.state;
  current = result.world;
  events = [...events, ...result.events];
  arrivals.push({ sceneId, minutes: result.plan.chargedMinutes, day: result.runtime.currentDay, time: result.runtime.currentTime });
}
assert.equal(state.locationId, "inn");
assert.equal(riverbend.world.persistentRuntime.tick, 0, "Real authored input world was mutated");

const receipt = {
  schema: "town-exploration-engine-checks.v1", checkedAt: new Date().toISOString(), passed: true,
  sources: Object.fromEntries(["packages/engine/src/town-exploration.ts", "packages/engine/src/riverbend-world.ts", "packages/engine/src/persistent-town.ts", "packages/engine/src/world-simulator.ts", "scripts/run-town-exploration-checks.mjs"].map(file => [file, sha(file)])),
  checks: ["real-engine-travel-and-12-residents", "same-location-zero-ticks", "undirected-road-travel", "immutable-input", "same-place-observation", "remembered-not-live-location", "hidden-state-noninterference", "midnight-clock-rollover", "riverbend-12-actual-glb-identities", "riverbend-6-actual-navigation-identities", "riverbend-valid-map-and-life-references", "riverbend-six-engine-arrivals", ...rejects],
  riverbend: { assetSha256: riverbend.binding.assetSha256, bindingRevision: riverbend.binding.revision, arrivals },
  scope: "Standalone engine execution with negative fixtures plus original Riverbend content bound to actual asset identities. Persistence, routine enforcement and browser integration are verified by separate session, daily-routine and browser receipts; human acceptance remains pending."
};
fs.writeFileSync(path.join(root, "docs/3d-town/riverbend-v1/exploration-engine-review.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify({ passed: true, checks: receipt.checks.length, travel: { path: plan.path, time: applied.runtime.currentTime }, scope: receipt.scope }));
