"use client";

import { useCallback } from "react";
import type { CertifiedCaseRhythmViewModel } from "@/app/campaign/certified-case-rhythm-model";
import type { CertifiedInvestigationActionAdapter } from "@/app/hooks/useCertifiedInvestigationActions";
import type { PlayableCaseNextAction } from "@/lib/engine";

export function useCertifiedCaseRhythmActions({ rhythm, actionAdapter, focusStep, observeCaseWindow }: {
  rhythm: CertifiedCaseRhythmViewModel;
  actionAdapter: CertifiedInvestigationActionAdapter;
  focusStep: (action: PlayableCaseNextAction) => void;
  observeCaseWindow: () => void | Promise<void>;
}) {
  const runCurrentStep = useCallback(async () => {
    const { kind, action } = rhythm.currentStep;
    if (kind === "join") return actionAdapter.joinCase();
    if (action.kind === "observe") return observeCaseWindow();
    if (kind === "search" && action.targetLocationId) return actionAdapter.discoverFirstSceneEvidence(action.targetLocationId);
    if (kind === "question" && action.targetCharacterId) {
      return actionAdapter.runInterrogationTarget(action.targetCharacterId, undefined, "Where were you during the incident window, and what did you observe?");
    }
    if (kind === "challenge" && action.targetCharacterId && action.targetEvidenceId) {
      return actionAdapter.runInterrogationTarget(action.targetCharacterId, action.targetEvidenceId, "Please explain this evidence and whether it changes your earlier statement.");
    }
    if (kind === "review-source") return actionAdapter.revealSolution();
    focusStep(action);
  }, [actionAdapter, focusStep, observeCaseWindow, rhythm]);

  return { runCurrentStep };
}
