import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const sourceDir = path.join(root, "packages", "engine", "src");
const runtimeDir = path.join(root, "outputs", "authored-campaign-case-runtime");

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
const engine = await import(`${pathToFileURL(path.join(runtimeDir, "index.cjs")).href}?authored=${Date.now()}`);
const definitions = engine.listAuthoredCampaignCaseDefinitions();
assert.equal(definitions.length, 24, "four Campaigns expose exactly twenty-four authored route treatments");
for (const campaignId of ["town-reckoning", "harbor-testimony", "clinic-headlines", "midnight-chorus"]) {
  const campaignCases = definitions.filter((item) => item.campaignId === campaignId);
  assert.equal(campaignCases.length, 6, `${campaignId} has two complete authored routes`);
  for (const routeId of ["baseline", "counter-route"]) {
    const routeCases = campaignCases.filter((item) => item.routeId === routeId);
    assert.deepEqual(routeCases.map((item) => item.ordinal), [1, 2, 3], `${campaignId}/${routeId} has opening, escalation, and finale treatments`);
    assert.deepEqual([...new Set(routeCases.map((item) => item.leadFocus))].sort(), ["challenge", "question", "search"], `${campaignId}/${routeId} uses all three World Lead verbs`);
  }
  assert.notDeepEqual(campaignCases.filter((item) => item.routeId === "baseline").map((item) => item.leadFocus), campaignCases.filter((item) => item.routeId === "counter-route").map((item) => item.leadFocus), `${campaignId} counter route changes the Search / Question / Challenge rhythm`);
}
assert.equal(new Set(definitions.filter((item) => item.ordinal === 3).map((item) => item.caseFamily)).size, 8, "eight route finales use different case families");
assert.equal(new Set(definitions.map((item) => item.title)).size, 24, "all twenty-four authored treatment titles are unique");
assert.equal(new Set(definitions.map((item) => JSON.stringify({
  route: item.routeId,
  title: item.title,
  premise: item.publicPremise,
  evidence: item.evidenceTitles,
  redHerrings: item.redHerrings,
  rhythm: item.rhythm,
  bridge: item.causalBridge,
  aftermath: item.aftermathLabel
}))).size, 24, "twenty-four treatments are not name/location substitutions");

function publicWords(value) {
  return new Set(value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((word) => word.length > 3));
}

function jaccard(left, right) {
  const leftWords = publicWords(left);
  const rightWords = publicWords(right);
  const overlap = [...leftWords].filter((word) => rightWords.has(word)).length;
  return overlap / Math.max(1, new Set([...leftWords, ...rightWords]).size);
}

const midnightCases = definitions.filter((item) => item.campaignId === "midnight-chorus");
const establishedCases = definitions.filter((item) => item.campaignId !== "midnight-chorus");
for (const current of midnightCases) {
  const closest = Math.max(...establishedCases.map((existing) => jaccard(`${current.publicPremise} ${current.publicCaseFile}`, `${existing.publicPremise} ${existing.publicCaseFile}`)));
  assert.equal(closest < 0.5, true, `${current.title} remains materially distinct from the established eighteen premises (similarity ${closest.toFixed(3)})`);
}

for (const campaignId of [...new Set(definitions.map((item) => item.campaignId))]) {
  const baseline = definitions.filter((item) => item.campaignId === campaignId && item.routeId === "baseline");
  const counter = definitions.filter((item) => item.campaignId === campaignId && item.routeId === "counter-route");
  const dimensions = [
    JSON.stringify(baseline.map((item) => item.rhythm)) !== JSON.stringify(counter.map((item) => item.rhythm)),
    JSON.stringify(baseline.map((item) => item.evidenceFrame)) !== JSON.stringify(counter.map((item) => item.evidenceFrame)),
    JSON.stringify(baseline.flatMap((item) => item.redHerrings)) !== JSON.stringify(counter.flatMap((item) => item.redHerrings)),
    JSON.stringify(baseline.map((item) => item.causalBridge)) !== JSON.stringify(counter.map((item) => item.causalBridge)),
    baseline.at(-1)?.caseFamily !== counter.at(-1)?.caseFamily
  ];
  assert.equal(dimensions.filter(Boolean).length >= 4, true, `${campaignId} paired routes differ in at least four authored dimensions`);
}

