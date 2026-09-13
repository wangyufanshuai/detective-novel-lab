"use client";

import { useInvestigationActionScope } from "@/app/hooks/useInvestigationActionScope";
import { investigationActionBusy, investigationActionCancelled, type InvestigationActionResult } from "@/app/campaign/investigation-action-result";
import type { useCampaignController } from "@/app/controllers/useCampaignController";
import type { useInvestigationController } from "@/app/controllers/useInvestigationController";
import type { useCampaignComprehensionStudy } from "@/app/hooks/useCampaignComprehensionStudy";
import type { GuidedStepJournalEntry } from "@/app/campaign/replay-practice-model";
import { toggleTheoryEvidenceIds } from "@/app/campaign/final-detective-workspace-model";
import type { SelectionHighlight } from "@/app/hooks/useGuidedOnboarding";
import { useAppLocale } from "@/app/localization/locale-context";
import { apiUrl, postJson } from "@/app/lib/client-runtime";
import { discoverDemoEvidence, interrogateDemoNpc, revealDemoSolution } from "@/lib/engine";
import type {
  DeductionCase,
  DemoRuntimeState,
  FactionRelationshipPublicSummary,
  InvestigatorProgressionPublicSummary,
  NpcDialogueEvalReport,
  PlayerResourceCommitmentPublicSummary,
  PlayerSession,
  PromptAuditReport,
  RevealEvalReport,
  RevealFactContract
} from "@/lib/engine";

export type CertifiedInvestigationActionAdapter = {
  joinCase: () => Promise<InvestigationActionResult>;
  discoverEvidence: (evidenceId: string) => Promise<InvestigationActionResult>;
  discoverFirstSceneEvidence: (sceneId: string) => Promise<InvestigationActionResult>;
  runInterrogationTarget: (characterId: string, evidenceId: string | undefined, questionText: string) => Promise<InvestigationActionResult>;
  interrogateSelected: () => Promise<InvestigationActionResult>;
  toggleTheoryEvidence: (evidenceId: string) => void;
  revealSolution: () => Promise<InvestigationActionResult>;
};

type CertifiedInvestigationActionsInput = {
  investigation: ReturnType<typeof useInvestigationController>;
  campaign: ReturnType<typeof useCampaignController>;
  campaignStudy: ReturnType<typeof useCampaignComprehensionStudy>;
  deductionCase: DeductionCase | null;
  scenes: DeductionCase["scenes"];
  discoveredEvidenceCount: number;
  selectedNpcMemoryCount: number;
  appendJournal: (entry: Omit<GuidedStepJournalEntry, "id">) => void;
  highlightSelection: (next: SelectionHighlight) => void;
  persist: (worldId?: string, sessionId?: string) => void;
  currentStaticState: () => DemoRuntimeState | null;
  hydrateStatic: (state: DemoRuntimeState, resetTime?: boolean) => void;
};

/**
 * Owns the certified Join/Search/Question/Challenge/Reveal mutations.
 * Presentation surfaces consume this adapter and never construct requests.
 */
