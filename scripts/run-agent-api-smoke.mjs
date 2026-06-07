import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import assert from "node:assert/strict";

const port = Number(process.env.AGENT_API_SMOKE_PORT || 3100);
const baseUrl = process.env.AGENT_API_BASE_URL || `http://127.0.0.1:${port}`;
const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/v1/query/runtime/status`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await sleep(500);
  }
  throw new Error(`Server did not become ready at ${baseUrl}`);
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

const server = process.env.AGENT_API_BASE_URL
  ? null
  : spawn(process.execPath, [nextBin, "dev", "-p", String(port)], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PORT: String(port) }
    });

try {
  await waitForServer();

  const runtime = await request("GET", "/api/v1/query/runtime/status");
  assert.equal(runtime.service, "detective-town");
  assert.equal(runtime.version, "v1");

  const created = await request("POST", "/api/v1/command/town/create", {
    seed: "agent-api-smoke",
    mode: "showcase",
    npcCount: 8,
    timelineHours: 24,
    caseArchetype: "auto"
  });
  assert.equal(created.world.npcs.length, 8);
  assert.equal(created.activeCase.validation.valid, true);

  const state = await request("GET", `/api/v1/query/world/state?worldId=${created.world.id}`);
  assert.equal(state.world.id, created.world.id);

  const events = await request("GET", `/api/v1/query/world/events?worldId=${created.world.id}`);
  assert.equal(events.events.some((event) => event.type === "death"), true);

  const caseResult = await request("GET", `/api/v1/query/case?caseId=${created.activeCase.id}`);
  const caseFromLog = caseResult.caseFromLog;
  assert.equal(caseFromLog.deductionCase.truth.culpritId, created.activeCase.deductionCase.truth.culpritId);

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
    evidenceId: "ev-opportunity"
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
  if (server) {
    server.kill();
  }
}
