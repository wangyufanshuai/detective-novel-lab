import { fail } from "@/app/api/v1/_utils";
import detectiveCaseTypes from "@/content/detective-v1/case-types.json";
import detectiveEscalationRules from "@/content/detective-v1/escalation-rules.json";
import detectiveEventArchetypes from "@/content/detective-v1/event-archetypes.json";
import detectiveEvidenceTypes from "@/content/detective-v1/evidence-types.json";
import detectiveFactions from "@/content/detective-v1/factions.json";
import detectiveLocations from "@/content/detective-v1/locations.json";
import detectiveManifest from "@/content/detective-v1/manifest.json";
import detectiveMotives from "@/content/detective-v1/motives.json";
import detectiveProgressionLines from "@/content/detective-v1/progression-lines.json";
import detectiveRedHerringPatterns from "@/content/detective-v1/red-herring-patterns.json";
import detectiveResources from "@/content/detective-v1/resources.json";
import detectiveRoles from "@/content/detective-v1/roles.json";
import {
  advancePersistentTownTick,
  activateArcConvergence,
  activateCampaignCase,
  applyAuthoredCampaignLeadFocus,
  applyInvestigationOperationsDecision,
  activateWorldArcForHints,
  advanceWorldArc,
  applyPlayerResourceCommitmentDecision,
  applyCampaignRecoveryDecision,
  applyWorldEventOfferDecision,
  applyWorldArcDirectiveDecision,
  applyTownRuntimeIntervention,
  applyWorldLeadDecision,
  applyWorldLeadOutcome,
  applyInvestigatorHeadquartersDecision,
  activateInvestigatorHeadquarters,
  completeInvestigatorHeadquarters,
  buildTownEmergenceQueue,
  bindCampaignRoute,
  builtInScenarioPacks,
  builtInTownMapPacks,
  buildRunReplayBundle,
  buildRuntimeGraphSummaries,
  benchmarkToRunSummary,
  createBuiltInScenarioPresets,
  createDefaultTownRuleCatalog,
  createScenarioRunSummary,
  createScenarioPackFromWorld,
  createStablePackHash,
  createTownMapPackFromWorld,
  createWorldFromScenarioPack,
  createRunJob,
  createPersistentTownRuntime,
  normalizePersistentTownRuntime,
  deriveWorldSystemRuntimeHints,
  deriveTownSocialResponseDirectionFromDeltas,
  compareRuns,
  completeArcConvergence,
  completeCampaignCase,
  diffTownStateSnapshots,
  deriveWorldLeadPreview,
  enqueueWorldArcDirective,
  enqueueTownSocialResponse,
  extractPlayableCaseFromCandidate,
  findRunCatalogEntry,
  listScenarioPresets,
  listRunCatalog,
  previewScenarioPackImport,
  previewTownMapPackImport,
  rollbackTownRuntimeToSnapshot,
  resolveCaseInWorld,
  prepareWorldLeadCaseHandoff,
  prepareInvestigatorHeadquarters,
  preparePlayerResourceCommitment,
  isInvestigationOperationsAuthoritativeSession,
  prepareCampaignRecovery,
  consumeWorldLeadCaseHandoff,
  investigatorHeadquartersDecisionAvailable,
  investigatorHeadquartersExtractionRequired,
  consumeWorldPressurePulseOnExtraction,
  recordInvestigationOperationStep,
  recordAcceptedCaseFactionRelationship,
  settleWorldLeadOutcome,
  settleInvestigationOperations,
  toFactionRelationshipPublicSummary,
  toWorldEventOfferPublicSummary,
  recordInvestigatorProgression,
  refreshArcConvergence,
  refreshCampaignSession,
  toInvestigatorProgressionPublicSummary,
  toInvestigatorHeadquartersPublicSummary,
  syncCampaignRecoveryFromRuntime,
  toCampaignRecoveryPublicSummary,
  toArcConvergencePublicSummary,
  toCampaignFinaleDebriefPublicSummary,
  toCampaignSessionPublicSummary,
  toWorldPressureCascadePublicSummary,
  toTownSocialResponsePublicSummary,
  toWorldInfluenceBudgetPublicSummary,
  runEmergenceBenchmark,
  runTownScenario,
  scenarioPackToScenarioConfig,
  snapshotsForRun,
  diffsForRun,
  validateScenarioPack,
  validateTownMapPack,
  validateTownRuleCatalog,
  validatePlayableCaseRoute,
  type CaseCandidate,
  type DetectiveContentPack,
  type DetectiveCampaignRouteId,
  type EmergenceBenchmarkReport,
  type PersistentTownRuntime,
  type ReviewExportBundle,
  type RunJob,
  type ScenarioConfig,
  type ScenarioPack,
  type ScenarioPreset,
  type ScenarioRunSummary,
  type TownMapPack,
  type TownRuleCatalog,
  type TownStateSnapshot,
  type TownRuntimeIntervention,
  type WorldLeadDecisionInput,
  type WorldArcDirectiveDecisionInput,
  type PlayerResourceCommitmentDecisionInput,
  type InvestigationOperationsDecisionInput,
  type CampaignRecoveryDecisionInput,
  type CampaignRecoveryFailureKind,
  type InvestigatorHeadquartersChoice,
  type WorldEventOfferDecisionInput,
  type WorldLeadFocus,
  type WorldEvent,
  type WorldState
} from "@/lib/engine";
import {
  artifactManifestToRunCatalogEntry,
  buildReplayBundleFromArtifacts,
  listRunArtifactManifests,
  loadRunArtifactFile,
  loadRunArtifactManifest,
  saveRunArtifacts
} from "@/app/api/v1/_run-artifacts";
import {
  findExperimentRegistryEntryById,
  findExperimentRegistryEntryByPackIds,
  listExperimentRegistryEntries
} from "@/app/api/v1/_experiment-registry";
import {
  findWorldPackageRegistryEntryById,
  findWorldPackageRegistryEntryByPackIds,
  listWorldPackageRegistryEntries
} from "@/app/api/v1/_world-package-registry";
import { worldRepository } from "@/lib/world/repository";

export type RuntimeWorld = WorldState & { persistentRuntime?: PersistentTownRuntime };

const detectiveContentPack: DetectiveContentPack = {
  manifest: detectiveManifest as DetectiveContentPack["manifest"],
  caseTypes: detectiveCaseTypes as DetectiveContentPack["caseTypes"],
  locations: detectiveLocations as DetectiveContentPack["locations"],
  roles: detectiveRoles as DetectiveContentPack["roles"],
  motives: detectiveMotives as DetectiveContentPack["motives"],
  evidenceTypes: detectiveEvidenceTypes as DetectiveContentPack["evidenceTypes"],
  redHerringPatterns: detectiveRedHerringPatterns as DetectiveContentPack["redHerringPatterns"],
  escalationRules: detectiveEscalationRules as DetectiveContentPack["escalationRules"],
  resources: detectiveResources as DetectiveContentPack["resources"],
  factions: detectiveFactions as DetectiveContentPack["factions"],
  eventArchetypes: detectiveEventArchetypes as DetectiveContentPack["eventArchetypes"],
  progressionLines: detectiveProgressionLines as DetectiveContentPack["progressionLines"]
};

export function createRuntimeWorldSystemHints(caseTypeId?: string) {
  return deriveWorldSystemRuntimeHints(detectiveContentPack, { caseTypeId });
}

export function createRuntimeForWorld(world: WorldState, events: WorldEvent[] = []) {
  return createPersistentTownRuntime(world, events, {
    worldSystemHints: createRuntimeWorldSystemHints()
  });
}

export function ensureRuntimeWorldSystemHints(runtime: PersistentTownRuntime, caseTypeId?: string, caseId?: string) {
  const shouldBindCase = Boolean(caseTypeId && runtime.worldSystemHints?.source?.caseTypeId !== caseTypeId);
  if (!runtime.worldSystemHints || shouldBindCase) runtime.worldSystemHints = createRuntimeWorldSystemHints(caseTypeId);
  if (!runtime.worldSystemHintSummary) runtime.worldSystemHintSummary = { ...runtime.worldSystemHints.summary };
  if (shouldBindCase) runtime.worldSystemHintSummary = { ...runtime.worldSystemHints.summary };
  if (!runtime.worldLeadPreview) runtime.worldLeadPreview = deriveWorldLeadPreview(runtime.worldSystemHints);
  if (shouldBindCase) runtime.worldLeadPreview = deriveWorldLeadPreview(runtime.worldSystemHints);
  if (caseId && runtime.campaignSession?.activeCaseId === caseId) applyAuthoredCampaignLeadFocus(runtime);
  if (!runtime.factionRelationshipSummary) runtime.factionRelationshipSummary = toFactionRelationshipPublicSummary(runtime);
  if (runtime.worldEventOffers?.items.length && !runtime.worldEventOfferSummary) runtime.worldEventOfferSummary = toWorldEventOfferPublicSummary(runtime);
  if (!runtime.investigatorProgressionSummary) runtime.investigatorProgressionSummary = toInvestigatorProgressionPublicSummary(runtime);
  if (!runtime.investigatorHeadquartersSummary) runtime.investigatorHeadquartersSummary = toInvestigatorHeadquartersPublicSummary(runtime);
  if (!runtime.campaignRecoverySummary) runtime.campaignRecoverySummary = toCampaignRecoveryPublicSummary(runtime);
  const campaignCycleKey = caseId && runtime.campaignSession?.activeCaseId === caseId
    ? runtime.campaignSession.activeCycleKey || caseId
    : caseId;
  if (campaignCycleKey && runtime.worldSystemHints) activateWorldArcForHints(runtime, runtime.worldSystemHints, campaignCycleKey);
  refreshCampaignSession(runtime);
  refreshArcConvergence(runtime);
  refreshCampaignSession(runtime);
  return runtime;
}

export function loadRuntimeWorld(worldId: string) {
  const world = worldRepository.getWorld(worldId) as RuntimeWorld | null;
  if (!world) return null;
  const events = worldRepository.getEvents(worldId);
  const existingRuntime = world.persistentRuntime;
  const needsNormalization = !existingRuntime
    || existingRuntime.worldId !== world.id
    || !Array.isArray(existingRuntime.agentStates)
    || !Array.isArray(existingRuntime.candidates)
    || !Array.isArray(existingRuntime.decisionTraces)
    || !existingRuntime.caseLifecycle
    || !Array.isArray(existingRuntime.pressureLedger)
    || !Array.isArray(existingRuntime.townSocialResponses?.items);
  if (needsNormalization) {
    world.persistentRuntime = normalizePersistentTownRuntime(world, events, existingRuntime);
    ensureRuntimeWorldSystemHints(world.persistentRuntime);
    worldRepository.saveWorld(world);
  }
  const runtime = world.persistentRuntime as PersistentTownRuntime;
  if (!needsNormalization) {
    const activeCandidate = runtime.candidates.find((candidate) => candidate.caseId === world.activeCaseId);
    const previousHintsCaseType = runtime.worldSystemHints?.source?.caseTypeId;
    const previousArcLine = runtime.worldArcProgress?.currentLineId;
    ensureRuntimeWorldSystemHints(runtime, activeCandidate?.caseType, activeCandidate?.caseId);
    if (!runtime.townSocialResponseSummary) {
      runtime.townSocialResponseSummary = toTownSocialResponsePublicSummary(world, runtime);
    }
    if (
      previousHintsCaseType !== runtime.worldSystemHints?.source?.caseTypeId ||
      previousArcLine !== runtime.worldArcProgress?.currentLineId
    ) {
      worldRepository.saveWorld(world);
    }
  }
  return { world, events, runtime };
}

