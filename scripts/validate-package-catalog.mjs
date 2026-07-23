import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildPackageCatalogIndex, exportWorldPackage, readWorldPackageDirectory, readWorldPackageSource, validateWorldPackageFiles, writePackageCatalogIndex } from "../lib/world-package-catalog.ts";
import { worldRepository, closeDatabase } from "../lib/world/repository.ts";

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const packageId = argValue("package");
const packagePath = argValue("path");
const rootArg = argValue("root", process.cwd());
const jsonOnly = hasFlag("json");

if (packageId || packagePath) {
  const source = packagePath ? readWorldPackageDirectory(path.resolve(packagePath), rootArg) : readWorldPackageSource(packageId, rootArg);
  const label = packageId || packagePath;
  const output = source
    ? {
        ok: source.validation.ok,
        packageId: source.packageId || label,
        relativePath: source.relativePath,
        contentHash: source.contentHash,
        fileCount: source.fileCount,
        bytes: source.bytes,
        validation: {
          ok: source.validation.ok,
          errors: source.validation.errors,
          warnings: source.validation.warnings,
          summary: source.validation.summary
        }
      }
    : { ok: false, packageId: label, error: `WorldPackage ${label} was not found.` };
  if (jsonOnly) {
    console.log(JSON.stringify(output, null, 2));
  } else if (output.ok) {
    console.log(`WorldPackage validation passed: ${output.packageId}`);
    console.log(`Path: ${output.relativePath}`);
    console.log(`Files: ${output.fileCount}`);
    console.log(`Warnings: ${output.validation.warnings.length}`);
  } else {
    console.error("error" in output ? output.error : output.validation.errors.join("; "));
  }
  closeDatabase();
  process.exit(output.ok ? 0 : 1);
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, value) {
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, value, "utf8");
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "dnl-package-catalog-"));
process.env.DATABASE_URL = path.join(root, "package-catalog.db");

