"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveSafeContextActions, type SafeContextActionKind } from "@/app/campaign/context-action-resolver";
import { createInvestigationTurnState, transitionInvestigationTurn } from "@/app/campaign/investigation-turn-model";
import type { CertifiedInvestigationActionAdapter } from "@/app/hooks/useCertifiedInvestigationActions";
import type { InvestigationActionResult } from "@/app/campaign/investigation-action-result";
import { createDefaultTownRuleCatalog, type PersistentTownRuntime, type WorldState } from "@/lib/engine";

export function deriveCommandDeckInstitutionName(world: WorldState | null, runtime: PersistentTownRuntime | null, npcId: string) {
  if (!npcId) return undefined;
  const runtimeProfession = runtime?.ruleState?.professions.find((item) => item.npcId === npcId);
  const runtimeInstitution = runtimeProfession?.institutionId ? runtime?.ruleState?.institutions.find((item) => item.id === runtimeProfession.institutionId) : undefined;
  if (runtimeInstitution?.name) return runtimeInstitution.name;
  if (!world) return undefined;
  const catalog = createDefaultTownRuleCatalog(world, runtime?.tick || 0);
  const profession = catalog.professions.find((item) => item.npcId === npcId);
  return profession?.institutionId ? catalog.institutions.find((item) => item.id === profession.institutionId)?.name : undefined;
}

type CommandDeckContextInput = {
  inspectorTab: string;
  objectiveKey: string;
  selectedInstitutionName?: string;
  selectedCharacter?: { id: string; name: string; role: string };
  selectedEvidence?: { title: string; discovered: boolean; selectedForTheory: boolean };
  selectedEvidenceId?: string;
  selectedSceneName?: string;
  selectedSceneId?: string;
  hasCase: boolean;
  hasSession: boolean;
  progress: {
    observedCrimeWindow: boolean;
    joinedInvestigation: boolean;
    challengedTestimony: boolean;
    submittedTheory: boolean;
  };
  searchableEvidenceIds: string[];
  discoveredEvidenceIds: string[];
  judgementAccepted: boolean;
  revealAvailable: boolean;
  questionText: string;
  actionAdapter: CertifiedInvestigationActionAdapter;
  onSelectEvidence: (evidenceId: string) => void;
  onShowInspector: (tab: "investigation" | "logic" | "agent") => void;
  onShowEvents: () => void | Promise<void>;
  onSubmitTheory: () => InvestigationActionResult | void | Promise<InvestigationActionResult | void>;
};

