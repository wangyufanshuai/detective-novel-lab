import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { readWorldPackageSource } from "../lib/world-package-catalog.ts";
import { loadEngineForTool } from "./load-engine-for-tools.mjs";

const root = process.cwd();
const engine = await loadEngineForTool("real-worldpackage-golden-path");

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const packageId = argValue("package", "dock-court-market-town");
const ticks = Math.max(60, Math.floor(Number(argValue("ticks", "100"))));
const packageSource = readWorldPackageSource(packageId, root);
if (!packageSource) throw new Error(`WorldPackage ${packageId} was not found.`);
if (!packageSource.validation.ok || !packageSource.validation.package) {
  throw new Error(`WorldPackage ${packageId} is invalid: ${packageSource.validation.errors.join("; ")}`);
}

const packageData = packageSource.validation.package;
const injectedRuleCatalog = engine.applyEcosystemCatalogToRuleCatalog(
  packageData.ruleCatalog,
  packageData.ecosystemCatalog
);
const selectedPackageHash = engine.createStablePackHash({
  ...packageData,
  ruleCatalog: injectedRuleCatalog
});
const worldId = `worldpackage-golden-${packageId}`;

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function mergeEvents(...lists) {
  const byId = new Map();
  for (const event of lists.flat()) {
    if (event?.id && !byId.has(event.id)) byId.set(event.id, event);
  }
  return Array.from(byId.values());
}

function flattenRecordValues(value) {
  return Object.values(value || {}).flatMap((items) => Array.isArray(items) ? items : []);
}

function sourceRefs(activeCase, runtime, world, allEvents) {
  const sourceMap = activeCase.sourceMap || {};
  const eventIds = unique([
    ...(activeCase.sourceEventIds || []),
    ...(sourceMap.sourceEventIds || []),
    ...flattenRecordValues(sourceMap.evidenceSourceEventIds),
    ...flattenRecordValues(sourceMap.extractionEventSourceIds),
    ...flattenRecordValues(sourceMap.chainStageSourceEventIds)
  ]);
  const memoryIds = unique(sourceMap.memorySourceIds || []);
  const observationIds = unique(sourceMap.observationSourceIds || []);
  const sourceEvents = runtime?.eventObservations || [];
  const persistedObservationIds = new Set(world.memories.map((memory) => memory.sourceObservationId).filter(Boolean));
  return {
    eventIds,
    memoryIds,
    observationIds,
    stageCounts: Object.fromEntries(
      Object.entries(sourceMap.chainStageSourceEventIds || {}).map(([stage, ids]) => [stage, unique(ids).length])
    ),
    missingEventIds: eventIds.filter((id) => !allEvents.some((event) => event.id === id)),
    missingMemoryIds: memoryIds.filter((id) => !world.memories.some((memory) => memory.id === id)),
    liveObservationCount: observationIds.filter((id) => sourceEvents.some((observation) => observation.id === id)).length,
    memoryLinkedObservationCount: observationIds.filter((id) => persistedObservationIds.has(id)).length,
    missingObservationIds: observationIds.filter((id) => !sourceEvents.some((observation) => observation.id === id) && !persistedObservationIds.has(id))
  };
}

