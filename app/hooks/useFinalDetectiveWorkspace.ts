"use client";

import { useMemo } from "react";
import {
  buildFinalDetectiveWorkspace,
  type FinalDetectiveWorkspaceInput
} from "@/app/campaign/final-detective-workspace-model";

/** Memoized presentation derivation only; it owns no request, storage, tick, or authority. */
export function useFinalDetectiveWorkspace(input: FinalDetectiveWorkspaceInput) {
  return useMemo(
    () => buildFinalDetectiveWorkspace(input),
    [
      input.runtimeMode, input.commandBrief, input.rhythm, input.playableIntake, input.session,
      input.notebookItems, input.discoveredEvidence, input.characters, input.testimonies, input.theory,
      input.selectedCharacterId, input.selectedEvidenceId, input.selectedSceneName, input.promptSafe,
      input.memoryCount, input.evidenceImpacts, input.gapCards, input.nextStepAdvice, input.campaignRecovery,
      input.sourceReviewUnlock, input.proofLedger, input.proofCoverage, input.routeCertificate,
      input.proofTourSteps, input.revealAvailable
    ]
  );
}
