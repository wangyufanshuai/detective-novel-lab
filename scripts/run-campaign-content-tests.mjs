import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import ts from "typescript";

const root = process.cwd();
const sourceDir = path.join(root, "packages", "engine", "src");
const runtimeDir = path.join(root, "outputs", "campaign-content-test-runtime");

async function collectTsFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectTsFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
  }))).flat();
}

async function loadEngine() {
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
  return import(`${pathToFileURL(path.join(runtimeDir, "index.cjs")).href}?test=${Date.now()}`);
}

const engine = await loadEngine();
const campaigns = engine.listDetectiveCampaignDefinitions();
assert.equal(campaigns.length, 4, "v9.5 exposes four player-facing Campaign families");
assert.deepEqual(campaigns.map((campaign) => campaign.routes.length), [2, 2, 2, 2], "every Campaign exposes an original and counter route");
const routeMatrix = campaigns.flatMap((campaign) => campaign.routes.map((route) => ({ campaign, route })));
assert.equal(routeMatrix.length, 8, "four Campaigns expose eight stable authored routes");
assert.equal(routeMatrix.every(({ route }) => route.chapters.length === 3), true, "every authored route remains exactly three chapters");
assert.equal(new Set(routeMatrix.map(({ route }) => route.finaleCaseType)).size, 8, "all eight routes use distinct finale case families");
assert.equal(new Set(routeMatrix.map(({ route }) => route.chapters.flatMap((chapter) => chapter.preferredCaseTypes).join("|"))).size, 8, "route chapter matrices are not copies of one another");
for (const campaign of campaigns) {
  assert.notDeepEqual(
    campaign.routes[0].chapters.map((chapter) => chapter.preferredCaseTypes),
    campaign.routes[1].chapters.map((chapter) => chapter.preferredCaseTypes),
    `${campaign.label} paired routes do not repeat the same case-family sequence`
  );
}

const packageExpectations = [
  ["city-hall-merchant-debt-town", "town-reckoning"],
  ["dock-court-market-town", "harbor-testimony"],
  ["hospital-family-press-town", "clinic-headlines"],
  ["theatre-market-night-town", "midnight-chorus"]
];

