import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import ts from "typescript";

const root = process.cwd();
const outDir = path.join(root, "outputs");
const sourceDir = path.join(root, "packages", "engine", "src");
const runtimeDir = path.join(outDir, "world-test-runtime");

async function loadEngine() {
  await fs.mkdir(runtimeDir, { recursive: true });
  const entries = await fs.readdir(sourceDir);
  for (const entry of entries.filter((name) => name.endsWith(".ts"))) {
    const source = await fs.readFile(path.join(sourceDir, entry), "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText;
    await fs.writeFile(path.join(runtimeDir, entry.replace(/\.ts$/, ".cjs")), compiled.replace(/require\("\.\/(.+?)"\)/g, 'require("./$1.cjs")'), "utf8");
  }
  return import(pathToFileURL(path.join(runtimeDir, "index.cjs")).href);
}

const engine = await loadEngine();

{
  const premium = engine.createPremiumShowcaseWorld("premium-showcase");
  const { world, events, activeCase } = premium;
  assert.equal(world.mode, "showcase", "premium showcase uses showcase mode");
  assert.equal(world.npcs.length, 8, "premium showcase has exactly 8 NPCs");
  assert.equal(world.timelineHours, 24, "premium showcase covers a 24h timeline");
  assert.equal(events.filter((event) => event.type === "death").length, 1, "premium showcase has exactly one murder");
  assert.equal(activeCase.validation.valid, true, "premium showcase passes combined validation");
  assert.equal(activeCase.generationProfile.focusSuspectIds.length >= 2, true, "premium showcase has at least two strong red herrings");
  assert.equal(activeCase.qualityReport.logicStrength >= 95, true, "premium showcase has strong case logic");
  assert.equal(activeCase.qualityReport.misdirectionQuality >= 90, true, "premium showcase has strong misdirection");
  assert.equal(activeCase.qualityReport.deductionGraphComplete, true, "premium deduction graph is complete");
  assert.equal(activeCase.qualityReport.allNonCulpritsExplainablyExcluded, true, "premium non-culprits are explainably excluded");
  assert.equal(
    activeCase.deductionCase.truth.decisiveEvidenceIds.every((id) => events.some((event) => event.evidenceId === id)),
    true,
    "premium decisive evidence is backed by world events"
  );
  const graph = engine.buildDeductionGraph(activeCase, events);
  const logicReport = engine.buildCaseLogicReport(world, events, activeCase);
  const board = engine.deriveSuspectBoard(activeCase, events);
  assert.equal(graph.complete, true, "premium graph closes every required edge");
  assert.equal(logicReport.strongMisdirections.length, 2, "premium graph exposes two red herring profiles");
  assert.equal(board.filter((row) => row.status === "culprit").length, 1, "premium suspect board leaves one culprit");
  assert.equal(board.filter((row) => row.status === "red_herring").length >= 2, true, "premium suspect board marks red herrings");
  assert.equal(engine.validateHardCaseLogic(world, events, activeCase).valid, true, "premium hard logic validator passes");

  const allEvidenceIds = activeCase.deductionCase.evidence.map((item) => item.id);
  const missingOne = engine.judgeTheory(
    activeCase.deductionCase,
    {
      culpritId: activeCase.deductionCase.truth.culpritId,
      motive: activeCase.deductionCase.truth.motive,
      method: activeCase.deductionCase.truth.method,
      evidenceIds: allEvidenceIds.filter((id) => id !== "ev-trace")
    },
    allEvidenceIds.filter((id) => id !== "ev-trace")
  );
  assert.equal(missingOne.accepted, false, "premium theory cannot pass with missing decisive evidence");
  const correct = engine.judgeTheory(
    activeCase.deductionCase,
    {
      culpritId: activeCase.deductionCase.truth.culpritId,
      motive: activeCase.deductionCase.truth.motive,
      method: activeCase.deductionCase.truth.method,
      evidenceIds: allEvidenceIds
    },
    allEvidenceIds
  );
  assert.equal(correct.accepted, true, "premium correct theory passes");
}

{
  const templateIds = ["archive-blunt", "clocktower-locked-room", "clinic-poison", "greenhouse-blade"];
  assert.deepEqual(engine.listCaseTemplates().map((item) => item.id), templateIds, "case library exposes four stable templates");
  for (const templateId of templateIds) {
    const { world, events, activeCase } = engine.createCaseTemplate(templateId);
    assert.equal(world.npcs.length, 8, `${templateId} has 8 NPCs`);
    assert.equal(world.timelineHours, 24, `${templateId} covers 24h`);
    assert.equal(events.filter((event) => event.type === "death").length, 1, `${templateId} has one murder`);
    assert.equal(engine.validateHardCaseLogic(world, events, activeCase).valid, true, `${templateId} passes hard logic`);
    const trace = engine.buildWorldCausalTrace(world, events, activeCase);
    const traceReport = engine.validateCausalTrace(world, events, { ...activeCase, causalTrace: trace });
    assert.equal(trace.complete, true, `${templateId} causal trace is complete`);
    assert.equal(trace.emergenceScore >= 85, true, `${templateId} emergence score is high`);
    assert.equal(traceReport.valid, true, `${templateId} causal trace validates`);
    assert.equal(
      activeCase.deductionCase.truth.decisiveEvidenceIds.every((id) => events.some((event) => event.evidenceId === id && (event.intentId || event.causedByEventIds?.length))),
      true,
      `${templateId} decisive evidence is intent or cause backed`
    );
    const allEvidenceIds = activeCase.deductionCase.evidence.map((item) => item.id);
    const correct = engine.judgeTheory(
      activeCase.deductionCase,
      {
        culpritId: activeCase.deductionCase.truth.culpritId,
        motive: activeCase.deductionCase.truth.motive,
        method: activeCase.deductionCase.truth.method,
        evidenceIds: allEvidenceIds
      },
      allEvidenceIds
    );
    assert.equal(correct.accepted, true, `${templateId} correct theory passes`);
    const certificate = engine.certifyPlayableCase(activeCase, events);
    assert.equal(certificate.routeCertified, true, `${templateId} route certificate passes`);
    assert.equal(certificate.autoTheoryAccepted, true, `${templateId} route certificate auto theory passes`);
    assert.equal(certificate.sourceMode, "static", `${templateId} is marked as static certificate source`);
    assert.equal(certificate.steps.some((step) => step.kind === "search"), true, `${templateId} certificate includes search`);
    assert.equal(certificate.steps.some((step) => step.kind === "challenge"), true, `${templateId} certificate includes challenge`);
    const autoSolve = engine.autoSolvePlayableCase(activeCase, events);
    assert.equal(autoSolve.passed, true, `${templateId} auto-solve passes`);
    assert.equal(autoSolve.summary.routeCertified, true, `${templateId} auto-solve summary keeps route certificate state`);
    assert.equal(autoSolve.summary.autoTheoryAccepted, true, `${templateId} auto-solve accepted theory`);
    assert.equal(autoSolve.summary.proofCoverageComplete, true, `${templateId} auto-solve completes proof coverage`);
    assert.equal(autoSolve.steps.some((step) => step.kind === "search" && step.complete), true, `${templateId} auto-solve searches evidence`);
    assert.equal(autoSolve.steps.some((step) => step.kind === "challenge" && step.challengeHit), true, `${templateId} auto-solve hits a challenge`);
    assert.equal(autoSolve.dryRun, true, `${templateId} auto-solve defaults to dry-run`);
    const wrongCulprit = activeCase.deductionCase.characters.find((item) => item.id !== activeCase.deductionCase.truth.culpritId && item.role !== "死者")?.id;
    const wrong = engine.judgeTheory(
      activeCase.deductionCase,
      {
        culpritId: wrongCulprit,
        motive: activeCase.deductionCase.truth.motive,
        method: activeCase.deductionCase.truth.method,
        evidenceIds: allEvidenceIds
      },
      allEvidenceIds
    );
    assert.equal(wrong.accepted, false, `${templateId} wrong culprit fails`);
    const missingOne = engine.judgeTheory(
      activeCase.deductionCase,
      {
        culpritId: activeCase.deductionCase.truth.culpritId,
        motive: activeCase.deductionCase.truth.motive,
        method: activeCase.deductionCase.truth.method,
        evidenceIds: allEvidenceIds.filter((id) => id !== activeCase.deductionCase.truth.decisiveEvidenceIds[0])
      },
      allEvidenceIds.filter((id) => id !== activeCase.deductionCase.truth.decisiveEvidenceIds[0])
    );
    assert.equal(missingOne.accepted, false, `${templateId} missing decisive evidence fails`);
  }
}

{
  const first = engine.createInitialWorld("stable-seed");
  const second = engine.createInitialWorld("stable-seed");
  assert.equal(first.mode, "showcase", "default world uses showcase mode");
  assert.equal(first.npcs.length, 8, "showcase world starts with 8 NPCs");
  assert.equal(first.timelineHours, 24, "showcase world targets a 24h timeline");
  assert.deepEqual(
    first.npcs.map((npc) => npc.schedule),
    second.npcs.map((npc) => npc.schedule),
    "NPC schedules should be deterministic for the same seed"
  );
  assert.equal(engine.createInitialWorld("stable-seed", { mode: "advanced" }).npcs.length, 30, "advanced mode keeps 30 NPCs");
}

{
  const world = engine.createInitialWorld("case-seed");
  const daily = engine.simulateDailyLife(world, 1, []);
  const tick = engine.simulateWorldTick(daily.world, daily.events);
  const repeatDaily = engine.simulateDailyLife(engine.createInitialWorld("case-seed"), 1, []);
  const repeat = engine.simulateWorldTick(repeatDaily.world, repeatDaily.events);
  assert.deepEqual(
    [...daily.events, ...tick.events].map((event) => [event.id, event.type, event.actorIds.join(","), event.evidenceId || ""]),
    [...repeatDaily.events, ...repeat.events].map((event) => [event.id, event.type, event.actorIds.join(","), event.evidenceId || ""]),
    "event log should be deterministic"
  );
  assert.equal(daily.reports.length, 1, "one showcase daily simulation report should be generated");
  assert.equal(daily.world.memories.every((memory) => daily.events.some((event) => event.id === memory.eventId)), true, "every daily memory points to a real daily event");
  assert.equal(tick.events.filter((event) => event.type === "death").length, 1, "one murder event is generated");

  const allEvents = [...daily.events, ...tick.events];
  const caseFromLog = engine.extractCaseFromWorld(tick.world, allEvents);
  assert.equal(caseFromLog.validation.valid, true, "world case should pass combined validation");
  const constraint = engine.buildTravelConstraint(tick.world);
  assert.equal(constraint.edges.every((edge) => edge.minutes > 0), true, "travel edges should have positive weights");
  for (const edge of constraint.edges) {
    const reverse = constraint.edges.find((item) => item.from === edge.to && item.to === edge.from);
    assert.equal(Boolean(reverse), true, "travel graph should be symmetric");
  }
  assert.equal(caseFromLog.qualityReport.uniqueCulprit, true, "quality report should prove a unique culprit");
  assert.equal(caseFromLog.qualityReport.score >= 85, true, "quality report should score at least 85");
  assert.equal(caseFromLog.qualityReport.worldBackedEvidence, true, "quality report proves event-sourced evidence");
  assert.equal(caseFromLog.qualityReport.memoryScopedTestimony, true, "quality report proves memory-scoped testimony");
  assert.equal(caseFromLog.qualityReport.timeline24hComplete, true, "showcase timeline should fit the 24h window");
  assert.equal(caseFromLog.qualityReport.nonCulpritExcluded, true, "quality report proves non-culprit exclusion");
  assert.equal(caseFromLog.qualityReport.reasoningTraceComplete, true, "quality report proves complete reasoning trace");
  assert.equal(caseFromLog.qualityReport.reasoningTrace.every((trace) => trace.complete), true, "every reasoning trace should be complete");
  assert.equal(caseFromLog.generationProfile.culpritId, caseFromLog.deductionCase.truth.culpritId, "profile culprit matches truth");
  assert.equal(caseFromLog.generationProfile.focusSuspectIds.length, 3, "case has three focus suspects");
  assert.equal(caseFromLog.testimonies.some((testimony) => testimony.contradictionEvidenceIds.length > 0), true, "case has challengeable testimony");
  assert.equal(
    caseFromLog.deductionCase.truth.decisiveEvidenceIds.every((id) => allEvents.some((event) => event.evidenceId === id)),
    true,
    "decisive evidence must come from world events"
  );
  const nonCulprits = caseFromLog.deductionCase.logicPuzzle.suspectMatrix.filter((row) => !row.isCulprit);
  assert.equal(nonCulprits.every((row) => row.excludedByEvidenceIds.length > 0), true, "every non-culprit has exclusion evidence");

  const context = engine.buildNpcKnowledgeContext(tick.world, allEvents, caseFromLog.deductionCase, caseFromLog.generationProfile.focusSuspectIds[0], []);
  assert.equal(
    context.visibleMemories.every((memory) => memory.npcId === caseFromLog.generationProfile.focusSuspectIds[0]),
    true,
    "NPC knowledge context must expose only that NPC's memories"
  );
  const testimonyUpdate = engine.updateTestimonyWithContradiction(caseFromLog.testimonies, caseFromLog.generationProfile.culpritId, "ev-opportunity");
  assert.equal(testimonyUpdate.updated, true, "evidence challenge should update matching testimony");

  for (const time of ["08:00", "12:00", "20:00", "23:00"]) {
    const snapshot = engine.buildWorldMapSnapshot(tick.world, allEvents, caseFromLog, null, { day: 1, time });
    assert.equal(snapshot.actors.length, 8, `${time} map snapshot should include 8 actors`);
    assert.equal(snapshot.actors.every((actor) => actor.locationId && Number.isFinite(actor.x) && Number.isFinite(actor.y)), true, `${time} actors should have explainable positions`);
    assert.equal(snapshot.tiles.some((tile) => tile.locationId === caseFromLog.generationProfile.sceneLocationId), true, `${time} map should include the crime scene tile`);
  }
  const murderWindow = engine.buildWorldMapSnapshot(tick.world, allEvents, caseFromLog, null, { day: 1, time: "21:47" });
  assert.equal(murderWindow.markers.some((marker) => marker.type === "crime"), true, "murder window map should show a crime marker");
  const discoveredMap = engine.buildWorldMapSnapshot(
    tick.world,
    allEvents,
    caseFromLog,
    { id: "session-test", worldId: tick.world.id, caseId: caseFromLog.id, playerId: "test", displayName: "test", discoveredEvidenceIds: ["ev-motive"], interrogationLog: [], createdAt: "", updatedAt: "" },
    { day: 1, time: "21:47" }
  );
  assert.equal(discoveredMap.markers.some((marker) => marker.evidenceId === "ev-motive" && marker.discovered), true, "discovered evidence should be reflected in map markers");

  const brokenCase = structuredClone(caseFromLog.deductionCase);
  brokenCase.logicPuzzle.exclusionChains = [];
  brokenCase.logicPuzzle.suspectMatrix = brokenCase.logicPuzzle.suspectMatrix.map((row) => ({ ...row, excludedByEvidenceIds: row.isCulprit ? [] : [] }));
  assert.equal(engine.validateWorldCase(tick.world, allEvents, brokenCase).valid, false, "removing exclusion evidence should fail validation");
}

{
  const cases = [];
  for (let index = 0; index < 20; index += 1) {
    const world = engine.createInitialWorld(`batch-seed-${index}`, { mode: "advanced" });
    const daily = engine.simulateDailyLife(world, 5, []);
    const tick = engine.simulateWorldTick(daily.world, daily.events);
    const allEvents = [...daily.events, ...tick.events];
    const caseFromLog = engine.extractCaseFromWorld(tick.world, allEvents);
    cases.push(caseFromLog);
    assert.equal(caseFromLog.validation.valid, true, `batch seed ${index} should be valid`);
    assert.equal(caseFromLog.qualityReport.uniqueCulprit, true, `batch seed ${index} should have unique culprit`);
    assert.equal(caseFromLog.qualityReport.score >= 85, true, `batch seed ${index} quality score should be >= 85`);
    assert.equal(caseFromLog.qualityReport.reasoningTrace.every((trace) => trace.complete), true, `batch seed ${index} reasoning trace should be complete`);
    assert.equal((tick.world.simulationReports || []).length >= 3, true, `batch seed ${index} should have at least 3 daily reports`);
    assert.equal(caseFromLog.testimonies.some((testimony) => testimony.contradictionEvidenceIds.length > 0), true, `batch seed ${index} should include testimony contradictions`);
    assert.equal(
      caseFromLog.deductionCase.truth.decisiveEvidenceIds.every((id) => allEvents.some((event) => event.evidenceId === id)),
      true,
      `batch seed ${index} decisive evidence should be backed by world events`
    );
    assert.equal(
      caseFromLog.deductionCase.truth.trueTimeline.every((event) => allEvents.some((source) => source.id === event.id)),
      true,
      `batch seed ${index} timeline should be backed by world events`
    );
  }
  const archetypes = new Set(cases.map((item) => item.generationProfile.archetype));
  assert.equal(archetypes.size >= 4, true, "20 seeds should cover all four murder archetypes");
  const signatures = new Set(cases.map((item) => `${item.generationProfile.culpritId}:${item.generationProfile.sceneLocationId}:${item.generationProfile.archetype}`));
  assert.equal(signatures.size > 8, true, "different seeds should produce varied culprit/location/archetype signatures");
}

{
  let runtime = engine.createStaticDemoRuntime();
  assert.equal(runtime.world.npcs.length, 8, "static demo starts with eight NPCs");
  assert.equal(runtime.session.discoveredEvidenceIds.length, 0, "static demo starts with locked evidence");
  const evidenceId = runtime.activeCase.deductionCase.truth.decisiveEvidenceIds[0];
  runtime = engine.discoverDemoEvidence(runtime, evidenceId);
  assert.equal(runtime.session.discoveredEvidenceIds.includes(evidenceId), true, "static discovery updates the browser session");
  runtime = engine.interrogateDemoNpc(runtime, {
    characterId: runtime.activeCase.generationProfile.witnessId,
    question: "你在案发时间看到了什么？",
    evidenceId
  });
  assert.equal(runtime.session.interrogationLog.length, 1, "static interrogation writes a memory-scoped log");
  const allEvidenceIds = runtime.activeCase.deductionCase.evidence.map((item) => item.id);
  for (const id of allEvidenceIds) runtime = engine.discoverDemoEvidence(runtime, id);
  runtime = engine.submitDemoTheory(runtime, {
    culpritId: runtime.activeCase.deductionCase.truth.culpritId,
    motive: runtime.activeCase.deductionCase.truth.motive,
    method: runtime.activeCase.deductionCase.truth.method,
    evidenceIds: allEvidenceIds
  });
  assert.equal(runtime.session.judgement.accepted, true, "static runtime uses the same local judgement engine");
  runtime = engine.revealDemoSolution(runtime);
  assert.equal(runtime.revealText.length > 80, true, "static runtime produces a source-locked solution");
}

{
  const draft = engine.createPremiumAuthoringDraft();
  const validReport = engine.validateAuthoringDraft(draft);
  assert.equal(validReport.valid, true, "premium case converts to a valid authoring draft");
  assert.equal(validReport.hardLogicValid, true, "authoring draft keeps hard logic valid");

  const withoutKeyEvidence = engine.applyAuthoringPatch(draft, {
    op: "delete-array-item",
    path: "caseFromLog.deductionCase.evidence",
    id: draft.caseFromLog.deductionCase.truth.decisiveEvidenceIds[0]
  });
  assert.equal(engine.validateAuthoringDraft(withoutKeyEvidence).valid, false, "deleting decisive evidence fails authoring validation");

  const noExclusionChains = engine.applyAuthoringPatch(draft, {
    op: "set",
    path: "caseFromLog.deductionCase.logicPuzzle.exclusionChains",
    value: []
  });
  const missingExclusions = engine.applyAuthoringPatch(noExclusionChains, {
    op: "set",
    path: "caseFromLog.deductionCase.logicPuzzle.suspectMatrix",
    value: noExclusionChains.caseFromLog.deductionCase.logicPuzzle.suspectMatrix.map((row) => ({ ...row, excludedByEvidenceIds: row.isCulprit ? [] : [] }))
  });
  assert.equal(engine.validateAuthoringDraft(missingExclusions).valid, false, "removing non-culprit exclusions fails authoring validation");

  const exported = engine.exportAuthoringJson(draft);
  const imported = JSON.parse(exported);
  assert.deepEqual(imported.caseFromLog.deductionCase.title, draft.caseFromLog.deductionCase.title, "exported authoring JSON can be imported without title drift");
  assert.equal(engine.validateAuthoringDraft(imported).valid, true, "exported authoring JSON validates after import");

  const markdown = engine.exportAuthoringMarkdown(draft);
  assert.equal(markdown.includes("## Characters"), true, "authoring markdown includes characters");
  assert.equal(markdown.includes("## Evidence"), true, "authoring markdown includes evidence");
  assert.equal(markdown.includes("## True Timeline"), true, "authoring markdown includes timeline");
  assert.equal(markdown.includes("## Critical Reasoning Chain"), true, "authoring markdown includes reasoning chain");

  const drift = structuredClone(draft);
  delete drift.caseFromLog.deductionCase.characters[0].knowledgeScope;
  const driftReport = engine.validateAuthoringDraft(drift);
  assert.equal(driftReport.valid, false, "field drift in imported authoring JSON is reported clearly");
  assert.equal(driftReport.errors.some((item) => item.path.includes("knowledgeScope")), true, "field drift issue locates the missing field");

  const galleryEntry = engine.createCaseGalleryEntry(draft, { source: "local" });
  assert.equal(galleryEntry.validation.valid, true, "valid premium draft can become a runnable gallery entry");
  assert.equal(galleryEntry.validation.hardLogicValid, true, "gallery entry preserves hard logic summary");
  assert.equal(galleryEntry.validation.evidenceCount, draft.caseFromLog.deductionCase.evidence.length, "gallery entry summarizes evidence count");

  const invalidGalleryEntry = engine.createCaseGalleryEntry(withoutKeyEvidence, { source: "local" });
  assert.equal(invalidGalleryEntry.validation.valid, false, "invalid draft is stored but marked non-runnable in gallery");
  assert.equal(invalidGalleryEntry.validation.errorCount > 0, true, "invalid gallery entry keeps error count");

  const bundle = engine.exportCaseGalleryBundle([galleryEntry, invalidGalleryEntry]);
  const importedBundle = engine.importCaseGalleryEntries(JSON.parse(bundle), draft);
  assert.equal(importedBundle.length, 2, "gallery bundle export/import round-trips entries");
  assert.deepEqual(importedBundle.map((entry) => entry.validation.valid), [true, false], "gallery bundle preserves validation status after import");

  const standaloneImported = engine.importCaseGalleryEntries(draft.caseFromLog.deductionCase, draft);
  assert.equal(standaloneImported.length, 1, "standalone DeductionCase imports as a gallery entry");
  assert.equal(standaloneImported[0].draft.caseFromLog.deductionCase.title, draft.caseFromLog.deductionCase.title, "standalone DeductionCase import preserves title");
}

{
  for (const template of engine.listCaseTemplates()) {
    const premium = engine.createCaseTemplate(template.id);
    const proof = engine.buildEmergenceProofTrace(premium.world, premium.events, premium.activeCase, { solved: true, discoveredEvidenceIds: premium.activeCase.deductionCase.evidence.map((item) => item.id) });
    assert.equal(proof.complete, true, `${template.id} proof trace must be complete after solve`);
    assert.equal(proof.evaluation.worldBackedEvidence, true, `${template.id} evidence must be backed by world events`);
    assert.equal(proof.evaluation.memoryScopedTestimony, true, `${template.id} testimony must be backed by memory records`);
    assert.equal(proof.evaluation.nonCulpritExcluded, true, `${template.id} must explainably exclude non-culprits`);
    assert.equal(proof.nodes.some((node) => node.stage === "case-extraction"), true, `${template.id} proof trace includes case extraction`);
    assert.equal(proof.nodes.some((node) => node.stage === "validation"), true, `${template.id} proof trace includes validation`);
  }

  const report = engine.runEmergenceBenchmark();
  assert.equal(report.seedCount, 20, "emergence benchmark defaults to 20 deterministic seeds");
  assert.equal(report.results.length, 20, "emergence benchmark reports every seed");
  assert.equal(report.results.every((result) => typeof result.seed === "string" && result.errors), true, "every seed has structured status fields");
  assert.equal(report.results.every((result) => result.generatedCase), true, "default benchmark seeds should generate cases");
  assert.equal(report.results.every((result) => result.routeCertified), true, "default benchmark seeds should route-certify");
  assert.equal(report.results.every((result) => result.autoSolvePassed), true, "default benchmark seeds should auto-solve");
  assert.equal(report.autoSolvePassRate, 100, "benchmark exposes auto-solve pass rate");
  assert.equal(report.routeCertifiedRate, 100, "benchmark exposes route certificate rate");
  assert.equal(report.averageAutoSolveSteps > 0, true, "benchmark exposes average auto-solve steps");
  assert.equal(report.passed + report.failed, 20, "benchmark summary accounts for every seed");
  const markdown = engine.renderEmergenceBenchmarkMarkdown(report);
  assert.equal(markdown.includes("Emergence Benchmark Report"), true, "benchmark markdown has a title");
  assert.equal(markdown.includes("| Seed | Case |"), true, "benchmark markdown has a result table");
  assert.equal(markdown.includes("Auto-solve pass rate"), true, "benchmark markdown includes auto-solve metrics");
}

console.log("World simulation tests passed.");
