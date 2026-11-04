import { NextResponse } from "next/server";
import { worldRepository } from "@/lib/world/repository";
import { ADMIN_RUNTIME_SURFACE, PLAYER_RUNTIME_SURFACE, adminSurfaceAuth, adminSurfaceConfigured, type RuntimeApiSurface } from "@/app/api/v1/_surface";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "WORLD_NOT_FOUND"
  | "CASE_NOT_FOUND"
  | "CASE_NOT_PLAYABLE"
  | "SESSION_NOT_FOUND"
  | "SESSION_FORBIDDEN"
  | "EVIDENCE_NOT_FOUND"
  | "NOVEL_PROJECT_NOT_FOUND"
  | "NOVEL_PROJECT_CONFLICT"
  | "NOVEL_IDENTITY_NOT_FOUND"
  | "NOVEL_SIMULATION_NOT_FOUND"
  | "SCENARIO_NOT_FOUND"
  | "SCENARIO_PRESET_CONFLICT"
  | "SCENARIO_PRESET_NOT_FOUND"
  | "SCENARIO_PRESET_READ_ONLY"
  | "SCENARIO_PACK_NOT_FOUND"
  | "SCENARIO_PACK_INVALID"
  | "TOWN_MAP_PACK_NOT_FOUND"
  | "TOWN_MAP_PACK_INVALID"
  | "TOWN_MAP_PACK_CONFLICT"
  | "TOWN_MAP_PACK_READ_ONLY"
  | "EXPERIMENT_PACK_NOT_FOUND"
  | "PACKAGE_NOT_FOUND"
  | "DATASET_PACKAGE_NOT_FOUND"
  | "WORLD_PACKAGE_INVALID"
  | "RUN_NOT_FOUND"
  | "RUN_JOB_NOT_FOUND"
  | "SNAPSHOT_NOT_FOUND"
  | "WORLD_ARC_DIRECTIVE_NOT_READY"
  | "PLAYER_RESOURCE_COMMITMENT_NOT_READY"
  | "WORLD_EVENT_OFFER_NOT_READY"
  | "CAMPAIGN_RECOVERY_NOT_READY"
  | "CAMPAIGN_ROUTE_LOCKED"
  | "INVESTIGATOR_HEADQUARTERS_REQUIRED"
  | "INVESTIGATOR_HEADQUARTERS_NOT_READY"
  | "HEADQUARTERS_DIRECTION_LOCKED"
  | "RUNTIME_REVISION_CONFLICT"
  | "PROPOSAL_NOT_FOUND"
  | "PROPOSAL_MISMATCH"
  | "IDEMPOTENCY_IN_PROGRESS"
  | "ADMIN_UNAUTHORIZED"
  | "INTERNAL_ERROR";

/** Optional idempotency support for player commands. Kept in-process so legacy
 * deployments need no schema migration; callers should still send a stable
 * actionId when they need replay protection across requests. */
type IdempotencyReceipt = { fingerprint: string; response: unknown; status: number; createdAt: number; state?: "pending" | "committed"; expiresAt?: number };
const idempotencyReceipts = new Map<string, IdempotencyReceipt>();
const idempotencyTtlMs = 15 * 60 * 1000;

