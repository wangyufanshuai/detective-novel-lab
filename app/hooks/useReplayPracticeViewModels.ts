import { useMemo } from "react";
import {
  countManualTheoryFields,
  unresolvedManualTheoryFields,
  type GuidedManualStepKind,
  type GuidedStepJournalEntry,
  type ReplayGoalAttemptState
} from "@/app/campaign/replay-practice-model";
import type {
  EvidenceNotebookItem,
  PlayerResourceCommitmentPublicSummary,
  PlayerSession,
  PlayerTheory,
  TownSocialResponsePublicSummary,
  WorldArcDirectivePublicSummary,
  WorldArcPublicSummary,
  WorldLeadCaseHandoffPublicSummary,
  WorldLeadOutcomePublicSummary,
  WorldPressureCascadePublicSummary
} from "@/lib/engine";

type GuidedManualRunView = {
  currentStep: GuidedManualStepKind;
  completedSteps: number;
  totalSteps: number;
  lastResult: string;
};

type SourceReviewUnlockView = {
  unlocked: boolean;
  selectedEvidenceCount: number;
  challengeHitCount: number;
  coveredObligations: number;
  totalObligations: number;
  proofGapCount: number;
  sourceEventCount: number;
  memoryCount: number;
  routeStepCount: number;
};

type RouteCertificateView = {
  theoryEvidenceIds?: string[];
} | null;

type PlayableIntakeView = {
  routeCertificate?: {
    theoryEvidenceIds?: string[];
  };
} | null;

type DiscoveredEvidenceView = {
  id: string;
  title: string;
  visibleDescription: string;
};

type CharacterView = {
  id: string;
  name: string;
  role: string;
};

export type ReplayPracticeViewModelInput = {
  session: PlayerSession | null;
  sourceReviewUnlock: SourceReviewUnlockView | null;
  guidedStepJournal: GuidedStepJournalEntry[];
  guidedManualRun: GuidedManualRunView;
  replayGoalAttempt: ReplayGoalAttemptState | null;
  theory: PlayerTheory;
  worldLeadOutcome: WorldLeadOutcomePublicSummary | null;
  worldLeadCaseHandoff: WorldLeadCaseHandoffPublicSummary | null;
  worldArc: WorldArcPublicSummary | null;
  worldArcDirective: WorldArcDirectivePublicSummary | null;
  worldPressureCascade: WorldPressureCascadePublicSummary | null;
  townSocialResponse: TownSocialResponsePublicSummary | null;
  playerResourceCommitment: PlayerResourceCommitmentPublicSummary | null;
  caseRouteCertificate: RouteCertificateView;
  playableIntake: PlayableIntakeView;
  evidenceNotebook: EvidenceNotebookItem[];
  discoveredEvidence: DiscoveredEvidenceView[];
  characters: CharacterView[];
};

