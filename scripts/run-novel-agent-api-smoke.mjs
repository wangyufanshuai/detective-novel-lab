import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const port = Number(process.env.NOVEL_AGENT_API_SMOKE_PORT || 3101);
let baseUrl = process.env.NOVEL_AGENT_API_BASE_URL || `http://127.0.0.1:${port}`;
const serverOutput = [];
const smokeRuntimeDir = path.join(process.cwd(), "outputs", "novel-agent-api-smoke");
const smokeDatabasePath = path.join(smokeRuntimeDir, "novel-agent-api-smoke.db");
if (!process.env.NOVEL_AGENT_API_BASE_URL) {
  fs.rmSync(smokeRuntimeDir, { recursive: true, force: true });
  fs.mkdirSync(smokeRuntimeDir, { recursive: true });
}
const smokeTimeout = setTimeout(() => {
  console.error(`Novel Agent API smoke test timed out at ${baseUrl}.`);
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

function launchServer() {
  const child = spawn(process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "npm", process.platform === "win32" ? ["/c", "npm", "run", "dev", "--", "-p", String(port)] : ["run", "dev", "--", "-p", String(port)], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
      env: { ...process.env, PORT: String(port), DATABASE_URL: smokeDatabasePath, AI_PROVIDER: "mock", DEEPSEEK_API_KEY: "", SILICONFLOW_API_KEY: "" }
    });
  child.stdout.on("data", (chunk) => serverOutput.push(String(chunk).trim()));
  child.stderr.on("data", (chunk) => serverOutput.push(String(chunk).trim()));
  return child;
}

function stopServer(child) {
  if (!child) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
}

let server = process.env.NOVEL_AGENT_API_BASE_URL ? null : launchServer();

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

  const projectList = await request("GET", "/api/v1/query/novel/projects");
  assert.equal(projectList.projects.some((project) => project.id === imported.project.id), true, "project library lists imported projects");
  const persistedWorkspace = await request("GET", `/api/v1/query/novel/project?projectId=${encodeURIComponent(imported.project.id)}`);
  assert.equal(persistedWorkspace.workspace.project.id, imported.project.id);
  assert.ok(persistedWorkspace.workspace.chapters.length >= 1, "project endpoint returns chapter text state");

  const savedWorkspace = await request("POST", "/api/v1/command/novel/project/save", {
    workspace: {
      ...persistedWorkspace.workspace,
      project: { ...persistedWorkspace.workspace.project, title: "Rain Gate Smoke Saved" }
    },
    expectedUpdatedAt: persistedWorkspace.workspace.updatedAt
  });
  assert.equal(savedWorkspace.workspace.project.title, "Rain Gate Smoke Saved");
  const conflict = await requestFailure("POST", "/api/v1/command/novel/project/save", {
    workspace: persistedWorkspace.workspace,
    expectedUpdatedAt: persistedWorkspace.workspace.updatedAt
  });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.error.code, "NOVEL_PROJECT_CONFLICT");

  const copyId = `${imported.project.id}-copy`;
  const copied = await request("POST", "/api/v1/command/novel/project/save", {
    workspace: {
      ...savedWorkspace.workspace,
      project: { ...savedWorkspace.workspace.project, id: copyId, title: "Rain Gate Smoke Copy" },
      correctionSet: { ...savedWorkspace.workspace.correctionSet, projectId: copyId },
      simulationRuns: savedWorkspace.workspace.simulationRuns.map((run) => ({ ...run, projectId: copyId }))
    }
  });
  assert.equal(copied.workspace.project.id, copyId, "save copy creates a second durable project");

  const worldGraph = await request("GET", `/api/v1/query/novel/world-graph?projectId=${encodeURIComponent(imported.project.id)}`);
  assert.equal(worldGraph.project.id, imported.project.id);
  assert.ok(worldGraph.graph.entities.length >= 2);

  const audit = await request("GET", `/api/v1/query/novel/audit?projectId=${encodeURIComponent(imported.project.id)}`);
  assert.equal(audit.projectId, imported.project.id);
  assert.ok(audit.auditReport.metrics.length >= 5, "audit exposes weighted metrics");

  const identities = await request("GET", `/api/v1/query/novel/identities?projectId=${encodeURIComponent(imported.project.id)}`);
  assert.equal(identities.registry.version, 1, "identity endpoint returns a compatible registry");

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

  const branched = await request("POST", "/api/v1/command/novel/simulation/branch", {
    projectId: imported.project.id,
    baselineRunId: advanced.run.id,
    stepIndex: advanced.run.currentStepIndex,
    seed: "novel-agent-api-smoke-branch",
    intervention: {
      actorEntityId: actor.actorEntityId,
      kind: "body-capability",
      value: 0
    }
  });
  assert.equal(branched.run.parentRunId, advanced.run.id, "branch endpoint preserves its baseline reference");
  assert.equal(branched.run.interventions.length, 1, "branch endpoint stores its bounded intervention");
  const baselineAfterBranch = await request("GET", `/api/v1/query/novel/simulation?projectId=${encodeURIComponent(imported.project.id)}&runId=${encodeURIComponent(advanced.run.id)}`);
  assert.equal(baselineAfterBranch.run.id, advanced.run.id, "creating a branch leaves the baseline run available");

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

  if (server) {
    stopServer(server);
    await sleep(1_000);
    serverOutput.length = 0;
    server = launchServer();
    await waitForServer();
    const restoredAfterRestart = await request("GET", `/api/v1/query/novel/project?projectId=${encodeURIComponent(copyId)}`);
    assert.equal(restoredAfterRestart.workspace.project.title, "Rain Gate Smoke Copy", "SQLite project survives a server restart");
  }

  console.log("Novel Agent API smoke test passed.");
} finally {
  clearTimeout(smokeTimeout);
  stopServer(server);
}
