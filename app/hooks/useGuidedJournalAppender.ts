"use client";

import { useCallback } from "react";
import type { useReplayController } from "@/app/controllers/useReplayController";
import type { GuidedStepJournalEntry } from "@/app/campaign/replay-practice-model";

/** Session-only, public-safe Journal aggregation shared by investigation and world-choice adapters. */
export function useGuidedJournalAppender(replay: ReturnType<typeof useReplayController>) {
  const { guidedStepJournalSeq, setGuidedStepJournal } = replay;
  return useCallback((entry: Omit<GuidedStepJournalEntry, "id">) => {
    guidedStepJournalSeq.current += 1;
    const id = `guided-step-${guidedStepJournalSeq.current}`;
    setGuidedStepJournal((current) => {
      const withImplicitJoin = entry.step !== "join" && !current.some((item) => item.step === "join")
        ? [{
            id: `${id}-join`,
            step: "join" as const,
            label: "Join investigation",
            status: "done" as const,
            result: "Investigation session opened.",
            progressDelta: "Player can now search scenes and question witnesses.",
            nextAction: "Search the first certified route clue."
          }, ...current]
        : current;
      const entryKey = entry.journalKey || entry.step;
      const existingIndex = withImplicitJoin.findIndex((item) => (item.journalKey || item.step) === entryKey);
      if (existingIndex >= 0) {
        const next = [...withImplicitJoin];
        next[existingIndex] = { ...entry, id: withImplicitJoin[existingIndex].id };
        return next;
      }
      return [...withImplicitJoin, { ...entry, id }];
    });
  }, [guidedStepJournalSeq, setGuidedStepJournal]);
}