export function persistRuntimeWorld(world: RuntimeWorld, eventsToAdd: WorldEvent[] = []) {
  worldRepository.saveWorldBundle({ world, events: eventsToAdd });
  return world;
}

function eventsForWorld(worldId: string) {
  return worldRepository.getEvents(worldId);
}

export function runtimeNotFound() {
  return fail("WORLD_NOT_FOUND", "World not found", 404);
}

export function getRuntimeCandidate(runtime: PersistentTownRuntime, candidateId?: string | null): CaseCandidate | null {
  if (!runtime.candidates.length) return null;
  if (!candidateId) return runtime.candidates.find((candidate) => candidate.validation.valid) || runtime.candidates[0];
  return runtime.candidates.find((candidate) => candidate.id === candidateId) || null;
}

export function stepRuntime(world: RuntimeWorld, events: WorldEvent[], steps = 1, status: "running" | "paused" = "running") {
  const result = advancePersistentTownTick(world, events, { steps, status });
  const nextWorld = result.world as RuntimeWorld;
  nextWorld.persistentRuntime = result.runtime;
  syncCampaignRecoveryFromRuntime(result.runtime);
  refreshArcConvergence(result.runtime);
  refreshCampaignSession(result.runtime);
  persistRuntimeWorld(nextWorld, result.events);
  return result;
}

export function recordRuntimeCampaignRecoveryDecision(world: RuntimeWorld, events: WorldEvent[], input: CampaignRecoveryDecisionInput) {
  const runtime = ensureRuntimeWorldSystemHints(world.persistentRuntime || createRuntimeForWorld(world, events));
  world.persistentRuntime = runtime;
  const campaignRecovery = applyCampaignRecoveryDecision(runtime, input);
  if (!campaignRecovery) return undefined;
  persistRuntimeWorld(world);
  return {
    world,
    runtime,
    queue: buildTownEmergenceQueue(world, events, runtime),
    campaignRecovery,
    factionRelationship: toFactionRelationshipPublicSummary(runtime),
    worldEventOffer: toWorldEventOfferPublicSummary(runtime)
  };
}

export function recordRuntimeInvestigatorHeadquartersDecision(
  world: RuntimeWorld,
  events: WorldEvent[],
  input: { choice: InvestigatorHeadquartersChoice }
) {
  const runtime = ensureRuntimeWorldSystemHints(world.persistentRuntime || createRuntimeForWorld(world, events));
  world.persistentRuntime = runtime;
  const investigatorHeadquarters = applyInvestigatorHeadquartersDecision(runtime, input);
  if (!investigatorHeadquarters) return undefined;
  persistRuntimeWorld(world);
  return {
    world,
    runtime,
    queue: buildTownEmergenceQueue(world, events, runtime),
    investigatorHeadquarters
  };
}

export function recordRuntimeCampaignFailure(worldId: string, input: {
  sourceKey: string;
  failureKind: CampaignRecoveryFailureKind;
  caseId?: string;
  sessionId?: string;
}) {
  const loaded = loadRuntimeWorld(worldId);
  if (!loaded) return undefined;
  const campaignRecovery = prepareCampaignRecovery(loaded.runtime, input);
  persistRuntimeWorld(loaded.world);
  return campaignRecovery;
}

export function recordRuntimeWorldLeadDecision(world: RuntimeWorld, events: WorldEvent[], input: WorldLeadDecisionInput) {
  const runtime = ensureRuntimeWorldSystemHints(world.persistentRuntime || createRuntimeForWorld(world, events));
  world.persistentRuntime = runtime;
  const worldLead = applyWorldLeadDecision(runtime, input);
  const worldLeadOutcome = input.action === "resolve"
    ? applyWorldLeadOutcome(world, runtime, input)
    : undefined;
  persistRuntimeWorld(world);
  return { world, runtime, queue: buildTownEmergenceQueue(world, events, runtime), worldLead, worldLeadOutcome, worldArc: runtime.worldArcSummary, worldInfluenceBudget: toWorldInfluenceBudgetPublicSummary(runtime) };
}

export function recordRuntimeWorldArcDirectiveDecision(world: RuntimeWorld, events: WorldEvent[], input: WorldArcDirectiveDecisionInput) {
  const runtime = ensureRuntimeWorldSystemHints(world.persistentRuntime || createRuntimeForWorld(world, events));
  world.persistentRuntime = runtime;
  const worldArcDirective = applyWorldArcDirectiveDecision(runtime, input);
  if (!worldArcDirective) return undefined;
  persistRuntimeWorld(world);
  return { world, runtime, queue: buildTownEmergenceQueue(world, events, runtime), worldArcDirective, worldPressureCascade: toWorldPressureCascadePublicSummary(runtime), factionRelationship: toFactionRelationshipPublicSummary(runtime), worldInfluenceBudget: toWorldInfluenceBudgetPublicSummary(runtime) };
}

export function recordRuntimeWorldEventOfferDecision(world: RuntimeWorld, events: WorldEvent[], input: WorldEventOfferDecisionInput) {
  const runtime = ensureRuntimeWorldSystemHints(world.persistentRuntime || createRuntimeForWorld(world, events));
  world.persistentRuntime = runtime;
  const worldEventOffer = applyWorldEventOfferDecision(runtime, input);
  if (!worldEventOffer) return undefined;
  persistRuntimeWorld(world);
  return {
    world,
    runtime,
    queue: buildTownEmergenceQueue(world, events, runtime),
    worldEventOffer,
    factionRelationship: toFactionRelationshipPublicSummary(runtime),
    worldInfluenceBudget: toWorldInfluenceBudgetPublicSummary(runtime)
  };
}

export function recordRuntimePlayerResourceCommitmentDecision(world: RuntimeWorld, events: WorldEvent[], input: PlayerResourceCommitmentDecisionInput) {
  const runtime = ensureRuntimeWorldSystemHints(world.persistentRuntime || createRuntimeForWorld(world, events));
  world.persistentRuntime = runtime;
  if (!isInvestigationOperationsAuthoritativeSession(runtime, input)) return undefined;
  const playerResourceCommitment = applyPlayerResourceCommitmentDecision(runtime, input);
  if (!playerResourceCommitment) return undefined;
  syncCampaignRecoveryFromRuntime(runtime);
  persistRuntimeWorld(world);
  return {
    world,
    runtime,
    queue: buildTownEmergenceQueue(world, events, runtime),
    playerResourceCommitment,
    factionRelationship: toFactionRelationshipPublicSummary(runtime),
    worldInfluenceBudget: toWorldInfluenceBudgetPublicSummary(runtime)
  };
}

export function recordRuntimeInvestigationOperationsDecision(world: RuntimeWorld, events: WorldEvent[], input: InvestigationOperationsDecisionInput) {
  const runtime = ensureRuntimeWorldSystemHints(world.persistentRuntime || createRuntimeForWorld(world, events));
  world.persistentRuntime = runtime;
  const playerResourceCommitment = applyInvestigationOperationsDecision(runtime, input);
  if (!playerResourceCommitment) return undefined;
  syncCampaignRecoveryFromRuntime(runtime);
  persistRuntimeWorld(world);
  return {
    world,
    runtime,
    queue: buildTownEmergenceQueue(world, events, runtime),
    playerResourceCommitment,
    factionRelationship: toFactionRelationshipPublicSummary(runtime),
    worldInfluenceBudget: toWorldInfluenceBudgetPublicSummary(runtime)
  };
}

export function prepareRuntimePlayerResourceCommitment(worldId: string, input: Pick<PlayerResourceCommitmentDecisionInput, "sessionId" | "caseId">) {
  const loaded = loadRuntimeWorld(worldId);
  if (!loaded) return undefined;
  const playerResourceCommitment = preparePlayerResourceCommitment(loaded.runtime, input);
  if (playerResourceCommitment.scope === "authoritative") persistRuntimeWorld(loaded.world);
  return playerResourceCommitment;
}

export function isRuntimeInvestigationAuthority(worldId: string, input: { sessionId: string; caseId: string }) {
  const loaded = loadRuntimeWorld(worldId);
  return Boolean(loaded && isInvestigationOperationsAuthoritativeSession(loaded.runtime, input));
}

export function getRuntimeFactionRelationshipSummary(worldId: string) {
  const loaded = loadRuntimeWorld(worldId);
  return loaded ? toFactionRelationshipPublicSummary(loaded.runtime) : undefined;
}

export function recordRuntimeInvestigatorProgressionStep(
  worldId: string,
  input: { sourceKey: string; kind: "search" | "question" | "challenge" | "evidence-selection" | "accepted-theory"; amount?: number }
) {
  const loaded = loadRuntimeWorld(worldId);
  if (!loaded) return undefined;
  const summary = recordInvestigatorProgression(loaded.runtime, input);
  persistRuntimeWorld(loaded.world);
  return summary;
}

export function getRuntimeInvestigatorProgressionSummary(worldId: string) {
  const loaded = loadRuntimeWorld(worldId);
  return loaded ? toInvestigatorProgressionPublicSummary(loaded.runtime) : undefined;
}

export function recordRuntimePlayerResourceCommitmentStep(worldId: string, input: { sessionId: string; caseId: string; lane: WorldLeadFocus; caseSceneLocationId?: string }) {
  const loaded = loadRuntimeWorld(worldId);
  if (!loaded) return undefined;
  const playerResourceCommitment = recordInvestigationOperationStep(loaded.runtime, input);
  if (playerResourceCommitment) persistRuntimeWorld(loaded.world);
  return playerResourceCommitment;
}

export function settleRuntimeWorldLeadOutcome(world: RuntimeWorld, caseId: string) {
  const runtime = world.persistentRuntime;
  if (!runtime) return undefined;
  const worldLeadOutcome = settleWorldLeadOutcome(world, runtime, caseId);
  if (worldLeadOutcome) persistRuntimeWorld(world);
  return worldLeadOutcome;
}

