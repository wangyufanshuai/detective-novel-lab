"use client";

import { useMemo } from "react";
import { hasContradictionHit, useInvestigationView } from "@/app/hooks/useInvestigationActions";
import type { useInvestigationController } from "@/app/controllers/useInvestigationController";
import type { useTownRuntimeController } from "@/app/controllers/useTownRuntimeController";
import type { GapCard, GraphNodeExplanation, InvestigationStage, SuspectExplanation } from "@/app/components/DetectiveTownUI";
import type { WorldEvent } from "@/lib/engine";

type InvestigationWorkspacePresentationInput = {
  investigation: ReturnType<typeof useInvestigationController>;
  town: ReturnType<typeof useTownRuntimeController>;
};

/** Request-free presentation derivations shared by the map, Inspector, and certified workspace. */
export function useInvestigationWorkspacePresentation({ investigation, town }: InvestigationWorkspacePresentationInput) {
  const {
    world, events, activeCase, session, snapshot, selectedSceneId, selectedCharacterId, selectedEvidenceId,
    highlightedEventId, theory, revealText, progress, selectedGraphNode, suspectBoard, hoveredLocationId, inspectorTab
  } = investigation;
  const deductionCase = activeCase?.deductionCase || null;
  const scenes = useMemo(() => deductionCase?.scenes || [], [deductionCase?.scenes]);
  const characters = useMemo(
    () => deductionCase?.characters.filter((character) => character.role !== "死者") || [],
    [deductionCase?.characters]
  );
  const discovered = useMemo(() => new Set(session?.discoveredEvidenceIds || []), [session?.discoveredEvidenceIds]);
  const selectedScene = useMemo(() => scenes.find((scene) => scene.id === selectedSceneId) || scenes[0], [scenes, selectedSceneId]);
  const selectedCharacter = useMemo(
    () => characters.find((character) => character.id === selectedCharacterId),
    [characters, selectedCharacterId]
  );
  const allCaseEvidence = useMemo(() => deductionCase?.evidence || [], [deductionCase?.evidence]);
  const sceneEvidence = useMemo(() => {
    const sceneEvidenceRaw = selectedScene ? allCaseEvidence.filter((item) => selectedScene.evidenceIds.includes(item.id)) : [];
    if (sceneEvidenceRaw.some((item) => item.discoverable && !discovered.has(item.id))) return sceneEvidenceRaw;
    return [
      ...sceneEvidenceRaw,
      ...allCaseEvidence
        .filter((item) => item.discoverable && !discovered.has(item.id) && !sceneEvidenceRaw.some((sceneItem) => sceneItem.id === item.id))
        .slice(0, 1)
    ];
  }, [allCaseEvidence, discovered, selectedScene]);
  const discoveredEvidence = useMemo(
    () => deductionCase?.evidence.filter((item) => discovered.has(item.id)) || [],
    [deductionCase?.evidence, discovered]
  );
  const playerTheoryEvidence = useMemo(() => new Set(theory.evidenceIds), [theory.evidenceIds]);
  const selectedTestimony = useMemo(
    () => activeCase?.testimonies?.find((item) => item.characterId === selectedCharacterId),
    [activeCase?.testimonies, selectedCharacterId]
  );
  const quality = activeCase?.qualityReport;
  const selectedNpcMemories = useMemo(
    () => (world?.memories || []).filter((memory) => memory.npcId === selectedCharacterId),
    [world?.memories, selectedCharacterId]
  );
  const { evidenceImpacts, judgementGaps } = useInvestigationView({ deductionCase, discoveredEvidence, session });
  const questionedCharacterIds = useMemo(
    () => new Set(session?.interrogationLog.map((entry) => entry.characterId) || []),
    [session?.interrogationLog]
  );
  const contradictedCharacterIds = useMemo(
    () => new Set(session?.interrogationLog.filter((entry) => entry.challenge?.hit).map((entry) => entry.characterId) || []),
    [session?.interrogationLog]
  );
  const selectedNpcContradictionHit = hasContradictionHit(session, selectedCharacterId);
  const investigationStages: InvestigationStage[] = useMemo(() => {
    const interrogationCount = session?.interrogationLog.length || 0;
    const accepted = Boolean(session?.judgement?.accepted);
    const wrongSubmitted = Boolean(session?.judgement && !accepted);
    const completeMap = {
      observe: progress.observedCrimeWindow,
      search: progress.discoveredEvidence && discoveredEvidence.length > 0,
      question: interrogationCount > 0,
      challenge: progress.challengedTestimony,
      organize: discoveredEvidence.length >= 3 || wrongSubmitted || accepted,
      submit: Boolean(session?.judgement),
      reveal: Boolean(revealText)
    };
    const defs = [
      { id: "observe", label: "Observe scene", detail: "Review the crime window and event log." },
      { id: "search", label: "Search evidence", detail: "Click locations or evidence markers." },
      { id: "question", label: "Question witness", detail: "Choose an NPC and ask a focused question." },
      { id: "challenge", label: "Challenge contradiction", detail: "Use discovered evidence to test testimony." },
      { id: "organize", label: "Organize theory", detail: "Pick the key evidence chain." },
      { id: "submit", label: "Submit conclusion", detail: "Name the culprit, motive, and method." },
      { id: "reveal", label: "Review solution", detail: "Inspect the final plot nodes and answer." }
    ];
    const firstPending = defs.find((item) => !completeMap[item.id as keyof typeof completeMap])?.id;
    return defs.map((item) => ({
      ...item,
      complete: completeMap[item.id as keyof typeof completeMap],
      current: item.id === firstPending || (!firstPending && item.id === "reveal")
    }));
  }, [discoveredEvidence.length, progress, revealText, session?.interrogationLog.length, session?.judgement]);
  const visibleEvents = useMemo(() => snapshot?.visibleEvents || events.slice(-30).reverse(), [events, snapshot?.visibleEvents]);
  const selectedEvent = useMemo(() => events.find((event) => event.id === highlightedEventId), [events, highlightedEventId]);
  const selectedEvidence = useMemo(
    () => deductionCase?.evidence.find((item) => item.id === selectedEvidenceId),
    [deductionCase?.evidence, selectedEvidenceId]
  );
  const evidenceTitleById = useMemo(
    () => new Map((deductionCase?.evidence || []).map((item) => [item.id, item.title])),
    [deductionCase?.evidence]
  );
  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const characterById = useMemo(
    () => new Map((deductionCase?.characters || []).map((character) => [character.id, character])),
    [deductionCase?.characters]
  );
  const hoveredLocationInfo = useMemo(() => {
    const locationId = hoveredLocationId || selectedSceneId;
    const tile = snapshot?.tiles.find((item) => item.locationId === locationId);
    if (!locationId || !tile) return null;
    const recent = visibleEvents.find((event) => event.locationId === locationId);
    return {
      locationId,
      name: tile.locationName || locationId,
      terrain: tile.terrain,
      searchable: Boolean(tile.searchable),
      discovered: tile.discoveredEvidenceCount || 0,
      total: tile.evidenceCount || 0,
      recentEvent: recent ? `${recent.time} ${recent.publicSummary}` : undefined
    };
  }, [hoveredLocationId, selectedSceneId, snapshot?.tiles, visibleEvents]);
  const selectedAgent = useMemo(
    () => town.townRuntime?.agentStates.find((agent) => agent.npcId === selectedCharacterId) || null,
    [selectedCharacterId, town.townRuntime?.agentStates]
  );
  const graphExplanation: GraphNodeExplanation | null = useMemo(() => {
    if (!selectedGraphNode || !deductionCase) return null;
    const node = selectedGraphNode;
    const discoveredTitles = node.evidenceIds.filter((id) => discovered.has(id)).map((id) => evidenceTitleById.get(id) || id);
    const hiddenCount = node.evidenceIds.filter((id) => !discovered.has(id)).length;
    const sourceEvents = node.eventIds.map((id) => eventById.get(id)).filter((event): event is WorldEvent => Boolean(event));
    const names = node.characterIds.map((id) => characterById.get(id)?.name || id);
    const source = sourceEvents.length
      ? `Source events: ${sourceEvents.map((event) => `${event.time} ${event.publicSummary}`).join(" / ")}`
      : "Source: current case structure and local rule validation.";
    if (hiddenCount > 0 && node.type !== "conclusion") {
      return {
        node,
        title: "Undiscovered deduction node",
        status: "LOCKED / strict no-spoiler",
        body: "This node requires the player to find the matching evidence first. The system will not reveal evidence titles, meanings, or final conclusions early.",
        source,
        references: discoveredTitles,
        spoilerSafe: false
      };
    }
    const typeLabel: Record<string, string> = {
      evidence: "Evidence established",
      event: "World event source",
      testimony: "Testimony contradiction",
      elimination: "Suspect excluded",
      conclusion: "Unique conclusion"
    };
    return {
      node,
      title: node.label,
      status: typeLabel[node.type] || node.type,
      body: node.detail || "This node is supported by discovered evidence and local rule chains.",
      source,
      references: [...discoveredTitles, ...names].slice(0, 6),
      spoilerSafe: true
    };
  }, [characterById, deductionCase, discovered, eventById, evidenceTitleById, selectedGraphNode]);
  const suspectExplanations = useMemo(() => {
    const result = new Map<string, SuspectExplanation>();
    for (const row of suspectBoard) {
      const visibleEvidence = row.exclusionEvidenceIds.filter((id) => discovered.has(id)).map((id) => evidenceTitleById.get(id) || id);
      const lockedEvidenceCount = row.exclusionEvidenceIds.filter((id) => !discovered.has(id)).length;
      const sourceEventLabels = row.sourceEventIds
        .map((id) => eventById.get(id))
        .filter((event): event is WorldEvent => Boolean(event))
        .filter((event) => row.exclusionEvidenceIds.some((evidenceId) => discovered.has(evidenceId)) || session?.judgement?.accepted)
        .map((event) => `${event.time} ${event.publicSummary}`);
      const solved = Boolean(session?.judgement?.accepted);
      const isCulprit = row.status === "culprit";
      const statusLabel = isCulprit ? (solved ? "Final culprit" : "Hidden until solved") : row.status === "red_herring" ? "Strong red herring" : "Excluded candidate";
      const exclusionStatus = isCulprit
        ? (solved ? "Motive, means, opportunity, and key evidence chain remain intact." : "Requires the full evidence chain. The true culprit stays hidden until the case is solved.")
        : visibleEvidence.length
          ? `Excluded by ${visibleEvidence.join(", ")}.`
          : "Still needs exclusion evidence; hidden evidence titles are not leaked.";
      result.set(row.characterId, {
        characterId: row.characterId,
        name: row.name,
        role: row.role,
        statusLabel,
        motive: row.motive,
        means: row.means,
        opportunity: row.opportunity,
        surfaceSuspicion: row.surfaceSuspicion,
        exclusionStatus,
        visibleEvidenceTitles: visibleEvidence,
        lockedEvidenceCount: isCulprit ? 0 : lockedEvidenceCount,
        sourceEventLabels
      });
    }
    return result;
  }, [discovered, eventById, evidenceTitleById, session?.judgement?.accepted, suspectBoard]);
  const gapCards: GapCard[] = useMemo(() => {
    const mapTarget = (label: string): GapCard["target"] => {
      if (/culprit|suspect/i.test(label)) return "suspects";
      if (/motive/i.test(label)) return "motive";
      if (/method|means|opportunity/i.test(label)) return "method";
      if (/evidence/i.test(label)) return "evidence";
      if (/exclude/i.test(label)) return "exclusion";
      return "logic";
    };
    const proofCards = session?.judgement?.proofCoverage?.gaps.map((gap) => ({
      id: `proof-gap:${gap.obligationId}`,
      label: `${gap.kind}: ${gap.label}`,
      detail: gap.detail,
      target: gap.target === "suspects" ? "suspects" : gap.target
    } satisfies GapCard)) || [];
    if (proofCards.length) return proofCards;
    return judgementGaps.map((label) => {
      const target = mapTarget(label);
      const detail: Record<GapCard["target"], string> = {
        suspects: "Review the suspect matrix and confirm who still has motive, means, and opportunity.",
        motive: "Return to the theory form and add a motive supported by discovered evidence.",
        method: "Return to the theory form and describe the tool, action, and disguise.",
        evidence: "Review discovered evidence and pick the key clues that form a chain.",
        exclusion: "Check the Suspect Board and confirm excluded suspects have exclusion evidence.",
        logic: "Open the deduction graph and close the gap from evidence to conclusion."
      };
      return { id: `gap:${label}`, label, detail: detail[target], target };
    });
  }, [judgementGaps, session?.judgement?.proofCoverage?.gaps]);
  const nextStepAdvice = useMemo(() => {
    if (!session?.judgement || session.judgement.accepted) return "";
    if (discoveredEvidence.length > 0 && !progress.challengedTestimony) {
      return `First present "${discoveredEvidence[0].title}" to a relevant NPC and check whether testimony conflicts.`;
    }
    if (discoveredEvidence.length > 0) {
      return `Choose from the ${discoveredEvidence.length} discovered clues and connect motive, method, and opportunity.`;
    }
    return selectedScene ? `Keep searching ${selectedScene.name} and build the first evidence chain.` : "Click a searchable map location and find the first clue.";
  }, [discoveredEvidence, progress.challengedTestimony, selectedScene, session?.judgement]);
  const solutionChain = useMemo(() => {
    if (!session?.judgement?.accepted || !deductionCase) return [];
    const selectedTitles = theory.evidenceIds.filter((id) => discovered.has(id)).map((id) => evidenceTitleById.get(id) || id);
    const eliminatedCount = suspectBoard.filter((row) => row.status !== "culprit").length;
    return [
      selectedTitles.length ? `Player submitted ${selectedTitles.length} discovered clues: ${selectedTitles.slice(0, 4).join(", ")}${selectedTitles.length > 4 ? " etc." : ""}.` : "The submitted evidence chain passed local rule validation.",
      "The evidence supports motive, method, opportunity, or a testimony contradiction and forms a reviewable reasoning chain.",
      `Suspect Board excludes ${eliminatedCount} non-culprit candidates through discovered or validated exclusion chains.`,
      "Only the remaining candidate with intact motive, means, opportunity, and no counter-evidence appears in the final conclusion node."
    ];
  }, [deductionCase, discovered, evidenceTitleById, session?.judgement?.accepted, suspectBoard, theory.evidenceIds]);
  const inspectorSummary = useMemo(() => {
    if (inspectorTab === "events") {
      return selectedEvent
        ? { title: `${selectedEvent.time} / ${selectedEvent.locationId}`, detail: selectedEvent.publicSummary, tone: "event" }
        : { title: "Event log", detail: "Select an event to highlight map location and time.", tone: "event" };
    }
    if (inspectorTab === "investigation") {
      if (selectedEvidence) return { title: `Evidence: ${selectedEvidence.title}`, detail: "Review use hints and present it to NPCs when needed.", tone: "evidence" };
      if (selectedCharacter) return { title: `NPC: ${selectedCharacter.name}`, detail: selectedCharacter.role, tone: "person" };
      return { title: `Location: ${selectedScene?.name || "None selected"}`, detail: "Search locations, question NPCs, and submit theory.", tone: "investigation" };
    }
    if (inspectorTab === "logic") return { title: "Case logic", detail: "Deduction graph, causal chain, and answer review unlock after correct reasoning.", tone: "logic" };
    if (inspectorTab === "agent") return { title: "Persistent Agent Town", detail: selectedAgent ? `${selectedAgent.currentGoal} / ${selectedAgent.locationId}` : "Inspect NPC goals, action scores, and case candidates.", tone: "logic" };
    if (inspectorTab === "people") return { title: "Suspect matrix", detail: "Review motive, means, opportunity, and exclusion evidence.", tone: "people" };
    return { title: "Developer API", detail: "Inspect Agent API, worldId, caseId, and sessionId.", tone: "developer" };
  }, [inspectorTab, selectedAgent, selectedCharacter, selectedEvent, selectedEvidence, selectedScene?.name]);

  return {
    deductionCase, scenes, characters, discovered, selectedScene, selectedCharacter, sceneEvidence, discoveredEvidence,
    playerTheoryEvidence, selectedTestimony, quality, selectedNpcMemories, evidenceImpacts, judgementGaps,
    questionedCharacterIds, contradictedCharacterIds, selectedNpcContradictionHit, investigationStages, visibleEvents,
    selectedEvidence,
    selectedAgent, hoveredLocationInfo, graphExplanation, suspectExplanations, gapCards, nextStepAdvice, solutionChain,
    inspectorSummary
  };
}
