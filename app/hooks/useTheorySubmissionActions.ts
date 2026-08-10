"use client";

import type { useCampaignController } from "@/app/controllers/useCampaignController";
import type { useInvestigationController } from "@/app/controllers/useInvestigationController";
import type { useReplayController } from "@/app/controllers/useReplayController";
import type { GuidedStepJournalEntry } from "@/app/campaign/replay-practice-model";
import { postJson } from "@/app/lib/client-runtime";
import { submitDemoTheory } from "@/lib/engine";
import type {
  ArcConvergencePublicSummary,
  CampaignFinaleDebriefPublicSummary,
  CampaignRecoveryPublicSummary,
  CampaignSessionPublicSummary,
  DemoRuntimeState,
  FactionRelationshipPublicSummary,
  InvestigatorHeadquartersPublicSummary,
  InvestigatorProgressionPublicSummary,
  PlayerResourceCommitmentPublicSummary,
  PlayerSession,
  PlayerTheory,
  TownSocialResponsePublicSummary,
  WorldArcDirectivePublicSummary,
  WorldArcPublicSummary,
  WorldInfluenceBudgetPublicSummary,
  WorldLeadCaseHandoffPublicSummary,
  WorldLeadOutcomePublicSummary
} from "@/lib/engine";

type TheorySubmissionActionsInput = {
  investigation: ReturnType<typeof useInvestigationController>;
  campaign: ReturnType<typeof useCampaignController>;
  replay: ReturnType<typeof useReplayController>;
  appendJournal: (entry: Omit<GuidedStepJournalEntry, "id">) => void;
  currentStaticState: () => DemoRuntimeState | null;
  hydrateStatic: (state: DemoRuntimeState, resetProgress?: boolean) => void;
  refreshTownRuntime: (worldId?: string) => Promise<unknown>;
  recordTheoryResult: (accepted: boolean) => void;
  recordMeaningfulAction: () => void;
};

