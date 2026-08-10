"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StrategicCommandAction, StrategicCommandViewModel } from "@/app/campaign/strategic-command-model";
import {
  appendRecentSafeOutcome,
  buildStrategicPacingViewModel,
  deriveCurrentSafeOutcome,
  type StrategicActionLifecycle,
  type StrategicSafeOutcome
} from "@/app/campaign/strategic-pacing-model";

export function useStrategicPacing(command: StrategicCommandViewModel) {
  const [actionLifecycle, setActionLifecycle] = useState<StrategicActionLifecycle>();
  const [recentSafeOutcomes, setRecentSafeOutcomes] = useState<StrategicSafeOutcome[]>([]);
  const previousFeedbackSignature = useRef(command.presentationFeedback.signature);

  useEffect(() => {
    const feedback = command.presentationFeedback;
    const changed = previousFeedbackSignature.current !== feedback.signature;
    previousFeedbackSignature.current = feedback.signature;
    if (feedback.state === "blocked") {
      setActionLifecycle((current) => ({ state: "blocked", action: current?.action, detail: feedback.detail }));
    } else if (feedback.state === "resolving") {
      setActionLifecycle((current) => ({ state: "resolving", action: current?.action, detail: feedback.detail }));
    } else if (changed && (feedback.state === "selected" || feedback.state === "available" || feedback.state === "idle")) {
      setActionLifecycle((current) => current?.state === "resolving" || current?.state === "selected" ? current : undefined);
    }
  }, [command.presentationFeedback]);

  const currentOutcome = useMemo(
    () => deriveCurrentSafeOutcome(command, actionLifecycle),
    [actionLifecycle, command]
  );

  useEffect(() => {
    if (!currentOutcome) return;
    setRecentSafeOutcomes((current) => {
      const next = appendRecentSafeOutcome(current, currentOutcome);
      return next.length === current.length && next.every((item, index) => item.signature === current[index]?.signature)
        ? current
        : next;
    });
  }, [currentOutcome]);

  const viewModel = useMemo(() => buildStrategicPacingViewModel({
    command,
    actionLifecycle,
    recentSafeOutcomes
  }), [actionLifecycle, command, recentSafeOutcomes]);

  const runAction = useCallback(async (
    action: StrategicCommandAction,
    execute: (action: StrategicCommandAction) => void | Promise<void>
  ) => {
    if (!action.enabled) {
      setActionLifecycle({ state: "blocked", action, detail: action.disabledReason || "The existing authority has not enabled this action." });
      return false;
    }
    setActionLifecycle({ state: "selected", action, detail: action.detail });
    await Promise.resolve();
    setActionLifecycle({ state: "resolving", action, detail: "The existing command handler is resolving." });
    try {
      await execute(action);
      setActionLifecycle({ state: "succeeded", action, detail: "The existing command returned a safe visible result." });
      return true;
    } catch {
      setActionLifecycle({
        state: "failed-safe",
        action,
        detail: "The command returned safely without changing case authority. Review the visible status before retrying."
      });
      return false;
    }
  }, []);

  return { viewModel, actionLifecycle, recentSafeOutcomes, runAction };
}
