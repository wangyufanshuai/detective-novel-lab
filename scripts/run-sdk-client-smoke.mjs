import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { DetectiveTownClient } from "../examples/sdk/detective-town-client.mjs";

const port = Number(process.env.SDK_CLIENT_SMOKE_PORT || 3104);
let baseUrl = process.env.SDK_CLIENT_BASE_URL || process.env.DETECTIVE_TOWN_BASE_URL || `http://127.0.0.1:${port}`;
const runBenchmarkSmoke = process.env.SDK_CLIENT_SMOKE_BENCHMARK === "1";
const serverOutput = [];
const smokeTimeout = setTimeout(() => {
  console.error(`SDK client smoke test timed out at ${baseUrl}.`);
  process.exit(1);
}, 420_000);

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

  const created = await client.createTown({ seed: "sdk-client-smoke", mode: "showcase", caseMode: "generated", timelineHours: 24 });
  const worldId = created.world.id;
  const actorId = created.world.npcs[0].id;
  assert.ok(worldId, "createTown returns world id");
  assert.equal(created.world.npcs.length, 20, "SDK createTown follows generated 20 NPC default");

  const started = await client.startRuntime(worldId, { steps: 2 });
  assert.equal(started.runtime.status, "running", "runtime starts");
  assert.equal((started.runtime.socialProfiles || []).length, 20, "SDK can observe runtime social profiles");
  assert.equal((started.runtime.locationProfiles || []).length > 0, true, "SDK can observe runtime location profiles");

  const stepped = await client.stepRuntime(worldId, { steps: 3 });
  assert.ok(stepped.queue.candidates.length >= 0, "stepRuntime returns queue");
  assert.equal((stepped.runtime.relationshipLedger || []).length > 0, true, "SDK can observe relationship ledger");
  assert.equal((stepped.runtime.locationLedger || []).length > 0, true, "SDK can observe location ledger");

  const agents = await client.listAgents(worldId);
  assert.ok(agents.agents.length > 0, "listAgents returns agents");
  const agent = await client.getAgent(worldId, actorId);
  assert.equal(agent.agent.npcId, actorId, "getAgent returns selected actor");
  assert.ok(agent.agent.socialProfile?.dominantTrait, "getAgent returns social profile summary");

  const candidates = await client.listCandidates(worldId);
  assert.ok(Array.isArray(candidates.candidates), "listCandidates returns array");

  const brief = await client.getTownBrief(worldId);
  assert.equal(brief.brief.worldId, worldId, "getTownBrief returns selected world");
  assert.ok(brief.brief.hotLocations.length > 0, "getTownBrief ranks location pressure");
  assert.ok(brief.brief.riskAgents.length > 0, "getTownBrief ranks agent risk");

  const scenario = await client.runScenario(worldId, {
    id: "sdk-smoke-scenario",
    name: "SDK smoke scenario",
    seed: "sdk-client-smoke-fixed",
    baselineSteps: 45,
    branches: [{
      id: "resource-branch",
      name: "Resource branch",
      steps: 12,
      interventions: [{ atTickOffset: 1, intervention: { actorId, kind: "resource", value: "resource:sdk-smoke" } }]
    }],
    passCriteria: { minEventGrowth: 1, minMemoryGrowth: 1, maxBlockedCandidates: 8 }
  });
  assert.equal(scenario.run.id, "sdk-smoke-scenario", "runScenario returns run");
  assert.equal((scenario.runtime.triggeredCases || []).length > 0, true, "SDK can observe real triggered case events");
  assert.equal((scenario.runtime.longChainLedger || []).some((entry) => entry.complete && entry.maturityScore >= 90), true, "SDK can observe mature six-stage chains");
  assert.equal((scenario.runtime.eventObservations || []).length > 0, true, "SDK can observe event observation index");
  assert.equal((scenario.runtime.relationshipLedger || []).length > 0, true, "SDK can observe social relationship changes");
  assert.equal((scenario.runtime.locationLedger || []).length > 0, true, "SDK can observe location pressure changes");

  const report = await client.getScenarioReport(worldId, "sdk-smoke-scenario");
  assert.equal(report.report.scenarioId, "sdk-smoke-scenario", "getScenarioReport returns report");

  const scenarioArtifacts = await client.listScenarios(worldId);
  assert.equal(scenarioArtifacts.presets.some((preset) => preset.id === "resource-counterfactual"), true, "listScenarios returns built-in presets");
  assert.equal(scenarioArtifacts.runs.some((run) => run.id === "sdk-smoke-scenario"), true, "listScenarios returns run history summaries");

  const scenarioPacks = await client.listScenarioPacks(worldId);
  assert.equal(scenarioPacks.packs.some((pack) => pack.manifest.id === "small-town-review"), true, "listScenarioPacks returns built-in packs");
  const mapPacks = await client.listMapPacks(worldId);
  assert.equal(mapPacks.packs.some((pack) => pack.manifest.id === "fog-lamp-town"), true, "listMapPacks returns built-in map packs");
  const exportedMapPack = await client.exportMapPack(worldId, { packId: "fog-lamp-town" });
  assert.equal(exportedMapPack.fileName.endsWith(".town-map-pack.json"), true, "exportMapPack returns a portable file name");
  const validatedMapPack = await client.validateMapPack(exportedMapPack.pack);
  assert.equal(validatedMapPack.validation.ok, true, "validateMapPack accepts exported map pack");
  const mapImportPreview = await client.importMapPack(worldId, exportedMapPack.pack, { previewOnly: true });
  assert.equal(mapImportPreview.preview.installable, true, "importMapPack supports preview without mutation");
  const ruleCatalogs = await client.listRuleCatalogs(worldId);
  assert.equal(ruleCatalogs.catalogs.some((catalog) => catalog.id === "detective-default"), true, "listRuleCatalogs returns detective default");
  const selectedExperiment = await client.selectExperiment(worldId, { scenarioPackId: "small-town-review", mapPackId: "fog-lamp-town", ruleCatalogId: "detective-default" });
  assert.equal(selectedExperiment.currentExperiment.mapPackId, "fog-lamp-town-minimal", "selectExperiment normalizes experiment folder map pack");
  assert.equal(selectedExperiment.currentExperiment.ruleCatalogId, "detective-default-minimal", "selectExperiment normalizes experiment folder rule catalog");
  assert.equal(selectedExperiment.currentExperiment.experimentId, "small-town-review", "selectExperiment records experiment folder identity");
  const experimentRun = await client.startExperimentRun(worldId);
  assert.equal(experimentRun.job.status, "queued", "startExperimentRun starts a queued job");
  assert.notEqual(experimentRun.worldId, worldId, "startExperimentRun returns a branch world id");
  const tickedExperimentJob = await client.tickRunJob(experimentRun.worldId, experimentRun.job.id);
  assert.equal(tickedExperimentJob.job.status, "completed", "SDK can tick branch experiment job");
  const artifacts = await client.listRunArtifacts({ limit: 20 });
  assert.equal(artifacts.artifacts.some((artifact) => artifact.runId === tickedExperimentJob.job.runId), true, "SDK lists run artifact manifests");
  const artifact = await client.getRunArtifact(tickedExperimentJob.job.runId);
  assert.equal(artifact.artifact.branchWorldId, experimentRun.worldId, "SDK reads run artifact manifest");
  const artifactFiles = await client.listRunArtifactFiles(tickedExperimentJob.job.runId);
  assert.equal(artifactFiles.files.some((file) => file.name === "replay-bundle.json"), true, "SDK reads run artifact files");
  const artifactReplay = await client.exportReplayBundle(experimentRun.worldId, tickedExperimentJob.job.runId);
  assert.equal(artifactReplay.bundle.manifest.runId, tickedExperimentJob.job.runId, "SDK exports replay bundle from artifact");

  const snapshots = await client.listSnapshots(worldId);
  assert.ok(snapshots.snapshots.length >= 2, "listSnapshots returns snapshots");

  const from = scenario.report.baseline.startSnapshotId;
  const to = scenario.report.baseline.endSnapshotId;
  const diff = await client.diffSnapshots(worldId, from, to);
  assert.equal(diff.diff.fromSnapshotId, from, "diffSnapshots returns requested from snapshot");
  assert.equal(diff.diff.addedObservationIds.length >= 1, true, "SDK snapshot diff exposes observation growth");
  assert.equal((diff.diff.changedLocations || []).length >= 1, true, "SDK snapshot diff exposes location pressure changes");
  assert.equal(diff.to.candidateSummaries.some((candidate) => candidate.triggeredEventId || candidate.maturityScore >= 90), true, "SDK snapshot diff exposes long-chain candidate summaries");

  const rolledBack = await client.rollbackSnapshot(worldId, from);
  assert.equal(rolledBack.snapshot.id, from, "rollbackSnapshot returns selected snapshot");

  const savedPreset = await client.saveScenarioPreset(worldId, {
    id: "sdk-review-preset",
    name: "SDK review preset",
    description: "SDK smoke custom preset",
    config: {
      id: "sdk-review-preset",
      name: "SDK review preset",
      seed: "sdk-review-seed",
      baselineSteps: 45,
      branches: [{
        id: "sdk-review-branch",
        name: "SDK review branch",
        steps: 12,
        interventions: [{ atTickOffset: 1, intervention: { actorId, kind: "resource", value: "resource:sdk-review" } }]
      }],
      passCriteria: { minValidCandidates: 1, requireHardLogic: true, minEventGrowth: 1, minMemoryGrowth: 1, maxBlockedCandidates: 8 }
    }
  }, { overwrite: true });
  assert.equal(savedPreset.preset.id, "sdk-review-preset", "saveScenarioPreset persists a custom preset");

  const reviewBundle = await client.exportReviewBundle(worldId, {
    scenarioId: "sdk-smoke-scenario",
    from,
    to,
    format: "json",
    includeBenchmark: true
  });
  assert.equal(reviewBundle.bundle.scenario.id, "sdk-smoke-scenario", "exportReviewBundle returns selected scenario bundle");
  assert.equal(typeof reviewBundle.content, "string", "exportReviewBundle returns serialized content");

  assert.equal(typeof client.runEmergenceBenchmark, "function", "SDK exposes benchmark rerun");
  const benchmark = await client.benchmarkEmergence();
  assert.equal(typeof benchmark.available, "boolean", "benchmarkEmergence returns availability");
  if (runBenchmarkSmoke) {
    const quickBenchmark = await client.runEmergenceBenchmark(10);
    assert.equal(quickBenchmark.report.seedCount, 10, "runEmergenceBenchmark supports quick 10 seeds");
    const latestBenchmark = await client.benchmarkEmergence();
    assert.equal(latestBenchmark.available, true, "benchmark query reads the latest quick benchmark report");
    assert.equal(latestBenchmark.report.seedCount, 10, "benchmark query returns the latest quick benchmark report");
  }

  const deletedPreset = await client.deleteScenarioPreset(worldId, "sdk-review-preset");
  assert.equal(deletedPreset.presets.some((preset) => preset.id === "sdk-review-preset"), false, "deleteScenarioPreset removes the custom preset");

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
