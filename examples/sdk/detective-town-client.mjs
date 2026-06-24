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

  benchmarkEmergence() {
    return this.request("/api/v1/query/benchmark/emergence");
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