export function settleRuntimeWorldLeadOutcomeAndPrepareHandoff(world: RuntimeWorld, caseId: string, sessionId: string) {
  const runtime = world.persistentRuntime;
  if (!runtime || !isInvestigationOperationsAuthoritativeSession(runtime, { sessionId, caseId })) return undefined;
  const playerResourceCommitment = runtime
    ? settleInvestigationOperations(runtime, { sessionId, caseId, accepted: true }) || runtime.playerResourceCommitmentSummary
    : undefined;
  const activeOutcome = runtime?.worldLeadOutcome?.caseId === caseId ? runtime.worldLeadOutcome : undefined;
  const worldLeadOutcome = runtime ? settleWorldLeadOutcome(world, runtime, caseId) : undefined;
  const townSocialResponse = runtime && worldLeadOutcome && activeOutcome
    ? enqueueTownSocialResponse(world, runtime, {
        sourceKey: `${caseId}:${activeOutcome.focus}:${activeOutcome.activatedAtTick}`,
        sourceKind: "world-lead-settlement",
        direction: deriveTownSocialResponseDirectionFromDeltas({
          publicOpinionDelta: { heat: activeOutcome.applied.location.heat },
          institutionPressureDelta: activeOutcome.applied.institution.pressure,
          resourceAvailableDelta: activeOutcome.applied.resource.available,
          resourcePressureDelta: activeOutcome.applied.resource.pressure
        }),
        institutionId: activeOutcome.institutionId,
        institutionKind: runtime.ruleState?.institutions.find((item) => item.id === activeOutcome.institutionId)?.kind,
        locationId: activeOutcome.locationId
      })
    : runtime
      ? toTownSocialResponsePublicSummary(world, runtime)
      : undefined;
  const campaignCycleKey = runtime?.campaignSession?.activeCaseId === caseId
    ? runtime.campaignSession.activeCycleKey || caseId
    : caseId;
  const worldArc = runtime && worldLeadOutcome && activeOutcome
    ? advanceWorldArc(runtime, { caseId: campaignCycleKey, focus: activeOutcome.focus })
    : undefined;
  const eventArchetype = runtime?.worldSystemHints?.source.eventArchetypeId
    ? detectiveEventArchetypes.find((item) => item.id === runtime.worldSystemHints?.source.eventArchetypeId)
    : undefined;
  const worldArcDirective = runtime && worldArc && eventArchetype?.directiveResponses
    ? (() => {
        const relatedResources = detectiveResources.filter((item) => eventArchetype.resourceIds.includes(item.id));
        const relatedFactions = detectiveFactions.filter((item) => eventArchetype.factionIds.includes(item.id));
        const sourceFaction = detectiveFactions.find((item) => item.id === runtime.worldSystemHints?.source.factionId)
          || [...relatedFactions].sort((left, right) => right.weight - left.weight || left.id.localeCompare(right.id))[0];
        const progression = detectiveProgressionLines.find((item) => item.id === runtime.worldSystemHints?.source.progressionLineId);
        const focusCaseTypeIds = Array.from(new Set([
          ...eventArchetype.caseTypeIds,
          ...relatedResources.flatMap((item) => item.caseTypeIds),
          ...relatedFactions.flatMap((item) => item.caseTypeIds),
          ...(progression?.caseTypeIds || [])
        ])).slice(0, 8);
        const focusCaseLabel = focusCaseTypeIds
          .map((caseTypeId) => detectiveCaseTypes.find((item) => item.id === caseTypeId)?.label)
          .filter((label): label is string => Boolean(label))
          .slice(0, 3)
          .join(" / ") || eventArchetype.label;
        return enqueueWorldArcDirective(runtime, {
        sourceCaseId: caseId,
        eventArchetypeId: eventArchetype.id,
        sourceFactionKind: sourceFaction?.kind,
        focusCaseTypeIds,
        focusCaseLabel,
        responses: eventArchetype.directiveResponses as DetectiveContentPack["eventArchetypes"][number]["directiveResponses"]
        });
      })()
    : undefined;
  const factionRelationship = runtime
    ? recordAcceptedCaseFactionRelationship(runtime, {
        caseId,
        sourceFactionKind: runtime.worldSystemHints?.faction.kind
      })
    : undefined;
  const completedConvergence = runtime ? completeArcConvergence(runtime, caseId) : undefined;
  const arcConvergence = runtime ? (completedConvergence || refreshArcConvergence(runtime)) : undefined;
  const completedInvestigatorHeadquarters = runtime ? completeInvestigatorHeadquarters(runtime, caseId) : undefined;
  const campaignSession = runtime ? completeCampaignCase(runtime, caseId) : undefined;
  const completedCycleKey = runtime?.campaignSession?.completedCycleKeys.at(-1);
  const investigatorHeadquarters = runtime && campaignSession && campaignSession.status !== "completed" && completedCycleKey
    ? prepareInvestigatorHeadquarters(runtime, { cycleKey: completedCycleKey, sourceCaseId: caseId })
    : runtime
      ? toInvestigatorHeadquartersPublicSummary(runtime)
      : undefined;
  if (runtime && campaignSession) refreshCampaignSession(runtime);
  const campaignFinaleDebrief = runtime ? toCampaignFinaleDebriefPublicSummary(runtime) : undefined;
  const worldLeadCaseHandoff = runtime && worldLeadOutcome && activeOutcome
    ? prepareWorldLeadCaseHandoff(runtime, { settledCaseId: caseId, focus: activeOutcome.focus })
    : undefined;
  if (playerResourceCommitment || worldLeadOutcome || worldLeadCaseHandoff || worldArc || worldArcDirective || factionRelationship || completedConvergence || campaignSession || completedInvestigatorHeadquarters || investigatorHeadquarters || townSocialResponse) persistRuntimeWorld(world);
  return { playerResourceCommitment, factionRelationship, worldLeadOutcome, worldLeadCaseHandoff, worldArc, worldArcDirective, arcConvergence, campaignSession, campaignFinaleDebrief, investigatorHeadquarters, townSocialResponse, worldInfluenceBudget: runtime ? toWorldInfluenceBudgetPublicSummary(runtime) : undefined };
}

export function applyRuntimeIntervention(world: RuntimeWorld, intervention: Omit<TownRuntimeIntervention, "id" | "tick" | "createdAt" | "branch" | "impact">) {
  const result = applyTownRuntimeIntervention(world, intervention);
  const nextWorld = result.world as RuntimeWorld;
  nextWorld.persistentRuntime = result.runtime;
  persistRuntimeWorld(nextWorld);
  return result;
}

export function extractCase(world: RuntimeWorld, events: WorldEvent[], candidate: CaseCandidate) {
  if (world.persistentRuntime && investigatorHeadquartersExtractionRequired(world.persistentRuntime)) {
    throw new Error("INVESTIGATOR_HEADQUARTERS_REQUIRED: Choose one Headquarters preparation before extracting the next case.");
  }
  const result = extractPlayableCaseFromCandidate(world, events, candidate);
  const routeIntegrity = validatePlayableCaseRoute(result.activeCase, result.events);
  if (!routeIntegrity.playable) {
    throw new Error(`CASE_NOT_PLAYABLE: ${routeIntegrity.blockers.join("; ")}`);
  }
  const nextWorld = result.world as RuntimeWorld;
  nextWorld.persistentRuntime = world.persistentRuntime;
  const playerResourceCommitment = nextWorld.persistentRuntime && world.activeCaseId
    ? settleInvestigationOperations(nextWorld.persistentRuntime, { caseId: world.activeCaseId, accepted: false }) || nextWorld.persistentRuntime.playerResourceCommitmentSummary
    : undefined;
  const worldPressureCascade = nextWorld.persistentRuntime
    ? consumeWorldPressurePulseOnExtraction(nextWorld.persistentRuntime, result.activeCase.id)
    : undefined;
  const worldLeadCaseHandoff = nextWorld.persistentRuntime
    ? consumeWorldLeadCaseHandoff(nextWorld.persistentRuntime, result.activeCase.id)
    : undefined;
  let nextCandidate = result.candidate;
  if (nextWorld.persistentRuntime) {
    const arcConvergence = activateArcConvergence(nextWorld.persistentRuntime, {
      caseId: result.activeCase.id,
      caseType: result.candidate.caseType
    });
    activateCampaignCase(nextWorld.persistentRuntime, result.activeCase.id, result.candidate.id);
    activateInvestigatorHeadquarters(nextWorld.persistentRuntime, result.activeCase.id);
    ensureRuntimeWorldSystemHints(nextWorld.persistentRuntime, result.candidate.caseType, result.activeCase.id);
    const resolution = resolveCaseInWorld(nextWorld, nextWorld.persistentRuntime, {
      caseId: result.activeCase.id,
      outcome: result.candidate.validation.valid ? "extracted" : "failed",
      culpritId: result.candidate.culpritId,
      victimId: result.candidate.victimId,
      valid: result.candidate.validation.valid
    });
    nextCandidate = { ...result.candidate, influenceTrace: resolution.influenceTrace };
    nextWorld.persistentRuntime.arcConvergenceSummary = arcConvergence;
    nextWorld.persistentRuntime.candidates = [
      nextCandidate,
      ...nextWorld.persistentRuntime.candidates.filter((item) => item.id !== nextCandidate.id)
    ];
  }
  persistRuntimeWorld(nextWorld, result.events.filter((event) => !events.some((existing) => existing.id === event.id)));
  worldRepository.saveCase(result.activeCase);
  return {
    ...result,
    candidate: nextCandidate,
    world: nextWorld,
    queue: buildTownEmergenceQueue(nextWorld, result.events, nextWorld.persistentRuntime),
    playerResourceCommitment,
    worldLeadCaseHandoff,
    worldPressureCascade,
    worldArc: nextWorld.persistentRuntime?.worldArcSummary,
    investigatorHeadquarters: nextWorld.persistentRuntime?.investigatorHeadquartersSummary,
    arcConvergence: nextWorld.persistentRuntime?.arcConvergenceSummary,
    campaignSession: nextWorld.persistentRuntime?.campaignSessionSummary,
    campaignFinaleDebrief: nextWorld.persistentRuntime?.campaignFinaleDebrief,
    worldInfluenceBudget: nextWorld.persistentRuntime ? toWorldInfluenceBudgetPublicSummary(nextWorld.persistentRuntime) : undefined
  };
}

export function runScenario(world: RuntimeWorld, events: WorldEvent[], config: ScenarioConfig) {
  const result = runTownScenario(world, events, config);
  const nextWorld = result.world as RuntimeWorld;
  nextWorld.persistentRuntime = result.runtime;
  persistRuntimeWorld(nextWorld, result.events);
  return result;
}

export function findScenario(runtime: PersistentTownRuntime, scenarioId?: string | null) {
  const runs = runtime.scenarioRuns || [];
  if (!scenarioId) return runs[0] || null;
  return runs.find((run) => run.id === scenarioId) || null;
}

export function findSnapshot(runtime: PersistentTownRuntime, snapshotId?: string | null) {
  if (!snapshotId) return null;
  return (runtime.snapshots || []).find((snapshot) => snapshot.id === snapshotId) || null;
}

export function publicSnapshot(snapshot: TownStateSnapshot) {
  const { checkpoint: _checkpoint, investigatorProgression: _investigatorProgression, investigatorHeadquarters: _investigatorHeadquarters, ...visible } = snapshot as TownStateSnapshot & { investigatorProgression?: unknown; investigatorHeadquarters?: unknown };
  return visible;
}

