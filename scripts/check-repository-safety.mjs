import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root })
  .toString("utf8")
  .split("\0")
  .filter(Boolean);

const forbiddenTrackedPath = /(^|\/)(?:\.env(?:\.local)?|\.codex|\.next|data)(?:\/|$)|NEXT_CHAT_HANDOFF\.md$|tsconfig\.tsbuildinfo$|campaign-study-runtime|detective-town-campaign-study-v1\.json$|\.(?:db|sqlite|sqlite3|wal|shm)$/i;
const credentialPatterns = [
  /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /\bAIza[0-9A-Za-z_-]{25,}\b/
];
const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md", ".yml", ".yaml", ".css", ".html", ".txt"]);
const errors = [];

for (const file of tracked) {
  const normalized = file.replace(/\\/g, "/");
  if (forbiddenTrackedPath.test(normalized)) errors.push(`forbidden tracked path: ${normalized}`);
  if (!textExtensions.has(path.extname(normalized).toLowerCase())) continue;
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute) || fs.statSync(absolute).size > 5_000_000) continue;
  const text = fs.readFileSync(absolute, "utf8");
  for (const pattern of credentialPatterns) {
    if (pattern.test(text)) errors.push(`credential-like token in tracked file: ${normalized}`);
  }
}

const protectedPaths = ["public/dataset-reader", "public/review-catalog"];
const protectedDiff = execFileSync("git", ["diff", "--name-only", "--", ...protectedPaths], { cwd: root })
  .toString("utf8")
  .trim();
if (protectedDiff) errors.push(`protected public artifact changed: ${protectedDiff.replace(/\r?\n/g, ", ")}`);

const result = {
  ok: errors.length === 0,
  trackedFileCount: tracked.length,
  protectedPaths,
  errors
};

console.log(JSON.stringify(result));
if (!result.ok) process.exitCode = 1;
