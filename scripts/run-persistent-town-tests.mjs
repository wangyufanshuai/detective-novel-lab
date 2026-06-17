import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import ts from "typescript";

const root = process.cwd();
const outDir = path.join(root, "outputs");
const sourceDir = path.join(root, "packages", "engine", "src");
const runtimeDir = path.join(outDir, "persistent-town-test-runtime");

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
  const world = engine.createInitialWorld("persistent-seed", { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const daily = engine.simulateDailyLife(world, 1, []);
  const runtime = engine.createPersistentTownRuntime(daily.world, daily.events, { maxTicks: 48 });
  assert.equal(runtime.status, "paused", "runtime starts paused");
  assert.equal(runtime.agentStates.length, 8, "runtime creates one agent state per living NPC");
  assert.equal(runtime.agentStates.every((agent) => agent.currentGoal && agent.currentPlan.length), true, "agents have goals and plans");
  assert.equal(runtime.agentStates.every((agent) => Number.isFinite(agent.secretRisk) && Number.isFinite(agent.alertness)), true, "agents have risk and alertness");
}

{
  const baseWorld = engine.createInitialWorld("deterministic-persistent", { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const dailyA = engine.simulateDailyLife(baseWorld, 1, []);
  const dailyB = engine.simulateDailyLife(engine.createInitialWorld("deterministic-persistent", { mode: "showcase", npcCount: 8, timelineHours: 24 }), 1, []);
  const runA = engine.advancePersistentTownTick(dailyA.world, dailyA.events, { steps: 6, status: "running" });
  const runB = engine.advancePersistentTownTick(dailyB.world, dailyB.events, { steps: 6, status: "running" });
  assert.deepEqual(
    runA.events.map((event) => [event.id, event.type, event.actorIds.join(","), event.locationId]),
    runB.events.map((event) => [event.id, event.type, event.actorIds.join(","), event.locationId]),
    "persistent town ticks are deterministic for the same seed"
  );
  assert.equal(runA.runtime.decisionTraces.length > 0, true, "ticks produce decision traces");
  assert.equal(runA.runtime.decisionTraces.every((trace) => trace.candidates.length >= 3), true, "each trace includes action candidates");
  assert.equal(
    runA.runtime.decisionTraces.every((trace) => trace.candidates.every((candidate) => ["goalPriority", "knownInformation", "relationshipPressure", "resourceAvailability", "locationReachability", "risk", "evidenceConsistency", "caseImpact"].every((field) => Number.isFinite(candidate.score[field])))),
    true,
    "candidate score fields are complete"
  );
  assert.equal(
    runA.runtime.decisionTraces.every((trace) => trace.candidates.every((candidate) => ["witnessExposure", "rumorValue", "alibiPressure", "coverUpUrgency"].every((field) => Number.isFinite(candidate.score[field] ?? 0)))),
    true,
    "core simulation score fields are complete"
  );
  assert.equal(runA.runtime.pressureLedger.length > 0, true, "ticks record a pressure ledger");
  assert.equal(runA.runtime.consequences.length > 0, true, "ticks record action consequences");
  assert.equal(runA.runtime.decisionTraces.every((trace) => trace.phases?.includes("candidate-extraction") && trace.consequence), true, "decision traces include phase and consequence data");
}

{
  const world = engine.createInitialWorld("simulation-depth-persistent", { mode: "advanced", npcCount: 12, timelineHours: 72 });
  const daily = engine.simulateDailyLife(world, 3, []);
  const run = engine.advancePersistentTownTick(daily.world, daily.events, { steps: 14, status: "running" });
  const selectedKinds = new Set(run.runtime.decisionTraces.map((trace) => trace.candidates.find((candidate) => candidate.id === trace.selectedCandidateId)?.kind).filter(Boolean));
  const newKinds = ["investigate", "spread-rumor", "seek-alibi", "pressure", "cover-up"].filter((kind) => selectedKinds.has(kind));
  assert.equal(newKinds.length >= 3, true, "runtime selects diverse core simulation actions");
  assert.equal(run.runtime.memoryPropagations.length > 0, true, "runtime propagates memories beyond direct participants");
  assert.equal(run.runtime.agentStates.some((agent) => (agent.propagatedMemoryCount || 0) > 0 || agent.lastConsequence), true, "agent state reflects propagation or consequence updates");
  assert.equal(run.runtime.consequences.some((item) => item.chainStage === "cover-up" || item.chainStage === "memory" || item.chainStage === "alibi"), true, "consequences record case-chain stages");
}

{
  const world = engine.createInitialWorld("candidate-persistent", { mode: "advanced", npcCount: 12, timelineHours: 72 });
  const daily = engine.simulateDailyLife(world, 3, []);
  const run = engine.advancePersistentTownTick(daily.world, daily.events, { steps: 10, status: "running" });
  const queue = engine.buildTownEmergenceQueue(run.world, [...daily.events, ...run.events], run.runtime);
  assert.equal(queue.candidates.length > 0, true, "emergence queue produces candidates");
  assert.equal(queue.candidates.every((candidate) => candidate.riskChainEventIds.length > 0), true, "candidates trace risk chain events");
  assert.equal(queue.candidates.every((candidate) => candidate.validation.errors.length || candidate.validation.valid), true, "invalid candidates explain failure");
  assert.equal(queue.candidates.some((candidate) => (candidate.chainStageTags || []).length >= 2), true, "candidates expose multi-stage risk chains");
  assert.equal(queue.candidates.every((candidate) => Array.isArray(candidate.validation.failureReasons)), true, "candidate validation exposes failure reasons");
  const selected = queue.candidates.find((candidate) => candidate.validation.valid) || queue.candidates[0];
  const validation = engine.validateCaseCandidate(run.world, [...daily.events, ...run.events], selected);
  assert.deepEqual(validation.errors, selected.validation.errors, "candidate validation is stable");
}

{
  const world = engine.createInitialWorld("long-chain-trigger-persistent", { mode: "advanced", npcCount: 20, timelineHours: 72 });
  const daily = engine.simulateDailyLife(world, 3, []);
  const runA = engine.advancePersistentTownTick(daily.world, daily.events, { steps: 45, status: "running" });
  const dailyB = engine.simulateDailyLife(engine.createInitialWorld("long-chain-trigger-persistent", { mode: "advanced", npcCount: 20, timelineHours: 72 }), 3, []);
  const runB = engine.advancePersistentTownTick(dailyB.world, dailyB.events, { steps: 45, status: "running" });
  assert.equal(runA.runtime.triggeredCases.length > 0, true, "30-60 ticks trigger at least one real simulated case event");
  assert.deepEqual(
    runA.runtime.triggeredCases.map((item) => [item.eventId, item.culpritId, item.victimId, item.maturityScore]),
    runB.runtime.triggeredCases.map((item) => [item.eventId, item.culpritId, item.victimId, item.maturityScore]),
    "long-chain triggered cases are deterministic"
  );
  const triggerEvent = runA.events.find((event) => event.id === runA.runtime.triggeredCases[0].eventId);
  assert.equal(triggerEvent.type, "death", "mature long chain writes a real death event");
  assert.equal(triggerEvent.causedByEventIds.length >= 6, true, "triggered case event points back to six-stage causes");
  const queue = engine.buildTownEmergenceQueue(runA.world, [...daily.events, ...runA.events], runA.runtime);
  const mature = queue.candidates.find((candidate) => candidate.triggeredEventId);
  assert.equal(mature.validation.valid, true, "triggered candidates pass six-stage validation");
  assert.equal(Object.values(mature.chainCompleteness).every(Boolean), true, "triggered candidate exposes complete six-stage chain");
  assert.equal(mature.validation.memoryConfidence.supportScore >= 55, true, "triggered candidate has weighted memory support");
}

{
  const world = engine.createInitialWorld("extract-persistent", { mode: "advanced", npcCount: 20, timelineHours: 72 });
  const daily = engine.simulateDailyLife(world, 3, []);
  const run = engine.advancePersistentTownTick(daily.world, daily.events, { steps: 45, status: "running" });
  const allEvents = [...daily.events, ...run.events];
  const queue = engine.buildTownEmergenceQueue(run.world, allEvents, run.runtime);
  const selected = queue.candidates.find((candidate) => candidate.validation.valid) || queue.candidates[0];
  assert.ok(selected.triggeredEventId, "extraction prefers a candidate backed by a real triggered case event");
  const extracted = engine.extractPlayableCaseFromCandidate(run.world, allEvents, selected);
  assert.equal(extracted.activeCase.validation.valid, true, "extracted playable case passes existing world validation");
  assert.equal(extracted.activeCase.qualityReport.uniqueCulprit, true, "extracted playable case has unique culprit");
  assert.equal(extracted.activeCase.qualityReport.worldBackedEvidence, true, "extracted playable case has event-backed evidence");
  assert.equal(extracted.candidate.validation.hardLogicValid, true, "candidate records hard logic pass after extraction");
  assert.equal(extracted.activeCase.triggeredEventId, selected.triggeredEventId, "extracted case records the real triggered event id");
  assert.equal(extracted.activeCase.sourceCandidateId, selected.id, "extracted case records the source candidate id");
  assert.equal(extracted.events.filter((event) => event.type === "death").length, 1, "triggered extraction view contains exactly one death event");
  assert.equal(extracted.events.every((event) => event.id.startsWith("caseview-")), true, "triggered extraction uses a selected-case view");
  for (const evidenceId of ["ev-motive", "ev-means", "ev-opportunity", "ev-staging", "ev-trace", "ev-town-rollcall"]) {
    assert.equal((extracted.activeCase.sourceMap.evidenceSourceEventIds?.[evidenceId] || []).length > 0, true, `${evidenceId} maps back to real persistent town source events`);
  }
  const originalStageSources = Object.values(extracted.activeCase.sourceMap.chainStageSourceEventIds || {}).flat();
  assert.equal(originalStageSources.some((eventId) => allEvents.some((event) => event.id === eventId)), true, "chain stage source map references original runtime events");
  assert.equal((extracted.activeCase.sourceMap.memorySourceIds || []).length > 0, true, "extracted case records memory sources from the selected chain");
  assert.equal(extracted.activeCase.deductionCase.logicPuzzle.exclusionChains.every((chain) => chain.evidenceIds.length > 0), true, "all non-culprit exclusions keep evidence ids");
}

{
  const world = engine.createInitialWorld("intervention-persistent", { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const daily = engine.simulateDailyLife(world, 1, []);
  const run = engine.advancePersistentTownTick(daily.world, daily.events, { steps: 2, status: "running" });
  const actorId = run.runtime.agentStates[0].npcId;
  const intervened = engine.applyTownRuntimeIntervention(run.world, {
    actorId,
    kind: "resource",
    value: "resource:test-key"
  });
  assert.equal(intervened.intervention.branch, "counterfactual", "interventions are counterfactual branches");
  assert.equal(intervened.runtime.agentStates.find((agent) => agent.npcId === actorId).resources.includes("resource:test-key"), true, "resource intervention changes agent state");
  const after = engine.advancePersistentTownTick(intervened.world, [...daily.events, ...run.events], { steps: 1, status: "running" });
  assert.equal(after.runtime.interventions.length, 1, "intervention persists after next tick");
  assert.equal(run.runtime.interventions.length, 0, "original runtime object is not mutated by intervention result");
}

{
  const world = engine.createInitialWorld("action-bias-persistent", { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const daily = engine.simulateDailyLife(world, 1, []);
  const actorId = daily.world.npcs[0].id;
  daily.world.npcs = daily.world.npcs.map((npc, index) => ({ ...npc, alive: index === 0 }));
  const runtime = engine.createPersistentTownRuntime(daily.world, daily.events, { maxTicks: 8 });
  daily.world.persistentRuntime = runtime;
  const biased = engine.applyTownRuntimeIntervention(daily.world, {
    actorId,
    kind: "action-bias",
    value: "investigate"
  });
  const biasedScores = engine.scoreNpcActionCandidates(biased.world, biased.world.npcs[0], daily.events, biased.runtime);
  const investigate = biasedScores.find((candidate) => candidate.kind === "investigate");
  assert.equal(investigate.score.directorBias, 18, "action bias is visible in candidate scoring");
  const after = engine.advancePersistentTownTick(biased.world, daily.events, { steps: 1, status: "running" });
  const trace = after.runtime.decisionTraces.find((item) => item.npcId === actorId);
  const selected = trace.candidates.find((candidate) => candidate.id === trace.selectedCandidateId);
  assert.equal(selected.kind, "investigate", "action bias affects the next legal selected action");
  assert.ok(trace.interventionId, "biased decision records the intervention id");
  const afterExpiry = engine.scoreNpcActionCandidates(after.world, after.world.npcs[0], [...daily.events, ...after.events], after.runtime);
  assert.equal(afterExpiry.find((candidate) => candidate.kind === "investigate").score.directorBias, 18, "bias remains inspectable on the applied tick");
  const expired = engine.advancePersistentTownTick(after.world, [...daily.events, ...after.events], { steps: 1, status: "running" });
  const expiredScores = engine.scoreNpcActionCandidates(expired.world, expired.world.npcs[0], [...daily.events, ...after.events, ...expired.events], expired.runtime);
  assert.equal(expiredScores.some((candidate) => candidate.score.directorBias), false, "action bias expires after one selected tick");
}

{
  const world = engine.createInitialWorld("scenario-persistent", { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const daily = engine.simulateDailyLife(world, 1, []);
  const actorId = daily.world.npcs[0].id;
  const scenarioA = engine.runTownScenario(daily.world, daily.events, {
    id: "scenario-deterministic",
    seed: "scenario-persistent-fixed",
    baselineSteps: 4,
    branches: [{
      id: "resource-branch",
      name: "Resource branch",
      steps: 4,
      interventions: [{ atTickOffset: 1, intervention: { actorId, kind: "resource", value: "resource:scenario-test" } }]
    }],
    passCriteria: { minEventGrowth: 1, minMemoryGrowth: 1, maxBlockedCandidates: 8 }
  });
  const worldB = engine.createInitialWorld("scenario-persistent", { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const dailyB = engine.simulateDailyLife(worldB, 1, []);
  const scenarioB = engine.runTownScenario(dailyB.world, dailyB.events, {
    id: "scenario-deterministic",
    seed: "scenario-persistent-fixed",
    baselineSteps: 4,
    branches: [{
      id: "resource-branch",
      name: "Resource branch",
      steps: 4,
      interventions: [{ atTickOffset: 1, intervention: { actorId, kind: "resource", value: "resource:scenario-test" } }]
    }],
    passCriteria: { minEventGrowth: 1, minMemoryGrowth: 1, maxBlockedCandidates: 8 }
  });
  assert.equal(scenarioA.report.passed, true, "scenario report passes configured criteria");
  assert.equal(scenarioA.report.branches.length, 1, "scenario includes a counterfactual branch");
  assert.equal(scenarioA.report.branches[0].diffFromBaseline.branchOnlyInterventionIds.length > 0, true, "branch diff tracks counterfactual interventions");
  assert.equal(scenarioA.report.baseline.eventGrowth, scenarioB.report.baseline.eventGrowth, "scenario baseline event growth is deterministic");
  assert.equal(scenarioA.runtime.scenarioRuns.length, 1, "scenario run is stored on runtime");
  assert.equal(scenarioA.runtime.snapshots.length >= 4, true, "scenario stores baseline and branch snapshots");
}

{
  const world = engine.createInitialWorld("snapshot-persistent", { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const daily = engine.simulateDailyLife(world, 1, []);
  const run = engine.advancePersistentTownTick(daily.world, daily.events, { steps: 2, status: "running" });
  const start = engine.createTownStateSnapshot(daily.world, daily.events, { id: "snapshot-start", label: "Start" });
  const end = engine.createTownStateSnapshot(run.world, [...daily.events, ...run.events], { id: "snapshot-end", label: "End" });
  const diff = engine.diffTownStateSnapshots(start, end);
  assert.equal(diff.addedEventIds.length >= 1, true, "snapshot diff reports added events");
  assert.equal(diff.addedMemoryIds.length >= 1, true, "snapshot diff reports added memories");
  assert.equal(diff.changedAgents.length >= 1, true, "snapshot diff reports changed agents");
  const runtime = run.world.persistentRuntime;
  runtime.snapshots = [start, end];
  run.world.persistentRuntime = runtime;
  const restored = engine.rollbackTownRuntimeToSnapshot(run.world, start);
  assert.equal(restored.runtime.tick, start.tick, "rollback restores runtime tick");
  assert.deepEqual(restored.runtime.agentStates.map((agent) => agent.locationId), start.agentStates.map((agent) => agent.locationId), "rollback restores agent locations");
}

console.log("Persistent town tests passed.");
