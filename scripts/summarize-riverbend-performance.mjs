import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const root = process.cwd();
const [highPath, balancedPath, coldPath] = process.argv.slice(2);
assert(highPath && balancedPath && coldPath, "Pass high tour, balanced tour and cold-load JSON paths");
const read = file => JSON.parse(fs.readFileSync(path.resolve(root, file), "utf8").replace(/^\uFEFF/, ""));
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(path.resolve(root, file))).digest("hex");
const link = file => path.relative(root, path.resolve(root, file)).replaceAll("\\", "/");
const quantile = (values, q) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * q))];
const sourceIdentity = {};
function verifyTour(file, quality, budgetMs) {
  const report = read(file);
  assert.equal(report.completed, true, `${quality}: incomplete tour`);
  assert.equal(report.quality, quality);
  assert.equal(report.failure, null);
  assert.equal(report.sourceUnchanged, true);
  assert.equal(report.assetSha256, hash("public/assets/riverbend/v1/town.glb"));
  assert.equal(report.sourceSha256, hash("docs/3d-town/riverbend-v1/riverbend-town.blend"));
  for (const [file, expected] of Object.entries(report.sources)) {
    assert.equal(hash(file), expected, `Performance report is stale: ${file}`);
    if (sourceIdentity[file]) assert.equal(sourceIdentity[file], expected, "Quality runs used different source versions");
    sourceIdentity[file] = expected;
  }
  const frames = report.samples;
  assert(frames.length > 0);
  for (let index = 0; index < frames.length; index++) {
    const sample = frames[index];
    assert.equal(sample.frame, report.startedFrame + index + 1, "Frame stream has a gap");
    assert.equal(sample.quality, quality);
    assert.equal(sample.visibility, "visible");
    assert(Number.isFinite(sample.frameMs) && sample.frameMs > 0 && Number.isFinite(sample.cpuSubmitMs));
    if (index) assert(sample.at > frames[index - 1].at, "Non-monotonic browser timestamps");
  }
  const durationMs = frames.at(-1).at - frames[0].at + frames[0].frameMs;
  assert(durationMs >= 600000);
  const moved = frames.filter(frame => frame.moving);
  assert(moved.length > frames.length / 2, "Tour has insufficient movement workload");
  for (const id of ["cafe", "books", "police", "station", "post", "inn", "south-arrival"]) {
    const steps = report.steps.filter(step => step.destination === id);
    assert(steps.length >= 1 && steps.every(step => !step.failure), `Missing or failed route ${id}`);
    for (const step of steps) {
      assert(step.actions.some(action => action.action === "walked-to-destination"));
      assert(step.actions.some(action => action.action === "returned-to-spawn"));
      assert(step.actions.some(action => action.action === "journal"));
      if (id !== "south-arrival") assert(step.actions.some(action => action.action === "observed-place" && action.modalPaused));
    }
  }
  const intervals = frames.map(frame => frame.frameMs);
  const movingP95Ms = quantile(moved.map(frame => frame.frameMs), .95);
  const p95Ms = quantile(intervals, .95);
  const meanMs = intervals.reduce((sum, item) => sum + item, 0) / intervals.length;
  return {
    quality, passedWithinMeasuredScope: p95Ms <= budgetMs && movingP95Ms <= budgetMs,
    budgetMs, durationMs, frames: frames.length, movingFrames: moved.length, routes: report.steps.length,
    meanMs, averageFps: 1000 / meanMs, p50Ms: quantile(intervals, .5), p95Ms, movingP95Ms,
    p99Ms: quantile(intervals, .99), maxMs: Math.max(...intervals), framesOver50Ms: intervals.filter(ms => ms > 50).length,
    p95CpuSubmitMs: quantile(frames.map(frame => frame.cpuSubmitMs), .95),
    maxDrawCalls: Math.max(...frames.map(frame => frame.drawCalls)), maxTriangles: Math.max(...frames.map(frame => frame.triangles)),
    environment: report.environment, cadence: report.cadence, batching: report.batching,
    raw: { path: link(file), sha256: hash(file) }
  };
}
const tours = [verifyTour(highPath, "high", 20), verifyTour(balancedPath, "balanced", 36)];
const cold = read(coldPath);
assert.equal(cold.schema, "riverbend-cold-load.v1");
assert.equal(cold.trials.length, 3);
for (const trial of cold.trials) {
  assert.equal(trial.status, 200);
  assert.equal(trial.assetSha256, hash("public/assets/riverbend/v1/town.glb"));
  assert(Number.isFinite(trial.readyMs) && trial.readyMs > 0);
  assert.equal(trial.errors.length + trial.failures.length + trial.apiRequests.length, 0);
  assert.equal(trial.gameResources.length, 3);
  assert(trial.gameResources.every(resource => resource.transferSize > 0));
}
const receipt = {
  schema: "riverbend-performance-review.v1", checkedAt: new Date().toISOString(), sources: sourceIdentity,
  assetSha256: hash("public/assets/riverbend/v1/town.glb"), navigationSha256: hash("public/assets/riverbend/v1/navigation.json"),
  localDevelopmentExteriorBudgetPassed: tours.every(tour => tour.passedWithinMeasuredScope),
  productionBuildVerified: false, humanArtApproved: false, fullGameRuntimeAccepted: false,
  physicalMobileDeviceVerified: false, tours,
  coldLoad: { readyMs: cold.trials.map(trial => trial.readyMs), transferBytes: cold.trials.map(trial => trial.totalTransferBytes), conditions: cold.conditions, raw: { path: link(coldPath), sha256: hash(coldPath) } },
  interpretation: [
    "Original art, six exterior observations, bridge, map, journal, modal pause and lantern only; this workload does not contain scheduled residents, case or interior transitions.",
    "A headless Chrome workload used the real laptop GPU. Prior headed runs stalled when the automation window lost foreground; they are retained as incomplete, not relabeled as passes.",
    "The renderer uses display-divisor cadence. High targets approximately 60 fps or the next higher divisor; balanced chooses the closest display divisor to 30 fps.",
    "CPU submit durations do not measure GPU completion. Batching reduced draw calls but did not by itself improve the earlier matched p95 test.",
    "Cold-load figures are fresh browser cache over localhost against a warm development server; they do not predict internet delivery or production bundles.",
    "This report leaves the overall game, novel, art and device acceptance goals open."
  ]
};
const output = "docs/3d-town/riverbend-v1/performance-review.json";
fs.writeFileSync(path.join(root, output), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify({ output, localDevelopmentExteriorBudgetPassed: receipt.localDevelopmentExteriorBudgetPassed, tours: tours.map(({ quality, durationMs, frames, p95Ms, movingP95Ms }) => ({ quality, durationMs, frames, p95Ms, movingP95Ms })), coldReadyMs: receipt.coldLoad.readyMs }));
