"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CAMPAIGN_STUDY_STORAGE_KEY,
  abandonCampaignStudyRun,
  advanceCampaignStudyStage,
  completeCampaignStudyWorldChoice,
  createCampaignStudyCollection,
  finalizeCampaignStudyRun,
  getCampaignStudyOperationsState,
  interruptActiveCampaignStudyRuns,
  markCampaignStudyCompleted,
  normalizeCampaignStudyCollection,
  observeCampaignStudyRecovery,
  recordCampaignStudyAssistance,
  recordCampaignStudyMeaningfulAction,
  recordCampaignStudyRecoveryStarted,
  startNextCampaignStudyRun,
  startCampaignStudyWorldChoice,
  toCampaignStudyExport,
  updateCampaignStudyAssessment,
  updateCampaignStudyRun,
  type CampaignStudyAssessment,
  type CampaignStudyCollection,
  type CampaignStudyConfusion,
  type CampaignStudyRun,
  type CampaignStudyStage,
  type CampaignStudyWorldChoice
} from "@/lib/campaign-comprehension-study";

type CampaignStudyRuntimeMode = "server" | "static-demo";

type UseCampaignComprehensionStudyInput = {
  runtimeMode: CampaignStudyRuntimeMode;
  canStart: boolean;
  startBlockedReason?: string;
  currentStage: CampaignStudyStage;
  campaignCompleted: boolean;
  recoveryReady: boolean;
  readyWorldChoices: Partial<Record<CampaignStudyWorldChoice, boolean>>;
};

type TimerAnchor = {
  ordinal: number;
  elapsedSeconds: number;
  performanceStartedAt: number;
};

function studyRequestedInServerRuntime() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("study") !== "1") return false;
  if (params.get("runtime") === "static") return false;
  if (params.get("runtime") === "server") return true;
  return process.env.NEXT_PUBLIC_DEMO_MODE !== "static";
}

function loadStudyCollection() {
  if (typeof window === "undefined") return createCampaignStudyCollection();
  try {
    const raw = window.localStorage.getItem(CAMPAIGN_STUDY_STORAGE_KEY);
    return normalizeCampaignStudyCollection(raw ? JSON.parse(raw) : undefined);
  } catch {
    return createCampaignStudyCollection();
  }
}

