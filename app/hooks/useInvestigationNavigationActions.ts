"use client";

import type { useInvestigationController } from "@/app/controllers/useInvestigationController";
import type { GuidedTask, SelectionHighlight } from "@/app/hooks/useGuidedOnboarding";
import type {
  DeductionCase,
  Evidence,
  EvidenceNotebookItem,
  PlayableCaseNextAction,
  ProofTourStep,
  WorldMapActor,
  WorldMapMarker
} from "@/lib/engine";

type NavigationGapCard = {
  label: string;
  target: "suspects" | "motive" | "method" | "evidence" | "exclusion" | "logic";
};

type InvestigationNavigationActionsInput = {
  investigation: ReturnType<typeof useInvestigationController>;
  scenes: DeductionCase["scenes"];
  characters: DeductionCase["characters"];
  discoveredEvidence: Evidence[];
  selectedScene?: DeductionCase["scenes"][number];
  selectedCharacter?: DeductionCase["characters"][number];
  persistentTownMode: boolean;
};

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Browser-only selection/navigation adapter. It cannot issue requests or mutate runtime authority. */
export function useInvestigationNavigationActions({
  investigation,
  scenes,
  characters,
  discoveredEvidence,
  selectedScene,
  selectedCharacter,
  persistentTownMode
}: InvestigationNavigationActionsInput) {
  const {
    events, activeCase, suspectBoard,
    setInspectorTab, setHighlightedEventId, setSelectedEvidenceId, setSelectedSceneId,
    setSelectedCharacterId, setSelectedSuspectId, setSelectedGapType, setQuestion,
    setTheory, setTimeValue, setSelectionHighlight, pushToast, setStatus, showLogic
  } = investigation;

  function highlightSelection(next: SelectionHighlight) {
    setSelectionHighlight(next);
  }

  function handleMarker(marker: WorldMapMarker) {
    setInspectorTab(marker.type === "event" ? "events" : "investigation");
    if (marker.eventId) setHighlightedEventId(marker.eventId);
    if (marker.evidenceId && marker.discovered) setSelectedEvidenceId(marker.evidenceId);
    else if (!marker.eventId) setSelectedEvidenceId("");
    setSelectedSceneId(marker.locationId);
    highlightSelection({ locationId: marker.locationId, eventId: marker.eventId, evidenceId: marker.evidenceId });
  }

  function handleActor(actor: WorldMapActor) {
    setSelectedCharacterId(actor.id);
    setSelectedSuspectId(actor.id);
    setSelectedSceneId(actor.locationId);
    setQuestion(`${actor.name}, where were you during the crime window, and what unusual details do you remember?`);
    highlightSelection({ characterId: actor.id, locationId: actor.locationId });
    setInspectorTab(persistentTownMode ? "agent" : "investigation");
  }

  function handleGapCard(card: NavigationGapCard) {
    setSelectedGapType(card.label);
    if (card.target === "suspects" || card.target === "exclusion") {
      const target = suspectBoard.find((row) => row.status !== "culprit") || suspectBoard[0];
      if (target) {
        setSelectedSuspectId(target.characterId);
        setSelectedCharacterId(target.characterId);
        highlightSelection({ characterId: target.characterId });
      }
      setInspectorTab("people");
      return;
    }
    if (card.target === "evidence") {
      const first = discoveredEvidence[0];
      if (first) {
        setSelectedEvidenceId(first.id);
        const scene = scenes.find((item) => item.evidenceIds.includes(first.id));
        if (scene) setSelectedSceneId(scene.id);
        highlightSelection({ evidenceId: first.id, locationId: scene?.id });
      }
      setInspectorTab("investigation");
      return;
    }
    if (card.target === "logic") {
      setInspectorTab("logic");
      return;
    }
    setInspectorTab("investigation");
  }

  function handleIntakeNextAction(action: PlayableCaseNextAction) {
    if (action.targetLocationId) {
      setSelectedSceneId(action.targetLocationId);
      highlightSelection({ locationId: action.targetLocationId, evidenceId: action.targetEvidenceId });
    }
    if (action.targetEvidenceId) {
      setSelectedEvidenceId(action.targetEvidenceId);
      setTheory((current) => current.evidenceIds.includes(action.targetEvidenceId as string)
        ? current
        : { ...current, evidenceIds: [...current.evidenceIds, action.targetEvidenceId as string] });
    }
    if (action.targetCharacterId) {
      setSelectedCharacterId(action.targetCharacterId);
      setSelectedSuspectId(action.targetCharacterId);
      setQuestion(action.kind === "challenge" && action.targetEvidenceId
        ? "Please explain this evidence and whether it changes your earlier statement."
        : "Where were you during the incident window, and what did you observe?");
      highlightSelection({
        locationId: action.targetLocationId,
        evidenceId: action.targetEvidenceId,
        characterId: action.targetCharacterId
      });
    }
    setInspectorTab("investigation");
    pushToast({ tone: "info", title: action.label, detail: action.detail });
    setStatus(action.detail);
  }

  function focusCertifiedStep(action: PlayableCaseNextAction) {
    if (action.targetLocationId) {
      setSelectedSceneId(action.targetLocationId);
      highlightSelection({ locationId: action.targetLocationId, evidenceId: action.targetEvidenceId });
    }
    if (action.targetEvidenceId && action.kind !== "search") setSelectedEvidenceId(action.targetEvidenceId);
    if (action.targetCharacterId) {
      setSelectedCharacterId(action.targetCharacterId);
      setSelectedSuspectId(action.targetCharacterId);
      setQuestion(action.kind === "challenge" && action.targetEvidenceId
        ? "Please explain this evidence and whether it changes your earlier statement."
        : "Where were you during the incident window, and what did you observe?");
      highlightSelection({ locationId: action.targetLocationId, evidenceId: action.targetEvidenceId, characterId: action.targetCharacterId });
    }
    setInspectorTab(action.kind === "review" || action.kind === "review-source" ? "logic" : "investigation");
    pushToast({ tone: "info", title: action.label, detail: action.detail });
    setStatus(action.detail);
  }

  function handleNotebookAction(item: EvidenceNotebookItem, action: "source" | "challenge" | "chain") {
    setSelectedEvidenceId(item.evidenceId);
    setSelectedSceneId(item.locationId);
    if (item.sourceEventId) setHighlightedEventId(item.sourceEventId);
    if (item.sourceEventLabel) {
      const source = events.find((event) => event.id === item.sourceEventId);
      if (source) setTimeValue(timeToMinutes(source.time));
    }
    if (action === "challenge" && item.challengeNpcIds[0]) {
      setSelectedCharacterId(item.challengeNpcIds[0]);
      setQuestion(`Please explain this evidence: ${item.title}`);
    }
    if (action === "chain" && item.discovered) {
      setTheory((current) => current.evidenceIds.includes(item.evidenceId)
        ? current
        : { ...current, evidenceIds: [...current.evidenceIds, item.evidenceId] });
    }
    highlightSelection({
      evidenceId: item.evidenceId,
      locationId: item.locationId,
      eventId: item.sourceEventId,
      characterId: item.challengeNpcIds[0]
    });
    setInspectorTab("investigation");
    pushToast({
      tone: item.locked ? "info" : action === "chain" ? "success" : "info",
      title: action === "chain" ? "Added to theory chain" : item.locked ? "Go to clue location" : "Evidence note selected",
      detail: item.locked ? `Search ${item.locationName} first.` : item.useHint
    });
  }

  function handleProofTourStep(step: ProofTourStep) {
    if (step.locationId) setSelectedSceneId(step.locationId);
    if (step.time) setTimeValue(timeToMinutes(step.time));
    if (step.eventIds[0]) setHighlightedEventId(step.eventIds[0]);
    if (step.evidenceIds[0]) setSelectedEvidenceId(step.evidenceIds[0]);
    if (step.characterIds[0]) {
      setSelectedCharacterId(step.characterIds[0]);
      setSelectedSuspectId(step.characterIds[0]);
    }
    highlightSelection({
      locationId: step.locationId,
      eventId: step.eventIds[0],
      evidenceId: step.evidenceIds[0],
      characterId: step.characterIds[0]
    });
    if (step.stage === "elimination") setInspectorTab("people");
    else if (["evidence", "memory", "contradiction"].includes(step.stage)) setInspectorTab("investigation");
    else setInspectorTab("logic");
  }

  function handleGuidedTask(task: GuidedTask) {
    setInspectorTab(task.targetTab);
    if (task.id === "observe") {
      const deathEvent = events.find((event) => event.type === "death") || events.find((event) => event.id === activeCase?.deathEventId);
      if (deathEvent) {
        setHighlightedEventId(deathEvent.id);
        setSelectedSceneId(deathEvent.locationId);
        setTimeValue(timeToMinutes(deathEvent.time));
        highlightSelection({ eventId: deathEvent.id, locationId: deathEvent.locationId });
      } else {
        setTimeValue(timeToMinutes("21:47"));
      }
      return;
    }
    if (task.id === "search") {
      const scene = selectedScene || scenes.find((item) => item.evidenceIds.length > 0) || scenes[0];
      if (scene) {
        setSelectedSceneId(scene.id);
        highlightSelection({ locationId: scene.id });
      }
      return;
    }
    if (task.id === "question") {
      const character = selectedCharacter || characters[0];
      if (character) {
        setSelectedCharacterId(character.id);
        highlightSelection({ characterId: character.id });
      }
      return;
    }
    if (task.id === "challenge") {
      const evidence = discoveredEvidence[0];
      const character = characters.find((item) => evidence?.relatedCharacterIds.includes(item.id)) || selectedCharacter || characters[0];
      if (evidence) setSelectedEvidenceId(evidence.id);
      if (character) setSelectedCharacterId(character.id);
      highlightSelection({ evidenceId: evidence?.id, characterId: character?.id });
      return;
    }
    if (task.id === "reveal") showLogic();
  }

  function selectGraphEvidence(evidenceId: string) {
    setSelectedEvidenceId(evidenceId);
    const scene = scenes.find((item) => item.evidenceIds.includes(evidenceId));
    if (scene) setSelectedSceneId(scene.id);
    highlightSelection({ evidenceId, locationId: scene?.id });
    setInspectorTab("investigation");
  }

  function selectGraphEvent(eventId: string) {
    const event = events.find((item) => item.id === eventId);
    setHighlightedEventId(eventId);
    if (event) {
      setSelectedSceneId(event.locationId);
      setTimeValue(timeToMinutes(event.time));
      highlightSelection({ eventId, locationId: event.locationId });
    }
    setInspectorTab("events");
  }

  function selectGraphCharacter(characterId: string) {
    setSelectedCharacterId(characterId);
    setSelectedSuspectId(characterId);
    setInspectorTab("people");
  }

  return {
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
  };
}
