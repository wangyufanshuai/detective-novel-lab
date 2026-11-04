import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { PackageCatalogEntry, PackageCatalogIndex } from "./package-catalog-types.ts";
import { validateWorldAssetManifest, type WorldAssetManifest } from "../packages/engine/src/world-asset-manifest.ts";

type ExperimentFolderFiles = Record<string, unknown>;
export type WorldPackageFiles = Record<string, unknown>;

type ValidationResult<T = unknown> = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  summary: Record<string, unknown>;
  package?: T;
  hash?: string;
  manifest?: Record<string, unknown>;
  scenarioPack?: Record<string, unknown>;
  mapPack?: Record<string, unknown>;
  ruleCatalog?: Record<string, unknown>;
  experimentId?: string;
  assetManifest?: WorldAssetManifest;
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function createStablePackHash(value: unknown) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function parseMaybeJson(value: unknown, fileName: string, errors: string[]) {
  if (typeof value !== "string") return value;
  if (fileName.endsWith(".md")) return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    errors.push(`${fileName} is not valid JSON`);
    return null;
  }
}

function hasAbsolutePath(value: string) {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("/") || value.startsWith("\\\\");
}

function scanUnsafe(value: unknown, label = "$", errors: string[] = []) {
  if (typeof value === "string") {
    if (
      /\bsk-[A-Za-z0-9][A-Za-z0-9_-]{12,}\b/.test(value) ||
      /authorization:\s*bearer/i.test(value) ||
      /"(?:apiKey|api_key|secretKey|token)"\s*:/i.test(value) ||
      /\.env\.local/i.test(value)
    ) {
      errors.push(`${label} may contain a secret`);
    }
    if (hasAbsolutePath(value)) errors.push(`${label} contains an absolute path`);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => scanUnsafe(item, `${label}[${index}]`, errors));
  } else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      const nextLabel = `${label}.${key}`;
      if (/api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token/i.test(key)) errors.push(`${nextLabel} may contain a secret`);
      if (["runtime", "snapshot", "checkpoint", "benchmarkLatest", "hiddenDebugLog", "agent_state_snapshot"].includes(key)) {
        errors.push(`${nextLabel} contains runtime-only state`);
      }
      if (key === "truth" || key === "culpritId") errors.push(`${nextLabel} may contain hidden truth`);
      scanUnsafe(nested, nextLabel, errors);
    }
  }
  return errors;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function getManifestId(value: unknown) {
  const manifest = asRecord(asRecord(value)?.manifest);
  return typeof manifest?.id === "string" ? manifest.id : undefined;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function validateScenarioPackLike(value: unknown) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const pack = asRecord(value);
  const manifest = asRecord(pack?.manifest);
  if (!pack) errors.push("scenario-pack.json must be an object");
  if (manifest?.schemaVersion !== "scenario-pack.v1") errors.push("scenario-pack manifest.schemaVersion must be scenario-pack.v1");
  if (!manifest?.id) errors.push("scenario-pack manifest.id is required");
  if (!asRecord(pack?.world)) errors.push("scenario-pack world is required");
  if (!asRecord(pack?.scenario)) warnings.push("scenario-pack scenario metadata is missing");
  return { ok: errors.length === 0, errors, warnings, summary: { packId: typeof manifest?.id === "string" ? manifest.id : undefined } };
}

function validateMapPackLike(value: unknown) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const pack = asRecord(value);
  const manifest = asRecord(pack?.manifest);
  if (!pack) errors.push("map-pack.json must be an object");
  if (manifest?.schemaVersion !== "town-map-pack.v1") errors.push("map-pack manifest.schemaVersion must be town-map-pack.v1");
  if (!manifest?.id) errors.push("map-pack manifest.id is required");
  if (!Array.isArray(pack?.locations)) errors.push("map-pack locations must be an array");
  return { ok: errors.length === 0, errors, warnings, summary: { packId: typeof manifest?.id === "string" ? manifest.id : undefined } };
}

