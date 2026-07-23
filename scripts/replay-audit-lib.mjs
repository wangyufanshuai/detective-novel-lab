import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const SCHEMA_VERSION = 1;
const TEXT_FILE_RE = /\.(json|md|txt|yaml|yml|csv)$/i;
const JSON_FILE_RE = /\.json$/i;
const SECRET_PATTERNS = [
  { code: "secret.sk", pattern: /\bsk-[A-Za-z0-9][A-Za-z0-9_-]{12,}\b/ },
  { code: "secret.api-key-field", pattern: /"(?:apiKey|api_key|secretKey|token)"\s*:/i },
  { code: "secret.bearer", pattern: /Authorization\s*:\s*Bearer/i },
  { code: "secret.env-local", pattern: /\.env\.local/i }
];
const BUNDLE_FORBIDDEN_KEYS = new Set(["checkpoint", "agent_state_snapshot", "hiddenDebugLog"]);

function toPosix(input) {
  return input.replace(/\\/g, "/");
}

function relativeStoreRoot(storeDir, cwd = process.cwd()) {
  const relative = toPosix(path.relative(cwd, storeDir));
  if (!relative || relative === ".") return ".";
  if (relative.startsWith("..")) return path.basename(storeDir);
  return relative;
}

function makeFinding(severity, code, runId, file, message) {
  return { severity, code, runId, file, message };
}

function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error };
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isSafeRelativePath(filePath) {
  if (!filePath || path.isAbsolute(filePath)) return false;
  const normalized = path.normalize(filePath);
  return normalized !== ".." && !normalized.startsWith(`..${path.sep}`) && !normalized.includes(`${path.sep}..${path.sep}`);
}

function fileTarget(runDir, relativePath) {
  const target = path.resolve(runDir, relativePath);
  const root = path.resolve(runDir);
  return target === root || target.startsWith(`${root}${path.sep}`) ? target : null;
}

async function listPhysicalFiles(runDir) {
  const entries = await fs.readdir(runDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function hashFile(filePath) {
  const data = await fs.readFile(filePath);
  return {
    bytes: data.length,
    sha256: crypto.createHash("sha256").update(data).digest("hex"),
    text: TEXT_FILE_RE.test(filePath) ? data.toString("utf8") : null
  };
}

function walkObject(value, visit, objectPath = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkObject(item, visit, [...objectPath, String(index)]));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    const nextPath = [...objectPath, key];
    visit(key, nested, nextPath);
    walkObject(nested, visit, nextPath);
  }
}

function valueAtPath(value, keys) {
  let current = value;
  for (const key of keys) {
    if (!current || typeof current !== "object") return undefined;
    current = current[key];
  }
  return current;
}

function findForbiddenBundleFields(parsed) {
  const findings = [];
  walkObject(parsed, (key, nested, objectPath) => {
    if (BUNDLE_FORBIDDEN_KEYS.has(key)) {
      findings.push({ code: "bundle.runtime-field", path: objectPath.join(".") });
    }
    if (key === "truth" && nested && typeof nested === "object" && Object.prototype.hasOwnProperty.call(nested, "culpritId")) {
      findings.push({ code: "bundle.hidden-truth", path: [...objectPath, "culpritId"].join(".") });
    }
    if (key === "hidden" && nested === true) {
      const sibling = objectPath.slice(0, -1).reduce((current, part) =>
        current && typeof current === "object" ? current[part] : undefined, parsed);
      const hasConclusion = sibling && typeof sibling === "object" &&
        /culprit|motive|method|conclusion|truth/i.test(JSON.stringify(sibling).slice(0, 1000));
      if (hasConclusion) findings.push({ code: "bundle.hidden-event-conclusion", path: objectPath.join(".") });
    }
  });
  return findings;
}

function graphNodeIds(caseGraph) {
  if (Array.isArray(caseGraph?.nodes)) return caseGraph.nodes.map((node) => node?.caseId || node?.id).filter(Boolean);
  return [];
}

