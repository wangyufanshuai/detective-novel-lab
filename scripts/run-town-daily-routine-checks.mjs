import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createNoirTestLoader } from "./noir-player-test-loader.mjs";

const root = process.cwd();
const { load } = createNoirTestLoader(root);
const { createRiverbendWorld } = load("packages/engine/src/riverbend-world.ts");
const { advanceTownDailyRoutines } = load("packages/engine/src/town/daily-routine.ts");
const { startTownExploration, observeTownResidents, townExplorationPlayerView } = load("packages/engine/src/town-exploration.ts");
const fixture = createRiverbendWorld({ worldId: "routine-checked-world", now: "2026-10-08T00:00:00.000Z" });
const world = fixture.world;
const runtime = world.persistentRuntime;
const map = runtime.mapPacks[0];
map.connections.find(edge => [edge.from, edge.to].sort().join(":") === "books:cafe").travelMinutes = 7;
const npcId = "rb-jiang-zhi";
const actor = () => runtime.agentStates.find(agent => agent.npcId === npcId);
const session = { ...startTownExploration(world, map, fixture.binding, "routine-observer"), locationId: "cafe" };
const seen = observeTownResidents(world, fixture.binding, session, runtime);
function step(time, day = 1) {
  runtime.tick++; runtime.currentTime = time; runtime.currentDay = day;
  return advanceTownDailyRoutines(world, runtime);
}
runtime.currentTime = "11:55";
assert.equal(step("12:00").length, 0, "Schedule departure used time before the appointment");
assert.equal(actor().locationId, "cafe");
const first = step("12:05");
assert.equal(actor().locationId, "cafe", "Resident teleported to the destination before completing the road");
assert.equal(runtime.dailyRoutine.journeys[npcId].remainingMinutes, 2);
const inTransit = townExplorationPlayerView(world, fixture.binding, seen, runtime).residents.find(person => person.npcId === npcId);
assert.equal(inTransit.visibility, "last-seen");
assert.equal(inTransit.time, "08:00");
const save = JSON.stringify(world);
const second = step("12:10");
assert.equal(actor().locationId, "books");
assert.equal(second.find(event => event.actorIds.includes(npcId)).time, "12:07");
const restored = JSON.parse(save);
restored.persistentRuntime.tick++;
restored.persistentRuntime.currentTime = "12:10";
assert.deepEqual(advanceTownDailyRoutines(restored, restored.persistentRuntime), second, "A save/reload changed commuting events");
assert.deepEqual(restored.persistentRuntime.dailyRoutine, runtime.dailyRoutine);
assert.throws(() => advanceTownDailyRoutines(world, runtime), /stale|already applied/, "Duplicate routine tick must be rejected");

const midnight = createRiverbendWorld({ worldId: "routine-midnight", now: "2026-10-08T00:00:00.000Z" }).world;
for (const npc of midnight.npcs) {
  npc.schedule = { "00:00": "books", "23:55": "cafe" };
  midnight.persistentRuntime.agentStates.find(agent => agent.npcId === npc.id).locationId = "cafe";
}
midnight.persistentRuntime.currentTime = "00:00";
midnight.persistentRuntime.currentDay = 2;
midnight.persistentRuntime.tick = 1;
assert.equal(advanceTownDailyRoutines(midnight, midnight.persistentRuntime).length, 0);
midnight.persistentRuntime.currentTime = "00:05";
midnight.persistentRuntime.tick = 2;
const afterMidnight = advanceTownDailyRoutines(midnight, midnight.persistentRuntime);
assert.equal(afterMidnight.length, 12);
assert(afterMidnight.every(event => event.day === 2 && event.time === "00:05" && event.locationId === "books"));
const held = createRiverbendWorld({ worldId: "routine-hold", now: "2026-10-08T00:00:00.000Z" }).world;
held.persistentRuntime.dailyRoutine.holds[npcId] = { untilTick: 1, reason: "An explicit authored appointment" };
held.persistentRuntime.tick = 1; held.persistentRuntime.currentTime = "12:05";
advanceTownDailyRoutines(held, held.persistentRuntime);
assert.equal(held.persistentRuntime.agentStates.find(agent => agent.npcId === npcId).locationId, "cafe");
held.persistentRuntime.tick = 2; held.persistentRuntime.currentTime = "12:10";
advanceTownDailyRoutines(held, held.persistentRuntime);
assert.equal(held.persistentRuntime.agentStates.find(agent => agent.npcId === npcId).locationId, "books");

const checks = ["no-departure-before-appointment", "partial-road-cost", "no-visible-body-during-transit", "exact-arrival-minute", "commute-survives-save-replay", "duplicate-tick-rejected", "midnight-departure", "explicit-hold-and-resume"];
const sourcePaths = ["packages/engine/src/town/daily-routine.ts", "packages/engine/src/town-exploration.ts", "packages/engine/src/riverbend-world.ts", "scripts/run-town-daily-routine-checks.mjs"];
fs.writeFileSync(path.join(root, "docs/3d-town/riverbend-v1/daily-routine-review.json"), JSON.stringify({ schema: "riverbend-daily-routine-checks.v1", checkedAt: new Date().toISOString(), passed: true, checks, sources: Object.fromEntries(sourcePaths.map(p => [p, crypto.createHash("sha256").update(fs.readFileSync(path.join(root, p))).digest("hex")])), scope: "Controlled engine routine edge cases; full runtime midday routes are covered separately by session-review.json." }, null, 2) + "\n");
console.log(JSON.stringify({ passed: true, checks, firstArrivals: first.length }));
