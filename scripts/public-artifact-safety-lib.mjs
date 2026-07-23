import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const FORBIDDEN_PUBLIC_RE = /apiKey|api_key|secretKey|Authorization: Bearer|sk-|\.env\.local|culpritId|\btruth\b|checkpoint|agent_state_snapshot|hiddenDebugLog|[A-Za-z]:[\\/]/;

export function toPosix(value) {
  return value.replace(/\\/g, "/");
}

export function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function listFiles(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(target, base);
    return [toPosix(path.relative(base, target))];
  }).sort((left, right) => left.localeCompare(right));
}

export function assertInside(root, target, label) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`${label} must stay inside ${toPosix(path.relative(process.cwd(), resolvedRoot)) || resolvedRoot}.`);
  }
  return resolvedTarget;
}

export function publicUrlToFile(root, publicUrl) {
  const trimmed = String(publicUrl || "").replace(/^\//, "");
  return path.join(root, "public", trimmed);
}

export function validateAllowedFileSet({ dir, allowedFiles, label }) {
  const files = listFiles(dir);
  const errors = [];
  for (const required of allowedFiles) {
    if (!files.includes(required)) errors.push(`${label}/${required} is required.`);
  }
  for (const file of files) {
    if (!allowedFiles.includes(file)) errors.push(`${label}/${file} is not allowed.`);
  }
  return { ok: errors.length === 0, files, errors };
}

export function scanPublicTextFiles({ dir, label }) {
  const errors = [];
  for (const file of listFiles(dir)) {
    const text = fs.readFileSync(path.join(dir, file), "utf8");
    if (FORBIDDEN_PUBLIC_RE.test(text)) errors.push(`${label}/${file} contains a forbidden public token.`);
  }
  return { ok: errors.length === 0, errors };
}

const FORBIDDEN_CASE_SUMMARY_KEYS = new Set([
  "caseId",
  "victimId",
  "evidenceIds",
  "aftermathIds",
  "sourceIds",
  "explanation",
  "fromCaseId",
  "toCaseId",
  "fromNodeId",
  "toNodeId",
  "actorId",
  "agentId",
  "npcId",
  "eventId",
  "replayBody",
  "packageBody"
]);

const FORBIDDEN_CASE_SUMMARY_VALUE_RE = /\b(?:npc|agent)-|evidence-chain-|aftermath-|case-\d{2,}-\d{3}-[a-f0-9]{8}\b/i;

function walkJson(value, visit, objectPath = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkJson(item, visit, [...objectPath, String(index)]));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    const nextPath = [...objectPath, key];
    visit(key, nested, nextPath);
    walkJson(nested, visit, nextPath);
  }
}

export function validatePublicCaseSummaryIndexFile({ filePath, label }) {
  const errors = [];
  const index = readJson(filePath);
  if (index?.schemaVersion !== "public-case-summary-index.v1") errors.push(`${label} schemaVersion must be public-case-summary-index.v1.`);
  if (!/^[a-z0-9._-]+$/i.test(index?.datasetId || "")) errors.push(`${label} datasetId is invalid.`);
  if (!/^[a-z0-9._-]+$/i.test(index?.sourceRunId || "")) errors.push(`${label} sourceRunId is invalid.`);
  if (!Array.isArray(index?.cases)) errors.push(`${label} cases must be an array.`);
  if (index?.caseCount !== index?.cases?.length) errors.push(`${label} caseCount does not match cases length.`);
  if (index?.summary?.caseCount !== index?.cases?.length) errors.push(`${label} summary caseCount does not match cases length.`);
  const publicIds = new Set();
  for (const item of index?.cases || []) {
    if (!/^public-case-\d{3,}$/.test(item.publicCaseId || "")) errors.push(`${label} publicCaseId is invalid.`);
    if (publicIds.has(item.publicCaseId)) errors.push(`${label} duplicate publicCaseId ${item.publicCaseId}.`);
    publicIds.add(item.publicCaseId);
    if (!/^[a-f0-9]{64}$/i.test(item.sourceCaseHash || "")) errors.push(`${label} sourceCaseHash is invalid for ${item.publicCaseId}.`);
  }
  walkJson(index, (key, nested, objectPath) => {
    if (FORBIDDEN_CASE_SUMMARY_KEYS.has(key)) errors.push(`${label}:${objectPath.join(".")} contains a forbidden raw key.`);
    if (typeof nested === "string" && FORBIDDEN_CASE_SUMMARY_VALUE_RE.test(nested)) {
      errors.push(`${label}:${objectPath.join(".")} contains a forbidden raw id value.`);
    }
  });
  return { ok: errors.length === 0, errors: Array.from(new Set(errors)), index };
}

export function hashPublicArtifactTree({ root = process.cwd(), paths }) {
  const entries = [];
  for (const relativePath of paths) {
    const target = path.resolve(root, relativePath);
    assertInside(path.resolve(root, "public"), target, relativePath);
    for (const file of listFiles(target)) {
      const fullPath = path.join(target, file);
      entries.push({
        path: toPosix(path.join(relativePath, file)),
        bytes: fs.statSync(fullPath).size,
        sha256: sha256(fs.readFileSync(fullPath))
      });
    }
  }
  entries.sort((left, right) => left.path.localeCompare(right.path));
  return {
    fileCount: entries.length,
    treeHash: sha256(JSON.stringify(entries)),
    entries
  };
}
