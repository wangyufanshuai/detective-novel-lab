"use client";

import { useCallback, useMemo, useRef } from "react";
import { resolveSafeContextActions, type SafeContextActionKind } from "@/app/campaign/context-action-resolver";
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
  selectedInstitutionName?: string;
  selectedCharacter?: { name: string; role: string };
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
  onSearch: (sceneId: string) => void;
  onPrepareQuestion: (question: string) => void;
  onSelectEvidence: (evidenceId: string) => void;
  onShowInspector: (tab: "investigation" | "logic" | "agent") => void;
  onJoin: () => void;
};

export function useCommandDeckContext(input: CommandDeckContextInput) {
  const contextKind = input.inspectorTab === "agent" && input.selectedInstitutionName
    ? "institution" as const
    : input.selectedCharacter?.name
      ? "actor" as const
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
    revealAvailable: input.revealAvailable
  }), [contextKind, input.discoveredEvidenceIds.length, input.hasCase, input.hasSession, input.judgementAccepted, input.progress.challengedTestimony, input.progress.joinedInvestigation, input.progress.observedCrimeWindow, input.progress.submittedTheory, input.revealAvailable, input.searchableEvidenceIds.length]);

  const selectedContext = useMemo(() => contextKind === "institution" && input.selectedInstitutionName
    ? { kind: contextKind, label: input.selectedInstitutionName }
    : contextKind === "actor" && input.selectedCharacter
      ? { kind: contextKind, label: `${input.selectedCharacter.name} / ${input.selectedCharacter.role}` }
      : contextKind === "location" && input.selectedSceneName
        ? { kind: contextKind, label: input.selectedSceneName }
        : undefined,
  [contextKind, input.selectedCharacter, input.selectedInstitutionName, input.selectedSceneName]);

  const callbacks = useRef({
    onSearch: input.onSearch,
    onPrepareQuestion: input.onPrepareQuestion,
    onSelectEvidence: input.onSelectEvidence,
    onShowInspector: input.onShowInspector,
    onJoin: input.onJoin
  });
  callbacks.current = {
    onSearch: input.onSearch,
    onPrepareQuestion: input.onPrepareQuestion,
    onSelectEvidence: input.onSelectEvidence,
    onShowInspector: input.onShowInspector,
    onJoin: input.onJoin
  };
  const selectedCharacterName = input.selectedCharacter?.name;
  const firstEvidenceId = input.discoveredEvidenceIds[0];

  const onAction = useCallback((kind: SafeContextActionKind) => {
    const handlers = callbacks.current;
    if (kind === "search" && input.selectedSceneId) return handlers.onSearch(input.selectedSceneId);
    if (kind === "question" && selectedCharacterName) {
      handlers.onPrepareQuestion(`${selectedCharacterName}, where were you during the crime window, and what unusual details do you remember?`);
      return handlers.onShowInspector("investigation");
    }
    if (kind === "challenge") {
      if (firstEvidenceId) handlers.onSelectEvidence(firstEvidenceId);
      return handlers.onShowInspector("investigation");
    }
    if (kind === "advance" && !input.progress.joinedInvestigation) return handlers.onJoin();
    if (kind === "advance" && input.revealAvailable) return handlers.onShowInspector("logic");
    if (kind === "inspect" && contextKind === "institution") return handlers.onShowInspector("agent");
    return handlers.onShowInspector("investigation");
  }, [contextKind, firstEvidenceId, input.progress.joinedInvestigation, input.revealAvailable, input.selectedSceneId, selectedCharacterName]);

  return { actions, selectedContext, onAction };
}
