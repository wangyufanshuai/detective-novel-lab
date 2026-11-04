import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import * as THREE from "three";
import { createResidentMotion, RESIDENT_RADIUS } from "../app/town-play/resident-motion.ts";
import { createTownNavigator } from "../lib/riverbend-navigation.ts";

const base = "docs/3d-town/riverbend-residents-v2/";
const read = path => JSON.parse(fs.readFileSync(path, "utf8"));
const sha = path => crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex");
const author = read(base + "authoring-receipt.json"), renders = read(base + "render-receipt.json");
assert.equal(renders.complete, true, "Finish the ordered Blender multiview suite first");
assert.equal(renders.sourceSha256, author.source.sha256);
assert.equal(author.source.sha256, sha(base + author.source.path));
const data = read("public/assets/riverbend/v1/navigation.json");
const nav = createTownNavigator({ ...data, player: { ...data.player, radius: RESIDENT_RADIUS } });
const ids = Array.from({ length:12 }, (_, i) => `resident-${String(i + 1).padStart(2,"0")}`);
const make = () => new Map(ids.map(id => {
  const actor = new THREE.Group();
  for (const joint of ["leg_left","leg_right","knee_left","knee_right","arm_left","arm_right","head"]) { const object = new THREE.Group(); object.userData.joint = joint; actor.add(object); }
  return [id, actor];
}));
const checks = [];
let samples = 0;
for (const sceneId of ["town-square", ...data.destinations.map(x => x.id)]) {
  for (let group = 0; group < 3; group++) {
    const people = make(), motion = createResidentMotion(people, data), player = [0,-7];
    const observed = ids.slice(group * 4, group * 4 + 4).map(actorId => ({ actorId, sceneId, visibility:"observed" }));
    motion.reconcile(observed, player);
    assert.equal(motion.snapshot().length, 4, `${sceneId}: all four observed residents need a safe visible placement`);
    const initial = motion.snapshot(), minSeparation = RESIDENT_RADIUS * 2 + .07;
    const movers = new Set();
    for (let tick = 0; tick < 3600; tick++) {
      motion.update(1/60, player, false, false);
      const now = motion.snapshot();
      for (let i = 0; i < now.length; i++) {
        assert(nav.valid(...now[i].position), `${sceneId}: resident crosses static geometry`);
        if (now[i].walking) movers.add(now[i].actorId);
        for (let j = i + 1; j < now.length; j++) assert(Math.hypot(now[i].position[0]-now[j].position[0],now[i].position[1]-now[j].position[1]) >= minSeparation, `${sceneId}: residents overlap`);
        samples++;
      }
    }
    assert(movers.size >= 2, `${sceneId}: local movement did not become visible`);
    const beforeRefresh = motion.snapshot();
    motion.reconcile([...observed].reverse(), player);
    assert.deepEqual(motion.snapshot(), beforeRefresh, "Refreshed public view cannot teleport actors");
    for (let tick = 0; tick < 60; tick++) motion.update(1/60, player, true, false);
    assert.deepEqual(motion.snapshot().map(x=>x.position), beforeRefresh.map(x=>x.position), "Reading freezes local movement");
    for (let tick = 0; tick < 60; tick++) motion.update(1/60, player, false, true);
    assert.deepEqual(motion.snapshot().map(x=>x.position), beforeRefresh.map(x=>x.position), "Reduced motion freezes roaming");
    // Isolate the overlap-escape control from unrelated neighbours. Crowd
    // separation was measured above; an escape may legitimately hit a second body.
    motion.reconcile([observed[0]], player);
    const person = motion.snapshot()[0];
    const from = [person.position[0] - 1.2, person.position[1]], next = [person.position[0] - .7, person.position[1]];
    assert.deepEqual(motion.constrainPlayer(from, next), from, "Player cannot walk through a resident");
    assert.deepEqual(motion.constrainPlayer(next, from), from, "Player can escape an overlapping restore");
    const frozen = motion.snapshot();
    motion.update(100, player, false, false);
    assert.deepEqual(motion.snapshot(), frozen, "Suspended-tab timestep must be rejected");
    motion.reconcile(observed.map(x=>({...x,visibility:"last-seen"})), player);
    assert.equal(motion.snapshot().length, 0);
    assert([...people.values()].every(x=>!x.visible), "Historical sighting must not render a current body");
    checks.push({ sceneId, group, actors:initial.length, movingActors:movers.size, passed:true });
  }
}
const inputs = ["app/town-play/resident-motion.ts","lib/riverbend-navigation.ts","public/assets/riverbend/v1/navigation.json", "scripts/run-riverbend-resident-motion-checks.mjs"].map(path=>({path,sha256:sha(path)}));
const receipt = {schema:"riverbend-resident-function.v2",passed:true,checkedAt:new Date().toISOString(),sourceSha256:author.source.sha256,renderReceiptSha256:sha(base+"render-receipt.json"),inputs,residentRadius:RESIDENT_RADIUS,samples,checks,
  invariants:["measured-static-geometry","local-crowd-separation","player-collision-and-escape","view-refresh-continuity","reading-pause","reduced-motion","suspended-tab","last-seen-body-absent"],
  scope:"Pure local presentation tested against actual town navigation; synthetic co-location groups, not engine, browser or human acceptance"};
fs.writeFileSync(base+"function-review.json", JSON.stringify(receipt,null,2)+"\n");
console.log(JSON.stringify({passed:true,scenarios:checks.length,samples}));
