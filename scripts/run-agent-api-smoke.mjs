import { spawn, spawnSync } from "node:child_process";
import process from "node:process";
import assert from "node:assert/strict";

const port = Number(process.env.AGENT_API_SMOKE_PORT || 3100);
let baseUrl = process.env.AGENT_API_BASE_URL || `http://127.0.0.1:${port}`;
const serverOutput = [];
const smokeTimeout = setTimeout(() => {
  console.error(`Agent API smoke test timed out at ${baseUrl}.`);
  process.exit(1);
}, 180_000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/v1/query/runtime/status`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await sleep(500);
  }
  throw new Error(`Server did not become ready at ${baseUrl}\n${serverOutput.slice(-20).join("\n")}`);
}

async function isReady(url) {
  try {
    const response = await fetch(`${url}/api/v1/query/runtime/status`);
    return response.ok;
  } catch {
    return false;
  }
}

async function request(method, url, body) {
  const response = await fetch(`${baseUrl}${url}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(`${method} ${url} failed: ${JSON.stringify(data.error || data)}`);
  return data.data;
}

const existingBaseUrl = process.env.AGENT_API_BASE_URL ? baseUrl : null;

if (existingBaseUrl) {
  baseUrl = existingBaseUrl;
} else if (await isReady("http://127.0.0.1:3000")) {
  baseUrl = "http://127.0.0.1:3000";
}

const server = process.env.AGENT_API_BASE_URL || existingBaseUrl || baseUrl === "http://127.0.0.1:3000"
  ? null
  : spawn(process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "npm", process.platform === "win32" ? ["/c", "npm", "run", "dev", "--", "-p", String(port)] : ["run", "dev", "--", "-p", String(port)], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
      env: { ...process.env, PORT: String(port), AI_PROVIDER: "mock", DEEPSEEK_API_KEY: "", SILICONFLOW_API_KEY: "" }
    });

server?.stdout.on("data", (chunk) => serverOutput.push(String(chunk).trim()));
server?.stderr.on("data", (chunk) => serverOutput.push(String(chunk).trim()));

try {
  await waitForServer();

  const runtime = await request("GET", "/api/v1/query/runtime/status");
  assert.equal(runtime.service, "detective-town");
  assert.equal(runtime.version, "v1");
  assert.equal(runtime.storage.health, "ok", "runtime status reports healthy SQLite storage");
  assert.equal(runtime.storage.walEnabled, true, "runtime status reports WAL mode");

  const created = await request("POST", "/api/v1/command/town/create", {
    seed: "agent-api-smoke",
    mode: "showcase",
    caseMode: "premium",
    caseTemplateId: "greenhouse-blade",
    npcCount: 8,
    timelineHours: 24,
    caseArchetype: "auto"
  });
  assert.equal(created.world.npcs.length, 8);
  assert.equal(created.activeCase.validation.valid, true);
  assert.equal(created.activeCase.qualityReport.deductionGraphComplete, true);

  const state = await request("GET", `/api/v1/query/world/state?worldId=${created.world.id}`);
  assert.equal(state.world.id, created.world.id);

  const events = await request("GET", `/api/v1/query/world/events?worldId=${created.world.id}`);
  assert.equal(events.events.some((event) => event.type === "death"), true);

  const caseResult = await request("GET", `/api/v1/query/case?caseId=${created.activeCase.id}`);
  const caseFromLog = caseResult.caseFromLog;
  assert.equal(caseFromLog.deductionCase.truth.culpritId, created.activeCase.deductionCase.truth.culpritId);
  const graphResult = await request("GET", `/api/v1/query/case/deduction-graph?caseId=${created.activeCase.id}`);
  assert.equal(graphResult.graph.complete, true);
  assert.equal(graphResult.suspectBoard.filter((row) => row.status === "culprit").length, 1);

  const joined = await request("POST", "/api/v1/command/player/join", {
    worldId: created.world.id,
    caseId: created.activeCase.id,
    displayName: "Agent Smoke"
  });

  const allEvidenceIds = caseFromLog.deductionCase.evidence.map((item) => item.id);
  for (const evidenceId of allEvidenceIds) {
    await request("POST", "/api/v1/command/investigation/discover", {
      sessionId: joined.session.id,
      evidenceId
    });
  }

  const culpritId = caseFromLog.deductionCase.truth.culpritId;
  const interrogated = await request("POST", "/api/v1/command/investigation/interrogate", {
    sessionId: joined.session.id,
    characterId: culpritId,
    question: "案发窗口你在哪里？",
    evidenceId: "ev-opportunity",
    provider: "mock"
  });
  assert.equal(interrogated.promptAudit.safe, true);

  const wrongCulprit = caseFromLog.deductionCase.characters.find((character) => character.id !== culpritId && character.role !== "死者")?.id;
  const wrong = await request("POST", "/api/v1/command/investigation/submit-theory", {
    sessionId: joined.session.id,
    theory: { culpritId: wrongCulprit, motive: "测试错误动机", method: "测试错误手法", evidenceIds: ["ev-motive"] }
  });
  assert.equal(wrong.judgement.accepted, false);

  const correct = await request("POST", "/api/v1/command/investigation/submit-theory", {
    sessionId: joined.session.id,
    theory: {
      culpritId,
      motive: caseFromLog.deductionCase.truth.motive,
      method: caseFromLog.deductionCase.truth.method,
      evidenceIds: allEvidenceIds
    }
  });
  assert.equal(correct.judgement.accepted, true);

  console.log("Agent API smoke test passed.");
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
