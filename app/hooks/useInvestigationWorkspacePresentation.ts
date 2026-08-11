"use client";

import { useMemo } from "react";
import { hasContradictionHit, useInvestigationView } from "@/app/hooks/useInvestigationActions";
import type { useInvestigationController } from "@/app/controllers/useInvestigationController";
import type { useTownRuntimeController } from "@/app/controllers/useTownRuntimeController";
import type { GapCard, GraphNodeExplanation, InvestigationStage, SuspectExplanation } from "@/app/components/DetectiveTownUI";
import { useAppLocale } from "@/app/localization/locale-context";
import type { WorldEvent } from "@/lib/engine";

type InvestigationWorkspacePresentationInput = {
  investigation: ReturnType<typeof useInvestigationController>;
  town: ReturnType<typeof useTownRuntimeController>;
};

/** Request-free presentation derivations shared by the map, Inspector, and certified workspace. */
export function useInvestigationWorkspacePresentation({ investigation, town }: InvestigationWorkspacePresentationInput) {
  const { locale, number, t, text } = useAppLocale();
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
      { id: "observe", label: t("stage.observe.label"), detail: t("stage.observe.detail") },
      { id: "search", label: t("stage.search.label"), detail: t("stage.search.detail") },
      { id: "question", label: t("stage.question.label"), detail: t("stage.question.detail") },
      { id: "challenge", label: t("stage.challenge.label"), detail: t("stage.challenge.detail") },
      { id: "organize", label: t("stage.organize.label"), detail: t("stage.organize.detail") },
      { id: "submit", label: t("stage.submit.label"), detail: t("stage.submit.detail") },
      { id: "reveal", label: t("stage.reveal.label"), detail: t("stage.reveal.detail") }
    ];
    const firstPending = defs.find((item) => !completeMap[item.id as keyof typeof completeMap])?.id;
    return defs.map((item) => ({
      ...item,
      complete: completeMap[item.id as keyof typeof completeMap],
      current: item.id === firstPending || (!firstPending && item.id === "reveal")
    }));
  }, [discoveredEvidence.length, locale, progress, revealText, session?.interrogationLog.length, session?.judgement, t]);
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
      name: tile.locationName || t("map.publicLocation"),
      terrain: tile.terrain,
      searchable: Boolean(tile.searchable),
      discovered: tile.discoveredEvidenceCount || 0,
      total: tile.evidenceCount || 0,
      recentEvent: recent ? `${recent.time} ${recent.publicSummary}` : undefined
    };
  }, [hoveredLocationId, locale, selectedSceneId, snapshot?.tiles, t, visibleEvents]);
  const selectedAgent = useMemo(
    () => town.townRuntime?.agentStates.find((agent) => agent.npcId === selectedCharacterId) || null,
    [selectedCharacterId, town.townRuntime?.agentStates]
  );
  const graphExplanation: GraphNodeExplanation | null = useMemo(() => {
    if (!selectedGraphNode || !deductionCase) return null;
    const node = selectedGraphNode;
    const discoveredTitles = node.evidenceIds.filter((id) => discovered.has(id)).map((id) => text(evidenceTitleById.get(id) || t("logic.discoveredClue")));
    const hiddenCount = node.evidenceIds.filter((id) => !discovered.has(id)).length;
    const sourceEvents = node.eventIds.map((id) => eventById.get(id)).filter((event): event is WorldEvent => Boolean(event));
    const names = node.characterIds.map((id) => text(characterById.get(id)?.name || t("logic.publicActor")));
    const source = sourceEvents.length
      ? t("logic.sourceEvents", { events: sourceEvents.map((event) => `${event.time} ${text(event.publicSummary)}`).join(" / ") })
      : t("logic.sourceFallback");
    if (hiddenCount > 0 && node.type !== "conclusion") {
      return {
        node,
        title: t("logic.lockedTitle"),
        status: t("logic.lockedStatus"),
        body: t("logic.lockedBody"),
        source,
        references: discoveredTitles,
        spoilerSafe: false
      };
    }
    const typeLabel: Record<string, string> = {
      evidence: t("logic.type.evidence"),
      event: t("logic.type.event"),
      testimony: t("logic.type.testimony"),
      elimination: t("logic.type.elimination"),
      conclusion: t("logic.type.conclusion")
    };
    return {
      node,
      title: node.label,
      status: typeLabel[node.type] || node.type,
      body: node.detail ? text(node.detail) : t("logic.supportedBody"),
      source,
      references: [...discoveredTitles, ...names].slice(0, 6),
      spoilerSafe: true
    };
  }, [characterById, deductionCase, discovered, eventById, evidenceTitleById, locale, selectedGraphNode, t, text]);
  const suspectExplanations = useMemo(() => {
    const result = new Map<string, SuspectExplanation>();
    for (const row of suspectBoard) {
      const visibleEvidence = row.exclusionEvidenceIds.filter((id) => discovered.has(id)).map((id) => text(evidenceTitleById.get(id) || t("logic.discoveredClue")));
      const lockedEvidenceCount = row.exclusionEvidenceIds.filter((id) => !discovered.has(id)).length;
      const sourceEventLabels = row.sourceEventIds
        .map((id) => eventById.get(id))
        .filter((event): event is WorldEvent => Boolean(event))
        .filter((event) => row.exclusionEvidenceIds.some((evidenceId) => discovered.has(evidenceId)) || session?.judgement?.accepted)
        .map((event) => `${event.time} ${event.publicSummary}`);
      const solved = Boolean(session?.judgement?.accepted);
      const isCulprit = row.status === "culprit";
      const statusLabel = isCulprit ? (solved ? t("suspect.final") : t("suspect.hidden")) : row.status === "red_herring" ? t("suspect.redHerring") : t("suspect.excluded");
      const exclusionStatus = isCulprit
        ? (solved ? t("suspect.intact") : t("suspect.requiresFull"))
        : visibleEvidence.length
          ? t("suspect.excludedBy", { evidence: visibleEvidence.join(", ") })
          : t("suspect.needsExclusion");
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
  }, [discovered, eventById, evidenceTitleById, locale, session?.judgement?.accepted, suspectBoard, t, text]);
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
        suspects: t("gap.suspects"),
        motive: t("gap.motive"),
        method: t("gap.method"),
        evidence: t("gap.evidence"),
        exclusion: t("gap.exclusion"),
        logic: t("gap.logic")
      };
      return { id: `gap:${label}`, label, detail: detail[target], target };
    });
  }, [judgementGaps, locale, session?.judgement?.proofCoverage?.gaps, t]);
  const nextStepAdvice = useMemo(() => {
    if (!session?.judgement || session.judgement.accepted) return "";
    if (discoveredEvidence.length > 0 && !progress.challengedTestimony) {
      return t("advice.challenge", { evidence: text(discoveredEvidence[0].title) });
    }
    if (discoveredEvidence.length > 0) {
      return t("advice.connect", { count: number(discoveredEvidence.length) });
    }
    return selectedScene ? t("advice.search", { location: text(selectedScene.name) }) : t("advice.firstClue");
  }, [discoveredEvidence, locale, number, progress.challengedTestimony, selectedScene, session?.judgement, t, text]);
  const solutionChain = useMemo(() => {
    if (!session?.judgement?.accepted || !deductionCase) return [];
    const selectedTitles = theory.evidenceIds.filter((id) => discovered.has(id)).map((id) => text(evidenceTitleById.get(id) || t("logic.discoveredClue")));
    const eliminatedCount = suspectBoard.filter((row) => row.status !== "culprit").length;
    return [
      selectedTitles.length ? t("solution.selected", { count: number(selectedTitles.length), clues: selectedTitles.slice(0, 4).join(", "), suffix: selectedTitles.length > 4 ? t("solution.more") : "" }) : t("solution.validated"),
      t("solution.reasoning"),
      t("solution.exclusions", { count: number(eliminatedCount) }),
      t("solution.remaining")
    ];
  }, [deductionCase, discovered, evidenceTitleById, locale, number, session?.judgement?.accepted, suspectBoard, t, text, theory.evidenceIds]);
  const inspectorSummary = useMemo(() => {
    if (inspectorTab === "events") {
      const publicLocation = selectedEvent ? world?.locations.find((location) => location.id === selectedEvent.locationId)?.name : undefined;
      return selectedEvent
        ? { title: `${selectedEvent.time} / ${text(publicLocation || t("map.publicLocation"))}`, detail: text(selectedEvent.publicSummary), tone: "event" }
        : { title: t("inspector.eventLog"), detail: t("inspector.eventDetail"), tone: "event" };
    }
    if (inspectorTab === "investigation") {
      if (selectedEvidence) return { title: t("inspector.evidence", { title: text(selectedEvidence.title) }), detail: t("inspector.evidenceDetail"), tone: "evidence" };
      if (selectedCharacter) return { title: t("inspector.npc", { name: text(selectedCharacter.name) }), detail: text(selectedCharacter.role), tone: "person" };
      return { title: t("inspector.location", { name: selectedScene ? text(selectedScene.name) : t("inspector.none") }), detail: t("inspector.investigationDetail"), tone: "investigation" };
    }
    if (inspectorTab === "logic") return { title: t("inspector.caseLogic"), detail: t("inspector.logicDetail"), tone: "logic" };
    if (inspectorTab === "agent") {
      const publicLocation = selectedAgent ? world?.locations.find((location) => location.id === selectedAgent.locationId)?.name : undefined;
      return { title: t("inspector.persistentTown"), detail: selectedAgent ? `${text(selectedAgent.currentGoal)} / ${text(publicLocation || t("map.publicLocation"))}` : t("inspector.agentDetail"), tone: "logic" };
    }
    if (inspectorTab === "people") return { title: t("inspector.people"), detail: t("inspector.peopleDetail"), tone: "people" };
    return { title: t("inspector.developer"), detail: t("inspector.developerDetail"), tone: "developer" };
  }, [inspectorTab, locale, selectedAgent, selectedCharacter, selectedEvent, selectedEvidence, selectedScene, t, text, world?.locations]);

  return {
    deductionCase, scenes, characters, discovered, selectedScene, selectedCharacter, sceneEvidence, discoveredEvidence,
    playerTheoryEvidence, selectedTestimony, quality, selectedNpcMemories, evidenceImpacts, judgementGaps,
    questionedCharacterIds, contradictedCharacterIds, selectedNpcContradictionHit, investigationStages, visibleEvents,
    selectedEvidence,
    selectedAgent, hoveredLocationInfo, graphExplanation, suspectExplanations, gapCards, nextStepAdvice, solutionChain,
    inspectorSummary
  };
}
