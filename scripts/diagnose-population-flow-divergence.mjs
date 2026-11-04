import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { readWorldPackageSource } from "../lib/world-package-catalog.ts";
import { loadEngineForTool } from "./load-engine-for-tools.mjs";

const arg = (name, fallback) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const packageId = arg("package", "railway-signal-yard-town");
const ticks = Number(arg("ticks", "240"));
const seed = arg("seed", `multi-package-seed-c:${packageId}`);
const suffix = arg("suffix", "current");
const assertMode = process.argv.includes("--assert");
if (!Number.isInteger(ticks) || ticks < 1 || ticks > 5000) throw new Error("ticks must be an integer from 1 to 5000");
if (!/^[a-z0-9-]+$/i.test(packageId) || !/^[a-z0-9-]+$/i.test(suffix)) throw new Error("unsafe diagnostic path");
const engine = await loadEngineForTool(`population-divergence-${packageId}-${suffix}`);
const source = readWorldPackageSource(packageId, process.cwd());
if (!source?.validation.ok || !source.validation.package) throw new Error("a validated WorldPackage is required");
const pack = source.validation.package;
const rules = engine.applyEcosystemCatalogToRuleCatalog(pack.ruleCatalog, pack.ecosystemCatalog);
const authoredIds = new Set(pack.scenarioPack.world.npcs.map((npc) => npc.id));
const execution = { steps: 1, status: "running", cloneInput: false, snapshotEveryTicks: 100, checkpointEveryTicks: 500, candidateEveryTicks: 10, actionEveryTicks: 3, indexEventLimit: 200, traceRetention: 240, reportRetention: 240 };

function createLane(enabled) {
  const { world, runtime } = engine.createWorldFromScenarioPack(pack.scenarioPack, pack.mapPack, rules, {
    branchWorldId: `campaign-fairness-${packageId}`, runId: `population-flow-campaign-fairness-${packageId}`, engineVersion: "persistent-town.v1"
  });
  engine.ensureTownRuleRuntimeState(world, runtime);
  world.seed = seed;
  runtime.maxTicks = ticks;
  runtime.caseTriggerPolicy = "source-signaled";
  runtime.populationFlowPolicy = { enabled, cadenceTicks: 5, maxResidents: authoredIds.size + 8, maxFlowsPerTick: 1, minSourceAgeTicks: 1, newcomerFirstActionWindowTicks: 24 };
  world.persistentRuntime = runtime;
  return { world, runtime, events: [] };
}

function diagnosticState(lane) {
  const { world, runtime } = lane;
  return structuredClone({
    tick: runtime.tick,
    recentActions: runtime.decisionTraces.slice(-12).map((trace) => ({ npcId: trace.npcId, kind: trace.candidates.find((candidate) => candidate.id === trace.selectedCandidateId)?.kind })),
    agents: runtime.agentStates.filter((state) => authoredIds.has(state.npcId)),
    locations: runtime.locationProfiles,
    chains: runtime.longChainLedger,
    memoryCounts: Object.fromEntries([...authoredIds].map((id) => [id, world.memories.filter((memory) => memory.npcId === id).length])),
    population: runtime.populationFlowLedger,
    candidates: runtime.candidates.map((candidate) => ({ pair: `${candidate.culpritId}->${candidate.victimId}`, valid: candidate.validation?.valid, reasons: candidate.validation?.failureReasons })),
    socialPressures: engine.computeSocialPressures(world, lane.events).filter((pressure) => authoredIds.has(pressure.npcId) || authoredIds.has(pressure.targetId))
  });
}

function step(lane) {
  const result = engine.advancePersistentTownTick(lane.world, lane.events, execution);
  lane.world = result.world;
  lane.runtime = result.runtime;
  lane.events.push(...result.events);
  return lane.runtime.decisionTraces.filter((trace) => trace.tick === lane.runtime.tick && authoredIds.has(trace.npcId));
}

const baseline = createLane(false);
const enabled = createLane(true);
let firstDecisionDifference = null;
let firstCandidateDifference = null;
const decisionKey = (traces) => JSON.stringify(traces.map((trace) => ({ npcId: trace.npcId, selected: trace.selectedCandidateId })));
for (let tick = 1; tick <= ticks; tick += 1) {
  const before = firstDecisionDifference ? null : { baseline: diagnosticState(baseline), enabled: diagnosticState(enabled) };
  const left = step(baseline);
  const right = step(enabled);
  if (!firstDecisionDifference && decisionKey(left) !== decisionKey(right)) firstDecisionDifference = { tick, before, decisions: { baseline: left, enabled: right } };
  const candidates = (lane) => lane.runtime.candidates.filter((candidate) => candidate.validation?.valid).map((candidate) => `${candidate.culpritId}->${candidate.victimId}`).sort();
  if (!firstCandidateDifference && JSON.stringify(candidates(baseline)) !== JSON.stringify(candidates(enabled))) firstCandidateDifference = { tick, baseline: candidates(baseline), enabled: candidates(enabled) };
}
const receipt = { schema: "population-flow-divergence.v1", evidenceClass: "local-world-package-diagnostic", packageId, sourceContentHash: source.contentHash, seed, ticks, execution, firstDecisionDifference, firstCandidateDifference, final: { baseline: diagnosticState(baseline), enabled: diagnosticState(enabled) } };
const outputPath = path.join(process.cwd(), "outputs", `population-flow-divergence-${packageId}-${ticks}-${suffix}.json`);
await fs.writeFile(outputPath, JSON.stringify(receipt, null, 2) + "\n");
if (assertMode) {
  assert.equal(firstDecisionDifference, null, "population flow must not change authored decision selection in the isolation window");
  assert.equal(firstCandidateDifference, null, "population flow must not change authored candidate selection in the isolation window");
}
console.log(JSON.stringify({ outputPath, firstDecisionDifferenceTick: firstDecisionDifference?.tick ?? null, firstCandidateDifference, baselineCandidates: receipt.final.baseline.candidates, enabledCandidates: receipt.final.enabled.candidates }));
