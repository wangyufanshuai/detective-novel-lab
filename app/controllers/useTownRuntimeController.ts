"use client";

import { useState } from "react";
import type {
  NpcActionCandidate,
  PersistentTownRuntime,
  TownCaseLifecycleState,
  TownEmergenceQueue,
  TownRuleSnapshotSummary,
  TownSituationBrief
} from "@/lib/engine";

/** Owns the single-writer Persistent Town client projection and its loading state. */
export function useTownRuntimeController() {
  const [townRuntime, setTownRuntime] = useState<PersistentTownRuntime | null>(null);
  const [townQueue, setTownQueue] = useState<TownEmergenceQueue | null>(null);
  const [townBrief, setTownBrief] = useState<TownSituationBrief | null>(null);
  const [selectedAgentCandidates, setSelectedAgentCandidates] = useState<NpcActionCandidate[]>([]);
  const [townRuntimeBusy, setTownRuntimeBusy] = useState(false);
  const [townRuleState, setTownRuleState] = useState<TownRuleSnapshotSummary | null>(null);
  const [townCaseLifecycle, setTownCaseLifecycle] = useState<TownCaseLifecycleState | null>(null);

  return {
    townRuntime, setTownRuntime,
    townQueue, setTownQueue,
    townBrief, setTownBrief,
    selectedAgentCandidates, setSelectedAgentCandidates,
    townRuntimeBusy, setTownRuntimeBusy,
    townRuleState, setTownRuleState,
    townCaseLifecycle, setTownCaseLifecycle
  };
}
