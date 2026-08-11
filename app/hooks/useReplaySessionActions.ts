"use client";

import type { useInvestigationController } from "@/app/controllers/useInvestigationController";
import type { useCampaignController } from "@/app/controllers/useCampaignController";
import type { useReplayController } from "@/app/controllers/useReplayController";
import type { ReplayPracticeViewModelInput, useReplayPracticeViewModels } from "@/app/hooks/useReplayPracticeViewModels";
import type { GuidedStepJournalEntry } from "@/app/campaign/replay-practice-model";
import { postJson } from "@/app/lib/client-runtime";
import { useAppLocale } from "@/app/localization/locale-context";
import type { PlayerResourceCommitmentPublicSummary, PlayerSession } from "@/lib/engine";

type ReplaySessionActionsInput = {
  investigation: ReturnType<typeof useInvestigationController>;
  campaign: ReturnType<typeof useCampaignController>;
  replay: ReturnType<typeof useReplayController>;
  replayViews: ReturnType<typeof useReplayPracticeViewModels>;
  sourceReviewUnlock: ReplayPracticeViewModelInput["sourceReviewUnlock"];
  appendJournal: (entry: Omit<GuidedStepJournalEntry, "id">) => void;
  persist: (worldId?: string, sessionId?: string) => void;
};

/** Starts a fresh replay session through the existing local join flow only. */
export function useReplaySessionActions({ investigation, campaign, replay, replayViews, sourceReviewUnlock, persist }: ReplaySessionActionsInput) {
  const { t } = useAppLocale();
  const {
    world, activeCase, session, runtimeMode, playerName, setSession, setSessions,
    setProgress, setTheory, setRevealText, setSelectedEvidenceId, setInspectorTab,
    setSelectedSceneId, pushToast, setStatus, setBusy
  } = investigation;
  const { playerResourceCommitment, setPlayerResourceCommitment, setWorldLead } = campaign;
  const {
    guidedStepJournal, setGuidedStepJournal, setReplayGoalAttempt, setGuidedManualLastResult,
    setServerPlaythroughSummary
  } = replay;
  const { replayGoalCoach, solvedCaseDebrief } = replayViews;

  async function startReplayGoalAttempt() {
    if (!world || !activeCase) return;
    const stamp = new Date().toISOString();
    const previousJournalStepCount = new Set(guidedStepJournal.filter((entry) => entry.status === "done").map((entry) => entry.step)).size;
    const previousFallbackUsed = replayGoalCoach?.previousFallbackUsed ?? Boolean(solvedCaseDebrief?.fallbackUsed || guidedStepJournal.some((entry) => entry.fallbackUsed));
    setReplayGoalAttempt({
      active: true,
      previousGuidedSteps: replayGoalCoach?.previousGuidedSteps ?? solvedCaseDebrief?.manualStepsCompleted ?? previousJournalStepCount,
      previousFallbackUsed,
      previousFallbackTheoryFieldCount: replayGoalCoach?.previousFallbackTheoryFieldCount ?? (previousFallbackUsed ? 3 : 0),
      previousSelectedEvidenceCount: replayGoalCoach?.previousSelectedEvidenceCount ?? solvedCaseDebrief?.selectedEvidenceCount ?? session?.submittedTheory?.evidenceIds.length ?? 0,
      previousProofGapCount: replayGoalCoach?.previousProofGapCount ?? solvedCaseDebrief?.proofGapCount ?? sourceReviewUnlock?.proofGapCount ?? 0,
      previousSourceReviewUnlocked: replayGoalCoach?.previousSourceReviewUnlocked ?? Boolean(solvedCaseDebrief?.sourceReviewUnlocked || sourceReviewUnlock?.unlocked),
      manualEvidencePickCount: 0,
      fallbackEvidencePickCount: 0,
      manualTheoryFieldCount: 0,
      fallbackTheoryFieldCount: 0,
      blockedTheoryGapCount: 0,
      theoryFallbackApproved: false,
      startedAt: stamp,
      lastResult: "replay attempt started"
    });
    setPlayerResourceCommitment(playerResourceCommitment ? {
      ...playerResourceCommitment,
      scope: "practice",
      scopeLabel: "Replay practice / world state frozen",
      nextAction: "Continue the session-local replay route; this frozen Operations result cannot reserve resources or change town pressure."
    } : playerResourceCommitment);
    setGuidedStepJournal([]);
    setWorldLead(null);
    setGuidedManualLastResult("replay attempt started");
    setTheory({ culpritId: "", motive: "", method: "", evidenceIds: [] });
    setRevealText("");
    setSelectedEvidenceId("");
    setServerPlaythroughSummary(null);
    setInspectorTab("investigation");
    const replayProgress = {
      observedCrimeWindow: true,
      joinedInvestigation: true,
      discoveredEvidence: false,
      challengedTestimony: false,
      submittedTheory: false,
      solvedCase: false
    };
    if (runtimeMode === "static-demo") {
      const replaySession: PlayerSession = {
        id: `static-replay-session-${Date.now()}`,
        worldId: world.id,
        caseId: activeCase.id,
        playerId: "static-player",
        displayName: playerName.trim() || "Investigator",
        discoveredEvidenceIds: [],
        interrogationLog: [],
        createdAt: stamp,
        updatedAt: stamp
      };
      setSession(replaySession);
      setSessions([replaySession]);
      setProgress(replayProgress);
      persist(world.id, replaySession.id);
      setSelectedSceneId(activeCase.generationProfile.sceneLocationId);
      pushToast({ tone: "info", title: "Replay attempt started", detail: "Try fewer guided clicks and choose evidence manually before submit." });
      setStatus("Replay attempt started in Static Runtime. No /api/* calls were made.");
      return;
    }
    const optimisticSession: PlayerSession = {
      id: `session-replay-pending-${Date.now()}`,
      worldId: world.id,
      caseId: activeCase.id,
      playerId: "player-replay-pending",
      displayName: playerName.trim() || "Investigator",
      discoveredEvidenceIds: [],
      interrogationLog: [],
      createdAt: stamp,
      updatedAt: stamp
    };
    setSession(optimisticSession);
    setProgress(replayProgress);
    persist(world.id, optimisticSession.id);
    setBusy(true);
    try {
      const data = await postJson<{ session: PlayerSession; playerResourceCommitment?: PlayerResourceCommitmentPublicSummary }>("/api/players/join", {
        worldId: world.id,
        caseId: activeCase.id,
        displayName: playerName.trim() || "Investigator"
      });
      setSession(data.session);
      if (data.playerResourceCommitment) setPlayerResourceCommitment(data.playerResourceCommitment);
      setSessions((items) => [data.session, ...items.filter((item) => item.id !== data.session.id)]);
      persist(world.id, data.session.id);
      setReplayGoalAttempt((current) => current ? { ...current, lastResult: "server replay session joined" } : current);
      pushToast({ tone: "info", title: "Server replay attempt started", detail: "A fresh local investigation session is ready." });
      setStatus("Server replay attempt started using the existing local join flow.");
    } catch {
      setReplayGoalAttempt((current) => current ? { ...current, lastResult: "replay attempt blocked" } : current);
      setStatus(t("error.generic"));
    } finally { setBusy(false); }
  }

  return { startReplayGoalAttempt };
}