function runOnce() {
  const created = engine.createWorldFromScenarioPack(
    packageData.scenarioPack,
    packageData.mapPack,
    injectedRuleCatalog,
    {
      branchWorldId: worldId,
      runId: `worldpackage-golden-${packageId}`,
      engineVersion: "persistent-town.v1"
    }
  );
  let world = created.world;
  let runtime = created.runtime;
  let events = [];
  runtime.maxTicks = ticks;
  runtime.caseTriggerPolicy = "source-signaled";
  world.persistentRuntime = runtime;

  while (runtime.tick < ticks) {
    const advanced = engine.advancePersistentTownTick(world, events, {
      steps: Math.min(20, ticks - runtime.tick),
      status: "running",
      cloneInput: false,
      traceRetention: 240,
      reportRetention: 240,
      snapshotEveryTicks: 1_000_000,
      checkpointEveryTicks: 1_000_000
    });
    world = advanced.world;
    runtime = advanced.runtime;
    events = [...events, ...advanced.events];
  }

  const candidate = (runtime.candidates || [])
    .filter((item) => item.validation?.valid && item.triggeredEventId)
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  assert.ok(candidate, `WorldPackage ${packageId} did not produce a valid triggered candidate by ${ticks} ticks.`);

  const extracted = engine.extractPlayableCaseFromCandidate(world, events, candidate, { resolutionMode: "preview" });
  const allEvents = mergeEvents(events, extracted.events);
  const extractedWorld = extracted.world;
  const extractedRuntime = extractedWorld.persistentRuntime || runtime;
  const activeCase = extracted.activeCase;
  const refs = sourceRefs(activeCase, extractedRuntime, extractedWorld, allEvents);

  const autoSolve = engine.autoSolvePlayableCase(activeCase, allEvents);
  const playerIntake = engine.buildPlayableCaseIntake(activeCase, allEvents, extractedWorld);
  const reviewRoom = engine.buildInvestigationRoomProjection(activeCase, allEvents, { mode: "review" });
  const playerRoom = engine.buildInvestigationRoomProjection(activeCase, allEvents, { mode: "player" });
  const solvedIntake = engine.buildPlayableCaseIntake(activeCase, allEvents, extractedWorld, autoSolve.session);
  const solvedRoom = engine.buildInvestigationRoomProjection(activeCase, allEvents, {
    mode: "player",
    session: autoSolve.session
  });

  const privateSourceIds = unique([
    ...refs.eventIds,
    ...refs.memoryIds,
    ...refs.observationIds,
    activeCase.triggeredEventId
  ]);
  const unsolvedProjection = JSON.stringify({ playerIntake, playerRoom });
  const leakedSourceEventIds = refs.eventIds.filter((id) => unsolvedProjection.includes(id));
  const culpritId = activeCase.deductionCase.truth?.culpritId;
  const culpritLeak = Boolean(culpritId && unsolvedProjection.includes(culpritId));
  const playerTrailLeaks = playerIntake.sourceTrail.filter((item) => item.eventId || item.memoryId).length;

  const sourceResolution = {
    sourceEventCount: refs.eventIds.length,
    memorySourceCount: refs.memoryIds.length,
    observationSourceCount: refs.observationIds.length,
    liveObservationCount: refs.liveObservationCount,
    memoryLinkedObservationCount: refs.memoryLinkedObservationCount,
    observationResolution: "live-or-persisted-memory-link",
    stageCounts: refs.stageCounts,
    missingEventIds: refs.missingEventIds,
    missingMemoryIds: refs.missingMemoryIds,
    missingObservationIds: refs.missingObservationIds,
    complete: refs.missingEventIds.length === 0 && refs.missingMemoryIds.length === 0 && refs.missingObservationIds.length === 0
  };
  const masking = {
    unsolvedSourceEventCount: playerRoom.sourceEventIds.length,
    unsolvedTriggerId: playerRoom.triggeredEventId,
    unsolvedEvidenceNodeCount: playerRoom.evidenceNodeIds.length,
    playerTrailLeaks,
    leakedSourceEventIds,
    culpritLeak,
    privateSourceIdCount: privateSourceIds.length,
    complete: playerRoom.sourceEventIds.length === 0
      && playerRoom.triggeredEventId === undefined
      && playerTrailLeaks === 0
      && leakedSourceEventIds.length === 0
      && !culpritLeak
  };

  const stable = {
    package: { id: packageId, selectedPackageHash },
    world: { id: extractedWorld.id, seed: extractedWorld.seed, tick: runtime.tick, eventCount: allEvents.length },
    candidate: {
      id: candidate.id,
      tick: candidate.tick,
      caseType: candidate.caseType,
      triggerKind: candidate.triggerKind,
      triggeredEventId: candidate.triggeredEventId,
      valid: candidate.validation?.valid === true,
      chainCompleteness: candidate.validation?.chainCompleteness || {}
    },
    activeCase: {
      id: activeCase.id,
      sourceCandidateId: activeCase.sourceCandidateId,
      triggerKind: activeCase.triggerKind,
      triggeredEventId: activeCase.triggeredEventId,
      validationValid: activeCase.validation?.valid === true,
      quality: {
        worldBackedEvidence: activeCase.qualityReport?.worldBackedEvidence === true,
        memoryScopedTestimony: activeCase.qualityReport?.memoryScopedTestimony === true,
        nonCulpritExcluded: activeCase.qualityReport?.nonCulpritExcluded === true,
        timeline24hComplete: activeCase.qualityReport?.timeline24hComplete === true,
        reasoningTraceComplete: activeCase.qualityReport?.reasoningTraceComplete === true
      },
      evidenceCount: activeCase.deductionCase.evidence.length,
      testimonyCount: activeCase.testimonies.length
    },
    sourceResolution,
    views: {
      playerIntake: {
        readiness: playerIntake.readiness,
        route: playerIntake.routeIntegrity,
        sourceCounts: playerIntake.sourceCounts,
        progress: playerIntake.progress
      },
      reviewRoom: {
        sourceEventCount: reviewRoom.sourceEventIds.length,
        evidenceNodeCount: reviewRoom.evidenceNodeIds.length,
        integrity: reviewRoom.integrity
      },
      playerRoom: { integrity: playerRoom.integrity, evidenceNodeIds: playerRoom.evidenceNodeIds },
      solvedIntake: { readiness: solvedIntake.readiness, sourceCounts: solvedIntake.sourceCounts, progress: solvedIntake.progress },
      solvedRoom: { sourceEventCount: solvedRoom.sourceEventIds.length, integrity: solvedRoom.integrity }
    },
    autoSolve: {
      passed: autoSolve.passed,
      summary: autoSolve.summary
    },
    masking,
    replayDigest: engine.buildWorldReplayDigest(extractedWorld, allEvents, extractedRuntime).combinedDigest
  };

  assert.equal(stable.candidate.valid, true);
  assert.equal(stable.activeCase.validationValid, true);
  assert.equal(sourceResolution.complete, true, `all case source refs must resolve against the real package run: ${JSON.stringify(sourceResolution)}`);
  assert.equal(stable.activeCase.quality.worldBackedEvidence, true);
  assert.equal(stable.activeCase.quality.memoryScopedTestimony, true);
  assert.equal(stable.activeCase.quality.timeline24hComplete, true);
  assert.equal(playerIntake.routeIntegrity?.playable, true);
  assert.equal(playerIntake.routeIntegrity?.routeCertified, true);
  assert.equal(reviewRoom.integrity.traceable, true);
  assert.equal(autoSolve.passed, true);
  assert.equal(solvedIntake.progress?.solved, true);
  assert.equal(solvedRoom.triggeredEventId, activeCase.triggeredEventId);
  assert.equal(solvedRoom.sourceEventIds.length > 0, true);
  assert.equal(masking.complete, true, "player projection must mask private source identifiers before solving");

  return { stable, allEvents, sourceResolution, masking, candidateCount: runtime.candidates.length };
}

