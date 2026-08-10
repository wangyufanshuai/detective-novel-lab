import assert from "node:assert/strict";
import { loadEngineForTool } from "./load-engine-for-tools.mjs";

const engine = await loadEngineForTool("v75-fairness-invariants");
const seedCount = 24;
let exercisedCandidateWorlds = 0;

function campaignContext(runtime) {
  runtime.campaignSession = {
    ...(runtime.campaignSession || {}),
    campaignId: "town-reckoning",
    status: "transition",
    targetCaseCount: 3,
    maximumCaseCount: 5,
    cycleSequence: 1,
    completedCaseIds: ["completed-case"],
    completedCycleKeys: ["completed-cycle"],
    activeCaseId: undefined,
    activeCycleKey: undefined,
    activeCaseOrdinal: undefined,
    history: []
  };
  engine.refreshCampaignSession(runtime);
}

function authorityProjection(candidates) {
  return candidates.map((candidate) => ({
    id: candidate.id,
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
  }));
}

function legalActions(world, events, runtime) {
  return world.npcs.filter((npc) => npc.alive).slice(0, 6).map((npc) => ({
    npcId: npc.id,
    actions: engine.scoreNpcActionCandidates(world, npc, events, runtime)
      .filter((candidate) => candidate.legal)
      .map((candidate) => ({ kind: candidate.kind, targetNpcId: candidate.targetNpcId, targetLocationId: candidate.targetLocationId }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
  }));
}

function pressureVariant(runtime, index) {
  runtime.worldLeadCaseHandoff = {
    status: "ready",
    focus: index % 3 === 0 ? "search" : index % 3 === 1 ? "question" : "challenge",
    label: "Bounded follow-up",
    nextAction: "Choose any legal candidate.",
    settledCaseId: `private-settled-${index}`,
    preparedAtTick: runtime.tick
  };
  runtime.worldPressurePulses = {
    items: [{
      id: `private-pressure-${index}`,
      focusKey: "bounded-focus",
      focusLabel: "Bounded pressure",
      affectedCaseLabel: "Related future patterns",
      caseTypeIds: [index % 2 === 0 ? "evidence-tampering" : "false-testimony"],
      direction: index % 4 === 0 ? "relief" : "rising",
      createdAtTick: runtime.tick,
      updatedAtTick: runtime.tick,
      layers: 1 + (index % 3),
      consumedLayers: 0
    }]
  };
  engine.prepareInvestigatorHeadquarters(runtime, { cycleKey: "completed-cycle", sourceCaseId: "completed-case" });
  engine.applyInvestigatorHeadquartersDecision(runtime, { choice: index % 3 === 0 ? "field-search" : index % 3 === 1 ? "witness-work" : "contradiction-analysis" });
  engine.activateInvestigatorHeadquarters(runtime, "future-case");
}

function caseAuthority(world, events, candidate) {
  const extracted = engine.extractPlayableCaseFromCandidate(world, events, candidate);
  const activeCase = extracted.activeCase;
  const validation = engine.validateWorldCase(extracted.world, extracted.events, activeCase.deductionCase);
  const certificate = engine.certifyPlayableCase(activeCase, extracted.events);
  const autoSolve = engine.autoSolvePlayableCase(activeCase, extracted.events);
  const evidenceIds = activeCase.deductionCase.evidence.map((item) => item.id);
  const judgement = engine.submitWorldTheory(activeCase.deductionCase, {
    culpritId: activeCase.deductionCase.truth.culpritId,
    motive: activeCase.deductionCase.truth.motive,
    method: activeCase.deductionCase.truth.method,
    evidenceIds
  }, evidenceIds);
  return {
    truth: activeCase.deductionCase.truth,
    evidence: activeCase.deductionCase.evidence,
    testimonies: activeCase.testimonies,
    validation: { valid: validation.valid, errors: validation.errors, hardLogicValid: activeCase.qualityReport.hardLogicValid, evidenceCoverage: activeCase.qualityReport.evidenceCoverage },
    certificate: { routeCertified: certificate.routeCertified, steps: certificate.steps, blockers: certificate.blockers },
    autoSolve: { passed: autoSolve.passed, proofCoverageComplete: autoSolve.summary.proofCoverageComplete, covered: autoSolve.summary.coveredRequiredObligations, total: autoSolve.summary.totalRequiredObligations },
    judgement: { accepted: judgement.accepted, reason: judgement.reason }
  };
}

function advanceUntilValid(world, events, runtime) {
  let currentWorld = world;
  let currentEvents = [...events];
  let currentRuntime = runtime;
  let queue = engine.buildTownEmergenceQueue(currentWorld, currentEvents, currentRuntime);
  for (let attempt = 0; attempt < 24 && !queue.candidates.some((item) => item.validation.valid); attempt += 1) {
    const advanced = engine.advancePersistentTownTick(currentWorld, currentEvents, { steps: 8, status: "running", actionEveryTicks: 2 });
    currentWorld = advanced.world;
    currentEvents = [...currentEvents, ...advanced.events];
    currentRuntime = advanced.runtime;
    queue = advanced.queue;
  }
  return { world: currentWorld, events: currentEvents, runtime: currentRuntime, queue };
}

for (let index = 0; index < seedCount; index += 1) {
  const seed = `v75-fairness-${String(index).padStart(2, "0")}`;
  const initial = engine.createInitialWorld(seed, { mode: "showcase", npcCount: 12, timelineHours: 24 });
  const daily = engine.simulateDailyLife(initial, 1, []);
  const baseWorld = structuredClone(daily.world);
  const baseRuntime = engine.createPersistentTownRuntime(baseWorld, daily.events, { maxTicks: 240 });
  const variantWorld = structuredClone(daily.world);
  const variantRuntime = engine.createPersistentTownRuntime(variantWorld, daily.events, { maxTicks: 240 });
  campaignContext(baseRuntime);
  campaignContext(variantRuntime);
  pressureVariant(variantRuntime, index);
  baseWorld.persistentRuntime = baseRuntime;
  variantWorld.persistentRuntime = variantRuntime;

  const baseReady = advanceUntilValid(baseWorld, daily.events, baseRuntime);
  const variantReady = advanceUntilValid(variantWorld, daily.events, variantRuntime);
  const baseQueue = baseReady.queue;
  const variantQueue = variantReady.queue;
  assert.deepEqual(
    variantQueue.candidates.map((candidate) => candidate.id).sort(),
    baseQueue.candidates.map((candidate) => candidate.id).sort(),
    `${seed}: Headquarters and cross-case pressure preserve candidate membership`
  );
  assert.deepEqual(
    Object.fromEntries(authorityProjection(variantQueue.candidates).map((item) => [item.id, item])),
    Object.fromEntries(authorityProjection(baseQueue.candidates).map((item) => [item.id, item])),
    `${seed}: cross-case systems preserve candidate authority fields`
  );
  assert.deepEqual(legalActions(variantReady.world, variantReady.events, variantReady.runtime), legalActions(baseReady.world, baseReady.events, baseReady.runtime), `${seed}: cross-case systems preserve NPC legal actions`);
  const candidate = baseQueue.candidates.find((item) => item.validation.valid);
  if (!candidate) continue;
  exercisedCandidateWorlds += 1;
  const baselineCase = caseAuthority(baseReady.world, baseReady.events, candidate);
  const variantCandidate = variantQueue.candidates.find((item) => item.id === candidate.id);
  assert.ok(variantCandidate, `${seed}: variant retains the compared candidate`);
  const variantCase = caseAuthority(variantReady.world, variantReady.events, variantCandidate);
  assert.deepEqual(variantCase, baselineCase, `${seed}: Headquarters and pressure preserve truth, coverage, certificate, and judgement`);

  const rerunWorld = engine.createInitialWorld(seed, { mode: "showcase", npcCount: 12, timelineHours: 24 });
  const rerunDaily = engine.simulateDailyLife(rerunWorld, 1, []);
  const rerunRuntime = engine.createPersistentTownRuntime(rerunDaily.world, rerunDaily.events, { maxTicks: 240 });
  campaignContext(rerunRuntime);
  const rerunReady = advanceUntilValid(rerunDaily.world, rerunDaily.events, rerunRuntime);
  const rerunQueue = rerunReady.queue;
  assert.deepEqual(authorityProjection(rerunQueue.candidates), authorityProjection(baseQueue.candidates), `${seed}: same seed produces deterministic candidate authority and order`);
}

assert.ok(exercisedCandidateWorlds >= 20, `property sweep exercised ${exercisedCandidateWorlds}/${seedCount} candidate worlds`);
console.log(JSON.stringify({
  ok: true,
  suite: "v75-fairness-invariants",
  seedCount,
  exercisedCandidateWorlds,
  invariants: ["candidate-membership", "candidate-authority", "truth", "evidence-coverage", "route-certificate", "judgement", "npc-legal-actions", "same-seed-determinism", "headquarters-isolation", "cross-case-pressure-isolation"]
}));