function validateRuleCatalogLike(value: unknown) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const catalog = asRecord(value);
  if (!catalog) errors.push("rule-catalog.json must be an object");
  if (!catalog?.id) errors.push("rule-catalog id is required");
  for (const key of ["resources", "institutions", "professions", "longActionDefinitions", "randomEvents", "casePressureRules"]) {
    if (!Array.isArray(catalog?.[key])) errors.push(`rule-catalog ${key} must be an array`);
  }
  if (!Array.isArray(catalog?.evidenceRules)) warnings.push("rule-catalog evidenceRules missing; legacy catalog will be normalized at runtime");
  return { ok: errors.length === 0, errors, warnings, summary: { catalogId: typeof catalog?.id === "string" ? catalog.id : undefined } };
}

function validateAgentPackLike(value: unknown) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const pack = asRecord(value);
  const manifest = asRecord(pack?.manifest);
  if (!pack) errors.push("agent-pack.json must be an object");
  if (manifest?.schemaVersion !== "agent-pack.v1") errors.push("agent-pack manifest.schemaVersion must be agent-pack.v1");
  if (!manifest?.id) errors.push("agent-pack manifest.id is required");
  if (!Array.isArray(pack?.agents) || pack.agents.length === 0) errors.push("agent-pack agents must not be empty");
  return { ok: errors.length === 0, errors, warnings, summary: { agentPackId: typeof manifest?.id === "string" ? manifest.id : undefined } };
}

function validateEcosystemLike(value: unknown) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const catalog = asRecord(value);
  const manifest = asRecord(catalog?.manifest);
  if (!catalog) errors.push("ecosystem-catalog.json must be an object");
  if (manifest?.schemaVersion !== "ecosystem-catalog.v1") errors.push("ecosystem manifest.schemaVersion must be ecosystem-catalog.v1");
  if (!manifest?.id) errors.push("ecosystem manifest.id is required");
  if (!Array.isArray(catalog?.factions) || catalog.factions.length === 0) errors.push("ecosystem factions must not be empty");
  if (!Array.isArray(catalog?.resources)) warnings.push("ecosystem resources are empty");
  if (!Array.isArray(catalog?.taskTemplates)) warnings.push("ecosystem taskTemplates are empty");
  return { ok: errors.length === 0, errors, warnings, summary: { ecosystemCatalogId: typeof manifest?.id === "string" ? manifest.id : undefined } };
}

function validateExperimentFolderFiles(files: Partial<ExperimentFolderFiles>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const required = ["manifest.json", "steps.json", "scenario-pack.json", "map-pack.json", "rule-catalog.json", "expectations.json", "README.md"];
  for (const fileName of required) if (!(fileName in files)) errors.push(`${fileName} is required`);
  const parsed = Object.fromEntries(Object.entries(files).map(([fileName, value]) => [fileName, parseMaybeJson(value, fileName, errors)]));
  errors.push(...scanUnsafe(parsed));
  const manifest = asRecord(parsed["manifest.json"]);
  if (manifest?.schemaVersion !== "experiment-folder.v1") errors.push("manifest.schemaVersion must be experiment-folder.v1");
  if (!manifest?.id) errors.push("manifest.id is required");
  const scenarioValidation = validateScenarioPackLike(parsed["scenario-pack.json"]);
  const mapValidation = validateMapPackLike(parsed["map-pack.json"]);
  const ruleValidation = validateRuleCatalogLike(parsed["rule-catalog.json"]);
  errors.push(...scenarioValidation.errors.map((error) => `scenario-pack.json: ${error}`));
  errors.push(...mapValidation.errors.map((error) => `map-pack.json: ${error}`));
  errors.push(...ruleValidation.errors.map((error) => `rule-catalog.json: ${error}`));
  warnings.push(...scenarioValidation.warnings, ...mapValidation.warnings, ...ruleValidation.warnings);
  const ok = errors.length === 0;
  return {
    ok,
    errors: Array.from(new Set(errors)),
    warnings: Array.from(new Set(warnings)),
    summary: {},
    manifest: manifest || undefined,
    experimentId: typeof manifest?.id === "string" ? manifest.id : undefined,
    scenarioPack: asRecord(parsed["scenario-pack.json"]) || undefined,
    mapPack: asRecord(parsed["map-pack.json"]) || undefined,
    ruleCatalog: asRecord(parsed["rule-catalog.json"]) || undefined,
    hash: ok ? createStablePackHash(parsed) : undefined
  };
}