export function publicRuntime(runtime: PersistentTownRuntime) {
  const { worldSystemHints: _worldSystemHints, worldLeadDecisions: _worldLeadDecisions, worldLeadOutcome: _worldLeadOutcome, worldLeadCaseHandoff: _worldLeadCaseHandoff, worldArcProgress: _worldArcProgress, worldArcDirectives: _worldArcDirectives, worldPressurePulses: _worldPressurePulses, playerResourceCommitments: _playerResourceCommitments, factionRelationships: _factionRelationships, worldEventOffers: _worldEventOffers, investigatorProgression: _investigatorProgression, investigatorHeadquarters: _investigatorHeadquarters, campaignRecoveries: _campaignRecoveries, arcConvergence: _arcConvergence, campaignSession: _campaignSession, townSocialResponses: _townSocialResponses, ...visibleRuntime } = runtime;
  return {
    ...visibleRuntime,
    worldSystemHintSummary: runtime.worldSystemHintSummary || runtime.worldSystemHints?.summary,
    worldPressureCascadeSummary: runtime.worldPressureCascadeSummary || toWorldPressureCascadePublicSummary(runtime),
    worldInfluenceBudgetSummary: toWorldInfluenceBudgetPublicSummary(runtime),
    investigatorProgressionSummary: runtime.investigatorProgressionSummary || toInvestigatorProgressionPublicSummary(runtime),
    investigatorHeadquartersSummary: runtime.investigatorHeadquartersSummary || toInvestigatorHeadquartersPublicSummary(runtime),
    campaignRecoverySummary: runtime.campaignRecoverySummary || toCampaignRecoveryPublicSummary(runtime),
    arcConvergenceSummary: runtime.arcConvergenceSummary || toArcConvergencePublicSummary(runtime),
    campaignSessionSummary: runtime.campaignSessionSummary || toCampaignSessionPublicSummary(runtime),
    campaignFinaleDebrief: runtime.campaignFinaleDebrief || toCampaignFinaleDebriefPublicSummary(runtime),
    snapshots: (runtime.snapshots || []).map(publicSnapshot)
  };
}

export function publicWorld(world: RuntimeWorld) {
  return {
    ...world,
    persistentRuntime: world.persistentRuntime ? publicRuntime(world.persistentRuntime) : undefined
  };
}

export function diffSnapshots(runtime: PersistentTownRuntime, fromId: string, toId: string) {
  const from = findSnapshot(runtime, fromId);
  const to = findSnapshot(runtime, toId);
  if (!from || !to) return null;
  return { from, to, diff: diffTownStateSnapshots(from, to) };
}

export function rollbackToSnapshot(world: RuntimeWorld, snapshot: TownStateSnapshot) {
  const result = rollbackTownRuntimeToSnapshot(world, snapshot);
  const nextWorld = result.world as RuntimeWorld;
  nextWorld.persistentRuntime = result.runtime;
  persistRuntimeWorld(nextWorld);
  return { ...result, world: nextWorld };
}

function preferredScenarioActorId(world: RuntimeWorld, runtime: PersistentTownRuntime, preset?: ScenarioPreset | null) {
  return preset?.config.branches?.[0]?.interventions?.[0]?.intervention.actorId
    || runtime.agentStates[0]?.npcId
    || world.npcs[0]?.id
    || "npc-1";
}

function sanitizeScenarioPreset(world: RuntimeWorld, runtime: PersistentTownRuntime, preset: ScenarioPreset): ScenarioPreset {
  const firstBranch = preset.config.branches?.[0];
  const actorId = preferredScenarioActorId(world, runtime, preset);
  return {
    id: preset.id,
    name: preset.name,
    description: preset.description,
    updatedAt: new Date().toISOString(),
    config: {
      ...preset.config,
      id: preset.config.id || preset.id,
      name: preset.config.name || preset.name,
      branches: firstBranch ? [{
        ...firstBranch,
        interventions: firstBranch.interventions.slice(0, 1).map((scheduled) => ({
          ...scheduled,
          intervention: {
            ...scheduled.intervention,
            actorId: scheduled.intervention.actorId || actorId
          }
        }))
      }] : []
    }
  };
}

export function listScenarioArtifacts(world: RuntimeWorld, runtime: PersistentTownRuntime): { presets: ScenarioPreset[]; runs: ScenarioRunSummary[] } {
  return {
    presets: listScenarioPresets(world, runtime),
    runs: [...(runtime.scenarioRuns || [])]
      .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
      .map(createScenarioRunSummary)
  };
}

export function saveScenarioPreset(
  world: RuntimeWorld,
  runtime: PersistentTownRuntime,
  preset: ScenarioPreset,
  overwrite = false
) {
  const builtInIds = new Set(createBuiltInScenarioPresets(world, runtime).map((item) => item.id));
  if (builtInIds.has(preset.id)) {
    const error = new Error("Built-in presets are read-only.");
    error.name = "SCENARIO_PRESET_READ_ONLY";
    throw error;
  }
  const current = runtime.scenarioPresets || [];
  const existing = current.find((item) => item.id === preset.id);
  if (existing && !overwrite) {
    const error = new Error(`Scenario preset ${preset.id} already exists.`);
    error.name = "SCENARIO_PRESET_CONFLICT";
    throw error;
  }
  const nextPreset = sanitizeScenarioPreset(world, runtime, preset);
  runtime.scenarioPresets = [nextPreset, ...current.filter((item) => item.id !== nextPreset.id)]
    .sort((left, right) => (right.updatedAt || "").localeCompare(left.updatedAt || ""))
    .slice(0, 20);
  runtime.updatedAt = new Date().toISOString();
  world.persistentRuntime = runtime;
  persistRuntimeWorld(world);
  return { preset: nextPreset, presets: listScenarioPresets(world, runtime) };
}

export function deleteScenarioPreset(world: RuntimeWorld, runtime: PersistentTownRuntime, presetId: string) {
  const builtInIds = new Set(createBuiltInScenarioPresets(world, runtime).map((item) => item.id));
  if (builtInIds.has(presetId)) {
    const error = new Error("Built-in presets are read-only.");
    error.name = "SCENARIO_PRESET_READ_ONLY";
    throw error;
  }
  const current = runtime.scenarioPresets || [];
  if (!current.some((item) => item.id === presetId)) {
    const error = new Error(`Scenario preset ${presetId} was not found.`);
    error.name = "SCENARIO_PRESET_NOT_FOUND";
    throw error;
  }
  runtime.scenarioPresets = current.filter((item) => item.id !== presetId);
  runtime.updatedAt = new Date().toISOString();
  world.persistentRuntime = runtime;
  persistRuntimeWorld(world);
  return { presets: listScenarioPresets(world, runtime) };
}

function stablePackHash(value: unknown) {
  return createStablePackHash(value);
}

function ensureCurrentExperiment(runtime: PersistentTownRuntime) {
  runtime.currentScenarioPackId ||= "small-town-review";
  runtime.currentMapPackId ||= "fog-lamp-town";
  runtime.currentRuleCatalogId ||= "detective-default";
  runtime.currentExperiment ||= {
    scenarioPackId: runtime.currentScenarioPackId,
    mapPackId: runtime.currentMapPackId,
    ruleCatalogId: runtime.currentRuleCatalogId,
    selectedAt: runtime.updatedAt || new Date().toISOString()
  };
  return runtime.currentExperiment;
}

export function listScenarioPacks(world: RuntimeWorld, runtime: PersistentTownRuntime) {
  ensureCurrentExperiment(runtime);
  const experimentPacks = listExperimentRegistryEntries()
    .filter((entry) => entry.validationOk && entry.discovery.scenarioPack)
    .map((entry) => ({
      ...entry.discovery.scenarioPack!,
      builtIn: false,
      source: "experiment-folder" as const,
      current: entry.discovery.scenarioPack!.manifest.id === runtime.currentScenarioPackId || entry.experimentId === runtime.currentExperiment?.experimentId,
      hash: stablePackHash(entry.discovery.scenarioPack),
      experimentId: entry.experimentId,
      experimentHash: entry.experimentHash,
      experimentPathHash: entry.experimentPathHash,
      validation: entry.discovery.validations.scenarioPack,
      validationSummary: entry.validationSummary
    }));
  const worldPackagePacks = listWorldPackageRegistryEntries()
    .filter((entry) => entry.validationOk && entry.discovery.package?.scenarioPack)
    .map((entry) => {
      const pack = entry.discovery.package!.scenarioPack as ScenarioPack;
      return {
        ...pack,
        builtIn: false,
        source: "world-package" as const,
        current: pack.manifest.id === runtime.currentScenarioPackId || entry.worldPackageId === runtime.currentExperiment?.worldPackageId,
        hash: stablePackHash(pack),
        worldPackageId: entry.worldPackageId,
        worldPackageHash: entry.worldPackageHash,
        agentPackId: entry.agentPackId,
        ecosystemCatalogId: entry.ecosystemCatalogId,
        validation: { ok: entry.discovery.ok, summary: entry.discovery.summary },
        validationSummary: entry.validationSummary
      };
    });
  const experimentIds = new Set([...experimentPacks, ...worldPackagePacks].map((pack) => pack.manifest.id));
  const builtIns = builtInScenarioPacks(world)
    .filter((pack) => !experimentIds.has(pack.manifest.id))
    .map((pack) => ({ ...pack, builtIn: true }));
  const builtInIds = new Set(builtIns.map((pack) => pack.manifest.id));
  const custom = ((runtime.scenarioPacks || []) as ScenarioPack[])
    .filter((pack) => !builtInIds.has(pack.manifest.id) && !experimentIds.has(pack.manifest.id))
    .map((pack) => ({ ...pack, builtIn: false }));
  return [...worldPackagePacks, ...experimentPacks, ...builtIns, ...custom].map((pack) => ({
    ...pack,
    source: "source" in pack ? pack.source : pack.builtIn ? "built-in" : "imported",
    current: pack.manifest.id === runtime.currentScenarioPackId,
    hash: stablePackHash(pack)
  }));
}

export function getScenarioPack(world: RuntimeWorld, runtime: PersistentTownRuntime, packId: string) {
  return listScenarioPacks(world, runtime).find((pack) => pack.manifest.id === packId) || null;
}

export function exportScenarioPack(world: RuntimeWorld, runtime: PersistentTownRuntime, options: { packId?: string; scenarioId?: string } = {}) {
  if (options.packId) {
    const existing = getScenarioPack(world, runtime, options.packId);
    if (existing) return existing;
  }
  const scenario = options.scenarioId
    ? findScenario(runtime, options.scenarioId)?.config
    : runtime.scenarioRuns?.[0]?.config;
  return createScenarioPackFromWorld(world, scenario || {}, {
    id: options.packId,
    name: scenario?.name || "Exported Town Scenario",
    description: "Exported from Detective Novel Lab server runtime."
  });
}

export function validateScenarioPackInput(pack: unknown) {
  return validateScenarioPack(pack);
}

export function previewScenarioPack(pack: unknown) {
  return previewScenarioPackImport(pack);
}

export function importScenarioPack(world: RuntimeWorld, runtime: PersistentTownRuntime, pack: ScenarioPack, overwrite = false) {
  const validation = validateScenarioPack(pack);
  if (!validation.ok) {
    const error = new Error(validation.errors.join("; "));
    error.name = "SCENARIO_PACK_INVALID";
    throw error;
  }
  const builtInIds = new Set(builtInScenarioPacks(world).map((item) => item.manifest.id));
  if (builtInIds.has(pack.manifest.id)) {
    const error = new Error(`ScenarioPack ${pack.manifest.id} is built-in and cannot be overwritten.`);
    error.name = "SCENARIO_PRESET_READ_ONLY";
    throw error;
  }
  const current = (runtime.scenarioPacks || []) as ScenarioPack[];
  const exists = current.some((item) => item.manifest.id === pack.manifest.id);
  if (exists && !overwrite) {
    const error = new Error(`ScenarioPack ${pack.manifest.id} already exists.`);
    error.name = "SCENARIO_PRESET_CONFLICT";
    throw error;
  }
  runtime.scenarioPacks = [pack, ...current.filter((item) => item.manifest.id !== pack.manifest.id)].slice(0, 20);
  runtime.packRegistry = [
    { id: pack.manifest.id, kind: "scenario" as const, name: pack.manifest.name, version: pack.manifest.version, source: "imported" as const, hash: stablePackHash(pack), importedAt: new Date().toISOString() },
    ...(runtime.packRegistry || []).filter((item) => !(item.kind === "scenario" && item.id === pack.manifest.id))
  ].slice(0, 40);
  runtime.updatedAt = new Date().toISOString();
  world.persistentRuntime = runtime;
  persistRuntimeWorld(world);
  return { pack, packs: listScenarioPacks(world, runtime), scenarioConfig: scenarioPackToScenarioConfig(pack) };
}

