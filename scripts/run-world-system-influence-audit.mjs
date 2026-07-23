import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const sourceDir = path.join(root, "packages", "engine", "src");
const outputDir = path.join(root, "outputs");
const runtimeDir = path.join(outputDir, `world-system-influence-audit-runtime-${process.pid}`);
const reportJsonPath = path.join(outputDir, "world-system-influence-audit.json");
const reportMdPath = path.join(outputDir, "world-system-influence-audit.md");
const contentRoot = path.join(root, "content", "detective-v1");

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function argValue(name, fallback = "") {
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

async function readContentJson(name) {
  return JSON.parse(await fs.readFile(path.join(contentRoot, name), "utf8"));
}

async function loadContentPack() {
  return {
    manifest: await readContentJson("manifest.json"),
    caseTypes: await readContentJson("case-types.json"),
    locations: await readContentJson("locations.json"),
    roles: await readContentJson("roles.json"),
    motives: await readContentJson("motives.json"),
    evidenceTypes: await readContentJson("evidence-types.json"),
    redHerringPatterns: await readContentJson("red-herring-patterns.json"),
    escalationRules: await readContentJson("escalation-rules.json"),
    resources: await readContentJson("resources.json"),
    factions: await readContentJson("factions.json"),
    eventArchetypes: await readContentJson("event-archetypes.json"),
    progressionLines: await readContentJson("progression-lines.json")
  };
}

function markdownReport(report) {
  const actionDelta = Object.entries(report.aggregate.actionKindDelta)
    .map(([kind, delta]) => `| ${kind} | ${delta} |`)
    .join("\n");
  const seedRows = report.seeds
    .map((seed) => `| ${seed.seed} | ${seed.hinted.appliedBiasCount} | ${seed.hinted.maxBias} | ${seed.hinted.hintedActionShare}% | ${seed.delta.validCandidateTrendDelta} | ${seed.deterministicHash} |`)
    .join("\n");
  return [
    "# World-System Influence Audit",
    "",
    `Schema: \`${report.schemaVersion}\``,
    `Generated: ${report.generatedAt}`,
    `Status: ${report.ok ? "ok" : "failed"}`,
    "",
    "## Aggregate",
    "",
    `- Seeds: ${report.seedCount}`,
    `- Ticks: ${report.tickCount}`,
    `- Applied bias count: ${report.aggregate.appliedBiasCount}`,
    `- Max bias: ${report.aggregate.maxBias}`,
    `- Hinted action share: ${report.aggregate.hintedActionShare}%`,
    `- Institution label coverage: ${report.aggregate.institutionLabelCoverage}%`,
    `- Valid candidate trend delta: ${report.aggregate.validCandidateTrendDelta}`,
    `- Runtime: ${report.aggregate.runtimeMs} ms`,
    "",
    "## Safety",
    "",
    `- Max bias <= 4: ${report.safety.maxBiasOk ? "pass" : "fail"}`,
    `- No legal candidate loss: ${report.safety.noLegalCandidateLoss ? "pass" : "fail"}`,
    `- Deterministic hash: ${report.safety.deterministicHashOk ? "pass" : "fail"}`,
    `- Public-safe aggregate: ${report.safety.publicSafe ? "pass" : "fail"}`,
    "",
    "## Action Delta",
    "",
    "| Action kind | Hinted minus baseline |",
    "| --- | ---: |",
    actionDelta || "| none | 0 |",
    "",
    "## Seeds",
    "",
    "| Seed | Applied bias | Max bias | Hinted action share | Valid candidate delta | Hash |",
    "| --- | ---: | ---: | ---: | ---: | --- |",
    seedRows
  ].join("\n");
}

const json = hasFlag("json");
const tickCount = Number(argValue("ticks", "120"));
const seeds = argValue("seeds", "hint-audit-a,hint-audit-b,hint-audit-c")
  .split(",")
  .map((seed) => seed.trim())
  .filter(Boolean);

try {
  const engine = await compileEngine();
  const contentPack = await loadContentPack();
  const report = engine.runWorldSystemInfluenceAudit({
    seeds,
    tickCount,
    contentPack
  });
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(reportJsonPath, JSON.stringify(report, null, 2), "utf8");
  await fs.writeFile(reportMdPath, markdownReport(report), "utf8");
  const result = {
    ok: report.ok,
    reportPath: path.relative(root, reportJsonPath).replace(/\\/g, "/"),
    markdownPath: path.relative(root, reportMdPath).replace(/\\/g, "/"),
    summary: {
      seedCount: report.seedCount,
      tickCount: report.tickCount,
      appliedBiasCount: report.aggregate.appliedBiasCount,
      maxBias: report.aggregate.maxBias,
      hintedActionShare: report.aggregate.hintedActionShare,
      institutionLabelCoverage: report.aggregate.institutionLabelCoverage,
      validCandidateTrendDelta: report.aggregate.validCandidateTrendDelta,
      safety: report.safety
    }
  };
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`World-system influence audit: ${result.ok ? "ok" : "failed"}`);
    console.log(`Report: ${result.reportPath}`);
    console.log(`Markdown: ${result.markdownPath}`);
    console.log(`Applied bias: ${result.summary.appliedBiasCount}; max bias: ${result.summary.maxBias}; hinted action share: ${result.summary.hintedActionShare}%`);
  }
  if (!report.ok) process.exitCode = 1;
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  if (json) console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  else console.error(message);
  process.exitCode = 1;
}
