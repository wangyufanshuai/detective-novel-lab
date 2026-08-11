import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { V10_EVIDENCE_FILES, V10_PROTECTED_PUBLIC_PATHS, gitOutput, sha256 } from "./lib/v10-release.mjs";

const root = process.cwd();
const directory = path.join(root, "outputs", "v10-distribution");
const files = fs.existsSync(directory)
  ? fs.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name).sort()
  : [];
const errors = [];
const required = V10_EVIDENCE_FILES.filter((name) => name !== "clean-environment-report.json");
for (const name of required) if (!files.includes(name)) errors.push(`missing release evidence file: ${name}`);
for (const name of files) if (!V10_EVIDENCE_FILES.includes(name)) errors.push(`unexpected release evidence file: ${name}`);

const forbidden = [
  /[A-Za-z]:[\\/]/,
  /\/(?:Users|home|workspace|mnt)\//i,
  /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/,
  /\b(?:sk|gh[pousr]|xox[baprs])[-_][A-Za-z0-9_-]{16,}\b/i,
  /"(?:culpritId|victimId|npcId|caseId|sessionId|worldId|sourceId|eventId|hiddenTruth|rawBody)"\s*:/i,
  /\b(?:WAL|SHM) file contents\b/i
];
for (const name of files) {
  const text = fs.readFileSync(path.join(directory, name), "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      errors.push(`${name} contains forbidden release evidence content`);
      break;
    }
  }
}

function checksumLines(name) {
  return fs.readFileSync(path.join(directory, name), "utf8").split(/\r?\n/).filter(Boolean).map((line) => {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    if (!match) {
      errors.push(`${name} contains an invalid checksum row`);
      return null;
    }
    return { sha256: match[1], file: match[2] };
  }).filter(Boolean);
}

for (const entry of checksumLines("SHA256SUMS")) {
  const target = path.resolve(directory, entry.file);
  if (path.dirname(target) !== directory || !fs.existsSync(target)) {
    errors.push(`SHA256SUMS references an invalid evidence file: ${entry.file}`);
    continue;
  }
  if (sha256(fs.readFileSync(target)) !== entry.sha256) errors.push(`SHA256SUMS mismatch: ${entry.file}`);
}

const sourceChecks = checksumLines("source-files.sha256");
const seenSourcePaths = new Set();
for (const entry of sourceChecks) {
  const normalized = entry.file.replace(/\\/g, "/");
  if (path.posix.isAbsolute(normalized) || normalized === ".." || normalized.startsWith("../") || normalized.includes("/../") || seenSourcePaths.has(normalized)) {
    errors.push(`source-files.sha256 contains an unsafe or duplicate path: ${normalized}`);
    continue;
  }
  seenSourcePaths.add(normalized);
  let bytes;
  try {
    bytes = V10_PROTECTED_PUBLIC_PATHS.some((prefix) => normalized.startsWith(`${prefix}/`))
      ? fs.readFileSync(path.join(root, normalized))
      : execFileSync("git", ["show", `:${normalized}`], { cwd: root, encoding: null, maxBuffer: 20_000_000 });
  } catch {
    errors.push(`source-files.sha256 cannot resolve: ${normalized}`);
    continue;
  }
  if (sha256(bytes) !== entry.sha256) errors.push(`source-files.sha256 mismatch: ${normalized}`);
}

try {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "release-manifest.json"), "utf8"));
  if (manifest.source?.byteBasis !== "git-index-blob") errors.push("release manifest does not declare canonical Git blob bytes");
  if (manifest.source?.gitTree !== gitOutput(root, ["write-tree"])) errors.push("release manifest Git tree does not match the current index");
  if (sourceChecks.length !== Number(manifest.source?.trackedFileCount || 0) + Number(manifest.protectedPublic?.fileCount || 0)) errors.push("source checksum inventory does not match the manifest");
} catch {
  errors.push("release manifest could not be verified");
}

const result = { ok: errors.length === 0, fileCount: files.length, files, rules: ["no-credentials", "no-absolute-paths", "no-authority-records", "no-database-contents"], errors };
console.log(JSON.stringify(result));
if (!result.ok) process.exitCode = 1;
