import { spawn, spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const port = Number(process.env.SCENARIO_RUNNER_API_SMOKE_PORT || 3103);
let baseUrl = process.env.SCENARIO_RUNNER_API_BASE_URL || `http://127.0.0.1:${port}`;
const serverOutput = [];
const smokeTimeout = setTimeout(() => {
  console.error(`Scenario runner Agent API smoke test timed out at ${baseUrl}.`);
  process.exit(1);
}, 180_000);

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) }
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.ok === false) {
    throw new Error(`${options.method || "GET"} ${path} failed: ${response.status} ${JSON.stringify(json)}`);
  }
  assert.equal(json.ok, true, "v1 response shape includes ok true");
  return json.data;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      await fetch(`${baseUrl}/api/v1/query/runtime/status`);
      return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error(`server did not start at ${baseUrl}\n${serverOutput.slice(-20).join("\n")}`);
}

async function isReady(url) {
  try {
    const response = await fetch(`${url}/api/v1/query/runtime/status`);
    return response.ok;
  } catch {
    return false;
  }
}

if (!process.env.SCENARIO_RUNNER_API_BASE_URL && await isReady("http://127.0.0.1:3000")) {
  baseUrl = "http://127.0.0.1:3000";
}

const server = process.env.SCENARIO_RUNNER_API_BASE_URL || baseUrl === "http://127.0.0.1:3000"
  ? null
  : spawn(process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "npm", process.platform === "win32" ? ["/c", "npm", "run", "dev", "--", "-p", String(port)] : ["run", "dev", "--", "-p", String(port)], {
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
      env: { ...process.env, PORT: String(port), AI_PROVIDER: "mock", DEEPSEEK_API_KEY: "", SILICONFLOW_API_KEY: "" }
    });

server?.stdout.on("data", (chunk) => serverOutput.push(String(chunk).trim()));
server?.stderr.on("data", (chunk) => serverOutput.push(String(chunk).trim()));

try {
  await waitForServer();
  const status = await request("/api/v1/query/runtime/status");
  assert.equal(status.capabilities.scenarioRunner, true, "runtime status exposes scenario runner capability");
  assert.equal(status.capabilities.worldStateTimeMachine, true, "runtime status exposes time machine capability");

  const created = await request("/api/v1/command/town/create", {
    method: "POST",
    body: JSON.stringify({ seed: "scenario-api-smoke", mode: "showcase", caseMode: "generated", timelineHours: 24 })
  });
  const worldId = created.world.id;
  const actorId = created.world.npcs[0].id;
  assert.equal(created.world.npcs.length, 20, "scenario generated baseline defaults to 20 NPCs");

  const scenario = await request("/api/v1/command/town/scenario/run", {
    method: "POST",
    body: JSON.stringify({
      worldId,
      config: {
        id: "api-smoke-scenario",
        name: "API smoke scenario",
        seed: "scenario-api-smoke-fixed",
        baselineSteps: 4,
        branches: [{
          id: "resource-branch",
          name: "Resource branch",
          steps: 4,
          interventions: [{ atTickOffset: 1, intervention: { actorId, kind: "resource", value: "resource:api-scenario" } }]
        }],
        passCriteria: { minEventGrowth: 1, minMemoryGrowth: 1, maxBlockedCandidates: 8 }
      }
    })
  });
  assert.equal(scenario.run.id, "api-smoke-scenario", "scenario run id is returned");
  assert.equal(scenario.report.branches.length, 1, "scenario report returns branch comparison");
  assert.ok(scenario.snapshots.length >= 4, "scenario returns snapshots");
  assert.equal(scenario.snapshots.every((snapshot) => !snapshot.checkpoint), true, "public snapshots omit rollback checkpoints");

  const queriedRun = await request(`/api/v1/query/town/scenario?worldId=${encodeURIComponent(worldId)}&scenarioId=api-smoke-scenario`);
  assert.equal(queriedRun.run.id, scenario.run.id, "scenario query returns stored run");

  const queriedReport = await request(`/api/v1/query/town/scenario/report?worldId=${encodeURIComponent(worldId)}&scenarioId=api-smoke-scenario`);
  assert.equal(queriedReport.report.scenarioId, scenario.report.scenarioId, "scenario report query returns stored report");

  const snapshots = await request(`/api/v1/query/town/snapshots?worldId=${encodeURIComponent(worldId)}`);
  assert.ok(snapshots.snapshots.length >= 4, "snapshots query returns time machine state");
  const from = scenario.report.baseline.startSnapshotId;
  const to = scenario.report.baseline.endSnapshotId;

  const diff = await request(`/api/v1/query/town/snapshot/diff?worldId=${encodeURIComponent(worldId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  assert.equal(diff.diff.addedEventIds.length >= 1, true, "snapshot diff reports added events");
  assert.equal(diff.diff.addedMemoryIds.length >= 1, true, "snapshot diff reports added memories");

  const rolledBack = await request("/api/v1/command/town/snapshot/rollback", {
    method: "POST",
    body: JSON.stringify({ worldId, snapshotId: from })
  });
  assert.equal(rolledBack.runtime.tick, diff.from.tick, "rollback restores runtime tick");
  assert.equal(rolledBack.snapshot.id, from, "rollback returns selected snapshot");

  const benchmark = await request("/api/v1/query/benchmark/emergence");
  assert.equal(typeof benchmark.available, "boolean", "benchmark endpoint returns availability state");

  console.log("Scenario runner Agent API smoke test passed.");
} finally {
  clearTimeout(smokeTimeout);
  if (server) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {
        server.kill("SIGTERM");
      }
    }
  }
}
