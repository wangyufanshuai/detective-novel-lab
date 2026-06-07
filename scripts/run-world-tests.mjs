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

console.log("World simulation tests passed.");
