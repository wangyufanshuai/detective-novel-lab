import assert from "node:assert/strict";
import { loadEngineForTool } from "./load-engine-for-tools.mjs";

const engine = await loadEngineForTool("world-invariant-properties");
const seedCount = 20;
let candidateWorldCount = 0;

function authorityProjection(candidates) {
  return Object.fromEntries(candidates.map((candidate) => [candidate.id, {
    caseType: candidate.caseType,
    culpritId: candidate.culpritId,
    victimId: candidate.victimId,
    valid: candidate.validation.valid,
    hardLogicValid: candidate.validation.hardLogicValid,
    uniqueCulprit: candidate.validation.uniqueCulprit,
    worldBackedEvidence: candidate.validation.worldBackedEvidence,
    routeCertificate: candidate.validation.routeCertificate,
    evidenceChain: candidate.validation.evidenceChain,
    chainCompleteness: candidate.validation.chainCompleteness || candidate.chainCompleteness
  }]));
}

for (let index = 0; index < seedCount; index += 1) {
  const seed = `influence-property-${String(index).padStart(2, "0")}`;
  const world = engine.createInitialWorld(seed, { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const daily = engine.simulateDailyLife(world, 1, []);
  const runtime = engine.createPersistentTownRuntime(daily.world, daily.events, { maxTicks: 48 });
  const neutralRuntime = structuredClone(runtime);
  const influencedRuntime = structuredClone(runtime);
  influencedRuntime.worldLeadCaseHandoff = {
    status: "ready",
    focus: index % 3 === 0 ? "search" : index % 3 === 1 ? "question" : "challenge",
    directionLabel: "Bounded follow-up",
    preparedAtTick: runtime.tick,
    settledCaseId: `private-source-${index}`
  };
  influencedRuntime.worldPressurePulses = {
    items: [{
      id: `private-pulse-${index}`,
      focusKey: "generated-pressure",
      focusLabel: "Generated pressure",
      affectedCaseLabel: "Related case patterns",
      caseTypeIds: [index % 2 === 0 ? "evidence-tampering" : "false-testimony"],
      direction: index % 4 === 0 ? "relief" : "rising",
      createdAtTick: runtime.tick,
      updatedAtTick: runtime.tick,
      layers: 1 + (index % 3),
      consumedLayers: 0
    }]
  };
  const worldBefore = JSON.stringify(daily.world);
  const neutral = engine.buildTownEmergenceQueue(daily.world, daily.events, neutralRuntime).candidates;
  const influenced = engine.buildTownEmergenceQueue(daily.world, daily.events, influencedRuntime).candidates;
  assert.equal(JSON.stringify(daily.world), worldBefore, `${seed}: candidate influence does not mutate the world`);
  if (!neutral.length) continue;
  candidateWorldCount += 1;
  assert.deepEqual(
    influenced.map((candidate) => candidate.id).sort(),
    neutral.map((candidate) => candidate.id).sort(),
    `${seed}: bounded influence preserves candidate membership`
  );
  assert.deepEqual(authorityProjection(influenced), authorityProjection(neutral), `${seed}: influence preserves candidate authority fields`);

  for (const npc of daily.world.npcs.filter((item) => item.alive).slice(0, 4)) {
    const neutralActions = engine.scoreNpcActionCandidates(daily.world, npc, daily.events, neutralRuntime)
      .filter((candidate) => candidate.legal)
      .map((candidate) => candidate.kind)
      .sort();
    const influencedActions = engine.scoreNpcActionCandidates(daily.world, npc, daily.events, influencedRuntime)
      .filter((candidate) => candidate.legal)
      .map((candidate) => candidate.kind)
      .sort();
    assert.deepEqual(influencedActions, neutralActions, `${seed}: influence preserves ${npc.id} legal action membership`);
  }

  for (const caseType of ["evidence-tampering", "false-testimony", "court-intimidation", "murder"]) {
    const before = JSON.stringify(influencedRuntime);
    const first = engine.deriveCandidateInfluenceLedger(influencedRuntime, caseType);
    const second = engine.deriveCandidateInfluenceLedger(influencedRuntime, caseType);
    assert.deepEqual(first, second, `${seed}: influence ledger is deterministic for ${caseType}`);
    assert.equal(Math.abs(first.total) <= 3, true, `${seed}: influence ledger stays inside the ±3 budget`);
    assert.equal(JSON.stringify(influencedRuntime), before, `${seed}: influence ledger reads are pure`);
  }
}

assert.equal(candidateWorldCount > 0, true, "generated property sweep must exercise at least one candidate world");
console.log(JSON.stringify({ ok: true, seedCount, candidateWorldCount, invariants: ["membership", "authority", "legal-actions", "determinism", "bounded-budget", "read-purity"] }));
