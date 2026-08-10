"use client";

import { useEffect } from "react";
import type { useCampaignController } from "@/app/controllers/useCampaignController";
import type { useInvestigationController } from "@/app/controllers/useInvestigationController";
import type { useReplayController } from "@/app/controllers/useReplayController";

type InvestigationController = ReturnType<typeof useInvestigationController>;
type CampaignController = ReturnType<typeof useCampaignController>;
type ReplayController = ReturnType<typeof useReplayController>;

type WorkspaceLifecycleEffectsInput = {
  investigation: InvestigationController;
  campaign: CampaignController;
  replay: ReplayController;
};

const timeMax = 23 * 60;

/** Request-free UI lifecycle effects; no runtime, event, or authority state is written here. */
export function useWorkspaceLifecycleEffects({ investigation, campaign, replay }: WorkspaceLifecycleEffectsInput) {
  const {
    activeCase,
    runtimeMode,
    world,
    setTimeValue,
    selectionHighlight,
    setSelectionHighlight,
    toasts,
    setToasts
  } = investigation;
  const {
    setWorldLead,
    setWorldLeadOutcome
  } = campaign;
  const {
    replaying,
    setReplaying,
    setGuidedStepJournal,
    setGuidedManualLastResult,
    setReplayGoalAttempt
  } = replay;

  useEffect(() => {
    setGuidedStepJournal([]);
    setGuidedManualLastResult("ready");
    setWorldLead(null);
    setWorldLeadOutcome(null);
    setReplayGoalAttempt(null);
  }, [activeCase?.id, runtimeMode]);

  useEffect(() => {
    if (!replaying || !world) return;
    const timer = window.setInterval(() => {
      setTimeValue((value) => {
        const next = value + 10;
        if (next >= timeMax) {
          setReplaying(false);
          return timeMax;
        }
        return next;
      });
    }, 700);
    return () => window.clearInterval(timer);
  }, [replaying, setReplaying, setTimeValue, world]);

  useEffect(() => {
    if (!selectionHighlight.locationId && !selectionHighlight.characterId && !selectionHighlight.evidenceId && !selectionHighlight.eventId) return;
    const timer = window.setTimeout(() => setSelectionHighlight({}), 1800);
    return () => window.clearTimeout(timer);
  }, [selectionHighlight, setSelectionHighlight]);

  useEffect(() => {
    if (!toasts.length) return;
    const timer = window.setTimeout(() => {
      setToasts((current) => current.slice(0, -1));
    }, 3800);
    return () => window.clearTimeout(timer);
  }, [setToasts, toasts]);
}