const templates = ["archive-blunt", "clocktower-locked-room", "clinic-poison", "greenhouse-blade"];
const visibleCases = [];
for (let index = 0; index < definitions.length; index += 1) {
  const definition = definitions[index];
  const base = engine.createStaticDemoRuntime(templates[index % templates.length]);
  const treated = structuredClone(base.activeCase);
  const originalTruth = structuredClone(treated.deductionCase.truth);
  const originalEvidenceIds = treated.deductionCase.evidence.map((item) => item.id).sort();
  engine.applyAuthoredCampaignCaseTreatment(treated, definition);
  const validation = engine.validateWorldCase(base.world, base.events, treated.deductionCase);
  const certificate = engine.certifyPlayableCase(treated, base.events);
  const autoSolve = engine.autoSolvePlayableCase(treated, base.events);
  assert.equal(validation.valid, true, `${definition.title} keeps hard world-case validation`);
  assert.equal(certificate.routeCertified, true, `${definition.title} keeps a certified route`);
  assert.equal(autoSolve.passed, true, `${definition.title} keeps deterministic auto-solve`);
  assert.equal(autoSolve.summary.proofCoverageComplete, true, `${definition.title} keeps complete evidence coverage`);
  assert.equal(treated.qualityReport.nonCulpritExcluded, true, `${definition.title} excludes every non-culprit`);
  assert.equal(treated.qualityReport.timeline24hComplete, true, `${definition.title} closes its timeline`);
  assert.deepEqual(treated.deductionCase.truth, originalTruth, `${definition.title} treatment does not rewrite extracted truth`);
  assert.deepEqual(treated.deductionCase.evidence.map((item) => item.id).sort(), originalEvidenceIds, `${definition.title} keeps source-backed evidence membership`);
  assert.deepEqual(treated.deductionCase.logicPuzzle.requiredClueOrder, definition.rhythm.map((kind) => ({ staging: "ev-staging", opportunity: "ev-opportunity", means: "ev-means", motive: "ev-motive", trace: "ev-trace" })[kind]), `${definition.title} applies its authored investigation rhythm`);
  const second = structuredClone(base.activeCase);
  engine.applyAuthoredCampaignCaseTreatment(second, definition);
  assert.deepEqual({ title: second.deductionCase.title, premise: second.deductionCase.premise, evidence: second.deductionCase.evidence, scenes: second.deductionCase.scenes, testimonies: second.testimonies }, { title: treated.deductionCase.title, premise: treated.deductionCase.premise, evidence: treated.deductionCase.evidence, scenes: treated.deductionCase.scenes, testimonies: treated.testimonies }, `${definition.title} treatment is deterministic for the same source case`);
  visibleCases.push({
    title: treated.deductionCase.title,
    theme: treated.deductionCase.theme,
    premise: treated.deductionCase.premise,
    caseFile: treated.deductionCase.publicCaseFile,
    evidence: treated.deductionCase.evidence.map((item) => ({ title: item.title, description: item.visibleDescription, location: item.location })),
    scenes: treated.deductionCase.scenes.map((item) => ({ name: item.name, description: item.description })),
    characters: treated.deductionCase.characters.map((item) => ({ name: item.name, role: item.role, publicBio: item.publicBio })),
    redHerrings: treated.deductionCase.logicPuzzle.redHerrings,
    testimonies: treated.testimonies.map((item) => ({ initialStatement: item.initialStatement, currentStatement: item.currentStatement }))
  });
}

const visibleSerialized = JSON.stringify(visibleCases);
assert.equal(/\b(?:case|npc|event|source|location|institution|resource|evidence|session|world)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(visibleSerialized), false, "authored visible projection contains no raw identifier-shaped values");
assert.equal(/\b(?:culpritId|victimId|npcId|evidenceId|eventId|sourceId|hiddenTruth|rawBody)\b/i.test(visibleSerialized), false, "authored visible projection contains no forbidden internal keys");

