/** Runtime API surfaces are deliberately explicit so player projections never
 * get confused with authoring, experiment, or operator payloads. */
export const PLAYER_RUNTIME_SURFACE = "player" as const;
export const ADMIN_RUNTIME_SURFACE = "admin" as const;
export type RuntimeApiSurface = typeof PLAYER_RUNTIME_SURFACE | typeof ADMIN_RUNTIME_SURFACE;

export function surfaceTag(surface: RuntimeApiSurface) {
  return { surface } as const;
}

import crypto from "node:crypto";

export type AdminAuthResult = { authorized: boolean; outcome: "authorized" | "missing" | "invalid"; source: "token" | "session" | "none" };

function equalSecret(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Admin credentials may be rotated by setting RUNTIME_ADMIN_TOKENS to a
 * comma-separated list while keeping RUNTIME_ADMIN_TOKEN for compatibility.
 * A reverse proxy can use RUNTIME_ADMIN_SESSION_TOKEN with the session header. */
export function adminSurfaceAuth(request: Request): AdminAuthResult {
  const configuredTokens = (process.env.RUNTIME_ADMIN_TOKENS || process.env.RUNTIME_ADMIN_TOKEN || "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  const sessionToken = process.env.RUNTIME_ADMIN_SESSION_TOKEN?.trim() || "";
  if (!configuredTokens.length && !sessionToken) return { authorized: true, outcome: "authorized", source: "none" };
  const sessionHeader = request.headers.get("x-runtime-admin-session")?.trim() || "";
  if (sessionToken && sessionHeader && equalSecret(sessionHeader, sessionToken)) return { authorized: true, outcome: "authorized", source: "session" };
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
  const presented = request.headers.get("x-runtime-admin-token")?.trim() || bearer;
  if (!presented) return { authorized: false, outcome: "missing", source: "none" };
  if (configuredTokens.some((token) => equalSecret(presented, token))) return { authorized: true, outcome: "authorized", source: "token" };
  return { authorized: false, outcome: "invalid", source: "token" };
}

export function adminSurfaceAuthorized(request: Request) {
  return adminSurfaceAuth(request).authorized;
}

/** Whether the deployment has an explicit operator credential configured. */
export function adminSurfaceConfigured() {
  const tokens = (process.env.RUNTIME_ADMIN_TOKENS || process.env.RUNTIME_ADMIN_TOKEN || "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  return tokens.length > 0 || Boolean(process.env.RUNTIME_ADMIN_SESSION_TOKEN?.trim());
}