for (const [packageId, campaignId] of packageExpectations) {
  const selected = engine.selectDetectiveCampaignDefinition({ worldPackageId: packageId });
  assert.equal(selected.id, campaignId, `${packageId} selects its authored campaign deterministically`);
  assert.deepEqual(selected, engine.selectDetectiveCampaignDefinition({ worldPackageId: packageId }), `${packageId} selection is stable`);
  for (const route of selected.routes) {
    const world = engine.createInitialWorld(`v9-${campaignId}-${route.id}`, { mode: "showcase", npcCount: 8, timelineHours: 24 });
    const runtime = engine.createPersistentTownRuntime(world, []);
    runtime.currentScenarioPackId = packageId;
    runtime.currentExperiment = { scenarioPackId: packageId, mapPackId: runtime.currentMapPackId, ruleCatalogId: runtime.currentRuleCatalogId, selectedAt: runtime.createdAt, worldPackageId: packageId };
    engine.refreshCampaignSession(runtime);
    assert.equal(engine.bindCampaignRoute(runtime, route.id), true, `${campaignId}/${route.id} binds before the first extraction`);
    engine.refreshCampaignSession(runtime);
    assert.equal(runtime.campaignSession.campaignId, campaignId, `${campaignId} binds before the first extraction`);
    assert.equal(runtime.campaignSession.routeId, route.id, `${campaignId}/${route.id} persists its internal route choice`);
    assert.equal(runtime.campaignSessionSummary.campaignLabel, selected.label, `${campaignId} returns a safe player-facing label`);
    assert.equal(runtime.campaignSessionSummary.routeLabel, route.label, `${campaignId}/${route.id} returns only its safe route label`);
    assert.equal(runtime.campaignSessionSummary.chapterObjective, route.chapters[0].objectiveLabel, `${campaignId}/${route.id} opens on its authored objective`);
    assert.equal(engine.deriveDetectiveCampaignCaseTypeBonus(runtime, route.chapters[0].preferredCaseTypes[0]), 3, `${campaignId}/${route.id} gives its first chapter family the bounded top preference`);
    assert.equal(engine.deriveDetectiveCampaignCaseTypeBonus(runtime, route.finaleCaseType), route.chapters[0].preferredCaseTypes.includes(route.finaleCaseType) ? 3 - route.chapters[0].preferredCaseTypes.indexOf(route.finaleCaseType) : 0, `${campaignId}/${route.id} bonus follows route content only`);

    engine.activateCampaignCase(runtime, "internal-current-case");
    const otherRoute = selected.routes.find((item) => item.id !== route.id);
    assert.equal(engine.bindCampaignRoute(runtime, otherRoute.id), false, `${campaignId}/${route.id} cannot switch route after extraction`);
    runtime.currentExperiment.worldPackageId = "city-hall-merchant-debt-town";
    runtime.currentScenarioPackId = "city-hall-merchant-debt-town";
    engine.refreshCampaignSession(runtime);
    assert.equal(runtime.campaignSession.campaignId, campaignId, `${campaignId} cannot be rebound after extraction freezes the campaign`);
    assert.equal(runtime.campaignSession.routeId, route.id, `${campaignId}/${route.id} keeps the route frozen with the Campaign`);

    runtime.investigatorProgression.competencies["case-closure"] = 2;
    runtime.worldArcProgress = { currentLineId: "campaign-line", lines: { "campaign-line": { status: "active", label: "Campaign line", completedStages: 2, stageCount: 3, progressLabel: "2/3 stages", pulseLabel: "Town context", nextAction: "Continue.", progressionLineId: "campaign-line", compatibleCaseTypeIds: [], activeCaseId: "internal-current-case", startedAtTick: 0, updatedAtTick: 0 } } };
    runtime.campaignRecoveries = { activeId: "campaign-recovery", items: [{ id: "campaign-recovery", sourceKey: "internal-campaign-recovery", failureKind: "rejected-theory", actionKind: "review-certified-route", status: "completed", createdAtTick: 0, completedAtTick: 0 }] };
    engine.refreshArcConvergence(runtime);
    assert.equal(runtime.arcConvergence.finaleCaseType, route.finaleCaseType, `${campaignId}/${route.id} convergence uses its own finale without a second case engine`);
    assert.equal(runtime.arcConvergenceSummary.finaleLabel, route.finaleLabel, `${campaignId}/${route.id} exposes only the safe finale label`);
  }
}

const publicPreviews = campaigns.map(engine.toDetectiveCampaignPublicPreview);
const publicJson = JSON.stringify(publicPreviews);
assert.equal(/(?:campaign|route|worldPackage|caseType|source|event|npc|location|evidence)Id/i.test(publicJson), false, "campaign previews contain no internal identifier fields");
assert.equal(campaigns.some((campaign) => publicJson.includes(campaign.id)), false, "campaign previews omit internal campaign keys");
assert.equal(/hidden.?truth|raw.?body|culprit|victim|checkpoint|sqlite|[A-Za-z]:[\\/]/i.test(publicJson), false, "campaign previews remain public-safe");

