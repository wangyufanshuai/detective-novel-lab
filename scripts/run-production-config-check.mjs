import fs from "node:fs";
import path from "node:path";

/**
 * Lightweight deployment configuration guard.
 *
 * This intentionally does not print credential values. It checks the checked-in
 * contract (.env.example and the runtime auth implementation), then inspects
 * the current process environment for production-only misconfiguration. Local
 * development may run without an admin secret; set REQUIRE_RUNTIME_ADMIN_CONFIG=1
 * (or NODE_ENV=production) to make the secret requirement hard-fail.
 */

const root = process.cwd();
const requiredEnvKeys = [
  "DATABASE_URL",
  "NEXT_PUBLIC_DEMO_MODE",
  "RUNTIME_ADMIN_TOKENS",
  "RUNTIME_ADMIN_SESSION_TOKEN"
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function parseEnvExample(text) {
  const keys = new Set();
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=/.exec(line);
    if (match) keys.add(match[1]);
  }
  return keys;
}

function configuredTokens() {
  return [process.env.RUNTIME_ADMIN_TOKENS, process.env.RUNTIME_ADMIN_TOKEN]
    .filter((value) => typeof value === "string" && value.trim())
    .flatMap((value) => value.split(",").map((token) => token.trim()).filter(Boolean));
}

const checks = [];
const warnings = [];
const errors = [];
const check = (id, ok, detail) => {
  checks.push({ id, ok, detail });
  if (!ok) errors.push(`${id}: ${detail}`);
};

let envExample = "";
try {
  envExample = read(".env.example");
} catch {
  check("env-example-readable", false, ".env.example is missing or unreadable");
}

const envKeys = parseEnvExample(envExample);
for (const key of requiredEnvKeys) {
  check(`env-example-${key.toLowerCase()}`, envKeys.has(key), `${key} is declared`);
}

let surface = "";
let utils = "";
try {
  surface = read("app/api/v1/_surface.ts");
  utils = read("app/api/v1/_utils.ts");
} catch {
  check("auth-source-readable", false, "runtime auth source files are missing or unreadable");
}

check("timing-safe-secret-comparison", /timingSafeEqual/.test(surface), "admin secrets use timing-safe comparison");
check("rotation-token-support", /RUNTIME_ADMIN_TOKENS/.test(surface), "comma-separated token rotation is supported");
check("legacy-token-compatibility", /RUNTIME_ADMIN_TOKEN/.test(surface), "legacy admin token remains supported");
check("proxy-session-support", /RUNTIME_ADMIN_SESSION_TOKEN/.test(surface) && /x-runtime-admin-session/.test(surface), "trusted proxy session credentials are supported");
check("admin-guard-wired", /function\s+adminGuard/.test(utils) && /adminSurfaceAuth/.test(utils), "admin routes share the adminGuard boundary");
check("audit-recording-wired", /recordAdminAuditEvent/.test(utils), "admin attempts are written to the audit ledger");

const tokens = configuredTokens();
const sessionToken = typeof process.env.RUNTIME_ADMIN_SESSION_TOKEN === "string" ? process.env.RUNTIME_ADMIN_SESSION_TOKEN.trim() : "";
const productionRequired = process.env.NODE_ENV === "production" || process.env.REQUIRE_RUNTIME_ADMIN_CONFIG === "1";
const hasAdminCredential = tokens.length > 0 || Boolean(sessionToken);

if (productionRequired) {
  check("runtime-database-url", Boolean(process.env.DATABASE_URL?.trim()), "production requires DATABASE_URL");
  check("runtime-admin-credential", hasAdminCredential, "production requires RUNTIME_ADMIN_TOKENS/RUNTIME_ADMIN_TOKEN or RUNTIME_ADMIN_SESSION_TOKEN");
} else if (!hasAdminCredential) {
  warnings.push("runtime admin credentials are unset; this is allowed for local development only");
}

if (tokens.some((token) => token.length < 16) || (sessionToken && sessionToken.length < 16)) {
  const detail = "configured admin credentials are shorter than the recommended 16 characters";
  if (productionRequired) errors.push(`credential-length: ${detail}`);
  else warnings.push(detail);
}

const report = {
  ok: errors.length === 0,
  mode: productionRequired ? "production-required" : "development-advisory",
  checks,
  warnings,
  errors,
  runtime: {
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    demoMode: process.env.NEXT_PUBLIC_DEMO_MODE || null,
    adminCredentialSources: [...new Set([
      tokens.length ? "token" : null,
      sessionToken ? "session" : null
    ].filter(Boolean))],
    adminTokenCount: tokens.length,
    adminSessionConfigured: Boolean(sessionToken)
  }
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
