"use client";

import { useEffect } from "react";
import { downloadTextFile, getV1, postV1, slugifyLabel } from "@/app/lib/client-runtime";
import type { useInvestigationController } from "@/app/controllers/useInvestigationController";
import type { useTownRuntimeController } from "@/app/controllers/useTownRuntimeController";
import type { useReviewController } from "@/app/controllers/useReviewController";
import type { usePersistentTownLifecycle } from "@/app/hooks/usePersistentTownLifecycle";
import type {
  CaseFromLog,
  EmergenceBenchmarkReport,
  PersistentTownRuntime,
  PlayerSession,
  ReviewExportBundle,
  RunJob,
  ScenarioConfig,
  ScenarioPack,
  ScenarioPreset,
  ScenarioReport,
  ScenarioRun,
  ScenarioRunSummary,
  TownStateSnapshot,
  WorldEvent,
  WorldState
} from "@/lib/engine";

type ReviewWorkflowInput = {
  investigation: ReturnType<typeof useInvestigationController>;
  town: ReturnType<typeof useTownRuntimeController>;
  review: ReturnType<typeof useReviewController>;
  lifecycle: ReturnType<typeof usePersistentTownLifecycle>;
};

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Browser review/scenario orchestration only; it never participates in case judgement. */
export function useReviewWorkflowActions({ investigation, town, review, lifecycle }: ReviewWorkflowInput) {
  const {
    world, setWorld, setWorldIdInput, setEvents, setStatus, runtimeMode,
    selectedCharacterId, setTimeValue
  } = investigation;
  const {
    townRuntime, setTownRuntime, setTownQueue, setTownRuntimeBusy
  } = town;
  const {
    setReviewBusy, scenarioPresets, setScenarioPresets, scenarioPacks, scenarioRuns,
    setScenarioRuns, runCatalog, runJobs, setRunJobs, selectedScenarioPackId,
    selectedRunCatalogId, selectedScenarioPresetId, setSelectedScenarioPresetId,
    scenarioRun, setScenarioRun, setScenarioReport, setTownSnapshots,
    selectedSnapshotFromId, setSelectedSnapshotFromId, selectedSnapshotToId, setSelectedSnapshotToId, reviewExportTarget,
    setReviewExportTarget, setBenchmarkSummary
  } = review;
  const { selectScenarioRunFromRuntime, loadScenarioPacks, refreshTownRuntime } = lifecycle;

  function defaultTownScenarioConfig() {
    const actorId = selectedCharacterId || townRuntime?.agentStates[0]?.npcId || world?.npcs[0]?.id;
    return {
      name: "Default counterfactual scenario",
      seed: `${world?.seed || "town"}-scenario`,
      baselineSteps: 45,
      branches: actorId ? [{
        id: "selected-agent-resource",
        name: "Selected agent resource branch",
        steps: 12,
        interventions: [{ atTickOffset: 1, intervention: { actorId, kind: "resource" as const, value: "resource:scenario-ui" } }]
      }] : [],
      passCriteria: { minValidCandidates: 1, requireHardLogic: true, minEventGrowth: 1, minMemoryGrowth: 1, maxBlockedCandidates: 8 }
    } satisfies ScenarioConfig;
  }

  async function selectScenarioHistoryRun(runId: string) {
    if (!townRuntime) return;
    selectScenarioRunFromRuntime(townRuntime, runId, true);
    const run = townRuntime.scenarioRuns?.find((item) => item.id === runId);
    if (run) setStatus(`Loaded review run ${run.name}. Snapshot diff is now aligned to that run baseline.`);
  }

  async function saveScenarioPresetFromUi(preset: ScenarioPreset, overwrite: boolean) {
    if (!world) return;
    setReviewBusy(true);
    try {
      const data = await postV1<{ preset: ScenarioPreset; presets: ScenarioPreset[]; runs: ScenarioRunSummary[] }>("/api/v1/command/town/scenario/preset/save", { worldId: world.id, preset, overwrite });
      setScenarioPresets(data.presets);
      setScenarioRuns(data.runs);
      setSelectedScenarioPresetId(data.preset.id);
      setStatus(`Scenario preset ${data.preset.name} saved.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save scenario preset");
    } finally {
      setReviewBusy(false);
    }
  }

  async function deleteScenarioPresetFromUi(presetId: string) {
    if (!world) return;
    setReviewBusy(true);
    try {
      const data = await postV1<{ presets: ScenarioPreset[]; runs: ScenarioRunSummary[] }>("/api/v1/command/town/scenario/preset/delete", { worldId: world.id, presetId });
      setScenarioPresets(data.presets);
      setScenarioRuns(data.runs);
      setSelectedScenarioPresetId(data.presets[0]?.id || "");
      setStatus(`Scenario preset ${presetId} deleted.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete scenario preset");
    } finally {
      setReviewBusy(false);
    }
  }

  async function exportScenarioPackFromUi() {
    if (!world) return;
    setReviewBusy(true);
    try {
      const data = await postV1<{ pack: ScenarioPack; fileName: string }>("/api/v1/command/town/scenario-pack/export", {
        worldId: world.id,
        packId: selectedScenarioPackId || undefined,
        scenarioId: scenarioRun?.id
      });
      downloadTextFile(data.fileName, JSON.stringify(data.pack, null, 2), "application/json;charset=utf-8");
      setStatus(`ScenarioPack exported: ${data.pack.manifest.name}.`);
      await loadScenarioPacks(world.id).catch(() => undefined);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to export ScenarioPack");
    } finally {
      setReviewBusy(false);
    }
  }

  async function validateScenarioPackFromUi() {
    const pack = scenarioPacks.find((item) => item.manifest.id === selectedScenarioPackId) || scenarioPacks[0];
    if (!pack) return;
    setReviewBusy(true);
    try {
      const data = await postV1<{ validation: { ok: boolean; errors: string[]; warnings: string[] } }>("/api/v1/command/town/scenario-pack/validate", { pack });
      setStatus(data.validation.ok ? `ScenarioPack ${pack.manifest.id} is valid.` : `ScenarioPack ${pack.manifest.id} failed validation: ${data.validation.errors.join("; ")}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to validate ScenarioPack");
    } finally {
      setReviewBusy(false);
    }
  }

  async function exportReplayBundleFromUi() {
    if (!world) return;
    const runId = selectedRunCatalogId || runCatalog[0]?.runId;
    if (!runId) return;
    setReviewBusy(true);
    try {
      const data = await getV1<{ bundle: unknown; fileName: string }>(`/api/v1/query/town/runs/${encodeURIComponent(runId)}/replay-bundle?worldId=${encodeURIComponent(world.id)}`);
      downloadTextFile(data.fileName, JSON.stringify(data.bundle, null, 2), "application/json;charset=utf-8");
      setStatus(`Replay bundle exported for ${runId}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to export replay bundle");
    } finally {
      setReviewBusy(false);
    }
  }

  async function startRunJobFromUi(kind: "scenario" | "benchmark", seedCount?: 10 | 20) {
    if (!world) return;
    setReviewBusy(true);
    try {
      const data = kind === "scenario"
        ? await postV1<{ sourceWorldId: string; worldId: string; currentExperiment: unknown; job: RunJob }>("/api/v1/command/town/experiment/new-run", {
            worldId: world.id,
            scenarioPackId: selectedScenarioPackId || undefined,
            mapPackId: townRuntime?.currentMapPackId || undefined,
            ruleCatalogId: townRuntime?.currentRuleCatalogId || undefined
          })
        : await postV1<{ job: RunJob }>("/api/v1/command/town/run-job/start", { worldId: world.id, kind, scenarioId: scenarioRun?.id, seedCount });
      setRunJobs((current) => [data.job, ...current.filter((job) => job.id !== data.job.id)].slice(0, 20));
      setStatus(`${kind === "scenario" ? "experiment" : kind} job started: ${data.job.id}.`);
      const branchWorldId = kind === "scenario" ? (data as { worldId?: string }).worldId : undefined;
      if (branchWorldId && branchWorldId !== world.id) {
        const branchState = await getV1<{ world: WorldState; activeCase?: CaseFromLog | null; sessions?: PlayerSession[] }>(`/api/v1/query/world/state?worldId=${encodeURIComponent(branchWorldId)}`);
        setWorld(branchState.world);
        setWorldIdInput(branchState.world.id);
        setEvents([]);
        await refreshTownRuntime(branchState.world.id).catch(() => undefined);
      } else await refreshTownRuntime(world.id).catch(() => undefined);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `Failed to start ${kind} job`);
    } finally {
      setReviewBusy(false);
    }
  }

  async function cancelRunJobFromUi(jobId: string) {
    if (!world) return;
    setReviewBusy(true);
    try {
      const targetJob = runJobs.find((job) => job.id === jobId);
      const data = await postV1<{ job: RunJob }>("/api/v1/command/town/run-job/cancel", { worldId: targetJob?.worldId || world.id, jobId });
      setRunJobs((current) => current.map((job) => job.id === data.job.id ? data.job : job));
      setStatus(`Run job cancelled: ${jobId}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to cancel run job");
    } finally {
      setReviewBusy(false);
    }
  }

  useEffect(() => {
    if (!world || runtimeMode === "static-demo") return;
    const activeJob = runJobs.find((job) => job.status === "queued" || job.status === "running");
    if (!activeJob) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const jobWorldId = activeJob.worldId || world.id;
          const data = await postV1<{ job: RunJob }>("/api/v1/command/town/run-job/tick", { worldId: jobWorldId, jobId: activeJob.id });
          if (cancelled) return;
          setRunJobs((current) => [data.job, ...current.filter((job) => job.id !== data.job.id)].slice(0, 20));
          const result = data.job.result as { report?: EmergenceBenchmarkReport } | undefined;
          if (data.job.kind === "benchmark" && result?.report) setBenchmarkSummary(result.report);
          if (data.job.status === "completed") {
            setStatus(`${data.job.kind} job completed: ${data.job.runId || data.job.id}.`);
            await refreshTownRuntime(jobWorldId, selectedCharacterId, data.job.runId || data.job.resultRunId || scenarioRun?.id, true).catch(() => undefined);
          }
        } catch (error) {
          if (!cancelled) setStatus(error instanceof Error ? error.message : "Failed to advance run job");
        }
      })();
    }, 900);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [world, runtimeMode, runJobs, selectedCharacterId, scenarioRun?.id]);

  async function runEmergenceBenchmarkFromUi(seedCount: 10 | 20) {
    await startRunJobFromUi("benchmark", seedCount);
  }

  async function fetchReviewExport(format: "json" | "markdown") {
    if (!world || !scenarioRun) return null;
    const fromId = reviewExportTarget.fromId || selectedSnapshotFromId;
    const toId = reviewExportTarget.toId || selectedSnapshotToId;
    return getV1<{ format: "json" | "markdown"; fileName: string; content: string; bundle: ReviewExportBundle }>(
      `/api/v1/query/town/review/export?worldId=${encodeURIComponent(world.id)}&scenarioId=${encodeURIComponent(scenarioRun.id)}&from=${encodeURIComponent(fromId)}&to=${encodeURIComponent(toId)}&format=${format}&includeBenchmark=true`
    );
  }

  async function copyReviewBundleJson() {
    setReviewBusy(true);
    try {
      const data = await fetchReviewExport("json");
      if (!data) return;
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard is not available in this browser.");
      await navigator.clipboard.writeText(data.content);
      setStatus(`Review bundle JSON copied for ${scenarioRun?.name || "scenario"}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to copy review JSON");
    } finally { setReviewBusy(false); }
  }

  async function exportReviewBundleFile(format: "json" | "markdown") {
    setReviewBusy(true);
    try {
      const data = await fetchReviewExport(format);
      if (!data) return;
      downloadTextFile(data.fileName, data.content, format === "markdown" ? "text/markdown;charset=utf-8" : "application/json;charset=utf-8");
      setStatus(`${format === "markdown" ? "Markdown" : "Review bundle"} exported for ${scenarioRun?.name || "scenario"}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `Failed to export ${format}`);
    } finally { setReviewBusy(false); }
  }

  function markCurrentDiffAsReviewExportTarget() {
    if (!selectedSnapshotFromId || !selectedSnapshotToId) return;
    setReviewExportTarget({ fromId: selectedSnapshotFromId, toId: selectedSnapshotToId });
    setStatus(`Review export target set to ${selectedSnapshotFromId} -> ${selectedSnapshotToId}.`);
  }

  async function runDefaultTownScenario(config?: ScenarioConfig) {
    if (!world) return;
    if (runtimeMode === "static-demo") {
      setStatus("Scenario Runner uses SQLite server runtime. Switch to Server Runtime first.");
      return;
    }
    const normalizedConfig = config && typeof config === "object" && "nativeEvent" in config ? undefined : config;
    setTownRuntimeBusy(true);
    try {
      const presetConfig = normalizedConfig || scenarioPresets.find((preset) => preset.id === selectedScenarioPresetId)?.config || defaultTownScenarioConfig();
      const scenarioName = presetConfig.name || "Town counterfactual scenario";
      const scenarioId = `scenario-${slugifyLabel(scenarioName)}-${Date.now()}`;
      const data = await postV1<{ world: WorldState; runtime: PersistentTownRuntime; events: WorldEvent[]; run: ScenarioRun; report: ScenarioReport; snapshots: TownStateSnapshot[] }>("/api/v1/command/town/scenario/run", {
        worldId: world.id,
        config: { ...presetConfig, id: scenarioId, seed: presetConfig.seed || `${world.seed}-${slugifyLabel(scenarioName)}`, name: scenarioName }
      });
      setWorld(data.world);
      setTownRuntime(data.runtime);
      setTownQueue(null);
      setScenarioRun(data.run);
      setScenarioReport(data.report);
      setTownSnapshots(data.snapshots);
      setSelectedSnapshotFromId(data.report.baseline.startSnapshotId);
      setSelectedSnapshotToId(data.report.baseline.endSnapshotId);
      setReviewExportTarget({ fromId: data.report.baseline.startSnapshotId, toId: data.report.baseline.endSnapshotId });
      setEvents((items) => [...items, ...data.events.filter((event) => !items.some((existing) => existing.id === event.id))]);
      setStatus(`Scenario ${data.run.status}: ${data.report.summary}`);
      await refreshTownRuntime(data.world.id, selectedCharacterId, data.run.id, true);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to run scenario");
    } finally { setTownRuntimeBusy(false); }
  }

  async function rollbackTownSnapshot(snapshotId: string) {
    if (!world || !snapshotId) return;
    setTownRuntimeBusy(true);
    try {
      const data = await postV1<{ world: WorldState; runtime: PersistentTownRuntime; snapshot: TownStateSnapshot }>("/api/v1/command/town/snapshot/rollback", { worldId: world.id, snapshotId });
      setWorld(data.world);
      setTownRuntime(data.runtime);
      setTownSnapshots(data.runtime.snapshots || []);
      setTimeValue(timeToMinutes(data.runtime.currentTime));
      setStatus(`Rolled back runtime to ${data.snapshot.label} at tick ${data.snapshot.tick}.`);
      await refreshTownRuntime(data.world.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to roll back snapshot");
    } finally { setTownRuntimeBusy(false); }
  }

  return {
    selectScenarioHistoryRun,
    saveScenarioPresetFromUi,
    deleteScenarioPresetFromUi,
    exportScenarioPackFromUi,
    validateScenarioPackFromUi,
    exportReplayBundleFromUi,
    startRunJobFromUi,
    cancelRunJobFromUi,
    runEmergenceBenchmarkFromUi,
    copyReviewBundleJson,
    exportReviewBundleFile,
    markCurrentDiffAsReviewExportTarget,
    runDefaultTownScenario,
    rollbackTownSnapshot
  };
}
