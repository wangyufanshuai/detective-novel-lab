import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { startReleaseCandidateServer } from "./lib/release-candidate-server.mjs";

const token = "goal16-admin-test-token";
const request = async (baseUrl, path, body, headers = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
  return { response, json: await response.json() };
};

let server;
try {
  server = await startReleaseCandidateServer({
    prefix: "admin-auth-smoke",
    env: { RUNTIME_ADMIN_TOKENS: `old-token,${token}`, RUNTIME_ADMIN_SESSION_TOKEN: "proxy-session-token" }
  });
  const createBody = { seed: `goal16-${Date.now()}`, mode: "showcase", caseMode: "generated", npcCount: 8, timelineHours: 24 };
  const unauthorizedCreate = await request(server.baseUrl, "/api/v1/command/town/create", createBody);
  assert.equal(unauthorizedCreate.response.status, 401, "admin command rejects missing token");
  assert.equal(unauthorizedCreate.json.error.code, "ADMIN_UNAUTHORIZED");
  const invalidCreate = await request(server.baseUrl, "/api/v1/command/town/create", createBody, { "x-runtime-admin-token": "wrong-token" });
  assert.equal(invalidCreate.response.status, 403, "admin command rejects an invalid token");

  const authorizedCreate = await request(server.baseUrl, "/api/v1/command/town/create", createBody, { "x-runtime-admin-token": token });
  assert.equal(authorizedCreate.response.status, 200, "admin command accepts configured token");
  assert.equal(authorizedCreate.response.headers.get("x-runtime-surface"), "admin");
  const worldId = authorizedCreate.json.data.world.id;

  const rotatedTokenCreate = await request(server.baseUrl, "/api/v1/command/town/create", { ...createBody, seed: `${createBody.seed}-old` }, { authorization: "Bearer old-token" });
  assert.equal(rotatedTokenCreate.response.status, 200, "an overlapping rotation token remains valid");
  const sessionCreate = await request(server.baseUrl, "/api/v1/command/town/create", { ...createBody, seed: `${createBody.seed}-session` }, { "x-runtime-admin-session": "proxy-session-token" });
  assert.equal(sessionCreate.response.status, 200, "a trusted proxy session header is accepted");

  const playerStart = await request(server.baseUrl, "/api/v1/command/town/runtime/start", { worldId, steps: 1, actionId: "goal16-player-start" });
  assert.equal(playerStart.response.status, 200, "player runtime command remains usable without admin token");
  assert.equal(playerStart.response.headers.get("x-runtime-surface"), "player");

  const unauthorizedPause = await request(server.baseUrl, "/api/v1/command/town/runtime/pause", { worldId });
  assert.equal(unauthorizedPause.response.status, 401, "admin runtime command rejects missing token");
  const authorizedPause = await request(server.baseUrl, "/api/v1/command/town/runtime/pause", { worldId }, { "x-runtime-admin-token": token });
  assert.equal(authorizedPause.response.status, 200, "admin runtime command accepts configured token");
  assert.equal(authorizedPause.response.headers.get("x-runtime-surface"), "admin");

  const protectedAudit = await fetch(`${server.baseUrl}/api/v1/query/admin/audit?limit=25`, { headers: { "x-runtime-admin-token": token } });
  const protectedAuditJson = await protectedAudit.json();
  assert.equal(protectedAudit.status, 200, "authorized operator can read audit events");
  assert.equal(protectedAudit.headers.get("x-runtime-surface"), "admin");
  assert.ok(Array.isArray(protectedAuditJson.data.events), "audit query returns an event list");
  assert.ok(protectedAuditJson.data.events.some((event) => event.outcome === "missing"), "audit query includes failed auth attempts");

  const missingAudit = await fetch(`${server.baseUrl}/api/v1/query/admin/audit`);
  const missingAuditJson = await missingAudit.json();
  assert.equal(missingAudit.status, 401, "audit query is protected");
  assert.equal(missingAuditJson.error.code, "ADMIN_UNAUTHORIZED");

  const metrics = await fetch(`${server.baseUrl}/api/v1/query/admin/metrics?windowMinutes=60`, { headers: { "x-runtime-admin-token": token } });
  const metricsJson = await metrics.json();
  assert.equal(metrics.status, 200, "authorized operator can read runtime metrics");
  assert.equal(metrics.headers.get("x-runtime-surface"), "admin");
  assert.ok(metricsJson.data.metrics.adminAudit.unauthorized >= 3, "metrics expose an unauthorized alert signal");
  assert.equal(JSON.stringify(metricsJson).includes(token), false, "metrics never expose raw credentials");

  const auditDb = new Database(server.dbPath, { readonly: true, fileMustExist: true });
  const auditRows = auditDb.prepare("select route, outcome, credential_source as credentialSource from admin_audit_events order by created_at asc").all();
  auditDb.close();
  assert.ok(auditRows.length >= 6, "admin attempts are persisted in the audit log");
  assert.equal(JSON.stringify(auditRows).includes(token), false, "audit log never stores raw credentials");

  let unconfiguredServer;
  try {
    unconfiguredServer = await startReleaseCandidateServer({
      prefix: "admin-unconfigured-smoke",
      env: { RUNTIME_ADMIN_TOKENS: "", RUNTIME_ADMIN_TOKEN: "", RUNTIME_ADMIN_SESSION_TOKEN: "" }
    });
    const unconfiguredAudit = await fetch(`${unconfiguredServer.baseUrl}/api/v1/query/admin/audit`);
    const unconfiguredJson = await unconfiguredAudit.json();
    assert.equal(unconfiguredAudit.status, 503, "operator query fails closed when no admin credential is configured");
    assert.equal(unconfiguredJson.error.code, "ADMIN_UNAUTHORIZED");
  } finally {
    await unconfiguredServer?.cleanup();
  }

  console.log(JSON.stringify({ ok: true, suite: "admin-auth-smoke", checks: ["unauthorized-admin-401", "invalid-admin-403", "rotating-token", "proxy-session", "authorized-admin-surface", "player-compatibility", "admin-runtime-guard", "protected-audit-query", "metrics-alert-signal", "audit-without-secrets", "unconfigured-admin-fail-closed"] }, null, 2));
} finally {
  await server?.cleanup();
}
