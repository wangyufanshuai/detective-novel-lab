import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const host = "127.0.0.1";
const DATA_ROOT = path.resolve(process.cwd(), "data");

export async function findAvailableLocalPort() {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const candidate = 12_000 + Math.floor(Math.random() * 36_000);
    const available = await new Promise((resolve, reject) => {
      const probe = net.createServer();
      probe.unref();
      probe.once("error", (error) => {
        if (error?.code === "EADDRINUSE" || error?.code === "EACCES") resolve(false);
        else reject(error);
      });
      probe.listen(candidate, host, () => {
        probe.close((error) => error ? reject(error) : resolve(true));
      });
    });
    // Next.js and browsers reject several well-known or unsafe ports even when
    // the OS reports them as available (for example NFS on 2049). Keep RC
    // harnesses in an unprivileged range above those reserved assignments.
    if (available) return candidate;
  }
  throw new Error("Could not allocate a browser-safe local RC port after 64 attempts.");
}

function assertInsideData(target) {
  const resolved = path.resolve(target);
  if (resolved !== DATA_ROOT && !resolved.startsWith(`${DATA_ROOT}${path.sep}`)) {
    throw new Error(`Release Candidate temporary database must stay inside ${DATA_ROOT}.`);
  }
  return resolved;
}

function databasePathFromUrl(databaseUrl) {
  const raw = String(databaseUrl || "").replace(/^file:/, "");
  const candidate = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw.replace(/^\.\//, ""));
  return assertInsideData(candidate);
}

export function temporaryDatabase(prefix = "rc") {
  const safePrefix = String(prefix).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "rc";
  const fileName = `${safePrefix}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.db`;
  const dbPath = assertInsideData(path.join(DATA_ROOT, fileName));
  return { dbPath, databaseUrl: `file:./data/${fileName}` };
}

export function removeDatabaseFiles(dbPath) {
  const safePath = assertInsideData(dbPath);
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    try { fs.rmSync(`${safePath}${suffix}`, { force: true }); } catch {}
  }
}

async function waitForCleanup(dbPath) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    removeDatabaseFiles(dbPath);
    if (!["", "-wal", "-shm", "-journal"].some((suffix) => fs.existsSync(`${dbPath}${suffix}`))) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  removeDatabaseFiles(dbPath);
}

export function stopProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    try {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      return;
    } catch {}
  }
  try { process.kill(-child.pid, "SIGTERM"); } catch { try { child.kill("SIGTERM"); } catch {} }
}

export async function waitForServer(baseUrl, { pathName = "/?runtime=server", timeoutMs = 120_000 } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}${pathName}`, { signal: AbortSignal.timeout(3_000) });
      if (response.status >= 200 && response.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Release Candidate server did not become ready at ${baseUrl}.`);
}

function serverCommand(mode, port) {
  const script = mode === "dev" ? "dev" : "start";
  return process.platform === "win32"
    ? { command: "cmd.exe", args: ["/d", "/s", "/c", `npm.cmd run ${script} -- -H ${host} -p ${port}`] }
    : { command: "npm", args: ["run", script, "--", "-H", host, "-p", String(port)] };
}

export async function startReleaseCandidateServer({ prefix = "rc-server", mode = "start", port, env = {}, healthPath = "/?runtime=server" } = {}) {
  const selectedPort = Number(port || process.env.RC_PORT || await findAvailableLocalPort());
  if (!Number.isInteger(selectedPort) || selectedPort < 1024 || selectedPort > 65535) throw new Error(`Invalid RC server port: ${selectedPort}`);
  const database = temporaryDatabase(prefix).databaseUrl;
  const dbPath = databasePathFromUrl(database);
  removeDatabaseFiles(dbPath);
  const { command, args } = serverCommand(mode, selectedPort);
  const output = [];
  const child = spawn(command, args, {
    cwd: process.cwd(),
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      ...env,
      // The workspace keeps `.next` on a junction. Next resolves the real
      // build path before loading the app, so make the workspace dependencies
      // discoverable from that resolved drive as well.
      NODE_PATH: [path.join(process.cwd(), "node_modules"), process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
      AI_PROVIDER: "mock",
      DEEPSEEK_API_KEY: "",
      SILICONFLOW_API_KEY: "",
      DATABASE_URL: database,
      PORT: String(selectedPort)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const collect = (chunk) => output.push(String(chunk).slice(-4000));
  child.stdout?.on("data", collect);
  child.stderr?.on("data", collect);
  let startupExitListener;
  const startupExit = new Promise((_, reject) => {
    startupExitListener = (code, signal) => reject(new Error(`Release Candidate server exited during startup (code ${code ?? "none"}, signal ${signal || "none"}).`));
    child.once("exit", startupExitListener);
  });
  try {
    await Promise.race([waitForServer(`http://${host}:${selectedPort}`, { pathName: healthPath }), startupExit]);
  } catch (error) {
    stopProcessTree(child);
    await waitForCleanup(dbPath);
    throw new Error(`${error instanceof Error ? error.message : String(error)} ${output.join("").slice(-2000)}`);
  } finally {
    if (startupExitListener) child.off("exit", startupExitListener);
  }
  let closed = false;
  return {
    child,
    port: selectedPort,
    host,
    baseUrl: `http://${host}:${selectedPort}`,
    databaseUrl: database,
    dbPath,
    output,
    async cleanup() {
      if (closed) return;
      closed = true;
      stopProcessTree(child);
      await waitForCleanup(dbPath);
    }
  };
}

export async function withReleaseCandidateServer(options, callback) {
  const server = await startReleaseCandidateServer(options);
  try {
    return await callback(server);
  } finally {
    await server.cleanup();
  }
}
