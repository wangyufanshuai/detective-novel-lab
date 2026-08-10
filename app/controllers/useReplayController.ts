"use client";

import { useRef, useState } from "react";
import type { GuidedStepJournalEntry, ReplayGoalAttemptState } from "@/app/campaign/replay-practice-model";
import type { CaseAutoSolveSummary } from "@/lib/engine";

/** Owns replay/practice lifecycle state without changing certified investigation handlers. */
export function useReplayController() {
  const [replaying, setReplaying] = useState(false);
  const [serverPlaythroughSummary, setServerPlaythroughSummary] = useState<CaseAutoSolveSummary | null>(null);
  const [guidedManualLastResult, setGuidedManualLastResult] = useState("ready");
  const [guidedManualRunning, setGuidedManualRunning] = useState(false);
  const [guidedStepJournal, setGuidedStepJournal] = useState<GuidedStepJournalEntry[]>([]);
  const [replayGoalAttempt, setReplayGoalAttempt] = useState<ReplayGoalAttemptState | null>(null);
  const guidedStepJournalSeq = useRef(0);

  return {
    replaying, setReplaying,
    serverPlaythroughSummary, setServerPlaythroughSummary,
    guidedManualLastResult, setGuidedManualLastResult,
    guidedManualRunning, setGuidedManualRunning,
    guidedStepJournal, setGuidedStepJournal,
    replayGoalAttempt, setReplayGoalAttempt,
    guidedStepJournalSeq
  };
}
