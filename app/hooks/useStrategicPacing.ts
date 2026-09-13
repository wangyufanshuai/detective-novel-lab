"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StrategicCommandAction, StrategicCommandViewModel } from "@/app/campaign/strategic-command-model";
import type { InvestigationActionResult } from "@/app/campaign/investigation-action-result";
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
  const actionInFlight = useRef(false);
  const actionSequence = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const feedback = command.presentationFeedback;
    const changed = previousFeedbackSignature.current !== feedback.signature;
    previousFeedbackSignature.current = feedback.signature;
    // The typed action result owns its terminal state. A delayed busy/status
    // render must never turn a confirmed result back into "resolving".
    setActionLifecycle((current) => {
      if (current?.action) return current;
      if (feedback.state === "blocked") {
        return { state: "blocked", detail: feedback.detail };
      } else if (feedback.state === "resolving") {
        return { state: "resolving", detail: feedback.detail };
      } else if (changed && (feedback.state === "selected" || feedback.state === "available" || feedback.state === "idle")) {
        return undefined;
      }
      return current;
    });
  }, [command.presentationFeedback]);

  const currentOutcome = useMemo(
    () => deriveCurrentSafeOutcome(command, actionLifecycle),
    [actionLifecycle, command]
  );

  useEffect(() => {
    if (!currentOutcome) return;
    setRecentSafeOutcomes((current) => {
      const next = appendRecentSafeOutcome(current, currentOutcome);
      return next.length === current.length && next.every((item, index) => JSON.stringify(item) === JSON.stringify(current[index]))
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
    execute: (action: StrategicCommandAction) => void | InvestigationActionResult | Promise<void | InvestigationActionResult>
  ) => {
    if (actionInFlight.current || !mounted.current) return false;
    const sequence = ++actionSequence.current;
    if (!action.enabled) {
      setActionLifecycle({ state: "blocked", sequence, action, detail: action.disabledReason || "The existing authority has not enabled this action." });
      return false;
    }
    actionInFlight.current = true;
    setActionLifecycle({ state: "selected", sequence, action, detail: action.detail });
    await Promise.resolve();
    if (!mounted.current) { actionInFlight.current = false; return false; }
    setActionLifecycle({ state: "resolving", sequence, action, detail: "The existing command handler is resolving." });
    try {
      const result = await execute(action);
      if (!mounted.current) return false;
      if (result) {
        const worldChange = result.worldChange ?? (action.kind === "certified-investigation" && !result.judgement ? "No persistent world change" : undefined);
        setActionLifecycle({ state: result.status === "failed" ? "failed-safe" : result.status, sequence, action, detail: result.detail, worldChange });
        return result.status === "succeeded";
      }
      const needsResult = action.kind === "certified-investigation";
      setActionLifecycle({
        state: needsResult ? "failed-safe" : "succeeded", sequence, action,
        detail: needsResult ? "The action did not confirm a result. Review the investigation before retrying." : "The requested view is ready."
      });
      return !needsResult;
    } catch {
      if (mounted.current) setActionLifecycle({
        state: "failed-safe",
        sequence,
        action,
        detail: "The action could not confirm a result. Review the current investigation before retrying."
      });
      return false;
    } finally {
      actionInFlight.current = false;
    }
  }, []);

  return { viewModel, actionLifecycle, recentSafeOutcomes, runAction };
}