export function useReplayPracticeViewModels({
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
}: ReplayPracticeViewModelInput) {
  const solvedCaseDebrief = useMemo(() => {
    if (!session?.judgement?.accepted || !sourceReviewUnlock) return null;
    const lastDoneEntry = [...guidedStepJournal].reverse().find((entry) => entry.status === "done");
    const manualStepCount = new Set(guidedStepJournal.filter((entry) => entry.status === "done").map((entry) => entry.step)).size;
    return {
      accepted: true,
      manualStepsCompleted: Math.max(guidedManualRun.completedSteps, manualStepCount),
      totalManualSteps: guidedManualRun.totalSteps,
      lastStepResult: lastDoneEntry?.result || guidedManualRun.lastResult,
      fallbackUsed: guidedStepJournal.some((entry) => entry.fallbackUsed),
      selectedEvidenceCount: sourceReviewUnlock.selectedEvidenceCount,
      challengeHitCount: sourceReviewUnlock.challengeHitCount,
      coveredObligations: sourceReviewUnlock.coveredObligations,
      totalObligations: sourceReviewUnlock.totalObligations,
      proofGapCount: sourceReviewUnlock.proofGapCount,
      sourceEventCount: sourceReviewUnlock.sourceEventCount,
      memoryCount: sourceReviewUnlock.memoryCount,
      routeStepCount: sourceReviewUnlock.routeStepCount,
      sourceReviewUnlocked: sourceReviewUnlock.unlocked,
      worldLeadOutcomeStatus: worldLeadOutcome?.status || "not-used" as const,
      worldLeadHandoffStatus: worldLeadCaseHandoff?.status || "not-used" as const,
      worldArcStatus: worldArc?.status || "not-used" as const,
      worldArcProgress: worldArc?.progressLabel || "not-used",
      worldArcDirectiveStatus: worldArcDirective?.status || "not-used" as const,
      worldPressureCascadeStatus: worldPressureCascade?.status || "empty" as const,
      townSocialResponseStatus: townSocialResponse?.status || "empty" as const,
      investigationOperationsStatus: playerResourceCommitment?.planStatus || "ready" as const,
      investigationOperationsSupport: `${playerResourceCommitment?.supportCount || 0}/${playerResourceCommitment?.supportCapacity || 2}`,
      investigationOperationsProgress: `${playerResourceCommitment?.completedOperationCount || 0}/3`,
      investigationOperationsTime: `${playerResourceCommitment?.townTimeMinutes || 0} min`
    };
  }, [guidedManualRun, guidedStepJournal, playerResourceCommitment, session, sourceReviewUnlock, townSocialResponse, worldArc, worldArcDirective, worldLeadCaseHandoff, worldLeadOutcome, worldPressureCascade]);

  const replayGoalCoach = useMemo(() => {
    const visible = Boolean(solvedCaseDebrief || replayGoalAttempt?.active);
    if (!visible) return null;
    const activeAttempt = Boolean(replayGoalAttempt?.active);
    const previousGuidedSteps = replayGoalAttempt?.previousGuidedSteps ?? solvedCaseDebrief?.manualStepsCompleted ?? 0;
    const previousFallbackUsed = replayGoalAttempt?.previousFallbackUsed ?? Boolean(solvedCaseDebrief?.fallbackUsed);
    const previousFallbackTheoryFieldCount = replayGoalAttempt?.previousFallbackTheoryFieldCount ?? (previousFallbackUsed ? 3 : 0);
    const previousSelectedEvidenceCount = replayGoalAttempt?.previousSelectedEvidenceCount ?? solvedCaseDebrief?.selectedEvidenceCount ?? 0;
    const previousProofGapCount = replayGoalAttempt?.previousProofGapCount ?? solvedCaseDebrief?.proofGapCount ?? 0;
    const previousSourceReviewUnlocked = replayGoalAttempt?.previousSourceReviewUnlocked ?? Boolean(solvedCaseDebrief?.sourceReviewUnlocked);
    const currentDoneSteps = new Set(guidedStepJournal.filter((entry) => entry.status === "done").map((entry) => entry.step)).size;
    const currentFallbackTheoryFieldCount = replayGoalAttempt?.fallbackTheoryFieldCount ?? 0;
    const currentReviewUnlocked = Boolean(session?.judgement?.accepted && (sourceReviewUnlock?.unlocked || guidedStepJournal.some((entry) => entry.reviewUnlocked)));
    const currentEvidenceSelected = theory.evidenceIds.length || session?.submittedTheory?.evidenceIds.length || 0;
    const accepted = Boolean(session?.judgement?.accepted);
    const goals = [
      {
        id: "reduce-fallback",
        label: "Reduce fallback",
        status: accepted && currentFallbackTheoryFieldCount < previousFallbackTheoryFieldCount ? "done" as const : activeAttempt ? "active" as const : "ready" as const,
        detail: previousFallbackUsed ? `Previous run used ${previousFallbackTheoryFieldCount} explicit fallback theory field(s); fill more fields manually before submit.` : "Keep the replay clean by avoiding explicit fallback."
      },
      {
        id: "manual-evidence-selection",
        label: "Manual evidence selection",
        status: currentEvidenceSelected > 0 ? "done" as const : activeAttempt ? "active" as const : "ready" as const,
        detail: "Select proof clues yourself before submit instead of relying only on the certified route."
      },
      {
        id: "fewer-guided-clicks",
        label: "Fewer guided clicks",
        status: accepted && currentDoneSteps > 0 && currentDoneSteps < previousGuidedSteps ? "done" as const : activeAttempt ? "active" as const : "ready" as const,
        detail: `Previous run used ${previousGuidedSteps} guided step(s); replay with fewer guided actions.`
      },
      {
        id: "review-source-after-submit",
        label: "Review source after submit",
        status: currentReviewUnlocked ? "done" as const : activeAttempt ? "active" as const : "ready" as const,
        detail: "After submit, open the source-backed workbench and compare the route confidence."
      }
    ];
    return {
      visible,
      activeAttempt,
      previousGuidedSteps,
      previousFallbackUsed,
      previousFallbackTheoryFieldCount,
      previousSelectedEvidenceCount,
      previousProofGapCount,
      previousSourceReviewUnlocked,
      currentStep: guidedManualRun.currentStep,
      lastResult: accepted ? guidedManualRun.lastResult : replayGoalAttempt?.lastResult || guidedManualRun.lastResult,
      completedGoalCount: goals.filter((goal) => goal.status === "done").length,
      totalGoalCount: goals.length,
      goals
    };
  }, [guidedManualRun, guidedStepJournal, replayGoalAttempt, session, solvedCaseDebrief, sourceReviewUnlock, theory.evidenceIds]);

  const manualEvidenceDrill = useMemo(() => {
    if (!replayGoalAttempt?.active || !session || session.judgement?.accepted) return null;
    const routeEvidenceIds = caseRouteCertificate?.theoryEvidenceIds?.length
      ? caseRouteCertificate.theoryEvidenceIds
      : playableIntake?.routeCertificate?.theoryEvidenceIds || [];
    const discoveredSet = new Set(session.discoveredEvidenceIds);
    const selectedSet = new Set(theory.evidenceIds);
    const routeDiscoveredIds = routeEvidenceIds.filter((id) => discoveredSet.has(id));
    const candidateItems = evidenceNotebook
      .filter((item) => !item.locked && discoveredSet.has(item.evidenceId))
      .filter((item) => !routeEvidenceIds.length || routeEvidenceIds.includes(item.evidenceId));
    if (!candidateItems.length) return null;
    const targetCount = Math.max(1, routeEvidenceIds.length || routeDiscoveredIds.length || candidateItems.length);
    const manualPickCount = candidateItems.filter((item) => selectedSet.has(item.evidenceId)).length;
    const remainingProofSlots = Math.max(0, targetCount - manualPickCount);
    return {
      visible: true,
      selectedEvidenceCount: theory.evidenceIds.length,
      routeEvidenceTargetCount: targetCount,
      manualPickCount: replayGoalAttempt.manualEvidencePickCount || manualPickCount,
      remainingProofSlots,
      readyForSubmit: routeDiscoveredIds.length > 0 && routeDiscoveredIds.every((id) => selectedSet.has(id)),
      candidates: candidateItems.map((item) => ({
        evidenceId: item.evidenceId,
        title: item.title,
        locationLabel: item.locationName || "Known location",
        sourceLabel: item.sourceEventLabel || "source-facing clue",
        supports: item.supports,
        contradicts: item.contradicts,
        selected: selectedSet.has(item.evidenceId)
      }))
    };
  }, [caseRouteCertificate, evidenceNotebook, playableIntake, replayGoalAttempt, session, theory.evidenceIds]);

  const manualTheoryDrill = useMemo(() => {
    if (!replayGoalAttempt?.active || !session || session.judgement?.accepted) return null;
    const routeEvidenceIds = caseRouteCertificate?.theoryEvidenceIds?.length
      ? caseRouteCertificate.theoryEvidenceIds
      : playableIntake?.routeCertificate?.theoryEvidenceIds || [];
    const selectedSet = new Set(theory.evidenceIds);
    const evidenceReady = routeEvidenceIds.length > 0 && routeEvidenceIds.every((id) => selectedSet.has(id));
    if (!evidenceReady) return null;
    const manualFieldCount = countManualTheoryFields(theory);
    const unresolvedFields = unresolvedManualTheoryFields(session.judgement);
    const evidencePrompts = discoveredEvidence
      .filter((item) => selectedSet.has(item.id))
      .slice(0, 4)
      .map((item, index) => {
        const notebookItem = evidenceNotebook.find((candidate) => candidate.evidenceId === item.id);
        const supportLabels = (notebookItem?.supports || [])
          .slice(0, 2)
          .map((label, labelIndex) => (
            /\b(?:npc|evidence|event|source|ev)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(label)
              ? `proof lane ${labelIndex + 1}`
              : label
          ));
        return {
          title: item.title,
          detail: item.visibleDescription,
          supportLabels: supportLabels.length ? supportLabels : [`discovered proof clue ${index + 1}`]
        };
      });
    return {
      visible: true,
      manualFieldCount,
      remainingFieldCount: Math.max(0, 3 - manualFieldCount),
      fallbackFieldCount: replayGoalAttempt.fallbackTheoryFieldCount,
      blockedGapCount: unresolvedFields.size,
      evidenceReady,
      readyForSubmit: evidenceReady && manualFieldCount === 3 && unresolvedFields.size === 0,
      fallbackApproved: replayGoalAttempt.theoryFallbackApproved,
      suspectOptions: characters.map((character) => ({
        id: character.id,
        label: `${character.name} / ${character.role}`
      })),
      selectedCulpritId: theory.culpritId,
      motiveText: theory.motive,
      methodText: theory.method,
      evidencePrompts
    };
  }, [caseRouteCertificate, characters, discoveredEvidence, evidenceNotebook, playableIntake, replayGoalAttempt, session, theory]);

  const replayAttemptScorecard = useMemo(() => {
    if (!replayGoalCoach) return null;
    const activeAttempt = Boolean(replayGoalAttempt?.active);
    const accepted = Boolean(session?.judgement?.accepted);
    const completed = activeAttempt && accepted;
    const currentDoneSteps = activeAttempt
      ? new Set(guidedStepJournal.filter((entry) => entry.status === "done").map((entry) => entry.step)).size
      : solvedCaseDebrief?.manualStepsCompleted ?? guidedManualRun.completedSteps;
    const currentFallbackUsed = activeAttempt
      ? guidedStepJournal.some((entry) => entry.fallbackUsed)
      : Boolean(solvedCaseDebrief?.fallbackUsed);
    const currentSelectedEvidenceCount = activeAttempt
      ? theory.evidenceIds.length || session?.submittedTheory?.evidenceIds.length || 0
      : (solvedCaseDebrief?.selectedEvidenceCount ?? theory.evidenceIds.length) || 0;
    const currentProofGapCount = sourceReviewUnlock?.proofGapCount ?? solvedCaseDebrief?.proofGapCount ?? replayGoalCoach.previousProofGapCount;
    const currentSourceReviewUnlocked = Boolean(session?.judgement?.accepted && (sourceReviewUnlock?.unlocked || guidedStepJournal.some((entry) => entry.reviewUnlocked)));
    const manualEvidencePickCount = replayGoalAttempt?.manualEvidencePickCount ?? 0;
    const fallbackEvidencePickCount = replayGoalAttempt?.fallbackEvidencePickCount ?? 0;
    const manualTheoryFieldCount = replayGoalAttempt?.manualTheoryFieldCount ?? countManualTheoryFields(theory);
    const fallbackTheoryFieldCount = replayGoalAttempt?.fallbackTheoryFieldCount ?? 0;
    const blockedTheoryGapCount = replayGoalAttempt?.blockedTheoryGapCount ?? 0;
    const pendingStatus = "pending" as const;
    const deltaNumber = (current: number, previous: number, lowerIsBetter = false) => {
      if (!completed) return pendingStatus;
      if (current === previous) return "unchanged" as const;
      return lowerIsBetter
        ? current < previous ? "improved" as const : "regressed" as const
        : current > previous ? "improved" as const : "regressed" as const;
    };
    const deltaFallback = () => {
      if (!completed) return pendingStatus;
      if (currentFallbackUsed === replayGoalCoach.previousFallbackUsed) return "unchanged" as const;
      return !currentFallbackUsed && replayGoalCoach.previousFallbackUsed ? "improved" as const : "regressed" as const;
    };
    return {
      visible: true,
      status: completed ? "completed" as const : "pending" as const,
      activeAttempt,
      currentStep: guidedManualRun.currentStep,
      lastResult: replayGoalCoach.lastResult,
      completedGuidedSteps: currentDoneSteps,
      fallbackUsed: currentFallbackUsed,
      selectedEvidenceCount: currentSelectedEvidenceCount,
      manualEvidencePickCount,
      fallbackEvidencePickCount,
      manualTheoryFieldCount,
      fallbackTheoryFieldCount,
      blockedTheoryGapCount,
      proofGapCount: currentProofGapCount,
      sourceReviewUnlocked: currentSourceReviewUnlocked,
      worldLeadOutcomeStatus: worldLeadOutcome?.status || "not-used" as const,
      worldLeadHandoffStatus: worldLeadCaseHandoff?.status || "not-used" as const,
      worldArcStatus: worldArc?.status || "not-used" as const,
      worldArcProgress: worldArc?.progressLabel || "not-used",
      worldArcDirectiveStatus: worldArcDirective?.status || "not-used" as const,
      worldPressureCascadeStatus: worldPressureCascade?.status || "empty" as const,
      townSocialResponseStatus: townSocialResponse?.status || "empty" as const,
      investigationOperationsStatus: playerResourceCommitment?.planStatus || "ready" as const,
      investigationOperationsProgress: `${playerResourceCommitment?.completedOperationCount || 0}/3 · ${playerResourceCommitment?.townTimeMinutes || 0} min`,
      completedReplayGoals: replayGoalCoach.completedGoalCount,
      totalReplayGoals: replayGoalCoach.totalGoalCount,
      rows: [
        {
          id: "guided-clicks",
          label: "Guided clicks",
          previous: `${replayGoalCoach.previousGuidedSteps}`,
          current: `${currentDoneSteps}`,
          status: deltaNumber(currentDoneSteps, replayGoalCoach.previousGuidedSteps, true),
          detail: completed ? "Lower guided-step count means the replay was more manual." : "Complete the replay attempt to compare guided-step count."
        },
        {
          id: "certified-fallback",
          label: "Explicit fallback",
          previous: replayGoalCoach.previousFallbackUsed ? "used" : "not used",
          current: `${currentFallbackUsed ? "used" : "not used"} / ${fallbackTheoryFieldCount} theory field(s) / ${fallbackEvidencePickCount} evidence pick(s)`,
          status: deltaFallback(),
          detail: completed ? "Field-level attribution separates manual theory work from explicit certified completion." : "Fallback remains pending until the player explicitly approves it and submits."
        },
        {
          id: "manual-evidence-selection",
          label: "Manual evidence selection",
          previous: `${replayGoalCoach.previousSelectedEvidenceCount}`,
          current: `${currentSelectedEvidenceCount} selected / ${manualEvidencePickCount} manual picks / ${fallbackEvidencePickCount} fallback picks`,
          status: deltaNumber(manualEvidencePickCount || currentSelectedEvidenceCount, replayGoalCoach.previousSelectedEvidenceCount),
          detail: completed ? "Manual picks are counted separately from any certified fallback evidence added at submit." : "Use Manual Evidence Drill before submit to improve this delta."
        },
        {
          id: "manual-theory-fields",
          label: "Manual theory fields",
          previous: `${Math.max(0, 3 - replayGoalCoach.previousFallbackTheoryFieldCount)} manual / ${replayGoalCoach.previousFallbackTheoryFieldCount} fallback`,
          current: `${manualTheoryFieldCount} manual / ${fallbackTheoryFieldCount} fallback / ${blockedTheoryGapCount} blocked gaps`,
          status: deltaNumber(manualTheoryFieldCount, Math.max(0, 3 - replayGoalCoach.previousFallbackTheoryFieldCount)),
          detail: completed ? "Suspect, motive, and method are attributed without displaying submitted text or certified values." : "Complete Manual Theory Drill or explicitly approve fallback for unresolved fields."
        },
        {
          id: "proof-gaps",
          label: "Proof gaps",
          previous: `${replayGoalCoach.previousProofGapCount}`,
          current: `${currentProofGapCount}`,
          status: deltaNumber(currentProofGapCount, replayGoalCoach.previousProofGapCount, true),
          detail: completed ? "Fewer proof gaps means the replay ended with a cleaner closure." : "Proof gaps are compared after judgement."
        },
        {
          id: "source-review",
          label: "Source review unlocked",
          previous: replayGoalCoach.previousSourceReviewUnlocked ? "unlocked" : "locked",
          current: currentSourceReviewUnlocked ? "unlocked" : "locked",
          status: currentSourceReviewUnlocked ? "completed" as const : pendingStatus,
          detail: currentSourceReviewUnlocked ? "Review Source is available for the replay attempt." : "Submit an accepted theory to unlock source review."
        },
        {
          id: "replay-goals",
          label: "Completed replay goals",
          previous: "baseline",
          current: `${replayGoalCoach.completedGoalCount}/${replayGoalCoach.totalGoalCount}`,
          status: completed ? "completed" as const : pendingStatus,
          detail: completed ? "Replay goals are summarized descriptively; no gate or score is enforced." : "Goals update as the replay attempt progresses."
        },
        {
          id: "world-lead-outcome",
          label: "World lead outcome",
          previous: "not used",
          current: worldLeadOutcome?.status || "not used",
          status: worldLeadOutcome?.status === "settled" ? "completed" as const : pendingStatus,
          detail: worldLeadOutcome?.status === "settled"
            ? "The bounded world effect settled with the accepted case without changing route coverage."
            : worldLeadOutcome?.status === "active"
              ? "The bounded world effect remains active until the current case closes."
              : "Following a world lead is optional and never changes the certified route."
        },
        {
          id: "investigation-operations",
          label: "Investigation operations",
          previous: "not used",
          current: `${playerResourceCommitment?.planStatus || "ready"} / ${playerResourceCommitment?.completedOperationCount || 0}/3 / ${playerResourceCommitment?.townTimeMinutes || 0} min`,
          status: playerResourceCommitment?.planStatus === "settled" ? "completed" as const : pendingStatus,
          detail: playerResourceCommitment?.lastAction
            ? `${playerResourceCommitment.lastAction.costLabel} ${playerResourceCommitment.lastAction.pressureLabel}`
            : "Plan up to two supported lanes or keep the always-legal Manual First route."
        },
        {
          id: "world-lead-handoff",
          label: "Next-case handoff",
          previous: "not used",
          current: worldLeadCaseHandoff?.status || "not used",
          status: worldLeadCaseHandoff?.status === "consumed" ? "completed" as const : pendingStatus,
          detail: worldLeadCaseHandoff?.status === "ready"
            ? "One bounded queue preference is ready for the next extracted case."
            : worldLeadCaseHandoff?.status === "consumed"
              ? "The follow-up was carried into the next case without changing its certified route."
              : "No next-case handoff was prepared for this replay."
        },
        {
          id: "world-arc-directive",
          label: "Faction directive",
          previous: "not used",
          current: worldArcDirective?.status || "not used",
          status: worldArcDirective?.status === "completed" ? "completed" as const : pendingStatus,
          detail: worldArcDirective?.status === "completed"
            ? "The selected response completed through the existing multi-tick town simulation."
            : worldArcDirective?.status === "blocked"
              ? "The operation is safely blocked and can use its alternate response."
              : "The directive remains a low-spoiler strategy layer outside certified case proof."
        },
        {
          id: "world-pressure-cascade",
          label: "World pressure",
          previous: "empty",
          current: worldPressureCascade?.status || "empty",
          status: worldPressureCascade?.status === "active" || worldPressureCascade?.status === "consumed" ? "completed" as const : pendingStatus,
          detail: worldPressureCascade?.status === "active"
            ? `${worldPressureCascade.remainingLayers} bounded layer(s) may reorder future, unextracted cases.`
            : worldPressureCascade?.status === "consumed"
              ? "A successful extraction consumed one bounded pressure layer."
              : "No cross-case pressure layer is active."
        },
        {
          id: "town-social-response",
          label: "Town reactions",
          previous: "empty",
          current: townSocialResponse?.status || "empty",
          status: townSocialResponse?.status === "settled" ? "completed" as const : pendingStatus,
          detail: townSocialResponse?.status === "ready"
            ? "A bounded public response is ready for the next normal town advance."
            : townSocialResponse?.status === "active"
              ? `${townSocialResponse.progressLabel} public reactions have surfaced without entering case authority.`
              : townSocialResponse?.status === "settled"
                ? "The latest ambient response settled outside evidence, memory testimony, and legal actions."
                : "No player-driven town response is currently recorded."
        }
      ]
    };
  }, [guidedManualRun, guidedStepJournal, playerResourceCommitment, replayGoalAttempt, replayGoalCoach, session, solvedCaseDebrief, sourceReviewUnlock, theory, townSocialResponse, worldArcDirective, worldLeadCaseHandoff, worldLeadOutcome, worldPressureCascade]);

  const replayPracticeLoop = useMemo(() => {
    if (!replayGoalCoach) return null;
    const labels = {
      start: "Start",
      discover: "Discover",
      "pick-evidence": "Pick Evidence",
      "fill-theory": "Fill Theory",
      submit: "Submit",
      "review-source": "Review Source",
      scorecard: "Scorecard"
    } as const;
    const orderedStages = Object.keys(labels) as Array<keyof typeof labels>;
    const activeAttempt = replayGoalCoach.activeAttempt;
    const sourceReviewUnlocked = Boolean(session?.judgement?.accepted && (sourceReviewUnlock?.unlocked || guidedStepJournal.some((entry) => entry.reviewUnlocked)));
    const scorecardStatus = replayAttemptScorecard?.status || (replayGoalCoach ? "pending" : "waiting");
    let currentPhase: keyof typeof labels = "start";
    if (!activeAttempt) currentPhase = "start";
    else if (scorecardStatus === "completed") currentPhase = "scorecard";
    else if (sourceReviewUnlocked) currentPhase = "review-source";
    else if (manualTheoryDrill) currentPhase = manualTheoryDrill.readyForSubmit || manualTheoryDrill.fallbackApproved ? "submit" : "fill-theory";
    else if (manualEvidenceDrill) currentPhase = "pick-evidence";
    else if (["search", "question", "challenge", "select-evidence"].includes(guidedManualRun.currentStep)) currentPhase = "discover";

    const manualEvidencePickCount = replayAttemptScorecard?.manualEvidencePickCount ?? replayGoalAttempt?.manualEvidencePickCount ?? manualEvidenceDrill?.manualPickCount ?? 0;
    const manualTheoryFieldCount = replayAttemptScorecard?.manualTheoryFieldCount ?? replayGoalAttempt?.manualTheoryFieldCount ?? manualTheoryDrill?.manualFieldCount ?? 0;
    const fallbackEvidencePickCount = replayAttemptScorecard?.fallbackEvidencePickCount ?? replayGoalAttempt?.fallbackEvidencePickCount ?? 0;
    const fallbackTheoryFieldCount = replayAttemptScorecard?.fallbackTheoryFieldCount ?? replayGoalAttempt?.fallbackTheoryFieldCount ?? manualTheoryDrill?.fallbackFieldCount ?? 0;
    const blockedGapCount = replayAttemptScorecard?.blockedTheoryGapCount ?? replayGoalAttempt?.blockedTheoryGapCount ?? manualTheoryDrill?.blockedGapCount ?? 0;

    const nextAction = !activeAttempt
      ? "Start replay attempt"
      : manualEvidenceDrill && !manualEvidenceDrill.readyForSubmit
        ? "Use Manual Evidence Drill"
        : manualTheoryDrill && !manualTheoryDrill.readyForSubmit && !manualTheoryDrill.fallbackApproved && manualTheoryDrill.blockedGapCount > 0
          ? "Revise fields or approve explicit fallback"
          : manualTheoryDrill && !manualTheoryDrill.readyForSubmit && !manualTheoryDrill.fallbackApproved
            ? "Use Manual Theory Drill"
            : manualTheoryDrill?.fallbackApproved
              ? "Run guided submit with explicit fallback"
              : sourceReviewUnlocked && scorecardStatus === "completed"
                ? "Read completed scorecard"
                : sourceReviewUnlocked
                  ? "Review source and read scorecard"
                  : "Run Next Guided Step";

    const currentIndex = orderedStages.indexOf(currentPhase);
    const stages = orderedStages.map((id, index) => ({
      id,
      label: labels[id],
      status: index < currentIndex
        ? "done" as const
        : index === currentIndex
          ? "current" as const
          : activeAttempt || id === "start"
            ? "ready" as const
            : "locked" as const
    }));

    return {
      visible: true,
      activeAttempt,
      currentPhase,
      currentPhaseLabel: labels[currentPhase],
      nextAction,
      manualEvidencePickCount,
      manualTheoryFieldCount,
      fallbackEvidencePickCount,
      fallbackTheoryFieldCount,
      blockedGapCount,
      sourceReviewUnlocked,
      scorecardStatus: scorecardStatus === "completed" ? "completed" as const : replayAttemptScorecard ? "pending" as const : "waiting" as const,
      worldLeadOutcomeStatus: worldLeadOutcome?.status || "not-used" as const,
      worldLeadHandoffStatus: worldLeadCaseHandoff?.status || "not-used" as const,
      worldArcStatus: worldArc?.status || "not-used" as const,
      worldArcProgress: worldArc?.progressLabel || "not-used",
      worldArcDirectiveStatus: worldArcDirective?.status || "not-used" as const,
      worldPressureCascadeStatus: worldPressureCascade?.status || "empty" as const,
      townSocialResponseStatus: townSocialResponse?.status || "empty" as const,
      investigationOperationsStatus: playerResourceCommitment?.planStatus || "ready" as const,
      investigationOperationsProgress: `${playerResourceCommitment?.completedOperationCount || 0}/3 · ${playerResourceCommitment?.townTimeMinutes || 0} min`,
      stages
    };
  }, [guidedManualRun.currentStep, guidedStepJournal, manualEvidenceDrill, manualTheoryDrill, playerResourceCommitment, replayAttemptScorecard, replayGoalAttempt, replayGoalCoach, session, sourceReviewUnlock, townSocialResponse, worldArc, worldArcDirective, worldLeadCaseHandoff, worldLeadOutcome, worldPressureCascade]);

  return {
    solvedCaseDebrief,
    replayGoalCoach,
    manualEvidenceDrill,
    manualTheoryDrill,
    replayAttemptScorecard,
    replayPracticeLoop
  };
}
