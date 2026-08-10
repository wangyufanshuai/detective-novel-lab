"use client";

import type { DeductionCase, PlayerSession } from "@/lib/engine";
import type { SelectionHighlight } from "@/app/hooks/useGuidedOnboarding";
import type { useCampaignComprehensionStudy } from "@/app/hooks/useCampaignComprehensionStudy";
import type { useInvestigationController } from "@/app/controllers/useInvestigationController";
import type { useReplayController } from "@/app/controllers/useReplayController";
import {
  countManualTheoryFields,
  unresolvedManualTheoryFields,
  type GuidedStepJournalEntry,
  type ManualTheoryFieldKind
} from "@/app/campaign/replay-practice-model";
import type { ManualEvidenceDrillSummary } from "@/app/campaign/investigation-workspace-model";

type AppendJournal = (entry: Omit<GuidedStepJournalEntry, "id">) => void;

export function useManualReplayDrillActions(input: {
  investigation: ReturnType<typeof useInvestigationController>;
  replay: ReturnType<typeof useReplayController>;
  campaignStudy: Pick<ReturnType<typeof useCampaignComprehensionStudy>, "recordExplicitFallback">;
  manualEvidenceDrill: ManualEvidenceDrillSummary | null;
  scenes: DeductionCase["scenes"];
  highlightSelection: (highlight: SelectionHighlight) => void;
  appendJournal: AppendJournal;
}) {
  const { theory, setTheory, setSelectedEvidenceId, setSelectedSceneId, setInspectorTab, setStatus, pushToast, session } = input.investigation;
  const { replayGoalAttempt, setReplayGoalAttempt, setGuidedManualLastResult } = input.replay;

  function toggleManualEvidenceDrillEvidence(evidenceId: string) {
    const currentIds = theory.evidenceIds;
    const nextIds = currentIds.includes(evidenceId)
      ? currentIds.filter((id) => id !== evidenceId)
      : Array.from(new Set([...currentIds, evidenceId]));
    const drillCandidates = input.manualEvidenceDrill?.candidates || [];
    const candidateIds = drillCandidates.map((item) => item.evidenceId);
    const manualPickCount = nextIds.filter((id) => candidateIds.includes(id)).length;
    const targetCount = input.manualEvidenceDrill?.routeEvidenceTargetCount || Math.max(1, candidateIds.length);
    const remainingProofSlots = Math.max(0, targetCount - manualPickCount);
    const readyForSubmit = remainingProofSlots === 0;
    setTheory((current) => ({ ...current, evidenceIds: nextIds }));
    setReplayGoalAttempt((current) => current ? { ...current, manualEvidencePickCount: manualPickCount, lastResult: readyForSubmit ? "manual evidence ready" : "manual evidence selected" } : current);
    setSelectedEvidenceId(evidenceId);
    const scene = input.scenes.find((item) => item.evidenceIds.includes(evidenceId));
    if (scene) setSelectedSceneId(scene.id);
    input.highlightSelection({ evidenceId, locationId: scene?.id });
    setInspectorTab("investigation");
    input.appendJournal({
      journalKey: "manual-evidence-drill",
      step: "select-evidence",
      label: "Manual evidence drill",
      status: readyForSubmit ? "done" : "info",
      result: `${manualPickCount}/${targetCount} manually selected.`,
      progressDelta: `${remainingProofSlots} proof slot(s) remain before submit.`,
      nextAction: readyForSubmit ? "Run Next Guided Step to submit the replay attempt." : "Use Add to Theory on discovered proof clues before submit."
    });
    pushToast({ tone: readyForSubmit ? "success" : "info", title: readyForSubmit ? "Manual evidence ready" : "Manual evidence updated", detail: `${manualPickCount}/${targetCount} route proof clue(s) selected without certified fallback.` });
    setStatus(readyForSubmit ? "Manual Evidence Drill has enough selected proof clues for replay submit." : "Manual Evidence Drill updated the session-local theory evidence chain.");
  }

  function updateManualTheoryDrillField(field: ManualTheoryFieldKind, value: string) {
    const nextTheory = { ...theory, [field]: value };
    const manualFieldCount = countManualTheoryFields(nextTheory);
    const remainingFieldCount = Math.max(0, 3 - manualFieldCount);
    setTheory(nextTheory);
    setReplayGoalAttempt((current) => current ? { ...current, manualTheoryFieldCount: manualFieldCount, blockedTheoryGapCount: 0, theoryFallbackApproved: false, lastResult: remainingFieldCount ? "manual theory updated" : "manual theory ready" } : current);
    input.appendJournal({
      journalKey: "manual-theory-drill",
      step: "submit",
      label: "Manual theory drill",
      status: manualFieldCount === 3 ? "done" : "info",
      result: `${manualFieldCount}/3 theory field(s) completed manually.`,
      progressDelta: `${remainingFieldCount} theory field(s) remain before manual submit.`,
      nextAction: remainingFieldCount ? "Complete the remaining theory fields or explicitly approve certified fallback." : "Run Next Guided Step to submit the manual theory."
    });
    setGuidedManualLastResult(remainingFieldCount ? "manual theory updated" : "manual theory ready");
    setStatus(remainingFieldCount ? "Manual Theory Drill updated without exposing the entered text." : "Manual Theory Drill is ready for player-authored submit.");
  }

  function approveManualTheoryFallback() {
    const unresolvedFields = unresolvedManualTheoryFields(session?.judgement);
    const remainingFieldCount = Math.max(0, 3 - countManualTheoryFields(theory));
    const approvedFieldCount = unresolvedFields.size || remainingFieldCount;
    if (!replayGoalAttempt?.active || approvedFieldCount === 0) return;
    setReplayGoalAttempt((current) => current ? { ...current, theoryFallbackApproved: true, lastResult: "certified theory fallback approved" } : current);
    input.appendJournal({
      journalKey: "manual-theory-drill",
      step: "submit",
      label: "Manual theory drill",
      status: "info",
      result: `Explicit fallback approved for ${approvedFieldCount} unresolved theory field(s).`,
      progressDelta: "No certified value was copied into a visible input.",
      nextAction: "Run Next Guided Step to submit with explicit field-level fallback."
    });
    setGuidedManualLastResult("explicit theory fallback approved");
    setStatus("Explicit fallback is armed for unresolved theory fields only.");
    input.campaignStudy.recordExplicitFallback();
  }

  return { toggleManualEvidenceDrillEvidence, updateManualTheoryDrillField, approveManualTheoryFallback };
}

export type ManualReplayDrillActions = ReturnType<typeof useManualReplayDrillActions>;