function inferCaseCount(run, manifest, parsedByFile) {
  const campaign = parsedByFile.get("campaign-report.json");
  const quality = parsedByFile.get("quality-report.json");
  const causal = parsedByFile.get("causal-metrics.json");
  return Number(
    valueAtPath(campaign, ["report", "metrics", "caseCount"]) ??
    valueAtPath(campaign, ["report", "summary", "caseCount"]) ??
    valueAtPath(quality, ["summary", "caseCount"]) ??
    valueAtPath(causal, ["caseCount"]) ??
    valueAtPath(manifest, ["summary", "validCandidateCount"]) ??
    run.metrics?.caseCount ??
    0
  );
}

function inferMetrics(manifest, parsedByFile) {
  const campaign = parsedByFile.get("campaign-report.json");
  const matrix = parsedByFile.get("experiment-comparison-report.json");
  const quality = parsedByFile.get("quality-report.json");
  const causal = parsedByFile.get("causal-metrics.json");
  return {
    caseCount: Number(
      valueAtPath(campaign, ["report", "metrics", "caseCount"]) ??
      valueAtPath(campaign, ["report", "summary", "caseCount"]) ??
      valueAtPath(causal, ["caseCount"]) ??
      0
    ) || undefined,
    uniqueCaseCount: Number(
      valueAtPath(campaign, ["report", "metrics", "uniqueCaseCount"]) ??
      valueAtPath(causal, ["uniqueCaseCount"]) ??
      0
    ) || undefined,
    distinctCaseTypeCount: Number(
      valueAtPath(campaign, ["report", "metrics", "diversity", "distinctCaseTypeCount"]) ??
      valueAtPath(causal, ["diversity", "distinctCaseTypeCount"]) ??
      0
    ) || undefined,
    causalLinkCount: Number(
      valueAtPath(campaign, ["report", "metrics", "causalLinkCount"]) ??
      valueAtPath(quality, ["summary", "averageCausalLinkCount"]) ??
      valueAtPath(causal, ["causalLinkCount"]) ??
      0
    ) || undefined,
    matrixScore: Number(valueAtPath(matrix, ["summary", "matrixScore"]) ?? 0) || undefined,
    matrixRunCount: Number(valueAtPath(matrix, ["summary", "runCount"]) ?? 0) || undefined,
    candidateRepeatRate: Number(
      valueAtPath(campaign, ["report", "metrics", "candidateRepeatRate"]) ??
      valueAtPath(causal, ["candidateRepeatRate"]) ??
      0
    ) || undefined
  };
}

function compactUndefined(value) {
  if (Array.isArray(value)) return value.map(compactUndefined);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, nested] of Object.entries(value)) {
    if (nested !== undefined) out[key] = compactUndefined(nested);
  }
  return out;
}

