import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { createTownNavigator } from "../lib/riverbend-navigation.ts";

const root = process.cwd();
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const sha = file => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
const navigationPath = "public/assets/riverbend/v1/navigation.json";
const data = read(navigationPath);
const asset = read("public/assets/riverbend/v1/manifest.json");
assert.equal(data.assetSha256, sha("public/assets/riverbend/v1/town.glb"));
assert.equal(asset.navigation.sha256, sha(navigationPath));
const navigator = createTownNavigator(data);
const checks = [];
for (const route of data.routes) {
  let point = [...route.path[0]];
  for (const target of route.path.slice(1)) {
    assert(navigator.valid(...target), `${route.destination}: invalid route point ${target}`);
    point = navigator.move(point, target[0] - point[0], target[1] - point[1]);
    assert(Math.hypot(point[0] - target[0], point[1] - target[1]) < 1e-6, `${route.destination}: swept path clipped`);
  }
  checks.push({ check: `route:${route.destination}`, passed: true, arrival: point });
}
const walk = (start, dx, dy, ticks) => {
  let point = start;
  for (let i = 0; i < ticks; i++) {
    point = navigator.move(point, dx, dy);
    assert(navigator.valid(...point));
  }
  return point;
};
const wall = walk([.3, 6.7], 0, .1, 500);
assert(wall[1] < 8, "Walked through the bookshop structural wall");
const river = walk([-10, -9.7], 0, -.1, 500);
assert(river[1] > -12, "Walked off the quay into the river");
const bridge = walk([1.5, -7], 0, -.05, 320);
assert(Math.abs(bridge[1] + 23) < 1e-6, "Could not cross the real bridge");
assert(navigator.height([1.5, -16]) > .1, "Bridge elevation was lost");
assert(!navigator.valid(-10, -16), "Water is walkable");
assert.equal(navigator.nearest([0, -7]), null, "Distant interaction is available");
assert.equal(navigator.nearest([-10, 5])?.id, "cafe");
assert.deepEqual(navigator.move([0, -7], NaN, 1), [0, -7]);
assert.deepEqual(navigator.move([0, -7], 9999, 0), [0, -7]);
checks.push({ check: "held-input-wall", passed: true, position: wall },
  { check: "held-input-quay", passed: true, position: river },
  { check: "bridge-traversal-and-height", passed: true, position: bridge },
  { check: "water-rejection-and-proximity", passed: true },
  { check: "invalid-and-suspended-timestep", passed: true });
const receipt = { schema: "riverbend-navigation-checks.v1", passed: true, assetSha256: asset.asset.sha256,
  navigationSha256: sha(navigationPath), codeSha256: sha("lib/riverbend-navigation.ts"),
  checkedAt: new Date().toISOString(), checks, scope: "real exported geometry; local movement only; not browser or case proof" };
fs.writeFileSync(path.join(root, "docs/3d-town/riverbend-v1/navigation-review.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify({ passed: true, checks: checks.length, wall, river, bridge }));
