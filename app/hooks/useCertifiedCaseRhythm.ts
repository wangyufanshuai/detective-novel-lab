"use client";

import { useMemo } from "react";
import { buildCertifiedCaseRhythm, type CertifiedCaseRhythmInput } from "@/app/campaign/certified-case-rhythm-model";

export function useCertifiedCaseRhythm(input: CertifiedCaseRhythmInput) {
  return useMemo(() => buildCertifiedCaseRhythm(input), [
    input.intake,
    input.observedCrimeWindow,
    input.recoveryAdvice,
    input.recoveryGap,
    input.revealAvailable,
    input.selectedSceneName,
    input.session
  ]);
}