const location = { id: "square", name: "Square", kind: "public", description: "Public review square.", connectedLocationIds: ["court"], x: 0, y: 0 };
const court = { id: "court", name: "Court", kind: "work", description: "Docket pressure.", connectedLocationIds: ["square"], x: 1, y: 0 };
const npc = { id: "npc-1", name: "Ada", role: "detective", homeLocationId: "square", schedule: { "08:00": "square" }, relationships: {}, secret: "Keeps a public note.", motiveSeed: "procedure", skills: ["detective"], memoryEventIds: [], liePolicy: "direct", alive: true };
const scenarioPack = {
  manifest: { id: "fixture-world", name: "Fixture World", version: "1.0.0", schemaVersion: "scenario-pack.v1", createdAt: "2026-07-03T00:00:00.000Z", entrypoint: "scenario.json" },
  world: { seed: "fixture-world", mode: "advanced", timelineHours: 24, locations: [location, court], npcs: [npc], institutions: [], professions: [] },
  rules: { enabledModules: ["institutions"], phaseConfig: { snapshotEveryTicks: 1, maxRunningLongActions: 4 }, thresholds: { maxEvidenceContamination: 80, maxPublicOpinionHeat: 80, minInstitutionTrust: 30 }, longActionKinds: ["review-court-record"] },
  scenario: { id: "fixture-world", name: "Fixture World", seed: "fixture-world", worldOptions: { mode: "advanced", npcCount: 1, timelineHours: 24 }, baselineSteps: 2, branches: [], passCriteria: { minValidCandidates: 0, minEventGrowth: 0, minMemoryGrowth: 0 } },
  expectations: { minValidCandidates: 0, minEvidenceCoverage: 50, maxEvidenceContamination: 80, maxPublicOpinionHeat: 80 },
  assets: {},
  docs: {}
};
const mapPack = {
  manifest: { id: "fixture-map", name: "Fixture Map", version: "1.0.0", schemaVersion: "town-map-pack.v1", createdAt: "2026-07-03T00:00:00.000Z", entrypoint: "map.json" },
  locations: [location, court],
  connections: [{ from: "square", to: "court", kind: "street", travelMinutes: 5 }],
  interactions: [{ id: "review-docket", locationId: "court", kind: "work", label: "Review docket", risk: 20, tags: ["court"] }],
  spawnPoints: [{ id: "spawn-1", locationId: "square", roleHint: "detective", weight: 80 }],
  assets: {},
  docs: {}
};
const ruleCatalog = {
  id: "fixture-rules",
  name: "Fixture Rules",
  version: "1.0.0",
  resources: [
    { kind: "police_time", label: "Police Time", value: 60, capacity: 100, pressure: 30 },
    { kind: "media_attention", label: "Media Attention", value: 50, capacity: 100, pressure: 30 },
    { kind: "family_influence", label: "Family Influence", value: 50, capacity: 100, pressure: 30 },
    { kind: "merchant_credit", label: "Merchant Credit", value: 50, capacity: 100, pressure: 30 },
    { kind: "medical_capacity", label: "Medical Capacity", value: 50, capacity: 100, pressure: 30 },
    { kind: "evidence_integrity", label: "Evidence Integrity", value: 90, capacity: 100, pressure: 10 }
  ],
  institutions: [{ id: "inst-police", name: "Police", kind: "police", resources: 60, reputation: 60, pressure: 30, agenda: "review", influenceByLocation: { square: 50 }, trustByNpcId: { "npc-1": 70 }, activeCaseIds: [], policyPressure: 30 }],
  professions: [{ npcId: "npc-1", kind: "detective", institutionId: "inst-police", rank: 1, skills: ["detective"], income: 40, workload: 40 }],
  longActionDefinitions: [{ kind: "review-court-record", label: "Review court record", durationTicks: 2, resourceCosts: { police_time: 1 }, institutionDeltas: { "inst-police": { pressure: -1 } }, publicOpinionDelta: {}, evidenceContaminationDelta: -1 }],
  randomEvents: [{ id: "fixture-event", label: "Fixture event", weight: 1, tags: ["court"] }],
  casePressureRules: [{ id: "fixture-pressure", resource: "police_time", threshold: 50, effect: "fixture" }],
  evidenceRules: [{ id: "fixture-evidence", kind: "court-record", weakContaminationThreshold: 60, strongProvenanceIntegrityFloor: 50, relatedCaseTypes: ["court-intimidation"] }]
};
const agentPack = { manifest: { id: "fixture-agents", name: "Fixture Agents", version: "1.0.0", schemaVersion: "agent-pack.v1", createdAt: "2026-07-03T00:00:00.000Z" }, agents: [{ ...npc, profession: "detective", publicMotive: "procedure", visibleClues: ["public docket gap"], resourceNeeds: { police_time: 2 } }] };
const ecosystem = {
  manifest: { id: "fixture-ecosystem", name: "Fixture Ecosystem", version: "1.0.0", schemaVersion: "ecosystem-catalog.v1", createdAt: "2026-07-03T00:00:00.000Z" },
  factions: [{ id: "court-faction", name: "Court", institutionKind: "police", pressureBias: 5, resourceBias: { police_time: -5 }, preferredCaseTypes: ["court-intimidation"] }],
  resources: [{ kind: "police_time", label: "Police Time", valueDelta: -5, pressureDelta: 5 }],
  markets: [{ id: "legal-favors", label: "Legal Favors", resource: "police_time", volatility: 0.2, tags: ["court"] }],
  territories: [{ id: "court-territory", locationId: "court", factionId: "court-faction", influence: 70, tags: ["court"] }],
  taskTemplates: [{ id: "review-record", label: "Review record", institutionKind: "police", tags: ["court"], pressureDelta: 5, evidenceKinds: ["court-record"] }],
  randomWorldEvents: [{ id: "docket-gap", label: "Docket gap", weight: 2, tags: ["court"], pressureDelta: 5 }],
  pressureRules: [{ id: "docket-pressure", resource: "police_time", threshold: 55, effect: "court pressure" }]
};

