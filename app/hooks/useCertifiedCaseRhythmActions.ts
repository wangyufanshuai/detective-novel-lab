"use client";

import { useCallback } from "react";
import type { CertifiedCaseRhythmViewModel } from "@/app/campaign/certified-case-rhythm-model";
import { executeCertifiedInvestigationStep } from "@/app/campaign/execute-certified-investigation-step";

type StepInput = Parameters<typeof executeCertifiedInvestigationStep>[0];

export function useCertifiedCaseRhythmActions({ rhythm, actionAdapter, ...input }: Omit<StepInput, "kind" | "action" | "adapter"> & {
  rhythm: CertifiedCaseRhythmViewModel;
  actionAdapter: StepInput["adapter"];
}) {
  const runCurrentStep = useCallback(async () => executeCertifiedInvestigationStep({
    ...input, kind: rhythm.currentStep.kind, action: rhythm.currentStep.action, adapter: actionAdapter
  }), [actionAdapter, input, rhythm]);
  return { runCurrentStep };
}