async function auditRun(storeDir, dirent) {
  const runId = dirent.name;
  const runDir = path.join(storeDir, runId);
  const findings = [];
  const warnings = [];
  const parsedByFile = new Map();
  let manifest = null;
  let normalized = false;

  const manifestPath = path.join(runDir, "manifest.json");
  if (!(await exists(manifestPath))) {
    findings.push(makeFinding("error", "manifest.missing", runId, "manifest.json", "Run artifact directory is missing manifest.json."));
  } else {
    const manifestText = await fs.readFile(manifestPath, "utf8");
    const parsed = safeJsonParse(manifestText);
    if (!parsed.ok) {
      findings.push(makeFinding("error", "manifest.invalid-json", runId, "manifest.json", parsed.error.message));
    } else {
      manifest = parsed.value;
      parsedByFile.set("manifest.json", manifest);
    }
  }

  const physicalFiles = await listPhysicalFiles(runDir);
  const declaredFiles = new Map();
  for (const file of manifest?.files || []) {
    const relativePath = String(file?.path || file?.name || "");
    if (!isSafeRelativePath(relativePath)) {
      findings.push(makeFinding("error", "file.unsafe-path", runId, relativePath, "Manifest file path must be relative and stay inside the run directory."));
      continue;
    }
    const target = fileTarget(runDir, relativePath);
    if (!target) {
      findings.push(makeFinding("error", "file.path-escape", runId, relativePath, "Manifest file path resolves outside the run directory."));
      continue;
    }
    declaredFiles.set(toPosix(relativePath), file);
    if (!(await exists(target))) {
      findings.push(makeFinding("error", "file.missing", runId, toPosix(relativePath), "Manifest lists a file that does not exist."));
    }
  }

  const fileNames = Array.from(new Set([...physicalFiles, ...declaredFiles.keys(), "manifest.json"])).sort((left, right) => left.localeCompare(right));
  const files = [];
  for (const fileName of fileNames) {
    if (!isSafeRelativePath(fileName)) continue;
    const target = fileTarget(runDir, fileName);
    if (!target || !(await exists(target))) continue;
    const hashed = await hashFile(target);
    const declared = declaredFiles.get(toPosix(fileName));
    if (declared?.bytes !== undefined && Number(declared.bytes) !== hashed.bytes) {
      findings.push(makeFinding("warning", "file.bytes-mismatch", runId, toPosix(fileName), `Manifest declares ${declared.bytes} bytes but file has ${hashed.bytes}.`));
      warnings.push(`${fileName} byte count differs from manifest`);
    }
    const indexedFile = {
      name: path.basename(fileName),
      path: toPosix(fileName),
      bytes: hashed.bytes,
      sha256: hashed.sha256,
      declared: Boolean(declared) || fileName === "manifest.json"
    };
    files.push(indexedFile);

    if (hashed.text !== null) {
      for (const rule of SECRET_PATTERNS) {
        if (rule.pattern.test(hashed.text)) {
          findings.push(makeFinding("error", rule.code, runId, toPosix(fileName), "Artifact text contains a secret-looking value or key field."));
        }
      }
      if (JSON_FILE_RE.test(fileName)) {
        const parsed = safeJsonParse(hashed.text);
        if (!parsed.ok) {
          findings.push(makeFinding("error", "file.invalid-json", runId, toPosix(fileName), parsed.error.message));
        } else {
          parsedByFile.set(toPosix(fileName), parsed.value);
          if (["replay-bundle.json", "review-bundle.json"].includes(path.basename(fileName))) {
            for (const forbidden of findForbiddenBundleFields(parsed.value)) {
              findings.push(makeFinding("error", forbidden.code, runId, toPosix(fileName), `Forbidden bundle field at ${forbidden.path}.`));
            }
          }
        }
      }
    }
  }

  if (!manifest?.startedAt && !manifest?.generatedAt) {
    findings.push(makeFinding("warning", "manifest.missing-time", runId, "manifest.json", "Manifest is missing startedAt/generatedAt."));
    warnings.push("manifest missing startedAt/generatedAt");
    normalized = true;
  }
  if (!manifest?.summary) {
    findings.push(makeFinding("warning", "manifest.missing-summary", runId, "manifest.json", "Manifest is missing summary; metrics were inferred when possible."));
    warnings.push("manifest missing summary");
    normalized = true;
  }
  if ((manifest?.files || []).some((file) => file?.bytes === undefined)) {
    findings.push(makeFinding("warning", "manifest.missing-file-bytes", runId, "manifest.json", "Manifest file entries do not include bytes; index computed bytes and sha256."));
    warnings.push("manifest files missing bytes");
    normalized = true;
  }

  const caseGraph = parsedByFile.get("case-graph.json");
  if (caseGraph) {
    const nodeIds = graphNodeIds(caseGraph);
    const uniqueNodeCount = new Set(nodeIds).size;
    if (nodeIds.length !== uniqueNodeCount) {
      findings.push(makeFinding("error", "case-graph.duplicate-case", runId, "case-graph.json", "Case graph contains duplicate case ids."));
    }
    const expectedCaseCount = inferCaseCount({ metrics: {} }, manifest, parsedByFile);
    if (expectedCaseCount && nodeIds.length && nodeIds.length !== expectedCaseCount) {
      findings.push(makeFinding("error", "case-graph.case-count-mismatch", runId, "case-graph.json", `Case graph has ${nodeIds.length} nodes but inferred case count is ${expectedCaseCount}.`));
    }
  }

  const evidenceGraph = parsedByFile.get("evidence-graph.json");
  if (evidenceGraph) {
    const graphWarnings = Array.isArray(evidenceGraph.warnings) ? evidenceGraph.warnings : [];
    if (graphWarnings.length) {
      findings.push(makeFinding("error", "evidence-graph.warnings", runId, "evidence-graph.json", `Evidence graph has ${graphWarnings.length} warning(s).`));
    }
    const incomplete = Array.isArray(evidenceGraph.caseUses) ? evidenceGraph.caseUses.filter((item) => item && item.complete === false) : [];
    if (incomplete.length) {
      findings.push(makeFinding("error", "evidence-graph.incomplete-case", runId, "evidence-graph.json", `Evidence graph has ${incomplete.length} incomplete resolved case(s).`));
    }
  }

  const campaign = parsedByFile.get("campaign-report.json");
  const matrix = parsedByFile.get("experiment-comparison-report.json");
  const quality = parsedByFile.get("quality-report.json");
  const metrics = inferMetrics(manifest || {}, parsedByFile);
  const run = compactUndefined({
    runId: String(manifest?.runId || runId),
    kind: String(manifest?.kind || (matrix ? "experiment-matrix" : campaign ? "campaign" : quality ? "simulation-quality" : "unknown")),
    status: String(manifest?.status || "unknown"),
    startedAt: manifest?.startedAt || manifest?.generatedAt || campaign?.generatedAt || matrix?.generatedAt || quality?.generatedAt,
    finishedAt: manifest?.finishedAt || manifest?.generatedAt || campaign?.generatedAt || matrix?.generatedAt || quality?.generatedAt,
    experimentId: manifest?.experimentId || matrix?.experiments?.[0]?.experimentId,
    seed: manifest?.seed || campaign?.seed,
    seeds: manifest?.seeds || quality?.seeds,
    tickCount: manifest?.tickCount || campaign?.tickCount || quality?.gate?.tickCount || matrix?.config?.ticks,
    qualityScore: manifest?.qualityScore ?? matrix?.summary?.matrixScore ?? quality?.summary?.averageCausalLinkCount,
    deterministicRunHash: manifest?.deterministicRunHash || campaign?.report?.metrics?.deterministicRunHash,
    normalized,
    files,
    metrics,
    warnings
  });
  return { run, findings };
}