const worldPackDir = path.join(root, "world-packs", "fixture-world");
writeJson(path.join(worldPackDir, "manifest.json"), { id: "fixture-world", name: "Fixture World", version: "1.0.0", schemaVersion: "world-package.v1", createdAt: "2026-07-03T00:00:00.000Z", license: "project-local", scenarioPackPath: "scenario-pack.json", mapPackPath: "map-pack.json", ruleCatalogPath: "rule-catalog.json", agentPackPath: "agent-pack.json", ecosystemCatalogPath: "ecosystem-catalog.json", expectationsPath: "expectations.json" });
writeJson(path.join(worldPackDir, "scenario-pack.json"), scenarioPack);
writeJson(path.join(worldPackDir, "map-pack.json"), mapPack);
writeJson(path.join(worldPackDir, "rule-catalog.json"), ruleCatalog);
writeJson(path.join(worldPackDir, "agent-pack.json"), agentPack);
writeJson(path.join(worldPackDir, "ecosystem-catalog.json"), ecosystem);
writeJson(path.join(worldPackDir, "expectations.json"), { minValidCandidates: 0 });
writeText(path.join(worldPackDir, "README.md"), "# Fixture World\n");

const nonLocalPack = validateWorldPackageFiles({
  "manifest.json": { id: "license-warning", name: "License Warning", version: "1.0.0", schemaVersion: "world-package.v1", createdAt: "2026-07-03T00:00:00.000Z", license: "cc-by-4.0", scenarioPackPath: "scenario-pack.json", mapPackPath: "map-pack.json", ruleCatalogPath: "rule-catalog.json", agentPackPath: "agent-pack.json", ecosystemCatalogPath: "ecosystem-catalog.json", expectationsPath: "expectations.json" },
  "scenario-pack.json": scenarioPack,
  "map-pack.json": mapPack,
  "rule-catalog.json": ruleCatalog,
  "agent-pack.json": agentPack,
  "ecosystem-catalog.json": ecosystem,
  "expectations.json": { minValidCandidates: 0 },
  "README.md": "# License Warning\n"
});
assert.equal(nonLocalPack.ok, true, "non-project-local package remains usable locally");
assert.equal(nonLocalPack.warnings.some((warning) => warning.includes("ATTRIBUTION.md")), true, "non-project-local package warns when attribution is missing");

const projectLocalOriginalPack = validateWorldPackageFiles({
  "manifest.json": { id: "project-local-original", name: "Project Local Original", version: "1.0.0", schemaVersion: "world-package.v1", createdAt: "2026-07-03T00:00:00.000Z", license: "project-local-original", scenarioPackPath: "scenario-pack.json", mapPackPath: "map-pack.json", ruleCatalogPath: "rule-catalog.json", agentPackPath: "agent-pack.json", ecosystemCatalogPath: "ecosystem-catalog.json", expectationsPath: "expectations.json" },
  "scenario-pack.json": scenarioPack,
  "map-pack.json": mapPack,
  "rule-catalog.json": ruleCatalog,
  "agent-pack.json": agentPack,
  "ecosystem-catalog.json": ecosystem,
  "expectations.json": { minValidCandidates: 0 },
  "README.md": "# Project Local Original\n"
});
assert.equal(projectLocalOriginalPack.warnings.some((warning) => warning.includes("ATTRIBUTION.md")), false, "project-local* license does not require attribution warning");

