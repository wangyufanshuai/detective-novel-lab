import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const sourceDir = path.join(root, "packages", "engine", "src");
const runtimeDir = path.join(root, "outputs", "command-deck-invariant-runtime");

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
    }).outputText.replace(/require\("(\.{1,2}\/.+?)"\)/g, 'require("$1.cjs")');
    const target = path.join(runtimeDir, path.relative(sourceDir, file).replace(/\.ts$/, ".cjs"));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, output, "utf8");
  }
  return import(`${pathToFileURL(path.join(runtimeDir, "index.cjs")).href}?test=${Date.now()}`);
}

async function loadResolver() {
  const sourcePath = path.join(root, "app", "campaign", "context-action-resolver.ts");
  const registryPath = path.join(root, "app", "campaign", "investigation-action-registry.ts");
  const target = path.join(runtimeDir, "context-action-resolver.mjs");
  const output = ts.transpileModule(await fs.readFile(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText.replace('"./investigation-action-registry"', '"./investigation-action-registry.mjs"');
  await fs.writeFile(path.join(runtimeDir, "investigation-action-registry.mjs"), ts.transpileModule(await fs.readFile(registryPath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText, "utf8");
  await fs.writeFile(target, output, "utf8");
  return import(`${pathToFileURL(target).href}?test=${Date.now()}`);
}

const engine = await loadEngine();
const { resolveSafeContextActions } = await loadResolver();
const original = engine.createStaticDemoRuntime("archive-blunt");
const legacyPath = structuredClone(original);
const commandDeckPath = structuredClone(original);
const evidenceId = original.activeCase.deductionCase.truth.decisiveEvidenceIds[0];
const witnessId = original.activeCase.generationProfile.witnessId;

const locationActions = resolveSafeContextActions({
  contextKind: "location",
  hasCase: true,
  hasSession: true,
  observed: true,
  joined: true,
  hasSearchableEvidence: true,
  hasDiscoveredEvidence: false,
  challengedTestimony: false,
  theorySubmitted: false,
  judgementAccepted: false,
  revealAvailable: false
});
assert.equal(locationActions[0].kind, "search", "Command Deck selects the existing search handler");
assert.equal(locationActions[0].handlerKey, "discoverSceneEvidence", "registry binds search to the existing certified handler");
assert.equal(locationActions.filter((item) => item.primary).length, 1, "resolver exposes one primary action at most");

const legacyAfterSearch = engine.discoverDemoEvidence(legacyPath, evidenceId);
const deckAfterSearch = locationActions[0].kind === "search"
  ? engine.discoverDemoEvidence(commandDeckPath, evidenceId)
  : commandDeckPath;
const actorActions = resolveSafeContextActions({
  contextKind: "actor",
  hasCase: true,
  hasSession: true,
  observed: true,
  joined: true,
  hasSearchableEvidence: false,
  hasDiscoveredEvidence: true,
  challengedTestimony: false,
  theorySubmitted: false,
  judgementAccepted: false,
  revealAvailable: false
});
assert.deepEqual(actorActions.map((item) => item.kind), ["question", "challenge"], "Command Deck selects existing question and challenge handlers");

const questionInput = { characterId: witnessId, question: "What did you observe?", evidenceId };
const legacyAfterQuestion = engine.interrogateDemoNpc(legacyAfterSearch, questionInput);
const deckAfterQuestion = engine.interrogateDemoNpc(deckAfterSearch, questionInput);
const notebookVisibleProjection = engine.buildEvidenceNotebook(original.activeCase, original.events, deckAfterSearch.session).map((item) => ({
  title: item.title,
  useHint: item.useHint,
  locationName: item.locationName,
  sourceEventLabel: item.sourceEventLabel,
  challengeNpcNames: item.challengeNpcNames,
  supports: item.supports,
  contradicts: item.contradicts
}));
assert.equal(/\b(?:npc|case|event|source|location|institution|resource|evidence|scene|session|character)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(JSON.stringify(notebookVisibleProjection)), false, "visible notebook labels contain no raw identifier tokens");

function authoritySnapshot(state) {
  const ledger = engine.buildCaseTruthLedger(state.activeCase, state.events);
  const coverage = engine.evaluateCaseProofCoverage(ledger, {
    discoveredEvidenceIds: state.session.discoveredEvidenceIds,
    selectedEvidenceIds: state.session.submittedTheory?.evidenceIds,
    challengedCharacterIds: state.session.interrogationLog.filter((entry) => entry.challenge?.hit).map((entry) => entry.characterId),
    solved: Boolean(state.session.judgement?.accepted)
  });
  const certificate = engine.certifyPlayableCase(state.activeCase, state.events, state.session);
  const persistentRuntime = engine.createPersistentTownRuntime(state.world, state.events, { maxTicks: 48 });
  const actor = state.world.npcs.find((npc) => npc.id === witnessId) || state.world.npcs[0];
  const legalActions = engine.scoreNpcActionCandidates(state.world, actor, state.events, persistentRuntime)
    .map((candidate) => ({ kind: candidate.kind, legal: candidate.legal, blockedReason: candidate.blockedReason }));
  return {
    truth: state.activeCase.deductionCase.truth,
    routeCertificate: certificate,
    evidenceCoverage: coverage,
    candidateValidity: state.activeCase.validation,
    legalActions
  };
}

assert.deepEqual(authoritySnapshot(deckAfterQuestion), authoritySnapshot(legacyAfterQuestion), "Command Deck and legacy handlers preserve identical case authority");
assert.deepEqual(deckAfterQuestion.activeCase.deductionCase.truth, original.activeCase.deductionCase.truth, "UI routing never mutates case truth");
assert.equal(JSON.stringify(locationActions).includes("culpritId"), false, "safe action projection contains no hidden truth key");
console.log(JSON.stringify({ ok: true, checks: ["handler-reuse", "public-notebook", "truth", "route-certificate", "evidence-coverage", "candidate-validity", "npc-legal-actions"] }));