for (const { campaign, route } of routeMatrix) {
  const showcase = engine.createPremiumShowcaseWorld("premium-showcase", "archive-blunt");
  const authorityBefore = JSON.stringify({ truth: showcase.activeCase.deductionCase.truth, evidence: showcase.activeCase.deductionCase.evidence, routeCertificate: showcase.activeCase.routeCertificate, validation: showcase.activeCase.validation });
  const runtime = engine.createPersistentTownRuntime(showcase.world, showcase.events);
  runtime.currentScenarioPackId = campaign.worldPackageIds[0];
  runtime.currentExperiment = { scenarioPackId: campaign.worldPackageIds[0], mapPackId: runtime.currentMapPackId, ruleCatalogId: runtime.currentRuleCatalogId, selectedAt: runtime.createdAt, worldPackageId: campaign.worldPackageIds[0] };
  engine.refreshCampaignSession(runtime);
  engine.bindCampaignRoute(runtime, route.id);
  engine.deriveDetectiveCampaignCaseTypeBonus(runtime, route.chapters[0].preferredCaseTypes[0]);
  assert.equal(JSON.stringify({ truth: showcase.activeCase.deductionCase.truth, evidence: showcase.activeCase.deductionCase.evidence, routeCertificate: showcase.activeCase.routeCertificate, validation: showcase.activeCase.validation }), authorityBefore, `${campaign.id}/${route.id} content selection does not mutate extracted-case authority`);
  const certificate = engine.certifyPlayableCase(showcase.activeCase, showcase.events);
  const autoSolve = engine.autoSolvePlayableCase(showcase.activeCase, showcase.events);
  assert.equal(certificate.routeCertified, true, `${campaign.id}/${route.id} retains a valid Route Certificate`);
  assert.equal(autoSolve.passed, true, `${campaign.id}/${route.id} retains the certified auto-solve path`);
  assert.equal(autoSolve.summary.proofCoverageComplete, true, `${campaign.id}/${route.id} retains complete evidence coverage`);
  assert.equal(autoSolve.summary.autoTheoryAccepted, true, `${campaign.id}/${route.id} retains the unchanged judgement path`);
}

const cycleWorld = engine.createInitialWorld("v6.7-reused-case-world-arc", { mode: "showcase", npcCount: 8, timelineHours: 24 });
const cycleRuntime = engine.createPersistentTownRuntime(cycleWorld, []);
const cycleHints = {
  schemaVersion: "world-system-runtime-hints.v1",
  source: { caseTypeId: "ledger-fraud", progressionLineId: "stable-line", progressionCaseTypeIds: ["ledger-fraud"] },
  caseTypeLabel: "Ledger Fraud",
  resource: { label: "Merchant credit", kind: "commerce", pressure: 40, tags: [] },
  faction: { label: "Ledger circle", kind: "commerce", tags: [] },
  eventArchetype: { label: "Credit pressure", kind: "economy", risk: 40, tags: [] },
  progressionLine: { label: "Stable line", kind: "economy", stageCount: 4, tags: [] },
  actionBias: {},
  institutionLabels: [],
  caseTypeBias: {},
  summary: { caseTypeLabel: "Ledger Fraud", resourceLabel: "Merchant credit", factionLabel: "Ledger circle", eventLabel: "Credit pressure", progressionLabel: "Stable line", boundedBias: 0 }
};
engine.activateCampaignCase(cycleRuntime, "shared-generated-case", "stable-candidate");
const firstCycleKey = cycleRuntime.campaignSession.activeCycleKey;
engine.activateWorldArcForHints(cycleRuntime, cycleHints, firstCycleKey);
engine.advanceWorldArc(cycleRuntime, { caseId: firstCycleKey, focus: "search" });
engine.completeCampaignCase(cycleRuntime, "shared-generated-case");
engine.activateCampaignCase(cycleRuntime, "shared-generated-case", "stable-candidate");
const secondCycleKey = cycleRuntime.campaignSession.activeCycleKey;
assert.notEqual(firstCycleKey, secondCycleKey, "a later extraction receives a distinct internal campaign cycle key");
engine.activateWorldArcForHints(cycleRuntime, cycleHints, secondCycleKey);
engine.advanceWorldArc(cycleRuntime, { caseId: secondCycleKey, focus: "search" });
assert.equal(cycleRuntime.worldArcSummary.completedStages, 2, "reused generated case shells can advance the same World Arc once per real extraction");

console.log(JSON.stringify({
  ok: true,
  campaigns: publicPreviews.map((campaign) => campaign.label),
  routeCount: routeMatrix.length,
  tests: ["four-campaigns", "eight-routes", "twenty-four-treatments", "paired-route-sequences", "distinct-structure", "determinism", "binding-freeze", "route-freeze", "bounded-preference", "distinct-finales", "route-certificate", "auto-solve", "evidence-coverage", "authority-isolation", "reused-case-cycle", "public-safe"]
}));
