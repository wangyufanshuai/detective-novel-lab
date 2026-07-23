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
  async function collectTsFiles(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectTsFiles(fullPath);
      return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
    }));
    return nested.flat();
  }
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

const engine = await loadEngine();
const contentRoot = path.join(root, "content", "detective-v1");
async function readContentJson(name) {
  return JSON.parse(await fs.readFile(path.join(contentRoot, name), "utf8"));
}
const detectiveContentPack = {
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

{
  const directiveMapping = Object.fromEntries(detectiveContentPack.eventArchetypes.map((row) => [row.id, [
    `${row.directiveResponses?.support.institutionKind}/${row.directiveResponses?.support.strategy}/${row.directiveResponses?.support.longActionKind}`,
    `${row.directiveResponses?.contain.institutionKind}/${row.directiveResponses?.contain.strategy}/${row.directiveResponses?.contain.longActionKind}`
  ]]));
  assert.deepEqual(Object.fromEntries(Object.entries(directiveMapping).filter(([id]) => ["record-access-delay", "credit-pressure-spike", "proof-sheet-leak", "forensic-timing-gap", "household-letter-surfaced", "cargo-route-shift"].includes(id))), {
    "record-access-delay": ["court/review-court-record/review-court-record", "police/allocate-investigation/protect-chain-of-custody"],
    "credit-pressure-spike": ["commerce/audit-ledger/audit-ledger", "media/cultivate-informant/cultivate-informant"],
    "proof-sheet-leak": ["media/chase-headline/leak-to-press", "family/protect-family/suppress-story"],
    "forensic-timing-gap": ["medical/schedule-autopsy/second-medical-opinion", "medical/schedule-autopsy/seal-autopsy-record"],
    "household-letter-surfaced": ["media/chase-headline/pressure-editor", "family/protect-family/summon-family-council"],
    "cargo-route-shift": ["dock_union/trace-cargo/trace-cargo", "dock_union/trace-cargo/inspect-warehouse"]
  }, "all six event archetypes keep the fixed content-driven directive mapping");
  assert.equal(detectiveContentPack.caseTypes.length, 16, "v5.37 content pack expands to sixteen authored case types");
  assert.equal(detectiveContentPack.eventArchetypes.length, 10, "v5.37 content pack expands to ten event archetypes");
  assert.deepEqual(directiveMapping["archive-stamp-conflict"], ["court/review-court-record/review-court-record", "police/allocate-investigation/protect-chain-of-custody"], "archive cluster keeps a deterministic institution-compatible directive mapping");
  assert.deepEqual(directiveMapping["clinic-supply-shortfall"], ["medical/schedule-autopsy/second-medical-opinion", "medical/schedule-autopsy/seal-autopsy-record"], "medical cluster keeps a deterministic institution-compatible directive mapping");
  assert.deepEqual(directiveMapping["dock-shift-dispute"], ["dock_union/trace-cargo/trace-cargo", "dock_union/trace-cargo/inspect-warehouse"], "dock cluster keeps a deterministic institution-compatible directive mapping");
  assert.deepEqual(directiveMapping["editorial-pressure-wave"], ["media/chase-headline/leak-to-press", "family/protect-family/suppress-story"], "media cluster keeps a deterministic institution-compatible directive mapping");
  assert.equal(detectiveContentPack.progressionLines.length, 8, "v5.37 content pack adds authored campaign growth lines");
  assert.equal(["archive-vanishing", "clinic-inventory-gap", "dock-witness-swap", "editorial-coercion", "household-escrow", "permit-forgery"].every((caseTypeId) => engine.TOWN_CASE_TYPES.includes(caseTypeId)), true, "all v5.37 authored case types participate in the real future-case runtime rotation");
  const contentReport = engine.validateDetectiveContentPack(detectiveContentPack);
  assert.equal(contentReport.ok, true, "expanded authored content passes the backward-compatible grammar validator");
  assert.equal(contentReport.summary.coverage.caseTypesWithEvidence, 16, "every authored case type has evidence coverage");
  assert.deepEqual(contentReport.summary.authored, { clusterCount: 6, caseTypeCount: 6, eventArchetypeCount: 4, progressionLineCount: 8 }, "content summary exposes safe authored-cluster coverage counts");
  assert.equal(detectiveContentPack.caseTypes.filter((row) => row.authoredCluster).length, 6, "new authored case clusters carry explicit cluster metadata");
  assert.equal(new Set(detectiveContentPack.caseTypes.filter((row) => row.authoredCluster).map((row) => `${row.authoredCluster}:${row.contrastKey}`)).size, 6, "authored contrast keys are unique within their clusters");
  const sequenceA = engine.selectAuthoredCaseTypeSequence(detectiveContentPack, { seed: "three-case-campaign", length: 3 });
  const sequenceB = engine.selectAuthoredCaseTypeSequence(detectiveContentPack, { seed: "three-case-campaign", length: 3 });
  assert.deepEqual(sequenceA, sequenceB, "authored case sequence selection is deterministic for a campaign seed");
  assert.equal(sequenceA.distinctCaseTypeCount, 3, "three-case authored campaign selects three distinct case types");
  assert.equal(sequenceA.distinctClusterCount, 3, "three-case authored campaign avoids repeating a cluster");
  assert.equal(sequenceA.repeatedCaseTypeIds.length, 0, "three-case authored campaign has no repeated case ids");
  for (const caseTypeId of ["archive-vanishing", "clinic-inventory-gap", "dock-witness-swap", "editorial-coercion", "household-escrow", "permit-forgery"]) {
    const guide = engine.selectDefaultDetectiveContentAuthoringSelection(detectiveContentPack, { caseTypeId });
    const authoredGuide = engine.buildDetectiveContentAuthoringGuide(detectiveContentPack, engine.createPremiumAuthoringDraft(), guide);
    assert.equal(authoredGuide.selection.caseTypeId, caseTypeId, `${caseTypeId} retains an authoring selection`);
    assert.equal(authoredGuide.coverage.compatibleEvidenceTypeCount >= 3, true, `${caseTypeId} has at least three compatible evidence families`);
    assert.equal(authoredGuide.coverage.compatibleRedHerringCount > 0, true, `${caseTypeId} has a compatible red-herring pattern`);
    assert.equal(authoredGuide.coverage.compatibleEventArchetypeCount > 0, true, `${caseTypeId} has a compatible event archetype`);
    assert.equal(authoredGuide.coverage.compatibleProgressionLineCount > 0, true, `${caseTypeId} has a compatible progression line`);
  }
  const invalidDirective = structuredClone(detectiveContentPack);
  invalidDirective.eventArchetypes[0].directiveResponses.support.institutionKind = "unknown-institution";
  assert.equal(engine.validateDetectiveContentPack(invalidDirective).ok, false, "content validation rejects an unknown directive institution kind");
  const incompatibleDirective = structuredClone(detectiveContentPack);
  incompatibleDirective.eventArchetypes[0].directiveResponses.support.institutionKind = "media";
  assert.equal(engine.validateDetectiveContentPack(incompatibleDirective).ok, false, "content validation rejects a directive that cannot satisfy the long action institution requirement");
  const unsafeDirective = structuredClone(detectiveContentPack);
  unsafeDirective.eventArchetypes[0].directiveResponses.support.label = "C:\\private\\directive.txt";
  assert.equal(engine.validateDetectiveContentPack(unsafeDirective).ok, false, "content validation rejects unsafe directive copy");
  const invalidCluster = structuredClone(detectiveContentPack);
  invalidCluster.caseTypes.find((row) => row.authoredCluster).authoredCluster = "Unsafe Cluster";
  assert.equal(engine.validateDetectiveContentPack(invalidCluster).ok, false, "content validation rejects non-slug authored cluster metadata");
  const duplicateContrast = structuredClone(detectiveContentPack);
  const authoredRows = duplicateContrast.caseTypes.filter((row) => row.authoredCluster);
  authoredRows[1].authoredCluster = authoredRows[0].authoredCluster;
  authoredRows[1].contrastKey = authoredRows[0].contrastKey;
  assert.equal(engine.validateDetectiveContentPack(duplicateContrast).ok, false, "content validation rejects duplicate contrast keys within one authored cluster");
  const orphanCluster = structuredClone(detectiveContentPack);
  const orphanRow = orphanCluster.caseTypes.find((row) => row.authoredCluster);
  orphanRow.authoredCluster = "orphan-cluster";
  assert.equal(engine.validateDetectiveContentPack(orphanCluster).ok, false, "content validation rejects authored cases without a matching event or progression line");
  const undersizedAuthoredPack = structuredClone(detectiveContentPack);
  undersizedAuthoredPack.eventArchetypes = undersizedAuthoredPack.eventArchetypes.slice(0, 9);
  const undersizedAuthoredReport = engine.validateDetectiveContentPack(undersizedAuthoredPack);
  assert.equal(undersizedAuthoredReport.errors.includes("authored campaign grammar requires at least 10 event archetypes."), true, "authored campaign grammar enforces the ten-event minimum without invalidating legacy packs that omit the optional metadata");
}

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

  const selection = engine.selectDefaultDetectiveContentAuthoringSelection(detectiveContentPack, { caseTypeId: "dock-smuggling" });
  const guide = engine.buildDetectiveContentAuthoringGuide(detectiveContentPack, draft, selection);
  assert.equal(guide.selection.caseTypeId, "dock-smuggling", "content authoring guide keeps the selected case type");
  assert.equal(guide.coverage.compatibleEvidenceTypeCount > 0, true, "content authoring guide reports compatible evidence coverage");
  assert.equal(guide.coverage.compatibleRoleCount > 0, true, "content authoring guide reports compatible role coverage");
  assert.equal(guide.coverage.compatibleResourceCount > 0, true, "content authoring guide reports compatible resource coverage");
  assert.equal(guide.coverage.compatibleFactionCount > 0, true, "content authoring guide reports compatible faction coverage");
  assert.equal(guide.coverage.compatibleEventArchetypeCount > 0, true, "content authoring guide reports compatible event coverage");
  assert.equal(guide.coverage.compatibleProgressionLineCount > 0, true, "content authoring guide reports compatible growth-line coverage");
  assert.equal(guide.selection.resourceId.length > 0, true, "content authoring guide selects a resource");
  assert.equal(guide.selection.factionId.length > 0, true, "content authoring guide selects a faction");
  assert.equal(guide.selection.eventArchetypeId.length > 0, true, "content authoring guide selects an event archetype");
  assert.equal(guide.selection.progressionLineId.length > 0, true, "content authoring guide selects a progression line");
  assert.equal(guide.preview.worldSystemLabels.length, 4, "content authoring guide previews world-system labels");
  assert.equal(guide.preview.publicCaseFile.includes("World system:"), true, "content authoring guide includes world-system context in public case file");
  assert.equal(guide.patches.some((patch) => patch.path === "caseFromLog.deductionCase.title"), true, "content authoring guide previews title patch");
  assert.equal(guide.patches.every((patch) => !/\\.id$|suspectMatrix|requiredClueOrder|criticalReasoningChain|truth\\.culpritId/.test(patch.path)), true, "content authoring guide avoids hard-logic identity paths");
  const seededDraft = guide.patches.reduce((current, patch) => engine.applyAuthoringPatch(current, { op: "set", path: patch.path, value: patch.after }), draft);
  assert.equal(seededDraft.caseFromLog.deductionCase.title, "Dock Smuggling at Dock", "content seed updates safe public title text");
  assert.equal(engine.validateAuthoringDraft(seededDraft).valid, true, "content seeded draft remains playable");
  assert.deepEqual(
    new Set(guide.patches.map((patch) => patch.group)),
    new Set(["case", "characters", "evidence", "logic"]),
    "content seed preview groups changes by authoring surface"
  );
  const runtimeHints = engine.deriveWorldSystemRuntimeHints(detectiveContentPack, { caseTypeId: "dock-smuggling" });
  const runtimeHintsAgain = engine.deriveWorldSystemRuntimeHints(detectiveContentPack, { caseTypeId: "dock-smuggling" });
  assert.deepEqual(runtimeHints, runtimeHintsAgain, "world-system runtime hints are deterministic for a content pack and case type");
  assert.equal(runtimeHints.summary.active, true, "world-system runtime hints are active for dock-smuggling");
  assert.equal(runtimeHints.source.caseTypeId, "dock-smuggling", "runtime hints retain the internal case binding used by the server loop");
  assert.equal(runtimeHints.source.progressionCaseTypeIds.includes("dock-smuggling"), true, "selected progression line remains compatible with the bound case type");
  assert.equal(Object.values(runtimeHints.caseTypeBias).every((value) => value === 1), true, "progression-compatible case preference is fixed to one point");
  assert.equal(runtimeHints.summary.actionKinds.length > 0, true, "world-system runtime hints expose action-kind bias");
  assert.equal(
    Object.values(runtimeHints.actionBias).every((value) => value > 0 && value <= 4),
    true,
    "world-system runtime action bias is bounded to four points"
  );
  assert.equal(
    /npc-|evidence-|event-|source-|culpritId|victimId|checkpoint|agent_state_snapshot/i.test(JSON.stringify(runtimeHints.summary)),
    false,
    "world-system runtime hint summary stays public-safe and aggregate-only"
  );
  const runtimeFixture = engine.createPremiumShowcaseWorld("world-system-runtime-hints");
  const runtimeActor = runtimeFixture.world.npcs.find((npc) => npc.alive) || runtimeFixture.world.npcs[0];
  const baseRuntime = engine.createPersistentTownRuntime(runtimeFixture.world, runtimeFixture.events, { maxTicks: 12 });
  const hintedRuntime = engine.createPersistentTownRuntime(runtimeFixture.world, runtimeFixture.events, { maxTicks: 12, worldSystemHints: runtimeHints });
  const baseCandidates = engine.scoreNpcActionCandidates(runtimeFixture.world, runtimeActor, runtimeFixture.events, baseRuntime);
  const hintedCandidates = engine.scoreNpcActionCandidates(runtimeFixture.world, runtimeActor, runtimeFixture.events, hintedRuntime);
  assert.equal(hintedRuntime.worldSystemHintSummary.active, true, "runtime stores the world-system hint summary");
  assert.equal(hintedCandidates.length, baseCandidates.length, "world-system hints do not add or remove action candidates");
  assert.equal(
    hintedCandidates.filter((candidate) => candidate.legal).length,
    baseCandidates.filter((candidate) => candidate.legal).length,
    "world-system hints do not change action legality"
  );
  assert.equal(
    hintedCandidates.some((candidate) => (candidate.score.worldSystemBias || 0) > 0 && candidate.score.reasons.some((reason) => reason.includes("world-system hint"))),
    true,
    "world-system hints annotate compatible action candidates with bounded scoring bias"
  );
  const influenceAudit = engine.runWorldSystemInfluenceAudit({
    seeds: ["hint-audit-unit"],
    tickCount: 20,
    contentPack: detectiveContentPack
  });
  assert.equal(influenceAudit.schemaVersion, "world-system-influence-audit.v1", "world-system influence audit uses a stable local schema");
  assert.equal(influenceAudit.ok, true, "world-system influence audit passes safety invariants");
  assert.equal(influenceAudit.aggregate.appliedBiasCount > 0, true, "world-system influence audit proves hints were applied");
  assert.equal(influenceAudit.aggregate.maxBias <= 4, true, "world-system influence audit keeps max bias bounded");
  assert.equal(influenceAudit.safety.noLegalCandidateLoss, true, "world-system influence audit does not create no-legal-candidate decisions");
  const influenceAuditAgain = engine.runWorldSystemInfluenceAudit({
    seeds: ["hint-audit-unit"],
    tickCount: 20,
    contentPack: detectiveContentPack
  });
  assert.equal(
    influenceAuditAgain.seeds[0].deterministicHash,
    influenceAudit.seeds[0].deterministicHash,
    "world-system influence audit hash is deterministic for the same config"
  );
  assert.equal(
    /npc-|evidence-|event-|source-|culpritId|victimId|checkpoint|agent_state_snapshot/i.test(JSON.stringify(influenceAudit)),
    false,
    "world-system influence audit report stays aggregate-only"
  );
  const backupTimestamp = "2026-07-04T08:00:00.000Z";
  const contentSeedBackup = engine.createContentSeedBackupEntry(draft, backupTimestamp);
  assert.equal(contentSeedBackup.id, `case-gallery:content-seed-backup:${backupTimestamp}`, "content seed backup has a dedicated stable id prefix");
  assert.equal(contentSeedBackup.title, `Before Content Seed - ${draft.caseFromLog.deductionCase.title}`, "content seed backup has a clear revert title");
  assert.equal(contentSeedBackup.source, "local", "content seed backup remains browser-local");
  assert.equal(contentSeedBackup.draft.caseFromLog.deductionCase.title, draft.caseFromLog.deductionCase.title, "content seed backup keeps the pre-apply title");
  assert.deepEqual(
    contentSeedBackup.draft.caseFromLog.deductionCase.logicPuzzle,
    draft.caseFromLog.deductionCase.logicPuzzle,
    "content seed backup keeps the complete pre-apply proof structure"
  );
  assert.deepEqual(
    seededDraft.caseFromLog.deductionCase.evidence.map((item) => item.id),
    draft.caseFromLog.deductionCase.evidence.map((item) => item.id),
    "content seed does not change evidence ids"
  );
  assert.deepEqual(
    seededDraft.caseFromLog.deductionCase.logicPuzzle.suspectMatrix,
    draft.caseFromLog.deductionCase.logicPuzzle.suspectMatrix,
    "content seed does not change the suspect matrix"
  );
  assert.deepEqual(
    seededDraft.caseFromLog.deductionCase.logicPuzzle.requiredClueOrder,
    draft.caseFromLog.deductionCase.logicPuzzle.requiredClueOrder,
    "content seed does not change clue order"
  );

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

  const seededGalleryEntry = engine.createCaseGalleryEntry(seededDraft, { source: "local", updatedAt: "2026-07-04T08:01:00.000Z" });
  const contentBundle = engine.exportCaseGalleryBundle([contentSeedBackup, seededGalleryEntry]);
  const importedContentBundle = engine.importCaseGalleryEntries(JSON.parse(contentBundle), draft);
  assert.equal(importedContentBundle.length, 2, "content-guided gallery bundle round-trips backup and applied drafts");
  assert.equal(importedContentBundle[0].title, contentSeedBackup.title, "content-guided gallery bundle preserves the backup label");
  assert.equal(importedContentBundle[0].draft.caseFromLog.deductionCase.title, draft.caseFromLog.deductionCase.title, "gallery backup restores the pre-apply title");
  assert.equal(importedContentBundle[1].draft.caseFromLog.deductionCase.title, seededDraft.caseFromLog.deductionCase.title, "gallery bundle preserves the applied title");
  assert.deepEqual(
    importedContentBundle[1].draft.caseFromLog.deductionCase.logicPuzzle.requiredClueOrder,
    draft.caseFromLog.deductionCase.logicPuzzle.requiredClueOrder,
    "content-guided gallery round-trip preserves clue order"
  );

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