export function listTownMapPacks(world: RuntimeWorld, runtime: PersistentTownRuntime) {
  ensureCurrentExperiment(runtime);
  const experimentPacks = listExperimentRegistryEntries()
    .filter((entry) => entry.validationOk && entry.discovery.mapPack)
    .map((entry) => ({
      ...entry.discovery.mapPack!,
      builtIn: false,
      source: "experiment-folder" as const,
      current: entry.discovery.mapPack!.manifest.id === runtime.currentMapPackId || entry.experimentId === runtime.currentExperiment?.experimentId,
      hash: stablePackHash(entry.discovery.mapPack),
      experimentId: entry.experimentId,
      experimentHash: entry.experimentHash,
      experimentPathHash: entry.experimentPathHash,
      validation: entry.discovery.validations.mapPack,
      validationSummary: entry.validationSummary
    }));
  const worldPackagePacks = listWorldPackageRegistryEntries()
    .filter((entry) => entry.validationOk && entry.discovery.package?.mapPack)
    .map((entry) => {
      const pack = entry.discovery.package!.mapPack as TownMapPack;
      return {
        ...pack,
        builtIn: false,
        source: "world-package" as const,
        current: pack.manifest.id === runtime.currentMapPackId || entry.worldPackageId === runtime.currentExperiment?.worldPackageId,
        hash: stablePackHash(pack),
        worldPackageId: entry.worldPackageId,
        worldPackageHash: entry.worldPackageHash,
        agentPackId: entry.agentPackId,
        ecosystemCatalogId: entry.ecosystemCatalogId,
        validation: { ok: entry.discovery.ok, summary: entry.discovery.summary },
        validationSummary: entry.validationSummary
      };
    });
  const experimentIds = new Set([...experimentPacks, ...worldPackagePacks].map((pack) => pack.manifest.id));
  const builtIns = builtInTownMapPacks(world)
    .filter((pack) => !experimentIds.has(pack.manifest.id))
    .map((pack) => ({ ...pack, builtIn: true }));
  const builtInIds = new Set(builtIns.map((pack) => pack.manifest.id));
  const custom = ((runtime.mapPacks || []) as TownMapPack[])
    .filter((pack) => !builtInIds.has(pack.manifest.id) && !experimentIds.has(pack.manifest.id))
    .map((pack) => ({ ...pack, builtIn: false }));
  return [...worldPackagePacks, ...experimentPacks, ...builtIns, ...custom].map((pack) => ({
    ...pack,
    source: "source" in pack ? pack.source : pack.builtIn ? "built-in" : "imported",
    current: pack.manifest.id === runtime.currentMapPackId,
    hash: stablePackHash(pack)
  }));
}

export function getTownMapPack(world: RuntimeWorld, runtime: PersistentTownRuntime, packId: string) {
  return listTownMapPacks(world, runtime).find((pack) => pack.manifest.id === packId) || null;
}

export function exportTownMapPack(world: RuntimeWorld, runtime: PersistentTownRuntime, options: { packId?: string } = {}) {
  if (options.packId) {
    const existing = getTownMapPack(world, runtime, options.packId);
    if (existing) return existing;
  }
  return createTownMapPackFromWorld(world, {
    id: options.packId,
    name: "Exported Town Map",
    description: "Exported semantic map from Detective Novel Lab server runtime."
  });
}

export function validateTownMapPackInput(pack: unknown) {
  return validateTownMapPack(pack);
}

export function previewTownMapPack(pack: unknown) {
  return previewTownMapPackImport(pack);
}

export function importTownMapPack(world: RuntimeWorld, runtime: PersistentTownRuntime, pack: TownMapPack, overwrite = false) {
  const validation = validateTownMapPack(pack);
  if (!validation.ok) {
    const error = new Error(validation.errors.join("; "));
    error.name = "TOWN_MAP_PACK_INVALID";
    throw error;
  }
  const builtInIds = new Set(builtInTownMapPacks(world).map((item) => item.manifest.id));
  if (builtInIds.has(pack.manifest.id)) {
    const error = new Error(`TownMapPack ${pack.manifest.id} is built-in and cannot be overwritten.`);
    error.name = "TOWN_MAP_PACK_READ_ONLY";
    throw error;
  }
  const current = (runtime.mapPacks || []) as TownMapPack[];
  const exists = current.some((item) => item.manifest.id === pack.manifest.id);
  if (exists && !overwrite) {
    const error = new Error(`TownMapPack ${pack.manifest.id} already exists.`);
    error.name = "TOWN_MAP_PACK_CONFLICT";
    throw error;
  }
  runtime.mapPacks = [pack, ...current.filter((item) => item.manifest.id !== pack.manifest.id)].slice(0, 20);
  runtime.packRegistry = [
    { id: pack.manifest.id, kind: "map" as const, name: pack.manifest.name, version: pack.manifest.version, source: "imported" as const, hash: stablePackHash(pack), importedAt: new Date().toISOString() },
    ...(runtime.packRegistry || []).filter((item) => !(item.kind === "map" && item.id === pack.manifest.id))
  ].slice(0, 40);
  runtime.updatedAt = new Date().toISOString();
  world.persistentRuntime = runtime;
  persistRuntimeWorld(world);
  return { pack, packs: listTownMapPacks(world, runtime) };
}

export function listTownRuleCatalogs(world: RuntimeWorld, runtime: PersistentTownRuntime) {
  ensureCurrentExperiment(runtime);
  const catalog = createDefaultTownRuleCatalog(world, runtime.tick || 0);
  const experimentCatalogs = listExperimentRegistryEntries()
    .filter((entry) => entry.validationOk && entry.discovery.ruleCatalog)
    .map((entry) => ({
      ...entry.discovery.ruleCatalog!,
      source: "experiment-folder",
      current: entry.discovery.ruleCatalog!.id === runtime.currentRuleCatalogId || entry.experimentId === runtime.currentExperiment?.experimentId,
      hash: stablePackHash(entry.discovery.ruleCatalog),
      experimentId: entry.experimentId,
      experimentHash: entry.experimentHash,
      experimentPathHash: entry.experimentPathHash,
      validation: entry.discovery.validations.ruleCatalog
    }));
  const worldPackageCatalogs = listWorldPackageRegistryEntries()
    .filter((entry) => entry.validationOk && entry.discovery.package?.ruleCatalog)
    .map((entry) => {
      const catalog = entry.discovery.package!.ruleCatalog as TownRuleCatalog;
      return {
        ...catalog,
        source: "world-package",
        current: catalog.id === runtime.currentRuleCatalogId || entry.worldPackageId === runtime.currentExperiment?.worldPackageId,
        hash: stablePackHash(catalog),
        worldPackageId: entry.worldPackageId,
        worldPackageHash: entry.worldPackageHash,
        agentPackId: entry.agentPackId,
        ecosystemCatalogId: entry.ecosystemCatalogId,
        validation: validateTownRuleCatalog(catalog)
      };
    });
  const experimentIds = new Set([...experimentCatalogs, ...worldPackageCatalogs].map((entry) => entry.id));
  return {
    catalogs: [...worldPackageCatalogs, ...experimentCatalogs, ...(!experimentIds.has(catalog.id) ? [{
      ...catalog,
      source: "built-in",
      current: runtime.currentRuleCatalogId === catalog.id,
      hash: stablePackHash(catalog),
      validation: validateTownRuleCatalog(catalog)
    }] : [])]
  };
}

function getTownRuleCatalog(world: RuntimeWorld, runtime: PersistentTownRuntime, catalogId: string): TownRuleCatalog | null {
  return listTownRuleCatalogs(world, runtime).catalogs.find((catalog) => catalog.id === catalogId) || null;
}

export function selectCurrentExperiment(
  world: RuntimeWorld,
  runtime: PersistentTownRuntime,
  input: { scenarioPackId?: string; mapPackId?: string; ruleCatalogId?: string; campaignRouteId?: DetectiveCampaignRouteId }
) {
  const routeLocked = Boolean(runtime.campaignSession?.activeCaseId || runtime.campaignSession?.completedCycleKeys?.length);
  if (input.campaignRouteId && routeLocked && runtime.campaignSession?.routeId !== input.campaignRouteId) {
    const error = new Error("The authored Campaign route is frozen after the first successful extraction.");
    error.name = "CAMPAIGN_ROUTE_LOCKED";
    throw error;
  }
  const requestedScenarioPackId = input.scenarioPackId || runtime.currentScenarioPackId || "small-town-review";
  const worldPackage = findWorldPackageRegistryEntryById(requestedScenarioPackId);
  const useWorldPackageContract = worldPackage?.validationOk
    && worldPackage.scenarioPackId === requestedScenarioPackId
    && worldPackage.mapPackId
    && worldPackage.ruleCatalogId;
  const folderExperiment = findExperimentRegistryEntryById(requestedScenarioPackId);
  const useFolderContract = folderExperiment?.validationOk
    && folderExperiment.scenarioPackId === requestedScenarioPackId
    && folderExperiment.mapPackId
    && folderExperiment.ruleCatalogId;
  const scenarioPackId = useWorldPackageContract ? worldPackage.scenarioPackId! : useFolderContract ? folderExperiment.scenarioPackId! : requestedScenarioPackId;
  const mapPackId = useWorldPackageContract
    ? worldPackage.mapPackId!
    : useFolderContract
    ? folderExperiment.mapPackId!
    : input.mapPackId || runtime.currentMapPackId || "fog-lamp-town";
  const ruleCatalogId = useWorldPackageContract
    ? worldPackage.ruleCatalogId!
    : useFolderContract
    ? folderExperiment.ruleCatalogId!
    : input.ruleCatalogId || runtime.currentRuleCatalogId || "detective-default";
  if (!getScenarioPack(world, runtime, scenarioPackId)) {
    const error = new Error(`ScenarioPack ${scenarioPackId} was not found.`);
    error.name = "EXPERIMENT_PACK_NOT_FOUND";
    throw error;
  }
  if (!getTownMapPack(world, runtime, mapPackId)) {
    const error = new Error(`TownMapPack ${mapPackId} was not found.`);
    error.name = "EXPERIMENT_PACK_NOT_FOUND";
    throw error;
  }
  if (!getTownRuleCatalog(world, runtime, ruleCatalogId)) {
    const error = new Error(`Rule catalog ${ruleCatalogId} was not found.`);
    error.name = "EXPERIMENT_PACK_NOT_FOUND";
    throw error;
  }
  const experiment = (useFolderContract ? folderExperiment : null)
    || findExperimentRegistryEntryByPackIds({ scenarioPackId, mapPackId, ruleCatalogId })
    || findExperimentRegistryEntryById(scenarioPackId);
  const selectedWorldPackage = (useWorldPackageContract ? worldPackage : null)
    || findWorldPackageRegistryEntryByPackIds({ scenarioPackId, mapPackId, ruleCatalogId })
    || findWorldPackageRegistryEntryById(scenarioPackId);
  const now = new Date().toISOString();
  runtime.currentScenarioPackId = scenarioPackId;
  runtime.currentMapPackId = mapPackId;
  runtime.currentRuleCatalogId = ruleCatalogId;
  runtime.currentExperiment = {
    scenarioPackId,
    mapPackId,
    ruleCatalogId,
    selectedAt: now,
    experimentId: experiment?.experimentId,
    experimentHash: experiment?.experimentHash,
    experimentPathHash: experiment?.experimentPathHash,
    worldPackageId: selectedWorldPackage?.worldPackageId,
    worldPackageHash: selectedWorldPackage?.worldPackageHash,
    agentPackId: selectedWorldPackage?.agentPackId,
    ecosystemCatalogId: selectedWorldPackage?.ecosystemCatalogId
  };
  if (input.campaignRouteId && !bindCampaignRoute(runtime, input.campaignRouteId)) {
    const error = new Error("The authored Campaign route is frozen after the first successful extraction.");
    error.name = "CAMPAIGN_ROUTE_LOCKED";
    throw error;
  }
  refreshCampaignSession(runtime);
  refreshArcConvergence(runtime);
  refreshCampaignSession(runtime);
  runtime.updatedAt = now;
  world.persistentRuntime = runtime;
  persistRuntimeWorld(world);
  return {
    currentExperiment: runtime.currentExperiment,
    campaignSession: runtime.campaignSessionSummary,
    arcConvergence: runtime.arcConvergenceSummary,
    scenarioPacks: listScenarioPacks(world, runtime),
    mapPacks: listTownMapPacks(world, runtime),
    ruleCatalogs: listTownRuleCatalogs(world, runtime).catalogs
  };
}

