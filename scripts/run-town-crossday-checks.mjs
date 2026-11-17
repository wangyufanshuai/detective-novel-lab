// Cross-day Riverbend: the three-day window, resting at the inn, legacy one-day
// saves, and authored cases that belong to a later morning.
//
// Runs the real store, engine and SQLite in an isolated database. The day-2 case
// is the first authored case moved to day 2 in memory, so this check does not
// depend on which cases exist yet. Browser behaviour is covered by e2e.
//   node scripts/run-town-crossday-checks.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createNoirTestLoader } from "./noir-player-test-loader.mjs";

const root = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "town-crossday-"));
process.env.DATABASE_URL = path.join(dir, "isolated.db");
const { load } = createNoirTestLoader(root);
const { startTownPlay, commandTownPlay } = load("lib/world/town-exploration-store.ts");
const { worldRepository } = load("lib/world/repository.ts");
const { withPrivateWorldAccess } = load("lib/world/private-world-access.ts");
const { createRiverbendWorld, RIVERBEND_PLAY_TICKS } = load("packages/engine/src/riverbend-world.ts");
const { buildCasePackage, validateCasePackage, validateCaseSeries, casePackReady } = load("packages/engine/src/case-pack.ts");
const { RIVERBEND_CASES } = load("packages/engine/src/riverbend-case.ts");

const checks = [];
const check = name => checks.push(name);
const first = RIVERBEND_CASES[0];

// --- Authoring rules for a case's day -------------------------------------
{
  const { world } = createRiverbendWorld({ worldId: "crossday-authoring", now: "2026-01-01T00:00:00Z" });
  const bundle = buildCasePackage(world, { ...first, day: 2 }, "2026-01-01T00:00:00Z");
  assert(bundle.events.every(e => e.day === 2) && bundle.memories.every(m => m.day === 2), "Day-2 history or memories kept day 1");
  assert(validateCasePackage(world, bundle, first.window, 1).some(e => e.startsWith("Invalid opening time")), "Day-2 history passed as day 1");
  assert.throws(() => buildCasePackage(world, { ...first, window: { from: first.window.from, to: "08:30" } }, "2026-01-01T00:00:00Z"), /Invalid opening time/, "History after 08:00 was accepted");
  const series = RIVERBEND_CASES.slice(0, 2).map((pack, i) => ({ pack: i === 0 ? { ...pack, day: 2 } : pack, bundle: buildCasePackage(world, i === 0 ? { ...pack, day: 2 } : pack, "2026-01-01T00:00:00Z") }));
  assert(validateCaseSeries(world, series).some(e => e.includes("earlier day")), "A case before the day of the case it follows was accepted");
  assert(!casePackReady({ day: 2 }, { day: 1, currentTime: "23:55" }) && !casePackReady({ day: 2 }, { day: 2, currentTime: "07:55" }) && casePackReady({ day: 2 }, { day: 2, currentTime: "08:00" }) && casePackReady({}, { day: 1, currentTime: "08:00" }), "casePackReady boundaries");
  check("case-day-authoring-rules");
}

// --- Store: rest, window, day gate ----------------------------------------
const started = startTownPlay();
const credentials = started.credentials;
let view = started.result.view;
let n = 0;
const command = input => ({ ...input, actionId: `crossday-${++n}`, expectedSessionRevision: view.revision, expectedWorldRevision: view.worldRevision });
const act = input => { view = commandTownPlay(credentials, command(input)).view; return view; };
const refused = input => { try { act(input); } catch (error) { return error.code; } assert.fail(`${input.kind} was accepted`); };
const untilEvening = () => { while (view.time < "17:00") act({ kind: "wait", minutes: 60 }); };
const nights = [];
const rest = () => { const at = performance.now(); act({ kind: "rest" }); nights.push(Math.round(performance.now() - at)); };

assert.deepEqual(view.rest, { open: false, reason: "到旅馆才能订房过夜。" });
assert.equal(refused({ kind: "rest" }), "REST_CLOSED");
act({ kind: "arrive", sceneId: "inn" });
assert.equal(view.rest.open, false, "The inn let a room in the morning");
assert.equal(refused({ kind: "rest" }), "REST_CLOSED");
check("rest-refused-away-from-inn-and-before-evening");

