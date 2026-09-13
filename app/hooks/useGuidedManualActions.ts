"use client";

import type { useInvestigationController } from "@/app/controllers/useInvestigationController";
import type { useReplayController } from "@/app/controllers/useReplayController";
import {
  countManualTheoryFields,
  unresolvedManualTheoryFields,
  type GuidedManualStepKind,
  type GuidedManualStepTarget,
  type GuidedStepJournalEntry,
  type ManualTheoryFieldKind
} from "@/app/campaign/replay-practice-model";
import type { SelectionHighlight } from "@/app/hooks/useGuidedOnboarding";
import type { CertifiedInvestigationActionAdapter } from "@/app/hooks/useCertifiedInvestigationActions";
import type { InvestigationActionResult } from "@/app/campaign/investigation-action-result";
import type { CaseRouteCertificate, DeductionCase, PlayableCaseIntake, PlayerSession, PlayerTheory } from "@/lib/engine";

type GuidedManualActionsInput = {
  investigation: ReturnType<typeof useInvestigationController>;
  replay: ReturnType<typeof useReplayController>;
  target: GuidedManualStepTarget;
  scenes: DeductionCase["scenes"];
  caseRouteCertificate?: CaseRouteCertificate | null;
  playableIntake?: PlayableCaseIntake | null;
  appendJournal: (entry: Omit<GuidedStepJournalEntry, "id">) => void;
  highlightSelection: (next: SelectionHighlight) => void;
  actionAdapter: CertifiedInvestigationActionAdapter;
  resolveWorldLeadAfterStep: (kind: GuidedManualStepKind) => Promise<unknown>;
  submitCurrentTheory: (theory?: PlayerTheory, options?: { syncVisibleTheory?: boolean }) => Promise<PlayerSession["judgement"] | null>;
  recordGuidedStep: () => void;
};

