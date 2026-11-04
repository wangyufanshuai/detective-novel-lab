import assert from "node:assert/strict";
import { startReleaseCandidateServer, waitForServer } from "./lib/release-candidate-server.mjs";

let server;
try {
  const adminToken = "case-review-contract-token";
  server = await startReleaseCandidateServer({
    prefix: "case-review-api-contract",
    healthPath: "/api/v1/query/runtime/status",
    env: {
      RUNTIME_ADMIN_TOKENS: adminToken,
      AI_PROVIDER: "mock",
      DEEPSEEK_API_KEY: "",
      SILICONFLOW_API_KEY: ""
    }
  });
  await waitForServer(server.baseUrl, { pathName: "/api/v1/query/runtime/status", timeoutMs: 30_000 });

  async function request(path, options = {}) {
    const response = await fetch(`${server.baseUrl}${path}`, {
      ...options,
      headers: { "content-type": "application/json", ...(options.headers || {}) }
    });
    const json = await response.json();
    return { response, json, data: json.data || json };
  }

  const created = await request("/api/v1/command/town/create", {
    method: "POST",
    headers: { "x-runtime-admin-token": adminToken },
    body: JSON.stringify({
      seed: "case-review-api-contract",
      mode: "showcase",
      caseMode: "generated",
      npcCount: 8,
      timelineHours: 24
    })
  });
  assert.equal(created.response.status, 200, "the fixture world is created through the guarded authoring surface");
  const caseId = created.data.activeCase.id;

  const player = await request(`/api/v1/query/case?caseId=${encodeURIComponent(caseId)}`);
  assert.equal(player.response.status, 200, "player case query remains public");
  assert.equal(player.response.headers.get("x-runtime-surface"), "player");
  assert.equal(player.data.caseFromLog.deductionCase.truth, undefined, "player query never exposes private truth");
  assert.equal(player.data.caseFromLog.deductionCase.logicPuzzle, undefined, "player query never exposes the private logic puzzle");

  const missing = await request(`/api/v1/query/case?caseId=${encodeURIComponent(caseId)}&mode=review&includeIntake=true`);
  assert.equal(missing.response.status, 401, "review query requires an operator credential");
  assert.equal(missing.json.error.code, "ADMIN_UNAUTHORIZED");

  const invalid = await request(`/api/v1/query/case?caseId=${encodeURIComponent(caseId)}&mode=review&includeIntake=true`, {
    headers: { "x-runtime-admin-token": "wrong-case-review-token" }
  });
  assert.equal(invalid.response.status, 403, "review query rejects an invalid operator credential");
  assert.equal(invalid.json.error.code, "ADMIN_UNAUTHORIZED");

  const reviewed = await request(`/api/v1/query/case?caseId=${encodeURIComponent(caseId)}&mode=review&includeIntake=true`, {
    headers: { "x-runtime-admin-token": adminToken }
  });
  assert.equal(reviewed.response.status, 200, "review query accepts the configured operator credential");
  assert.equal(reviewed.response.headers.get("x-runtime-surface"), "admin");
  assert.ok(reviewed.data.caseFromLog.deductionCase.truth?.culpritId, "review query returns source-backed truth");
  assert.ok(Array.isArray(reviewed.data.caseFromLog.sourceEventIds), "review query returns the source event chain");
  assert.ok(reviewed.data.playableIntake, "review query can include the auditable playable intake");

  const unknown = await request("/api/v1/query/case?caseId=missing-case&mode=review");
  assert.equal(unknown.response.status, 401, "review query guards authorization before revealing case existence");

  console.log(JSON.stringify({
    ok: true,
    suite: "case-review-api-contract",
    caseId,
    checks: ["player-safe-truth", "review-authentication", "review-authorization", "review-source-chain", "unknown-case-guard"]
  }));
} finally {
  await server?.cleanup();
}
