"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  campaignProgressSignature,
  campaignTransitionSignal,
  deriveCampaignBeatPresentation,
  nextCampaignBeatPhase,
  type CampaignBeatPhase,
  type CampaignTransitionSignal
} from "@/app/campaign/campaign-transition-model";
import type { StrategicCommandViewModel } from "@/app/campaign/strategic-command-model";
import type { StrategicActionLifecycle } from "@/app/campaign/strategic-pacing-model";

type TheatreState = {
  phase: CampaignBeatPhase;
  signal: CampaignTransitionSignal;
  sequence: number;
};

export function useCampaignTransitionTheatre(command: StrategicCommandViewModel, lifecycle?: StrategicActionLifecycle) {
  const [state, setState] = useState<TheatreState>({ phase: "idle", signal: "none", sequence: 0 });
  const previousLifecycleState = useRef(lifecycle?.state);
  const previousFeedbackSignature = useRef(command.presentationFeedback.signature);
  const previousCampaign = useRef(campaignProgressSignature(command));
  const suppressCurrentCompletion = useRef(false);

  useEffect(() => {
    const previous = previousLifecycleState.current;
    const current = lifecycle?.state;
    previousLifecycleState.current = current;
    if (current === previous) return;
    if (current === "resolving") {
      suppressCurrentCompletion.current = false;
      setState((value) => ({ phase: "action-resolving", signal: "none", sequence: value.sequence + 1 }));
    } else if (current === "succeeded" || current === "failed-safe") {
      if (suppressCurrentCompletion.current) {
        suppressCurrentCompletion.current = false;
        return;
      }
      setState((value) => ({ ...value, phase: "immediate-result", signal: "none" }));
    }
  }, [lifecycle?.state]);

  useEffect(() => {
    const feedback = command.presentationFeedback;
    const changed = previousFeedbackSignature.current !== feedback.signature;
    previousFeedbackSignature.current = feedback.signature;
    if (!changed || lifecycle?.state === "resolving" || lifecycle?.state === "selected") return;
    if (feedback.state === "resolving") {
      suppressCurrentCompletion.current = false;
      setState((value) => ({ phase: "action-resolving", signal: "none", sequence: value.sequence + 1 }));
    } else if (["updated", "completed", "blocked"].includes(feedback.state)) {
      if (suppressCurrentCompletion.current) {
        suppressCurrentCompletion.current = false;
        return;
      }
      setState((value) => ({ phase: "immediate-result", signal: "none", sequence: value.sequence + 1 }));
    }
  }, [command.presentationFeedback, lifecycle]);

  useEffect(() => {
    const current = campaignProgressSignature(command);
    const signal = campaignTransitionSignal(previousCampaign.current, command);
    previousCampaign.current = current;
    if (signal === "none" || lifecycle?.state === "resolving") return;
    setState((value) => ({ phase: "immediate-result", signal, sequence: value.sequence + 1 }));
  }, [command, lifecycle?.state]);

  const presentation = useMemo(() => deriveCampaignBeatPresentation({
    command,
    lifecycle,
    phase: state.phase,
    signal: state.signal,
    sequence: state.sequence
  }), [command, lifecycle, state]);

  useEffect(() => {
    if (state.phase !== "immediate-result" && state.phase !== "world-consequence" && state.phase !== "next-objective") return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reducedMotion ? 30 : state.phase === "immediate-result" ? 1150 : state.phase === "world-consequence" ? 1550 : 3200;
    const timer = window.setTimeout(() => {
      setState((value) => ({ ...value, phase: nextCampaignBeatPhase(value.phase, presentation.hasWorldConsequence) }));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [presentation.hasWorldConsequence, state.phase]);

  const skip = useCallback(() => {
    setState((value) => value.phase === "immediate-result" || value.phase === "world-consequence"
      ? { ...value, phase: "next-objective" }
      : value);
  }, []);

  const dismiss = useCallback(() => {
    setState((value) => {
      if (value.phase === "action-resolving") suppressCurrentCompletion.current = true;
      return { ...value, phase: "dismissed" };
    });
  }, []);

  const advance = useCallback(() => {
    setState((value) => ({ ...value, phase: nextCampaignBeatPhase(value.phase, presentation.hasWorldConsequence) }));
  }, [presentation.hasWorldConsequence]);

  return { presentation, skip, dismiss, advance };
}
