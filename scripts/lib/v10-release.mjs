import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";

export const V10_RELEASE_LINE = "v10.0";
export const V10_EXPECTED_API_ROUTES = 125;
export const V10_PROTECTED_PUBLIC_PATHS = ["public/dataset-reader", "public/review-catalog"];
export const V10_PROTECTED_PUBLIC_HASH = "a3fca1430935d4252a03db9600d792cf52eedef0984c2469b76ff45addef3c1f";
export const V10_EVIDENCE_FILES = [
  "SHA256SUMS",
  "clean-environment-report.json",
  "dependency-summary.json",
  "release-manifest.json",
  "source-files.sha256"
];

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

export function assertInside(parent, target, label) {
  const root = path.resolve(parent);
  const resolved = path.resolve(target);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`${label} must stay inside its declared root.`);
  }
  return resolved;
}

export function recreateDirectory(parent, target, label) {
  const resolved = assertInside(parent, target, label);
  if (resolved === path.resolve(parent)) throw new Error(`${label} cannot replace its root directory.`);
  fs.rmSync(resolved, { recursive: true, force: true });
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function gitOutput(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function trackedFiles(root) {
  return execFileSync("git", ["ls-files", "-z"], { cwd: root })
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

export function parseLastJson(value) {
  const text = String(value || "").trim();
  for (let index = text.length - 1; index >= 0; index -= 1) {
    if (text[index] !== "{" && text[index] !== "[") continue;
    try { return JSON.parse(text.slice(index)); } catch {}
  }
  return null;
}

export function sanitizeDiagnostic(value, roots = []) {
  let text = String(value || "");
  for (const root of roots.filter(Boolean)) {
    const escaped = path.resolve(root).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(escaped, "gi"), "<workspace>");
    text = text.replace(new RegExp(escaped.replace(/\\\\/g, "/"), "gi"), "<workspace>");
  }
  return text
    .replace(/[A-Za-z]:[\\/][^\r\n"']*/g, "<local-path>")
    .replace(/\/(?:Users|home|workspace|mnt)\/[^\r\n"']*/gi, "<local-path>")
    .slice(-4_000);
}

export function runCommand(command, args, options = {}) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const windowsBatch = process.platform === "win32" && /\.(?:cmd|bat)$/i.test(command);
    const executable = windowsBatch ? "cmd.exe" : command;
    const commandArgs = windowsBatch
      ? ["/d", "/s", "/c", [command, ...args].map((item) => /[\s&|<>^]/.test(String(item)) ? `"${String(item).replace(/"/g, '\\"')}"` : String(item)).join(" ")]
      : args;
    const child = spawn(executable, commandArgs, {
      cwd: options.cwd || process.cwd(),
      env: options.env || process.env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32"
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const timer = options.timeoutMs ? setTimeout(() => {
      timedOut = true;
      try {
        if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
        else process.kill(-child.pid, "SIGTERM");
      } catch { try { child.kill("SIGTERM"); } catch {} }
    }, options.timeoutMs) : null;
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
      if (options.forwardStdout) process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
      if (options.forwardStderr) process.stderr.write(chunk);
    });
    const finish = (exitCode, error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve({
        ok: !timedOut && !error && exitCode === 0,
        exitCode: error ? null : exitCode,
        timedOut,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr: error ? `${stderr}\n${error instanceof Error ? error.message : String(error)}` : stderr
      });
    };
    child.once("error", (error) => finish(null, error));
    child.once("close", (code) => finish(code, null));
  });
}

export function npmExecutable() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

export function npxExecutable() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

export function summarizeCommand(label, result, roots = []) {
  return {
    label,
    ok: result.ok,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    durationMs: result.durationMs,
    ...(result.ok ? {} : { diagnostic: sanitizeDiagnostic(`${result.stdout}\n${result.stderr}`, roots) })
  };
}
