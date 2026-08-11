"use client";

import type { useInvestigationController } from "@/app/controllers/useInvestigationController";
import type { useCampaignController } from "@/app/controllers/useCampaignController";
import type { useTownRuntimeController } from "@/app/controllers/useTownRuntimeController";
import type { useReplayController } from "@/app/controllers/useReplayController";
import type { useCampaignComprehensionStudy } from "@/app/hooks/useCampaignComprehensionStudy";
import type { GuidedManualStepKind, GuidedStepJournalEntry } from "@/app/campaign/replay-practice-model";
import { postV1 } from "@/app/lib/client-runtime";
import { useAppLocale } from "@/app/localization/locale-context";
import type {
  ArcConvergencePublicSummary,
  CampaignFinaleDebriefPublicSummary,
  CampaignRecoveryPublicSummary,
  CampaignSessionPublicSummary,
  FactionRelationshipPublicSummary,
  InvestigatorHeadquartersPublicSummary,
  InvestigatorProgressionPublicSummary,
  PersistentTownRuntime,
  PlayerResourceCommitmentPublicSummary,
  TownEmergenceQueue,
  WorldArcDirectivePublicSummary,
  WorldArcPublicSummary,
  WorldEventOfferPublicSummary,
  WorldInfluenceBudgetPublicSummary,
  WorldLeadFocus,
  WorldLeadOutcomePublicSummary,
  WorldLeadPublicSummary,
  WorldPressureCascadePublicSummary,
  WorldState
} from "@/lib/engine";

type CampaignWorldChoiceActionsInput = {
  investigation: ReturnType<typeof useInvestigationController>;
  campaign: ReturnType<typeof useCampaignController>;
  town: ReturnType<typeof useTownRuntimeController>;
  replay: ReturnType<typeof useReplayController>;
  campaignStudy: ReturnType<typeof useCampaignComprehensionStudy>;
  appendJournal: (entry: Omit<GuidedStepJournalEntry, "id">) => void;
};

