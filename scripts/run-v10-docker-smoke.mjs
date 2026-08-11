import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { findAvailableLocalPort, waitForServer } from "./lib/release-candidate-server.mjs";
import { sanitizeDiagnostic } from "./lib/v10-release.mjs";

const optional = process.argv.includes("--optional");
const root = process.cwd();
const suffix = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const image = `detective-town:v10-smoke-${suffix}`;
const container = `detective-town-v10-smoke-${suffix}`;
let imageCreated = false;
let containerCreated = false;

function docker(args, options = {}) {
  return spawnSync("docker", args, { cwd: root, encoding: "utf8", timeout: options.timeoutMs || 900_000, stdio: options.stdio || ["ignore", "pipe", "pipe"] });
}

function dockerAvailable() {
  const probe = docker(["info", "--format", "{{.ServerVersion}}"], { timeoutMs: 30_000 });
  return probe.status === 0;
}

async function run() {
  if (!dockerAvailable()) {
    if (optional) return { ok: true, skipped: true, target: "linux-container", reason: "container-runtime-unavailable" };
    throw new Error("Docker is unavailable for the Linux container smoke.");
  }
  const build = docker(["build", "--pull=false", "--tag", image, "."], { timeoutMs: 1_200_000 });
  if (build.status !== 0) throw new Error(`Docker build failed. ${sanitizeDiagnostic(`${build.stdout}\n${build.stderr}`, [root])}`);
  imageCreated = true;
  const port = await findAvailableLocalPort();
  const start = docker([
    "run", "--detach", "--name", container,
    "--publish", `127.0.0.1:${port}:3000`,
    "--env", "AI_PROVIDER=mock",
    "--env", "DEEPSEEK_API_KEY=",
    "--env", "SILICONFLOW_API_KEY=",
    "--env", "DATABASE_URL=file:./data/v10-smoke.db",
    image
  ], { timeoutMs: 60_000 });
  if (start.status !== 0) throw new Error(`Docker run failed. ${sanitizeDiagnostic(`${start.stdout}\n${start.stderr}`, [root])}`);
  containerCreated = true;
  await waitForServer(`http://127.0.0.1:${port}`, { pathName: "/api/v1/query/runtime/status", timeoutMs: 120_000 });
  const runtime = await fetch(`http://127.0.0.1:${port}/api/v1/query/runtime/status`, { signal: AbortSignal.timeout(20_000) }).then((response) => response.json());
  assert.equal(runtime.ok, true);
  assert.equal(runtime.data?.storage?.health, "ok");
  const staticResponse = await fetch(`http://127.0.0.1:${port}/?runtime=static&lang=en-US`, { signal: AbortSignal.timeout(20_000) });
  const serverResponse = await fetch(`http://127.0.0.1:${port}/?runtime=server&lang=en-US`, { signal: AbortSignal.timeout(20_000) });
  assert.equal(staticResponse.ok, true);
  assert.equal(serverResponse.ok, true);
  const target = execFileSync("docker", ["image", "inspect", "--format", "{{.Os}}/{{.Architecture}}", image], { encoding: "utf8" }).trim();
  return { ok: true, skipped: false, target, server: { status: 200, storageHealth: "ok" }, static: { status: 200 } };
}

let result;
try {
  result = await run();
} catch (error) {
  result = { ok: false, skipped: false, target: "linux-container", error: sanitizeDiagnostic(error instanceof Error ? error.message : String(error), [root]) };
} finally {
  if (containerCreated) docker(["rm", "--force", container], { timeoutMs: 60_000 });
  if (imageCreated) docker(["image", "rm", "--force", image], { timeoutMs: 120_000 });
}

console.log(JSON.stringify(result));
if (!result.ok) process.exitCode = 1;
