"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveSafeContextActions, type SafeContextActionKind } from "@/app/campaign/context-action-resolver";
import { createInvestigationTurnState, transitionInvestigationTurn } from "@/app/campaign/investigation-turn-model";
import type { CertifiedInvestigationActionAdapter } from "@/app/hooks/useCertifiedInvestigationActions";
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
  onSubmitTheory: () => void | Promise<void>;
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

  const onAction = useCallback(async (kind: SafeContextActionKind) => {
    const handlers = callbacks.current;
    const action = actions.find((item) => item.kind === kind);
    if (!action?.enabled) return;
    setTurnState((current) => transitionInvestigationTurn(current, { type: "start-action", actionKind: kind, actionLabel: action.label }));
    try {
      switch (action.handlerKey) {
        case "joinCase": await handlers.actionAdapter.joinCase(); break;
        case "showEvents": await handlers.onShowEvents(); break;
        case "discoverSceneEvidence": if (input.selectedSceneId) await handlers.actionAdapter.discoverFirstSceneEvidence(input.selectedSceneId); break;
        case "interrogateCharacter":
          if (!input.selectedCharacter?.id) handlers.onShowInspector("investigation");
          else await handlers.actionAdapter.runInterrogationTarget(input.selectedCharacter.id, undefined, input.questionText);
          break;
        case "challengeTestimony": {
          const evidenceId = selectedEvidenceId || firstEvidenceId;
          if (!evidenceId) handlers.onShowInspector("investigation");
          else {
            handlers.onSelectEvidence(evidenceId);
            await handlers.actionAdapter.runInterrogationTarget(
              input.selectedCharacter?.id || "",
              evidenceId,
              "Please explain this evidence and whether it changes your earlier statement."
            );
          }
          break;
        }
        case "toggleTheoryEvidence":
          if (selectedEvidenceId) handlers.actionAdapter.toggleTheoryEvidence(selectedEvidenceId);
          handlers.onShowInspector("investigation");
          break;
        case "submitTheory": await handlers.onSubmitTheory(); break;
        case "showConclusion": handlers.onShowInspector("logic"); break;
        case "showTheory": handlers.onShowInspector("investigation"); break;
        case "showInstitution": handlers.onShowInspector("agent"); break;
        case "showRecovery":
        case "showInvestigation": handlers.onShowInspector("investigation"); break;
        default: break;
      }
    } finally {
      setTurnState((current) => transitionInvestigationTurn(current, { type: "finish-action", objectiveKey: objectiveKeyRef.current }));
    }
  }, [actions, firstEvidenceId, input.questionText, input.selectedCharacter?.id, input.selectedSceneId, selectedEvidenceId]);

  return { actions, selectedContext, onAction, turnState };
}