export function validateWorldPackageFiles(files: Partial<WorldPackageFiles>) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const required = ["manifest.json", "scenario-pack.json", "map-pack.json", "rule-catalog.json", "agent-pack.json", "ecosystem-catalog.json", "expectations.json", "README.md"];
  for (const fileName of required) if (!(fileName in files)) errors.push(`${fileName} is required`);
  const parsed = Object.fromEntries(Object.entries(files).map(([fileName, value]) => [fileName, parseMaybeJson(value, fileName, errors)]));
  errors.push(...scanUnsafe(parsed));
  const manifest = asRecord(parsed["manifest.json"]);
  if (manifest?.schemaVersion !== "world-package.v1") errors.push("manifest.schemaVersion must be world-package.v1");
  if (!manifest?.id) errors.push("manifest.id is required");
  if (!manifest?.license) errors.push("manifest.license is required");
  if (manifest?.license && typeof manifest.license === "string" && !manifest.license.startsWith("project-local") && !("ATTRIBUTION.md" in files)) {
    warnings.push("ATTRIBUTION.md is recommended for non-project-local package licenses");
  }
  for (const [key, expected] of Object.entries({
    scenarioPackPath: "scenario-pack.json",
    mapPackPath: "map-pack.json",
    ruleCatalogPath: "rule-catalog.json",
    agentPackPath: "agent-pack.json",
    ecosystemCatalogPath: "ecosystem-catalog.json",
    expectationsPath: "expectations.json"
  })) {
    if (manifest?.[key] !== expected) errors.push(`manifest.${key} must be ${expected}`);
  }
  const scenarioValidation = validateScenarioPackLike(parsed["scenario-pack.json"]);
  const mapValidation = validateMapPackLike(parsed["map-pack.json"]);
  const ruleValidation = validateRuleCatalogLike(parsed["rule-catalog.json"]);
  const agentValidation = validateAgentPackLike(parsed["agent-pack.json"]);
  const ecosystemValidation = validateEcosystemLike(parsed["ecosystem-catalog.json"]);
  let assetManifest: WorldAssetManifest | undefined;
  if (manifest?.assetManifestPath && !("asset-manifest.json" in parsed)) {
    errors.push("manifest.assetManifestPath points to missing asset-manifest.json");
  }
  if ("asset-manifest.json" in parsed) {
    if (manifest?.assetManifestPath !== "asset-manifest.json") errors.push("manifest.assetManifestPath must be asset-manifest.json when asset-manifest.json is present");
    const assetValidation = validateWorldAssetManifest(parsed["asset-manifest.json"], typeof manifest?.id === "string" ? manifest.id : undefined);
    if (!assetValidation.ok) errors.push(...assetValidation.errors.map((error) => `asset-manifest.json: ${error}`));
    assetManifest = assetValidation.manifest || undefined;
  }
  errors.push(...scenarioValidation.errors.map((error) => `scenario-pack.json: ${error}`));
  errors.push(...mapValidation.errors.map((error) => `map-pack.json: ${error}`));
  errors.push(...ruleValidation.errors.map((error) => `rule-catalog.json: ${error}`));
  errors.push(...agentValidation.errors.map((error) => `agent-pack.json: ${error}`));
  errors.push(...ecosystemValidation.errors.map((error) => `ecosystem-catalog.json: ${error}`));
  warnings.push(...scenarioValidation.warnings, ...mapValidation.warnings, ...ruleValidation.warnings, ...agentValidation.warnings, ...ecosystemValidation.warnings);
  const uniqueErrors = Array.from(new Set(errors));
  const ok = uniqueErrors.length === 0;
  const worldPackage = ok ? {
    manifest,
    scenarioPack: parsed["scenario-pack.json"],
    mapPack: parsed["map-pack.json"],
    ruleCatalog: parsed["rule-catalog.json"],
    agentPack: parsed["agent-pack.json"],
    ecosystemCatalog: parsed["ecosystem-catalog.json"],
    expectations: parsed["expectations.json"],
    ...(assetManifest ? { assetManifest } : {})
  } : undefined;
  const agentPack = asRecord(parsed["agent-pack.json"]);
  const ecosystem = asRecord(parsed["ecosystem-catalog.json"]);
  return {
    ok,
    errors: uniqueErrors,
    warnings: Array.from(new Set(warnings)),
    summary: {
      packageId: typeof manifest?.id === "string" ? manifest.id : undefined,
      scenarioPackId: String(scenarioValidation.summary.packId || ""),
      mapPackId: String(mapValidation.summary.packId || ""),
      ruleCatalogId: String(ruleValidation.summary.catalogId || ""),
      agentPackId: getManifestId(agentPack),
      ecosystemCatalogId: getManifestId(ecosystem),
      agentCount: Array.isArray(agentPack?.agents) ? agentPack.agents.length : 0,
      factionCount: Array.isArray(ecosystem?.factions) ? ecosystem.factions.length : 0,
      resourceCount: Array.isArray(ecosystem?.resources) ? ecosystem.resources.length : 0,
      taskTemplateCount: Array.isArray(ecosystem?.taskTemplates) ? ecosystem.taskTemplates.length : 0,
      randomWorldEventCount: Array.isArray(ecosystem?.randomWorldEvents) ? ecosystem.randomWorldEvents.length : 0,
      assetCount: assetManifest?.assets.length || 0
    },
    package: worldPackage,
    hash: ok ? createStablePackHash(worldPackage) : undefined
  };
}

