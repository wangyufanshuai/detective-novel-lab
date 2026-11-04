import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { readWorldPackageSource } from "../lib/world-package-catalog.ts";
import { loadEngineForTool } from "./load-engine-for-tools.mjs";
import { populationQualityComparison } from "./lib/population-flow-receipt-contract.mjs";

const root = process.cwd();
function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const runtimeNamespace = argValue("runtime-namespace", "population-flow-campaign-fairness");
const engine = await loadEngineForTool(runtimeNamespace);
const packageId = argValue("package", "dock-court-market-town");
const ticks = Math.max(100, Math.floor(Number(argValue("ticks", "1000"))));
const seed = argValue("seed", "");
const outputSuffix = argValue("output-suffix", "");
const diagnosticRevalidate = argValue("diagnostic-revalidate", "false") === "true";
const diagnosticState = argValue("diagnostic-state", "false") === "true";
if (!/^[a-z0-9._-]*$/i.test(outputSuffix)) throw new Error("output suffix must be a safe file-name fragment");

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
const packageHash = engine.createStablePackHash({
  ...packageData,
  ruleCatalog: injectedRuleCatalog
});
const authoredPopulation = packageData.scenarioPack.world.npcs.length;
const maxResidents = Math.max(authoredPopulation + 8, authoredPopulation);
const longRun = ticks >= 5000;
const policy = {
  cadenceTicks: 5,
  maxResidents,
  maxFlowsPerTick: 1,
  minSourceAgeTicks: 1,
  newcomerFirstActionWindowTicks: 24
};

function absoluteMinutes(day, time) {
  const match = typeof time === "string" ? /^(\d{2}):(\d{2})$/.exec(time) : null;
  const hours = match ? Number(match[1]) : 0;
  const minutes = match ? Number(match[2]) : 0;
  return Math.max(1, Number(day) || 1) * 24 * 60 + hours * 60 + minutes;
}

function uniqueCount(values) {
  return values.length - new Set(values).size;
}

function edgeCount(world) {
  return world.npcs.reduce((sum, npc) => sum + Object.keys(npc.relationships || {}).length, 0);
}

function sourceBacked(event) {
  return Array.isArray(event?.tags) && event.tags.includes("source_backed");
}

const agentActionKinds = new Set([
  "confront",
  "cover-up",
  "hide-trace",
  "investigate",
  "obtain-resource",
  "pressure",
  "spread-rumor",
  "seek-alibi",
  "move",
  "talk",
  "observe"
]);

function incrementCount(target, key) {
  if (!key) return;
  target[key] = (target[key] || 0) + 1;
}

function eventMetrics(events, newcomerIds) {
  const actionKindDistribution = {};
  const newcomerActionKindDistribution = {};
  const eventTypeDistribution = {};
  const harmfulEventTypeDistribution = {};
  const harmfulEvents = new Set(["destroy_evidence"]);
  for (const event of events) {
    incrementCount(eventTypeDistribution, event.type);
    const actionKinds = (event.tags || []).filter((tag) => agentActionKinds.has(tag));
    for (const kind of actionKinds) incrementCount(actionKindDistribution, kind);
    if (actionKinds.length && event.actorIds?.some((actorId) => newcomerIds.has(actorId))) {
      for (const kind of actionKinds) incrementCount(newcomerActionKindDistribution, kind);
    }
    if (harmfulEvents.has(event.type) || event.tags?.includes("cover_up") || event.tags?.includes("staging")) {
      incrementCount(harmfulEventTypeDistribution, event.type || "tagged-harmful");
    }
  }
  return {
    actionKindDistribution,
    newcomerActionKindDistribution,
    eventTypeDistribution,
    harmfulEventTypeDistribution,
    harmfulEventCount: Object.values(harmfulEventTypeDistribution).reduce((sum, count) => sum + count, 0)
  };
}