const first = runOnce();
if (typeof global.gc === "function") global.gc();
const repeat = runOnce();
const deterministicRepeat = JSON.stringify(first.stable) === JSON.stringify(repeat.stable);
assert.equal(deterministicRepeat, true, "real WorldPackage golden path must be deterministic for the same seed and package hash");

const receipt = {
  schema: "worldpackage-golden-investigation-path.v1",
  evidenceClass: "local-world-package-campaign",
  status: "candidate",
  humanGate: "pending-human-comprehension-and-ui-review",
  generatedAt: new Date().toISOString(),
  package: {
    id: packageId,
    version: packageData.manifest.version,
    license: packageData.manifest.license,
    sourceRelativePath: packageSource.relativePath,
    sourceContentHash: packageSource.contentHash,
    selectedPackageHash,
    fileCount: packageSource.fileCount,
    bytes: packageSource.bytes,
    validationOk: packageSource.validation.ok
  },
  execution: {
    ticks,
    worldId,
    eventCount: first.stable.world.eventCount,
    sourceBackedEventCount: first.allEvents.filter((event) => event.tags?.includes("source_backed")).length,
    candidateCount: first.candidateCount,
    selectedCandidateId: first.stable.candidate.id,
    selectedTriggerKind: first.stable.candidate.triggerKind,
    selectedCaseId: first.stable.activeCase.id,
    selectedReplayDigest: first.stable.replayDigest
  },
  candidate: first.stable.candidate,
  activeCase: first.stable.activeCase,
  sourceResolution: first.sourceResolution,
  views: first.stable.views,
  autoSolve: first.stable.autoSolve,
  masking: first.masking,
  deterministicRepeat,
  boundaries: {
    realWorldPackageInput: true,
    syntheticSourceFixture: false,
    productionInvestigationClaim: false,
    humanComprehensionReview: "pending",
    acceptedAssetAndRuntimeReview: "pending",
    crossPackageSeedMatrix: "pending"
  }
};

const outputPath = path.join(root, "outputs", `worldpackage-golden-investigation-path-${packageId}.json`);
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...receipt, outputPath }, null, 2));
