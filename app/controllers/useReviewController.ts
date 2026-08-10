"use client";

import { useState } from "react";
import type {
  EmergenceBenchmarkReport,
  RunCatalogEntry,
  RunJob,
  ScenarioPack,
  ScenarioPreset,
  ScenarioReport,
  ScenarioRun,
  ScenarioRunSummary,
  TownStateDiff,
  TownStateSnapshot
} from "@/lib/engine";

export type ScenarioPackView = ScenarioPack & {
  builtIn?: boolean;
  source?: string;
  experimentId?: string;
  experimentHash?: string;
  experimentPathHash?: string;
  validation?: { ok: boolean };
};

/** Owns read/review workflow state; it has no authority over case truth. */
export function useReviewController() {
  const [reviewBusy, setReviewBusy] = useState(false);
  const [scenarioPresets, setScenarioPresets] = useState<ScenarioPreset[]>([]);
  const [scenarioPacks, setScenarioPacks] = useState<ScenarioPackView[]>([]);
  const [scenarioRuns, setScenarioRuns] = useState<ScenarioRunSummary[]>([]);
  const [runCatalog, setRunCatalog] = useState<RunCatalogEntry[]>([]);
  const [runJobs, setRunJobs] = useState<RunJob[]>([]);
  const [selectedScenarioPackId, setSelectedScenarioPackId] = useState("");
  const [selectedRunCatalogId, setSelectedRunCatalogId] = useState("");
  const [selectedScenarioPresetId, setSelectedScenarioPresetId] = useState("");
  const [scenarioRun, setScenarioRun] = useState<ScenarioRun | null>(null);
  const [scenarioReport, setScenarioReport] = useState<ScenarioReport | null>(null);
  const [townSnapshots, setTownSnapshots] = useState<TownStateSnapshot[]>([]);
  const [selectedSnapshotFromId, setSelectedSnapshotFromId] = useState("");
  const [selectedSnapshotToId, setSelectedSnapshotToId] = useState("");
  const [reviewExportTarget, setReviewExportTarget] = useState({ fromId: "", toId: "" });
  const [snapshotDiff, setSnapshotDiff] = useState<TownStateDiff | null>(null);
  const [benchmarkSummary, setBenchmarkSummary] = useState<EmergenceBenchmarkReport | null>(null);

  return {
    reviewBusy, setReviewBusy,
    scenarioPresets, setScenarioPresets,
    scenarioPacks, setScenarioPacks,
    scenarioRuns, setScenarioRuns,
    runCatalog, setRunCatalog,
    runJobs, setRunJobs,
    selectedScenarioPackId, setSelectedScenarioPackId,
    selectedRunCatalogId, setSelectedRunCatalogId,
    selectedScenarioPresetId, setSelectedScenarioPresetId,
    scenarioRun, setScenarioRun,
    scenarioReport, setScenarioReport,
    townSnapshots, setTownSnapshots,
    selectedSnapshotFromId, setSelectedSnapshotFromId,
    selectedSnapshotToId, setSelectedSnapshotToId,
    reviewExportTarget, setReviewExportTarget,
    snapshotDiff, setSnapshotDiff,
    benchmarkSummary, setBenchmarkSummary
  };
}
