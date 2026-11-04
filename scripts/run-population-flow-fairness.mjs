import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { loadEngineForTool } from "./load-engine-for-tools.mjs";

const engine = await loadEngineForTool("population-flow-fairness");
const root = process.cwd();

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const ticks = Math.max(100, Math.floor(Number(argValue("ticks", "1000"))));
const seed = argValue("seed", "population-flow-fairness");
const maxResidents = Math.max(12, Math.floor(Number(argValue("max-residents", "18"))));
const longRun = ticks >= 5000;

function sourceEvents(world) {
  return Array.from({ length: 3 }, (_, index) => ({
    id: `population-fairness-source-${index + 1}`,
    worldId: world.id,
    day: 1,
    time: `${String(8 + index).padStart(2, "0")}:00`,
    type: "incident",
    actorIds: [world.npcs[index].id, world.npcs[index + 1].id],
    locationId: world.locations[index % world.locations.length].id,
    summary: `Synthetic source fixture ${index + 1} is explicit and replay-addressable.`,
    publicSummary: `A source fixture ${index + 1} leaves a trace.`,
    hidden: false,
    relatedCharacterIds: [world.npcs[index].id, world.npcs[index + 1].id],
    tags: ["population_source", "source_backed"],
    causedByEventIds: []
  }));
}

function makeState(enabled) {
  const world = engine.createInitialWorld(seed, { mode: "advanced", npcCount: 10, timelineHours: Math.max(72, Math.ceil(ticks / 2)) });
  world.id = "world-population-fairness";
  const events = sourceEvents(world);
  const runtime = engine.createPersistentTownRuntime(world, events, {
    maxTicks: ticks,
    caseTriggerPolicy: "source-signaled",
    now: "2040-01-01T00:00:00.000Z"
  });
  runtime.maxTicks = ticks;
  runtime.populationFlowPolicy = {
    enabled,
    cadenceTicks: 5,
    maxResidents,
    maxFlowsPerTick: 1,
    minSourceAgeTicks: 1
  };
  world.persistentRuntime = runtime;
  return { world, runtime, events };
}

function edgeCount(world) {
  return world.npcs.reduce((sum, npc) => sum + Object.keys(npc.relationships || {}).length, 0);
}

function run(enabled) {
  let state = makeState(enabled);
  const startedAt = performance.now();
  while (state.runtime.tick < ticks) {
    const advanced = engine.advancePersistentTownTick(state.world, state.events, {
      steps: Math.min(60, ticks - state.runtime.tick),
      status: "running",
      cloneInput: false,
      snapshotEveryTicks: longRun ? 100 : 1000000,
      checkpointEveryTicks: longRun ? 500 : 1000000,
      candidateEveryTicks: longRun ? 10 : undefined,
      actionEveryTicks: longRun ? 3 : undefined,
      indexEventLimit: longRun ? 200 : undefined,
      traceRetention: 240,
      reportRetention: 240
    });
    state = {
      world: advanced.world,
      runtime: advanced.runtime,
      events: [...state.events, ...advanced.events]
    };
  }
  const digest = engine.buildWorldReplayDigest(state.world, state.events, state.runtime);
  const records = state.runtime.populationFlowLedger || [];
  const arrivalIds = records.map((record) => record.arrivalEventId);
  const sourceIds = records.map((record) => record.sourceEventId);
  const structural = {
    duplicateNewcomerIds: state.world.npcs.length - new Set(state.world.npcs.map((npc) => npc.id)).size,
    duplicateArrivalIds: arrivalIds.length - new Set(arrivalIds).size,
    duplicateSourceIds: sourceIds.length - new Set(sourceIds).size,
    missingSourceEvents: records.filter((record) => !state.events.some((event) => event.id === record.sourceEventId)).length,
    missingArrivalEvents: records.filter((record) => !state.events.some((event) => event.id === record.arrivalEventId)).length,
    overResidentCap: state.world.npcs.filter((npc) => npc.alive !== false).length > maxResidents
  };
  return {
    enabled,
    ticks,
    runtimeMs: Math.round(performance.now() - startedAt),
    population: state.world.npcs.filter((npc) => npc.alive !== false).length,
    authoredPopulation: 10,
    newcomerCount: records.length,
    eventCount: state.events.length,
    memoryCount: state.world.memories.length,
    relationshipEdges: edgeCount(state.world),
    triggeredCaseCount: state.runtime.triggeredCases?.length || 0,
    fatalCaseCount: (state.runtime.triggeredCases || []).filter((item) => item.kind === "fatal").length,
    nonfatalCaseCount: (state.runtime.triggeredCases || []).filter((item) => item.kind === "nonfatal_incident").length,
    validCandidateCount: state.runtime.candidates.filter((candidate) => candidate.validation.valid).length,
    digest: digest.combinedDigest,
    structural
  };
}

const baseline = run(false);
if (typeof global.gc === "function") global.gc();
const enabled = run(true);
if (typeof global.gc === "function") global.gc();
const repeat = run(true);
const receipt = {
  schema: "population-flow-fairness.v1",
  evidenceClass: "local-synthetic-source-fixture",
  status: "candidate",
  generatedAt: new Date().toISOString(),
  seed,
  ticks,
  policy: { cadenceTicks: 5, maxResidents, maxFlowsPerTick: 1, minSourceAgeTicks: 1 },
  execution: {
    longRunBoundedIndex: longRun,
    indexEventLimit: longRun ? 200 : null,
    candidateEveryTicks: longRun ? 10 : 1,
    actionEveryTicks: longRun ? 3 : 1,
    snapshotEveryTicks: longRun ? 100 : null,
    checkpointEveryTicks: longRun ? 500 : null
  },
  baseline,
  enabled,
  deterministicRepeat: repeat.digest === enabled.digest,
  structuralPass: Object.values(enabled.structural).every((value) => value === 0 || value === false)
};
const outputPath = path.join(root, "outputs", `population-flow-fairness-${ticks}.json`);
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...receipt, outputPath }, null, 2));
