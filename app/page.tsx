"use client";
import { useMemo, useState } from "react";
import { CampaignFrontDoor } from "@/app/components/CampaignFrontDoor";
import { CaseAuthoringWorkbench } from "@/app/components/CaseAuthoringWorkbench";
import { InvestigationGraphSurface } from "@/app/components/InvestigationGraphSurface";
import { CampaignStudySurface, PersistentTownModeSurface } from "@/app/components/HomeModeSurfaces";
import { InvestigationPanel } from "@/app/components/InvestigationSurface";
import { WorldGraphWorkbench } from "@/app/components/NovelWorldWorkbench";
import { AgentControlPanel } from "@/app/components/TownReviewSurface";
import { ControlRail, PlayShell, ToastStack } from "@/app/components/TownControlSurface";
import { TownMapStage } from "@/app/components/TownMapSurface";
import { buildStrategicCommandViewModel, executeStrategicActionDispatchAsync, type StrategicCommandAction } from "@/app/campaign/strategic-command-model";
import { deriveCampaignFrontDoorCards } from "@/app/campaign/campaign-front-door-model";
import { deriveCharacterEncounters } from "@/app/campaign/character-encounter-model";
import { countManualTheoryFields } from "@/app/campaign/replay-practice-model";
import { buildAuthoringRuntimeState } from "@/app/campaign/authoring-launch-adapter";
import { useCommandDeckContext } from "@/app/hooks/useCommandDeckContext";
import { useCertifiedCaseRhythm } from "@/app/hooks/useCertifiedCaseRhythm";
import { useInvestigationWorkspacePresentation } from "@/app/hooks/useInvestigationWorkspacePresentation";
import { useCertifiedCaseAuditModels } from "@/app/hooks/useCertifiedCaseAuditModels";
import { useGuidedOnboarding } from "@/app/hooks/useGuidedOnboarding";
import { useCampaignComprehensionStudy } from "@/app/hooks/useCampaignComprehensionStudy";
import { useReplayPracticeViewModels } from "@/app/hooks/useReplayPracticeViewModels";
import { usePersistentTownLifecycle } from "@/app/hooks/usePersistentTownLifecycle";
import { useReviewWorkflowActions } from "@/app/hooks/useReviewWorkflowActions";
import { useCampaignWorldChoiceActions } from "@/app/hooks/useCampaignWorldChoiceActions";
import { useReplaySessionActions } from "@/app/hooks/useReplaySessionActions";
import { useGuidedJournalAppender } from "@/app/hooks/useGuidedJournalAppender";
import { useGuidedManualViewModel } from "@/app/hooks/useGuidedManualViewModel";
import { useTheorySubmissionActions } from "@/app/hooks/useTheorySubmissionActions";
import { useGuidedManualActions } from "@/app/hooks/useGuidedManualActions";
import { useCertifiedInvestigationActions } from "@/app/hooks/useCertifiedInvestigationActions";
import { useCertifiedCaseRhythmActions } from "@/app/hooks/useCertifiedCaseRhythmActions";
import { useCertifiedPlaythroughActions } from "@/app/hooks/useCertifiedPlaythroughActions";
import { useInvestigationNavigationActions } from "@/app/hooks/useInvestigationNavigationActions";
import { useInvestigationReadQueries } from "@/app/hooks/useInvestigationReadQueries";
import { useWorldSessionActions } from "@/app/hooks/useWorldSessionActions";
import { useCampaignLaunchActions } from "@/app/hooks/useCampaignLaunchActions";
import { useWorkspaceLifecycleEffects } from "@/app/hooks/useWorkspaceLifecycleEffects";
import { useManualReplayDrillActions } from "@/app/hooks/useManualReplayDrillActions";
import { useWorldCampaignPresentation } from "@/app/hooks/useWorldCampaignPresentation";
import { useCampaignCommandBrief } from "@/app/hooks/useCampaignCommandBrief";
import { useCampaignController } from "@/app/controllers/useCampaignController";
import { useInvestigationController } from "@/app/controllers/useInvestigationController";
import { useReplayController } from "@/app/controllers/useReplayController";
import { useReviewController } from "@/app/controllers/useReviewController";
import { useTownRuntimeController } from "@/app/controllers/useTownRuntimeController";
import { useAuthoringController } from "@/app/controllers/useAuthoringController";
import { downloadTextFile, resolveRuntimeMode } from "@/app/lib/client-runtime";
import { CAMPAIGN_STUDY_EXPORT_FILE, type CampaignStudyStage, type CampaignStudyWorldChoice } from "@/lib/campaign-comprehension-study";
import {
  CaseLogicPanel, CausalTracePanel, DeveloperPanel, EmergenceProofPanel, EventLogPanel, InspectorRail, OnboardingOverlay, ProofTourPanel, SuspectBoardPanel
} from "@/app/components/DetectiveTownUI";
import {
  deriveMapInteractiveTargets,
  listCaseTemplates
} from "@/lib/engine";
import type {
  InvestigationProgress,
  MapInteractiveTarget,
  MurderArchetype,
  TownSocialResponsePublicSummary,
  PlayerTheory,
  WorldLeadOutcomePublicSummary,
  WorldLeadCaseHandoffPublicSummary,
  WorldArcPublicSummary,
  WorldArcDirectivePublicSummary,
  WorldInfluenceBudgetPublicSummary,
  WorldMapActor,
  WorldMapMarker,
  WorldState
} from "@/lib/engine";
type AppMode = "play" | "authoring" | "world-graph" | "persistent-town";
const timeMin = 8 * 60;
const timeMax = 23 * 60;
const initialProgress: InvestigationProgress = {
  observedCrimeWindow: false,
  joinedInvestigation: false,
  discoveredEvidence: false,
  challengedTestimony: false,
  submittedTheory: false,
  solvedCase: false
};
const archetypeOptions: { value: MurderArchetype | "auto"; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "blade", label: "Blade" },
  { value: "poison", label: "Poison" },
  { value: "blunt", label: "Blunt" },
  { value: "fall", label: "Fall" }
];
const archetypeLabels: Record<string, string> = {
  blade: "Blade injury",
  poison: "Poisoning",
  blunt: "Blunt-force misdirection",
  fall: "Fall mechanism"
};
const publicFactionLabelByInstitutionKind: Record<string, string> = {
  police: "Police Service",
  media: "Press Network",
  family: "Household Network",
  commerce: "Merchant Circle",
  civic: "Civic Records Office",
  medical: "Medical Review Board",
  court: "Court Administration",
  dock_union: "Dock Union"
};
const caseTemplates = listCaseTemplates();
const campaignFrontDoorCards = deriveCampaignFrontDoorCards();
function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
export default function Home() {
  const investigation = useInvestigationController(initialProgress);
  const {
    world, setWorld, events, setEvents, activeCase, setActiveCase, session, setSession, setSessions,
    snapshot, setSnapshot, worldIdInput, setWorldIdInput, seedInput, setSeedInput, caseMode, setCaseMode,
    caseTemplateId, setCaseTemplateId, caseArchetype, setCaseArchetype, mode, setMode, playerName, setPlayerName,
    timeValue, setTimeValue, selectedSceneId, setSelectedSceneId, selectedCharacterId, setSelectedCharacterId,
    selectedEvidenceId, setSelectedEvidenceId, highlightedEventId, setHighlightedEventId, question, setQuestion,
    theory, setTheory, status, setStatus, revealText, setRevealText, lastAiSafety, setLastAiSafety,
    latestLiveEval, setLatestLiveEval, deductionGraph, setDeductionGraph, suspectBoard, setSuspectBoard,
    logicReport, setLogicReport, busy, setBusy, runtimeMode, setRuntimeMode,
    progress, setProgress, selectionHighlight, setSelectionHighlight, selectedGraphNode, setSelectedGraphNode,
    selectedSuspectId, setSelectedSuspectId, proofViewMode, setProofViewMode, setSelectedGapType,
    hoveredLocationId, setHoveredLocationId, toasts, setToasts, pushToast, dismissToast,
    inspectorTab, setInspectorTab, showLogic
  } = investigation;
  const replay = useReplayController();
  const {
    replaying, setReplaying, serverPlaythroughSummary, setServerPlaythroughSummary,
    guidedManualLastResult, guidedManualRunning, setGuidedManualRunning,
    guidedStepJournal, replayGoalAttempt
  } = replay;
  const appendGuidedStepJournal = useGuidedJournalAppender(replay);
  const campaign = useCampaignController();
  const {
    frontDoorOpen, setFrontDoorOpen, frontDoorSelection, setFrontDoorSelection, frontDoorRouteSelection, setFrontDoorRouteSelection,
    frontDoorBusy, setFrontDoorBusy, frontDoorStatus, setFrontDoorStatus,
    continueWorldId, setContinueWorldId, continueSessionId, setContinueSessionId,
    worldLead, setWorldLead, worldLeadOutcome, setWorldLeadOutcome, worldLeadCaseHandoff, setWorldLeadCaseHandoff,
    worldArc, setWorldArc, worldArcDirective, setWorldArcDirective, worldPressureCascade,
    worldInfluenceBudget, setWorldInfluenceBudget, playerResourceCommitment, setPlayerResourceCommitment,
    factionRelationship, setFactionRelationship, worldEventOffer,
    investigatorProgression, setInvestigatorProgression, campaignRecovery, setCampaignRecovery,
    investigatorHeadquarters, setInvestigatorHeadquarters,
    arcConvergence, setArcConvergence, campaignSession, setCampaignSession,
    campaignFinaleDebrief, setCampaignFinaleDebrief, townSocialResponse, setTownSocialResponse
  } = campaign;
  const [appMode, setAppMode] = useState<AppMode>("play");
  const authoring = useAuthoringController({
    caseTemplateId,
    setCaseTemplateId,
    timeValue,
    onRunDraft: runDraftFrom,
    persistLocalDrafts: runtimeMode === "server" && resolveRuntimeMode() === "server"
  });
  const town = useTownRuntimeController();
  const {
    townRuntime, setTownRuntime, townQueue, setTownQueue, townBrief,
    selectedAgentCandidates, setSelectedAgentCandidates, townRuntimeBusy,
    townRuleState, townCaseLifecycle
  } = town;
  const review = useReviewController();
  const {
    reviewBusy, scenarioPresets, scenarioPacks,
    scenarioRuns, runCatalog, runJobs,
    selectedScenarioPackId, setSelectedScenarioPackId, selectedRunCatalogId, setSelectedRunCatalogId,
    selectedScenarioPresetId, setSelectedScenarioPresetId, scenarioRun,
    scenarioReport, townSnapshots,
    selectedSnapshotFromId, setSelectedSnapshotFromId, selectedSnapshotToId, setSelectedSnapshotToId,
    snapshotDiff,
    benchmarkSummary
  } = review;
  const workspacePresentation = useInvestigationWorkspacePresentation({ investigation, town });
  const {
    deductionCase, scenes, characters, discovered, selectedScene, selectedCharacter, sceneEvidence, discoveredEvidence,
    playerTheoryEvidence, selectedTestimony, quality, selectedNpcMemories, evidenceImpacts, judgementGaps,
    questionedCharacterIds, contradictedCharacterIds, selectedNpcContradictionHit, investigationStages, visibleEvents,
    selectedEvidence,
    selectedAgent, hoveredLocationInfo, graphExplanation, suspectExplanations, gapCards, nextStepAdvice, solutionChain,
    inspectorSummary
  } = workspacePresentation;
  const investigationNavigation = useInvestigationNavigationActions({
    investigation,
    scenes,
    characters,
    discoveredEvidence,
    selectedScene,
    selectedCharacter,
    persistentTownMode: appMode === "persistent-town"
  });
  const {
    highlightSelection,
    handleMarker,
    handleActor,
    handleGapCard,
    handleIntakeNextAction,
    focusCertifiedStep,
    handleNotebookAction,
    handleProofTourStep,
    handleGuidedTask,
    selectGraphEvidence,
    selectGraphEvent,
    selectGraphCharacter
  } = investigationNavigation;
  const onboarding = useGuidedOnboarding({ runtimeMode, progress, session, revealText });
  const certifiedCaseAudit = useCertifiedCaseAuditModels({ investigation, serverPlaythroughSummary });
  const {
    causalTrace, causalTraceEvents, emergenceProofTrace, evidenceNotebook, proofTourSteps, playableIntake,
    caseTruthLedger, caseProofCoverage, caseRouteCertificate, staticPlaythroughProof, serverPlaythroughProof,
    sourceReviewUnlock
  } = certifiedCaseAudit;
  const guidedManual = useGuidedManualViewModel({
    session,
    theory,
    scenes,
    caseRouteCertificate,
    playableIntake,
    worldLead,
    lastResult: guidedManualLastResult,
    guidedManualRunning,
    busy
  });
  const guidedManualRun = guidedManual.viewModel;
  const caseRhythm = useCertifiedCaseRhythm({ intake: playableIntake, session, observedCrimeWindow: progress.observedCrimeWindow, selectedSceneName: selectedScene?.name, revealAvailable: Boolean(revealText), recoveryGap: gapCards[0], recoveryAdvice: nextStepAdvice });
  const suggestedAction = caseRhythm.suggestedAction;
  const campaignStudyWorldChoices = useMemo<Partial<Record<CampaignStudyWorldChoice, boolean>>>(() => ({
    "world-lead": worldLead?.status === "pending",
    "resource-commitment": playerResourceCommitment?.status === "ready" || playerResourceCommitment?.status === "blocked",
    "faction-directive": worldArcDirective?.status === "ready" || worldArcDirective?.status === "blocked",
    "world-event-offer": worldEventOffer?.status === "offered",
    "campaign-recovery": campaignRecovery?.status === "ready",
    "finale-case": arcConvergence?.status === "ready"
  }), [arcConvergence?.status, campaignRecovery?.status, playerResourceCommitment?.status, worldArcDirective?.status, worldEventOffer?.status, worldLead?.status]);
  const campaignStudyStage = useMemo<CampaignStudyStage>(() => {
    const campaignStatus = campaignSession?.status || townRuntime?.campaignSessionSummary?.status;
    if (campaignStatus === "completed") return "debrief";
    if (campaignRecovery?.status === "ready" || campaignRecovery?.status === "scheduled") return "recovery";
    if (arcConvergence?.status === "ready" || arcConvergence?.status === "active" || campaignStatus === "finale-ready" || campaignStatus === "finale-active") return "finale";
    if (Object.values(campaignStudyWorldChoices).some(Boolean)) return "world-choice";
    if (!session) return activeCase ? "join" : campaignStatus === "opening" ? "opening" : "case-extraction";
    if (session.judgement?.accepted) return "review-source";
    if (guidedManualRun.currentStep === "join") return "join";
    if (guidedManualRun.currentStep === "search") return "search";
    if (guidedManualRun.currentStep === "question") return "question";
    if (guidedManualRun.currentStep === "challenge") return "challenge";
    if (guidedManualRun.currentStep === "select-evidence") return "pick-evidence";
    if (guidedManualRun.currentStep === "review-source") return "review-source";
    return countManualTheoryFields(theory) < 3 ? "fill-theory" : "submit";
  }, [activeCase, arcConvergence?.status, campaignRecovery?.status, campaignSession?.status, campaignStudyWorldChoices, guidedManualRun.currentStep, session, theory, townRuntime?.campaignSessionSummary?.status]);
  const campaignStudyCampaignStatus = campaignSession?.status || townRuntime?.campaignSessionSummary?.status;
  const campaignStudy = useCampaignComprehensionStudy({
    runtimeMode,
    canStart: campaignStudyCampaignStatus === "opening" && !session,
    startBlockedReason: campaignStudyCampaignStatus !== "opening"
      ? "Use the existing Reset/Create Town flow to return to Campaign opening. The recorder will not reset the world."
      : session
        ? "Finish or reset the active investigation session before starting a study run."
        : undefined,
    currentStage: campaignStudyStage,
    campaignCompleted: campaignStudyCampaignStatus === "completed",
    recoveryReady: campaignRecovery?.status === "ready",
    readyWorldChoices: campaignStudyWorldChoices
  });
  const investigationReadQueries = useInvestigationReadQueries(investigation);
  const worldSessionActions = useWorldSessionActions({
    investigation,
    campaign,
    town,
    replay,
    campaignStudy,
    initialProgress,
    loadLatestLiveEval: investigationReadQueries.loadLatestLiveEval
  });
  useWorkspaceLifecycleEffects({ investigation, campaign, replay });
  const replayPracticeViews = useReplayPracticeViewModels({
    session,
    sourceReviewUnlock,
    guidedStepJournal,
    guidedManualRun,
    replayGoalAttempt,
    theory,
    worldLeadOutcome,
    worldLeadCaseHandoff,
    worldArc,
    worldArcDirective,
    worldPressureCascade,
    townSocialResponse,
    playerResourceCommitment,
    caseRouteCertificate,
    playableIntake,
    evidenceNotebook,
    discoveredEvidence,
    characters
  });
  const {
    solvedCaseDebrief,
    replayGoalCoach,
    manualEvidenceDrill,
    manualTheoryDrill,
    replayAttemptScorecard,
    replayPracticeLoop
  } = replayPracticeViews;
  const manualReplayDrillActions = useManualReplayDrillActions({
    investigation,
    replay,
    campaignStudy,
    manualEvidenceDrill,
    scenes,
    highlightSelection,
    appendJournal: appendGuidedStepJournal
  });
  const { toggleManualEvidenceDrillEvidence, updateManualTheoryDrillField, approveManualTheoryFallback } = manualReplayDrillActions;
  const mapInteractiveTargets: MapInteractiveTarget[] = useMemo(
    () => (world ? deriveMapInteractiveTargets(world, activeCase || undefined, events, session) : []),
    [activeCase, events, session, world]
  );
  const mapActorsByTile = useMemo(() => {
    const result = new Map<string, WorldMapActor[]>();
    for (const actor of snapshot?.actors || []) {
      const key = `${actor.x}:${actor.y}`;
      result.set(key, [...(result.get(key) || []), actor]);
    }
    return result;
  }, [snapshot]);
  const mapMarkersByTile = useMemo(() => {
    const result = new Map<string, WorldMapMarker[]>();
    for (const marker of snapshot?.markers || []) {
      const key = `${marker.x}:${marker.y}`;
      result.set(key, [...(result.get(key) || []), marker]);
    }
    return result;
  }, [snapshot]);
  const persistentTownLifecycle = usePersistentTownLifecycle({
    investigation,
    campaign,
    town,
    review,
    campaignStudy,
    appMode,
    setAppMode,
    appendGuidedStepJournal,
    hydrateCase: worldSessionActions.hydrateCase
  });
  const {
    refreshTownRuntime,
    startPersistentTown,
    pausePersistentTown,
    stepPersistentTown,
    resetPersistentTown,
    intervenePersistentAgent,
    extractPersistentCandidate
  } = persistentTownLifecycle;
  const campaignLaunchActions = useCampaignLaunchActions({
    investigation,
    campaign,
    town,
    review,
    worldSession: worldSessionActions,
    extractPersistentCandidate,
    refreshTownRuntime,
    setAppMode
  });
  const { startSelectedCampaign, continueSavedCampaign } = campaignLaunchActions;
  const reviewWorkflow = useReviewWorkflowActions({ investigation, town, review, lifecycle: persistentTownLifecycle });
  const {
    selectScenarioHistoryRun, saveScenarioPresetFromUi, deleteScenarioPresetFromUi,
    exportScenarioPackFromUi, validateScenarioPackFromUi, exportReplayBundleFromUi,
    startRunJobFromUi, cancelRunJobFromUi, runEmergenceBenchmarkFromUi,
    copyReviewBundleJson, exportReviewBundleFile, markCurrentDiffAsReviewExportTarget,
    runDefaultTownScenario, rollbackTownSnapshot
  } = reviewWorkflow;
  const theorySubmissionActions = useTheorySubmissionActions({
    investigation,
    campaign,
    replay,
    appendJournal: appendGuidedStepJournal,
    currentStaticState: worldSessionActions.currentStaticState,
    hydrateStatic: worldSessionActions.hydrateStatic,
    refreshTownRuntime,
    recordTheoryResult: onboarding.recordTheoryResult,
    recordMeaningfulAction: campaignStudy.recordMeaningfulAction
  });
  const { submitCurrentTheory, submitTheory } = theorySubmissionActions;
  const certifiedInvestigationActions = useCertifiedInvestigationActions({
    investigation,
    campaign,
    campaignStudy,
    deductionCase,
    scenes,
    discoveredEvidenceCount: discoveredEvidence.length,
    selectedNpcMemoryCount: selectedNpcMemories.length,
    appendJournal: appendGuidedStepJournal,
    highlightSelection,
    persist: worldSessionActions.persist,
    currentStaticState: worldSessionActions.currentStaticState,
    hydrateStatic: worldSessionActions.hydrateStatic
  });
  const {
    joinCase,
    discoverEvidence,
    discoverFirstSceneEvidence,
    runInterrogationTarget,
    interrogateSelected: interrogate,
    toggleTheoryEvidence,
    revealSolution
  } = certifiedInvestigationActions;
  function observeCaseWindow() { setInspectorTab("events"); setProgress((current) => ({ ...current, observedCrimeWindow: true })); }
  const { runCurrentStep: runCertifiedCaseRhythmStep } = useCertifiedCaseRhythmActions({ rhythm: caseRhythm, actionAdapter: certifiedInvestigationActions, focusStep: focusCertifiedStep, observeCaseWindow });
  const certifiedPlaythroughActions = useCertifiedPlaythroughActions({
    investigation,
    replay,
    scenes,
    hydrateStatic: worldSessionActions.hydrateStatic,
    highlightSelection,
    persist: worldSessionActions.persist,
    recordTheoryResult: onboarding.recordTheoryResult
  });
  const { runStaticCertifiedPlaythrough, runServerCertifiedPlaythrough } = certifiedPlaythroughActions;
  async function copyAgentApiExample() {
    try {
      await navigator.clipboard.writeText(investigationReadQueries.agentApiExample);
      setStatus("Agent API example copied.");
    } catch {
      setStatus("Copy failed: the browser has not granted clipboard permission.");
    }
  }
  function runDraftFrom(draft: Parameters<typeof buildAuthoringRuntimeState>[0], message: string) {
    const result = buildAuthoringRuntimeState(draft, initialProgress);
    if (!result.valid) { authoring.setAuthoringStatus(result.error); return; }
    setRuntimeMode("static-demo");
    worldSessionActions.hydrateStatic(result.runtimeState);
    setAppMode("play");
    setStatus(message);
  }
  const campaignStudyRecorder = (
    <CampaignStudySurface
      study={campaignStudy}
      onExport={() => downloadTextFile(CAMPAIGN_STUDY_EXPORT_FILE, JSON.stringify(campaignStudy.exportData(), null, 2), "application/json;charset=utf-8")}
    />
  );
  const campaignFrontDoorSurface = (
    <CampaignFrontDoor
      runtimeMode={runtimeMode}
      open={frontDoorOpen}
      cards={campaignFrontDoorCards}
      selectedIndex={frontDoorSelection}
      selectedRouteIndex={frontDoorRouteSelection}
      busy={frontDoorBusy}
      status={frontDoorStatus}
      canContinue={Boolean(continueWorldId)}
      onSelect={(index) => {
        setFrontDoorSelection(index);
        setFrontDoorStatus(`${campaignFrontDoorCards[index]?.label || "Campaign"} selected. Review its three chapters, then start a clean local town.`);
      }}
      onSelectRoute={(index) => { setFrontDoorRouteSelection(index); setFrontDoorStatus(`${campaignFrontDoorCards[frontDoorSelection]?.routes[index]?.label || "Route"} selected for this three-case Campaign.`); }}
      onStart={() => void startSelectedCampaign()}
      onContinue={() => void continueSavedCampaign()}
      onDismiss={() => setFrontDoorOpen(false)}
    />
  );
  const { selectedInstitutionName, townMapLenses, worldConsequenceTimeline, campaignPacing } = useWorldCampaignPresentation({
    world, snapshot, townRuntime, townBrief, selectedCharacterId, runtimeMode, activeCase, session, suggestedAction,
    busy, townRuntimeBusy, campaignSession, campaignRecovery, investigatorHeadquarters, worldLead, worldArc,
    worldArcDirective, worldEventOffer, worldPressureCascade, townSocialResponse
  });
  const commandDeckContext = useCommandDeckContext({
    inspectorTab, objectiveKey: `${suggestedAction.phase}:${suggestedAction.title}`, selectedInstitutionName, selectedCharacter, selectedSceneName: selectedScene?.name,
    selectedSceneId, selectedEvidenceId, selectedEvidence: selectedEvidence ? { title: selectedEvidence.title, discovered: discovered.has(selectedEvidence.id), selectedForTheory: playerTheoryEvidence.has(selectedEvidence.id) } : undefined,
    hasCase: Boolean(activeCase), hasSession: Boolean(session), progress,
    searchableEvidenceIds: sceneEvidence.filter((item) => item.discoverable && !session?.discoveredEvidenceIds.includes(item.id)).map((item) => item.id),
    discoveredEvidenceIds: discoveredEvidence.map((item) => item.id), judgementAccepted: Boolean(session?.judgement?.accepted),
    revealAvailable: Boolean(revealText), questionText: question, actionAdapter: certifiedInvestigationActions,
    onSelectEvidence: setSelectedEvidenceId, onShowInspector: setInspectorTab, onShowEvents: observeCaseWindow,
    onSubmitTheory: submitTheory
  });
  const actorEncountersById = useMemo(() => {
    return deriveCharacterEncounters({
      actors: snapshot?.actors || [],
      professions: townRuntime?.ruleState?.professions || [],
      institutions: townRuntime?.ruleState?.institutions || [],
      factionStandings: (factionRelationship || townRuntime?.factionRelationshipSummary)?.standings,
      factionLabelByInstitutionKind: publicFactionLabelByInstitutionKind,
      locationSignals: townMapLenses.locationSignals || [],
      socialResponse: townSocialResponse || townRuntime?.townSocialResponseSummary,
      caseCharacterIds: new Set(characters.map((character) => character.id)),
      selectedCharacterId,
      selectedCharacterAvailable: Boolean(selectedCharacter),
      selectedActions: commandDeckContext.actions,
      investigation: { hasCase: Boolean(activeCase), hasSession: Boolean(session), joined: progress.joinedInvestigation, observed: progress.observedCrimeWindow, accepted: Boolean(session?.judgement?.accepted), scope: playerResourceCommitment?.scope },
      questionedCharacterIds,
      challengedCharacterIds: contradictedCharacterIds
    });
  }, [activeCase, characters, commandDeckContext.actions, contradictedCharacterIds, factionRelationship, playerResourceCommitment?.scope, progress.joinedInvestigation, progress.observedCrimeWindow, questionedCharacterIds, selectedCharacter, selectedCharacterId, snapshot?.actors, townMapLenses.locationSignals, townRuntime, townSocialResponse, session?.judgement?.accepted]);
  const selectedCharacterEncounter = selectedCharacterId ? actorEncountersById.get(selectedCharacterId) || null : null;
  const commandDeck = buildStrategicCommandViewModel({
    runtimeMode,
    hasWorld: Boolean(world),
    hasCase: Boolean(activeCase),
    hasSession: Boolean(session),
    judgementAccepted: Boolean(session?.judgement?.accepted),
    busy: busy || townRuntimeBusy,
    advanceAvailable: runtimeMode === "server" && Boolean(world),
    caseLabel: activeCase?.deductionCase.title || world?.name || "Detective Town",
    currentTime: snapshot?.time || minutesToTime(timeValue), suggestedAction,
    institutionLabel: selectedInstitutionName,
    urgency: townBrief?.urgency, tickLabel: townBrief ? `T${townBrief.tick} / ${townBrief.currentPhase}` : undefined,
    heat: townRuntime?.ruleState?.publicOpinion.heat ?? townBrief?.hotLocations[0]?.heat, publicTrust: townRuntime?.ruleState?.publicOpinion.trustInPolice,
    resourcePressure: townBrief?.hotLocations.length ? townBrief.hotLocations.reduce((sum, item) => sum + item.resourcePressure, 0) / townBrief.hotLocations.length : undefined,
    campaign: campaignSession || townRuntime?.campaignSessionSummary, worldLead: worldLead || townRuntime?.worldLeadPreview,
    worldArc: worldArc || townRuntime?.worldArcSummary, directive: worldArcDirective || townRuntime?.worldArcDirectiveSummary,
    pressure: worldPressureCascade || townRuntime?.worldPressureCascadeSummary, socialResponse: townSocialResponse || townRuntime?.townSocialResponseSummary,
    recovery: campaignRecovery || townRuntime?.campaignRecoverySummary,
    operations: runtimeMode === "server" ? playerResourceCommitment || townRuntime?.playerResourceCommitmentSummary : undefined,
    headquarters: runtimeMode === "server" ? investigatorHeadquarters || townRuntime?.investigatorHeadquartersSummary : undefined,
    worldEventOffer: runtimeMode === "server" ? worldEventOffer || townRuntime?.worldEventOfferSummary : undefined,
    guidedJournal: guidedStepJournal[0] ? { status: guidedStepJournal[0].status, label: guidedStepJournal[0].label, headline: guidedStepJournal[0].result || guidedStepJournal[0].nextAction } : undefined,
    worldEvent: visibleEvents[0] ? { status: "visible", label: "World Event", headline: visibleEvents[0].publicSummary } : undefined,
    selectedContext: commandDeckContext.selectedContext, contextActions: commandDeckContext.actions, mapLenses: townMapLenses, investigationTurn: commandDeckContext.turnState, worldConsequenceTimeline, campaignPacing, caseRhythm
  });
  const campaignCommandBrief = useCampaignCommandBrief(commandDeck);
  async function handleStrategicCommand(action: StrategicCommandAction) {
    if (action.kind === "certified-investigation" && action.target === "show-investigation") await runCertifiedCaseRhythmStep();
    await executeStrategicActionDispatchAsync(action, {
      contextAction: (kind) => commandDeckContext.onAction(kind),
      openCampaign: () => setFrontDoorOpen(true),
      advanceTown: () => stepPersistentTown(1),
      showNextCase: () => setInspectorTab("agent"),
      showInspector: () => setInspectorTab("investigation")
    });
  }
  const worldChoiceActions = useCampaignWorldChoiceActions({ investigation, campaign, town, replay, campaignStudy, appendJournal: appendGuidedStepJournal });
  const {
    updateInvestigatorHeadquartersDecision,
    updateWorldLeadDecision, updateWorldArcDirectiveDecision, updatePlayerResourceCommitmentDecision,
    updateWorldEventOfferDecision, updateCampaignRecoveryDecision, resolveWorldLeadAfterStep
  } = worldChoiceActions;
  const { runGuidedManualStep } = useGuidedManualActions({
    investigation,
    replay,
    target: guidedManual.target,
    scenes,
    caseRouteCertificate,
    playableIntake,
    appendJournal: appendGuidedStepJournal,
    highlightSelection,
    actionAdapter: certifiedInvestigationActions,
    resolveWorldLeadAfterStep,
    submitCurrentTheory,
    recordGuidedStep: campaignStudy.recordGuidedStep
  });
  const { startReplayGoalAttempt } = useReplaySessionActions({
    investigation, campaign, replay, replayViews: replayPracticeViews,
    sourceReviewUnlock, appendJournal: appendGuidedStepJournal, persist: worldSessionActions.persist
  });
  if (appMode === "world-graph") {
    return <>{campaignStudyRecorder}<WorldGraphWorkbench runtimeMode={runtimeMode} onBack={() => setAppMode("play")} /></>;
  }
  if (appMode === "authoring") {
    return <CaseAuthoringWorkbench controller={authoring} onPlay={() => setAppMode("play")} onWorldGraph={() => setAppMode("world-graph")} />;
  }
  if (appMode === "persistent-town") {
    return (
      <PersistentTownModeSurface
        studyRecorder={campaignStudyRecorder}
        investigation={investigation}
        town={town}
        review={review}
        lifecycle={persistentTownLifecycle}
        worldName={world?.name || "未创建小镇"}
        caseTitle={activeCase?.deductionCase.title || "Generated Agent Town"}
        selectedAgent={selectedAgent}
        selectedCharacterName={selectedCharacter?.name}
        reviewActions={{
          selectScenarioRun: (runId) => void selectScenarioHistoryRun(runId),
          runScenario: (config) => void runDefaultTownScenario(config),
          saveScenarioPreset: (preset, overwrite) => void saveScenarioPresetFromUi(preset, overwrite),
          deleteScenarioPreset: (presetId) => void deleteScenarioPresetFromUi(presetId),
          exportScenarioPack: () => void exportScenarioPackFromUi(),
          validateScenarioPack: () => void validateScenarioPackFromUi(),
          exportReplayBundle: () => void exportReplayBundleFromUi(),
          startScenarioJob: () => void startRunJobFromUi("scenario"),
          startBenchmarkJob: () => void startRunJobFromUi("benchmark"),
          cancelRunJob: (jobId) => void cancelRunJobFromUi(jobId),
          copyReviewJson: () => void copyReviewBundleJson(),
          exportReviewMarkdown: () => void exportReviewBundleFile("markdown"),
          exportReviewBundle: () => void exportReviewBundleFile("json"),
          rollbackSnapshot: (snapshotId) => void rollbackTownSnapshot(snapshotId),
          markReviewExportTarget: markCurrentDiffAsReviewExportTarget,
          runBenchmark: (seedCount) => void runEmergenceBenchmarkFromUi(seedCount)
        }}
        onBackToPlay={() => { setAppMode("play"); setInspectorTab("investigation"); }}
        onActorSelect={(actor) => {
          setSelectedCharacterId(actor.id);
          setSelectedSuspectId(actor.id);
          highlightSelection({ characterId: actor.id });
          void refreshTownRuntime(world?.id, actor.id);
        }}
        onLocationSelect={(locationId) => {
          setSelectedSceneId(locationId);
          setHoveredLocationId(locationId);
          highlightSelection({ locationId });
        }}
      />
    );
  }
  const graphView = <InvestigationGraphSurface graph={deductionGraph} discoveredEvidenceIds={session?.discoveredEvidenceIds || []} solutionRevealed={Boolean(session?.judgement?.accepted && revealText)} selectedNodeId={selectedGraphNode?.id} onSelectNode={setSelectedGraphNode} onSelectEvidence={selectGraphEvidence} onSelectEvent={selectGraphEvent} onSelectCharacter={selectGraphCharacter} />;
  return (
    <>
    {campaignStudyRecorder}
    <PlayShell
      commandDeck={commandDeck}
      commandBrief={campaignCommandBrief}
      guidedJournal={guidedStepJournal}
      control={(
        <>
        <ControlRail
          runtimeMode={runtimeMode}
          seedInput={seedInput}
          setSeedInput={setSeedInput}
          caseMode={caseMode}
          setCaseMode={setCaseMode}
          caseTemplateId={caseTemplateId}
          switchCaseTemplate={worldSessionActions.switchCaseTemplate}
          caseTemplates={caseTemplates}
          caseArchetype={caseArchetype}
          setCaseArchetype={setCaseArchetype}
          archetypeOptions={archetypeOptions}
          mode={mode}
          setMode={setMode}
          busy={busy}
          createWorld={() => void worldSessionActions.createWorld()}
          worldIdInput={worldIdInput}
          setWorldIdInput={setWorldIdInput}
          loadWorld={() => void worldSessionActions.loadWorld()}
          playerName={playerName}
          setPlayerName={setPlayerName}
          joinCase={() => void joinCase()}
          tickWorld={() => void worldSessionActions.tickWorld()}
          worldName={world?.name || "\u672a\u521b\u5efa\u5c0f\u9547"}
          caseTitle={activeCase?.deductionCase.title || "Detective Town Showcase"}
          caseSubtitle={activeCase ? archetypeLabels[activeCase.generationProfile.archetype] : "\u7b49\u5f85\u751f\u6210\u6848\u4ef6"}
          progress={progress}
          metrics={{
            quality: quality?.qualityScore ?? quality?.score ?? 0,
            unique: Boolean(quality?.uniqueCulprit),
            logic: quality?.logicStrength ?? logicReport?.logicStrength ?? 0,
            misdirect: quality?.misdirectionQuality ?? logicReport?.misdirectionQuality ?? 0,
            evidence: `${session?.discoveredEvidenceIds.length || 0}/${deductionCase?.evidence.length || 0}`,
            aiEval: latestLiveEval?.passed === false ? "Fail" : latestLiveEval ? "Pass" : "Local"
          }}
          status={status}
          suggestedAction={suggestedAction}
          onSuggestedAction={() => setInspectorTab(suggestedAction.targetTab)}
          guidedTasks={onboarding.tasks}
          onGuidedTaskSelect={handleGuidedTask}
          reopenOnboarding={onboarding.reopen}
          openAuthoring={() => setAppMode("authoring")}
          openWorldGraph={() => setAppMode("world-graph")}
          openCampaignFrontDoor={() => setFrontDoorOpen(true)}
          openPersistentTown={() => {
            setAppMode("persistent-town");
            setInspectorTab("agent");
            void refreshTownRuntime();
          }}
          switchRuntime={worldSessionActions.switchRuntime}
        />
        {runtimeMode === "static-demo" ? campaignFrontDoorSurface : null}
        </>
      )}
      toasts={<ToastStack toasts={toasts} onDismiss={dismissToast} />}
      toastVisible={toasts.length > 0}
      blockingOverlayActive={Boolean(runtimeMode === "server" && frontDoorOpen || onboarding.overlayOpen)}
      map={(
        <TownMapStage
          caseFile={activeCase?.deductionCase.publicCaseFile || "\u521b\u5efa\u5c0f\u9547\u540e\uff0c\u6848\u4ef6\u4f1a\u4ece NPC \u65e5\u7a0b\u3001\u8bb0\u5fc6\u3001\u51b2\u7a81\u548c\u4e8b\u4ef6\u65e5\u5fd7\u4e2d\u6d8c\u73b0\u3002"}
          currentTime={snapshot?.time || minutesToTime(timeValue)}
          stages={investigationStages}
          snapshot={snapshot}
          actorsByTile={mapActorsByTile}
          markersByTile={mapMarkersByTile}
          hoverInfo={hoveredLocationInfo}
          characterEncounter={selectedCharacterEncounter}
          encountersByActorId={actorEncountersById}
          selectedSceneId={selectedSceneId}
          highlightedEventId={highlightedEventId}
          selectedCharacterId={selectedCharacterId}
          selectionHighlight={selectionHighlight}
          interactiveTargets={mapInteractiveTargets}
          mapLenses={townMapLenses}
          onTileClick={(locationId) => { setSelectedSceneId(locationId); setSelectedCharacterId(""); setSelectedEvidenceId(""); setInspectorTab("investigation"); }}
          onTileHover={setHoveredLocationId}
          onMarkerClick={handleMarker}
          onActorClick={handleActor}
          onLocationAction={(locationId) => { setSelectedSceneId(locationId); setSelectedCharacterId(""); setSelectedEvidenceId(""); setInspectorTab("investigation"); }}
          onEncounterAction={commandDeckContext.onAction}
          onEncounterDismiss={() => setSelectedCharacterId("")}
          replaying={replaying}
          setReplaying={setReplaying}
          timeMin={timeMin}
          timeMax={timeMax}
          timeValue={timeValue}
          setTimeValue={setTimeValue}
          timeToMinutes={timeToMinutes}
          minutesToTime={minutesToTime}
        />
      )}
      inspector={(
        <InspectorRail
          activeTab={inspectorTab}
          setActiveTab={setInspectorTab}
          summary={inspectorSummary}
          tabs={[
            {
              id: "events",
              label: "\u4e8b\u4ef6",
              content: (
                <EventLogPanel
                  events={visibleEvents}
                  highlightedEventId={highlightedEventId}
                  onSelect={(event) => {
                    setHighlightedEventId(event.id);
                    setSelectedSceneId(event.locationId);
                    setTimeValue(timeToMinutes(event.time));
                    setInspectorTab("events");
                  }}
                />
              )
            },
            {
              id: "investigation",
              label: "\u8c03\u67e5",
              content: (
                <InvestigationPanel
                  playableIntake={playableIntake}
                  caseRhythm={caseRhythm}
                  onIntakeNextAction={handleIntakeNextAction}
                  notebookItems={evidenceNotebook}
                  onNotebookAction={handleNotebookAction}
                  selectedSceneName={selectedScene?.name || "\u9009\u62e9\u5730\u56fe\u5730\u70b9"}
                  sceneEvidence={sceneEvidence}
                  discoveredEvidence={discoveredEvidence}
                  discoveredIds={discovered}
                  evidenceImpacts={evidenceImpacts}
                  actionAdapter={certifiedInvestigationActions}
                  session={session}
                  characters={characters}
                  selectedCharacterId={selectedCharacterId}
                  setSelectedCharacterId={setSelectedCharacterId}
                  selectedEvidenceId={selectedEvidenceId}
                  setSelectedEvidenceId={setSelectedEvidenceId}
                  selectedTestimony={selectedTestimony}
                  question={question}
                  setQuestion={setQuestion}
                  aiSafety={lastAiSafety}
                  memoryCount={selectedNpcMemories.length}
                  evidenceCount={discoveredEvidence.length}
                  contradictionHit={selectedNpcContradictionHit}
                  dialogueLog={session?.interrogationLog || []}
                  deductionCase={deductionCase}
                  theory={theory}
                  setTheory={setTheory}
                  playerTheoryEvidence={playerTheoryEvidence}
                  submitTheory={() => void submitTheory()}
                  revealText={revealText}
                  judgementGaps={judgementGaps}
                  gapCards={gapCards}
                  onGapSelect={handleGapCard}
                  nextStepAdvice={nextStepAdvice}
                  staticPlaythroughProof={staticPlaythroughProof}
                  runStaticPlaythroughProof={runStaticCertifiedPlaythrough}
                  serverPlaythroughProof={serverPlaythroughProof}
                  runServerPlaythroughProof={() => void runServerCertifiedPlaythrough()}
                  runtimeMode={runtimeMode}
                  worldLead={worldLead || townRuntime?.worldLeadPreview}
                  worldLeadOutcome={worldLeadOutcome}
                   worldLeadCaseHandoff={worldLeadCaseHandoff?.status === "consumed"
                     ? worldLeadCaseHandoff
                     : townRuntime?.worldLeadCaseHandoffSummary || worldLeadCaseHandoff}
                  worldArc={runtimeMode === "static-demo" ? null : worldArc || townRuntime?.worldArcSummary}
                  worldArcDirective={runtimeMode === "static-demo" ? null : worldArcDirective || townRuntime?.worldArcDirectiveSummary}
                  worldPressureCascade={runtimeMode === "static-demo" ? null : worldPressureCascade || townRuntime?.worldPressureCascadeSummary}
                  worldInfluenceBudget={runtimeMode === "static-demo" ? null : worldInfluenceBudget || townRuntime?.worldInfluenceBudgetSummary}
                  campaignPacing={campaignPacing}
                  campaignCommandBrief={campaignCommandBrief}
                  playerResourceCommitment={runtimeMode === "static-demo" ? null : playerResourceCommitment || townRuntime?.playerResourceCommitmentSummary}
                  factionRelationship={runtimeMode === "static-demo" ? null : factionRelationship || townRuntime?.factionRelationshipSummary}
                  worldEventOffer={runtimeMode === "static-demo" ? null : worldEventOffer || townRuntime?.worldEventOfferSummary}
                  investigatorProgression={runtimeMode === "static-demo" ? null : investigatorProgression || townRuntime?.investigatorProgressionSummary}
                  campaignRecovery={runtimeMode === "static-demo" ? null : campaignRecovery || townRuntime?.campaignRecoverySummary}
                  investigatorHeadquarters={runtimeMode === "static-demo" ? null : investigatorHeadquarters || townRuntime?.investigatorHeadquartersSummary}
                  arcConvergence={runtimeMode === "static-demo" ? null : arcConvergence || townRuntime?.arcConvergenceSummary}
                  campaignSession={runtimeMode === "static-demo" ? null : campaignSession || townRuntime?.campaignSessionSummary}
                  campaignFinaleDebrief={runtimeMode === "static-demo" ? null : campaignFinaleDebrief || townRuntime?.campaignFinaleDebrief}
                  townSocialResponse={runtimeMode === "static-demo" ? null : townSocialResponse || townRuntime?.townSocialResponseSummary}
                  updateWorldLead={(action) => void updateWorldLeadDecision(action)}
                  updateWorldArcDirective={(choice) => void updateWorldArcDirectiveDecision(choice)}
                  updatePlayerResourceCommitment={(choice) => void updatePlayerResourceCommitmentDecision(choice)}
                  updateWorldEventOffer={(choice) => void updateWorldEventOfferDecision(choice)}
                  updateCampaignRecovery={(choice) => void updateCampaignRecoveryDecision(choice)}
                  updateInvestigatorHeadquarters={(choice) => void updateInvestigatorHeadquartersDecision(choice)}
                  guidedManualRun={guidedManualRun}
                  runGuidedManualStep={() => void runGuidedManualStep()}
                  guidedStepJournal={guidedStepJournal}
                  sourceReviewUnlock={sourceReviewUnlock}
                  solvedCaseDebrief={solvedCaseDebrief}
                  replayPracticeLoop={replayPracticeLoop}
                  replayGoalCoach={replayGoalCoach}
                  manualEvidenceDrill={manualEvidenceDrill}
                  toggleManualEvidenceDrillEvidence={toggleManualEvidenceDrillEvidence}
                  manualTheoryDrill={manualTheoryDrill}
                  updateManualTheoryDrillField={updateManualTheoryDrillField}
                  approveManualTheoryFallback={approveManualTheoryFallback}
                  replayAttemptScorecard={replayAttemptScorecard}
                  startReplayGoalAttempt={() => void startReplayGoalAttempt()}
                  proofLedger={caseTruthLedger}
                  proofCoverage={caseProofCoverage}
                  routeCertificate={caseRouteCertificate}
                  proofTourSteps={proofTourSteps}
                  busy={busy}
                  commandDeckMode={Boolean(commandDeck) && runtimeMode === "server"}
                />
              )
            },
            {
              id: "logic",
              label: "\u903b\u8f91",
              content: (
                <div className="stackedInspector">
                  <CaseLogicPanel
                    accepted={Boolean(session?.judgement?.accepted)}
                    summary={logicReport?.summary}
                    logicReport={logicReport}
                    emergenceScore={quality?.emergenceScore ?? causalTrace?.emergenceScore ?? 0}
                    causalComplete={Boolean(quality?.causalTraceComplete || causalTrace?.complete)}
                    proofLedger={caseTruthLedger}
                    proofCoverage={caseProofCoverage}
                    routeCertificate={caseRouteCertificate}
                    graph={graphView}
                    selectedGraphExplanation={graphExplanation}
                    solutionChain={solutionChain}
                    revealText={revealText}
                  />
                  <ProofTourPanel steps={proofTourSteps} viewMode={proofViewMode} setViewMode={setProofViewMode} onSelectStep={handleProofTourStep} />
                  <EmergenceProofPanel trace={emergenceProofTrace} />
                  <CausalTracePanel
                    events={causalTraceEvents}
                    solved={Boolean(session?.judgement?.accepted)}
                    discoveredEvidenceIds={session?.discoveredEvidenceIds || []}
                    timeToMinutes={timeToMinutes}
                    onSelect={(event, nextTime) => {
                      setHighlightedEventId(event.id);
                      setSelectedSceneId(event.locationId);
                      setTimeValue(nextTime);
                      setInspectorTab("events");
                    }}
                  />
                </div>
              )
            },
            {
              id: "agent",
              label: "Agent",
              content: (
                <AgentControlPanel
                  runtimeMode={runtimeMode}
                  runtime={townRuntime}
                  queue={townQueue}
                  selectedAgent={selectedAgent}
                  selectedAgentCandidates={selectedAgentCandidates}
                  runningBusy={townRuntimeBusy}
                  selectedCharacterName={selectedCharacter?.name}
                  startRuntime={() => void startPersistentTown()}
                  pauseRuntime={() => void pausePersistentTown()}
                  stepRuntime={() => void stepPersistentTown()}
                  resetRuntime={() => void resetPersistentTown()}
                  interveneAgent={() => void intervenePersistentAgent()}
                  extractCase={(candidate) => void extractPersistentCandidate(candidate)}
                  scenarioPresets={scenarioPresets}
                  scenarioPacks={scenarioPacks}
                  scenarioRuns={scenarioRuns}
                  runCatalog={runCatalog}
                  runJobs={runJobs}
                  ruleState={townRuleState}
                  caseLifecycle={townCaseLifecycle}
                  selectedScenarioPackId={selectedScenarioPackId}
                  setSelectedScenarioPackId={setSelectedScenarioPackId}
                  selectedRunCatalogId={selectedRunCatalogId}
                  setSelectedRunCatalogId={setSelectedRunCatalogId}
                  selectedScenarioPresetId={selectedScenarioPresetId}
                  setSelectedScenarioPresetId={setSelectedScenarioPresetId}
                  selectScenarioRun={(runId) => void selectScenarioHistoryRun(runId)}
                  runScenario={(config) => void runDefaultTownScenario(config)}
                  saveScenarioPreset={(preset, overwrite) => void saveScenarioPresetFromUi(preset, overwrite)}
                  deleteScenarioPreset={(presetId) => void deleteScenarioPresetFromUi(presetId)}
                  exportScenarioPack={() => void exportScenarioPackFromUi()}
                  validateScenarioPack={() => void validateScenarioPackFromUi()}
                  exportReplayBundle={() => void exportReplayBundleFromUi()}
                  startScenarioJob={() => void startRunJobFromUi("scenario")}
                  startBenchmarkJob={() => void startRunJobFromUi("benchmark")}
                  cancelRunJob={(jobId) => void cancelRunJobFromUi(jobId)}
                  copyReviewJson={() => void copyReviewBundleJson()}
                  exportReviewMarkdown={() => void exportReviewBundleFile("markdown")}
                  exportReviewBundle={() => void exportReviewBundleFile("json")}
                  rollbackSnapshot={(snapshotId) => void rollbackTownSnapshot(snapshotId)}
                  markReviewExportTarget={markCurrentDiffAsReviewExportTarget}
                  selectedScenarioRun={scenarioRun}
                  scenarioReport={scenarioReport}
                  snapshots={townSnapshots}
                  selectedSnapshotFromId={selectedSnapshotFromId}
                  selectedSnapshotToId={selectedSnapshotToId}
                  setSelectedSnapshotFromId={setSelectedSnapshotFromId}
                  setSelectedSnapshotToId={setSelectedSnapshotToId}
                  snapshotDiff={snapshotDiff}
                  benchmarkSummary={benchmarkSummary}
                  runBenchmark={(seedCount) => void runEmergenceBenchmarkFromUi(seedCount)}
                  reviewBusy={reviewBusy}
                />
              )
            },
            {
              id: "people",
              label: "\u4eba\u7269",
              content: (
                <SuspectBoardPanel
                  rows={suspectBoard}
                  solved={Boolean(session?.judgement?.accepted)}
                  selectedSuspectId={selectedSuspectId}
                  explanations={suspectExplanations}
                  onSelect={(characterId) => {
                    setSelectedSuspectId(characterId);
                    setSelectedCharacterId(characterId);
                    highlightSelection({ characterId });
                  }}
                />
              )
            },
            {
              id: "developer",
              label: "\u5f00\u53d1\u8005",
              content: (
                <DeveloperPanel
                  worldId={world?.id}
                  caseId={activeCase?.id}
                  sessionId={session?.id}
                  memoryCount={selectedNpcMemories.length}
                  promptSafe={lastAiSafety?.promptAudit?.safe !== false}
                  selectedName={selectedCharacter?.name}
                  copyAgentApiExample={copyAgentApiExample}
                  agentApiExample={investigationReadQueries.agentApiExample}
                />
              )
            }
          ]}
        />
      )}
      overlay={(
        <>
          {runtimeMode === "server" ? campaignFrontDoorSurface : null}
          {!(runtimeMode === "server" && frontDoorOpen) && (
            <OnboardingOverlay
              open={onboarding.overlayOpen}
              tasks={onboarding.tasks}
              onSelectTask={handleGuidedTask}
              onDismiss={onboarding.dismiss}
            />
          )}
        </>
      )}
      onContextAction={commandDeckContext.onAction}
      onStrategicFrontFocus={(locationName) => { const location = world?.locations.find((item) => item.name === locationName); if (location) { setSelectedSceneId(location.id); setHoveredLocationId(location.id); setSelectedCharacterId(""); setSelectedEvidenceId(""); setInspectorTab("investigation"); } }}
      onStrategicAction={handleStrategicCommand}
    />
    </>
  );
}