export function startNewRunFromCurrentExperiment(world: RuntimeWorld, runtime: PersistentTownRuntime) {
  ensureCurrentExperiment(runtime);
  const scenarioPackId = runtime.currentScenarioPackId || "small-town-review";
  const mapPackId = runtime.currentMapPackId || "fog-lamp-town";
  const ruleCatalogId = runtime.currentRuleCatalogId || "detective-default";
  const worldPackage = findWorldPackageRegistryEntryByPackIds({ scenarioPackId, mapPackId, ruleCatalogId })
    || findWorldPackageRegistryEntryById(runtime.currentExperiment?.worldPackageId || scenarioPackId);
  const useWorldPackage = worldPackage?.validationOk && worldPackage.discovery.package;
  const experiment = findExperimentRegistryEntryByPackIds({ scenarioPackId, mapPackId, ruleCatalogId })
    || findExperimentRegistryEntryById(runtime.currentExperiment?.experimentId || scenarioPackId);
  const useExperiment = experiment?.validationOk && experiment.discovery.scenarioPack && experiment.discovery.mapPack && experiment.discovery.ruleCatalog;
  const pack = useWorldPackage
    ? worldPackage.discovery.package!.scenarioPack as ScenarioPack
    : useExperiment
    ? experiment.discovery.scenarioPack!
    : getScenarioPack(world, runtime, scenarioPackId);
  const mapPack = useWorldPackage
    ? worldPackage.discovery.package!.mapPack as TownMapPack
    : useExperiment
    ? experiment.discovery.mapPack!
    : getTownMapPack(world, runtime, mapPackId);
  const ruleCatalog = useWorldPackage
    ? worldPackage.discovery.package!.ruleCatalog as TownRuleCatalog
    : useExperiment
    ? experiment.discovery.ruleCatalog!
    : getTownRuleCatalog(world, runtime, ruleCatalogId);
  if (!pack || !mapPack || !ruleCatalog) {
    const error = new Error("Current experiment is incomplete.");
    error.name = "EXPERIMENT_PACK_NOT_FOUND";
    throw error;
  }
  const runId = `packrun-${pack.manifest.id}-${Date.now().toString(36)}`.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const branch = createWorldFromScenarioPack(pack, mapPack, ruleCatalog, {
    sourceWorldId: world.id,
    runId,
    engineVersion: "persistent-town.v1"
  });
  const createdExperiment = branch.runtime.currentExperiment || {
    scenarioPackId: pack.manifest.id,
    mapPackId: mapPack.manifest.id,
    ruleCatalogId: ruleCatalog.id,
    selectedAt: new Date().toISOString()
  };
  branch.runtime.currentExperiment = {
    ...createdExperiment,
    experimentId: useExperiment ? experiment.experimentId : runtime.currentExperiment?.experimentId,
    experimentHash: useExperiment ? experiment.experimentHash : runtime.currentExperiment?.experimentHash,
    experimentPathHash: useExperiment ? experiment.experimentPathHash : runtime.currentExperiment?.experimentPathHash,
    worldPackageId: useWorldPackage ? worldPackage.worldPackageId : runtime.currentExperiment?.worldPackageId,
    worldPackageHash: useWorldPackage ? worldPackage.worldPackageHash : runtime.currentExperiment?.worldPackageHash,
    agentPackId: useWorldPackage ? worldPackage.agentPackId : runtime.currentExperiment?.agentPackId,
    ecosystemCatalogId: useWorldPackage ? worldPackage.ecosystemCatalogId : runtime.currentExperiment?.ecosystemCatalogId
  };
  branch.runtime.currentScenarioPackId = pack.manifest.id;
  branch.runtime.currentMapPackId = mapPack.manifest.id;
  branch.runtime.currentRuleCatalogId = ruleCatalog.id;
  branch.runtime.scenarioPacks = [pack];
  branch.runtime.mapPacks = [mapPack];
  branch.runtime.packRegistry = [
    { id: pack.manifest.id, kind: "scenario", name: pack.manifest.name, version: pack.manifest.version, source: useWorldPackage ? "imported" : useExperiment ? "experiment-folder" : "imported", current: true, hash: branch.manifest.scenarioPackHash, experimentId: experiment?.experimentId, experimentHash: experiment?.experimentHash, worldPackageId: worldPackage?.worldPackageId, worldPackageHash: worldPackage?.worldPackageHash, validationOk: useWorldPackage ? worldPackage?.validationOk : experiment?.validationOk },
    { id: mapPack.manifest.id, kind: "map", name: mapPack.manifest.name, version: mapPack.manifest.version, source: useWorldPackage ? "imported" : useExperiment ? "experiment-folder" : "imported", current: true, hash: branch.manifest.mapPackHash, experimentId: experiment?.experimentId, experimentHash: experiment?.experimentHash, worldPackageId: worldPackage?.worldPackageId, worldPackageHash: worldPackage?.worldPackageHash, validationOk: useWorldPackage ? worldPackage?.validationOk : experiment?.validationOk },
    { id: ruleCatalog.id, kind: "rule-catalog", name: ruleCatalog.name, version: ruleCatalog.version, source: useWorldPackage ? "imported" : useExperiment ? "experiment-folder" : "built-in", current: true, hash: branch.manifest.ruleCatalogHash, experimentId: experiment?.experimentId, experimentHash: experiment?.experimentHash, worldPackageId: worldPackage?.worldPackageId, worldPackageHash: worldPackage?.worldPackageHash, validationOk: useWorldPackage ? worldPackage?.validationOk : experiment?.validationOk }
  ];
  const scenarioId = runId;
  branch.runtime.scenarioPresets = [{
    id: scenarioId,
    name: branch.scenarioConfig.name || pack.manifest.name,
    description: `Scenario generated from ScenarioPack ${pack.manifest.id}.`,
    updatedAt: new Date().toISOString(),
    config: { ...branch.scenarioConfig, id: scenarioId }
  }];
  worldRepository.saveWorldBundle({ world: branch.world, events: [] });
  const job = startRunJob(branch.world as RuntimeWorld, branch.runtime, "scenario", scenarioId);
  return {
    sourceWorldId: world.id,
    worldId: branch.world.id,
    currentExperiment: branch.runtime.currentExperiment,
    job
  };
}

export function listRuntimeRuns(runtime: PersistentTownRuntime) {
  const runtimeRows = listRunCatalog(runtime);
  const artifactRows = listRunArtifactManifests(20).map(artifactManifestToRunCatalogEntry);
  const byId = new Map<string, ReturnType<typeof artifactManifestToRunCatalogEntry>>();
  for (const row of [...runtimeRows, ...artifactRows]) byId.set(row.runId, row);
  const sortKey = (entry: ReturnType<typeof artifactManifestToRunCatalogEntry>) => entry.finishedAt || entry.startedAt || entry.runId || "";
  return {
    runs: Array.from(byId.values())
      .sort((left, right) => sortKey(right).localeCompare(sortKey(left)))
      .slice(0, 20)
  };
}

export function getRuntimeRun(runtime: PersistentTownRuntime, runId: string) {
  const artifact = loadRunArtifactManifest(runId);
  if (artifact) return artifactManifestToRunCatalogEntry(artifact);
  return findRunCatalogEntry(runtime, runId);
}

export function getRuntimeRunSnapshots(runtime: PersistentTownRuntime, runId: string) {
  const artifactSnapshots = loadRunArtifactFile<ReturnType<typeof publicSnapshot>[]>(runId, "snapshots.json");
  if (artifactSnapshots) return artifactSnapshots;
  return snapshotsForRun(runtime, runId).map(publicSnapshot);
}

export function getRuntimeRunDiffs(runtime: PersistentTownRuntime, runId: string) {
  const artifactDiffs = loadRunArtifactFile<ReturnType<typeof diffsForRun>>(runId, "diffs.json");
  if (artifactDiffs) return artifactDiffs;
  return diffsForRun(runtime, runId);
}

export function compareRuntimeRuns(runtime: PersistentTownRuntime, left: string, right: string) {
  return compareRuns(runtime, left, right);
}

export function buildRuntimeReplayBundle(runtime: PersistentTownRuntime, runId: string, benchmark?: EmergenceBenchmarkReport | null) {
  const artifactBundle = buildReplayBundleFromArtifacts(runId);
  if (artifactBundle) return artifactBundle;
  return buildRunReplayBundle(runtime, runId, benchmark);
}

function benchmarkSeeds(seedCount: number) {
  return Array.from({ length: Math.max(1, seedCount) }, (_, index) => `emergence-benchmark-${String(index + 1).padStart(2, "0")}`);
}