first.day = 2;
try {
  view = commandTownPlay(credentials, command({ kind: "wait", minutes: 15 })).view;
  assert.equal(view.commission.opensOnDay, 2, "A day-2 commission did not wait for day 2");
  assert.deepEqual(view.commission.openAt, [], "A waiting commission named where it opens");
  assert(!view.commission.hook.includes(first.commission.hook), "A waiting commission revealed its hook");
  act({ kind: "arrive", sceneId: first.commission.openAt[0] });
  assert.equal(refused({ kind: "case-open" }), "INVESTIGATION_ACTION");
  check("later-case-waits-for-its-morning");

  act({ kind: "arrive", sceneId: "inn" });
  untilEvening();
  assert.deepEqual(view.rest, { open: true, wakeDay: 2 });
  const night = command({ kind: "rest" });
  const stale = { ...night, actionId: "crossday-stale" };
  view = commandTownPlay(credentials, night).view;
  nights.push(0);
  assert.equal(`${view.day} ${view.time}`, "2 08:00");
  assert.equal(commandTownPlay(credentials, night).replayed, true, "A retried night was not replayed");
  assert.throws(() => commandTownPlay(credentials, stale), error => error.code === "STATE_CHANGED", "A stale night was accepted");
  check("rest-wakes-next-morning-retries-and-rejects-stale");

  assert.equal(view.commission.opensOnDay, undefined, "The day-2 commission stayed closed on day 2");
  assert.equal(view.commission.hook, first.commission.hook);
  act({ kind: "arrive", sceneId: first.commission.openAt[0] });
  act({ kind: "case-open" });
  assert.equal(view.investigation?.solved, false, "The day-2 case did not open on day 2");
  withPrivateWorldAccess(view.worldId, () => {
    const history = worldRepository.getEvents(view.worldId).filter(e => e.tags.includes(first.historyTag));
    assert(history.length && history.every(e => e.day === 2), "Day-2 history was stored on another day");
  });
  check("later-case-opens-on-its-morning-with-its-day");
} finally {
  delete first.day;
}

// Days 2 and 3, then the window closes at day 4 08:00.
for (const wake of ["3 08:00", "4 08:00"]) {
  act({ kind: "arrive", sceneId: "inn" });
  untilEvening();
  rest();
  assert.equal(`${view.day} ${view.time}`, wake);
}
assert.equal(view.rest.open, false);
assert.equal(refused({ kind: "wait", minutes: 15 }), "DAY_COMPLETE");
check("three-day-window-ends-day-4-0800");
assert(nights.every(ms => ms < 15_000), `A night took too long: ${nights.join(", ")} ms`);
check("nights-stay-bounded");

// --- Legacy one-day save -------------------------------------------------
{
  const legacy = startTownPlay();
  let legacyView = legacy.result.view;
  withPrivateWorldAccess(legacyView.worldId, () => {
    const world = worldRepository.getWorld(legacyView.worldId);
    world.persistentRuntime.maxTicks = 288;
    world.persistentRuntime.snapshots = [{ id: "legacy", label: "Tick 0", mode: "checkpoint" }];
    worldRepository.saveWorld(world);
  });
  legacyView = commandTownPlay(legacy.credentials, { kind: "wait", minutes: 15, actionId: "legacy-1", expectedSessionRevision: legacyView.revision, expectedWorldRevision: legacyView.worldRevision }).view;
  withPrivateWorldAccess(legacyView.worldId, () => {
    const runtime = worldRepository.getWorld(legacyView.worldId).persistentRuntime;
    assert.equal(runtime.maxTicks, RIVERBEND_PLAY_TICKS, "A one-day save was not raised to the play window");
    assert.deepEqual(runtime.snapshots, [], "Legacy snapshots survived an action");
  });
  check("legacy-one-day-save-raised-and-snapshots-dropped");
}

const bytes = fs.statSync(process.env.DATABASE_URL).size;
console.log(JSON.stringify({ passed: true, checks, nightsMs: nights.filter(Boolean), databaseMB: +(bytes / 1048576).toFixed(1), scope: "real store, engine and SQLite in an isolated database; browser covered by e2e" }));
