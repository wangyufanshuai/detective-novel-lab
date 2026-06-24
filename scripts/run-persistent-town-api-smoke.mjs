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
  const explicitCreated = await request("/api/v1/command/town/create", {
    method: "POST",
    body: JSON.stringify({ seed: "persistent-api-smoke-explicit", mode: "showcase", caseMode: "generated", npcCount: 8, timelineHours: 24 })
  });
  assert.equal(explicitCreated.world.npcs.length, 8, "explicit generated npcCount is preserved");

  const created = await request("/api/v1/command/town/create", {
    method: "POST",
    body: JSON.stringify({ seed: "persistent-api-smoke", mode: "showcase", caseMode: "generated", timelineHours: 24 })
  });
  const worldId = created.world.id;
  assert.ok(worldId, "world id is returned");
  assert.equal(created.world.npcs.length, 20, "generated server town defaults to 20 NPCs");

  const started = await request("/api/v1/command/town/runtime/start", {
    method: "POST",
    body: JSON.stringify({ worldId, steps: 2 })
  });
  assert.equal(started.runtime.status, "running", "runtime starts running");
  assert.equal(started.runtime.agentStates.length, 20, "runtime creates 20 agent states by default");
  assert.equal(started.runtime.socialProfiles.length, 20, "runtime exposes one social profile per generated NPC");
  assert.equal(started.runtime.locationProfiles.length > 0, true, "runtime exposes location pressure profiles");
  assert.ok(started.runtime.agentStates[0].socialProfile?.dominantTrait, "agent states expose social profile summaries");
  assert.ok(started.runtime.decisionTraces.length > 0, "runtime creates decisions");
  assert.ok(started.runtime.decisionTraces[0].phases?.includes("extract-candidates"), "decision traces expose simulation phases");
  assert.ok(started.runtime.decisionTraces[0].observationIds?.length, "decision traces expose event observations");
  assert.ok(started.runtime.eventObservations?.length > 0, "runtime exposes event observation index");
  assert.ok(started.runtime.relationshipLedger?.length > 0, "runtime exposes relationship ledger changes");
  assert.ok(started.runtime.locationLedger?.length > 0, "runtime exposes location ledger changes");
  assert.ok(started.runtime.decisionTraces[0].consequence?.actionKind, "decision traces expose action consequences");
  assert.ok(started.runtime.decisionTraces[0].consequence?.socialShift, "decision traces expose social consequences");

  const stepped = await request("/api/v1/command/town/runtime/step", {
    method: "POST",
    body: JSON.stringify({ worldId, steps: 5 })
  });
  assert.ok(stepped.queue.candidates.length > 0, "step returns candidates");

  const agents = await request(`/api/v1/query/town/agents?worldId=${encodeURIComponent(worldId)}`);
  assert.ok(agents.agents.length > 0, "agents query returns states");
  assert.ok("propagatedMemoryCount" in agents.agents[0], "agent states expose propagated memory count");
  const actorId = agents.agents[0].npcId;

  const agent = await request(`/api/v1/query/town/agent?worldId=${encodeURIComponent(worldId)}&npcId=${encodeURIComponent(actorId)}`);
  assert.ok(agent.candidates.length >= 3, "agent query returns action candidates");
  assert.ok(Number.isFinite(agent.candidates[0].score.socialAffinity), "agent query exposes social action affinity");
  assert.ok(Number.isFinite(agent.candidates[0].score.locationHeat), "agent query exposes location heat scoring");
  assert.ok(agent.candidates.some((candidate) => ["investigate", "spread-rumor", "seek-alibi", "pressure", "cover-up"].includes(candidate.kind)), "agent query returns core simulation actions");

  const brief = await request(`/api/v1/query/town/brief?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(brief.brief.worldId, worldId, "town brief returns the selected world");
  assert.ok(brief.brief.hotLocations.length > 0, "town brief ranks hot locations");
  assert.ok(brief.brief.riskAgents.length > 0, "town brief ranks high-risk agents");
  assert.ok(Array.isArray(brief.brief.recentSignals), "town brief exposes compact signals");

  const biased = await request("/api/v1/command/town/agent/intervene", {
    method: "POST",
    body: JSON.stringify({ worldId, intervention: { actorId, kind: "action-bias", value: "investigate" } })
  });
  assert.equal(biased.intervention.kind, "action-bias", "action bias intervention is accepted");
  const biasedAgent = await request(`/api/v1/query/town/agent?worldId=${encodeURIComponent(worldId)}&npcId=${encodeURIComponent(actorId)}`);
  assert.equal(
    biasedAgent.candidates.find((candidate) => candidate.kind === "investigate")?.score?.directorBias,
    18,
    "agent query exposes director action bias score"
  );

  const intervened = await request("/api/v1/command/town/agent/intervene", {
    method: "POST",
    body: JSON.stringify({ worldId, intervention: { actorId, kind: "resource", value: "resource:api-smoke" } })
  });
  assert.equal(intervened.intervention.branch, "counterfactual", "intervention is counterfactual");

  let candidateQueue = await request(`/api/v1/query/town/candidates?worldId=${encodeURIComponent(worldId)}`);
  let candidate = candidateQueue.candidates.find((item) => item.validation?.valid) || candidateQueue.candidates[0];
  for (let attempt = 0; attempt < 5 && !candidate?.validation?.valid; attempt += 1) {
    await request("/api/v1/command/town/runtime/step", {
      method: "POST",
      body: JSON.stringify({ worldId, steps: 8 })
    });
    candidateQueue = await request(`/api/v1/query/town/candidates?worldId=${encodeURIComponent(worldId)}`);
    candidate = candidateQueue.candidates.find((item) => item.validation?.valid) || candidateQueue.candidates[0];
  }
  assert.ok(candidate.id, "candidate id is available");
  assert.equal(candidate.validation.valid, true, "at least one valid candidate emerges before extraction");
  assert.ok(candidate.triggeredEventId, "valid candidate is backed by a real triggered case event");
  assert.equal(Object.values(candidate.chainCompleteness || {}).every(Boolean), true, "candidate exposes complete six-stage chain");
  assert.equal(candidate.validation.memoryConfidence.supportScore >= 55, true, "candidate exposes weighted memory support");
  assert.equal(candidate.validation.observationSupport.supportScore >= 55, true, "candidate exposes observation-backed support");
  assert.ok(Array.isArray(candidate.chainStageTags), "candidate exposes chain stage tags");
  assert.ok(Array.isArray(candidate.validation.failureReasons), "candidate exposes validation failure reasons");

  const proof = await request(`/api/v1/query/town/emergence-proof?worldId=${encodeURIComponent(worldId)}&candidateId=${encodeURIComponent(candidate.id)}`);
  assert.equal(proof.candidate.id, candidate.id, "proof returns selected candidate");

  const extracted = await request("/api/v1/command/town/case/extract", {
    method: "POST",
    body: JSON.stringify({ worldId, candidateId: candidate.id })
  });
  assert.ok(extracted.activeCase.id, "case extraction returns active case");
  assert.equal(extracted.activeCase.validation.valid, true, "extracted case validates");
  assert.ok(extracted.playableIntake?.caseId, "case extraction returns playable intake");
  assert.equal(extracted.playableIntake.caseId, extracted.activeCase.id, "playable intake binds to extracted case");
  assert.equal(extracted.playableIntake.sourceCandidateId, candidate.id, "playable intake preserves source candidate id");
  assert.equal(extracted.playableIntake.chainStages.filter((stage) => stage.complete).length >= 6, true, "playable intake exposes complete chain stages");
  assert.ok(extracted.playableIntake.starterTasks.length >= 5, "playable intake exposes starter tasks");
  assert.ok(extracted.playableIntake.evidenceRoute.length >= 5, "playable intake exposes evidence route");
  assert.ok(extracted.playableIntake.witnessPlan.length > 0, "playable intake exposes witness plan");
  assert.equal(JSON.stringify(extracted.playableIntake).includes(extracted.activeCase.deductionCase.truth.culpritId), false, "playable intake does not leak culprit id before solve");
  assert.equal(extracted.activeCase.triggeredEventId, candidate.triggeredEventId, "extracted case preserves the triggered event id");
  assert.equal(extracted.activeCase.sourceCandidateId, candidate.id, "extracted case preserves the source candidate id");
  assert.equal(extracted.events.filter((event) => event.type === "death").length, 1, "extraction response contains one selected death event");
  assert.equal(extracted.activeCase.qualityReport.worldBackedEvidence, true, "extracted case keeps world-backed evidence quality");
  assert.equal(extracted.activeCase.qualityReport.nonCulpritExcluded, true, "extracted case excludes non-culprits");
  assert.equal(extracted.activeCase.qualityReport.reasoningTraceComplete, true, "extracted case has complete reasoning trace");
  for (const evidenceId of ["ev-motive", "ev-means", "ev-opportunity", "ev-staging", "ev-trace", "ev-town-rollcall"]) {
    assert.ok(extracted.activeCase.sourceMap.evidenceSourceEventIds?.[evidenceId]?.length, `${evidenceId} maps to original persistent source events`);
  }
  assert.ok(extracted.activeCase.sourceMap.memorySourceIds?.length, "extracted case exposes memory source ids");
  assert.ok(extracted.activeCase.sourceMap.observationSourceIds?.length, "extracted case exposes observation source ids");

  const queriedCase = await request(`/api/v1/query/case?caseId=${encodeURIComponent(extracted.activeCase.id)}&includeIntake=true`);
  assert.equal(queriedCase.caseFromLog.id, extracted.activeCase.id, "case query returns saved extracted case");
  assert.equal(queriedCase.playableIntake.caseId, extracted.activeCase.id, "case query can rebuild playable intake");

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
