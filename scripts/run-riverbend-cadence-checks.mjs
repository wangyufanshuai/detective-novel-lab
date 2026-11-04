import assert from "node:assert/strict";
import { createRefreshCadence } from "../app/town-play/frame-cadence.ts";

const results = [];
for (const refresh of [60, 90, 120, 144, 150, 180, 240]) {
  for (const quality of ["high", "balanced"]) {
    const pacing = createRefreshCadence();
    let now = 0, previous = 0;
    const intervals = [];
    for (let i = 0; i < refresh * 12; i++) {
      now += 1000 / refresh + (i % 2 ? .06 : -.06);
      if (pacing.shouldRender(now, quality)) {
        if (i > refresh * 3) intervals.push(now - previous);
        previous = now;
      }
    }
    const average = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    assert.ok(Math.max(...intervals) - Math.min(...intervals) < .15, "steady browser refresh must not create alternating long/short render intervals");
    assert.ok(Math.max(...intervals) <= (quality === "high" ? 20 : 36), "display-divisor schedule stays within the selected frame budget under this controlled jitter");
    const before = pacing.snapshot();
    assert.equal(pacing.shouldRender(now + 1000, quality), true, "resume renders immediately instead of waiting out an old deadline");
    assert.equal(pacing.snapshot().stride, before.stride, "one suspension must not become the learned refresh period");
    results.push({ refresh, quality, meanIntervalMs: average, stride: before.stride });
  }
}
console.log(JSON.stringify({ passed: true, scope: "synthetic scheduler behavior, not hardware acceptance", results }));
