import { spawn, spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const port = Number(process.env.SCENARIO_RUNNER_API_SMOKE_PORT || 3103);
let baseUrl = process.env.SCENARIO_RUNNER_API_BASE_URL || `http://127.0.0.1:${port}`;
const runBenchmarkSmoke = process.env.SCENARIO_RUNNER_API_SMOKE_BENCHMARK === "1";
const serverOutput = [];
const smokeTimeout = setTimeout(() => {
  console.error(`Scenario runner Agent API smoke test timed out at ${baseUrl}.`);
  process.exit(1);
}, 420_000);

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
      const response = await fetch(`${baseUrl}/api/v1/query/runtime/status`);
      if (response.ok) return;
    } catch {
      await sleep(500);
    }
    await sleep(500);
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
        baselineSteps: 45,
        branches: [{
          id: "resource-branch",
          name: "Resource branch",
          steps: 12,
          interventions: [{ atTickOffset: 1, intervention: { actorId, kind: "resource", value: "resource:api-scenario" } }]
        }],
        passCriteria: { minEventGrowth: 1, minMemoryGrowth: 1, maxBlockedCandidates: 8 }
      }
    })
  });
  assert.equal(scenario.run.id, "api-smoke-scenario", "scenario run id is returned");
  assert.equal(scenario.report.branches.length, 1, "scenario report returns branch comparison");
  assert.equal((scenario.runtime.triggeredCases || []).length > 0, true, "scenario baseline records real triggered case events");
  assert.equal((scenario.runtime.longChainLedger || []).some((entry) => entry.complete && entry.maturityScore >= 90), true, "scenario baseline records mature six-stage chains");
  assert.equal((scenario.runtime.eventObservations || []).length > 0, true, "scenario baseline records event observations");
  assert.equal((scenario.runtime.socialProfiles || []).length > 0, true, "scenario baseline records social profiles");
  assert.equal((scenario.runtime.relationshipLedger || []).length > 0, true, "scenario baseline records relationship ledger");
  assert.equal((scenario.runtime.locationProfiles || []).length > 0, true, "scenario baseline records location profiles");
  assert.equal((scenario.runtime.locationLedger || []).length > 0, true, "scenario baseline records location ledger");
  assert.ok(scenario.snapshots.length >= 4, "scenario returns snapshots");
  assert.equal(scenario.snapshots.some((snapshot) => (snapshot.observationIds || []).length > 0), true, "scenario snapshots expose observations");
  assert.equal(scenario.snapshots.every((snapshot) => !snapshot.checkpoint), true, "public snapshots omit rollback checkpoints");

  const queriedRun = await request(`/api/v1/query/town/scenario?worldId=${encodeURIComponent(worldId)}&scenarioId=api-smoke-scenario`);
  assert.equal(queriedRun.run.id, scenario.run.id, "scenario query returns stored run");

  const queriedReport = await request(`/api/v1/query/town/scenario/report?worldId=${encodeURIComponent(worldId)}&scenarioId=api-smoke-scenario`);
  assert.equal(queriedReport.report.scenarioId, scenario.report.scenarioId, "scenario report query returns stored report");

  const scenarioArtifacts = await request(`/api/v1/query/town/scenarios?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(scenarioArtifacts.presets.some((preset) => preset.id === "resource-counterfactual"), true, "scenario list exposes built-in presets");
  assert.equal(scenarioArtifacts.runs.some((run) => run.id === "api-smoke-scenario"), true, "scenario list exposes run history summaries");

  const scenarioPacks = await request(`/api/v1/query/town/scenario-packs?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(scenarioPacks.packs.some((pack) => pack.manifest.id === "small-town-review"), true, "scenario pack list exposes built-in packs");
  assert.equal(scenarioPacks.packs.some((pack) => pack.source === "experiment-folder" && pack.experimentId === "small-town-review"), true, "scenario pack list includes experiment-folder packs");
  const selectedPackId = scenarioPacks.packs.find((pack) => pack.experimentId === "small-town-review")?.manifest.id || "small-town-review";
  const scenarioPackDetail = await request(`/api/v1/query/town/scenario-packs/${encodeURIComponent(selectedPackId)}?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(scenarioPackDetail.pack.manifest.id, selectedPackId, "scenario pack detail returns selected pack");
  const exportedPack = await request("/api/v1/command/town/scenario-pack/export", {
    method: "POST",
    body: JSON.stringify({ worldId, packId: selectedPackId, scenarioId: "api-smoke-scenario" })
  });
  assert.equal(exportedPack.fileName.endsWith(".scenario-pack.json"), true, "scenario pack export returns portable file name");
  assert.equal(JSON.stringify(exportedPack.pack).includes("agent_state_snapshot"), false, "scenario pack export strips runtime snapshots");
  const validatedPack = await request("/api/v1/command/town/scenario-pack/validate", {
    method: "POST",
    body: JSON.stringify({ pack: exportedPack.pack })
  });
  assert.equal(validatedPack.validation.ok, true, "scenario pack validate accepts exported pack");
  const importPreview = await request("/api/v1/command/town/scenario-pack/import", {
    method: "POST",
    body: JSON.stringify({ worldId, pack: exportedPack.pack, previewOnly: true })
  });
  assert.equal(importPreview.preview.installable, true, "scenario pack import preview is installable");

  const mapPacks = await request(`/api/v1/query/town/map-packs?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(mapPacks.packs.some((pack) => pack.manifest.id === "fog-lamp-town"), true, "map pack list exposes built-in semantic map");
  assert.equal(mapPacks.packs.some((pack) => pack.source === "experiment-folder"), true, "map pack list includes experiment-folder maps");
  const selectedMapPackId = mapPacks.packs.find((pack) => pack.experimentId === "small-town-review")?.manifest.id || "fog-lamp-town-minimal";
  const mapPackDetail = await request(`/api/v1/query/town/map-packs/${encodeURIComponent(selectedMapPackId)}?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(mapPackDetail.pack.manifest.id, selectedMapPackId, "map pack detail returns selected pack");
  const exportedMapPack = await request("/api/v1/command/town/map-pack/export", {
    method: "POST",
    body: JSON.stringify({ worldId, packId: selectedMapPackId })
  });
  assert.equal(exportedMapPack.fileName.endsWith(".town-map-pack.json"), true, "map pack export returns portable file name");
  assert.equal(JSON.stringify(exportedMapPack.pack).includes("agent_state_snapshot"), false, "map pack export strips runtime snapshots");
  const validatedMapPack = await request("/api/v1/command/town/map-pack/validate", {
    method: "POST",
    body: JSON.stringify({ pack: exportedMapPack.pack })
  });
  assert.equal(validatedMapPack.validation.ok, true, "map pack validate accepts exported pack");
  const mapImportPreview = await request("/api/v1/command/town/map-pack/import", {
    method: "POST",
    body: JSON.stringify({ worldId, pack: exportedMapPack.pack, previewOnly: true })
  });
  assert.equal(mapImportPreview.preview.installable, true, "map pack import preview is installable");
  const ruleCatalogs = await request(`/api/v1/query/town/rule-catalogs?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(ruleCatalogs.catalogs.some((catalog) => catalog.id === "detective-default"), true, "rule catalog list exposes detective default");
  assert.equal(ruleCatalogs.catalogs.some((catalog) => catalog.source === "experiment-folder" && catalog.validation.ok), true, "rule catalog list includes validated experiment-folder catalog");
  const ruleState = await request(`/api/v1/query/town/rule-state?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(ruleState.ruleState.institutions.length >= 6, true, "rule state query exposes institutions");
  assert.equal(Array.isArray(ruleState.ruleState.evidenceChain.items), true, "rule state query exposes evidence chain items");
  assert.equal(typeof ruleState.ruleState.resourceLedger.police_time.available, "number", "rule state query exposes resource ledger flow");
  const caseLifecycle = await request(`/api/v1/query/town/case-lifecycle?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(Array.isArray(caseLifecycle.lifecycle.caseAftermathLog), true, "case lifecycle query exposes aftermath log");
  assert.equal(typeof caseLifecycle.summary.activeCaseCount, "number", "case lifecycle query exposes summary counts");
  const selectedExperiment = await request("/api/v1/command/town/experiment/select", {
    method: "POST",
    body: JSON.stringify({ worldId, scenarioPackId: selectedPackId, mapPackId: selectedMapPackId, ruleCatalogId: "detective-default" })
  });
  assert.equal(selectedExperiment.currentExperiment.scenarioPackId, selectedPackId, "experiment select records current scenario pack");
  const experimentRun = await request("/api/v1/command/town/experiment/new-run", {
    method: "POST",
    body: JSON.stringify({ worldId })
  });
  assert.equal(experimentRun.job.status, "queued", "new run from pack starts a queued scenario job");
  assert.notEqual(experimentRun.worldId, worldId, "new run from pack creates a branch world");
  assert.equal(experimentRun.sourceWorldId, worldId, "new run response records source world");
  const tickedExperimentJob = await request("/api/v1/command/town/run-job/tick", {
    method: "POST",
    body: JSON.stringify({ worldId: experimentRun.worldId, jobId: experimentRun.job.id })
  });
  assert.equal(tickedExperimentJob.job.status, "completed", "branch experiment job completes on branch world");
  const runArtifacts = await request("/api/v1/query/town/run-artifacts?limit=20");
  assert.equal(runArtifacts.artifacts.some((artifact) => artifact.runId === tickedExperimentJob.job.runId), true, "run artifacts list includes completed pack run");
  const runArtifact = await request(`/api/v1/query/town/run-artifacts/${encodeURIComponent(tickedExperimentJob.job.runId)}`);
  assert.equal(runArtifact.artifact.branchWorldId, experimentRun.worldId, "run artifact records branch world");
  const artifactFiles = await request(`/api/v1/query/town/run-artifacts/${encodeURIComponent(tickedExperimentJob.job.runId)}/files`);
  assert.equal(artifactFiles.files.some((file) => file.name === "replay-bundle.json"), true, "run artifact files include replay bundle");
  assert.equal(artifactFiles.files.some((file) => file.name === "steps.json"), true, "run artifact files include experiment steps");
  assert.equal(artifactFiles.files.some((file) => file.name === "quality-report.json"), true, "run artifact files include quality report");
  assert.equal(artifactFiles.files.some((file) => file.name === "catalog-validation.json"), true, "run artifact files include catalog validation");
  const artifactReplay = await request(`/api/v1/query/town/runs/${encodeURIComponent(tickedExperimentJob.job.runId)}/replay-bundle?worldId=${encodeURIComponent(experimentRun.worldId)}`);
  assert.equal(artifactReplay.bundle.manifest.runId, tickedExperimentJob.job.runId, "replay bundle can be read from artifacts");
  assert.equal(artifactReplay.bundle.experimentMetadata.experimentId, "small-town-review", "replay bundle exposes experiment metadata");
  const artifactReview = await request(`/api/v1/query/town/review/export?worldId=${encodeURIComponent(experimentRun.worldId)}&runId=${encodeURIComponent(tickedExperimentJob.job.runId)}&format=json`);
  assert.equal(artifactReview.bundle.scenario.id, tickedExperimentJob.job.runId, "review export can be read from artifacts without rerun");

  const runs = await request(`/api/v1/query/town/runs?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(runs.runs.some((run) => run.runId === "api-smoke-scenario"), true, "run catalog lists scenario run");
  const runDetail = await request(`/api/v1/query/town/runs/api-smoke-scenario?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(runDetail.run.runId, "api-smoke-scenario", "run detail returns selected run");
  const runSnapshots = await request(`/api/v1/query/town/runs/api-smoke-scenario/snapshots?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(runSnapshots.snapshots.length >= 2, true, "run snapshots endpoint returns scenario snapshots");
  assert.equal(runSnapshots.snapshots.every((snapshot) => snapshot.ruleSummary), true, "run snapshots include rule summaries");
  const runDiffs = await request(`/api/v1/query/town/runs/api-smoke-scenario/diffs?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(runDiffs.diffs.length >= 1, true, "run diffs endpoint returns comparable diffs");
  assert.ok(runDiffs.diffs[0].ruleChanges, "run diffs include rule changes");
  const replayBundle = await request(`/api/v1/query/town/runs/api-smoke-scenario/replay-bundle?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(replayBundle.bundle.manifest.runId, "api-smoke-scenario", "replay bundle exposes run manifest");
  const liveRunId = runs.runs.find((run) => run.runId.endsWith("-live"))?.runId;
  if (liveRunId) {
    const comparison = await request(`/api/v1/query/town/runs/compare?worldId=${encodeURIComponent(worldId)}&left=${encodeURIComponent("api-smoke-scenario")}&right=${encodeURIComponent(liveRunId)}`);
    assert.equal(comparison.comparison.left.runId, "api-smoke-scenario", "run compare returns left run");
  }
  const startedJob = await request("/api/v1/command/town/run-job/start", {
    method: "POST",
    body: JSON.stringify({ worldId, kind: "scenario", scenarioId: "api-smoke-scenario" })
  });
  assert.equal(startedJob.job.status, "queued", "scenario run job starts queued without blocking the API");
  const tickedScenarioJob = await request("/api/v1/command/town/run-job/tick", {
    method: "POST",
    body: JSON.stringify({ worldId, jobId: startedJob.job.id })
  });
  assert.equal(tickedScenarioJob.job.status, "completed", "scenario run job completes on tick and records a run");
  assert.equal(tickedScenarioJob.job.runId, "api-smoke-scenario", "scenario run job links to its run catalog entry");
  assert.equal(tickedScenarioJob.job.progress.percent, 100, "completed scenario run job reaches 100 percent");
  const queriedJob = await request(`/api/v1/query/town/run-jobs/${encodeURIComponent(tickedScenarioJob.job.id)}?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(queriedJob.job.id, tickedScenarioJob.job.id, "run job query returns selected job");
  const listedJobs = await request(`/api/v1/query/town/run-jobs?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(listedJobs.jobs.some((job) => job.id === tickedScenarioJob.job.id), true, "run job list returns recent jobs");
  const benchmarkJob = await request("/api/v1/command/town/run-job/start", {
    method: "POST",
    body: JSON.stringify({ worldId, kind: "benchmark", seedCount: 1 })
  });
  assert.equal(benchmarkJob.job.status, "queued", "benchmark run job starts queued without blocking the API");
  const tickedBenchmarkJob = await request("/api/v1/command/town/run-job/tick", {
    method: "POST",
    body: JSON.stringify({ worldId, jobId: benchmarkJob.job.id })
  });
  assert.equal(tickedBenchmarkJob.job.status, "completed", "benchmark run job can complete and write run history");
  const runsAfterBenchmark = await request(`/api/v1/query/town/runs?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(runsAfterBenchmark.runs.some((run) => run.kind === "benchmark"), true, "run catalog lists benchmark rows");
  const cancelledJob = await request("/api/v1/command/town/run-job/cancel", {
    method: "POST",
    body: JSON.stringify({ worldId, jobId: tickedBenchmarkJob.job.id })
  });
  assert.equal(cancelledJob.job.status, "completed", "completed benchmark job remains immutable when cancel is requested");

  const savedPreset = await request("/api/v1/command/town/scenario/preset/save", {
    method: "POST",
    body: JSON.stringify({
      worldId,
      overwrite: true,
      preset: {
        id: "api-smoke-preset",
        name: "API smoke preset",
        description: "API smoke custom preset",
        config: {
          id: "api-smoke-preset",
          name: "API smoke preset",
          seed: "api-smoke-review-seed",
          baselineSteps: 45,
          branches: [{
            id: "api-smoke-review-branch",
            name: "API smoke review branch",
            steps: 12,
            interventions: [{ atTickOffset: 1, intervention: { actorId, kind: "knowledge", value: "fact:api-smoke" } }]
          }],
          passCriteria: { minValidCandidates: 1, requireHardLogic: true, minEventGrowth: 1, minMemoryGrowth: 1, maxBlockedCandidates: 8 }
        }
      }
    })
  });
  assert.equal(savedPreset.preset.id, "api-smoke-preset", "scenario preset save returns the custom preset");

  const snapshots = await request(`/api/v1/query/town/snapshots?worldId=${encodeURIComponent(worldId)}`);
  assert.ok(snapshots.snapshots.length >= 4, "snapshots query returns time machine state");
  const from = scenario.report.baseline.startSnapshotId;
  const to = scenario.report.baseline.endSnapshotId;

  const diff = await request(`/api/v1/query/town/snapshot/diff?worldId=${encodeURIComponent(worldId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  assert.equal(diff.diff.addedEventIds.length >= 1, true, "snapshot diff reports added events");
  assert.equal(diff.diff.addedMemoryIds.length >= 1, true, "snapshot diff reports added memories");
  assert.equal(diff.diff.addedObservationIds.length >= 1, true, "snapshot diff reports added observations");
  assert.equal((diff.diff.changedLocations || []).length >= 1, true, "snapshot diff reports changed locations");
  assert.equal(diff.to.candidateSummaries.some((candidate) => candidate.triggeredEventId || candidate.maturityScore >= 90), true, "snapshot summaries expose long-chain maturity");

  const rolledBack = await request("/api/v1/command/town/snapshot/rollback", {
    method: "POST",
    body: JSON.stringify({ worldId, snapshotId: from })
  });
  assert.equal(rolledBack.runtime.tick, diff.from.tick, "rollback restores runtime tick");
  assert.equal(rolledBack.snapshot.id, from, "rollback returns selected snapshot");

  const reviewBundle = await request(`/api/v1/query/town/review/export?worldId=${encodeURIComponent(worldId)}&scenarioId=api-smoke-scenario&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&format=markdown&includeBenchmark=true`);
  assert.equal(reviewBundle.bundle.scenario.id, "api-smoke-scenario", "review export binds to the selected scenario");
  assert.equal(reviewBundle.content.includes("Persistent Town Review Bundle"), true, "review export markdown renders a readable bundle");

  const benchmark = await request("/api/v1/query/benchmark/emergence");
  assert.equal(typeof benchmark.available, "boolean", "benchmark endpoint returns availability state");
  if (runBenchmarkSmoke) {
    const rerunBenchmark = await request("/api/v1/command/benchmark/emergence/run", {
      method: "POST",
      body: JSON.stringify({ seedCount: 10 })
    });
    assert.equal(rerunBenchmark.report.seedCount, 10, "benchmark rerun supports quick 10 seeds");
    const latestBenchmark = await request("/api/v1/query/benchmark/emergence");
    assert.equal(latestBenchmark.available, true, "benchmark query can read the latest rerun");
    assert.equal(latestBenchmark.report.seedCount, 10, "benchmark query returns the latest quick report");
  } else {
    const invalidBenchmark = await fetch(`${baseUrl}/api/v1/command/benchmark/emergence/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seedCount: 1 })
    });
    const invalidBenchmarkBody = await invalidBenchmark.json();
    assert.equal(invalidBenchmark.status, 400, "benchmark command validates seed count without running a benchmark");
    assert.equal(invalidBenchmarkBody.ok, false, "benchmark validation uses the v1 error envelope");
  }

  const deletedPreset = await request("/api/v1/command/town/scenario/preset/delete", {
    method: "POST",
    body: JSON.stringify({ worldId, presetId: "api-smoke-preset" })
  });
  assert.equal(deletedPreset.presets.some((preset) => preset.id === "api-smoke-preset"), false, "scenario preset delete removes the custom preset");

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
