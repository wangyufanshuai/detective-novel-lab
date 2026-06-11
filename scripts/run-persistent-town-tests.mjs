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
}

{
  const world = engine.createInitialWorld("candidate-persistent", { mode: "advanced", npcCount: 12, timelineHours: 72 });
  const daily = engine.simulateDailyLife(world, 3, []);
  const run = engine.advancePersistentTownTick(daily.world, daily.events, { steps: 10, status: "running" });
  const queue = engine.buildTownEmergenceQueue(run.world, [...daily.events, ...run.events], run.runtime);
  assert.equal(queue.candidates.length > 0, true, "emergence queue produces candidates");
  assert.equal(queue.candidates.every((candidate) => candidate.riskChainEventIds.length > 0), true, "candidates trace risk chain events");
  assert.equal(queue.candidates.every((candidate) => candidate.validation.errors.length || candidate.validation.valid), true, "invalid candidates explain failure");
  const selected = queue.candidates.find((candidate) => candidate.validation.valid) || queue.candidates[0];
  const validation = engine.validateCaseCandidate(run.world, [...daily.events, ...run.events], selected);
  assert.deepEqual(validation.errors, selected.validation.errors, "candidate validation is stable");
}

{
  const world = engine.createInitialWorld("extract-persistent", { mode: "advanced", npcCount: 12, timelineHours: 72 });
  const daily = engine.simulateDailyLife(world, 3, []);
  const run = engine.advancePersistentTownTick(daily.world, daily.events, { steps: 10, status: "running" });
  const allEvents = [...daily.events, ...run.events];
  const queue = engine.buildTownEmergenceQueue(run.world, allEvents, run.runtime);
  const selected = queue.candidates.find((candidate) => candidate.validation.valid) || queue.candidates[0];
  const extracted = engine.extractPlayableCaseFromCandidate(run.world, allEvents, selected);
  assert.equal(extracted.activeCase.validation.valid, true, "extracted playable case passes existing world validation");
  assert.equal(extracted.activeCase.qualityReport.uniqueCulprit, true, "extracted playable case has unique culprit");
  assert.equal(extracted.activeCase.qualityReport.worldBackedEvidence, true, "extracted playable case has event-backed evidence");
  assert.equal(extracted.candidate.validation.hardLogicValid, true, "candidate records hard logic pass after extraction");
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

console.log("Persistent town tests passed.");
