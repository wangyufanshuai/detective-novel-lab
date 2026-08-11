"use client";

import type { useInvestigationController } from "@/app/controllers/useInvestigationController";
import type { useReplayController } from "@/app/controllers/useReplayController";
import type { SelectionHighlight } from "@/app/hooks/useGuidedOnboarding";
import { postV1 } from "@/app/lib/client-runtime";
import { useAppLocale } from "@/app/localization/locale-context";
import { autoSolvePlayableCase } from "@/lib/engine";
import type { CaseAutoSolveSummary, DeductionCase, DemoRuntimeState, PlayerSession } from "@/lib/engine";

export type CertifiedPlaythroughActionAdapter = {
  runStaticCertifiedPlaythrough: () => void;
  runServerCertifiedPlaythrough: () => Promise<void>;
};

type CertifiedPlaythroughActionsInput = {
  investigation: ReturnType<typeof useInvestigationController>;
  replay: ReturnType<typeof useReplayController>;
  scenes: DeductionCase["scenes"];
  hydrateStatic: (state: DemoRuntimeState, resetTime?: boolean) => void;
  highlightSelection: (next: SelectionHighlight) => void;
  persist: (worldId?: string, sessionId?: string) => void;
  recordTheoryResult: (accepted: boolean) => void;
};

/** Non-authoritative certified-route verification kept outside player action presentation. */
export function useCertifiedPlaythroughActions({
  investigation,
  replay,
  scenes,
  hydrateStatic,
  highlightSelection,
  persist,
  recordTheoryResult
}: CertifiedPlaythroughActionsInput): CertifiedPlaythroughActionAdapter {
  const { t } = useAppLocale();
  const {
    runtimeMode, world, activeCase, events, playerName, revealText,
    setTheory, setSession, setSessions, setProgress, setSelectedEvidenceId, setSelectedSceneId,
    setSelectedCharacterId, setSelectedSuspectId, setInspectorTab, setBusy, pushToast, setStatus
  } = investigation;
  const { setServerPlaythroughSummary } = replay;

  function runStaticCertifiedPlaythrough() {
    if (runtimeMode !== "static-demo" || !world || !activeCase) return;
    const report = autoSolvePlayableCase(activeCase, events, {
      sessionId: `static-certified-${Date.now()}`,
      playerId: "static-player",
      displayName: playerName.trim() || "Investigator",
      dryRun: true
    });
    if (!report.passed || !report.session.judgement?.accepted) {
      pushToast({
        tone: "warning",
        title: "Certified playthrough blocked",
        detail: report.summary.failureKinds.join(", ") || "Route proof did not pass."
      });
      setStatus(`Static playthrough blocked: ${report.summary.failureKinds.join(", ") || "route proof did not pass"}`);
      return;
    }
    const nextState: DemoRuntimeState = {
      mode: "static-demo",
      world,
      events,
      activeCase,
      session: report.session,
      progress: {
        observedCrimeWindow: true,
        joinedInvestigation: true,
        discoveredEvidence: report.session.discoveredEvidenceIds.length > 0,
        challengedTestimony: report.session.interrogationLog.some((entry) => entry.challenge?.hit),
        submittedTheory: Boolean(report.session.submittedTheory),
        solvedCase: Boolean(report.session.judgement?.accepted)
      },
      revealText
    };
    hydrateStatic(nextState, false);
    if (report.theory) setTheory(report.theory);
    const firstEvidenceId = report.theory?.evidenceIds[0] || report.session.discoveredEvidenceIds[0] || "";
    if (firstEvidenceId) {
      setSelectedEvidenceId(firstEvidenceId);
      const scene = scenes.find((item) => item.evidenceIds.includes(firstEvidenceId));
      if (scene) setSelectedSceneId(scene.id);
      highlightSelection({ evidenceId: firstEvidenceId, locationId: scene?.id });
    }
    const firstWitnessId = report.session.interrogationLog.find((entry) => entry.challenge?.hit)?.characterId || report.session.interrogationLog[0]?.characterId;
    if (firstWitnessId) {
      setSelectedCharacterId(firstWitnessId);
      setSelectedSuspectId(firstWitnessId);
    }
    recordTheoryResult(true);
    setInspectorTab("investigation");
    pushToast({
      tone: "success",
      title: "Certified playthrough completed",
      detail: `${report.summary.stepCount} steps / ${report.summary.challengeHitCount} challenge hit(s) / ${report.summary.selectedEvidenceCount} selected evidence.`
    });
    setStatus("Static certified playthrough completed. Theory accepted and Review Source is unlocked.");
  }

  async function runServerCertifiedPlaythrough() {
    if (runtimeMode === "static-demo" || !world || !activeCase) return;
    setBusy(true);
    try {
      const data = await postV1<{ summary: CaseAutoSolveSummary; session?: PlayerSession; sessionId?: string }>(
        "/api/v1/command/investigation/autosolve",
        { caseId: activeCase.id, persist: true, includeSession: true }
      );
      setServerPlaythroughSummary(data.summary);
      if (!data.summary.passed || !data.session?.judgement?.accepted) {
        pushToast({
          tone: "warning",
          title: "Server playthrough blocked",
          detail: data.summary.failureKinds.join(", ") || "Route proof did not pass."
        });
        setStatus(`Server playthrough blocked: ${data.summary.failureKinds.join(", ") || "route proof did not pass"}`);
        return;
      }
      setSession(data.session);
      setSessions((items) => [data.session as PlayerSession, ...items.filter((item) => item.id !== data.session?.id)]);
      setProgress({
        observedCrimeWindow: true,
        joinedInvestigation: true,
        discoveredEvidence: data.summary.discoveredEvidenceCount > 0,
        challengedTestimony: data.summary.challengeHitCount > 0,
        submittedTheory: Boolean(data.session.submittedTheory),
        solvedCase: Boolean(data.session.judgement?.accepted)
      });
      persist(world.id, data.session.id);
      if (data.session.submittedTheory) setTheory(data.session.submittedTheory);
      const firstEvidenceId = data.session.submittedTheory?.evidenceIds[0] || data.session.discoveredEvidenceIds[0] || "";
      if (firstEvidenceId) {
        setSelectedEvidenceId(firstEvidenceId);
        const scene = scenes.find((item) => item.evidenceIds.includes(firstEvidenceId));
        if (scene) setSelectedSceneId(scene.id);
        highlightSelection({ evidenceId: firstEvidenceId, locationId: scene?.id });
      }
      const firstWitnessId = data.session.interrogationLog.find((entry) => entry.challenge?.hit)?.characterId || data.session.interrogationLog[0]?.characterId;
      if (firstWitnessId) {
        setSelectedCharacterId(firstWitnessId);
        setSelectedSuspectId(firstWitnessId);
      }
      recordTheoryResult(true);
      setInspectorTab("investigation");
      pushToast({
        tone: "success",
        title: "Server certified playthrough completed",
        detail: `${data.summary.stepCount} steps / ${data.summary.challengeHitCount} challenge hit(s) / ${data.summary.selectedEvidenceCount} selected evidence.`
      });
      setStatus("Server certified playthrough completed. Auto-player session was persisted and Review Source is unlocked.");
    } catch {
      setStatus(t("error.generic"));
    } finally {
      setBusy(false);
    }
  }

  return { runStaticCertifiedPlaythrough, runServerCertifiedPlaythrough };
}