export function useCertifiedInvestigationActions({
  investigation,
  campaign,
  campaignStudy,
  deductionCase,
  scenes,
  discoveredEvidenceCount,
  selectedNpcMemoryCount,
  appendJournal,
  highlightSelection,
  persist,
  currentStaticState,
  hydrateStatic
}: CertifiedInvestigationActionsInput): CertifiedInvestigationActionAdapter {
  const { t } = useAppLocale();
  const {
    world, activeCase, session, runtimeMode, playerName, selectedCharacterId, selectedEvidenceId, question,
    setSession, setSessions, setBusy, setProgress, setSelectedEvidenceId, setSelectedSceneId,
    setInspectorTab, setLastAiSafety, setActiveCase, setTheory, pushToast, setStatus
  } = investigation;
  const {
    setPlayerResourceCommitment, setFactionRelationship, setInvestigatorProgression
  } = campaign;
  const actionScope = useInvestigationActionScope({
    worldId: world?.id, caseId: activeCase?.id, sessionId: session?.id, runtimeMode
  }, setBusy);

  async function joinCase(): Promise<InvestigationActionResult> {
    if (!world || !activeCase) return { status: "blocked", detail: "Open a case before joining the investigation." };
    if (session?.worldId === world.id && session.caseId === activeCase.id) {
      return { status: "blocked", detail: "You have already joined this investigation." };
    }
    const token = actionScope.begin();
    if (!token) return investigationActionBusy();
    try {
      if (runtimeMode === "static-demo") {
        const stamp = new Date().toISOString();
        const staticSession: PlayerSession = {
          id: `static-session-${Date.now()}`,
          worldId: world.id,
          caseId: activeCase.id,
          playerId: "static-player",
          displayName: playerName.trim() || "Investigator",
          discoveredEvidenceIds: [],
          interrogationLog: [],
          createdAt: stamp,
          updatedAt: stamp
        };
        setSession(staticSession);
        persist(world.id, staticSession.id);
        setProgress((current) => ({ ...current, joinedInvestigation: true }));
        setStatus(t("status.joined"));
        campaignStudy.recordMeaningfulAction();
        return { status: "succeeded", detail: t("status.joined") };
      }
      const data = await postJson<{
        session: PlayerSession;
        playerResourceCommitment?: PlayerResourceCommitmentPublicSummary;
        factionRelationship?: FactionRelationshipPublicSummary;
        investigatorProgression?: InvestigatorProgressionPublicSummary;
      }>("/api/players/join", {
        worldId: world.id,
        caseId: activeCase.id,
        displayName: playerName.trim() || "Investigator"
      });
      if (!actionScope.isCurrent(token)) return investigationActionCancelled();
      if (!data.session || data.session.worldId !== world.id || data.session.caseId !== activeCase.id) {
        throw new Error("Join response does not match the requested investigation");
      }
      setSession(data.session);
      if (data.playerResourceCommitment) setPlayerResourceCommitment(data.playerResourceCommitment);
      if (data.factionRelationship) setFactionRelationship(data.factionRelationship);
      if (data.investigatorProgression) setInvestigatorProgression(data.investigatorProgression);
      setProgress((current) => ({ ...current, joinedInvestigation: true }));
      setSessions((items) => [data.session, ...items.filter((item) => item.id !== data.session.id)]);
      persist(world.id, data.session.id);
      setStatus(t("status.joined"));
      campaignStudy.recordMeaningfulAction();
      return { status: "succeeded", detail: t("status.joined") };
    } catch {
      if (!actionScope.isCurrent(token)) return investigationActionCancelled();
      setStatus(t("error.join"));
      return { status: "failed", detail: t("error.join") };
    } finally {
      actionScope.finish(token);
    }
  }

  async function discoverEvidence(evidenceId: string): Promise<InvestigationActionResult> {
    const evidence = deductionCase?.evidence.find((item) => item.id === evidenceId);
    const evidenceTitle = evidence?.title || t("workspace.clue");
    if (!session || session.worldId !== world?.id || session.caseId !== activeCase?.id) {
      setStatus(t("status.joinFirst"));
      return { status: "blocked", detail: t("status.joinFirst") };
    }
    if (!evidence?.discoverable) return { status: "blocked", detail: "This clue cannot be searched in the current case." };
    if (session.discoveredEvidenceIds.includes(evidenceId)) return { status: "blocked", detail: "This clue is already in your notebook." };
    const token = actionScope.begin();
    if (!token) return investigationActionBusy();
    try {
      if (runtimeMode === "static-demo") {
        const state = currentStaticState();
        if (!state) return { status: "blocked", detail: t("status.joinFirst") };
        const next = discoverDemoEvidence(state, evidenceId);
        if (!next.session.discoveredEvidenceIds.includes(evidenceId)) return { status: "rejected", detail: "The search did not find this clue." };
        hydrateStatic(next, false);
        setSelectedEvidenceId(evidenceId);
        const scene = scenes.find((item) => item.evidenceIds.includes(evidenceId));
        highlightSelection({ evidenceId, locationId: scene?.id });
        setInspectorTab("investigation");
        pushToast({ tone: "success", title: t("status.evidenceFound"), detail: evidenceTitle });
        setStatus(`${t("status.evidenceFound")}: ${evidenceTitle}`);
        campaignStudy.recordMeaningfulAction();
        return { status: "succeeded", detail: `${t("status.evidenceFound")}: ${evidenceTitle}` };
      }
      const data = await postJson<{
        session: PlayerSession;
        playerResourceCommitment?: PlayerResourceCommitmentPublicSummary;
        factionRelationship?: FactionRelationshipPublicSummary;
        investigatorProgression?: InvestigatorProgressionPublicSummary;
      }>("/api/investigation/discover", { sessionId: session.id, evidenceId });
      if (!actionScope.isCurrent(token)) return investigationActionCancelled();
      if (!data.session || data.session.id !== session.id || data.session.caseId !== activeCase.id || data.session.worldId !== world.id) {
        throw new Error("Search response does not match the requested investigation");
      }
      if (!data.session.discoveredEvidenceIds.includes(evidenceId)) return { status: "rejected", detail: "The search did not find this clue." };
      setSession(data.session);
      if (data.playerResourceCommitment) {
        setPlayerResourceCommitment(data.playerResourceCommitment);
        const operation = data.playerResourceCommitment.lastAction;
        appendJournal({
          journalKey: `investigation-operation-search-${data.playerResourceCommitment.completedOperationCount}`,
          step: "search",
          label: "Search operation resolved",
          status: "done",
          result: operation ? `${operation.costLabel} ${operation.timeLabel}` : data.playerResourceCommitment.progressLabel,
          progressDelta: operation ? `${operation.gainLabel} ${operation.pressureLabel}` : data.playerResourceCommitment.benefitLabel,
          nextAction: operation?.nextAction || data.playerResourceCommitment.nextAction
        });
      }
      if (data.factionRelationship) setFactionRelationship(data.factionRelationship);
      if (data.investigatorProgression) setInvestigatorProgression(data.investigatorProgression);
      setProgress((current) => ({ ...current, discoveredEvidence: true }));
      setSelectedEvidenceId(evidenceId);
      const scene = scenes.find((item) => item.evidenceIds.includes(evidenceId));
      highlightSelection({ evidenceId, locationId: scene?.id });
      setInspectorTab("investigation");
      pushToast({ tone: "success", title: t("status.evidenceFound"), detail: evidenceTitle });
      setStatus(`${t("status.evidenceFound")}: ${evidenceTitle}`);
      campaignStudy.recordMeaningfulAction();
      return { status: "succeeded", detail: `${t("status.evidenceFound")}: ${evidenceTitle}` };
    } catch {
      if (!actionScope.isCurrent(token)) return investigationActionCancelled();
      setStatus(t("error.search"));
      return { status: "failed", detail: t("error.search") };
    } finally {
      actionScope.finish(token);
    }
  }

  async function discoverFirstSceneEvidence(sceneId: string): Promise<InvestigationActionResult> {
    setSelectedSceneId(sceneId);
    setInspectorTab("investigation");
    const discovered = new Set(session?.discoveredEvidenceIds || []);
    const scene = scenes.find((item) => item.id === sceneId);
    const target =
      scene?.evidenceIds.find((id) => !discovered.has(id) && deductionCase?.evidence.find((item) => item.id === id)?.discoverable);
    if (target) return discoverEvidence(target);
    return { status: "blocked", detail: "There are no new searchable clues at this location." };
  }

  async function runInterrogationTarget(characterId: string, evidenceId: string | undefined, questionText: string): Promise<InvestigationActionResult> {
    if (!session || session.worldId !== world?.id || session.caseId !== activeCase?.id) {
      return { status: "blocked", detail: t("status.joinFirst") };
    }
    if (!characterId || !deductionCase?.characters.some((character) => character.id === characterId) || !questionText.trim()) {
      return { status: "blocked", detail: "Choose a person and enter a question first." };
    }
    if (evidenceId && !session.discoveredEvidenceIds.includes(evidenceId)) {
      return { status: "blocked", detail: "Discover this clue before using it to question someone." };
    }
    const token = actionScope.begin();
    if (!token) return investigationActionBusy();
    try {
      if (runtimeMode === "static-demo") {
        const state = currentStaticState();
        if (!state) return { status: "blocked", detail: t("status.joinFirst") };
        const next = interrogateDemoNpc(state, { characterId, question: questionText, evidenceId });
        const testimonyUpdated = JSON.stringify(state.activeCase.testimonies) !== JSON.stringify(next.activeCase.testimonies);
        hydrateStatic(next, false);
        setLastAiSafety({
          mock: true,
          promptAudit: {
            memoryCount: selectedNpcMemoryCount,
            evidenceCount: discoveredEvidenceCount,
            forbiddenFieldHits: [],
            containsForbiddenTruth: false,
            hiddenEventLeakCount: 0,
            safe: true
          },
          memoryCount: selectedNpcMemoryCount,
          evidenceCount: discoveredEvidenceCount,
          safetyFlags: []
        });
        setInspectorTab("investigation");
        pushToast({
          tone: testimonyUpdated ? "warning" : "info",
          title: testimonyUpdated ? "Testimony contradiction" : "NPC answered",
          detail: testimonyUpdated ? "Evidence exposed a contradiction inside known memories." : "The answer stayed within NPC memory and discovered evidence."
        });
        const detail = testimonyUpdated ? "Evidence exposed a contradiction; NPC testimony was corrected." : evidenceId ? "This clue did not reveal a new contradiction in this testimony." : "NPC answered from their own memory scope.";
        setStatus(detail);
        campaignStudy.recordMeaningfulAction();
        return { status: evidenceId && !testimonyUpdated ? "rejected" : "succeeded", detail };
      }
      const data = await postJson<{
        entry: PlayerSession["interrogationLog"][number];
        session: PlayerSession;
        mock: boolean;
        promptAudit: PromptAuditReport;
        dialogueEval: NpcDialogueEvalReport;
        safetyFlags: string[];
        memoryCount: number;
        evidenceCount: number;
        testimonyUpdated: boolean;
        playerResourceCommitment?: PlayerResourceCommitmentPublicSummary;
        factionRelationship?: FactionRelationshipPublicSummary;
        investigatorProgression?: InvestigatorProgressionPublicSummary;
      }>("/api/investigation/interrogate", { sessionId: session.id, characterId, question: questionText, evidenceId });
      if (!actionScope.isCurrent(token)) return investigationActionCancelled();
      if (!data.session || data.session.id !== session.id || data.session.caseId !== activeCase.id || data.session.worldId !== world.id || !data.entry?.id) {
        throw new Error("Question response does not match the requested investigation");
      }
      // Read the refreshed testimony before applying the response. Switching a
      // case during either request must not update the newly opened case.
      const latestCase = data.testimonyUpdated
        ? await fetch(apiUrl(`/api/cases/${activeCase.id}`)).then((response) => response.json()).catch(() => null)
        : null;
      if (!actionScope.isCurrent(token)) return investigationActionCancelled();
      setSession(data.session);
      if (data.playerResourceCommitment) {
        setPlayerResourceCommitment(data.playerResourceCommitment);
        const operation = data.playerResourceCommitment.lastAction;
        appendJournal({
          journalKey: `investigation-operation-${operation?.lane || "question"}-${data.playerResourceCommitment.completedOperationCount}`,
          step: operation?.lane === "challenge" ? "challenge" : "question",
          label: `${operation?.lane === "challenge" ? "Challenge" : "Question"} operation resolved`,
          status: "done",
          result: operation ? `${operation.costLabel} ${operation.timeLabel}` : data.playerResourceCommitment.progressLabel,
          progressDelta: operation ? `${operation.gainLabel} ${operation.pressureLabel}` : data.playerResourceCommitment.benefitLabel,
          nextAction: operation?.nextAction || data.playerResourceCommitment.nextAction
        });
      }
      if (data.factionRelationship) setFactionRelationship(data.factionRelationship);
      if (data.investigatorProgression) setInvestigatorProgression(data.investigatorProgression);
      setProgress((current) => ({ ...current, challengedTestimony: current.challengedTestimony || data.testimonyUpdated }));
      setLastAiSafety({
        mock: data.mock,
        promptAudit: data.promptAudit,
        dialogueEval: data.dialogueEval,
        safetyFlags: data.safetyFlags,
        memoryCount: data.memoryCount,
        evidenceCount: data.evidenceCount
      });
      setInspectorTab("investigation");
      pushToast({
        tone: data.testimonyUpdated ? "warning" : "info",
        title: data.testimonyUpdated ? "Testimony contradiction" : "NPC answered",
        detail: data.testimonyUpdated ? "Evidence exposed a contradiction inside known memories." : "The answer stayed within NPC memory and discovered evidence."
      });
      const detail = data.testimonyUpdated ? "Evidence exposed a contradiction; NPC testimony was corrected." : evidenceId ? "This clue did not reveal a new contradiction in this testimony." : "NPC answered from their own memory.";
      setStatus(detail);
      const refreshedCase = latestCase?.ok && (latestCase.caseFromLog || latestCase.activeCase || latestCase.case);
      if (refreshedCase?.id === activeCase.id) setActiveCase(refreshedCase);
      campaignStudy.recordMeaningfulAction();
      return { status: evidenceId && !data.testimonyUpdated ? "rejected" : "succeeded", detail };
    } catch {
      if (!actionScope.isCurrent(token)) return investigationActionCancelled();
      setStatus(t("error.question"));
      return { status: "failed", detail: t("error.question") };
    } finally {
      actionScope.finish(token);
    }
  }

  async function interrogateSelected(): Promise<InvestigationActionResult> {
    return runInterrogationTarget(selectedCharacterId, selectedEvidenceId || undefined, question);
  }

  function toggleTheoryEvidence(evidenceId: string) {
    setTheory((current) => {
      const evidenceIds = toggleTheoryEvidenceIds(current.evidenceIds, evidenceId);
      return {
        ...current,
        evidenceIds,
        ...(current.proof && !evidenceIds.includes(evidenceId) ? {
          proof: {
            ...current.proof,
            motiveEvidenceIds: current.proof.motiveEvidenceIds.filter((id) => id !== evidenceId),
            methodEvidenceIds: current.proof.methodEvidenceIds.filter((id) => id !== evidenceId)
          }
        } : {})
      };
    });
  }

  async function revealSolution(): Promise<InvestigationActionResult> {
    if (!session || session.worldId !== world?.id || session.caseId !== activeCase?.id || !session.judgement?.accepted) {
      return { status: "blocked", detail: "An accepted theory is required before reviewing the answer." };
    }
    const token = actionScope.begin();
    if (!token) return investigationActionBusy();
    try {
      if (runtimeMode === "static-demo") {
        const state = currentStaticState();
        if (!state) return { status: "blocked", detail: t("status.joinFirst") };
        const next = revealDemoSolution(state);
        if (!next.revealText.trim()) return { status: "rejected", detail: "The answer review is not available yet." };
        hydrateStatic(next, false);
        setInspectorTab("logic");
        pushToast({ tone: "success", title: "Answer review unlocked", detail: "You can now inspect how evidence leads to the final conclusion." });
        setStatus("Answer review generated from local fact locks without calling DeepSeek.");
        return { status: "succeeded", detail: "Answer review unlocked." };
      }
      const data = await postJson<{
        content: string;
        revealEval: RevealEvalReport;
        factContract: RevealFactContract;
        mock: boolean;
      }>("/api/investigation/reveal", { sessionId: session.id });
      if (!actionScope.isCurrent(token)) return investigationActionCancelled();
      if (!data.content?.trim()) throw new Error("Answer review response was empty");
      investigation.setRevealText(data.content);
      setLastAiSafety((current) => ({ ...(current || {}), revealEval: data.revealEval, factContract: data.factContract, mock: data.mock }));
      setInspectorTab("logic");
      pushToast({ tone: "success", title: "Answer review generated", detail: "Facts are still constrained by local rules and case structure." });
      setStatus("Answer review generated and validated against local fact locks.");
      return { status: "succeeded", detail: "Answer review unlocked." };
    } catch {
      if (!actionScope.isCurrent(token)) return investigationActionCancelled();
      setStatus(t("error.reveal"));
      return { status: "failed", detail: t("error.reveal") };
    } finally {
      actionScope.finish(token);
    }
  }

  return {
    joinCase,
    discoverEvidence,
    discoverFirstSceneEvidence,
    runInterrogationTarget,
    interrogateSelected,
    toggleTheoryEvidence,
    revealSolution
  };
}