const packageByCampaign = {
  "town-reckoning": "city-hall-merchant-debt-town",
  "harbor-testimony": "dock-court-market-town",
  "clinic-headlines": "hospital-family-press-town",
  "midnight-chorus": "theatre-market-night-town"
};
for (const definition of definitions) {
  const world = engine.createInitialWorld(`authored-runtime-${definition.campaignId}-${definition.ordinal}`, { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const runtime = engine.createPersistentTownRuntime(world, []);
  runtime.currentScenarioPackId = packageByCampaign[definition.campaignId];
  runtime.currentExperiment.worldPackageId = packageByCampaign[definition.campaignId];
  runtime.currentExperiment.scenarioPackId = packageByCampaign[definition.campaignId];
  runtime.campaignSession.campaignId = definition.campaignId;
  runtime.campaignSession.routeId = definition.routeId;
  runtime.campaignSession.completedCycleKeys = Array.from({ length: definition.ordinal - 1 }, (_, index) => `safe-cycle-${index + 1}`);
  runtime.campaignSession.status = definition.ordinal === 3 ? "finale-ready" : definition.ordinal === 1 ? "opening" : "transition";
  const selected = engine.authoredCampaignCaseForRuntime(runtime);
  assert.equal(selected?.title, definition.title, `${definition.title} is selected by stable Campaign route and chapter state`);
}

const baseLeadHints = {
  schemaVersion: "world-system-runtime-hints.v1",
  source: { caseTypeId: "ledger-fraud", progressionCaseTypeIds: ["ledger-fraud"] },
  caseTypeLabel: "Public records inquiry",
  resource: { label: "Public access", kind: "civic", pressure: 40, tags: [] },
  faction: { label: "Public office", kind: "civic", tags: [] },
  eventArchetype: { label: "Public review", kind: "civic", risk: 40, tags: [] },
  progressionLine: { label: "Public inquiry", kind: "civic", stageCount: 3, tags: [] },
  actionBias: { investigate: 4, "seek-alibi": 4, "cover-up": 4, pressure: 2 },
  institutionLabels: ["Public office"],
  caseTypeBias: { "ledger-fraud": 1 },
  summary: {
    schemaVersion: "world-system-runtime-hints.v1",
    active: true,
    resourcePressureLabel: "Public access pressure",
    factionLaneLabel: "Public office lane",
    eventArchetypeLabel: "Public review",
    progressionLineLabel: "Public inquiry",
    resourcePressure: 40,
    eventRisk: 40,
    progressionStageCount: 3,
    publicLabels: ["Public access", "Public office", "Public review", "Public inquiry"],
    actionKinds: ["investigate", "seek-alibi", "cover-up", "pressure"],
    appliedBiasCount: 0,
    maxActionBias: 4
  }
};
const preferredActionByFocus = { search: "investigate", question: "seek-alibi", challenge: "cover-up" };
for (const definition of definitions) {
  const world = engine.createInitialWorld(`authored-lead-${definition.campaignId}-${definition.ordinal}`, { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const runtime = engine.createPersistentTownRuntime(world, [], { worldSystemHints: structuredClone(baseLeadHints) });
  const beforeSource = structuredClone(runtime.worldSystemHints.source);
  const actor = world.npcs.find((item) => item.alive) || world.npcs[0];
  const beforeActions = engine.scoreNpcActionCandidates(world, actor, [], runtime).map((item) => ({
    kind: item.kind,
    targetNpcId: item.targetNpcId,
    targetLocationId: item.targetLocationId,
    legal: item.legal
  })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const preview = engine.applyAuthoredCampaignLeadFocus(runtime, definition);
  const afterActions = engine.scoreNpcActionCandidates(world, actor, [], runtime).map((item) => ({
    kind: item.kind,
    targetNpcId: item.targetNpcId,
    targetLocationId: item.targetLocationId,
    legal: item.legal
  })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  assert.equal(preview.focus, definition.leadFocus, `${definition.title} drives the actual World Lead focus`);
  assert.equal(runtime.worldSystemHints.actionBias[preferredActionByFocus[definition.leadFocus]], 4, `${definition.title} gives its authored action the bounded top tendency`);
  assert.equal(Object.values(runtime.worldSystemHints.actionBias).every((value) => value >= 0 && value <= 4), true, `${definition.title} keeps all runtime action tendencies bounded`);
  assert.deepEqual(runtime.worldSystemHints.source, beforeSource, `${definition.title} lead focus does not rewrite content source bindings`);
  assert.deepEqual(afterActions, beforeActions, `${definition.title} lead focus does not add, remove, or legalize NPC actions`);
}

for (const definition of definitions) {
  const world = engine.createInitialWorld(`authored-aftermath-${definition.campaignId}-${definition.ordinal}`, { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const runtime = engine.createPersistentTownRuntime(world, []);
  const packageId = packageByCampaign[definition.campaignId];
  runtime.currentScenarioPackId = packageId;
  runtime.currentExperiment.worldPackageId = packageId;
  runtime.currentExperiment.scenarioPackId = packageId;
  runtime.campaignSession.campaignId = definition.campaignId;
  runtime.campaignSession.routeId = definition.routeId;
  runtime.campaignSession.completedCaseIds = Array.from({ length: definition.ordinal - 1 }, (_, index) => `completed-case-${index + 1}`);
  runtime.campaignSession.completedCycleKeys = Array.from({ length: definition.ordinal - 1 }, (_, index) => `completed-cycle-${index + 1}`);
  runtime.campaignSession.history = [];
  const caseId = `active-authored-case-${definition.ordinal}`;
  engine.activateCampaignCase(runtime, caseId, `candidate-${definition.ordinal}`);
  assert.equal(runtime.campaignSession.history.length, 0, `${definition.title} preview and activation do not create an aftermath`);
  const summary = engine.completeCampaignCase(runtime, caseId);
  assert.equal(runtime.campaignSession.history.at(-1)?.authoredAftermathLabel, definition.aftermathLabel, `${definition.title} accepted completion records the authored aftermath internally`);
  assert.equal(summary.consequenceLabels.includes(definition.aftermathLabel), true, `${definition.title} accepted completion exposes the correct safe aftermath`);
  assert.equal(/caseId|cycleKey|acceptedAtTick|campaignId|sourceKey|hiddenTruth|rawBody/i.test(JSON.stringify(summary)), false, `${definition.title} public Campaign summary strips internal history bindings`);
}

console.log(JSON.stringify({ ok: true, caseCount: definitions.length, finales: definitions.filter((item) => item.ordinal === 3).map((item) => item.title), tests: ["twenty-four-authored-treatments", "two-routes-per-campaign", "unique-titles", "premise-similarity-gate", "paired-route-contrast", "distinct-content", "lead-rhythm-contrast", "hard-logic", "route-certificate", "auto-solve", "evidence-coverage", "non-culprit-exclusion", "timeline-closure", "truth-isolation", "determinism", "runtime-selection", "runtime-lead-focus", "npc-legal-action-isolation", "accepted-aftermath", "public-safe"] }));