function aggregateBenchmarkReport(results: EmergenceBenchmarkReport["results"]): EmergenceBenchmarkReport {
  const seedCount = results.length;
  const passed = results.filter((result) => result.passed).length;
  const sum = (field: "qualityScore" | "emergenceScore" | "autoSolveStepCount") => results.reduce((total, result) => total + (result[field] || 0), 0);
  const rate = (field: "sixStageComplete" | "realCaseTriggered" | "routeCertified" | "autoSolvePassed") => seedCount
    ? Math.round((results.filter((result) => result[field]).length / seedCount) * 100)
    : 0;
  const matureTicks = results.map((result) => result.matureTick).filter((value): value is number => typeof value === "number");
  return {
    generatedAt: new Date().toISOString(),
    seedCount,
    passed,
    failed: seedCount - passed,
    averageQualityScore: seedCount ? Math.round(sum("qualityScore") / seedCount) : 0,
    averageEmergenceScore: seedCount ? Math.round(sum("emergenceScore") / seedCount) : 0,
    sixStageCompleteRate: rate("sixStageComplete"),
    realCaseTriggerRate: rate("realCaseTriggered"),
    averageMatureTick: matureTicks.length ? Math.round(matureTicks.reduce((total, value) => total + value, 0) / matureTicks.length) : undefined,
    routeCertifiedRate: rate("routeCertified"),
    autoSolvePassRate: rate("autoSolvePassed"),
    averageAutoSolveSteps: seedCount ? Math.round(sum("autoSolveStepCount") / seedCount) : 0,
    passRate: seedCount ? Math.round((passed / seedCount) * 100) : 0,
    results
  };
}

function artifactScenarioPack(world: RuntimeWorld, runtime: PersistentTownRuntime) {
  return (runtime.scenarioPacks || []).find((pack) => pack.manifest.id === runtime.currentScenarioPackId)
    || getScenarioPack(world, runtime, runtime.currentScenarioPackId || "small-town-review");
}

function artifactMapPack(world: RuntimeWorld, runtime: PersistentTownRuntime) {
  return (runtime.mapPacks || []).find((pack) => pack.manifest.id === runtime.currentMapPackId)
    || getTownMapPack(world, runtime, runtime.currentMapPackId || "fog-lamp-town");
}

function artifactRuleCatalog(world: RuntimeWorld, runtime: PersistentTownRuntime) {
  return getTownRuleCatalog(world, runtime, runtime.currentRuleCatalogId || "detective-default");
}

function currentExperimentRegistry(runtime: PersistentTownRuntime) {
  return runtime.currentExperiment?.experimentId
    ? findExperimentRegistryEntryById(runtime.currentExperiment.experimentId)
    : findExperimentRegistryEntryByPackIds({
        scenarioPackId: runtime.currentScenarioPackId,
        mapPackId: runtime.currentMapPackId,
        ruleCatalogId: runtime.currentRuleCatalogId
      });
}

function scenarioQualitySummary(runEntry: NonNullable<ReturnType<typeof findRunCatalogEntry>>) {
  return {
    ok: runEntry.status === "passed" || runEntry.status === "completed",
    runId: runEntry.runId,
    qualityScore: runEntry.summary.validCandidateCount,
    summary: runEntry.summary
  };
}

function writeScenarioRunArtifacts(world: RuntimeWorld, runtime: PersistentTownRuntime, runId: string) {
  const replayBundle = buildRunReplayBundle(runtime, runId);
  const runEntry = findRunCatalogEntry(runtime, runId);
  if (!replayBundle || !runEntry) return null;
  const reviewBundle = buildReviewExportBundle(world, runtime, { scenarioId: runId });
  const scenarioPack = artifactScenarioPack(world, runtime);
  const mapPack = artifactMapPack(world, runtime);
  const ruleCatalog = artifactRuleCatalog(world, runtime);
  const experiment = currentExperimentRegistry(runtime);
  const catalogValidation = ruleCatalog ? validateTownRuleCatalog(ruleCatalog) : null;
  return saveRunArtifacts({
    manifest: {
      runId,
      kind: "scenario",
      status: runEntry.status,
      sourceWorldId: runtime.currentExperiment?.sourceWorldId,
      branchWorldId: world.id,
      scenarioId: runId,
      scenarioPackId: runtime.currentScenarioPackId,
      scenarioPackHash: runtime.currentExperiment?.scenarioPackHash || (scenarioPack ? stablePackHash(scenarioPack) : undefined),
      mapPackId: runtime.currentMapPackId,
      mapPackHash: runtime.currentExperiment?.mapPackHash || (mapPack ? stablePackHash(mapPack) : undefined),
      ruleCatalogId: runtime.currentRuleCatalogId,
      ruleCatalogHash: runtime.currentExperiment?.ruleCatalogHash || (ruleCatalog ? stablePackHash(ruleCatalog) : undefined),
      experimentId: runtime.currentExperiment?.experimentId || experiment?.experimentId,
      experimentHash: runtime.currentExperiment?.experimentHash || experiment?.experimentHash,
      qualityScore: runEntry.summary.validCandidateCount,
      catalogValidationOk: catalogValidation?.ok,
      engineVersion: runEntry.engineVersion,
      startedAt: runEntry.startedAt,
      finishedAt: runEntry.finishedAt,
      summary: runEntry.summary
    },
    scenarioPack,
    mapPack,
    ruleCatalog,
    runSummary: runEntry,
    snapshots: getRuntimeRunSnapshots(runtime, runId),
    diffs: getRuntimeRunDiffs(runtime, runId),
    commands: replayBundle.commands,
    experimentManifest: experiment?.discovery.manifest || runtime.currentExperiment,
    experimentSteps: experiment?.discovery.steps,
    qualityReport: scenarioQualitySummary(runEntry),
    catalogValidation,
    replayBundle,
    reviewBundle
  });
}

function writeBenchmarkRunArtifacts(world: RuntimeWorld, runtime: PersistentTownRuntime, summary: NonNullable<ReturnType<typeof storeBenchmarkRun>>) {
  const runEntry = findRunCatalogEntry(runtime, summary.runId);
  const scenarioPack = artifactScenarioPack(world, runtime);
  const mapPack = artifactMapPack(world, runtime);
  const ruleCatalog = artifactRuleCatalog(world, runtime);
  const experiment = currentExperimentRegistry(runtime);
  const catalogValidation = ruleCatalog ? validateTownRuleCatalog(ruleCatalog) : null;
  if (!runEntry) return null;
  return saveRunArtifacts({
    manifest: {
      runId: summary.runId,
      kind: "benchmark",
      status: runEntry.status,
      sourceWorldId: runtime.currentExperiment?.sourceWorldId,
      branchWorldId: world.id,
      scenarioPackId: summary.packId || runtime.currentScenarioPackId,
      scenarioPackHash: summary.packHash || runtime.currentExperiment?.scenarioPackHash || (scenarioPack ? stablePackHash(scenarioPack) : undefined),
      mapPackId: summary.mapPackId || runtime.currentMapPackId,
      mapPackHash: runtime.currentExperiment?.mapPackHash || (mapPack ? stablePackHash(mapPack) : undefined),
      ruleCatalogId: summary.ruleCatalogId || runtime.currentRuleCatalogId,
      ruleCatalogHash: runtime.currentExperiment?.ruleCatalogHash || (ruleCatalog ? stablePackHash(ruleCatalog) : undefined),
      experimentId: runtime.currentExperiment?.experimentId || experiment?.experimentId,
      experimentHash: runtime.currentExperiment?.experimentHash || experiment?.experimentHash,
      qualityScore: summary.passRate,
      catalogValidationOk: catalogValidation?.ok,
      engineVersion: runEntry.engineVersion,
      startedAt: summary.startedAt || runEntry.startedAt,
      finishedAt: summary.finishedAt || runEntry.finishedAt,
      summary: runEntry.summary
    },
    scenarioPack,
    mapPack,
    ruleCatalog,
    runSummary: runEntry,
    snapshots: [],
    diffs: [],
    commands: [],
    benchmarkSummary: summary,
    experimentManifest: experiment?.discovery.manifest || runtime.currentExperiment,
    experimentSteps: experiment?.discovery.steps,
    qualityReport: { ok: summary.failed === 0, runId: summary.runId, qualityScore: summary.passRate, summary },
    catalogValidation,
    replayBundle: buildRunReplayBundle(runtime, summary.runId)
  });
}

function storeBenchmarkRun(runtime: PersistentTownRuntime, report: EmergenceBenchmarkReport) {
  const summary = benchmarkToRunSummary(report);
  if (!summary) return null;
  const enriched = {
    ...summary,
    packId: runtime.currentScenarioPackId,
    mapPackId: runtime.currentMapPackId,
    ruleCatalogId: runtime.currentRuleCatalogId,
    packHash: stablePackHash(runtime.currentExperiment || {})
  };
  runtime.benchmarkRuns = [enriched, ...(runtime.benchmarkRuns || []).filter((item) => item.runId !== enriched.runId)].slice(0, 20);
  return enriched;
}

export function startRunJob(world: RuntimeWorld, runtime: PersistentTownRuntime, kind: "scenario" | "benchmark", scenarioId?: string, seedCount = 10) {
  const job = createRunJob({ worldId: world.id, kind, scenarioId, seedCount: kind === "benchmark" ? seedCount : undefined });
  const queuedJob: RunJob = {
    ...job,
    status: "queued",
    updatedAt: new Date().toISOString(),
    progress: {
      ...job.progress,
      phase: kind === "scenario" ? "queued-scenario" : "queued-benchmark",
      currentAction: kind === "scenario" ? "waiting for scenario tick" : "waiting for benchmark seed tick",
      percent: 1
    },
    result: kind === "benchmark"
      ? { seedCount, completedSeeds: 0, seeds: benchmarkSeeds(seedCount), results: [] }
      : undefined
  };
  runtime.runJobs = [queuedJob, ...(runtime.runJobs || [])].slice(0, 20);
  runtime.updatedAt = queuedJob.updatedAt;
  world.persistentRuntime = runtime;
  persistRuntimeWorld(world);
  return queuedJob;
}

