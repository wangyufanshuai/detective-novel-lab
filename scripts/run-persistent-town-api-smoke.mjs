import { spawn, spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const port = Number(process.env.PERSISTENT_TOWN_API_SMOKE_PORT || 3102);
let baseUrl = process.env.PERSISTENT_TOWN_API_BASE_URL || `http://127.0.0.1:${port}`;
const serverOutput = [];
const smokeTimeout = setTimeout(() => {
  console.error(`Persistent town Agent API smoke test timed out at ${baseUrl}.`);
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
  return json.data || json;
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

if (!process.env.PERSISTENT_TOWN_API_BASE_URL && await isReady("http://127.0.0.1:3000")) {
  baseUrl = "http://127.0.0.1:3000";
}

const server = process.env.PERSISTENT_TOWN_API_BASE_URL || baseUrl === "http://127.0.0.1:3000"
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
  const created = await request("/api/v1/command/town/create", {
    method: "POST",
    body: JSON.stringify({ seed: "persistent-api-smoke", mode: "showcase", caseMode: "generated", npcCount: 8, timelineHours: 24 })
  });
  const worldId = created.world.id;
  assert.ok(worldId, "world id is returned");

  const started = await request("/api/v1/command/town/runtime/start", {
    method: "POST",
    body: JSON.stringify({ worldId, steps: 2 })
  });
  assert.equal(started.runtime.status, "running", "runtime starts running");
  assert.ok(started.runtime.decisionTraces.length > 0, "runtime creates decisions");

  const stepped = await request("/api/v1/command/town/runtime/step", {
    method: "POST",
    body: JSON.stringify({ worldId, steps: 5 })
  });
  assert.ok(stepped.queue.candidates.length > 0, "step returns candidates");

  const agents = await request(`/api/v1/query/town/agents?worldId=${encodeURIComponent(worldId)}`);
  assert.ok(agents.agents.length > 0, "agents query returns states");
  const actorId = agents.agents[0].npcId;

  const agent = await request(`/api/v1/query/town/agent?worldId=${encodeURIComponent(worldId)}&npcId=${encodeURIComponent(actorId)}`);
  assert.ok(agent.candidates.length >= 3, "agent query returns action candidates");

  const intervened = await request("/api/v1/command/town/agent/intervene", {
    method: "POST",
    body: JSON.stringify({ worldId, intervention: { actorId, kind: "resource", value: "resource:api-smoke" } })
  });
  assert.equal(intervened.intervention.branch, "counterfactual", "intervention is counterfactual");

  const candidateQueue = await request(`/api/v1/query/town/candidates?worldId=${encodeURIComponent(worldId)}`);
  const candidate = candidateQueue.candidates[0];
  assert.ok(candidate.id, "candidate id is available");

  const proof = await request(`/api/v1/query/town/emergence-proof?worldId=${encodeURIComponent(worldId)}&candidateId=${encodeURIComponent(candidate.id)}`);
  assert.equal(proof.candidate.id, candidate.id, "proof returns selected candidate");

  const extracted = await request("/api/v1/command/town/case/extract", {
    method: "POST",
    body: JSON.stringify({ worldId, candidateId: candidate.id })
  });
  assert.ok(extracted.activeCase.id, "case extraction returns active case");
  assert.equal(extracted.activeCase.validation.valid, true, "extracted case validates");

  await request("/api/v1/command/town/runtime/pause", {
    method: "POST",
    body: JSON.stringify({ worldId })
  });
  await request("/api/v1/command/town/runtime/reset", {
    method: "POST",
    body: JSON.stringify({ worldId })
  });

  console.log("Persistent town Agent API smoke test passed.");
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
