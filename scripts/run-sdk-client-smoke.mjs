import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { DetectiveTownClient } from "../examples/sdk/detective-town-client.mjs";

const port = Number(process.env.SDK_CLIENT_SMOKE_PORT || 3104);
let baseUrl = process.env.SDK_CLIENT_BASE_URL || process.env.DETECTIVE_TOWN_BASE_URL || `http://127.0.0.1:${port}`;
const serverOutput = [];
const smokeTimeout = setTimeout(() => {
  console.error(`SDK client smoke test timed out at ${baseUrl}.`);
  process.exit(1);
}, 180_000);

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function isReady(url) {
  try {
    const response = await fetch(`${url}/api/v1/query/runtime/status`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (await isReady(baseUrl)) return;
    await sleep(500);
  }
  throw new Error(`server did not start at ${baseUrl}\n${serverOutput.slice(-20).join("\n")}`);
}

if (!process.env.SDK_CLIENT_BASE_URL && !process.env.DETECTIVE_TOWN_BASE_URL && await isReady("http://127.0.0.1:3000")) {
  baseUrl = "http://127.0.0.1:3000";
}

const server = process.env.SDK_CLIENT_BASE_URL || process.env.DETECTIVE_TOWN_BASE_URL || baseUrl === "http://127.0.0.1:3000"
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
  const client = new DetectiveTownClient({ baseUrl });

  const status = await client.runtimeStatus();
  assert.equal(status.version, "v1", "runtime status returns v1");
  assert.equal(status.capabilities.scenarioRunner, true, "scenario runner capability is advertised");

  const created = await client.createTown({ seed: "sdk-client-smoke", mode: "showcase", caseMode: "generated", npcCount: 8, timelineHours: 24 });
  const worldId = created.world.id;
  const actorId = created.world.npcs[0].id;
  assert.ok(worldId, "createTown returns world id");

  const started = await client.startRuntime(worldId, { steps: 2 });
  assert.equal(started.runtime.status, "running", "runtime starts");

  const stepped = await client.stepRuntime(worldId, { steps: 3 });
  assert.ok(stepped.queue.candidates.length >= 0, "stepRuntime returns queue");

  const agents = await client.listAgents(worldId);
  assert.ok(agents.agents.length > 0, "listAgents returns agents");
  const agent = await client.getAgent(worldId, actorId);
  assert.equal(agent.agent.npcId, actorId, "getAgent returns selected actor");

  const candidates = await client.listCandidates(worldId);
  assert.ok(Array.isArray(candidates.candidates), "listCandidates returns array");

  const scenario = await client.runScenario(worldId, {
    id: "sdk-smoke-scenario",
    name: "SDK smoke scenario",
    seed: "sdk-client-smoke-fixed",
    baselineSteps: 4,
    branches: [{
      id: "resource-branch",
      name: "Resource branch",
      steps: 4,
      interventions: [{ atTickOffset: 1, intervention: { actorId, kind: "resource", value: "resource:sdk-smoke" } }]
    }],
    passCriteria: { minEventGrowth: 1, minMemoryGrowth: 1, maxBlockedCandidates: 8 }
  });
  assert.equal(scenario.run.id, "sdk-smoke-scenario", "runScenario returns run");

  const report = await client.getScenarioReport(worldId, "sdk-smoke-scenario");
  assert.equal(report.report.scenarioId, "sdk-smoke-scenario", "getScenarioReport returns report");

  const snapshots = await client.listSnapshots(worldId);
  assert.ok(snapshots.snapshots.length >= 2, "listSnapshots returns snapshots");

  const from = scenario.report.baseline.startSnapshotId;
  const to = scenario.report.baseline.endSnapshotId;
  const diff = await client.diffSnapshots(worldId, from, to);
  assert.equal(diff.diff.fromSnapshotId, from, "diffSnapshots returns requested from snapshot");

  const rolledBack = await client.rollbackSnapshot(worldId, from);
  assert.equal(rolledBack.snapshot.id, from, "rollbackSnapshot returns selected snapshot");

  const benchmark = await client.benchmarkEmergence();
  assert.equal(typeof benchmark.available, "boolean", "benchmarkEmergence returns availability");

  const imported = await client.importNovel({
    title: "SDK Smoke Novel",
    rawText: "Chapter 1 Archive\nLin saw a brass key in the archive. Mei denied entering the archive, but a witness placed her there after dusk."
  });
  const projectId = imported.project.id;
  const audit = await client.getNovelAudit(projectId);
  assert.equal(audit.projectId, projectId, "getNovelAudit returns selected project");

  const suggested = await client.suggestCorrections({ projectId, limit: 3 });
  assert.ok(Array.isArray(suggested.suggestedPatches), "suggestCorrections returns patches array");

  await client.pauseRuntime(worldId);
  await client.resetRuntime(worldId);

  console.log("SDK client smoke test passed.");
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
