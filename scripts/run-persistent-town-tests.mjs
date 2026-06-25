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
  assert.equal(runtime.socialProfiles.length, 8, "runtime creates one social profile per NPC");
  assert.equal(runtime.locationProfiles.length, world.locations.length, "runtime creates one location profile per location");
  assert.equal(runtime.agentStates.every((agent) => agent.socialProfile?.dominantTrait), true, "agent states expose social profile summaries");
  assert.equal(runtime.socialProfiles.every((profile) => profile.preferredActionKinds.length > 0 && Number.isFinite(profile.reputation) && Number.isFinite(profile.suspicion)), true, "social profiles expose traits, reputation and suspicion");
  assert.equal(runtime.locationProfiles.every((profile) => Number.isFinite(profile.heat) && Number.isFinite(profile.security) && profile.factionInfluence), true, "location profiles expose heat, security and influence");
  assert.equal(runtime.agentStates.every((agent) => agent.currentGoal && agent.currentPlan.length), true, "agents have goals and plans");
  assert.equal(runtime.agentStates.every((agent) => Number.isFinite(agent.secretRisk) && Number.isFinite(agent.alertness)), true, "agents have risk and alertness");
  const actionKinds = new Set(engine.getTownActionDefinitions().map((definition) => definition.kind));
  for (const kind of ["move", "observe", "talk", "confront", "obtain-resource", "hide-trace", "investigate", "spread-rumor", "seek-alibi", "pressure", "cover-up"]) {
    assert.equal(actionKinds.has(kind), true, `action registry covers ${kind}`);
  }
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
  assert.equal(runA.runtime.eventObservations.length > 0, true, "ticks produce event observations");
  assert.deepEqual(
    runA.runtime.eventObservations.map((observation) => [observation.id, observation.eventId, observation.observerNpcId, observation.kind, observation.memoryId || ""]),
    runB.runtime.eventObservations.map((observation) => [observation.id, observation.eventId, observation.observerNpcId, observation.kind, observation.memoryId || ""]),
    "event observations are deterministic"
  );
  assert.equal(runA.runtime.decisionTraces.every((trace) => trace.candidates.length >= 3), true, "each trace includes action candidates");
  assert.equal(
    runA.runtime.decisionTraces.every((trace) => trace.candidates.every((candidate) => ["goalPriority", "knownInformation", "relationshipPressure", "resourceAvailability", "locationReachability", "risk", "evidenceConsistency", "caseImpact"].every((field) => Number.isFinite(candidate.score[field])))),
    true,
    "candidate score fields are complete"
  );
  assert.equal(
    runA.runtime.decisionTraces.every((trace) => trace.candidates.every((candidate) => ["witnessExposure", "rumorValue", "alibiPressure", "coverUpUrgency", "socialAffinity", "locationHeat", "institutionalPressure", "resourceFlow"].every((field) => Number.isFinite(candidate.score[field] ?? 0)))),
    true,
    "core simulation score fields are complete"
  );
  assert.deepEqual(
    runA.runtime.socialProfiles.map((profile) => [profile.npcId, profile.reputation, profile.suspicion, profile.rumorCredibility, profile.preferredActionKinds.join(",")]),
    runB.runtime.socialProfiles.map((profile) => [profile.npcId, profile.reputation, profile.suspicion, profile.rumorCredibility, profile.preferredActionKinds.join(",")]),
    "social profiles are deterministic"
  );
  assert.equal(runA.runtime.pressureLedger.length > 0, true, "ticks record a pressure ledger");
  assert.equal(runA.runtime.relationshipLedger.length > 0, true, "ticks record relationship and trust changes");
  assert.equal(runA.runtime.locationLedger.length > 0, true, "ticks record location heat and resource changes");
  assert.equal(runA.runtime.consequences.length > 0, true, "ticks record action consequences");
  assert.equal(runA.runtime.decisionTraces.every((trace) => trace.phases?.includes("extract-candidates") && trace.consequence && trace.observationIds?.length), true, "decision traces include phase, observation and consequence data");
  const briefA = engine.buildTownSituationBrief(runA.world, [...dailyA.events, ...runA.events], runA.runtime);
  const briefB = engine.buildTownSituationBrief(runB.world, [...dailyB.events, ...runB.events], runB.runtime);
  const { worldId: briefWorldIdA, runtimeId: briefRuntimeIdA, ...briefContentA } = briefA;
  const { worldId: briefWorldIdB, runtimeId: briefRuntimeIdB, ...briefContentB } = briefB;
  assert.equal(briefWorldIdA, runA.world.id, "town situation brief binds to its world");
  assert.equal(briefWorldIdB, runB.world.id, "town situation brief binds to its comparison world");
  assert.equal(briefRuntimeIdA, runA.runtime.id, "town situation brief binds to its runtime");
  assert.equal(briefRuntimeIdB, runB.runtime.id, "town situation brief binds to its comparison runtime");
  assert.deepEqual(briefContentA, briefContentB, "town situation brief content is deterministic for the same seed");
  assert.equal(briefA.hotLocations.length > 0, true, "town situation brief ranks hot locations");
  assert.equal(briefA.riskAgents.length > 0, true, "town situation brief ranks high-risk agents");
  assert.equal(briefA.recentSignals.length >= 2, true, "town situation brief explains current pressure signals");
}

