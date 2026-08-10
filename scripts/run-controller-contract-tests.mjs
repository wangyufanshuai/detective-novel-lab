import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const sourceDir = path.join(root, "packages", "engine", "src");
const runtimeDir = path.join(root, "outputs", "controller-contract-runtime");
const read = (file) => fs.readFile(path.join(root, file), "utf8");

async function collectTsFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTsFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
  }))).flat();
}

async function loadEngine() {
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
  return import(`${pathToFileURL(path.join(runtimeDir, "index.cjs")).href}?contract=${Date.now()}`);
}

const controllerFiles = [
  "app/controllers/useTownRuntimeController.ts",
  "app/controllers/useInvestigationController.ts",
  "app/controllers/useCampaignController.ts",
  "app/controllers/useReplayController.ts",
  "app/controllers/useReviewController.ts"
];
const pageSource = await read("app/page.tsx");
const requestSource = [
  pageSource,
  await read("app/hooks/usePersistentTownLifecycle.ts"),
  await read("app/hooks/useTheorySubmissionActions.ts"),
  await read("app/hooks/useCertifiedInvestigationActions.ts"),
  await read("app/hooks/useCertifiedPlaythroughActions.ts")
].join("\n");
for (const file of controllerFiles) {
  const source = await read(file);
  const hookName = path.basename(file, ".ts");
  assert.match(source, new RegExp(`export function ${hookName}\\b`), `${hookName} is an explicit controller boundary`);
  assert.match(pageSource, new RegExp(`${hookName}\\(`), `${hookName} is composed by the player page`);
  assert.doesNotMatch(source, /\/api\/|\bfetch\s*\(|\bpostV1\s*\(|\bpostJson\s*\(/, `${hookName} cannot alter API endpoints or request order`);
}

const expectedCoreRequests = [
  "/api/players/join",
  "/api/investigation/discover",
  "/api/investigation/interrogate",
  "/api/investigation/submit-theory",
  "/api/investigation/reveal",
  "/api/v1/command/town/runtime/start",
  "/api/v1/command/town/runtime/step",
  "/api/v1/command/town/runtime/pause",
  "/api/v1/command/town/runtime/reset",
  "/api/v1/command/town/case/extract"
];
for (const endpoint of expectedCoreRequests) {
  assert.equal(requestSource.includes(endpoint), true, `existing request contract remains wired: ${endpoint}`);
}

const lineBudgets = [
  ["app/page.tsx", 1100],
  ["app/components/InvestigationSurface.tsx", 350],
  ["app/components/DetectiveTownUI.tsx", 3200],
  ["app/globals.css", 6500]
];
for (const [file, maximum] of lineBudgets) {
  const count = (await read(file)).split(/\r?\n/).length;
  assert.equal(count < maximum, true, `${file} stays below ${maximum} lines (actual ${count})`);
}
assert.equal((await read("app/campaign/campaign-pacing-model.ts")).split(/\r?\n/).length < 350, true, "Campaign Pacing presentation model stays below 350 lines");
assert.equal((await read("app/campaign/campaign-transition-model.ts")).split(/\r?\n/).length < 350, true, "Campaign Transition presentation model stays below 350 lines");
assert.equal((await read("app/components/WorldCampaignPanel.tsx")).split(/\r?\n/).length < 300, true, "World Campaign composition stays below 300 lines");

const surfaceContracts = [
  ["app/components/TownMapSurface.tsx", "TownMapStage"],
  ["app/components/TownControlSurface.tsx", "ControlRail"],
  ["app/components/InvestigationSurface.tsx", "InvestigationPanel"],
  ["app/components/CharacterEncounterCard.tsx", "CharacterEncounterCard"],
  ["app/components/CampaignTransitionTheatre.tsx", "CampaignTransitionTheatre"],
  ["app/components/CampaignJourneySurfaces.tsx", "CampaignJourneySurface"],
  ["app/components/InvestigationGraphSurface.tsx", "InvestigationGraphSurface"],
  ["app/components/WorldCampaignPanel.tsx", "WorldCampaignPanel"],
  ["app/components/TownReviewSurface.tsx", "PersistentTownCommandCenter"],
  ["app/components/InvestigationCoreActionsSurface.tsx", "InvestigationCoreActionsSurface"],
  ["app/components/InvestigationRouteReviewSurface.tsx", "InvestigationRouteReviewSurface"],
  ["app/components/InvestigationDebriefReplaySurface.tsx", "InvestigationDebriefReplaySurface"]
];
for (const [file, exportName] of surfaceContracts) {
  assert.match(await read(file), new RegExp(`export (?:function|const) ${exportName}\\b`), `${exportName} has an independent surface module`);
}

const workflowContracts = [
  ["app/hooks/useGuidedManualViewModel.ts", "deriveGuidedManualTarget"],
  ["app/hooks/useTheorySubmissionActions.ts", "useTheorySubmissionActions"],
  ["app/hooks/useGuidedManualActions.ts", "useGuidedManualActions"],
  ["app/hooks/useCertifiedInvestigationActions.ts", "useCertifiedInvestigationActions"],
  ["app/hooks/useCertifiedPlaythroughActions.ts", "useCertifiedPlaythroughActions"],
  ["app/hooks/useInvestigationNavigationActions.ts", "useInvestigationNavigationActions"],
  ["app/hooks/useCampaignTransitionTheatre.ts", "useCampaignTransitionTheatre"],
  ["app/hooks/useCommandDeckOverlayArbiter.ts", "useCommandDeckOverlayArbiter"],
  ["app/hooks/useManualReplayDrillActions.ts", "useManualReplayDrillActions"],
  ["app/hooks/useWorldCampaignPresentation.ts", "useWorldCampaignPresentation"],
  ["app/hooks/useInvestigationWorkspacePresentation.ts", "useInvestigationWorkspacePresentation"],
  ["app/hooks/useCertifiedCaseAuditModels.ts", "useCertifiedCaseAuditModels"],
  ["app/hooks/useCampaignCommandBrief.ts", "useCampaignCommandBrief"],
  ["app/campaign/investigation-workspace-model.ts", "buildPlayableInvestigationPath"]
];
for (const [file, exportName] of workflowContracts) {
  const source = await read(file);
  assert.match(source, new RegExp(`export function ${exportName}\\b`), `${exportName} has an independent workflow boundary`);
  assert.equal(source.split(/\r?\n/).length < 500, true, `${file} stays below 500 lines`);
}
for (const file of ["app/hooks/useInvestigationWorkspacePresentation.ts", "app/hooks/useCertifiedCaseAuditModels.ts", "app/hooks/useCampaignCommandBrief.ts"]) {
  const source = await read(file);
  assert.doesNotMatch(source, /\/api\/|\bfetch\s*\(|\bpostJson\s*\(|\bpostV1\s*\(/, `${file} remains request-free presentation ownership`);
}
assert.doesNotMatch(await read("app/campaign/campaign-command-brief-model.ts"), /\/api\/|\bfetch\s*\(|\bpostJson\s*\(|\bpostV1\s*\(|localStorage|sessionStorage|indexedDB|advancePersistentTown|stepPersistentTown/, "campaign command brief model remains pure and request-free");
assert.equal((await read("app/hooks/useCampaignCommandBrief.ts")).split(/\r?\n/).length < 80, true, "Campaign command brief hook stays below 80 lines");

const engine = await loadEngine();
const baseline = engine.createStaticDemoRuntime("archive-blunt");
const legacy = structuredClone(baseline);
let decomposed = structuredClone(baseline);
const evidenceIds = baseline.activeCase.deductionCase.evidence.map((item) => item.id);
const decisiveEvidenceId = baseline.activeCase.deductionCase.truth.decisiveEvidenceIds[0];
const witnessId = baseline.activeCase.generationProfile.witnessId;
const actionRegistry = {
  search: (state, evidenceId) => engine.discoverDemoEvidence(state, evidenceId),
  question: (state, evidenceId) => engine.interrogateDemoNpc(state, {
    characterId: witnessId,
    question: "What did you observe during the public crime window?",
    evidenceId
  }),
  submit: (state) => engine.submitDemoTheory(state, {
    culpritId: state.activeCase.deductionCase.truth.culpritId,
    motive: state.activeCase.deductionCase.truth.motive,
    method: state.activeCase.deductionCase.truth.method,
    evidenceIds
  })
};

let legacyAfter = legacy;
for (const evidenceId of evidenceIds) legacyAfter = engine.discoverDemoEvidence(legacyAfter, evidenceId);
legacyAfter = engine.interrogateDemoNpc(legacyAfter, {
  characterId: witnessId,
  question: "What did you observe during the public crime window?",
  evidenceId: decisiveEvidenceId
});
legacyAfter = engine.submitDemoTheory(legacyAfter, {
  culpritId: legacyAfter.activeCase.deductionCase.truth.culpritId,
  motive: legacyAfter.activeCase.deductionCase.truth.motive,
  method: legacyAfter.activeCase.deductionCase.truth.method,
  evidenceIds
});
for (const evidenceId of evidenceIds) decomposed = actionRegistry.search(decomposed, evidenceId);
decomposed = actionRegistry.question(decomposed, decisiveEvidenceId);
decomposed = actionRegistry.submit(decomposed);

function authoritySnapshot(state) {
  const ledger = engine.buildCaseTruthLedger(state.activeCase, state.events);
  const coverage = engine.evaluateCaseProofCoverage(ledger, {
    discoveredEvidenceIds: state.session.discoveredEvidenceIds,
    selectedEvidenceIds: state.session.submittedTheory?.evidenceIds,
    challengedCharacterIds: state.session.interrogationLog.filter((entry) => entry.challenge?.hit).map((entry) => entry.characterId),
    solved: Boolean(state.session.judgement?.accepted)
  });
  const certificate = engine.certifyPlayableCase(state.activeCase, state.events, state.session);
  const runtime = engine.createPersistentTownRuntime(state.world, state.events, { maxTicks: 48 });
  const actor = state.world.npcs.find((npc) => npc.id === witnessId) || state.world.npcs[0];
  return {
    truth: state.activeCase.deductionCase.truth,
    routeCertificate: certificate,
    evidenceCoverage: coverage,
    judgement: state.session.judgement,
    candidates: runtime.candidates,
    legalActions: engine.scoreNpcActionCandidates(state.world, actor, state.events, runtime)
      .map((candidate) => ({ kind: candidate.kind, legal: candidate.legal, blockedReason: candidate.blockedReason })),
    worldConsequences: runtime.consequences
  };
}

assert.deepEqual(authoritySnapshot(decomposed), authoritySnapshot(legacyAfter), "controller routing preserves truth, Route Certificate, coverage, judgement, candidates, NPC legal actions, and world consequences");
assert.deepEqual(baseline.activeCase.deductionCase.truth, decomposed.activeCase.deductionCase.truth, "controller composition never mutates extracted truth");

console.log(JSON.stringify({
  ok: true,
  controllers: controllerFiles.length,
  surfaces: surfaceContracts.length,
  workflows: workflowContracts.length,
  checks: ["api-contract", "line-budgets", "workflow-boundaries", "truth", "route-certificate", "evidence-coverage", "judgement", "candidate", "npc-legal-actions", "world-consequence"]
}));
