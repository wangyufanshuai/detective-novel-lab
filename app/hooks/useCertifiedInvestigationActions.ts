"use client";

import type { useCampaignController } from "@/app/controllers/useCampaignController";
import type { useInvestigationController } from "@/app/controllers/useInvestigationController";
import type { useCampaignComprehensionStudy } from "@/app/hooks/useCampaignComprehensionStudy";
import type { GuidedStepJournalEntry } from "@/app/campaign/replay-practice-model";
import type { SelectionHighlight } from "@/app/hooks/useGuidedOnboarding";
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
  joinCase: () => Promise<void>;
  discoverEvidence: (evidenceId: string) => Promise<void>;
  discoverFirstSceneEvidence: (sceneId: string) => Promise<void>;
  runInterrogationTarget: (characterId: string, evidenceId: string | undefined, questionText: string) => Promise<void>;
  interrogateSelected: () => Promise<void>;
  toggleTheoryEvidence: (evidenceId: string) => void;
  revealSolution: () => Promise<void>;
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
  const {
    world, activeCase, session, runtimeMode, playerName, selectedCharacterId, selectedEvidenceId, question,
    setSession, setSessions, setBusy, setProgress, setSelectedEvidenceId, setSelectedSceneId,
    setInspectorTab, setLastAiSafety, setActiveCase, setTheory, pushToast, setStatus
  } = investigation;
  const {
    setPlayerResourceCommitment, setFactionRelationship, setInvestigatorProgression
  } = campaign;

  async function joinCase() {
    if (!world || !activeCase) return;
    if (runtimeMode === "static-demo") {
      if (!session) {
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
      }
      setProgress((current) => ({ ...current, joinedInvestigation: true }));
      setStatus("Joined investigation. Click map locations for evidence and select NPCs to question.");
      return;
    }
    const stamp = new Date().toISOString();
    const optimisticSession: PlayerSession = {
      id: `session-pending-${Date.now()}`,
      worldId: world.id,
      caseId: activeCase.id,
      playerId: "player-pending",
      displayName: playerName.trim() || "Investigator",
      discoveredEvidenceIds: [],
      interrogationLog: [],
      createdAt: stamp,
      updatedAt: stamp
    };
    setSession(optimisticSession);
    setProgress((current) => ({ ...current, joinedInvestigation: true }));
    persist(world.id, optimisticSession.id);
    setStatus("Joined investigation. Click map locations for evidence and NPCs for questioning.");
    setBusy(true);
    try {
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
      setSession(data.session);
      if (data.playerResourceCommitment) setPlayerResourceCommitment(data.playerResourceCommitment);
      if (data.factionRelationship) setFactionRelationship(data.factionRelationship);
      if (data.investigatorProgression) setInvestigatorProgression(data.investigatorProgression);
      setProgress((current) => ({ ...current, joinedInvestigation: true }));
      setSessions((items) => [data.session, ...items.filter((item) => item.id !== data.session.id)]);
      persist(world.id, data.session.id);
      setStatus("Joined investigation. Click map locations for evidence and NPCs for questioning.");
      campaignStudy.recordMeaningfulAction();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to join investigation");
    } finally {
      setBusy(false);
    }
  }

  async function discoverEvidence(evidenceId: string) {
    const evidenceTitle = deductionCase?.evidence.find((item) => item.id === evidenceId)?.title || evidenceId;
    if (!session) {
      setStatus("Join the investigation before searching for evidence.");
      return;
    }
    if (runtimeMode === "static-demo") {
      const state = currentStaticState();
      if (!state) return;
      hydrateStatic(discoverDemoEvidence(state, evidenceId), false);
      setSelectedEvidenceId(evidenceId);
      const scene = scenes.find((item) => item.evidenceIds.includes(evidenceId));
      highlightSelection({ evidenceId, locationId: scene?.id });
      setInspectorTab("investigation");
      pushToast({ tone: "success", title: "Evidence found", detail: evidenceTitle });
      setStatus(`Evidence found: ${deductionCase?.evidence.find((item) => item.id === evidenceId)?.title || evidenceId}`);
      campaignStudy.recordMeaningfulAction();
      return;
    }
    setBusy(true);
    try {
      const data = await postJson<{
        session: PlayerSession;
        playerResourceCommitment?: PlayerResourceCommitmentPublicSummary;
        factionRelationship?: FactionRelationshipPublicSummary;
        investigatorProgression?: InvestigatorProgressionPublicSummary;
      }>("/api/investigation/discover", { sessionId: session.id, evidenceId });
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
      pushToast({ tone: "success", title: "Evidence found", detail: evidenceTitle });
      setStatus(`Evidence found: ${deductionCase?.evidence.find((item) => item.id === evidenceId)?.title || evidenceId}`);
      campaignStudy.recordMeaningfulAction();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to search evidence");
    } finally {
      setBusy(false);
    }
  }

  async function discoverFirstSceneEvidence(sceneId: string) {
    setSelectedSceneId(sceneId);
    setInspectorTab("investigation");
    const discovered = new Set(session?.discoveredEvidenceIds || []);
    const scene = scenes.find((item) => item.id === sceneId);
    const target =
      scene?.evidenceIds.find((id) => !discovered.has(id) && deductionCase?.evidence.find((item) => item.id === id)?.discoverable) ||
      scene?.evidenceIds.find((id) => deductionCase?.evidence.find((item) => item.id === id)?.discoverable);
    if (target) await discoverEvidence(target);
  }

  async function runInterrogationTarget(characterId: string, evidenceId: string | undefined, questionText: string) {
    if (!session || !characterId || !questionText.trim()) return;
    if (runtimeMode === "static-demo") {
      const state = currentStaticState();
      if (!state) return;
      const next = interrogateDemoNpc(state, { characterId, question: questionText, evidenceId });
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
        tone: next.progress.challengedTestimony ? "warning" : "info",
        title: next.progress.challengedTestimony ? "Testimony contradiction" : "NPC answered",
        detail: next.progress.challengedTestimony ? "Evidence exposed a contradiction inside known memories." : "The answer stayed within NPC memory and discovered evidence."
      });
      setStatus(next.progress.challengedTestimony ? "Evidence exposed a contradiction; NPC testimony was corrected." : "NPC answered from their own memory scope.");
      return;
    }
    setBusy(true);
    try {
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
      setStatus(data.testimonyUpdated ? "Evidence exposed a contradiction; NPC testimony was corrected." : "NPC answered from their own memory.");
      if (activeCase) {
        const latestCase = await fetch(apiUrl(`/api/cases/${activeCase.id}`)).then((response) => response.json());
        if (latestCase.ok) setActiveCase(latestCase.caseFromLog || latestCase.activeCase || latestCase.case);
      }
      campaignStudy.recordMeaningfulAction();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Questioning failed");
    } finally {
      setBusy(false);
    }
  }

  async function interrogateSelected() {
    await runInterrogationTarget(selectedCharacterId, selectedEvidenceId || undefined, question);
  }

  function toggleTheoryEvidence(evidenceId: string) {
    setTheory((current) => {
      const ids = new Set(current.evidenceIds);
      if (ids.has(evidenceId)) ids.delete(evidenceId);
      else ids.add(evidenceId);
      return { ...current, evidenceIds: Array.from(ids) };
    });
  }

  async function revealSolution() {
    if (!session?.judgement?.accepted) return;
    if (runtimeMode === "static-demo") {
      const state = currentStaticState();
      if (!state) return;
      const next = revealDemoSolution(state);
      hydrateStatic(next, false);
      setInspectorTab("logic");
      pushToast({ tone: "success", title: "Answer review unlocked", detail: "You can now inspect how evidence leads to the final conclusion." });
      setStatus("Answer review generated from local fact locks without calling DeepSeek.");
      return;
    }
    setBusy(true);
    try {
      const data = await postJson<{
        content: string;
        revealEval: RevealEvalReport;
        factContract: RevealFactContract;
        mock: boolean;
      }>("/api/investigation/reveal", { sessionId: session.id });
      investigation.setRevealText(data.content);
      setLastAiSafety((current) => ({ ...(current || {}), revealEval: data.revealEval, factContract: data.factContract, mock: data.mock }));
      setInspectorTab("logic");
      pushToast({ tone: "success", title: "Answer review generated", detail: "Facts are still constrained by local rules and case structure." });
      setStatus("Answer review generated and validated against local fact locks.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to generate answer review");
    } finally {
      setBusy(false);
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