{
  const world = engine.createInitialWorld("simulation-depth-persistent", { mode: "advanced", npcCount: 12, timelineHours: 72 });
  const daily = engine.simulateDailyLife(world, 3, []);
  const run = engine.advancePersistentTownTick(daily.world, daily.events, { steps: 14, status: "running" });
  const selectedKinds = new Set(run.runtime.decisionTraces.map((trace) => trace.candidates.find((candidate) => candidate.id === trace.selectedCandidateId)?.kind).filter(Boolean));
  const newKinds = ["investigate", "spread-rumor", "seek-alibi", "pressure", "cover-up"].filter((kind) => selectedKinds.has(kind));
  assert.equal(newKinds.length >= 3, true, "runtime selects diverse core simulation actions");
  assert.equal(run.runtime.memoryPropagations.length > 0, true, "runtime propagates memories beyond direct participants");
  assert.equal(run.runtime.eventObservations.some((observation) => observation.kind === "same-location" || observation.kind === "rumor" || observation.kind === "deduced"), true, "runtime records observation kinds beyond direct participation");
  assert.equal(run.world.memories.some((memory) => memory.sourceObservationId), true, "memories reference source observations");
  assert.equal(run.runtime.agentStates.some((agent) => (agent.propagatedMemoryCount || 0) > 0 || agent.lastConsequence), true, "agent state reflects propagation or consequence updates");
  assert.equal(run.runtime.agentStates.some((agent) => agent.socialProfile?.rumorCredibility >= 0), true, "agent state reflects social profile summary");
  assert.equal(run.runtime.consequences.some((item) => item.socialShift), true, "consequences record social shifts");
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
  assert.ok(selected.validation.observationSupport, "candidate validation exposes observation support");
  const rumorObservation = run.runtime.eventObservations.find((observation) => observation.kind === "rumor");
  if (rumorObservation) {
    const rumorVictimId = rumorObservation.subjectNpcId || rumorObservation.sourceNpcId || selected.victimId;
    const rumorCandidate = {
      ...selected,
      culpritId: rumorObservation.observerNpcId,
      victimId: rumorVictimId,
      riskChainEventIds: [rumorObservation.eventId],
      memoryIds: run.world.memories.filter((memory) => memory.sourceObservationId === rumorObservation.id).map((memory) => memory.id),
      triggeredEventId: "fake-trigger",
      chainCompleteness: { motive: true, means: true, opportunity: true, "cover-up": true, memory: true, exclusion: true },
      validation: {
        ...selected.validation,
        memoryConfidence: { direct: 0, deduced: 0, rumor: rumorObservation.confidence, supportScore: Math.round(rumorObservation.confidence * 25) },
        observationSupport: { direct: 0, deduced: 0, sameLocation: 0, rumor: rumorObservation.confidence, supportScore: Math.round(rumorObservation.confidence * 20), observationIds: [rumorObservation.id] }
      }
    };
    const rumorValidation = engine.validateCaseCandidate(run.world, [...daily.events, ...run.events], rumorCandidate);
    assert.equal(rumorValidation.observationSupport.rumor > 0, true, "rumor-only candidate sees rumor observation support");
    assert.equal(rumorValidation.observationSupport.supportScore < 55, true, "low-confidence rumor alone cannot satisfy memory support");
    assert.equal(rumorValidation.memoryScopedTestimony, false, "rumor-only support does not satisfy scoped testimony");
  }
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
  assert.equal((extracted.activeCase.sourceMap.observationSourceIds || []).length > 0, true, "extracted case records observation sources from the selected chain");
  assert.equal(extracted.activeCase.deductionCase.logicPuzzle.exclusionChains.every((chain) => chain.evidenceIds.length > 0), true, "all non-culprit exclusions keep evidence ids");
  const intake = engine.buildPlayableCaseIntake(extracted.activeCase, extracted.events, extracted.world);
  assert.equal(intake.caseId, extracted.activeCase.id, "playable intake binds to extracted case");
  assert.equal(intake.sourceCandidateId, selected.id, "playable intake exposes source candidate id");
  assert.equal(intake.chainStages.filter((stage) => stage.complete).length >= 6, true, "playable intake exposes complete chain stages");
  assert.equal(intake.starterTasks.length >= 5, true, "playable intake builds starter tasks");
  assert.equal(intake.evidenceRoute.length >= 5, true, "playable intake builds evidence route");
  assert.equal(intake.witnessPlan.length > 0, true, "playable intake builds witness plan");
  assert.equal(intake.routeIntegrity.playable, true, "playable intake route integrity passes for extracted cases");
  assert.equal(intake.routeIntegrity.searchableEvidence, true, "route integrity requires a searchable evidence route");
  assert.equal(intake.routeIntegrity.witnessAvailable, true, "route integrity requires a witness route");
  assert.equal(intake.routeIntegrity.contradictionAvailable, true, "route integrity requires a testimony challenge route");
  assert.deepEqual(Object.values(intake.routeIntegrity.criticalCoverage), [true, true, true, true], "route integrity covers motive, means, opportunity, and exclusion");
  assert.equal(intake.routeIntegrity.proofLedgerValid, true, "route integrity is backed by a valid truth ledger");
  assert.equal(intake.routeIntegrity.routeCertified, true, "route integrity requires a passing route certificate");
  assert.ok(intake.proofCoverage.totalRequired >= 8, "playable intake exposes proof obligation coverage");
  assert.equal(intake.routeCertificate.routeCertified, true, "playable intake exposes a passing route certificate");
  assert.equal(intake.routeCertificate.autoTheoryAccepted, true, "route certificate auto theory is accepted");
  assert.equal(intake.routeCertificate.steps.some((step) => step.kind === "search"), true, "route certificate contains search steps");
  assert.equal(intake.routeCertificate.steps.some((step) => step.kind === "question"), true, "route certificate contains question steps");
  assert.equal(intake.routeCertificate.steps.some((step) => step.kind === "challenge"), true, "route certificate contains challenge steps");
  assert.equal(intake.routeCertificate.steps.some((step) => step.kind === "submit"), true, "route certificate contains submit step");
  const ledger = engine.buildCaseTruthLedger(extracted.activeCase, extracted.events);
  const ledgerKinds = new Set(ledger.obligations.map((item) => item.kind));
  for (const kind of ["motive", "means", "opportunity", "timeline", "contradiction", "exclusion", "source", "conclusion"]) {
    assert.equal(ledgerKinds.has(kind), true, `truth ledger includes ${kind} obligations`);
  }
  assert.equal(ledger.valid, true, "truth ledger validates complete extracted cases");
  assert.equal(intake.progress.currentStage, "join", "intake progress starts before join");
  assert.equal(intake.progress.coachStage, "join", "intake exposes coach stage before join");
  assert.equal(intake.nextAction.kind, "join", "intake next action starts with joining investigation");
  assert.equal(intake.nextAction.coachStepId, intake.coach.nextStep.id, "intake next action is backed by coach step");
  assert.equal(intake.coach.stage, "join", "coach starts at join");
  assert.equal(intake.coach.coverage.routeCertified, true, "coach coverage includes route certificate state");
  assert.equal(intake.coach.coverage.autoSolvePassed, true, "coach coverage includes auto-solve state");
  assert.equal(intake.coach.nextStep.buttonLabel, "Join investigation", "coach exposes a low-spoiler action button");
  assert.equal(intake.progressStages.length >= 5, true, "playable intake builds progress stages");
  assert.equal(intake.sourceCounts.events > 0 && intake.sourceCounts.memories > 0 && intake.sourceCounts.observations > 0, true, "playable intake summarizes source counts");
  const hiddenIntakeText = JSON.stringify(intake);
  assert.equal(hiddenIntakeText.includes(extracted.activeCase.deductionCase.truth.culpritId), false, "unsolved intake does not expose culprit id");
  assert.equal(hiddenIntakeText.includes("hidden-memory"), false, "unsolved coach/intake does not expose hidden memory ids");
  assert.equal(intake.sourceTrail.filter((item) => item.hidden).every((item) => item.label === "Hidden source event" || item.label === "Locked memory source"), true, "unsolved intake hides source labels");
  const certificate = engine.certifyPlayableCase(extracted.activeCase, extracted.events);
  assert.equal(certificate.routeCertified, true, "route certificate passes complete extracted cases");
  assert.equal(certificate.judgement.accepted, true, "route certificate proves accepted local judgement");
  const autoSolve = engine.autoSolvePlayableCase(extracted.activeCase, extracted.events);
  assert.equal(autoSolve.passed, true, "auto-solve passes complete extracted cases");
  assert.equal(autoSolve.summary.routeCertified, true, "auto-solve summary preserves certificate state");
  assert.equal(autoSolve.summary.proofCoverageComplete, true, "auto-solve closes proof coverage");
  assert.equal(autoSolve.summary.questionedWitnessCount > 0, true, "auto-solve questions witnesses");
  assert.equal(autoSolve.summary.challengeHitCount > 0, true, "auto-solve hits testimony challenges");
  assert.equal(autoSolve.session.judgement.accepted, true, "auto-solve synthetic session stores accepted judgement");
  assert.equal(autoSolve.steps.some((step) => step.kind === "submit" && step.complete), true, "auto-solve completes submit step");
  const noEvidenceCase = structuredClone(extracted.activeCase);
  noEvidenceCase.deductionCase.evidence = noEvidenceCase.deductionCase.evidence.map((item) => ({ ...item, discoverable: false }));
  const noEvidenceIntegrity = engine.validatePlayableCaseRoute(noEvidenceCase, extracted.events);
  assert.equal(noEvidenceIntegrity.searchableEvidence, false, "route integrity fails cases without discoverable evidence");
  assert.equal(noEvidenceIntegrity.playable, false, "route integrity blocks cases without discoverable evidence");
  assert.equal(engine.buildCaseTruthLedger(noEvidenceCase, extracted.events).valid, false, "truth ledger rejects cases without discoverable proof evidence");
  assert.equal(engine.certifyPlayableCase(noEvidenceCase, extracted.events).blockers.some((item) => item.kind === "search"), true, "route certificate blocks cases without searchable evidence");
  assert.equal(engine.autoSolvePlayableCase(noEvidenceCase, extracted.events).summary.failureKinds.includes("search"), true, "auto-solve reports search failures");
  const noWitnessCase = structuredClone(extracted.activeCase);
  noWitnessCase.testimonies = [];
  const noWitnessIntegrity = engine.validatePlayableCaseRoute(noWitnessCase, extracted.events);
  assert.equal(noWitnessIntegrity.witnessAvailable, false, "route integrity fails cases without witnesses");
  assert.equal(engine.certifyPlayableCase(noWitnessCase, extracted.events).blockers.some((item) => item.kind === "witness"), true, "route certificate blocks cases without witness routes");
  assert.equal(engine.autoSolvePlayableCase(noWitnessCase, extracted.events).summary.failureKinds.includes("witness"), true, "auto-solve reports witness failures");
  const noChallengeCase = structuredClone(extracted.activeCase);
  noChallengeCase.testimonies = noChallengeCase.testimonies.map((item) => ({ ...item, contradictionEvidenceIds: [] }));
  const noChallengeIntegrity = engine.validatePlayableCaseRoute(noChallengeCase, extracted.events);
  assert.equal(noChallengeIntegrity.contradictionAvailable, false, "route integrity fails cases without discoverable contradiction evidence");
  assert.equal(engine.buildCaseTruthLedger(noChallengeCase, extracted.events).obligations.some((item) => item.kind === "contradiction" && item.evidenceIds.length > 0), false, "truth ledger exposes missing testimony contradiction obligations");
  assert.equal(engine.certifyPlayableCase(noChallengeCase, extracted.events).blockers.some((item) => item.kind === "challenge"), true, "route certificate blocks cases without challenge routes");
  assert.equal(engine.autoSolvePlayableCase(noChallengeCase, extracted.events).summary.failureKinds.includes("challenge"), true, "auto-solve reports challenge failures");
  const noSourceCase = structuredClone(extracted.activeCase);
  noSourceCase.sourceMap.evidenceSourceEventIds = {};
  const noSourceLedger = engine.buildCaseTruthLedger(noSourceCase, []);
  assert.equal(noSourceLedger.valid, false, "truth ledger rejects decisive evidence without source backing");
  assert.equal(engine.certifyPlayableCase(noSourceCase, []).blockers.some((item) => item.kind === "source"), true, "route certificate blocks emerged cases without source backing");
  assert.equal(engine.autoSolvePlayableCase(noSourceCase, []).summary.failureKinds.includes("source"), true, "auto-solve reports source failures");
  const noExclusionCase = structuredClone(extracted.activeCase);
  noExclusionCase.sourceMap.chainStageSourceEventIds.exclusion = [];
  noExclusionCase.deductionCase.logicPuzzle.exclusionChains = [];
  noExclusionCase.deductionCase.evidence = noExclusionCase.deductionCase.evidence.map((item) => ({ ...item, title: "neutral clue", visibleDescription: "neutral scene context", trueMeaning: "neutral context", supportsConclusion: [], contradicts: [], unlocks: [] }));
  const noExclusionIntegrity = engine.validatePlayableCaseRoute(noExclusionCase, extracted.events);
  assert.equal(noExclusionIntegrity.criticalCoverage.exclusion, false, "route integrity fails cases without exclusion coverage");
  assert.equal(engine.certifyPlayableCase(noExclusionCase, extracted.events).blockers.some((item) => item.kind === "exclusion" || item.kind === "submit"), true, "route certificate blocks cases without exclusion route");
  assert.equal(engine.autoSolvePlayableCase(noExclusionCase, extracted.events).summary.failureKinds.some((kind) => kind === "exclusion" || kind === "submit"), true, "auto-solve reports exclusion or submit failures");
  const challengeEvidenceId = extracted.activeCase.testimonies.flatMap((item) => item.contradictionEvidenceIds)[0] || extracted.activeCase.deductionCase.evidence[0].id;
  const discoveredSession = {
    id: "intake-session",
    worldId: extracted.world.id,
    caseId: extracted.activeCase.id,
    playerId: "tester",
    displayName: "Tester",
    discoveredEvidenceIds: [challengeEvidenceId],
    interrogationLog: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const discoveredIntake = engine.buildPlayableCaseIntake(extracted.activeCase, extracted.events, extracted.world, discoveredSession);
  assert.equal(discoveredIntake.sourceCounts.discoveredEvidence, 1, "intake updates discovered evidence count from session");
  assert.equal(discoveredIntake.evidenceRoute.some((item) => item.id === challengeEvidenceId && item.discovered), true, "intake marks discovered evidence in the route");
  assert.equal(discoveredIntake.starterTasks.some((item) => item.kind === "search" && item.complete), true, "discovered evidence updates starter task state");
  assert.equal(discoveredIntake.progress.currentStage, "question", "discovered evidence advances intake progress toward questioning");
  assert.equal(["search", "question"].includes(discoveredIntake.coach.stage), true, "coach advances after the first discovered clue without skipping the route");
  assert.equal(discoveredIntake.nextAction.kind === "search" || discoveredIntake.nextAction.kind === "question", true, "next action advances the investigation route without spoilers");
  const wrongTheoryIntake = engine.buildPlayableCaseIntake(extracted.activeCase, extracted.events, extracted.world, {
    ...discoveredSession,
    discoveredEvidenceIds: extracted.activeCase.deductionCase.evidence.map((item) => item.id),
    submittedTheory: { culpritId: "wrong", motive: "", method: "", evidenceIds: [] },
    judgement: { accepted: false, score: 10, missing: ["Missing motive explanation."], contradictions: [], explanation: "Rejected by test" }
  });
  assert.equal(wrongTheoryIntake.progress.wrongTheorySubmitted, true, "wrong submissions are reflected in intake progress");
  assert.equal(["question", "challenge", "select-evidence", "submit"].includes(wrongTheoryIntake.coach.stage), true, "coach routes wrong submissions toward a repairable investigation stage");
  assert.equal(wrongTheoryIntake.coach.blockers.some((item) => item.kind === "submit" || item.kind === "coverage" || item.kind === "challenge"), true, "coach maps wrong submissions to proof repair blockers");
  const wrongTheory = engine.judgeTheory(extracted.activeCase.deductionCase, { culpritId: "wrong", motive: "", method: "", evidenceIds: [] }, extracted.activeCase.deductionCase.evidence.map((item) => item.id));
  assert.ok(wrongTheory.proofCoverage?.gaps.length, "wrong theory judgement returns proof coverage gaps");
  assert.equal(wrongTheory.missing.some((item) => item.includes("missing")), true, "wrong theory missing reasons include proof obligation gaps");
  const solvedIntake = engine.buildPlayableCaseIntake(extracted.activeCase, extracted.events, extracted.world, {
    ...discoveredSession,
    discoveredEvidenceIds: extracted.activeCase.deductionCase.evidence.map((item) => item.id),
    judgement: { accepted: true, score: 100, missing: [], contradictions: [], explanation: "Solved by test" }
  });
  assert.equal(solvedIntake.readiness.status, "solved", "solved intake unlocks solved status");
  assert.equal(solvedIntake.progress.currentStage, "solved", "solved intake marks progress solved");
  assert.equal(solvedIntake.progress.coachStage, "review-source", "solved intake exposes source review coach stage");
  assert.equal(solvedIntake.coach.stage, "review-source", "coach unlocks source review after solve");
  assert.equal(solvedIntake.nextAction.kind, "review-source", "solved intake points to source review");
  assert.equal(solvedIntake.sourceTrail.some((item) => item.hidden), false, "solved intake unlocks full source trail labels");
  assert.equal(solvedIntake.routeCertificate.steps.some((step) => step.evidenceIds.length > 0), true, "solved intake unlocks full route certificate steps");
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
  assert.equal(scenarioA.runtime.snapshots.some((snapshot) => (snapshot.observationIds || []).length > 0), true, "scenario snapshots track observations");
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
  assert.equal(diff.addedObservationIds.length >= 1, true, "snapshot diff reports added observations");
  assert.equal(diff.changedAgents.length >= 1, true, "snapshot diff reports changed agents");
  assert.equal(diff.changedLocations.length >= 1, true, "snapshot diff reports changed locations");
  const runtime = run.world.persistentRuntime;
  runtime.snapshots = [start, end];
  run.world.persistentRuntime = runtime;
  const restored = engine.rollbackTownRuntimeToSnapshot(run.world, start);
  assert.equal(restored.runtime.tick, start.tick, "rollback restores runtime tick");
  assert.deepEqual(restored.runtime.agentStates.map((agent) => agent.locationId), start.agentStates.map((agent) => agent.locationId), "rollback restores agent locations");
}

console.log("Persistent town tests passed.");