export function tickRunJob(world: RuntimeWorld, runtime: PersistentTownRuntime, jobId: string) {
  const existing = (runtime.runJobs || []).find((job) => job.id === jobId);
  if (!existing) return null;
  if (existing.status === "completed" || existing.status === "failed" || existing.status === "cancelled" || existing.status === "paused") return existing;
  const startedAt = Date.now();
  const mark = (job: RunJob) => {
    runtime.runJobs = [job, ...(runtime.runJobs || []).filter((item) => item.id !== job.id)].slice(0, 20);
    runtime.updatedAt = job.updatedAt;
    world.persistentRuntime = runtime;
    persistRuntimeWorld(world);
    return job;
  };
  try {
    if (existing.kind === "scenario") {
      const preset = listScenarioPresets(world, runtime).find((item) => item.id === existing.scenarioId) || listScenarioPresets(world, runtime)[0];
      const config = {
        ...(preset?.config || {}),
        id: existing.scenarioId || preset?.config.id || preset?.id || existing.id,
        baselineSteps: Math.min(3, preset?.config.baselineSteps || 3)
      };
      const result = runScenario(world, eventsForWorld(world.id), config);
      const completedAt = new Date().toISOString();
      const completedJob: RunJob = {
        ...existing,
        status: "completed",
        runId: result.run.id,
        resultRunId: result.run.id,
        scenarioId: result.run.id,
        updatedAt: completedAt,
        progress: {
          tick: result.runtime.tick,
          phase: "completed",
          currentAction: "scenario-run",
          elapsedMs: (existing.progress.elapsedMs || 0) + Date.now() - startedAt,
          percent: 100
        },
        result: {
          runId: result.run.id,
          passed: result.report.passed,
          summary: result.report.summary,
          snapshotCount: result.snapshots.filter((snapshot) => snapshot.scenarioId === result.run.id).length
        }
      };
      const nextWorld = result.world as RuntimeWorld;
      nextWorld.persistentRuntime = result.runtime;
      result.runtime.runJobs = [completedJob, ...(result.runtime.runJobs || []).filter((item) => item.id !== existing.id)].slice(0, 20);
      result.runtime.updatedAt = completedAt;
      const artifactManifest = writeScenarioRunArtifacts(nextWorld, result.runtime, result.run.id);
      completedJob.result = { ...(completedJob.result as object), artifact: artifactManifest };
      result.runtime.runJobs = [completedJob, ...(result.runtime.runJobs || []).filter((item) => item.id !== existing.id)].slice(0, 20);
      persistRuntimeWorld(nextWorld);
      return completedJob;
    }
    const partial = (existing.result || {}) as { seedCount?: number; completedSeeds?: number; seeds?: string[]; results?: EmergenceBenchmarkReport["results"] };
    const seedCount = existing.seedCount || partial.seedCount || 10;
    const seeds = partial.seeds?.length ? partial.seeds : benchmarkSeeds(seedCount);
    const completedSeeds = partial.completedSeeds || 0;
    const seed = seeds[completedSeeds];
    if (!seed) {
      const report = aggregateBenchmarkReport(partial.results || []);
      const summary = storeBenchmarkRun(runtime, report);
      const artifactManifest = summary ? writeBenchmarkRunArtifacts(world, runtime, summary) : null;
      return mark({
        ...existing,
        status: "completed",
        runId: summary?.runId || `benchmark-${report.generatedAt}`,
        resultRunId: summary?.runId || `benchmark-${report.generatedAt}`,
        updatedAt: report.generatedAt,
        progress: { ...existing.progress, phase: "completed", currentAction: "benchmark-complete", elapsedMs: existing.progress.elapsedMs, tick: completedSeeds, percent: 100 },
        result: { ...partial, completedSeeds, report, summary, artifact: artifactManifest || undefined }
      });
    }
    const singleSeedReport = runEmergenceBenchmark([seed]);
    const results = [...(partial.results || []), ...singleSeedReport.results];
    const nextCompleted = completedSeeds + 1;
    const report = aggregateBenchmarkReport(results);
    const completed = nextCompleted >= seeds.length;
    const summary = completed ? storeBenchmarkRun(runtime, report) : null;
    const artifactManifest = summary ? writeBenchmarkRunArtifacts(world, runtime, summary) : null;
    return mark({
      ...existing,
      status: completed ? "completed" : "running",
      runId: completed ? summary?.runId || `benchmark-${report.generatedAt}` : existing.runId,
      resultRunId: completed ? summary?.runId || `benchmark-${report.generatedAt}` : existing.resultRunId,
      updatedAt: new Date().toISOString(),
      progress: {
        tick: nextCompleted,
        phase: completed ? "completed" : "benchmark-seed",
        currentAction: completed ? "benchmark-complete" : `completed ${seed}`,
        elapsedMs: (existing.progress.elapsedMs || 0) + Date.now() - startedAt,
        percent: completed ? 100 : Math.max(1, Math.round((nextCompleted / seeds.length) * 100))
      },
      result: { seedCount, completedSeeds: nextCompleted, seeds, results, report, summary: summary || undefined, artifact: artifactManifest || undefined }
    });
  } catch (error) {
    return mark({
      ...existing,
      status: "failed",
      updatedAt: new Date().toISOString(),
      progress: { ...existing.progress, phase: "failed", elapsedMs: (existing.progress.elapsedMs || 0) + Date.now() - startedAt, percent: 100 },
      error: error instanceof Error ? error.message : "Run job failed"
    });
  }
}

export function updateRunJobStatus(world: RuntimeWorld, runtime: PersistentTownRuntime, jobId: string, status: "paused" | "cancelled" | "running") {
  const existing = (runtime.runJobs || []).find((job) => job.id === jobId);
  if (!existing) return null;
  if (existing.status === "completed" || existing.status === "failed") return existing;
  runtime.runJobs = (runtime.runJobs || []).map((job) => job.id === jobId
    ? {
        ...job,
        status,
        updatedAt: new Date().toISOString(),
        progress: { ...job.progress, phase: status, percent: status === "cancelled" ? job.progress.percent : job.progress.percent }
      }
    : job);
  runtime.updatedAt = new Date().toISOString();
  world.persistentRuntime = runtime;
  persistRuntimeWorld(world);
  return runtime.runJobs.find((job) => job.id === jobId) || null;
}

function pickSelectedBranchComparison(run: NonNullable<ReturnType<typeof findScenario>>, fromId?: string | null, toId?: string | null) {
  return run.report.branches.find((branch) =>
    branch.endSnapshotId === toId
    || branch.startSnapshotId === fromId
    || branch.diffFromBaseline.fromSnapshotId === fromId
    || branch.diffFromBaseline.toSnapshotId === toId
    || branch.id === run.config.branches?.[0]?.id
  ) || run.report.branches[0] || null;
}

export function buildReviewExportBundle(
  world: RuntimeWorld,
  runtime: PersistentTownRuntime,
  options: {
    scenarioId?: string | null;
    fromId?: string | null;
    toId?: string | null;
    benchmark?: EmergenceBenchmarkReport | null;
  } = {}
): ReviewExportBundle | null {
  const run = findScenario(runtime, options.scenarioId);
  if (!run) return null;
  const from = findSnapshot(runtime, options.fromId || run.report.baseline.startSnapshotId) || null;
  const to = findSnapshot(runtime, options.toId || run.report.baseline.endSnapshotId) || null;
  const selectedDiff = from && to ? diffTownStateSnapshots(from, to) : null;
  const graphSummaries = buildRuntimeGraphSummaries({
    caseTimeline: runtime.caseLifecycle?.caseTimeline,
    evidenceItems: runtime.ruleState?.evidenceChain.items,
    longActions: runtime.ruleState?.longActions
  });
  return {
    exportedAt: new Date().toISOString(),
    worldId: world.id,
    runtimeId: runtime.id,
    scenario: run,
    report: run.report,
    selectedSnapshots: {
      from: from ? publicSnapshot(from) : null,
      to: to ? publicSnapshot(to) : null
    },
    selectedDiff,
    selectedBranchComparison: pickSelectedBranchComparison(run, from?.id, to?.id),
    benchmark: options.benchmark || undefined,
    ...graphSummaries
  };
}

export function renderReviewExportMarkdown(bundle: ReviewExportBundle) {
  const lines = [
    "# Persistent Town Review Bundle",
    "",
    `Exported: ${bundle.exportedAt}`,
    `World: ${bundle.worldId}`,
    `Runtime: ${bundle.runtimeId}`,
    `Scenario: ${bundle.scenario.name} (${bundle.scenario.id})`,
    `Scenario status: ${bundle.scenario.status}`,
    "",
    "## Scenario",
    "",
    `- Baseline events: ${bundle.report.baseline.eventGrowth}`,
    `- Baseline memories: ${bundle.report.baseline.memoryGrowth}`,
    `- Valid candidates: ${bundle.report.baseline.validCandidateCount}`,
    `- Blocked candidates: ${bundle.report.baseline.blockedCandidateCount}`,
    `- Branches: ${bundle.report.branches.length}`,
    ""
  ];
  if (bundle.report.checks.length) {
    lines.push("## Checks", "");
    for (const check of bundle.report.checks) {
      lines.push(`- ${check.passed ? "[pass]" : "[fail]"} ${check.label}: actual ${String(check.actual)} / expected ${String(check.expected)}`);
    }
    lines.push("");
  }
  if (bundle.caseGraphSummary || bundle.evidenceGraphSummary) {
    lines.push(
      "## Campaign Graphs",
      "",
      `- Unique cases: ${bundle.caseGraphSummary?.uniqueCaseCount ?? 0}/${bundle.caseGraphSummary?.caseCount ?? 0}`,
      `- Cross-case edges: ${bundle.caseGraphSummary?.edgeCount ?? 0}`,
      `- Later-case influence: ${bundle.caseGraphSummary?.laterCaseInfluenceRate ?? 0}%`,
      `- Evidence nodes: ${bundle.evidenceGraphSummary?.evidenceCount ?? 0}`,
      `- Evidence graph warnings: ${bundle.evidenceGraphSummary?.warningCount ?? 0}`,
      ""
    );
  }
  if (bundle.selectedSnapshots.from || bundle.selectedSnapshots.to) {
    lines.push("## Snapshots", "");
    if (bundle.selectedSnapshots.from) lines.push(`- From: ${bundle.selectedSnapshots.from.label} (tick ${bundle.selectedSnapshots.from.tick})`);
    if (bundle.selectedSnapshots.to) lines.push(`- To: ${bundle.selectedSnapshots.to.label} (tick ${bundle.selectedSnapshots.to.tick})`);
    lines.push("");
  }
  if (bundle.selectedDiff) {
    lines.push(
      "## Selected Diff",
      "",
      `- Event growth: +${bundle.selectedDiff.addedEventIds.length}`,
      `- Memory growth: +${bundle.selectedDiff.addedMemoryIds.length}`,
      `- Observation growth: +${bundle.selectedDiff.addedObservationIds.length}`,
      `- Changed agents: ${bundle.selectedDiff.changedAgents.length}`,
      `- Changed locations: ${bundle.selectedDiff.changedLocations?.length || 0}`,
      `- Candidate status changes: ${bundle.selectedDiff.candidateStatusChanges.length}`,
      `- Branch-only interventions: ${bundle.selectedDiff.branchOnlyInterventionIds.join(", ") || "none"}`,
      ""
    );
  }
  if (bundle.selectedBranchComparison) {
    lines.push(
      "## Branch Comparison",
      "",
      `- Branch: ${bundle.selectedBranchComparison.name} (${bundle.selectedBranchComparison.status})`,
      `- Event growth: ${bundle.selectedBranchComparison.eventGrowth}`,
      `- Memory growth: ${bundle.selectedBranchComparison.memoryGrowth}`,
      `- Valid candidates: ${bundle.selectedBranchComparison.validCandidateCount}`,
      `- Changed agents vs baseline: ${bundle.selectedBranchComparison.diffFromBaseline.changedAgents.length}`,
      ""
    );
  }
  if (bundle.benchmark) {
    lines.push(
      "## Latest Benchmark",
      "",
      `- Seeds: ${bundle.benchmark.seedCount}`,
      `- Passed: ${bundle.benchmark.passed}`,
      `- Failed: ${bundle.benchmark.failed}`,
      `- Pass rate: ${bundle.benchmark.passRate}%`,
      `- Route certified: ${bundle.benchmark.routeCertifiedRate ?? 0}%`,
      `- Auto-solve: ${bundle.benchmark.autoSolvePassRate ?? 0}%`,
      `- Average auto-solve steps: ${bundle.benchmark.averageAutoSolveSteps ?? 0}`,
      "",
      "| Seed | Result | Quality | Emergence | Route | AutoSolve | Mature Tick |",
      "| --- | --- | ---: | ---: | --- | --- | ---: |"
    );
    for (const result of bundle.benchmark.results) {
      lines.push(`| ${result.seed} | ${result.passed ? "pass" : "fail"} | ${result.qualityScore} | ${result.emergenceScore} | ${result.routeCertified ? "yes" : "no"} | ${result.autoSolvePassed ? "yes" : "no"} | ${result.matureTick ?? "-"} |`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
