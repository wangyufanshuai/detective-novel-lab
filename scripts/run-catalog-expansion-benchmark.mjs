import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const sourceDir = path.join(root, "packages", "engine", "src");
const runtimeDir = path.join(root, "outputs", `catalog-expansion-runtime-${process.pid}`);
const replayStoreDir = path.join(root, "data", "replay-store");

const DOMAINS = {
  court: {
    variants: ["no-court"],
    actions: ["hold-inquest", "cross-examine-witness", "review-court-record"],
    evidenceKinds: ["court-record", "family-letter", "key-impression"],
    caseTypes: ["court-intimidation", "forged-will", "false-testimony"],
    resources: ["court_docket"],
    institutions: ["court"],
    randomTags: ["court", "record", "custody"]
  },
  dock: {
    variants: ["no-dock-union"],
    actions: ["trace-cargo", "bribe-dockhand", "inspect-warehouse"],
    evidenceKinds: ["cargo-log", "receipt"],
    caseTypes: ["dock-smuggling", "merchant-extortion"],
    resources: ["dock_credit"],
    institutions: ["dock_union"],
    randomTags: ["dock", "cargo", "warehouse"]
  },
  medical: {
    variants: ["no-medical-chain"],
    actions: ["conduct-autopsy", "seal-autopsy-record", "second-medical-opinion"],
    evidenceKinds: ["medical", "autopsy-note", "blood-pattern"],
    caseTypes: ["medical-coverup", "murder"],
    resources: ["medical_capacity"],
    institutions: ["medical"],
    randomTags: ["medical", "autopsy"]
  },
  informant: {
    variants: ["no-informant-network"],
    actions: ["cultivate-informant", "verify-anonymous-tip"],
    evidenceKinds: ["anonymous-tip"],
    caseTypes: ["blackmail", "witness-disappearance"],
    resources: ["informant_trust"],
    institutions: [],
    randomTags: ["informant", "tip"]
  }
};

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
  return Object.entries(DOMAINS).find(([, domain]) => domain.variants.includes(variant))?.[0];
}

function disableActions(catalog, actionKinds) {
  const disabled = new Set(actionKinds);
  catalog.longActionDefinitions = catalog.longActionDefinitions.map((action) => disabled.has(action.kind)
    ? {
        ...action,
        resourceCosts: {},
        institutionDeltas: {},
        publicOpinionDelta: {},
        evidenceContaminationDelta: 0
      }
    : action);
}

