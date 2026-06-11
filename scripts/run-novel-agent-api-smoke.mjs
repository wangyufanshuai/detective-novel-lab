import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

const port = Number(process.env.NOVEL_AGENT_API_SMOKE_PORT || 3101);
let baseUrl = process.env.NOVEL_AGENT_API_BASE_URL || `http://127.0.0.1:${port}`;
const serverOutput = [];

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

async function requestFailure(method, url, body) {
  const response = await fetch(`${baseUrl}${url}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  assert.equal(data.ok, false, `${method} ${url} should fail`);
  return { status: response.status, error: data.error };
}

async function isReady(url) {
  try {
    const response = await fetch(`${url}/api/v1/query/runtime/status`);
    return response.ok;
  } catch {
    return false;
  }
}

if (!process.env.NOVEL_AGENT_API_BASE_URL && await isReady("http://127.0.0.1:3000")) {
  baseUrl = "http://127.0.0.1:3000";
}

const server = process.env.NOVEL_AGENT_API_BASE_URL || baseUrl === "http://127.0.0.1:3000"
  ? null
  : spawn(process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "npm", process.platform === "win32" ? ["/c", "npm", "run", "dev", "--", "-p", String(port)] : ["run", "dev", "--", "-p", String(port)], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PORT: String(port), AI_PROVIDER: "mock", DEEPSEEK_API_KEY: "", SILICONFLOW_API_KEY: "" }
    });

server?.stdout.on("data", (chunk) => serverOutput.push(String(chunk).trim()));
server?.stderr.on("data", (chunk) => serverOutput.push(String(chunk).trim()));

try {
  await waitForServer();

  const imported = await request("POST", "/api/v1/command/novel/import", {
    title: "Rain Gate Smoke",
    genreTone: "living world mystery",
    rawText: [
      "Chapter 1 Rain Gate",
      "Lin Yao entered Rain Gate City as old formation lines glowed under the rain.",
      "",
      "Chapter 2 Intercept",
      "Shen Qiu intercepted him near the gate and recognized the cracked jade slip from an old missing-person case.",
      "",
      "Chapter 3 Sect Order",
      "Before midnight, Qingyun Sect ordered outsiders surrendered and records destroyed."
    ].join("\n")
  });
  assert.equal(imported.project.version, 2);
  assert.ok(imported.chapters.length >= 1);

  const worldGraph = await request("GET", `/api/v1/query/novel/world-graph?projectId=${encodeURIComponent(imported.project.id)}`);
  assert.equal(worldGraph.project.id, imported.project.id);
  assert.ok(worldGraph.graph.entities.length >= 2);

  const audit = await request("GET", `/api/v1/query/novel/audit?projectId=${encodeURIComponent(imported.project.id)}`);
  assert.equal(audit.projectId, imported.project.id);
  assert.ok(audit.auditReport.metrics.length >= 5, "audit exposes weighted metrics");

  const suggestions = await request("POST", "/api/v1/command/novel/correction/suggest", {
    projectId: imported.project.id,
    limit: 5
  });
  assert.ok(Array.isArray(suggestions.suggestedPatches), "suggest returns patch candidates");

  const targetEntity = worldGraph.graph.entities[0];
  const correctedName = `${targetEntity.name} API Corrected`;
  const applied = await request("POST", "/api/v1/command/novel/correction/apply", {
    projectId: imported.project.id,
    patch: {
      id: "api-smoke-rename-entity",
      target: { kind: "entity", id: targetEntity.id },
      operation: { type: "rename-entity", name: correctedName },
      reason: "API smoke rename correction"
    }
  });
  assert.equal(applied.patch.status, "applied");

  const corrected = await request("GET", `/api/v1/query/novel/corrected-world-graph?projectId=${encodeURIComponent(imported.project.id)}`);
  assert.equal(corrected.mode, "corrected");
  assert.equal(corrected.graph.entities.find((entity) => entity.id === targetEntity.id)?.name, correctedName);

  const originalAfterCorrection = await request("GET", `/api/v1/query/novel/world-graph?projectId=${encodeURIComponent(imported.project.id)}`);
  assert.equal(originalAfterCorrection.graph.entities.find((entity) => entity.id === targetEntity.id)?.name, targetEntity.name, "original graph remains unchanged");

  const corrections = await request("GET", `/api/v1/query/novel/corrections?projectId=${encodeURIComponent(imported.project.id)}`);
  assert.equal(corrections.applied.some((patch) => patch.id === "api-smoke-rename-entity"), true);

  await requestFailure("POST", "/api/v1/command/novel/correction/apply", {
    projectId: imported.project.id,
    patch: {
      id: "api-smoke-invalid-evidence",
      target: { kind: "entity", id: targetEntity.id },
      operation: {
        type: "replace-evidence",
        evidence: [{ id: "bad-ref", source: { chapterId: "missing", paragraphId: "missing", quote: "bad", summary: "bad", confidence: 0.9 }, keywords: [] }]
      },
      reason: "invalid dangling evidence"
    }
  });

  const revertedCorrection = await request("POST", "/api/v1/command/novel/correction/revert", {
    projectId: imported.project.id,
    patchId: "api-smoke-rename-entity"
  });
  assert.equal(revertedCorrection.correctionSet.patches.find((patch) => patch.id === "api-smoke-rename-entity")?.status, "reverted");

  const correctedAfterRevert = await request("GET", `/api/v1/query/novel/corrected-world-graph?projectId=${encodeURIComponent(imported.project.id)}`);
  assert.equal(correctedAfterRevert.graph.entities.find((entity) => entity.id === targetEntity.id)?.name, targetEntity.name);

  const started = await request("POST", "/api/v1/command/novel/simulation/start", {
    projectId: imported.project.id,
    seed: "novel-agent-api-smoke"
  });
  assert.equal(started.run.projectId, imported.project.id);
  assert.equal(started.validation.valid, true);

  const advanced = await request("POST", "/api/v1/command/novel/simulation/advance", {
    projectId: imported.project.id,
    runId: started.run.id
  });
  assert.ok(["paused", "complete", "blocked"].includes(advanced.run.status));
  assert.ok(advanced.scene.locations.length >= 1);

  const actor = advanced.run.currentSnapshot.actorStates[0];
  assert.ok(actor?.actorEntityId, "simulation exposes an actor for intervention");

  const intervened = await request("POST", "/api/v1/command/novel/simulation/intervene", {
    projectId: imported.project.id,
    runId: advanced.run.id,
    actorEntityId: actor.actorEntityId,
    kind: "relationship-pressure",
    value: 90
  });
  assert.equal(intervened.run.mode, "short-branch");
  assert.ok(intervened.intervention.summary.includes(actor.name));

  const detail = await request("GET", `/api/v1/query/novel/detail?projectId=${encodeURIComponent(imported.project.id)}&type=entity&id=${encodeURIComponent(actor.actorEntityId)}`);
  assert.equal(detail.detail.id, actor.actorEntityId);

  const simulation = await request("GET", `/api/v1/query/novel/simulation?projectId=${encodeURIComponent(imported.project.id)}&runId=${encodeURIComponent(intervened.run.id)}`);
  assert.equal(simulation.run.id, intervened.run.id);

  const rewound = await request("POST", "/api/v1/command/novel/simulation/rewind", {
    projectId: imported.project.id,
    runId: intervened.run.id
  });
  assert.ok(rewound.run.currentStepIndex <= intervened.run.currentStepIndex);

  console.log("Novel Agent API smoke test passed.");
} finally {
  if (server) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      server.kill();
    }
  }
}