const unsafePack = validateWorldPackageFiles({
  "manifest.json": { id: "unsafe", name: "Unsafe", version: "1.0.0", schemaVersion: "world-package.v1", createdAt: "2026-07-03T00:00:00.000Z", license: "project-local", scenarioPackPath: "scenario-pack.json", mapPackPath: "map-pack.json", ruleCatalogPath: "rule-catalog.json", agentPackPath: "agent-pack.json", ecosystemCatalogPath: "ecosystem-catalog.json", expectationsPath: "expectations.json" },
  "scenario-pack.json": { ...scenarioPack, apiKey: "not-real" },
  "map-pack.json": mapPack,
  "rule-catalog.json": ruleCatalog,
  "agent-pack.json": agentPack,
  "ecosystem-catalog.json": ecosystem,
  "expectations.json": { minValidCandidates: 0 },
  "README.md": "# Unsafe\n"
});
assert.equal(unsafePack.ok, false, "world package validator rejects API-key-like fields");

const badDir = path.join(root, "world-packs", "bad-world");
writeJson(path.join(badDir, "manifest.json"), { id: "bad-world", name: "Bad World", version: "1.0.0", schemaVersion: "world-package.v1", license: "project-local", scenarioPackPath: "scenario-pack.json", mapPackPath: "map-pack.json", ruleCatalogPath: "rule-catalog.json", agentPackPath: "agent-pack.json", ecosystemCatalogPath: "ecosystem-catalog.json", expectationsPath: "expectations.json" });
writeJson(path.join(badDir, "scenario-pack.json"), { leak: { truth: { culpritId: "npc-1" } } });

const index = buildPackageCatalogIndex(root);
const outPath = writePackageCatalogIndex(index, path.join(root, "data", "package-catalog", "index.json"));
assert.equal(fs.existsSync(outPath), true, "package index is written");
assert.equal(index.summary.packageCount, 2, "valid and invalid package directories are indexed");
assert.equal(index.summary.validPackageCount, 1, "valid fixture package passes");
assert.equal(index.summary.invalidPackageCount, 1, "bad fixture package fails");
assert.equal(index.packages.find((entry) => entry.packageId === "fixture-world").metrics.agentCount, 1, "agent metrics are indexed");
assert.equal(index.packages.find((entry) => entry.packageId === "bad-world").validation.errors.some((error) => error.includes("hidden truth")), true, "hidden truth leak is rejected");

const exportReport = exportWorldPackage({ packageId: "fixture-world", root });
assert.equal(exportReport.reportIncluded, false, "export report makes report-file count semantics explicit");
assert.equal(exportReport.fileCount, 8, "export file count covers package source files only");
assert.equal(exportReport.files.some((file) => file.path === "package-export-report.json"), false, "export file list excludes the generated report file");
assert.equal(fs.existsSync(path.join(root, exportReport.relativeExportPath, exportReport.reportPath)), true, "export report file is written beside package source files");
assert.equal(JSON.stringify(exportReport).includes(root), false, "export metadata does not include absolute workspace paths");
assert.throws(
  () => exportWorldPackage({ packageId: "fixture-world", root, outRoot: path.join(root, "outputs", "elsewhere") }),
  /outputs\/world-package-exports/,
  "package export rejects output roots outside outputs/world-package-exports"
);

const sync = worldRepository.syncPackageCatalogIndex(index);
assert.equal(sync.syncedPackageCount, 2, "sync writes both package rows");
worldRepository.syncPackageCatalogIndex(index);
assert.equal(worldRepository.storageHealth().counts.packages, 2, "package sync is idempotent");
const list = worldRepository.listPackageCatalog({ kind: "world-package" });
assert.equal(list.total, 2, "list endpoint repository filter works");
const detail = worldRepository.getPackageCatalogEntry("fixture-world");
assert.equal(detail.package.scenarioPackId, "fixture-world", "detail exposes metadata only");
assert.equal(JSON.stringify(detail).includes("public docket gap"), false, "detail does not expose package body text");
assert.throws(
  () => worldRepository.syncPackageCatalogIndex({ ...index, packages: [{ ...index.packages[0], relativePath: "../escape" }] }),
  /relativePath/,
  "package sync rejects traversal paths"
);
closeDatabase();

console.log("Package catalog validation tests passed.");
