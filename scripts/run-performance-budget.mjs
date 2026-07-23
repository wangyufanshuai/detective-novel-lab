import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { loadEngineForTool } from "./load-engine-for-tools.mjs";

const jsonMode = process.argv.includes("--json");
const root = process.cwd();
const budgets = {
  pageLines: 9000,
  detectiveTownUiLines: 4200,
  globalCssLines: 12000,
  apiRouteFiles: 130,
  runtimeJsonBytes: 4_000_000,
  p95TickMs: 250
};

function lineCount(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").split(/\r?\n/).length;
}

const tracked = execFileSync("git", ["ls-files"], { cwd: root }).toString("utf8").split(/\r?\n/).filter(Boolean);
const engine = await loadEngineForTool("performance-budget");
let world = engine.createInitialWorld("performance-budget", { mode: "showcase", npcCount: 8, timelineHours: 24 });
const daily = engine.simulateDailyLife(world, 1, []);
world = daily.world;
let events = [...daily.events];
let runtime = engine.createPersistentTownRuntime(world, events, { maxTicks: 96 });
const durations = [];

for (let index = 0; index < 24; index += 1) {
  const start = performance.now();
  const advanced = engine.advancePersistentTownTick(world, events, { steps: 1, status: "running", actionEveryTicks: 2 });
  durations.push(performance.now() - start);
  world = advanced.world;
  runtime = advanced.runtime;
  events = [...events, ...advanced.events];
}

const sorted = [...durations].sort((left, right) => left - right);
const metrics = {
  pageLines: lineCount("app/page.tsx"),
  detectiveTownUiLines: lineCount("app/components/DetectiveTownUI.tsx"),
  globalCssLines: lineCount("app/globals.css"),
  apiRouteFiles: tracked.filter((file) => /^app\/api\/.+\/route\.ts$/.test(file)).length,
  runtimeJsonBytes: Buffer.byteLength(JSON.stringify(runtime), "utf8"),
  p95TickMs: Number(sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)].toFixed(2))
};
const failures = Object.entries(budgets)
  .filter(([key, limit]) => metrics[key] > limit)
  .map(([key, limit]) => `${key} ${metrics[key]} exceeds ${limit}`);
const result = { ok: failures.length === 0, sampleTicks: durations.length, metrics, budgets, failures };
console.log(jsonMode ? JSON.stringify(result) : JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
