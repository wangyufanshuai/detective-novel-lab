import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const sourceDir = path.join(root, "packages", "engine", "src");
const runtimeDir = path.join(root, "outputs", `ecosystem-ablation-runtime-${process.pid}`);
const replayStoreDir = path.join(root, "data", "replay-store");

const DOMAINS = {
  dockEconomy: {
    variant: "no-dock-economy",
    resources: ["dock_credit", "merchant_credit"],
    institutions: ["dock_union", "commerce"],
    evidenceKinds: ["cargo-log", "receipt"],
    caseTypes: ["dock-smuggling", "merchant-extortion"],
    eventTags: ["dock", "cargo", "warehouse"]
  },
  courtPressure: {
    variant: "no-court-pressure",
    resources: ["court_docket"],
    institutions: ["court"],
    evidenceKinds: ["court-record", "family-letter"],
    caseTypes: ["court-intimidation", "forged-will", "false-testimony"],
    eventTags: ["court", "record", "custody"]
  },
  medicalRecordChain: {
    variant: "no-medical-record-chain",
    resources: ["medical_capacity"],
    institutions: ["medical"],
    evidenceKinds: ["medical", "autopsy-note", "blood-pattern"],
    caseTypes: ["medical-coverup", "murder"],
    eventTags: ["medical", "autopsy"]
  },
  familyObligation: {
    variant: "no-family-obligation",
    resources: ["family_influence"],
    institutions: ["family"],
    evidenceKinds: ["family-letter", "alibi-note"],
    caseTypes: ["forged-will", "false-testimony", "blackmail"],
    eventTags: ["family", "alibi"]
  }
};

const variants = ["baseline", ...Object.values(DOMAINS).map((domain) => domain.variant)];

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

async function collectTsFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectTsFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
  }));
  return nested.flat();
}