const EXPERIMENT_FILES = [
  "manifest.json",
  "steps.json",
  "scenario-pack.json",
  "map-pack.json",
  "rule-catalog.json",
  "expectations.json",
  "README.md"
] as const;

const WORLD_PACKAGE_FILES = [
  "manifest.json",
  "scenario-pack.json",
  "map-pack.json",
  "rule-catalog.json",
  "agent-pack.json",
  "ecosystem-catalog.json",
  "expectations.json",
  "README.md",
  "ATTRIBUTION.md",
  "asset-manifest.json"
] as const;

export type WorldPackageExportReport = {
  packageId: string;
  exportedAt: string;
  format: "folder";
  reportIncluded: false;
  reportPath: "package-export-report.json";
  relativeExportPath: string;
  sourceRelativePath: string;
  contentHash?: string;
  fileCount: number;
  bytes: number;
  files: Array<{ name: string; path: string; bytes: number; sha256: string }>;
  validation: {
    ok: boolean;
    errors: string[];
    warnings: string[];
    summary: Record<string, unknown>;
  };
};

function workspaceRoot(input?: string) {
  return input ? path.resolve(input) : path.resolve(/*turbopackIgnore: true*/ process.cwd());
}

function workspacePath(root: string, ...segments: string[]) {
  return path.join(/*turbopackIgnore: true*/ root, ...segments);
}

function assertInside(base: string, target: string, message = "Target path must stay inside workspace.") {
  const resolvedBase = path.resolve(base);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedBase, resolvedTarget);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(message);
  return resolvedTarget;
}

function packageCatalogRoot() {
  return workspacePath(workspaceRoot(), "data", "package-catalog");
}

export function packageCatalogIndexPath() {
  return path.join(/*turbopackIgnore: true*/ packageCatalogRoot(), "index.json");
}

function safeDirectoryName(input: string) {
  return input.replace(/[^a-z0-9._-]/gi, "-");
}

function assertSafePackageId(packageId: string) {
  if (!/^[a-z0-9._-]+$/i.test(packageId)) throw new Error("Invalid package id.");
}

function readFiles<T extends Record<string, unknown>>(dir: string, names: readonly string[]) {
  const files: Partial<T> = {};
  const fileReceipts: Array<{ name: string; bytes: number; sha256: string }> = [];
  let bytes = 0;
  const hash = crypto.createHash("sha256");
  let fileCount = 0;
  for (const fileName of names) {
    const fullPath = path.join(/*turbopackIgnore: true*/ dir, fileName);
    if (!fs.existsSync(/*turbopackIgnore: true*/ fullPath)) continue;
    const text = fs.readFileSync(/*turbopackIgnore: true*/ fullPath, "utf8");
    files[fileName as keyof T] = text as T[keyof T];
    const fileBytes = Buffer.byteLength(text, "utf8");
    bytes += fileBytes;
    fileReceipts.push({ name: fileName, bytes: fileBytes, sha256: hashText(text) });
    hash.update(fileName);
    hash.update("\0");
    hash.update(text);
    hash.update("\0");
    fileCount += 1;
  }
  return { files, bytes, fileCount, sha256: hash.digest("hex"), fileReceipts };
}

function relativePackagePath(root: string, dir: string) {
  return path.relative(root, dir).replace(/\\/g, "/");
}