export function useCommandDeckContext(input: CommandDeckContextInput) {
  const contextKind = input.inspectorTab === "agent" && input.selectedInstitutionName
    ? "institution" as const
    : input.inspectorTab === "logic"
      ? "theory" as const
    : input.selectedCharacter?.name
      ? "actor" as const
      : input.selectedEvidence?.title
        ? "evidence" as const
      : input.selectedSceneName
        ? "location" as const
        : undefined;

  const actions = useMemo(() => resolveSafeContextActions({
    contextKind,
    hasCase: input.hasCase,
    hasSession: input.hasSession,
    observed: input.progress.observedCrimeWindow,
    joined: input.progress.joinedInvestigation,
    hasSearchableEvidence: input.searchableEvidenceIds.length > 0,
    hasDiscoveredEvidence: input.discoveredEvidenceIds.length > 0,
    challengedTestimony: input.progress.challengedTestimony,
    theorySubmitted: input.progress.submittedTheory,
    judgementAccepted: input.judgementAccepted,
    revealAvailable: input.revealAvailable,
    selectedEvidenceDiscovered: input.selectedEvidence?.discovered,
    selectedEvidenceInTheory: input.selectedEvidence?.selectedForTheory
  }), [contextKind, input.discoveredEvidenceIds.length, input.hasCase, input.hasSession, input.judgementAccepted, input.progress.challengedTestimony, input.progress.joinedInvestigation, input.progress.observedCrimeWindow, input.progress.submittedTheory, input.revealAvailable, input.searchableEvidenceIds.length, input.selectedEvidence?.discovered, input.selectedEvidence?.selectedForTheory]);

  const selectedContext = useMemo(() => contextKind === "institution" && input.selectedInstitutionName
    ? { kind: contextKind, label: input.selectedInstitutionName }
    : contextKind === "actor" && input.selectedCharacter
      ? { kind: contextKind, label: `${input.selectedCharacter.name} / ${input.selectedCharacter.role}` }
      : contextKind === "evidence" && input.selectedEvidence
        ? { kind: contextKind, label: input.selectedEvidence.title }
        : contextKind === "theory"
          ? { kind: contextKind, label: input.judgementAccepted ? "Accepted theory" : "Current theory" }
      : contextKind === "location" && input.selectedSceneName
        ? { kind: contextKind, label: input.selectedSceneName }
        : undefined,
  [contextKind, input.judgementAccepted, input.selectedCharacter, input.selectedEvidence, input.selectedInstitutionName, input.selectedSceneName]);
  const contextLabel = selectedContext?.label;
  const objectiveKeyRef = useRef(input.objectiveKey);
  objectiveKeyRef.current = input.objectiveKey;
  const [turnState, setTurnState] = useState(() => createInvestigationTurnState({ objectiveKey: input.objectiveKey, contextLabel }));
  useEffect(() => {
    setTurnState((current) => transitionInvestigationTurn(current, { type: "sync", objectiveKey: input.objectiveKey, contextLabel }));
  }, [contextLabel, input.objectiveKey]);

  const callbacks = useRef({
    actionAdapter: input.actionAdapter,
    onSelectEvidence: input.onSelectEvidence,
    onShowInspector: input.onShowInspector,
    onShowEvents: input.onShowEvents,
    onSubmitTheory: input.onSubmitTheory
  });
  callbacks.current = {
    actionAdapter: input.actionAdapter,
    onSelectEvidence: input.onSelectEvidence,
    onShowInspector: input.onShowInspector,
    onShowEvents: input.onShowEvents,
    onSubmitTheory: input.onSubmitTheory
  };
  const firstEvidenceId = input.discoveredEvidenceIds[0];
  const selectedEvidenceId = input.selectedEvidenceId;

  const onAction = useCallback(async (kind: SafeContextActionKind): Promise<InvestigationActionResult> => {
    const handlers = callbacks.current;
    const action = actions.find((item) => item.kind === kind);
    if (!action?.enabled) return { status: "blocked", detail: action?.disabledReason || "Choose an available action for the current investigation." };
    setTurnState((current) => transitionInvestigationTurn(current, { type: "start-action", actionKind: kind, actionLabel: action.label }));
    try {
      switch (action.handlerKey) {
        case "joinCase": return await handlers.actionAdapter.joinCase();
        case "showEvents":
          await handlers.onShowEvents();
          return { status: "succeeded", detail: "The event timeline is ready to review." };
        case "discoverSceneEvidence":
          if (!input.selectedSceneId) return { status: "blocked", detail: "Select a location before searching for evidence." };
          return await handlers.actionAdapter.discoverFirstSceneEvidence(input.selectedSceneId);
        case "interrogateCharacter":
          if (!input.selectedCharacter?.id) return { status: "blocked", detail: "Select a character before asking a question." };
          return await handlers.actionAdapter.runInterrogationTarget(input.selectedCharacter.id, undefined, input.questionText);
        case "challengeTestimony": {
          const evidenceId = selectedEvidenceId || firstEvidenceId;
          if (!input.selectedCharacter?.id || !evidenceId || !input.discoveredEvidenceIds.includes(evidenceId)) return { status: "blocked", detail: "Select a character and discovered evidence before challenging testimony." };
          handlers.onSelectEvidence(evidenceId);
          return await handlers.actionAdapter.runInterrogationTarget(
            input.selectedCharacter.id,
            evidenceId,
            "Please explain this evidence and whether it changes your earlier statement."
          );
        }
        case "toggleTheoryEvidence":
          if (!selectedEvidenceId || !input.discoveredEvidenceIds.includes(selectedEvidenceId)) return { status: "blocked", detail: "Select discovered evidence before adding it to the theory." };
          handlers.actionAdapter.toggleTheoryEvidence(selectedEvidenceId);
          handlers.onShowInspector("investigation");
          return { status: "succeeded", detail: "The theory evidence selection was updated." };
        case "submitTheory":
          return (await handlers.onSubmitTheory()) || { status: "blocked", detail: "The theory has no confirmed submission result. Review the investigation before continuing." };
        case "showConclusion":
          handlers.onShowInspector("logic");
          return { status: "succeeded", detail: "The conclusion review is open." };
        case "showTheory":
          handlers.onShowInspector("investigation");
          return { status: "succeeded", detail: "The theory workspace is open." };
        case "showInstitution":
          handlers.onShowInspector("agent");
          return { status: "succeeded", detail: "The institution review is open." };
        case "showRecovery":
        case "showInvestigation":
          handlers.onShowInspector("investigation");
          return { status: "succeeded", detail: "The investigation workspace is open." };
        default: return { status: "blocked", detail: "This action is not available in the current investigation." };
      }
    } catch {
      return { status: "failed", detail: "The action could not finish. Please review the investigation and try again." };
    } finally {
      // This clears presentation execution state; the returned result is the
      // only authority for success, rejection, cancellation, or failure.
      setTurnState((current) => transitionInvestigationTurn(current, { type: "finish-action", objectiveKey: objectiveKeyRef.current }));
    }
  }, [actions, firstEvidenceId, input.discoveredEvidenceIds, input.questionText, input.selectedCharacter?.id, input.selectedSceneId, selectedEvidenceId]);

  return { actions, selectedContext, onAction, turnState };
}
