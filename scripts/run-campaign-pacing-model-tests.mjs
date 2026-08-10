import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const sourceDir = path.join(root, "packages", "engine", "src");
const runtimeDir = path.join(root, "outputs", "campaign-pacing-test-runtime");

async function collectTsFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTsFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
  }))).flat();
}

await fs.mkdir(runtimeDir, { recursive: true });
for (const file of await collectTsFiles(sourceDir)) {
  const source = await fs.readFile(file, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText.replace(/require\("(\.{1,2}\/.*?)"\)/g, 'require("$1.cjs")');
  const target = path.join(runtimeDir, path.relative(sourceDir, file).replace(/\.ts$/, ".cjs"));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, output, "utf8");
}

const modelSourcePath = path.join(root, "app", "campaign", "campaign-pacing-model.ts");
const modelSource = await fs.readFile(modelSourcePath, "utf8");
const modelOutput = ts.transpileModule(modelSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText.replace('require("@/lib/engine")', 'require("./index.cjs")');
const modelOutputPath = path.join(runtimeDir, "campaign-pacing-model.cjs");
await fs.writeFile(modelOutputPath, modelOutput, "utf8");

const engine = await import(`${pathToFileURL(path.join(runtimeDir, "index.cjs")).href}?engine=${Date.now()}`);
const model = await import(`${pathToFileURL(modelOutputPath).href}?model=${Date.now()}`);
const matrixBefore = structuredClone(engine.listDetectiveCampaignDefinitions());
const matrix = model.buildCampaignPacingValueMatrix();

assert.equal(matrix.length, 18, "the content-value matrix covers all eighteen authored route treatments");
assert.deepEqual(model.deriveCampaignValueMatrix(), matrix, "the exported matrix alias is deterministic");
assert.deepEqual(engine.listDetectiveCampaignDefinitions(), matrixBefore, "matrix derivation does not mutate the engine catalog");

const campaigns = new Set();
const routes = new Map();
for (const entry of matrix) {
  campaigns.add(entry.campaignLabel);
  const routeKey = `${entry.campaignLabel} / ${entry.routeLabel}`;
  const rows = routes.get(routeKey) || [];
  rows.push(entry);
  routes.set(routeKey, rows);
  for (const field of ["routeLabel", "publicHook", "primarySurface", "consequenceLabel", "whyNow", "whatChanges", "nextCaseHint", "replayContrast", "leadFocusLabel"]) {
    assert.equal(Boolean(entry[field]), true, `${entry.campaignLabel} ${entry.chapterLabel} exposes ${field}`);
  }
}
assert.equal(campaigns.size, 3, "the matrix retains three distinct public campaigns");
assert.equal(routes.size, 6, "the matrix exposes six public authored routes");
for (const [routeLabel, entries] of routes) {
  assert.deepEqual(entries.map((entry) => entry.chapterOrdinal), [1, 2, 3], `${routeLabel} keeps the three-chapter order`);
  assert.equal(new Set(entries.map((entry) => entry.publicHook)).size, 3, `${routeLabel} does not repeat a public hook`);
  assert.equal(new Set(entries.map((entry) => entry.primarySurface)).size, 3, `${routeLabel} does not repeat a primary world surface`);
  assert.equal(new Set(entries.map((entry) => entry.consequenceLabel)).size, 3, `${routeLabel} does not repeat a consequence label`);
  assert.deepEqual([...new Set(entries.map((entry) => entry.leadFocusLabel))].sort(), ["Challenge", "Question", "Search"], `${routeLabel} uses all existing certified emphases without adding an action`);
}

for (const entry of matrix) {
  const campaign = {
    status: entry.chapterOrdinal === 3 ? "finale-active" : "case-active",
    campaignLabel: entry.campaignLabel,
    routeLabel: entry.routeLabel,
    routeStrategyLabel: "Safe authored route context",
    themeLabel: "Public campaign context",
    chapterLabel: `Case ${entry.chapterOrdinal}`,
    chapterObjective: entry.publicHook,
    evidenceThemeLabel: "certified evidence",
    worldSurfaceLabel: entry.primarySurface,
    progressLabel: `${entry.chapterOrdinal - 1}/3 campaign cases closed`,
    primaryActionLabel: entry.leadFocusLabel === "Search" ? "Search the public scene" : entry.leadFocusLabel === "Question" ? "Question a public witness" : "Challenge the certified account",
    consequenceLabels: [],
    replayLabel: entry.replayContrast,
    nextAction: "Continue the existing certified route."
  };
  const input = {
    runtimeMode: "server",
    campaign,
    currentAction: { status: "active", label: campaign.primaryActionLabel, detail: campaign.chapterObjective, nextAction: campaign.nextAction },
    signals: [{ kind: "lead", status: "followed", label: "World Lead", detail: "A bounded public context is active.", nextAction: "Continue the certified route." }],
    consequence: { status: "active", headline: "Public context active", summary: entry.consequenceLabel, nextAction: entry.nextCaseHint },
    hasCase: true,
    busy: false
  };
  const before = structuredClone(input);
  const first = model.deriveCampaignPacingViewModel(input);
  const second = model.deriveCampaignPacingViewModel(structuredClone(input));
  assert.deepEqual(first, second, `${entry.campaignLabel} ${entry.chapterLabel} pacing is deterministic`);
  assert.deepEqual(input, before, `${entry.campaignLabel} ${entry.chapterLabel} input remains unchanged`);
  assert.equal(first.primaryAction?.primary, true, `${entry.campaignLabel} ${entry.chapterLabel} exposes one current action`);
  assert.equal(first.secondaryActions.length <= 3, true, `${entry.campaignLabel} ${entry.chapterLabel} caps secondary guidance at three`);
  assert.equal(first.value.chapterOrdinal, entry.chapterOrdinal, `${entry.campaignLabel} ${entry.chapterLabel} resolves the matching value row`);
  assert.match(first.safeForecast.unchangedAuthority, /truth.*evidence.*certified route.*judgement.*NPC legal actions/i, `${entry.campaignLabel} ${entry.chapterLabel} declares the fairness boundary`);
}

const fallback = model.deriveCampaignPacingViewModel({ runtimeMode: "server", hasCase: false });
assert.equal(Boolean(fallback.currentObjective.label && fallback.whyNow && fallback.nextAction), true, "missing runtime summaries use a deterministic safe fallback");
assert.equal(fallback.primaryAction?.primary, true, "server fallback retains one safe current action");
const waiting = model.deriveCampaignPacingViewModel({ runtimeMode: "server", signals: [{ kind: "recovery", status: "ready", nextAction: "Choose the visible recovery." }] });
const advancing = model.deriveCampaignPacingViewModel({ runtimeMode: "server", signals: [{ kind: "directive", status: "running", nextAction: "Advance the existing operation." }] });
const settled = model.deriveCampaignPacingViewModel({ runtimeMode: "server", campaign: { ...fallback.value, status: "completed", campaignLabel: fallback.campaignLabel, themeLabel: "Safe", chapterLabel: "Campaign complete", chapterObjective: "Review the result.", evidenceThemeLabel: "Safe", worldSurfaceLabel: "Safe", progressLabel: "3/3 campaign cases closed", primaryActionLabel: "Review", consequenceLabels: [], replayLabel: "Replay", nextAction: "Start another route." } });
assert.equal(waiting.status, "waiting-choice", "ready world work enters waiting-choice");
assert.equal(advancing.status, "advancing", "running world work enters advancing");
assert.equal(settled.status, "settled", "completed campaign enters settled");
assert.equal(settled.primaryAction, undefined, "settled campaign creates no new action");

const staticView = model.deriveCampaignPacingViewModel({ runtimeMode: "static-demo" });
assert.equal(staticView.primaryAction, undefined, "Static pacing remains read-only");
assert.deepEqual(staticView.secondaryActions.map((action) => action.kind), ["fairness"], "Static exposes only the fair-play explanation");

const publicJson = JSON.stringify({ matrix, fallback, waiting, advancing, settled, staticView });
assert.equal(/\b(?:campaignId|routeId|packageId|caseTypeId|worldId|caseId|sessionId|npcId|locationId|sourceId|eventId|culpritId|victimId|hiddenTruth|rawBody|checkpoint|sqlite)\b/i.test(publicJson), false, "pacing output contains no internal authority or storage fields");
assert.equal(/\b(?:case|npc|event|source|location|institution|resource|evidence|session|world)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(publicJson), false, "pacing output contains no raw identifier-shaped values");

for (const relative of [
  "app/campaign/campaign-pacing-model.ts",
  "app/components/WorldCampaignPanel.tsx",
  "app/components/InvestigationRouteReviewSurface.tsx",
  "app/components/InvestigationDebriefReplaySurface.tsx"
]) {
  const source = await fs.readFile(path.join(root, relative), "utf8");
  assert.doesNotMatch(source, /\bfetch\s*\(|\bpostV1\s*\(|\bpostJson\s*\(/, `${relative} cannot issue a request`);
}
assert.doesNotMatch(modelSource, /\/api\//, "the pure pacing model contains no API path");
assert.doesNotMatch(modelSource, /localStorage|sessionStorage|indexedDB/, "the pure pacing model cannot write browser storage");

const authority = { truth: { culpritId: "hidden" }, evidenceCoverage: 7, routeCertificate: "certified", judgement: "pending", npcLegalActions: ["move", "work"] };
const authorityBefore = structuredClone(authority);
model.deriveCampaignPacingViewModel({ runtimeMode: "server", campaign: undefined, currentAction: { label: "Continue" } });
assert.deepEqual(authority, authorityBefore, "pacing derivation cannot mutate detached authority state");

console.log(JSON.stringify({
  ok: true,
  suite: "campaign-pacing-model",
  campaigns: [...campaigns],
  routes: [...routes.keys()],
  cases: matrix.length,
  checks: ["eighteen-treatment-matrix", "six-authored-routes", "content-contrast", "determinism", "non-mutation", "safe-fallback", "single-primary", "secondary-cap", "status-lifecycle", "static-boundary", "request-free", "storage-free", "public-safe", "authority-isolation"]
}));