function applyCatalogVariant(baseCatalog, variant) {
  const catalog = clone(baseCatalog);
  const domainName = domainForVariant(variant);
  if (!domainName) return catalog;
  const domain = DOMAINS[domainName];
  const resourceSet = new Set(domain.resources);
  const institutionSet = new Set(domain.institutions);
  const evidenceSet = new Set(domain.evidenceKinds);
  const randomTagSet = new Set(domain.randomTags);

  catalog.resources = catalog.resources.map((resource) => resourceSet.has(resource.kind)
    ? { ...resource, value: 0, pressure: 0 }
    : resource);
  catalog.institutions = catalog.institutions.map((institution) => institutionSet.has(institution.kind)
    ? { ...institution, resources: 0, reputation: 50, pressure: 0, policyPressure: 0 }
    : institution);
  catalog.professions = catalog.professions.map((profession) => {
    if (variant === "no-court" && profession.institutionId === "inst-court") return { ...profession, institutionId: "inst-civic" };
    if (variant === "no-dock-union" && profession.institutionId === "inst-dock-union") return { ...profession, institutionId: "inst-commerce" };
    if (variant === "no-medical-chain" && profession.institutionId === "inst-medical") return { ...profession, institutionId: "inst-civic" };
    if (variant === "no-informant-network" && profession.kind === "informant") return { ...profession, kind: "servant", institutionId: "inst-family" };
    return profession;
  });
  disableActions(catalog, domain.actions);
  catalog.evidenceRules = (catalog.evidenceRules || []).filter((rule) => !evidenceSet.has(rule.kind));
  catalog.randomEvents = catalog.randomEvents.map((event) => event.tags.some((tag) => randomTagSet.has(tag))
    ? { ...event, weight: 0 }
    : event);
  return catalog;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function evidenceKindDistribution(report) {
  const distribution = {};
  for (const node of report.metrics.evidenceGraph.nodes || []) {
    if (node.kind === "evidence" && node.evidenceKind) distribution[node.evidenceKind] = (distribution[node.evidenceKind] || 0) + 1;
  }
  return distribution;
}

function enabledActionCount(catalog, actionKinds) {
  const actionSet = new Set(actionKinds);
  return catalog.longActionDefinitions.filter((action) => {
    if (!actionSet.has(action.kind)) return false;
    return Object.keys(action.resourceCosts || {}).length > 0 ||
      Object.keys(action.institutionDeltas || {}).length > 0 ||
      Object.keys(action.publicOpinionDelta || {}).length > 0 ||
      action.evidenceContaminationDelta !== 0;
  }).length;
}

function evidenceRuleCount(catalog, evidenceKinds) {
  const evidenceSet = new Set(evidenceKinds);
  return (catalog.evidenceRules || []).filter((rule) => evidenceSet.has(rule.kind)).length;
}

function caseTypeSupportCount(catalog, caseTypes) {
  const caseSet = new Set(caseTypes);
  return new Set((catalog.evidenceRules || []).flatMap((rule) => rule.relatedCaseTypes || []).filter((caseType) => caseSet.has(caseType))).size;
}

function resourceValue(catalog, resourceKinds) {
  const resourceSet = new Set(resourceKinds);
  return sum(catalog.resources.filter((resource) => resourceSet.has(resource.kind)).map((resource) => resource.value + resource.pressure));
}

function domainMetrics(report, catalog) {
  const caseDistribution = report.metrics.diversity.caseTypeDistribution || {};
  const evidenceDistribution = evidenceKindDistribution(report);
  const longActionIds = report.cases.flatMap((item) => item.longActionIds || []);
  const result = {
    distinctCaseTypeCount: report.metrics.diversity.distinctCaseTypeCount,
    causalLinkCount: report.metrics.causalLinkCount,
    evidenceGraphWarnings: report.metrics.evidenceGraph.warnings.length
  };
  for (const [domainName, domain] of Object.entries(DOMAINS)) {
    result[`${domainName}CaseCount`] = sum(domain.caseTypes.map((caseType) => caseDistribution[caseType]));
    result[`${domainName}EvidenceCount`] = sum(domain.evidenceKinds.map((kind) => evidenceDistribution[kind]));
    result[`${domainName}LongActionInfluenceCount`] = longActionIds.filter((id) => domain.actions.some((action) => id.includes(action))).length;
    result[`${domainName}EnabledActionCount`] = enabledActionCount(catalog, domain.actions);
    result[`${domainName}EvidenceRuleCount`] = evidenceRuleCount(catalog, domain.evidenceKinds);
    result[`${domainName}CaseTypeSupportCount`] = caseTypeSupportCount(catalog, domain.caseTypes);
    result[`${domainName}ResourceSignal`] = resourceValue(catalog, domain.resources);
  }
  return result;
}

function aggregateMetricRuns(runs) {
  const aggregate = {};
  for (const run of runs) {
    for (const [key, value] of Object.entries(run.metrics)) aggregate[key] = (aggregate[key] || 0) + Number(value || 0);
  }
  return aggregate;
}

function relativeChange(baseline, variant) {
  const denominator = Math.max(Math.abs(Number(baseline || 0)), 1);
  return Math.round((Math.abs(Number(variant || 0) - Number(baseline || 0)) / denominator) * 100);
}

function compareVariant(baselineMetrics, variant, metrics, threshold) {
  const metricDeltas = Object.fromEntries(
    Array.from(new Set([...Object.keys(baselineMetrics), ...Object.keys(metrics)]))
      .map((key) => [key, relativeChange(baselineMetrics[key], metrics[key])])
  );
  const changedMetrics = Object.entries(metricDeltas)
    .filter(([, value]) => value >= threshold)
    .map(([metric, change]) => ({ metric, change }))
    .sort((left, right) => right.change - left.change);
  return {
    variant,
    changed: changedMetrics.length >= 3,
    changedMetricCount: changedMetrics.length,
    strongestMetric: changedMetrics[0]?.metric || "none",
    relativeChange: changedMetrics[0]?.change || 0,
    changedMetrics: changedMetrics.slice(0, 12),
    metricDeltas
  };
}

function renderMarkdown(report) {
  const lines = [
    "# Catalog Expansion Benchmark",
    "",
    `Generated: ${report.generatedAt}`,
    `Ticks: ${report.tickCount}`,
    `Seeds: ${report.seeds.join(", ")}`,
    `Threshold: ${report.threshold}%`,
    `Passed: ${report.ok ? "yes" : "no"}`,
    "",
    "| Variant | Changed | Changed metrics | Strongest metric | Relative change |",
    "| --- | --- | ---: | --- | ---: |"
  ];
  for (const delta of report.variantDeltas) {
    lines.push(`| ${delta.variant} | ${delta.changed ? "yes" : "no"} | ${delta.changedMetricCount} | ${delta.strongestMetric} | ${delta.relativeChange}% |`);
  }
  lines.push("", "## Domain Metrics", "", "```json", JSON.stringify(report.aggregateMetrics, null, 2), "```");
  if (report.errors.length) lines.push("", "## Errors", "", ...report.errors.map((error) => `- ${error}`));
  return `${lines.join("\n")}\n`;
}

async function writeArtifacts(report, markdown) {
  const runId = `catalog-expansion-${report.tickCount}-${report.seeds.join("-")}`.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
  const runDir = path.join(replayStoreDir, runId);
  await fs.mkdir(runDir, { recursive: true });
  const files = [
    "catalog-expansion-report.json",
    "catalog-expansion-report.md",
    "variant-deltas.json",
    "causal-metrics.json"
  ];
  const manifest = {
    runId,
    kind: "catalog-expansion",
    status: report.ok ? "completed" : "failed",
    engineVersion: "persistent-town.catalog-expansion.v1",
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
  await fs.writeFile(path.join(runDir, files[1]), markdown, "utf8");
  await fs.writeFile(path.join(runDir, files[2]), `${JSON.stringify(report.variantDeltas, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(runDir, files[3]), `${JSON.stringify(report.aggregateMetrics, null, 2)}\n`, "utf8");
  return { runId, runDir };
}

const tickCount = Number(argValue("ticks", process.env.CATALOG_EXPANSION_TICKS || "100"));
const seeds = argValue("seeds", process.env.CATALOG_EXPANSION_SEEDS || "catalog-a,catalog-b,catalog-c").split(",").map((seed) => seed.trim()).filter(Boolean);
const threshold = Number(argValue("threshold", process.env.CATALOG_EXPANSION_THRESHOLD || "20"));
const variants = ["baseline", "no-court", "no-dock-union", "no-medical-chain", "no-informant-network"];
const minimumCaseCount = Number(argValue("minimum-cases", String(tickCount >= 1000 ? 8 : tickCount >= 500 ? 5 : 3)));
const engine = await compileEngine();

const runs = {};
for (const variant of variants) runs[variant] = [];

for (const seed of seeds) {
  const world = engine.createInitialWorld(seed, { mode: "advanced", npcCount: 24, timelineHours: 96 });
  const scenarioPack = engine.createScenarioPackFromWorld(world, {
    id: `catalog-expansion-${seed}`,
    name: `Catalog expansion ${seed}`,
    seed,
    baselineSteps: 2,
    passCriteria: { minEventGrowth: 1, minMemoryGrowth: 1 }
  });
  const mapPack = engine.createTownMapPackFromWorld(world);
  const baseCatalog = engine.createDefaultTownRuleCatalog(world, 0);
  for (const variant of variants) {
    const catalog = applyCatalogVariant(baseCatalog, variant);
    const validation = engine.validateTownRuleCatalog(catalog);
    assert.equal(validation.ok, true, `${variant} catalog validates: ${validation.errors.join("; ")}`);
    const report = engine.runMultiCaseSimulation({
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
      ok: report.ok,
      errors: report.errors,
      summary: report.summary,
      metrics: domainMetrics(report, catalog),
      deterministicRunHash: report.metrics.deterministicRunHash
    });
  }
}

const aggregateMetrics = Object.fromEntries(variants.map((variant) => [variant, aggregateMetricRuns(runs[variant])]));
const variantDeltas = variants
  .filter((variant) => variant !== "baseline")
  .map((variant) => compareVariant(aggregateMetrics.baseline, variant, aggregateMetrics[variant], threshold));
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
const markdown = renderMarkdown(report);
const artifact = await writeArtifacts(report, markdown);

console.log(JSON.stringify({
  ok: report.ok,
  ticks: tickCount,
  seeds,
  variants: variants.length,
  changedVariants: `${variantDeltas.filter((delta) => delta.changed).length}/${variantDeltas.length}`,
  artifactRunId: artifact.runId,
  errors
}, null, 2));

for (const delta of variantDeltas) assert.equal(delta.changed, true, `${delta.variant} changes at least three catalog metrics`);
assert.equal(report.ok, true, errors.join("; "));