/** Owns theory submission and safe world-summary projection without changing request order or judgement authority. */
export function useTheorySubmissionActions({
  investigation,
  campaign,
  replay,
  appendJournal,
  currentStaticState,
  hydrateStatic,
  refreshTownRuntime,
  recordTheoryResult,
  recordMeaningfulAction
}: TheorySubmissionActionsInput) {
  const {
    session, theory, runtimeMode, world, setTheory, setSession, setBusy, setProgress,
    setInspectorTab, pushToast, setStatus
  } = investigation;
  const {
    setPlayerResourceCommitment, setFactionRelationship, setWorldLeadOutcome,
    setTownSocialResponse, setWorldLeadCaseHandoff, setWorldArc, setWorldArcDirective,
    setWorldInfluenceBudget, setInvestigatorProgression, setCampaignRecovery,
    setInvestigatorHeadquarters, setArcConvergence, setCampaignSession, setCampaignFinaleDebrief
  } = campaign;
  const { replayGoalAttempt } = replay;

  async function submitCurrentTheory(theoryOverride?: PlayerTheory, options?: { syncVisibleTheory?: boolean }) {
    if (!session) return null;
    const nextTheory = theoryOverride || theory;
    if (theoryOverride && options?.syncVisibleTheory !== false) setTheory(theoryOverride);
    if (runtimeMode === "static-demo") {
      const state = currentStaticState();
      if (!state) return null;
      const next = submitDemoTheory(state, nextTheory);
      hydrateStatic(next, false);
      recordTheoryResult(Boolean(next.session.judgement?.accepted));
      setInspectorTab("investigation");
      pushToast({
        tone: next.session.judgement?.accepted ? "success" : "warning",
        title: next.session.judgement?.accepted ? "Theory accepted" : "Theory has gaps",
        detail: next.session.judgement?.accepted ? "Answer review and final graph nodes are unlocked." : `Missing: ${next.session.judgement?.missing?.join(", ") || "key evidence chain"}`
      });
      setStatus(next.session.judgement?.accepted ? "Theory accepted. Final conclusion and answer review unlocked." : `Theory rejected: ${next.session.judgement?.missing?.join(", ") || "evidence chain incomplete"}`);
      return next.session.judgement || null;
    }
    setBusy(true);
    try {
      const data = await postJson<{
        judgement: PlayerSession["judgement"];
        session: PlayerSession;
        worldLeadOutcome?: WorldLeadOutcomePublicSummary;
        worldLeadCaseHandoff?: WorldLeadCaseHandoffPublicSummary;
        worldArc?: WorldArcPublicSummary;
        worldArcDirective?: WorldArcDirectivePublicSummary;
        playerResourceCommitment?: PlayerResourceCommitmentPublicSummary;
        factionRelationship?: FactionRelationshipPublicSummary;
        worldInfluenceBudget?: WorldInfluenceBudgetPublicSummary;
        investigatorProgression?: InvestigatorProgressionPublicSummary;
        investigatorHeadquarters?: InvestigatorHeadquartersPublicSummary;
        campaignRecovery?: CampaignRecoveryPublicSummary;
        arcConvergence?: ArcConvergencePublicSummary;
        campaignSession?: CampaignSessionPublicSummary;
        campaignFinaleDebrief?: CampaignFinaleDebriefPublicSummary;
        townSocialResponse?: TownSocialResponsePublicSummary;
      }>("/api/investigation/submit-theory", { sessionId: session.id, theory: nextTheory });
      setSession(data.session);
      if (data.playerResourceCommitment) {
        setPlayerResourceCommitment(data.playerResourceCommitment);
        appendJournal({
          journalKey: "investigation-operations-settled", step: "submit", label: "Investigation Operations settled", status: "done",
          result: data.playerResourceCommitment.progressLabel,
          progressDelta: data.playerResourceCommitment.lastAction?.pressureLabel || "Unused support returned once; spent support and bounded world benefits remain recorded.",
          nextAction: data.playerResourceCommitment.nextAction
        });
      }
      if (data.factionRelationship) {
        setFactionRelationship(data.factionRelationship);
        appendJournal({
          journalKey: `faction-standing-case-${data.factionRelationship.lastChangeLabel}`, step: "submit", label: "Case standing recorded", status: "done",
          result: data.factionRelationship.lastChangeLabel, progressDelta: data.factionRelationship.resourceEffectLabel, nextAction: data.factionRelationship.nextAction
        });
      }
      if (data.worldLeadOutcome) {
        setWorldLeadOutcome(data.worldLeadOutcome);
        appendJournal({
          journalKey: "world-lead-outcome", step: "submit", label: "World lead outcome settled", status: "done",
          result: "The bounded world effect settled after the accepted theory without changing the certified route.",
          progressDelta: "World state balance returned to the normal case flow.", nextAction: data.worldLeadOutcome.nextAction
        });
      }
      if (data.townSocialResponse) {
        setTownSocialResponse(data.townSocialResponse);
        if (data.townSocialResponse.status === "ready") {
          appendJournal({
            journalKey: "town-social-response-prepared", step: "submit", label: "Town response prepared", status: "info",
            result: data.townSocialResponse.headline, progressDelta: "A public reaction cycle is ready without changing case authority.",
            nextAction: data.townSocialResponse.nextAction
          });
        }
      }
      if (data.worldLeadCaseHandoff) {
        setWorldLeadCaseHandoff(data.worldLeadCaseHandoff);
        appendJournal({
          journalKey: "world-lead-handoff", step: "submit", label: "World lead handoff prepared", status: "done",
          result: "A bounded next-case follow-up is ready after the accepted theory.",
          progressDelta: "The next case queue will carry one safe preference without changing route coverage.", nextAction: data.worldLeadCaseHandoff.nextAction
        });
        await refreshTownRuntime(world?.id).catch(() => undefined);
      }
      if (data.worldArc) {
        setWorldArc(data.worldArc);
        appendJournal({
          journalKey: "world-arc", step: "submit", label: data.worldArc.status === "completed" ? "World arc completed" : "World arc advanced", status: "done",
          result: `${data.worldArc.label} advanced after the followed lead and accepted theory.`, progressDelta: data.worldArc.progressLabel, nextAction: data.worldArc.nextAction
        });
      }
      if (data.worldArcDirective) {
        setWorldArcDirective(data.worldArcDirective);
        appendJournal({
          journalKey: "world-arc-directive-prepared", step: "submit", label: "Faction directive prepared", status: "info",
          result: "A low-spoiler Support or Contain response is ready after the accepted theory.", progressDelta: data.worldArcDirective.progressLabel,
          nextAction: data.worldArcDirective.nextAction
        });
      }
      if (data.worldInfluenceBudget) setWorldInfluenceBudget(data.worldInfluenceBudget);
      if (data.investigatorProgression) {
        setInvestigatorProgression(data.investigatorProgression);
        appendJournal({
          journalKey: "investigator-progression", step: data.judgement?.accepted ? "submit" : "select-evidence",
          label: data.judgement?.accepted ? "Investigator practice recorded" : "Evidence practice recorded", status: "done",
          result: `${data.investigatorProgression.points} practice mark(s) 路 ${data.investigatorProgression.status}`,
          progressDelta: data.investigatorProgression.unlockedLabels.join(" / ") || "No bounded unlock yet.", nextAction: data.investigatorProgression.nextAction
        });
      }
      if (data.campaignRecovery) {
        setCampaignRecovery(data.campaignRecovery);
        appendJournal({
          journalKey: "campaign-recovery-theory", step: "submit", label: "Theory recovery path prepared", status: "blocked",
          result: data.campaignRecovery.failureLabel, progressDelta: data.campaignRecovery.recoveryActionLabel, nextAction: data.campaignRecovery.nextAction
        });
      } else if (replayGoalAttempt?.active && !data.judgement?.accepted) {
        const replayRecovery: CampaignRecoveryPublicSummary = {
          status: "ready",
          failureLabel: "Replay theory still has certified proof gaps.",
          recoveryActionLabel: "Review the existing certified clue route in this practice session.",
          costLabel: "Practice-only recovery: no resource reserve, town time, event, or Campaign state changes.",
          progressLabel: "Session-local recovery is ready without changing the Persistent Town.",
          completedCount: 0,
          queuedCount: 0,
          headquartersAvailable: false,
          headquartersActionLabel: "No Headquarters Recovery assist in replay practice.",
          nextAction: "Retry Recovery in this practice session; no world state will be written."
        };
        setCampaignRecovery(replayRecovery);
        appendJournal({
          journalKey: "campaign-recovery-theory", step: "submit", label: "Theory recovery path prepared", status: "blocked",
          result: replayRecovery.failureLabel, progressDelta: replayRecovery.recoveryActionLabel, nextAction: replayRecovery.nextAction
        });
      }
      if (data.investigatorHeadquarters) {
        setInvestigatorHeadquarters(data.investigatorHeadquarters);
        if (["ready", "completed"].includes(data.investigatorHeadquarters.status)) {
          appendJournal({
            journalKey: `investigator-headquarters-${data.investigatorHeadquarters.status}`, step: "submit",
            label: data.investigatorHeadquarters.status === "ready" ? "Investigator Headquarters prepared" : "Investigator Headquarters completed",
            status: data.investigatorHeadquarters.status === "ready" ? "info" : "done",
            result: data.investigatorHeadquarters.progressLabel, progressDelta: data.investigatorHeadquarters.benefitLabel,
            nextAction: data.investigatorHeadquarters.nextAction
          });
        }
      }
      if (data.arcConvergence) {
        setArcConvergence(data.arcConvergence);
        appendJournal({
          journalKey: `arc-convergence-theory-${data.arcConvergence.status}`, step: "submit",
          label: data.arcConvergence.status === "completed" ? "Campaign convergence completed" : data.arcConvergence.status === "ready" ? "Campaign finale formed" : "Campaign convergence updated",
          status: "done", result: `${data.arcConvergence.finaleLabel} / ${data.arcConvergence.approachLabel}`,
          progressDelta: `${data.arcConvergence.caseProgressLabel} / ${data.arcConvergence.worldProgressLabel}`, nextAction: data.arcConvergence.nextAction
        });
      }
      if (data.campaignSession) setCampaignSession(data.campaignSession);
      if (data.campaignFinaleDebrief) setCampaignFinaleDebrief(data.campaignFinaleDebrief);
      recordTheoryResult(Boolean(data.judgement?.accepted));
      setProgress((current) => ({ ...current, submittedTheory: true, solvedCase: Boolean(data.judgement?.accepted) }));
      setInspectorTab("investigation");
      pushToast({
        tone: data.judgement?.accepted ? "success" : "warning",
        title: data.judgement?.accepted ? "Theory accepted" : "Theory has gaps",
        detail: data.judgement?.accepted ? "Answer review can be generated." : `Missing: ${data.judgement?.missing?.join(", ") || "key evidence chain"}`
      });
      setStatus(data.judgement?.accepted ? "Theory accepted. Answer review can be generated." : `Theory rejected: ${data.judgement?.missing?.join(", ") || "evidence chain incomplete"}`);
      recordMeaningfulAction();
      return data.judgement || null;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to submit theory");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function submitTheory() {
    await submitCurrentTheory();
  }

  return { submitCurrentTheory, submitTheory };
}
