import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createNoirTestLoader } from "./noir-player-test-loader.mjs";
const root = process.cwd();
const output = path.join(root, "output", "classic-living-v1");
fs.mkdirSync(output, { recursive: true });
const run = fs.mkdtempSync(path.join(output, "checks-"));
process.env.DATABASE_URL = path.join(run, "isolated.db");
const { load } = createNoirTestLoader(root);
const { startTownPlay, readTownPlay, commandTownPlay } = load("lib/world/town-exploration-store.ts");
const repository = load("lib/world/repository.ts");
const { withPrivateWorldAccess } = load("lib/world/private-world-access.ts");
const contract = load("lib/classic-living-contract.ts");
const { classicResidentPresence, validClassicLivingView, squareResidentPositions } = load("app/town-play/art-sample/living-presentation.ts");
const { createSampleNavigator } = load("app/town-play/art-sample/sample-navigation.ts");
const checks = [];
const pass = name => checks.push(name);
const sha = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
try {
  const legacy = startTownPlay();
  const legacyBefore = JSON.stringify(legacy.result.view);
  const started = startTownPlay(undefined, "classic-living");
  let view = started.result.view;
  let serial = 0;
  const make = action => ({ ...action, actionId: `living-check-${++serial}`, expectedSessionRevision: view.revision, expectedWorldRevision: view.worldRevision });
  function command(action) {
    const request = make(action);
    const result = commandTownPlay(started.credentials, request);
    assert.deepEqual(commandTownPlay(started.credentials, request).view, JSON.parse(JSON.stringify(result.view)));
    view = result.view;
  }
  assert.equal(view.bindingRevision, contract.CLASSIC_LIVING_REVISION);
  assert.equal(view.assetSha256, sha("public/assets/classic-bookshop/v2/classic-street.glb"));
  assert.equal(view.residentWorkEnabled, true);
  assert(validClassicLivingView(view));
  assert.equal(JSON.stringify(readTownPlay(legacy.credentials)), legacyBefore);
  assert.throws(() => startTownPlay(legacy.credentials, "classic-living"), error => error.code === "BINDING_CHANGED");
  assert.throws(() => readTownPlay(started.credentials, "riverbend"), error => error.code === "BINDING_CHANGED");
  assert.throws(() => commandTownPlay(started.credentials, make({ kind: "arrive", sceneId: "police" })), error => error.code === "PLACE_CLOSED");
  assert.throws(() => commandTownPlay(started.credentials, make({ kind: "case-open" })), error => error.code === "PLACE_CLOSED");
  pass("separate-owned-world-and-exact-classic-asset-profile-preserve-legacy-save");
  pass("wrong-profile-unsupported-place-and-unbound-case-rejected");
  command({ kind: "arrive", sceneId: "books" });
  assert.equal(view.time, "08:05");
  const person = classicResidentPresence(view, "resident-03");
  assert.equal(person.workplace, true);
  assert.equal(person.work.progress, 33);
  assert(person.workingActionId);
  assert.equal(classicResidentPresence(view, "resident-06"), null);
  assert.equal(classicResidentPresence({ ...view, assetSha256: "0".repeat(64) }, "resident-03"), null);
  assert.equal(classicResidentPresence({ ...view, residents: view.residents.map(person => ({ ...person, npcId: "wrong-npc" })) }, "resident-03"), null);
  pass("visual-body-and-work-use-only-exact-bound-current-observations");
  assert.throws(() => commandTownPlay(started.credentials, make({ kind: "work-interrupt", npcId: "rb-gu-yuanshan" })), error => error.code === "NOT_WORKING_HERE");
  command({ kind: "work-interrupt", npcId: "rb-xu-zhiwei" });
  assert.equal(view.time, "08:10");
  assert.equal(classicResidentPresence(view, "resident-03").workingActionId, null);
  const interrupted = withPrivateWorldAccess(view.worldId, () => repository.worldRepository.getWorld(view.worldId));
  assert.equal(interrupted.persistentRuntime.residentWork.stations["rb-xu-zhiwei"].pending, 6);
  assert.equal(interrupted.persistentRuntime.residentWork.history.find(action => action.npcId === "rb-xu-zhiwei").status, "interrupted");
  command({ kind: "work-step" });
  assert.equal(view.time, "08:15");
  assert.notEqual(classicResidentPresence(view, "resident-03").workingActionId, person.workingActionId);
  pass("present-only-greeting-interrupts-work-once-and-next-decision-starts-new-action");
  repository.closeDatabase();
  assert.deepEqual(readTownPlay(started.credentials, "classic-living"), view);
  command({ kind: "arrive", sceneId: "town-square" });
  assert.equal(classicResidentPresence(view, "resident-03"), null);
  assert.equal(view.residents.find(person => person.actorId === "resident-03").work, undefined);
  pass("database-reopen-retains-action-and-last-seen-body-stays-hidden");
  // Advance through the actual schedules; no fixture relocation or fabricated
  // public view is used to prove the noon departure from the bookshop.
  for (let i = 0; i < 3; i++) command({ kind: "wait", minutes: 60 });
  command({ kind: "wait", minutes: 30 });
  command({ kind: "wait", minutes: 15 });
  assert.equal(view.time, "12:05");
  const atSquare = classicResidentPresence(view, "resident-03");
  assert(atSquare && !atSquare.workplace && atSquare.sceneId === "town-square");
  assert.equal(atSquare.workingActionId, null);
  command({ kind: "arrive", sceneId: "books" });
  assert.equal(classicResidentPresence(view, "resident-03"), null);
  assert.equal(JSON.stringify(readTownPlay(legacy.credentials)), legacyBefore);
  pass("actual-noon-commute-shows-restorer-at-square-and-removes-old-counter-body");

  const data = JSON.parse(fs.readFileSync("public/assets/classic-bookshop/v2/navigation.json", "utf8"));
  const cast = JSON.parse(fs.readFileSync("public/assets/classic-bookshop/v2/cast.json", "utf8"));
  for (const entry of cast.entries) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "public", entry.manifestUrl), "utf8"));
    if (manifest.workAction) {
      const collider = manifest.workAction.collider, a = -entry.yaw;
      data.colliders.push({ id: `workplace_${entry.actorId}`, size: collider.size, angle: a, center: [entry.position[0] + Math.cos(a) * collider.center[0] - Math.sin(a) * collider.center[1], entry.position[1] + Math.sin(a) * collider.center[0] + Math.cos(a) * collider.center[1]] });
    }
    data.interactions.push({ id: `art_${entry.actorId}`, actorId: entry.actorId, position: entry.observationPosition, roomId: entry.roomId });
  }
  const nav = createSampleNavigator(data);
  for (const entry of cast.entries) assert(nav.valid(entry.observationPosition), `Restore point blocked for ${entry.actorId}`);
  for (const position of Object.values(squareResidentPositions)) assert(nav.valid(position), "Authored square anchor intersects geometry");
  assert.equal(nav.nearest(cast.entries[0].observationPosition)?.actorId, "resident-03");
  assert.notEqual(nav.nearest(cast.entries[0].observationPosition, item => !item.actorId)?.actorId, "resident-03");
  pass("real-navigation-validates-restoration-square-anchors-and-hidden-interaction-filter");
} finally { repository.closeDatabase(); }
const files = ["lib/classic-living-contract.ts", "lib/town-play-contract.ts", "lib/world/town-exploration-store.ts", "packages/engine/src/town-exploration.ts", "app/town-play/art-sample/living-presentation.ts", "app/town-play/art-sample/sample-navigation.ts", "public/assets/classic-bookshop/v2/manifest.json", "public/assets/classic-bookshop/v2/cast.json", "public/assets/classic-bookshop/v2/navigation.json", "scripts/run-classic-living-checks.mjs"];
const report = { schema: "classic-living-engine-checks.v1", checkedAt: new Date().toISOString(), passed: true, checks, scope: "Actual owned SQLite commands, deterministic noon schedules and real navigation assets; no browser or live-provider claim.", sources: Object.fromEntries(files.map(file => [file, sha(file)])) };
fs.writeFileSync(path.join(run, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ passed: true, checks: checks.length, report: path.join(run, "report.json") }));