async function compileEngine() {
  await fs.mkdir(runtimeDir, { recursive: true });
  for (const file of await collectTsFiles(sourceDir)) {
    const source = await fs.readFile(file, "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText;
    const relative = path.relative(sourceDir, file).replace(/\.ts$/, ".cjs");
    const target = path.join(runtimeDir, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, compiled.replace(/require\("(\.{1,2}\/.+?)"\)/g, 'require("$1.cjs")'), "utf8");
  }
  return import(pathToFileURL(path.join(runtimeDir, "index.cjs")).href);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function domainForVariant(variant) {
  return Object.values(DOMAINS).find((domain) => domain.variant === variant);
}

function applyDetectiveEcosystem(catalog, engine) {
  const ecosystem = {
    manifest: { id: "detective-ecosystem-benchmark", name: "Detective Ecosystem Benchmark", version: "1.0.0", schemaVersion: "ecosystem-catalog.v1", createdAt: "2026-07-03T00:00:00.000Z" },
    factions: [
      { id: "dock-economy", name: "Dock Economy", institutionKind: "dock_union", pressureBias: 14, resourceBias: { dock_credit: -16, merchant_credit: -8 }, preferredCaseTypes: ["dock-smuggling"] },
      { id: "court-pressure", name: "Court Pressure", institutionKind: "court", pressureBias: 13, resourceBias: { court_docket: -14 }, preferredCaseTypes: ["court-intimidation", "forged-will"] },
      { id: "medical-record-chain", name: "Medical Record Chain", institutionKind: "medical", pressureBias: 10, resourceBias: { medical_capacity: -12 }, preferredCaseTypes: ["medical-coverup"] },
      { id: "family-obligation", name: "Family Obligation", institutionKind: "family", pressureBias: 12, resourceBias: { family_influence: 10 }, preferredCaseTypes: ["forged-will", "blackmail"] }
    ],
    resources: [
      { kind: "dock_credit", label: "Dock Credit", valueDelta: -12, pressureDelta: 12 },
      { kind: "court_docket", label: "Court Docket", valueDelta: -10, pressureDelta: 12 },
      { kind: "medical_capacity", label: "Medical Capacity", valueDelta: -8, pressureDelta: 8 },
      { kind: "family_influence", label: "Family Influence", valueDelta: 8, pressureDelta: 10 },
      { kind: "evidence_integrity", label: "Evidence Integrity", valueDelta: -5, pressureDelta: 5 }
    ],
    markets: [
      { id: "cargo-favors", label: "Cargo Favors", resource: "dock_credit", volatility: 0.35, tags: ["dock", "cargo"] },
      { id: "legal-favors", label: "Legal Favors", resource: "court_docket", volatility: 0.25, tags: ["court", "record"] }
    ],
    territories: [],
    taskTemplates: [
      { id: "trace-cargo-market", label: "Trace cargo market", institutionKind: "dock_union", tags: ["dock", "cargo"], pressureDelta: 10, evidenceKinds: ["cargo-log", "receipt"] },
      { id: "review-docket-pressure", label: "Review docket pressure", institutionKind: "court", tags: ["court", "record"], pressureDelta: 10, evidenceKinds: ["court-record"] },
      { id: "audit-medical-record", label: "Audit medical record", institutionKind: "medical", tags: ["medical", "autopsy"], pressureDelta: 8, evidenceKinds: ["autopsy-note"] },
      { id: "summon-family-obligation", label: "Summon family obligation", institutionKind: "family", tags: ["family", "alibi"], pressureDelta: 8, evidenceKinds: ["family-letter"] }
    ],
    randomWorldEvents: [
      { id: "ecosystem-cargo-shortage", label: "Cargo shortage", weight: 24, tags: ["dock", "cargo"], pressureDelta: 12 },
      { id: "ecosystem-docket-leak", label: "Docket leak", weight: 22, tags: ["court", "record"], pressureDelta: 10 },
      { id: "ecosystem-autopsy-delay", label: "Autopsy delay", weight: 18, tags: ["medical", "autopsy"], pressureDelta: 8 },
      { id: "ecosystem-family-alibi", label: "Family alibi", weight: 20, tags: ["family", "alibi"], pressureDelta: 8 }
    ],
    pressureRules: [
      { id: "ecosystem-dock-pressure", resource: "dock_credit", threshold: 55, effect: "dock-linked smuggling rises" },
      { id: "ecosystem-court-pressure", resource: "court_docket", threshold: 55, effect: "court intimidation rises" },
      { id: "ecosystem-medical-pressure", resource: "medical_capacity", threshold: 50, effect: "medical evidence chain stress rises" },
      { id: "ecosystem-family-pressure", resource: "family_influence", threshold: 60, effect: "family-backed alibis rise" }
    ]
  };
  return engine.applyEcosystemCatalogToRuleCatalog(catalog, ecosystem);
}

function applyVariant(catalog, variant) {
  const next = clone(catalog);
  const domain = domainForVariant(variant);
  if (!domain) return next;
  const resourceSet = new Set(domain.resources);
  const institutionSet = new Set(domain.institutions);
  const tagSet = new Set(domain.eventTags);
  const evidenceSet = new Set(domain.evidenceKinds);
  next.resources = next.resources.map((resource) => resourceSet.has(resource.kind) ? { ...resource, value: 70, pressure: 5 } : resource);
  next.institutions = next.institutions.map((institution) => institutionSet.has(institution.kind) ? { ...institution, resources: 70, pressure: 5, policyPressure: 5, reputation: 55 } : institution);
  next.randomEvents = next.randomEvents.map((event) => event.tags.some((tag) => tagSet.has(tag)) ? { ...event, weight: 0 } : event);
  next.evidenceRules = (next.evidenceRules || []).filter((rule) => !evidenceSet.has(rule.kind));
  return next;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function evidenceDistribution(report) {
  const distribution = {};
  for (const node of report.metrics.evidenceGraph.nodes || []) {
    if (node.kind === "evidence" && node.evidenceKind) distribution[node.evidenceKind] = (distribution[node.evidenceKind] || 0) + 1;
  }
  return distribution;
}

function domainMetrics(report, catalog) {
  const caseDistribution = report.metrics.diversity.caseTypeDistribution || {};
  const evidence = evidenceDistribution(report);
  const result = {
    distinctCaseTypeCount: report.metrics.diversity.distinctCaseTypeCount,
    crossCaseInfluenceCount: report.metrics.diversity.crossCaseInfluenceCount,
    causalLinkCount: report.metrics.causalLinkCount,
    evidenceGraphWarnings: report.metrics.evidenceGraph.warnings.length
  };
  for (const [domainName, domain] of Object.entries(DOMAINS)) {
    const resourceSet = new Set(domain.resources);
    const institutionSet = new Set(domain.institutions);
    result[`${domainName}CaseCount`] = sum(domain.caseTypes.map((caseType) => caseDistribution[caseType]));
    result[`${domainName}EvidenceCount`] = sum(domain.evidenceKinds.map((kind) => evidence[kind]));
    result[`${domainName}ResourceSignal`] = sum(catalog.resources.filter((resource) => resourceSet.has(resource.kind)).map((resource) => resource.value + resource.pressure));
    result[`${domainName}InstitutionPressure`] = sum(catalog.institutions.filter((institution) => institutionSet.has(institution.kind)).map((institution) => institution.pressure + institution.policyPressure));
    result[`${domainName}RandomEventWeight`] = sum(catalog.randomEvents.filter((event) => event.tags.some((tag) => domain.eventTags.includes(tag))).map((event) => event.weight));
    result[`${domainName}EvidenceRuleCount`] = (catalog.evidenceRules || []).filter((rule) => domain.evidenceKinds.includes(rule.kind)).length;
  }
  return result;
}

function aggregate(runs) {
  const result = {};
  for (const run of runs) {
    for (const [key, value] of Object.entries(run.metrics)) result[key] = (result[key] || 0) + Number(value || 0);
  }
  return result;
}

function relativeChange(baseline, variant) {
  const denominator = Math.max(Math.abs(Number(baseline || 0)), 1);
  return Math.round((Math.abs(Number(variant || 0) - Number(baseline || 0)) / denominator) * 100);
}

function compareVariant(baselineMetrics, variant, metrics, threshold) {
  const deltas = Object.fromEntries(
    Array.from(new Set([...Object.keys(baselineMetrics), ...Object.keys(metrics)]))
      .map((key) => [key, relativeChange(baselineMetrics[key], metrics[key])])
  );
  const changedMetrics = Object.entries(deltas)
    .filter(([, change]) => change >= threshold)
    .map(([metric, change]) => ({ metric, change }))
    .sort((left, right) => right.change - left.change);
  return {
    variant,
    changed: changedMetrics.length >= 3,
    changedMetricCount: changedMetrics.length,
    strongestMetric: changedMetrics[0]?.metric || "none",
    relativeChange: changedMetrics[0]?.change || 0,
    changedMetrics: changedMetrics.slice(0, 12),
    metricDeltas: deltas
  };
}

function markdown(report) {
  const lines = [
    "# Ecosystem Ablation Benchmark",
    "",
    `Generated: ${report.generatedAt}`,
    `Ticks: ${report.tickCount}`,
    `Seeds: ${report.seeds.join(", ")}`,
    `Passed: ${report.ok ? "yes" : "no"}`,
    "",
    "| Variant | Changed | Changed metrics | Strongest metric | Relative change |",
    "| --- | --- | ---: | --- | ---: |"
  ];
  for (const delta of report.variantDeltas) {
    lines.push(`| ${delta.variant} | ${delta.changed ? "yes" : "no"} | ${delta.changedMetricCount} | ${delta.strongestMetric} | ${delta.relativeChange}% |`);
  }
  lines.push("", "## Aggregate Metrics", "", "```json", JSON.stringify(report.aggregateMetrics, null, 2), "```");
  if (report.errors.length) lines.push("", "## Errors", "", ...report.errors.map((error) => `- ${error}`));
  return `${lines.join("\n")}\n`;
}

async function writeArtifacts(report) {
  const runId = `ecosystem-ablation-${report.tickCount}-${report.seeds.join("-")}`.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
  const runDir = path.join(replayStoreDir, runId);
  await fs.mkdir(runDir, { recursive: true });
  const files = ["ecosystem-ablation-report.json", "ecosystem-ablation-report.md", "variant-deltas.json", "ecosystem-metrics.json"];
  const manifest = {
    runId,
    kind: "ecosystem-ablation",
    status: report.ok ? "completed" : "failed",
    engineVersion: "persistent-town.ecosystem-ablation.v1",
    startedAt: report.generatedAt,
    finishedAt: report.generatedAt,
    tickCount: report.tickCount,
    qualityScore: report.variantDeltas.filter((delta) => delta.changed).length,
    summary: {
      branchCount: report.variants.length,
      snapshotCount: 0,
      eventGrowth: 0,
      memoryGrowth: 0,
      validCandidateCount: report.variantDeltas.filter((delta) => delta.changed).length,
      blockedCandidateCount: report.variantDeltas.filter((delta) => !delta.changed).length
    },
    files: files.map((name) => ({ name, path: name }))
  };
  await fs.writeFile(path.join(runDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(runDir, files[0]), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(runDir, files[1]), markdown(report), "utf8");
  await fs.writeFile(path.join(runDir, files[2]), `${JSON.stringify(report.variantDeltas, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(runDir, files[3]), `${JSON.stringify(report.aggregateMetrics, null, 2)}\n`, "utf8");
  return { runId, runDir };
}

const tickCount = Number(argValue("ticks", process.env.ECOSYSTEM_ABLATION_TICKS || "100"));
const seeds = argValue("seeds", process.env.ECOSYSTEM_ABLATION_SEEDS || "ecosystem-a,ecosystem-b,ecosystem-c").split(",").map((seed) => seed.trim()).filter(Boolean);
const threshold = Number(argValue("threshold", process.env.ECOSYSTEM_ABLATION_THRESHOLD || "20"));
const minimumCaseCount = Number(argValue("minimum-cases", String(tickCount >= 1000 ? 8 : tickCount >= 500 ? 5 : 3)));
const engine = await compileEngine();
const runs = Object.fromEntries(variants.map((variant) => [variant, []]));

for (const seed of seeds) {
  const world = engine.createInitialWorld(seed, { mode: "advanced", npcCount: 24, timelineHours: 96 });
  const scenarioPack = engine.createScenarioPackFromWorld(world, {
    id: `ecosystem-ablation-${seed}`,
    name: `Ecosystem ablation ${seed}`,
    seed,
    baselineSteps: 2,
    passCriteria: { minEventGrowth: 1, minMemoryGrowth: 1 }
  });
  const mapPack = engine.createTownMapPackFromWorld(world);
  const baseCatalog = applyDetectiveEcosystem(engine.createDefaultTownRuleCatalog(world, 0), engine);
  for (const variant of variants) {
    const catalog = applyVariant(baseCatalog, variant);
    const validation = engine.validateTownRuleCatalog(catalog);
    assert.equal(validation.ok, true, `${variant} catalog validates: ${validation.errors.join("; ")}`);
    const simulation = engine.runMultiCaseSimulation({
      seed,
      tickCount,
      minimumCaseCount,
      scenarioPack,
      mapPack,
      ruleCatalog: catalog,
      npcCount: 24,
      timelineHours: 96
    });
    runs[variant].push({
      seed,
      ok: simulation.ok,
      errors: simulation.errors,
      summary: simulation.summary,
      metrics: domainMetrics(simulation, catalog),
      deterministicRunHash: simulation.metrics.deterministicRunHash
    });
  }
}

const aggregateMetrics = Object.fromEntries(variants.map((variant) => [variant, aggregate(runs[variant])]));
const variantDeltas = variants.filter((variant) => variant !== "baseline").map((variant) => compareVariant(aggregateMetrics.baseline, variant, aggregateMetrics[variant], threshold));
const errors = [
  ...runs.baseline.filter((run) => !run.ok).map((run) => `baseline ${run.seed} failed: ${run.errors.join("; ")}`),
  ...variantDeltas.filter((delta) => !delta.changed).map((delta) => `${delta.variant} changed ${delta.changedMetricCount}/3 required metrics; strongest ${delta.strongestMetric}=${delta.relativeChange}%`),
  aggregateMetrics.baseline.evidenceGraphWarnings > 0 ? `baseline evidence graph warnings ${aggregateMetrics.baseline.evidenceGraphWarnings}` : ""
].filter(Boolean);

const report = {
  generatedAt: new Date().toISOString(),
  ok: errors.length === 0,
  tickCount,
  minimumCaseCount,
  seeds,
  variants,
  threshold,
  runs,
  aggregateMetrics,
  variantDeltas,
  errors
};
const artifact = await writeArtifacts(report);

console.log(JSON.stringify({
  ok: report.ok,
  ticks: tickCount,
  seeds,
  variants: variants.length,
  changedVariants: `${variantDeltas.filter((delta) => delta.changed).length}/${variantDeltas.length}`,
  artifactRunId: artifact.runId,
  errors
}, null, 2));

for (const delta of variantDeltas) assert.equal(delta.changed, true, `${delta.variant} changes at least three ecosystem metrics`);
assert.equal(report.ok, true, errors.join("; "));