function ruleStateMetrics(ruleState) {
  const evidence = ruleState?.evidenceContamination;
  const chainItems = ruleState?.evidenceChain?.items || [];
  const provenanceCounts = {};
  for (const item of chainItems) incrementCount(provenanceCounts, item.provenance || "unknown");
  const longActionDistribution = {};
  const longActionStatusDistribution = {};
  for (const action of ruleState?.longActions || []) {
    incrementCount(longActionDistribution, action.kind);
    incrementCount(longActionStatusDistribution, action.status);
  }
  return {
    contamination: evidence?.contamination ?? null,
    evidenceIntegrity: evidence ? 100 - evidence.contamination : null,
    riskByLocation: Object.fromEntries(Object.entries(evidence?.riskByLocation || {}).sort(([left], [right]) => left.localeCompare(right))),
    evidenceSourceEventCount: evidence?.sourceEventIds?.length || 0,
    evidenceChainItemCount: chainItems.length,
    evidenceChainProvenanceDistribution: provenanceCounts,
    weakOrContaminatedEvidenceCount: chainItems.filter((item) => item.provenance === "weak" || item.integrity <= 30 || item.contamination >= 72).length,
    longActionDistribution,
    longActionStatusDistribution
  };
}

function firstActionForNewcomer(record, events, tickIntervalMinutes) {
  const arrival = events.find((event) => event.id === record.arrivalEventId);
  if (!arrival) return null;
  const arrivalMinutes = absoluteMinutes(arrival.day, arrival.time);
  const action = events
    .filter((event) => event.id !== record.arrivalEventId && event.actorIds?.includes(record.npcId))
    .map((event) => ({ event, minutes: absoluteMinutes(event.day, event.time) }))
    .filter(({ minutes }) => minutes >= arrivalMinutes)
    .sort((left, right) => left.minutes - right.minutes || left.event.id.localeCompare(right.event.id))[0];
  if (!action) return null;
  return {
    eventId: action.event.id,
    latencyTicks: Math.max(0, Math.round((action.minutes - arrivalMinutes) / Math.max(1, tickIntervalMinutes)))
  };
}

function candidateMetrics(runtime, world, events) {
  const candidates = runtime.candidates || [];
  const eventById = new Map(events.map((event) => [event.id, event]));
  const valid = candidates.filter((candidate) => candidate.validation?.valid);
  const rejectedReasonCounts = {};
  for (const candidate of candidates) {
    if (candidate.validation?.valid) continue;
    for (const reason of candidate.validation?.failureReasons || candidate.validation?.errors || []) {
      rejectedReasonCounts[reason] = (rejectedReasonCounts[reason] || 0) + 1;
    }
  }
  const complete = valid.filter((candidate) => Object.values(candidate.validation?.chainCompleteness || {}).every(Boolean));
  const evidenceCovered = valid.filter((candidate) => {
    const evidence = candidate.validation?.evidenceChain;
    return evidence?.minimumEvidenceCountMet === true && (evidence.relatedEvidenceIds || []).length > 0;
  });
  const historical = (runtime.reports || []).flatMap((report) => report.candidateSummaries || []);
  const historicalById = new Map(historical.map((candidate) => [candidate.id, candidate]));
  const historicalValid = [...historicalById.values()].filter((candidate) => candidate.valid);
  const historicalEvidenceCovered = historicalValid.filter((candidate) => candidate.evidenceCovered);
  const historicalPeakByTick = new Map();
  for (const report of runtime.reports || []) {
    const summaries = report.candidateSummaries || [];
    historicalPeakByTick.set(report.tick, {
      validCandidateCount: summaries.filter((candidate) => candidate.valid).length,
      validEvidenceCoveredCount: summaries.filter((candidate) => candidate.valid && candidate.evidenceCovered).length
    });
  }
  const peakValidCandidateCount = Math.max(
    valid.length,
    ...[...historicalPeakByTick.values()].map((value) => value.validCandidateCount)
  );
  const peakValidEvidenceCoveredCount = Math.max(
    evidenceCovered.length,
    ...[...historicalPeakByTick.values()].map((value) => value.validEvidenceCoveredCount)
  );
  return {
    candidateCount: candidates.length,
    validCandidateCount: valid.length,
    validChainCompleteCount: complete.length,
    validEvidenceCoveredCount: evidenceCovered.length,
    historicalValidCandidateCount: historicalValid.length,
    historicalValidEvidenceCoveredCount: historicalEvidenceCovered.length,
    peakValidCandidateCount,
    peakValidEvidenceCoveredCount,
    candidateHistoryTickCount: historicalPeakByTick.size,
    validCandidateCoverage: valid.length ? Number((evidenceCovered.length / valid.length).toFixed(4)) : 0,
    candidateValidationWarningCount: valid.reduce((sum, candidate) => sum + (candidate.validation?.warnings?.length || 0), 0),
    candidateTriggerIds: valid.map((candidate) => candidate.triggeredEventId).filter(Boolean).sort(),
    validCandidateIds: valid.map((candidate) => candidate.id).sort(),
    rejectedReasonCounts,
    rejectedCandidateIds: candidates.filter((candidate) => !candidate.validation?.valid).map((candidate) => candidate.id).sort(),
    pairDiagnostics: candidates.map((candidate) => ({
      culpritId: candidate.culpritId,
      victimId: candidate.victimId,
      pressureScore: candidate.pressureScore,
      triggeredEventId: candidate.triggeredEventId || null,
      valid: candidate.validation?.valid === true,
      failureReasons: candidate.validation?.failureReasons || []
    })),
    triggeredCandidateDiagnostics: candidates.filter((candidate) => candidate.triggeredEventId).map((candidate) => {
      const sourceLocations = new Set(candidate.riskChainEventIds.map((id) => eventById.get(id)?.locationId));
      const evidence = (runtime.ruleState?.evidenceChain.items || []).filter((item) =>
        item.sourceEventIds.some((id) => candidate.riskChainEventIds.includes(id)) || sourceLocations.has(item.locationId)
      );
      const revalidated = diagnosticRevalidate ? engine.validateCaseCandidate(world, events, candidate) : candidate.validation;
      return {
        id: candidate.id,
        culpritId: candidate.culpritId,
        victimId: candidate.victimId,
        triggeredEventId: candidate.triggeredEventId,
        riskChainEventIds: candidate.riskChainEventIds,
        chainCompleteness: candidate.chainCompleteness || candidate.validation.chainCompleteness,
        valid: candidate.validation.valid,
        revalidated: revalidated.valid,
        revalidationPerformed: diagnosticRevalidate,
        revalidationFailureReasons: revalidated.failureReasons,
        sourceLocations: [...sourceLocations].filter(Boolean).sort(),
        observationSupport: candidate.validation.observationSupport?.supportScore,
        memoryConfidence: candidate.validation.memoryConfidence?.supportScore,
        relatedEvidence: evidence.map((item) => ({
          id: item.id,
          locationId: item.locationId,
          provenance: item.provenance,
          integrity: item.integrity,
          contamination: item.contamination,
          sourceActionIds: item.sourceActionIds,
          sourceEventIds: item.sourceEventIds,
          usedInResolution: item.usedInResolution
        }))
      };
    })
  };
}