export function useCampaignComprehensionStudy(input: UseCampaignComprehensionStudyInput) {
  const [requested, setRequested] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [collection, setCollection] = useState<CampaignStudyCollection>(() => createCampaignStudyCollection());
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState(0);
  const timerAnchorRef = useRef<TimerAnchor | null>(null);

  const visible = requested && input.runtimeMode === "server";
  const currentRun = useMemo(
    () => [...collection.runs].reverse().find((run) => run.status === "active" || run.status === "awaiting-assessment"),
    [collection.runs]
  );

  const elapsedNow = useCallback((run?: CampaignStudyRun) => {
    const anchor = timerAnchorRef.current;
    if (!run || run.status !== "active" || !anchor || anchor.ordinal !== run.ordinal || typeof performance === "undefined") {
      return run?.elapsedSeconds || 0;
    }
    return Math.max(run.elapsedSeconds, anchor.elapsedSeconds + Math.floor((performance.now() - anchor.performanceStartedAt) / 1000));
  }, []);

  const updateCurrentRun = useCallback((update: (run: CampaignStudyRun, elapsedSeconds: number) => CampaignStudyRun) => {
    setCollection((current) => {
      const run = [...current.runs].reverse().find((item) => item.status === "active" || item.status === "awaiting-assessment");
      if (!run) return current;
      return updateCampaignStudyRun(current, run.ordinal, (item) => update(item, elapsedNow(item)));
    });
  }, [elapsedNow]);

  useEffect(() => {
    const nextRequested = studyRequestedInServerRuntime();
    setRequested(nextRequested);
    if (!nextRequested) return;
    const interrupted = interruptActiveCampaignStudyRuns(loadStudyCollection());
    setCollection(interrupted);
    setHydrated(true);
    window.localStorage.setItem(CAMPAIGN_STUDY_STORAGE_KEY, JSON.stringify(interrupted));
  }, []);

  useEffect(() => {
    if (!hydrated || !visible) return;
    try {
      window.localStorage.setItem(CAMPAIGN_STUDY_STORAGE_KEY, JSON.stringify(collection));
    } catch {
      // A full or disabled localStorage must never affect the game runtime.
    }
  }, [collection, hydrated, visible]);

  useEffect(() => {
    if (!currentRun || currentRun.status !== "active") {
      timerAnchorRef.current = null;
      setLiveElapsedSeconds(currentRun?.elapsedSeconds || 0);
      return;
    }
    const anchor = timerAnchorRef.current;
    if (!anchor || anchor.ordinal !== currentRun.ordinal) {
      timerAnchorRef.current = {
        ordinal: currentRun.ordinal,
        elapsedSeconds: currentRun.elapsedSeconds,
        performanceStartedAt: performance.now()
      };
    }
    const updateClock = () => setLiveElapsedSeconds(elapsedNow(currentRun));
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, [currentRun, elapsedNow]);

  useEffect(() => {
    if (!visible || currentRun?.status !== "active") return;
    updateCurrentRun((run, elapsed) => advanceCampaignStudyStage(run, input.currentStage, elapsed));
  }, [currentRun?.ordinal, currentRun?.status, input.currentStage, updateCurrentRun, visible]);

  useEffect(() => {
    if (!visible || currentRun?.status !== "active") return;
    updateCurrentRun((run, elapsed) => observeCampaignStudyRecovery(run, input.recoveryReady, elapsed));
  }, [currentRun?.ordinal, currentRun?.status, input.recoveryReady, updateCurrentRun, visible]);

  useEffect(() => {
    if (!visible || currentRun?.status !== "active") return;
    updateCurrentRun((run, elapsed) => {
      let next = run;
      for (const [kind, ready] of Object.entries(input.readyWorldChoices) as Array<[CampaignStudyWorldChoice, boolean | undefined]>) {
        if (ready) next = startCampaignStudyWorldChoice(next, kind, elapsed);
      }
      return next;
    });
  }, [
    currentRun?.ordinal,
    currentRun?.status,
    input.readyWorldChoices,
    updateCurrentRun,
    visible
  ]);

  useEffect(() => {
    if (!visible || !input.campaignCompleted || currentRun?.status !== "active") return;
    updateCurrentRun((run, elapsed) => markCampaignStudyCompleted(run, elapsed));
  }, [currentRun?.ordinal, currentRun?.status, input.campaignCompleted, updateCurrentRun, visible]);

  const operations = useMemo(() => getCampaignStudyOperationsState(collection), [collection]);

  const start = useCallback(() => {
    if (!visible || !input.canStart || currentRun || operations.status !== "ready") return false;
    let started: CampaignStudyRun | undefined;
    setCollection((current) => {
      const result = startNextCampaignStudyRun(current, input.currentStage);
      if (!result) return current;
      started = result.run;
      return result.collection;
    });
    if (started) {
      timerAnchorRef.current = {
        ordinal: started.ordinal,
        elapsedSeconds: 0,
        performanceStartedAt: performance.now()
      };
    }
    return true;
  }, [currentRun, input.canStart, input.currentStage, operations.status, visible]);

  const recordMeaningfulAction = useCallback(() => {
    if (!visible) return;
    updateCurrentRun((run, elapsed) => recordCampaignStudyMeaningfulAction(run, elapsed));
  }, [updateCurrentRun, visible]);

  const recordWorldChoice = useCallback((kind: CampaignStudyWorldChoice) => {
    if (!visible) return;
    updateCurrentRun((run, elapsed) => completeCampaignStudyWorldChoice(run, kind, elapsed));
  }, [updateCurrentRun, visible]);

  const recordRecoveryStarted = useCallback(() => {
    if (!visible) return;
    updateCurrentRun((run, elapsed) => recordCampaignStudyRecoveryStarted(run, elapsed));
  }, [updateCurrentRun, visible]);

  const recordAssistance = useCallback((kind: "guided-step" | "explicit-fallback") => {
    if (!visible) return;
    updateCurrentRun((run, elapsed) => recordCampaignStudyAssistance(run, kind, elapsed));
  }, [updateCurrentRun, visible]);

  const updateAssessment = useCallback((assessment: Partial<CampaignStudyAssessment>) => {
    if (!visible) return;
    updateCurrentRun((run) => updateCampaignStudyAssessment(run, assessment));
  }, [updateCurrentRun, visible]);

  const incrementMisunderstanding = useCallback(() => {
    if (!currentRun) return;
    updateAssessment({
      primaryActionMisunderstandingCount: currentRun.assessment.primaryActionMisunderstandingCount + 1
    });
  }, [currentRun, updateAssessment]);

  const toggleConfusion = useCallback((confusion: CampaignStudyConfusion) => {
    if (!currentRun) return;
    const selected = new Set(currentRun.assessment.confusionCategories);
    if (selected.has(confusion)) selected.delete(confusion);
    else selected.add(confusion);
    updateAssessment({ confusionCategories: Array.from(selected) });
  }, [currentRun, updateAssessment]);

  const abandon = useCallback(() => {
    if (!visible) return;
    updateCurrentRun((run, elapsed) => abandonCampaignStudyRun(run, elapsed));
  }, [updateCurrentRun, visible]);

  const finalize = useCallback(() => {
    if (!visible) return false;
    let finalized = false;
    updateCurrentRun((run) => {
      const next = finalizeCampaignStudyRun(run);
      finalized = Boolean(next);
      return next || run;
    });
    return finalized;
  }, [updateCurrentRun, visible]);

  const reset = useCallback(() => {
    if (!visible) return;
    timerAnchorRef.current = null;
    const empty = createCampaignStudyCollection();
    setCollection(empty);
    try {
      window.localStorage.removeItem(CAMPAIGN_STUDY_STORAGE_KEY);
    } catch {
      // Reset remains isolated from the game even when browser storage is unavailable.
    }
  }, [visible]);

  return {
    visible,
    hydrated,
    collection,
    currentRun,
    operations,
    elapsedSeconds: currentRun?.status === "active" ? liveElapsedSeconds : currentRun?.elapsedSeconds || 0,
    canStart: visible && input.canStart && !currentRun && operations.status === "ready",
    startBlockedReason: !visible
      ? "Campaign Study is available only in Server Runtime with ?study=1."
      : currentRun
        ? "Finish, finalize, or abandon the current local study run first."
        : operations.status !== "ready"
          ? operations.reason
        : input.startBlockedReason || "Start from Campaign opening with no active investigation session.",
    start,
    abandon,
    finalize,
    reset,
    exportData: () => toCampaignStudyExport(collection),
    recordMeaningfulAction,
    recordWorldChoice,
    recordRecoveryStarted,
    recordGuidedStep: () => recordAssistance("guided-step"),
    recordExplicitFallback: () => recordAssistance("explicit-fallback"),
    incrementMisunderstanding,
    toggleConfusion,
    updateAssessment
  };
}