/** Executes one derived guided step while delegating every authoritative action to its existing handler. */
export function useGuidedManualActions({
  investigation,
  replay,
  target,
  scenes,
  caseRouteCertificate,
  playableIntake,
  appendJournal,
  highlightSelection,
  actionAdapter,
  resolveWorldLeadAfterStep,
  submitCurrentTheory,
  recordGuidedStep
}: GuidedManualActionsInput) {
  const {
    session, theory, activeCase, setSelectedSceneId, setSelectedCharacterId, setSelectedSuspectId,
    setSelectedEvidenceId, setQuestion, setTheory, setInspectorTab, pushToast, setStatus
  } = investigation;
  const {
    guidedManualRunning, setGuidedManualRunning, setGuidedManualLastResult,
    replayGoalAttempt, setReplayGoalAttempt
  } = replay;

  function actionSucceeded(result: InvestigationActionResult) {
    if (result.status === "succeeded") return true;
    // The owning case may already have changed; do not append an old action to it.
    if (result.status === "cancelled") return false;
    setGuidedManualLastResult(`${target.kind} ${result.status}`);
    setStatus(result.detail);
    appendJournal({
      step: target.kind, label: target.label, status: "blocked", result: result.detail,
      progressDelta: "0 steps advanced.", nextAction: "Review the action result before continuing."
    });
    return false;
  }

  async function runGuidedManualStep() {
    if (guidedManualRunning) return;
    setGuidedManualRunning(true);
    recordGuidedStep();
    try {
      if (target.kind === "join") {
        if (!actionSucceeded(await actionAdapter.joinCase())) return;
        setGuidedManualLastResult("joined");
        appendJournal({
          step: "join", label: "Join investigation", status: "done", result: "Investigation session opened.",
          progressDelta: "Player can now search scenes and question witnesses.", nextAction: "Search the first certified route clue."
        });
        return;
      }
      if (!session) {
        setGuidedManualLastResult("join required");
        setStatus("Join the investigation before running guided steps.");
        appendJournal({
          step: target.kind, label: target.label, status: "blocked", result: "No active investigation session.",
          progressDelta: "0 steps advanced.", nextAction: "Join the investigation first."
        });
        return;
      }
      if (target.kind === "search") {
        if (!target.evidenceId) {
          setGuidedManualLastResult("search blocked");
          setStatus("Guided search is blocked because the route has no discoverable clue.");
          appendJournal({
            step: "search", label: "Search certified clue", status: "blocked", result: "No discoverable route clue is available.",
            progressDelta: "Clue discovered count unchanged.", nextAction: "Review the Route Certificate blockers."
          });
          return;
        }
        if (target.locationId) setSelectedSceneId(target.locationId);
        if (!actionSucceeded(await actionAdapter.discoverEvidence(target.evidenceId))) return;
        setGuidedManualLastResult("search complete");
        appendJournal({
          step: "search", label: "Search certified clue", status: "done", result: "One route clue was discovered.",
          progressDelta: `${Math.min((session.discoveredEvidenceIds.length || 0) + 1, caseRouteCertificate?.theoryEvidenceIds.length || playableIntake?.routeCertificate?.theoryEvidenceIds.length || (session.discoveredEvidenceIds.length || 0) + 1)} clue(s) now count toward the certified route.`,
          nextAction: "Continue search until the route asks for witness questioning."
        });
        await resolveWorldLeadAfterStep("search");
        return;
      }
      if (target.kind === "question") {
        if (!target.characterId) {
          setGuidedManualLastResult("question blocked");
          setStatus("Guided question is blocked because the route has no witness.");
          appendJournal({
            step: "question", label: "Question certified witness", status: "blocked", result: "No certified witness is available.",
            progressDelta: "Witness question count unchanged.", nextAction: "Review route witness blockers."
          });
          return;
        }
        const questionText = "Where were you during the incident window, and what did you observe?";
        setSelectedCharacterId(target.characterId);
        setSelectedSuspectId(target.characterId);
        setQuestion(questionText);
        highlightSelection({ characterId: target.characterId });
        if (!actionSucceeded(await actionAdapter.runInterrogationTarget(target.characterId, undefined, questionText))) return;
        setGuidedManualLastResult("question complete");
        appendJournal({
          step: "question", label: "Question certified witness", status: "done", result: "A route witness was questioned.",
          progressDelta: `${new Set([...session.interrogationLog.map((entry) => entry.characterId), target.characterId]).size} witness question(s) now support the route.`,
          nextAction: "Present a discovered clue for a testimony challenge."
        });
        await resolveWorldLeadAfterStep("question");
        return;
      }
      if (target.kind === "challenge") {
        if (!target.characterId || !target.evidenceId) {
          setGuidedManualLastResult("challenge blocked");
          setStatus("Guided challenge is blocked because the certified route is missing a witness or clue.");
          appendJournal({
            step: "challenge", label: "Challenge certified testimony", status: "blocked",
            result: "Challenge needs both a witness and a discovered route clue.", progressDelta: "Contradiction hit count unchanged.",
            nextAction: "Search the missing route clue or review witness blockers."
          });
          return;
        }
        const questionText = "Please explain this evidence and whether it changes your earlier statement.";
        setSelectedCharacterId(target.characterId);
        setSelectedSuspectId(target.characterId);
        setSelectedEvidenceId(target.evidenceId);
        setQuestion(questionText);
        const scene = scenes.find((item) => item.evidenceIds.includes(target.evidenceId as string));
        if (scene) setSelectedSceneId(scene.id);
        highlightSelection({ characterId: target.characterId, evidenceId: target.evidenceId, locationId: scene?.id });
        if (!actionSucceeded(await actionAdapter.runInterrogationTarget(target.characterId, target.evidenceId, questionText))) return;
        setGuidedManualLastResult("challenge complete");
        appendJournal({
          step: "challenge", label: "Challenge certified testimony", status: "done",
          result: "A testimony contradiction was tested with a discovered clue.",
          progressDelta: `${session.interrogationLog.filter((entry) => entry.challenge?.hit).length + 1} challenge hit(s) now support the route.`,
          nextAction: "Select the discovered proof clues for the theory chain."
        });
        await resolveWorldLeadAfterStep("challenge");
        return;
      }
      if (target.kind === "select-evidence") {
        const certifiedEvidenceIds = caseRouteCertificate?.theoryEvidenceIds || playableIntake?.routeCertificate?.theoryEvidenceIds || [];
        const discoveredSet = new Set(session.discoveredEvidenceIds);
        const selectableIds = certifiedEvidenceIds.filter((id) => discoveredSet.has(id));
        if (!selectableIds.length && target.evidenceId) selectableIds.push(target.evidenceId);
        const selectedSet = new Set(theory.evidenceIds);
        const manualSelectedCount = selectableIds.filter((id) => selectedSet.has(id)).length;
        if (replayGoalAttempt?.active && selectableIds.length && manualSelectedCount < selectableIds.length) {
          const firstMissingId = selectableIds.find((id) => !selectedSet.has(id)) || selectableIds[0];
          if (firstMissingId) {
            setSelectedEvidenceId(firstMissingId);
            const scene = scenes.find((item) => item.evidenceIds.includes(firstMissingId));
            if (scene) setSelectedSceneId(scene.id);
            highlightSelection({ evidenceId: firstMissingId, locationId: scene?.id });
          }
          const remainingProofSlots = Math.max(0, selectableIds.length - manualSelectedCount);
          setReplayGoalAttempt((current) => current ? { ...current, manualEvidencePickCount: manualSelectedCount, lastResult: "manual evidence drill ready" } : current);
          setInspectorTab("investigation");
          pushToast({ tone: "info", title: "Manual Evidence Drill ready", detail: "Pick discovered proof clues manually before replay submit." });
          setStatus("Guided select-evidence is waiting on Manual Evidence Drill instead of auto-selecting certified evidence.");
          setGuidedManualLastResult("manual evidence drill ready");
          appendJournal({
            journalKey: "manual-evidence-drill", step: "select-evidence", label: "Manual evidence drill", status: "info",
            result: `${manualSelectedCount}/${selectableIds.length} manually selected.`, progressDelta: `${remainingProofSlots} proof slot(s) remain before submit.`,
            nextAction: "Use Add to Theory in Manual Evidence Drill, then run the next guided step."
          });
          return;
        }
        if (replayGoalAttempt?.active && selectableIds.length) {
          setReplayGoalAttempt((current) => current ? { ...current, manualEvidencePickCount: manualSelectedCount, lastResult: "manual evidence selected" } : current);
          setGuidedManualLastResult("manual evidence selected");
          appendJournal({
            step: "select-evidence", label: "Select manual evidence", status: "done",
            result: `${manualSelectedCount} manually selected proof clue(s) are ready.`,
            progressDelta: "Replay attempt will submit without adding certified evidence at this step.", nextAction: "Submit the replay theory for local judgement."
          });
          return;
        }
        setTheory((current) => ({ ...current, evidenceIds: Array.from(new Set([...current.evidenceIds, ...selectableIds])) }));
        const firstEvidenceId = selectableIds[0];
        if (firstEvidenceId) {
          setSelectedEvidenceId(firstEvidenceId);
          const scene = scenes.find((item) => item.evidenceIds.includes(firstEvidenceId));
          if (scene) setSelectedSceneId(scene.id);
          highlightSelection({ evidenceId: firstEvidenceId, locationId: scene?.id });
        }
        setInspectorTab("investigation");
        pushToast({ tone: "success", title: "Certified evidence selected", detail: `${selectableIds.length} discovered proof clue(s) added to the theory chain.` });
        setStatus("Guided manual run selected the certified proof clues.");
        setGuidedManualLastResult("evidence selected");
        appendJournal({
          step: "select-evidence", label: "Select certified evidence", status: "done",
          result: `${selectableIds.length} discovered proof clue(s) were added to the theory chain.`,
          progressDelta: `${new Set([...theory.evidenceIds, ...selectableIds]).size} selected proof clue(s) are ready for submit.`,
          nextAction: "Submit the certified theory for local judgement."
        });
        return;
      }
      if (target.kind === "submit") {
        if (!activeCase) {
          setGuidedManualLastResult("submit blocked");
          setStatus("Guided submit is blocked because no case is active.");
          appendJournal({
            step: "submit", label: "Submit certified theory", status: "blocked", result: "No active case is available for judgement.",
            progressDelta: "Theory judgement not run.", nextAction: "Load or extract a playable case."
          });
          return;
        }
        const manualTheoryFieldCount = countManualTheoryFields(theory);
        const previouslyUnresolvedFields = unresolvedManualTheoryFields(session.judgement);
        const remainingTheoryFieldCount = Math.max(0, 3 - manualTheoryFieldCount);
        if (replayGoalAttempt?.active && (remainingTheoryFieldCount > 0 || previouslyUnresolvedFields.size > 0) && !replayGoalAttempt.theoryFallbackApproved) {
          const blockedGapCount = previouslyUnresolvedFields.size;
          setReplayGoalAttempt((current) => current ? {
            ...current, manualTheoryFieldCount, blockedTheoryGapCount: blockedGapCount,
            lastResult: blockedGapCount ? "manual theory has unresolved gaps" : "manual theory drill ready"
          } : current);
          appendJournal({
            journalKey: "manual-theory-drill", step: "submit", label: "Manual theory drill", status: blockedGapCount ? "blocked" : "info",
            result: `${manualTheoryFieldCount}/3 theory field(s) completed manually.`,
            progressDelta: blockedGapCount ? `${blockedGapCount} theory field gap(s) need revision or explicit fallback.` : `${remainingTheoryFieldCount} theory field(s) remain before submit.`,
            nextAction: blockedGapCount ? "Revise the theory fields or explicitly approve certified fallback for unresolved fields." : "Complete Manual Theory Drill or explicitly approve fallback for remaining fields."
          });
          setInspectorTab("investigation");
          setGuidedManualLastResult(blockedGapCount ? "manual theory blocked" : "manual theory drill ready");
          pushToast({
            tone: blockedGapCount ? "warning" : "info", title: blockedGapCount ? "Manual theory has gaps" : "Manual Theory Drill ready",
            detail: blockedGapCount ? `${blockedGapCount} field-level gap(s) remain; no hidden answer was revealed.` : "Fill suspect, motive, and method before replay submit."
          });
          setStatus("Guided submit is waiting on Manual Theory Drill instead of automatic certified fallback.");
          return;
        }
        const certifiedEvidenceIds = caseRouteCertificate?.theoryEvidenceIds || playableIntake?.routeCertificate?.theoryEvidenceIds || theory.evidenceIds;
        const discoveredSet = new Set(session.discoveredEvidenceIds);
        const discoveredCertifiedEvidenceIds = certifiedEvidenceIds.filter((id) => discoveredSet.has(id));
        const fallbackEvidenceIds = discoveredCertifiedEvidenceIds.filter((id) => !theory.evidenceIds.includes(id));
        const selectedEvidenceIds = Array.from(new Set([...theory.evidenceIds, ...discoveredCertifiedEvidenceIds]));
        const fallbackTheoryFields = new Set<ManualTheoryFieldKind>();
        if (!replayGoalAttempt?.active) {
          if (!theory.culpritId) fallbackTheoryFields.add("culpritId");
          if (!theory.motive.trim()) fallbackTheoryFields.add("motive");
          if (!theory.method.trim()) fallbackTheoryFields.add("method");
        } else if (replayGoalAttempt.theoryFallbackApproved) {
          if (!theory.culpritId || previouslyUnresolvedFields.has("culpritId")) fallbackTheoryFields.add("culpritId");
          if (!theory.motive.trim() || previouslyUnresolvedFields.has("motive")) fallbackTheoryFields.add("motive");
          if (!theory.method.trim() || previouslyUnresolvedFields.has("method")) fallbackTheoryFields.add("method");
        }
        const fallbackUsed = fallbackTheoryFields.size > 0 || fallbackEvidenceIds.length > 0;
        setReplayGoalAttempt((current) => current ? {
          ...current, manualTheoryFieldCount, fallbackTheoryFieldCount: fallbackTheoryFields.size,
          fallbackEvidencePickCount: fallbackEvidenceIds.length, theoryFallbackApproved: false,
          lastResult: fallbackUsed ? "submitting with explicit certified fallback" : "submitting manual theory"
        } : current);
        const certifiedTheory: PlayerTheory = {
          culpritId: fallbackTheoryFields.has("culpritId") ? activeCase.deductionCase.truth.culpritId : theory.culpritId,
          motive: fallbackTheoryFields.has("motive") ? activeCase.deductionCase.truth.motive : theory.motive,
          method: fallbackTheoryFields.has("method") ? activeCase.deductionCase.truth.method : theory.method,
          evidenceIds: selectedEvidenceIds,
          ...(theory.proof ? { proof: theory.proof } : {})
        };
        const judgement = await submitCurrentTheory(certifiedTheory, { syncVisibleTheory: false });
        const accepted = Boolean(judgement?.accepted);
        const blockedTheoryGapCount = unresolvedManualTheoryFields(judgement || undefined).size;
        const submitJournalLabel = accepted ? replayGoalAttempt?.active ? "Submit replay theory" : "Submit certified theory" : "Review theory gaps";
        setReplayGoalAttempt((current) => current ? {
          ...current, manualTheoryFieldCount, fallbackTheoryFieldCount: fallbackTheoryFields.size,
          fallbackEvidencePickCount: fallbackEvidenceIds.length, blockedTheoryGapCount, theoryFallbackApproved: false,
          lastResult: accepted ? fallbackUsed ? "accepted with explicit certified fallback" : "accepted manual theory" : "manual theory judgement blocked"
        } : current);
        setGuidedManualLastResult(accepted ? "accepted" : "manual theory blocked");
        appendJournal({
          step: "submit", label: submitJournalLabel, status: accepted ? "done" : "blocked",
          result: accepted ? "Theory accepted by local judgement." : `Theory judgement returned ${blockedTheoryGapCount} field-level gap(s).`,
          progressDelta: accepted
            ? `${manualTheoryFieldCount} manual theory field(s), ${fallbackTheoryFields.size} fallback theory field(s), and ${fallbackEvidenceIds.length} fallback evidence pick(s) closed the route.`
            : "Entered text remains private; only aggregate gap counts are recorded.",
          nextAction: accepted ? "Review the source-backed audit workbench." : "Revise the theory or explicitly approve fallback for unresolved fields.",
          fallbackUsed
        });
        if (accepted) {
          appendJournal({
            step: "review-source", label: "Review source audit", status: "done", result: "Source Review Workbench unlocked.",
            progressDelta: "Source Trail, Proof Obligations, Certified Route, and Conclusion Review are available.",
            nextAction: "Inspect the solved-case audit without raw replay or hidden ids.", reviewUnlocked: true
          });
        }
        return;
      }
      setInspectorTab("investigation");
      setGuidedManualLastResult("source review ready");
      setStatus("Source Review Workbench is ready.");
      appendJournal({
        step: "review-source", label: "Review source audit", status: session.judgement?.accepted ? "done" : "blocked",
        result: session.judgement?.accepted ? "Source Review Workbench is ready." : "Accepted theory is required before source review unlocks.",
        progressDelta: session.judgement?.accepted ? "Review source is unlocked." : "Review source remains locked.",
        nextAction: session.judgement?.accepted ? "Inspect the source-backed audit." : "Complete the certified route and submit theory.",
        reviewUnlocked: Boolean(session.judgement?.accepted)
      });
    } finally {
      setGuidedManualRunning(false);
    }
  }

  return { runGuidedManualStep };
}