function safeRelativeFromRoot(root: string, target: string) {
  const relative = path.relative(root, target).replace(/\\/g, "/");
  if (!relative || relative.startsWith("../") || relative === ".." || path.isAbsolute(relative)) {
    throw new Error("Target path must stay inside workspace.");
  }
  return relative;
}

function hashText(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export type WorldAssetFileReceipt = {
  id: string;
  name: string;
  path: string;
  bytes: number;
  sha256: string;
};

export function auditWorldAssetManifestFiles(input: {
  manifest: WorldAssetManifest;
  rootDir: string;
}): {
  ok: boolean;
  errors: string[];
  fileReceipts: WorldAssetFileReceipt[];
  bytes: number;
} {
  const errors: string[] = [];
  const fileReceipts: WorldAssetFileReceipt[] = [];
  const controlFiles = new Set<string>(WORLD_PACKAGE_FILES);
  for (const asset of input.manifest.assets) {
    const relativePath = asset.path.replace(/\\/g, "/");
    if (controlFiles.has(relativePath)) {
      errors.push(`asset ${asset.id} path ${relativePath} collides with a WorldPackage control file`);
      continue;
    }
    let target: string;
    try {
      target = assertInside(input.rootDir, path.resolve(input.rootDir, asset.path), "Asset path must stay inside the package root.");
    } catch (error) {
      errors.push(`${asset.id}: ${error instanceof Error ? error.message : "asset path is outside the package root"}`);
      continue;
    }
    if (!fs.existsSync(/*turbopackIgnore: true*/ target)) {
      errors.push(`${asset.id}: declared asset file does not exist at ${relativePath}`);
      continue;
    }
    if (!fs.statSync(/*turbopackIgnore: true*/ target).isFile()) {
      errors.push(`${asset.id}: declared asset path is not a file`);
      continue;
    }
    const bytes = fs.readFileSync(/*turbopackIgnore: true*/ target);
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    if (bytes.byteLength !== asset.bytes) errors.push(`${asset.id}: declared bytes ${asset.bytes} do not match ${bytes.byteLength}`);
    if (sha256 !== asset.sha256) errors.push(`${asset.id}: declared sha256 does not match the file contents`);
    fileReceipts.push({ id: asset.id, name: relativePath, path: relativePath, bytes: bytes.byteLength, sha256 });
  }
  return {
    ok: errors.length === 0,
    errors: Array.from(new Set(errors)),
    fileReceipts,
    bytes: fileReceipts.reduce((sum, file) => sum + file.bytes, 0)
  };
}

function hashFileReceipts(receipts: Array<{ name: string; bytes: number; sha256: string }>) {
  const hash = crypto.createHash("sha256");
  for (const file of [...receipts].sort((left, right) => left.name.localeCompare(right.name))) {
    hash.update(file.name);
    hash.update("\0");
    hash.update(String(file.bytes));
    hash.update("\0");
    hash.update(file.sha256);
    hash.update("\0");
  }
  return hash.digest("hex");
}

function finalizeWorldPackageRead(input: {
  dir: string;
  read: ReturnType<typeof readFiles<WorldPackageFiles>>;
  validation: ReturnType<typeof validateWorldPackageFiles>;
}) {
  const manifest = input.validation.package?.assetManifest;
  const audit = manifest ? auditWorldAssetManifestFiles({ manifest, rootDir: input.dir }) : null;
  const assetReceipts = audit?.fileReceipts || [];
  const fileReceipts = [
    ...input.read.fileReceipts,
    ...assetReceipts.map(({ name, bytes, sha256 }) => ({ name, bytes, sha256 }))
  ];
  const validation = audit && !audit.ok
    ? {
        ...input.validation,
        ok: false,
        errors: Array.from(new Set([...input.validation.errors, ...audit.errors])),
        hash: undefined
      }
    : assetReceipts.length
      ? { ...input.validation, hash: hashFileReceipts(fileReceipts) }
      : input.validation;
  return {
    validation,
    fileReceipts,
    fileCount: fileReceipts.length,
    bytes: input.read.bytes + (audit?.bytes || 0),
    contentHash: validation.hash || input.read.sha256
  };
}

function summarize(packages: PackageCatalogEntry[]): PackageCatalogIndex["summary"] {
  const byKind: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  for (const entry of packages) {
    byKind[entry.kind] = (byKind[entry.kind] || 0) + 1;
    bySource[entry.source] = (bySource[entry.source] || 0) + 1;
  }
  return {
    packageCount: packages.length,
    validPackageCount: packages.filter((entry) => entry.status === "valid").length,
    invalidPackageCount: packages.filter((entry) => entry.status === "invalid").length,
    byKind,
    bySource
  };
}

function experimentEntry(root: string, entryName: string): PackageCatalogEntry {
  const dir = workspacePath(root, "experiments", entryName);
  assertInside(workspacePath(root, "experiments"), dir, "Experiment folder must stay inside experiments.");
  const directoryName = safeDirectoryName(entryName);
  const read = readFiles<ExperimentFolderFiles>(dir, EXPERIMENT_FILES);
  const discovery = validateExperimentFolderFiles(read.files);
  const manifest = discovery.manifest;
  const ruleCatalog = discovery.ruleCatalog;
  const resources = Array.isArray(ruleCatalog?.resources) ? ruleCatalog.resources : [];
  const longActions = Array.isArray(ruleCatalog?.longActionDefinitions) ? ruleCatalog.longActionDefinitions : [];
  return {
    packageId: discovery.experimentId || directoryName,
    kind: "experiment-folder",
    source: "experiments",
    name: stringValue(manifest?.name, discovery.experimentId || directoryName),
    version: stringValue(manifest?.version, "0.0.0"),
    status: discovery.ok ? "valid" : "invalid",
    directoryName,
    relativePath: relativePackagePath(root, dir),
    contentHash: discovery.hash || read.sha256,
    pathHash: createStablePackHash({ source: "experiments", directoryName, files: EXPERIMENT_FILES }),
    license: "project-local",
    scenarioPackId: getManifestId(discovery.scenarioPack),
    mapPackId: getManifestId(discovery.mapPack),
    ruleCatalogId: typeof ruleCatalog?.id === "string" ? ruleCatalog.id : undefined,
    validation: { ok: discovery.ok, errors: discovery.errors, warnings: discovery.warnings },
    metrics: {
      fileCount: read.fileCount,
      bytes: read.bytes,
      resourceCount: resources.length,
      taskTemplateCount: longActions.length
    }
  };
}

function worldPackageEntry(root: string, entryName: string): PackageCatalogEntry {
  const dir = workspacePath(root, "world-packs", entryName);
  assertInside(workspacePath(root, "world-packs"), dir, "WorldPackage folder must stay inside world-packs.");
  const directoryName = safeDirectoryName(entryName);
  const read = readFiles<WorldPackageFiles>(dir, WORLD_PACKAGE_FILES);
  const finalized = finalizeWorldPackageRead({ dir, read, validation: validateWorldPackageFiles(read.files) });
  const validation = finalized.validation;
  const manifest = validation.package?.manifest || (typeof read.files["manifest.json"] === "string" ? safeParseJson(read.files["manifest.json"]) : null);
  const manifestRecord = manifest && typeof manifest === "object" ? manifest as Record<string, unknown> : {};
  return {
    packageId: validation.summary.packageId || String(manifestRecord.id || directoryName),
    kind: "world-package",
    source: "world-packs",
    name: String(manifestRecord.name || validation.summary.packageId || directoryName),
    version: String(manifestRecord.version || "0.0.0"),
    status: validation.ok ? "valid" : "invalid",
    directoryName,
    relativePath: relativePackagePath(root, dir),
    contentHash: finalized.contentHash,
    pathHash: createStablePackHash({ source: "world-packs", directoryName, files: WORLD_PACKAGE_FILES }),
    license: String(manifestRecord.license || "unknown"),
    attribution: fs.existsSync(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ dir, "ATTRIBUTION.md")) ? "ATTRIBUTION.md" : undefined,
    scenarioPackId: validation.summary.scenarioPackId,
    mapPackId: validation.summary.mapPackId,
    ruleCatalogId: validation.summary.ruleCatalogId,
    agentPackId: validation.summary.agentPackId,
    ecosystemCatalogId: validation.summary.ecosystemCatalogId,
    validation: { ok: validation.ok, errors: validation.errors, warnings: validation.warnings },
    metrics: {
      fileCount: finalized.fileCount,
      bytes: finalized.bytes,
      factionCount: validation.summary.factionCount,
      resourceCount: validation.summary.resourceCount,
      taskTemplateCount: validation.summary.taskTemplateCount,
      randomWorldEventCount: validation.summary.randomWorldEventCount,
      agentCount: validation.summary.agentCount
    }
  };
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function listDirectories(dir: string) {
  if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) return [];
  return fs.readdirSync(/*turbopackIgnore: true*/ dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

export function buildPackageCatalogIndex(root = workspaceRoot()): PackageCatalogIndex {
  const resolvedRoot = workspaceRoot(root);
  const packages = [
    ...listDirectories(workspacePath(resolvedRoot, "experiments")).map((entry) => experimentEntry(resolvedRoot, entry)),
    ...listDirectories(workspacePath(resolvedRoot, "world-packs")).map((entry) => worldPackageEntry(resolvedRoot, entry))
  ].sort((left, right) => `${left.kind}:${left.name}`.localeCompare(`${right.kind}:${right.name}`));
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    root: "local-workspace",
    packages,
    summary: summarize(packages)
  };
}

export function writePackageCatalogIndex(index: PackageCatalogIndex, outPath = packageCatalogIndexPath()) {
  fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(outPath), { recursive: true });
  fs.writeFileSync(/*turbopackIgnore: true*/ outPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  return outPath;
}

export function readWorldPackageFiles(packageId: string, root = workspaceRoot()) {
  if (!/^[a-z0-9._-]+$/i.test(packageId)) return null;
  const resolvedRoot = workspaceRoot(root);
  const worldPacksRoot = workspacePath(resolvedRoot, "world-packs");
  const entries = listDirectories(worldPacksRoot);
  const directoryName = entries.find((entry) => entry === packageId);
  if (!directoryName) return null;
  const dir = workspacePath(worldPacksRoot, directoryName);
  const read = readFiles<WorldPackageFiles>(dir, WORLD_PACKAGE_FILES);
  return finalizeWorldPackageRead({ dir, read, validation: validateWorldPackageFiles(read.files) }).validation;
}

export function readWorldPackageSource(packageId: string, root = workspaceRoot()) {
  assertSafePackageId(packageId);
  const resolvedRoot = workspaceRoot(root);
  const worldPacksRoot = workspacePath(resolvedRoot, "world-packs");
  const entries = listDirectories(worldPacksRoot);
  const directoryName = entries.find((entry) => entry === packageId);
  if (!directoryName) return null;
  const dir = workspacePath(worldPacksRoot, directoryName);
  assertInside(worldPacksRoot, dir, "WorldPackage folder must stay inside world-packs.");
  const read = readFiles<WorldPackageFiles>(dir, WORLD_PACKAGE_FILES);
  const finalized = finalizeWorldPackageRead({ dir, read, validation: validateWorldPackageFiles(read.files) });
  const validation = finalized.validation;
  return {
    packageId,
    directoryName,
    dir,
    relativePath: relativePackagePath(resolvedRoot, dir),
    files: read.files,
    fileCount: finalized.fileCount,
    bytes: finalized.bytes,
    fileReceipts: finalized.fileReceipts,
    contentHash: finalized.contentHash,
    validation
  };
}

export function readWorldPackageDirectory(dir: string, root = workspaceRoot()) {
  const resolvedRoot = workspaceRoot(root);
  const resolvedDir = path.resolve(/*turbopackIgnore: true*/ dir);
  const allowedRoots = [
    workspacePath(resolvedRoot, "world-packs"),
    workspacePath(resolvedRoot, "outputs", "world-package-exports")
  ];
  if (!allowedRoots.some((allowedRoot) => {
    const relative = path.relative(allowedRoot, resolvedDir);
    return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
  })) {
    throw new Error("WorldPackage validation path must stay inside world-packs or outputs/world-package-exports.");
  }
  if (!fs.existsSync(/*turbopackIgnore: true*/ resolvedDir) || !fs.statSync(/*turbopackIgnore: true*/ resolvedDir).isDirectory()) return null;
  const directoryName = path.basename(resolvedDir);
  const read = readFiles<WorldPackageFiles>(resolvedDir, WORLD_PACKAGE_FILES);
  const finalized = finalizeWorldPackageRead({ dir: resolvedDir, read, validation: validateWorldPackageFiles(read.files) });
  const validation = finalized.validation;
  const packageId = validation.summary.packageId || directoryName;
  return {
    packageId,
    directoryName,
    dir: resolvedDir,
    relativePath: safeRelativeFromRoot(resolvedRoot, resolvedDir),
    files: read.files,
    fileCount: finalized.fileCount,
    bytes: finalized.bytes,
    fileReceipts: finalized.fileReceipts,
    contentHash: finalized.contentHash,
    validation
  };
}

export function exportWorldPackage(input: {
  packageId: string;
  root?: string;
  outRoot?: string;
  format?: "folder" | "zip";
}): WorldPackageExportReport {
  const root = workspaceRoot(input.root);
  const format = input.format || "folder";
  if (format !== "folder") throw new Error("WorldPackage zip export is not available without adding a zip dependency.");
  const source = readWorldPackageSource(input.packageId, root);
  if (!source) throw new Error(`WorldPackage ${input.packageId} was not found.`);
  if (!source.validation.ok) throw new Error(`WorldPackage ${input.packageId} is invalid: ${source.validation.errors.join("; ")}`);

  const allowedOutputRoot = path.resolve(workspacePath(root, "outputs", "world-package-exports"));
  const outputRoot = input.outRoot || allowedOutputRoot;
  const resolvedOutputRoot = path.resolve(outputRoot);
  const outputRootRelative = path.relative(allowedOutputRoot, resolvedOutputRoot);
  if (outputRootRelative === ".." || outputRootRelative.startsWith(`..${path.sep}`) || path.isAbsolute(outputRootRelative)) {
    throw new Error("Export root must stay inside outputs/world-package-exports.");
  }
  const safeName = safeDirectoryName(input.packageId);
  const outputDir = path.join(/*turbopackIgnore: true*/ resolvedOutputRoot, safeName);
  const relativeExportPath = safeRelativeFromRoot(root, outputDir);
  const outputRelative = path.relative(allowedOutputRoot, path.resolve(/*turbopackIgnore: true*/ outputDir));
  if (outputRelative === ".." || outputRelative.startsWith(`..${path.sep}`) || path.isAbsolute(outputRelative)) {
    throw new Error("Export output path must stay inside outputs/world-package-exports.");
  }

  if (fs.existsSync(/*turbopackIgnore: true*/ outputDir)) fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(/*turbopackIgnore: true*/ outputDir, { recursive: true });

  const copiedFiles: WorldPackageExportReport["files"] = [];
  for (const fileName of WORLD_PACKAGE_FILES) {
    const value = source.files[fileName as keyof WorldPackageFiles];
    if (typeof value !== "string") continue;
    const target = path.join(/*turbopackIgnore: true*/ outputDir, fileName);
    fs.writeFileSync(/*turbopackIgnore: true*/ target, value, "utf8");
    copiedFiles.push({
      name: fileName,
      path: fileName,
      bytes: Buffer.byteLength(value, "utf8"),
      sha256: hashText(value)
    });
  }

  for (const asset of source.validation.package?.assetManifest?.assets || []) {
    const sourceTarget = assertInside(source.dir, path.resolve(source.dir, asset.path), "Asset path must stay inside the WorldPackage source.");
    const target = assertInside(outputDir, path.resolve(outputDir, asset.path), "Asset export path must stay inside the output package.");
    fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(target), { recursive: true });
    fs.copyFileSync(/*turbopackIgnore: true*/ sourceTarget, /*turbopackIgnore: true*/ target);
    const bytes = fs.readFileSync(/*turbopackIgnore: true*/ sourceTarget);
    copiedFiles.push({
      name: asset.path.replace(/\\/g, "/"),
      path: asset.path.replace(/\\/g, "/"),
      bytes: bytes.byteLength,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex")
    });
  }

  const report: WorldPackageExportReport = {
    packageId: input.packageId,
    exportedAt: new Date().toISOString(),
    format,
    reportIncluded: false,
    reportPath: "package-export-report.json",
    relativeExportPath,
    sourceRelativePath: source.relativePath,
    contentHash: source.contentHash,
    fileCount: copiedFiles.length,
    bytes: copiedFiles.reduce((sum, file) => sum + file.bytes, 0),
    files: copiedFiles,
    validation: {
      ok: source.validation.ok,
      errors: source.validation.errors,
      warnings: source.validation.warnings,
      summary: source.validation.summary
    }
  };
  const reportJson = `${JSON.stringify(report, null, 2)}\n`;
  fs.writeFileSync(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ outputDir, "package-export-report.json"), reportJson, "utf8");
  return report;
}