export function requestId(request?: Request) {
  return request?.headers.get("x-request-id") || `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function idempotencyKey(request: Request, body?: { actionId?: unknown }) {
  const header = request.headers.get("idempotency-key")?.trim();
  const actionId = typeof body?.actionId === "string" ? body.actionId.trim() : "";
  return (header || actionId).slice(0, 200) || undefined;
}

export function replayIdempotent(key: string | undefined, fingerprint: string) {
  if (!key) return null;
  const receipt = idempotencyReceipts.get(key) || worldRepository.getIdempotencyReceipt(key);
  if (!receipt || Date.now() - receipt.createdAt > idempotencyTtlMs) {
    if (receipt) idempotencyReceipts.delete(key);
    return null;
  }
  if (receipt.fingerprint !== fingerprint) return fail("BAD_REQUEST", "Idempotency key was already used with a different command", 409);
  if (receipt.state === "pending") return fail("IDEMPOTENCY_IN_PROGRESS", "An identical command is already being committed", 409);
  const responseBody = receipt.response && typeof receipt.response === "object" ? { ...(receipt.response as Record<string, unknown>) } : receipt.response;
  const replayEnvelope = responseBody && typeof responseBody === "object" ? responseBody as Record<string, unknown> : null;
  if (replayEnvelope?.data && typeof replayEnvelope.data === "object") {
    replayEnvelope.data = { ...(replayEnvelope.data as Record<string, unknown>), replayed: true };
  }
  return NextResponse.json(responseBody, { status: receipt.status, headers: { "x-idempotent-replay": "true" } });
}

/** Atomically claims a persistent receipt before a command mutates runtime state. */
export function claimIdempotent(key: string | undefined, fingerprint: string) {
  if (!key) return null;
  const claim = worldRepository.claimIdempotencyReceipt({ key, fingerprint });
  if (claim.kind === "conflict") return fail("BAD_REQUEST", "Idempotency key was already used with a different command", 409);
  if (claim.kind === "pending") return fail("IDEMPOTENCY_IN_PROGRESS", "An identical command is already being committed", 409);
  if (claim.kind === "committed") {
    const responseBody = claim.receipt.response && typeof claim.receipt.response === "object" ? { ...(claim.receipt.response as Record<string, unknown>) } : claim.receipt.response;
    const replayEnvelope = responseBody && typeof responseBody === "object" ? responseBody as Record<string, unknown> : null;
    if (replayEnvelope?.data && typeof replayEnvelope.data === "object") replayEnvelope.data = { ...(replayEnvelope.data as Record<string, unknown>), replayed: true };
    return NextResponse.json(responseBody, { status: claim.receipt.status, headers: { "x-idempotent-replay": "true" } });
  }
  return null;
}

export function rememberIdempotent(key: string | undefined, fingerprint: string, response: unknown, status = 200) {
  if (key) {
    const createdAt = Date.now();
    idempotencyReceipts.set(key, { fingerprint, response, status, createdAt, state: "committed", expiresAt: createdAt + idempotencyTtlMs });
    worldRepository.saveIdempotencyReceipt({ key, fingerprint, response, status, createdAt });
  }
}

export function ok<T>(data: T) {
  return NextResponse.json({ ok: true, data });
}

/**
 * Mark the transport surface without changing the legacy response envelope.
 * The header is intentionally additive so old clients keep parsing the same
 * `{ ok, data }` payload while observability and route-contract tests can
 * distinguish player traffic from authoring/operator traffic.
 */
export function surfaceResponse<T extends Response>(response: T, surface: RuntimeApiSurface): T {
  response.headers.set("x-runtime-surface", surface);
  return response;
}

export function playerOk<T>(data: T) {
  return surfaceResponse(ok(data), PLAYER_RUNTIME_SURFACE);
}

export function adminOk<T>(data: T) {
  return surfaceResponse(ok(data), ADMIN_RUNTIME_SURFACE);
}

export function adminGuard(request: Request, options: { requireConfigured?: boolean } = {}) {
  const auth = adminSurfaceAuth(request);
  const unconfigured = options.requireConfigured === true && !adminSurfaceConfigured();
  const status = unconfigured ? 503 : auth.outcome === "missing" ? 401 : auth.authorized ? 200 : 403;
  try {
    worldRepository.recordAdminAuditEvent({ route: new URL(request.url).pathname, method: request.method, outcome: unconfigured ? "missing" : auth.outcome, status, requestId: requestId(request), credentialSource: auth.source });
  } catch {}
  if (auth.authorized && !unconfigured) return null;
  if (unconfigured) return fail("ADMIN_UNAUTHORIZED", "The admin surface is not configured for operator access", status);
  return fail("ADMIN_UNAUTHORIZED", auth.outcome === "missing" ? "An authenticated admin surface is required" : "The admin credential is invalid", status);
}

export function fail(code: ApiErrorCode, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message, retryable: status >= 500 || status === 409 }, requestId: requestId() }, { status });
}

export function errorResponse(error: unknown) {
  if (error instanceof Error && error.message.startsWith("RUNTIME_REVISION_CONFLICT:")) {
    return fail("RUNTIME_REVISION_CONFLICT", error.message.replace("RUNTIME_REVISION_CONFLICT: ", ""), 409);
  }
  return fail("INTERNAL_ERROR", error instanceof Error ? error.message : "Unknown error", 500);
}

export async function readJson<T>(request: Request, fallback: T): Promise<T> {
  return (await request.json().catch(() => fallback)) as T;
}