async function runLane(enabled, laneLabel) {
  const startedAt = performance.now();
  const branchWorldId = `campaign-fairness-${packageId}`;
  const created = engine.createWorldFromScenarioPack(
    packageData.scenarioPack,
    packageData.mapPack,
    injectedRuleCatalog,
    {
      branchWorldId,
      runId: `population-flow-campaign-fairness-${packageId}`,
      engineVersion: "persistent-town.v1"
    }
  );
  let world = created.world;
  let runtime = created.runtime;
  const initialRuleState = engine.ensureTownRuleRuntimeState(world, runtime);
  const initialRuleStateMetrics = ruleStateMetrics(initialRuleState);
  if (seed) world.seed = seed;
  runtime.maxTicks = ticks;
  runtime.caseTriggerPolicy = "source-signaled";
  runtime.populationFlowPolicy = { enabled, ...policy };
  world.persistentRuntime = runtime;
  let events = [];
  while (runtime.tick < ticks) {
    const advanced = engine.advancePersistentTownTick(world, events, {
      steps: Math.min(60, ticks - runtime.tick),
      status: "running",
      cloneInput: false,
      snapshotEveryTicks: longRun ? 100 : 1_000_000,
      checkpointEveryTicks: longRun ? 500 : 1_000_000,
      candidateEveryTicks: longRun ? 10 : undefined,
      actionEveryTicks: longRun ? 3 : undefined,
      indexEventLimit: longRun ? 200 : undefined,
      traceRetention: 240,
      reportRetention: 240
    });
    world = advanced.world;
    runtime = advanced.runtime;
    events = [...events, ...advanced.events];
  }

  const records = runtime.populationFlowLedger || [];
  const eventById = new Map(events.map((event) => [event.id, event]));
  const newcomerIds = new Set(records.map((record) => record.npcId));
  const arrivalEvents = events.filter((event) => event.type === "arrival" || event.tags?.includes("population_flow"));
  const sourceEvents = events.filter((event) => sourceBacked(event));
  const firstActions = records.map((record) => firstActionForNewcomer(record, events, runtime.tickIntervalMinutes));
  const firstActionReceiptMismatch = records.filter((record, index) => {
    const observed = firstActions[index];
    if (!observed) return record.firstActionTick !== undefined || record.firstActionEventId !== undefined;
    return record.firstActionTick === undefined || record.firstActionEventId !== observed.eventId;
  }).length;
  const candidate = candidateMetrics(runtime, world, events);
  const triggeredCases = runtime.triggeredCases || [];
  const caseTriggerEvents = events.filter((event) => event.tags?.includes("case_trigger"));
  const triggerPairCounts = {};
  for (const event of caseTriggerEvents) incrementCount(triggerPairCounts, event.actorIds.slice(0, 2).join("->"));
  const structural = {
    duplicateNpcIds: uniqueCount(world.npcs.map((npc) => npc.id)),
    duplicateEventIds: uniqueCount(events.map((event) => event.id)),
    duplicateFlowIds: uniqueCount(records.map((record) => record.id)),
    duplicateArrivalIds: uniqueCount(records.map((record) => record.arrivalEventId)),
    duplicateSourceIds: uniqueCount(records.map((record) => record.sourceEventId)),
    missingSourceEvents: records.filter((record) => !eventById.has(record.sourceEventId)).length,
    missingArrivalEvents: records.filter((record) => !eventById.has(record.arrivalEventId)).length,
    sourceNotBacked: records.filter((record) => !sourceBacked(eventById.get(record.sourceEventId))).length,
    arrivalSourceLinkMismatch: records.filter((record) => {
      const arrival = eventById.get(record.arrivalEventId);
      return !arrival?.causedByEventIds?.includes(record.sourceEventId);
    }).length,
    orphanNewcomers: records.filter((record) => !world.npcs.some((npc) => npc.id === record.npcId)).length,
    overResidentCap: world.npcs.filter((npc) => npc.alive !== false).length > policy.maxResidents,
    candidateSourceMismatch: candidate.candidateTriggerIds.filter((id) => !eventById.has(id)).length,
    firstActionReceiptMismatch
  };
  const caseTypes = {};
  for (const item of (runtime.candidates || []).filter((candidate) => candidate.validation?.valid)) {
    if (item.caseType) caseTypes[item.caseType] = (caseTypes[item.caseType] || 0) + 1;
  }
  const triggerKinds = {};
  for (const item of triggeredCases) triggerKinds[item.kind] = (triggerKinds[item.kind] || 0) + 1;
  const validCaseEvidenceCoverage = candidate.validCandidateCount
    ? Number((candidate.validEvidenceCoveredCount / candidate.validCandidateCount).toFixed(4))
    : 0;
  const digest = engine.buildWorldReplayDigest(world, events, runtime);
  const ruleState = engine.ensureTownRuleRuntimeState(world, runtime);
  if (diagnosticState && laneLabel !== "repeat") {
    const snapshotPath = path.join(root, "outputs", `population-flow-state-${packageId}-${ticks}${outputSuffix}-${laneLabel}.json`);
    await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
    await fs.writeFile(snapshotPath, JSON.stringify({ schema: "population-flow-diagnostic-state.v1", seed: world.seed, ticks, digest: digest.combinedDigest, world, events }), "utf8");
  }
  return {
    enabled,
    ticks,
    runtimeMs: Math.max(1, Math.round(performance.now() - startedAt)),
    worldId: world.id,
    authoredPopulation,
    population: world.npcs.filter((npc) => npc.alive !== false).length,
    newcomerCount: records.length,
    eventCount: events.length,
    sourceBackedEventCount: sourceEvents.length,
    sourceBackedIncidentCount: sourceEvents.filter((event) => event.type === "incident").length,
    eventMetrics: eventMetrics(events, newcomerIds),
    initialRuleState: initialRuleStateMetrics,
    finalRuleState: ruleStateMetrics(ruleState),
    arrivalEventCount: arrivalEvents.length,
    memoryCount: world.memories.length,
    relationshipEdges: edgeCount(world),
    triggeredCaseCount: triggeredCases.length,
    caseTriggerHistory: {
      eventCount: caseTriggerEvents.length,
      pairCounts: triggerPairCounts,
      retainedTriggers: triggeredCases.map((trigger) => ({
        eventId: trigger.eventId,
        tick: trigger.tick,
        pair: `${trigger.culpritId}->${trigger.victimId}`
      }))
    },
    nonfatalCaseCount: triggeredCases.filter((item) => item.kind === "nonfatal_incident").length,
    fatalCaseCount: triggeredCases.filter((item) => item.kind === "fatal").length,
    caseTypeDistribution: caseTypes,
    triggerKindDistribution: triggerKinds,
    validCaseEvidenceCoverage,
    firstActionObservedCount: firstActions.filter(Boolean).length,
    firstActionMissingCount: firstActions.filter((item) => !item).length,
    firstActionLedgerCount: records.filter((record) => record.firstActionTick !== undefined).length,
    firstActionLatencies: firstActions.filter(Boolean).map((item) => item.latencyTicks),
    populationFlowSourceCoverage: records.length
      ? Number(((records.length - structuralMissing(records, eventById, sourceBacked)) / records.length).toFixed(4))
      : 1,
    candidate,
    structural,
    digest: digest.combinedDigest
  };
}