export async function buildReplayDatasetIndex(input = {}) {
  const storeDir = path.resolve(input.storeDir || path.join(process.cwd(), "data", "replay-store"));
  await fs.mkdir(storeDir, { recursive: true });
  const entries = await fs.readdir(storeDir, { withFileTypes: true });
  const runDirs = entries
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));
  const runs = [];
  const findings = [];
  for (const dirent of runDirs) {
    const result = await auditRun(storeDir, dirent);
    runs.push(result.run);
    findings.push(...result.findings);
  }
  runs.sort((left, right) => String(right.finishedAt || right.startedAt || right.runId).localeCompare(String(left.finishedAt || left.startedAt || left.runId)));
  const errorCount = findings.filter((finding) => finding.severity === "error").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;
  const secretLeakCount = findings.filter((finding) => finding.code.startsWith("secret.")).length;
  const hiddenTruthLeakCount = findings.filter((finding) => finding.code.startsWith("bundle.hidden")).length;
  const byKind = {};
  for (const run of runs) byKind[run.kind] = (byKind[run.kind] || 0) + 1;
  const audit = {
    ok: errorCount === 0,
    checkedRunCount: runs.length,
    errorCount,
    warningCount,
    findings,
    secretLeakCount,
    hiddenTruthLeakCount
  };
  const index = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: input.generatedAt || new Date().toISOString(),
    storeRoot: relativeStoreRoot(storeDir, input.cwd || process.cwd()),
    runs,
    summary: {
      runCount: runs.length,
      byKind,
      completedRunCount: runs.filter((run) => run.status === "completed" || run.status === "passed").length,
      failedRunCount: runs.filter((run) => run.status === "failed" || run.status === "blocked").length,
      indexedFileCount: runs.reduce((sum, run) => sum + run.files.length, 0)
    },
    audit
  };
  return { index, audit, storeDir };
}

export async function writeReplayDatasetIndex(index, storeDir) {
  const target = path.join(storeDir, "index.json");
  await fs.writeFile(target, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  return target;
}
