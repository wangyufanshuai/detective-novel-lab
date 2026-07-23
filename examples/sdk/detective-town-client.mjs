export class DetectiveTownApiError extends Error {
  constructor(message, { status, path, payload } = {}) {
    super(message);
    this.name = "DetectiveTownApiError";
    this.status = status;
    this.path = path;
    this.payload = payload;
  }
}

export class DetectiveTownClient {
  constructor({ baseUrl = process.env.DETECTIVE_TOWN_BASE_URL || "http://127.0.0.1:3000", fetchImpl = globalThis.fetch } = {}) {
    if (!fetchImpl) throw new Error("DetectiveTownClient requires fetch. Use Node 18+ or pass fetchImpl.");
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.fetch = fetchImpl;
  }

  async request(path, { method = "GET", body, headers } = {}) {
    const response = await this.fetch(`${this.baseUrl}${path}`, {
      method,
      headers: body === undefined
        ? headers
        : { "content-type": "application/json", ...(headers || {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok === false) {
      throw new DetectiveTownApiError(`${method} ${path} failed`, { status: response.status, path, payload });
    }
    if (payload?.ok !== true || !("data" in payload)) {
      throw new DetectiveTownApiError(`${method} ${path} returned an unexpected response shape`, { status: response.status, path, payload });
    }
    return payload.data;
  }

  query(path, params = {}) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) search.set(key, String(value));
    }
    const query = search.toString();
    return `${path}${query ? `?${query}` : ""}`;
  }

  runtimeStatus() {
    return this.request("/api/v1/query/runtime/status");
  }

  createTown(payload = {}) {
    return this.request("/api/v1/command/town/create", { method: "POST", body: payload });
  }

  startRuntime(worldId, payload = {}) {
    return this.request("/api/v1/command/town/runtime/start", { method: "POST", body: { worldId, ...payload } });
  }

  stepRuntime(worldId, payload = {}) {
    return this.request("/api/v1/command/town/runtime/step", { method: "POST", body: { worldId, ...payload } });
  }

  pauseRuntime(worldId) {
    return this.request("/api/v1/command/town/runtime/pause", { method: "POST", body: { worldId } });
  }

  resetRuntime(worldId) {
    return this.request("/api/v1/command/town/runtime/reset", { method: "POST", body: { worldId } });
  }

  listAgents(worldId) {
    return this.request(this.query("/api/v1/query/town/agents", { worldId }));
  }

  getAgent(worldId, npcId) {
    return this.request(this.query("/api/v1/query/town/agent", { worldId, npcId }));
  }

  listCandidates(worldId) {
    return this.request(this.query("/api/v1/query/town/candidates", { worldId }));
  }

  getTownBrief(worldId) {
    return this.request(this.query("/api/v1/query/town/brief", { worldId }));
  }

  runScenario(worldId, config = {}) {
    return this.request("/api/v1/command/town/scenario/run", { method: "POST", body: { worldId, config } });
  }

  listScenarios(worldId) {
    return this.request(this.query("/api/v1/query/town/scenarios", { worldId }));
  }

  listScenarioPacks(worldId) {
    return this.request(this.query("/api/v1/query/town/scenario-packs", { worldId }));
  }

  exportScenarioPack(worldId, { packId, scenarioId } = {}) {
    return this.request("/api/v1/command/town/scenario-pack/export", { method: "POST", body: { worldId, packId, scenarioId } });
  }

  listMapPacks(worldId) {
    return this.request(this.query("/api/v1/query/town/map-packs", { worldId }));
  }

  exportMapPack(worldId, { packId } = {}) {
    return this.request("/api/v1/command/town/map-pack/export", { method: "POST", body: { worldId, packId } });
  }

  validateMapPack(pack) {
    return this.request("/api/v1/command/town/map-pack/validate", { method: "POST", body: { pack } });
  }

  importMapPack(worldId, pack, { previewOnly = true, overwrite = false } = {}) {
    return this.request("/api/v1/command/town/map-pack/import", { method: "POST", body: { worldId, pack, previewOnly, overwrite } });
  }

  listRuleCatalogs(worldId) {
    return this.request(this.query("/api/v1/query/town/rule-catalogs", { worldId }));
  }

  selectExperiment(worldId, { scenarioPackId, mapPackId, ruleCatalogId } = {}) {
    return this.request("/api/v1/command/town/experiment/select", { method: "POST", body: { worldId, scenarioPackId, mapPackId, ruleCatalogId } });
  }

  startExperimentRun(worldId, { scenarioPackId, mapPackId, ruleCatalogId } = {}) {
    return this.request("/api/v1/command/town/experiment/new-run", { method: "POST", body: { worldId, scenarioPackId, mapPackId, ruleCatalogId } });
  }

  listRunArtifacts({ limit } = {}) {
    return this.request(this.query("/api/v1/query/town/run-artifacts", { limit }));
  }

  getRunArtifact(runId) {
    return this.request(`/api/v1/query/town/run-artifacts/${encodeURIComponent(runId)}`);
  }

  listRunArtifactFiles(runId) {
    return this.request(`/api/v1/query/town/run-artifacts/${encodeURIComponent(runId)}/files`);
  }

  getScenario(worldId, scenarioId) {
    return this.request(this.query("/api/v1/query/town/scenario", { worldId, scenarioId }));
  }

  getScenarioReport(worldId, scenarioId) {
    return this.request(this.query("/api/v1/query/town/scenario/report", { worldId, scenarioId }));
  }

  listSnapshots(worldId) {
    return this.request(this.query("/api/v1/query/town/snapshots", { worldId }));
  }

  diffSnapshots(worldId, from, to) {
    return this.request(this.query("/api/v1/query/town/snapshot/diff", { worldId, from, to }));
  }

  rollbackSnapshot(worldId, snapshotId) {
    return this.request("/api/v1/command/town/snapshot/rollback", { method: "POST", body: { worldId, snapshotId } });
  }

  saveScenarioPreset(worldId, preset, { overwrite = false } = {}) {
    return this.request("/api/v1/command/town/scenario/preset/save", { method: "POST", body: { worldId, preset, overwrite } });
  }

  deleteScenarioPreset(worldId, presetId) {
    return this.request("/api/v1/command/town/scenario/preset/delete", { method: "POST", body: { worldId, presetId } });
  }

  exportReviewBundle(worldId, { runId, scenarioId, from, to, format = "json", includeBenchmark = true } = {}) {
    return this.request(this.query("/api/v1/query/town/review/export", { worldId, runId, scenarioId, from, to, format, includeBenchmark }));
  }

  exportReplayBundle(worldId, runId) {
    return this.request(this.query(`/api/v1/query/town/runs/${encodeURIComponent(runId)}/replay-bundle`, { worldId }));
  }

  benchmarkEmergence() {
    return this.request("/api/v1/query/benchmark/emergence");
  }

  runEmergenceBenchmark(seedCount = 20) {
    return this.request("/api/v1/command/benchmark/emergence/run", { method: "POST", body: { seedCount } });
  }

  startRunJob(worldId, { kind = "scenario", scenarioId, seedCount } = {}) {
    return this.request("/api/v1/command/town/run-job/start", { method: "POST", body: { worldId, kind, scenarioId, seedCount } });
  }

  tickRunJob(worldId, jobId) {
    return this.request("/api/v1/command/town/run-job/tick", { method: "POST", body: { worldId, jobId } });
  }

  cancelRunJob(worldId, jobId) {
    return this.request("/api/v1/command/town/run-job/cancel", { method: "POST", body: { worldId, jobId } });
  }

  resumeRunJob(worldId, jobId) {
    return this.request("/api/v1/command/town/run-job/resume", { method: "POST", body: { worldId, jobId } });
  }

  listRunJobs(worldId) {
    return this.request(this.query("/api/v1/query/town/run-jobs", { worldId }));
  }

  getRunJob(worldId, jobId) {
    return this.request(this.query(`/api/v1/query/town/run-jobs/${encodeURIComponent(jobId)}`, { worldId }));
  }

  importNovel(payload = {}) {
    return this.request("/api/v1/command/novel/import", { method: "POST", body: payload });
  }

  getNovelAudit(projectId) {
    return this.request(this.query("/api/v1/query/novel/audit", { projectId }));
  }

  getNovelIdentities(projectId) {
    return this.request(this.query("/api/v1/query/novel/identities", { projectId }));
  }

  resolveNovelIdentity(projectId, decisionId, status) {
    return this.request("/api/v1/command/novel/identity/resolve", { method: "POST", body: { projectId, decisionId, status } });
  }

  branchNovelSimulation(payload = {}) {
    return this.request("/api/v1/command/novel/simulation/branch", { method: "POST", body: payload });
  }

  suggestCorrections(payload = {}) {
    return this.request("/api/v1/command/novel/correction/suggest", { method: "POST", body: payload });
  }

  applyCorrection(projectId, patch) {
    return this.request("/api/v1/command/novel/correction/apply", { method: "POST", body: { projectId, patch } });
  }

  revertCorrection(projectId, patchId) {
    return this.request("/api/v1/command/novel/correction/revert", { method: "POST", body: { projectId, patchId } });
  }
}

export function createDetectiveTownClient(options = {}) {
  return new DetectiveTownClient(options);
}