function structuralMissing(records, eventById, isSourceBacked) {
  return records.filter((record) => {
    const source = eventById.get(record.sourceEventId);
    const arrival = eventById.get(record.arrivalEventId);
    return !source || !isSourceBacked(source) || !arrival?.causedByEventIds?.includes(record.sourceEventId);
  }).length;
}

const baseline = await runLane(false, "baseline");
if (typeof global.gc === "function") global.gc();
const enabled = await runLane(true, "enabled");
if (typeof global.gc === "function") global.gc();
const repeat = await runLane(true, "repeat");
const structuralPass = [baseline, enabled].every((lane) => Object.values(lane.structural).every((value) => value === 0 || value === false));
const receipt = {
  schema: "population-flow-campaign-fairness.v1",
  evidenceClass: "local-world-package-campaign",
  status: "candidate",
  fairnessGate: "pending-human-and-long-run-review",
  generatedAt: new Date().toISOString(),
  package: {
    id: packageId,
    version: packageData.manifest.version,
    license: packageData.manifest.license,
    sourceRelativePath: packageSource.relativePath,
    sourceContentHash: packageSource.contentHash,
    selectedPackageHash: packageHash,
    fileCount: packageSource.fileCount,
    bytes: packageSource.bytes,
    validationOk: packageSource.validation.ok
  },
  seed: seed || packageData.scenarioPack.world.seed,
  ticks,
  policy,
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
  comparison: {
    populationDelta: enabled.population - baseline.population,
    newcomerDelta: enabled.newcomerCount - baseline.newcomerCount,
    ...populationQualityComparison(
      {
        peakValidCandidateCount: baseline.candidate.peakValidCandidateCount,
        peakValidEvidenceCoveredCount: baseline.candidate.peakValidEvidenceCoveredCount,
        validCaseEvidenceCoverage: baseline.validCaseEvidenceCoverage
      },
      {
        peakValidCandidateCount: enabled.candidate.peakValidCandidateCount,
        peakValidEvidenceCoveredCount: enabled.candidate.peakValidEvidenceCoveredCount,
        validCaseEvidenceCoverage: enabled.validCaseEvidenceCoverage
      }
    ),
    relationshipEdgeDelta: enabled.relationshipEdges - baseline.relationshipEdges,
    nonfatalCaseDelta: enabled.nonfatalCaseCount - baseline.nonfatalCaseCount,
    runtimeMultiplier: Number((enabled.runtimeMs / Math.max(1, baseline.runtimeMs)).toFixed(3)),
    reviewRequired: true
  },
  deterministicRepeat: repeat.digest === enabled.digest,
  structuralPass,
  boundaries: {
    realWorldPackageInput: true,
    syntheticSourceFixture: false,
    productionFairnessClaim: false,
    humanReview: "pending",
    acceptedAssetAndRuntimeReview: "pending"
  }
};
const outputPath = path.join(root, "outputs", `population-flow-campaign-fairness-${packageId}-${ticks}${outputSuffix}.json`);
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...receipt, outputPath }, null, 2));