/** Zero-tick campaign choice adapters; every write still uses the existing runtime step endpoint. */
export function useCampaignWorldChoiceActions({ investigation, campaign, town, replay, campaignStudy, appendJournal }: CampaignWorldChoiceActionsInput) {
  const { t } = useAppLocale();
  const { world, setWorld, session, runtimeMode, setBusy, setStatus } = investigation;
  const { setTownRuntime, setTownQueue } = town;
  const { replayGoalAttempt } = replay;
  const {
    worldLead, setWorldLead, setWorldLeadOutcome, setWorldArc, setWorldArcDirective,
    setWorldPressureCascade, setWorldInfluenceBudget, setPlayerResourceCommitment,
    setFactionRelationship, setWorldEventOffer, setInvestigatorHeadquarters,
    setCampaignSession, setCampaignFinaleDebrief,
    campaignRecovery, setCampaignRecovery, setArcConvergence
  } = campaign;

  async function updateInvestigatorHeadquartersDecision(choice: InvestigatorHeadquartersPublicSummary["availableDirections"][number]["choice"]) {
    if (runtimeMode === "static-demo" || !world) return;
    setBusy(true);
    try {
      const data = await postV1<{
        runtime: PersistentTownRuntime;
        queue: TownEmergenceQueue;
        world: WorldState;
        investigatorHeadquarters: InvestigatorHeadquartersPublicSummary;
        campaignSession?: CampaignSessionPublicSummary;
        campaignFinaleDebrief?: CampaignFinaleDebriefPublicSummary;
      }>("/api/v1/command/town/runtime/step", {
        worldId: world.id,
        steps: 0,
        investigatorHeadquartersDecision: { choice }
      });
      setTownRuntime(data.runtime);
      setTownQueue(data.queue);
      setWorld(data.world);
      setInvestigatorHeadquarters(data.investigatorHeadquarters);
      if (data.campaignSession) setCampaignSession(data.campaignSession);
      if (data.campaignFinaleDebrief) setCampaignFinaleDebrief(data.campaignFinaleDebrief);
      appendJournal({
        journalKey: `investigator-headquarters-${choice}`,
        step: "submit",
        label: `Headquarters preparation selected: ${data.investigatorHeadquarters.choiceLabel || choice}`,
        status: "done",
        result: "One bounded cross-case preparation is locked without advancing the town clock.",
        progressDelta: data.investigatorHeadquarters.benefitLabel,
        nextAction: data.investigatorHeadquarters.nextAction
      });
      setStatus(`Headquarters prepared: ${data.investigatorHeadquarters.choiceLabel || choice}. Extract any legal next case when ready.`);
    } catch {
      setStatus(t("error.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function updateWorldLeadDecision(action: "follow" | "skip" | "resolve", journal = true) {
    if (runtimeMode === "static-demo" || !world || !session) return;
    setBusy(true);
    try {
      const data = await postV1<{
        runtime: PersistentTownRuntime; queue: TownEmergenceQueue; world: WorldState;
        worldLead: WorldLeadPublicSummary; worldLeadOutcome?: WorldLeadOutcomePublicSummary;
        worldArc?: WorldArcPublicSummary; worldInfluenceBudget?: WorldInfluenceBudgetPublicSummary;
        arcConvergence?: ArcConvergencePublicSummary;
      }>("/api/v1/command/town/runtime/step", { worldId: world.id, steps: 0, worldLeadDecision: { sessionId: session.id, action } });
      setTownRuntime(data.runtime);
      setTownQueue(data.queue);
      setWorld(data.world);
      setWorldLead(data.worldLead);
      if (data.worldLeadOutcome) setWorldLeadOutcome(data.worldLeadOutcome);
      if (data.worldArc) setWorldArc(data.worldArc);
      if (data.worldInfluenceBudget) setWorldInfluenceBudget(data.worldInfluenceBudget);
      if (data.arcConvergence) {
        setArcConvergence(data.arcConvergence);
        if (data.arcConvergence.status === "active") {
          appendJournal({
            journalKey: "arc-convergence-active", step: "join", label: "Campaign finale activated", status: "done",
            result: `${data.arcConvergence.finaleLabel} entered the normal certified case path.`,
            progressDelta: data.arcConvergence.approachLabel, nextAction: data.arcConvergence.nextAction
          });
        }
      }
      if (journal) {
        const label = action === "follow" ? "World lead followed" : action === "skip" ? "World lead skipped" : data.worldLeadOutcome ? "World lead outcome active" : "World lead resolved";
        appendJournal({
          journalKey: "world-lead", step: "join", label, status: action === "resolve" ? "done" : "info",
          result: action === "follow"
            ? "A server-backed world lead now prioritizes an eligible certified investigation step."
            : action === "skip" ? "The certified investigation route remains unchanged."
              : data.worldLeadOutcome ? `${data.worldLeadOutcome.benefitLabel} ${data.worldLeadOutcome.costLabel}`
                : "The selected world lead reached its eligible certified investigation step.",
          progressDelta: action === "follow" ? `Priority set to ${data.worldLead.focus}.`
            : action === "skip" ? "No route priority was changed."
              : data.worldLeadOutcome ? "One bounded world effect is active for this case." : "World lead marked complete without changing route coverage.",
          nextAction: data.worldLeadOutcome?.nextAction || data.worldLead.nextAction
        });
      }
      setStatus(action === "follow" ? "World lead followed. The next eligible certified step is prioritized."
        : action === "skip" ? "World lead skipped. The certified route remains the next action."
          : data.worldLeadOutcome ? "World lead resolved. A bounded world effect is active for this case." : "World lead resolved after its eligible certified step.");
      if (action !== "resolve") campaignStudy.recordWorldChoice("world-lead");
      return data.worldLead;
    } catch {
      setStatus(t("error.generic"));
      return undefined;
    } finally { setBusy(false); }
  }

  async function updateWorldArcDirectiveDecision(choice: "support" | "contain" | "defer") {
    if (runtimeMode === "static-demo" || !world) return;
    setBusy(true);
    try {
      const data = await postV1<{
        runtime: PersistentTownRuntime; queue: TownEmergenceQueue; world: WorldState;
        worldArcDirective: WorldArcDirectivePublicSummary; worldPressureCascade?: WorldPressureCascadePublicSummary;
        factionRelationship?: FactionRelationshipPublicSummary; worldInfluenceBudget?: WorldInfluenceBudgetPublicSummary;
        investigatorProgression?: InvestigatorProgressionPublicSummary;
      }>("/api/v1/command/town/runtime/step", { worldId: world.id, steps: 0, worldArcDirectiveDecision: { choice } });
      setTownRuntime(data.runtime);
      setTownQueue(data.queue);
      setWorld(data.world);
      setWorldArcDirective(data.worldArcDirective);
      if (data.worldPressureCascade) setWorldPressureCascade(data.worldPressureCascade);
      if (data.factionRelationship) setFactionRelationship(data.factionRelationship);
      if (data.worldInfluenceBudget) setWorldInfluenceBudget(data.worldInfluenceBudget);
      appendJournal({
        journalKey: choice === "defer" ? "world-arc-directive-deferred" : `world-arc-directive-chosen-${choice}`,
        step: "submit", label: choice === "defer" ? "Faction directive deferred" : `Faction directive ${choice} selected`, status: "info",
        result: choice === "defer" ? "The response remains open without advancing the town clock." : `${data.worldArcDirective.operationLabel} is scheduled through the existing town simulation.`,
        progressDelta: data.worldArcDirective.progressLabel, nextAction: data.worldArcDirective.nextAction
      });
      setStatus(choice === "defer" ? "Faction directive deferred. The response remains open." : `Faction directive ${choice} scheduled for the next legal institution cycle.`);
      campaignStudy.recordWorldChoice("faction-directive");
    } catch {
      setStatus(t("error.generic"));
    } finally { setBusy(false); }
  }

  async function updatePlayerResourceCommitmentDecision(allocations: WorldLeadFocus[]) {
    if (runtimeMode === "static-demo" || !world || !session) return;
    setBusy(true);
    try {
      const data = await postV1<{
        runtime: PersistentTownRuntime; queue: TownEmergenceQueue; world: WorldState;
        playerResourceCommitment: PlayerResourceCommitmentPublicSummary;
        factionRelationship?: FactionRelationshipPublicSummary; worldInfluenceBudget?: WorldInfluenceBudgetPublicSummary;
      }>("/api/v1/command/town/runtime/step", { worldId: world.id, steps: 0, playerResourceCommitmentDecision: { sessionId: session.id, allocations } });
      setTownRuntime(data.runtime);
      setTownQueue(data.queue);
      setWorld(data.world);
      setPlayerResourceCommitment(data.playerResourceCommitment);
      if (data.factionRelationship) setFactionRelationship(data.factionRelationship);
      if (data.worldInfluenceBudget) setWorldInfluenceBudget(data.worldInfluenceBudget);
      appendJournal({
        journalKey: `investigation-operations-${allocations.join("-") || "manual-first"}`, step: "join",
        label: allocations.length ? "Investigation support planned" : "Manual First operations planned", status: "info",
        result: data.playerResourceCommitment.progressLabel,
        progressDelta: allocations.length ? `${allocations.length}/${data.playerResourceCommitment.supportCapacity} support slots reserved without advancing the town clock.` : "No world resource changed; the slower certified route remains legal.",
        nextAction: data.playerResourceCommitment.nextAction
      });
      setStatus(allocations.length ? `Investigation Operations plan confirmed with ${allocations.length} supported lane(s).` : "Manual First plan confirmed. The certified route remains available without a reserve.");
      campaignStudy.recordWorldChoice("resource-commitment");
    } catch {
      setStatus(t("error.generic"));
    } finally { setBusy(false); }
  }

  async function updateWorldEventOfferDecision(choice: "accept" | "decline") {
    if (runtimeMode === "static-demo" || !world) return;
    setBusy(true);
    try {
      const data = await postV1<{
        runtime: PersistentTownRuntime; queue: TownEmergenceQueue; world: WorldState;
        worldEventOffer: WorldEventOfferPublicSummary; factionRelationship?: FactionRelationshipPublicSummary;
      }>("/api/v1/command/town/runtime/step", { worldId: world.id, steps: 0, worldEventOfferDecision: { choice } });
      setTownRuntime(data.runtime);
      setTownQueue(data.queue);
      setWorld(data.world);
      setWorldEventOffer(data.worldEventOffer);
      if (data.factionRelationship) setFactionRelationship(data.factionRelationship);
      appendJournal({
        journalKey: `world-event-offer-${choice}`, step: "submit", label: choice === "accept" ? "World opportunity accepted" : "World opportunity declined",
        status: choice === "accept" ? "info" : "done", result: data.worldEventOffer.progressLabel,
        progressDelta: choice === "accept" ? data.worldEventOffer.benefitLabel : "No resource, relationship, event, or tick changed.", nextAction: data.worldEventOffer.nextAction
      });
      setStatus(choice === "accept" ? "World opportunity accepted for the next legal institution cycle." : "World opportunity declined without a hidden penalty.");
      campaignStudy.recordWorldChoice("world-event-offer");
    } catch {
      setStatus(t("error.generic"));
    } finally { setBusy(false); }
  }

  async function updateCampaignRecoveryDecision(choice: "start" | "defer" | "use-headquarters") {
    if (runtimeMode === "static-demo" || !world) return;
    if (replayGoalAttempt?.active) {
      const next: CampaignRecoveryPublicSummary = {
        status: choice !== "defer" ? "completed" : "ready",
        failureLabel: "Replay theory still has certified proof gaps.",
        recoveryActionLabel: "Review the existing certified clue route in this practice session.",
        costLabel: "Practice-only recovery: no resource reserve, town time, event, or Campaign state changes.",
        progressLabel: choice !== "defer" ? "Session-local recovery completed; continue through the certified investigation route." : "Session-local recovery remains ready.",
        completedCount: choice !== "defer" ? 1 : 0, queuedCount: 0, headquartersAvailable: false,
        headquartersActionLabel: "No Headquarters Recovery assist in replay practice.",
        nextAction: choice !== "defer" ? "Continue through the certified investigation route in this replay practice session; Persistent Town remains unchanged." : "Retry this practice recovery when you are ready; Persistent Town remains unchanged."
      };
      setCampaignRecovery(next);
      appendJournal({ journalKey: `campaign-recovery-${choice}`, step: "submit", label: choice === "defer" ? "Campaign recovery deferred" : "Campaign recovery started", status: choice === "defer" ? "info" : "done", result: next.progressLabel, progressDelta: next.costLabel, nextAction: next.nextAction });
      setStatus(next.progressLabel);
      if (choice !== "defer") campaignStudy.recordRecoveryStarted();
      else campaignStudy.recordWorldChoice("campaign-recovery");
      return;
    }
    setBusy(true);
    try {
      const data = await postV1<{
        runtime: PersistentTownRuntime; queue: TownEmergenceQueue; world: WorldState; campaignRecovery: CampaignRecoveryPublicSummary;
        investigatorHeadquarters?: InvestigatorHeadquartersPublicSummary; factionRelationship?: FactionRelationshipPublicSummary;
        worldEventOffer?: WorldEventOfferPublicSummary;
      }>("/api/v1/command/town/runtime/step", { worldId: world.id, steps: 0, campaignRecoveryDecision: { choice } });
      setTownRuntime(data.runtime);
      setTownQueue(data.queue);
      setWorld(data.world);
      setCampaignRecovery(data.campaignRecovery);
      if (data.investigatorHeadquarters) setInvestigatorHeadquarters(data.investigatorHeadquarters);
      if (data.factionRelationship) setFactionRelationship(data.factionRelationship);
      if (data.worldEventOffer) setWorldEventOffer(data.worldEventOffer);
      appendJournal({
        journalKey: `campaign-recovery-${choice}`, step: "submit",
        label: choice === "defer" ? "Campaign recovery deferred" : choice === "use-headquarters" ? "Headquarters Recovery assist scheduled" : "Campaign recovery started",
        status: choice !== "defer" && data.campaignRecovery.status === "completed" ? "done" : "info",
        result: data.campaignRecovery.progressLabel, progressDelta: data.campaignRecovery.costLabel, nextAction: data.campaignRecovery.nextAction
      });
      setStatus(choice === "defer" ? "Recovery deferred; the certified case path remains available." : data.campaignRecovery.progressLabel);
      if (choice !== "defer") campaignStudy.recordRecoveryStarted();
      else campaignStudy.recordWorldChoice("campaign-recovery");
    } catch {
      setStatus(t("error.generic"));
    } finally { setBusy(false); }
  }

  async function resolveWorldLeadAfterStep(kind: GuidedManualStepKind) {
    if (worldLead?.status !== "followed" || worldLead.focus !== kind) return;
    await updateWorldLeadDecision("resolve");
  }

  return {
    updateInvestigatorHeadquartersDecision,
    updateWorldLeadDecision,
    updateWorldArcDirectiveDecision,
    updatePlayerResourceCommitmentDecision,
    updateWorldEventOfferDecision,
    updateCampaignRecoveryDecision,
    resolveWorldLeadAfterStep,
    campaignRecovery
  };
}
