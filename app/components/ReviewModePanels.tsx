"use client";

import { useEffect, useMemo, useState } from "react";
import type { EmergenceBenchmarkReport, RunCatalogEntry, RunJob, RuntimeMode, ScenarioConfig, ScenarioPack, ScenarioPreset, ScenarioRunSummary, TownRuntimeIntervention } from "@/lib/engine";
import type { DatasetPackageExportReport, DatasetPackageListResult, DatasetPackageManifest, DatasetReaderDistributionItem, DatasetReaderIndex, PublicCaseSummaryIndex, PublicCaseSummaryIndexItem, PublicReviewCatalog, StaticDatasetReaderManifest } from "@/lib/dataset-package-types";
import type { PackageCatalogDetail, PackageCatalogEntry, PackageCatalogListResult } from "@/lib/package-catalog-types";
import type { ReplayCatalogListResult, ReplayCatalogRunDetail, ReplayCatalogSummary, ReplayDatasetRun } from "@/lib/replay-catalog-types";

type ScenarioPresetDraft = {
  name: string;
  description: string;
  seed: string;
  baselineSteps: number;
  branchName: string;
  branchSteps: number;
  actorId: string;
  interventionKind: TownRuntimeIntervention["kind"];
  interventionValue: string;
  atTickOffset: number;
  minValidCandidates: number;
  requireHardLogic: boolean;
  maxBlockedCandidates: number;
  minEventGrowth: number;
  minMemoryGrowth: number;
};

type BenchmarkFilter = "all" | "pass" | "fail";
type ReplayCatalogFilter = "all" | "scenario" | "benchmark" | "campaign" | "simulation-quality" | "experiment-matrix" | "catalog-expansion" | "ecosystem-ablation";
type ReplayCatalogStatusFilter = "all" | "completed" | "passed" | "failed" | "unknown";
type PackageStatusFilter = "all" | "valid" | "invalid";
type PublicCatalogView = "overview" | "datasets" | "content" | "boundary";
type DistributionExplorerView = "case" | "evidence" | "public-case" | "world" | "gate";
type DistributionSort = "count-desc" | "count-asc" | "name-asc" | "name-desc";
type PublicCaseSort = "ordinal-asc" | "tick-desc" | "warnings-desc" | "case-type-asc";

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "scenario";
}

type ScenarioPackPanelProps = {
  packs: Array<ScenarioPack & { builtIn?: boolean; source?: string; experimentId?: string; experimentHash?: string }>;
  selectedPackId?: string;
  onSelectPackId: (packId: string) => void;
  onExportPack: () => void;
  onValidatePack: () => void;
  busy?: boolean;
};

export function ScenarioPackPanel({
  packs,
  selectedPackId,
  onSelectPackId,
  onExportPack,
  onValidatePack,
  busy = false
}: ScenarioPackPanelProps) {
  const selected = packs.find((pack) => pack.manifest.id === selectedPackId) || packs[0] || null;
  return (
    <section className="scenarioPackPanel" data-testid="scenario-pack-panel">
      <div className="panelHeaderLine">
        <h3>ScenarioPack</h3>
        <span>{packs.length} packs</span>
      </div>
      <div className="reviewPresetToolbar">
        <label>
          Pack
          <select value={selected?.manifest.id || ""} onChange={(event) => onSelectPackId(event.target.value)}>
            {packs.map((pack) => (
              <option key={pack.manifest.id} value={pack.manifest.id}>
                {pack.manifest.name}{pack.source === "experiment-folder" ? " (experiment)" : pack.builtIn ? " (built-in)" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="reviewPresetSummary">
          <span>{selected?.manifest.description || "Portable scenario experiment package."}</span>
          <span>{selected ? `${selected.world.npcs.length} NPC / ${selected.world.locations.length} locations / ${selected.world.institutions.length} institutions` : "No pack selected"}</span>
        </div>
      </div>
      {selected && (
        <div className="reviewMetricGrid compact">
          <span><b>{selected.scenario.seed || selected.world.seed}</b>seed</span>
          <span><b>{selected.rules.enabledModules.length}</b>rule modules</span>
          <span><b>{selected.rules.longActionKinds.length}</b>long actions</span>
          <span><b>{selected.expectations.benchmarkPreset || "none"}</b>benchmark</span>
        </div>
      )}
      <div className="reviewActionRow">
        <button type="button" onClick={onExportPack} disabled={busy || !selected}>Export ScenarioPack</button>
        <button type="button" onClick={onValidatePack} disabled={busy || !selected}>Validate pack</button>
      </div>
    </section>
  );
}

export function CurrentExperimentPanel({
  scenarioPackId,
  mapPackId,
  ruleCatalogId,
  selectedScenarioPackId,
  experimentId,
  experimentHash,
  experimentPathHash,
  validationOk,
  qualityScore,
  onStartNewRun,
  busy = false
}: {
  scenarioPackId?: string;
  mapPackId?: string;
  ruleCatalogId?: string;
  selectedScenarioPackId?: string;
  experimentId?: string;
  experimentHash?: string;
  experimentPathHash?: string;
  validationOk?: boolean;
  qualityScore?: number;
  onStartNewRun: () => void;
  busy?: boolean;
}) {
  return (
    <section className="currentExperimentBar" data-testid="current-experiment-bar">
      <div>
        <strong>Current Experiment</strong>
        <span>ScenarioPack: {selectedScenarioPackId || scenarioPackId || "small-town-review"}</span>
        <span>MapPack: {mapPackId || "fog-lamp-town"}</span>
        <span>Rules: {ruleCatalogId || "detective-default"}</span>
        <span>Experiment: {experimentId || "built-in fallback"}</span>
        <span>Hash: {experimentHash || experimentPathHash || "n/a"}</span>
        <span>Validation: {typeof validationOk === "boolean" ? (validationOk ? "ok" : "failed") : "n/a"}</span>
        <span>Quality / Matrix: {typeof qualityScore === "number" ? qualityScore : "n/a"}</span>
      </div>
      <button type="button" onClick={onStartNewRun} disabled={busy}>
        New Run from Pack
      </button>
    </section>
  );
}

type RunCatalogPanelProps = {
  runs: RunCatalogEntry[];
  jobs: RunJob[];
  selectedRunId?: string;
  onSelectRunId: (runId: string) => void;
  onExportReplayBundle: () => void;
  onStartScenarioJob: () => void;
  onStartBenchmarkJob: () => void;
  onCancelJob: (jobId: string) => void;
  busy?: boolean;
};

export function RunCatalogPanel({
  runs,
  jobs,
  selectedRunId,
  onSelectRunId,
  onExportReplayBundle,
  onStartScenarioJob,
  onStartBenchmarkJob,
  onCancelJob,
  busy = false
}: RunCatalogPanelProps) {
  const selected = runs.find((run) => run.runId === selectedRunId) || runs[0] || null;
  return (
    <section className="runCatalogPanel" data-testid="run-catalog-panel">
      <div className="panelHeaderLine">
        <h3>Run Catalog</h3>
        <span>{runs.length} runs / {jobs.length} jobs</span>
      </div>
      {!!runs.length && (
        <div className="reviewHistoryList">
          {runs.slice(0, 6).map((run) => (
            <button key={run.runId} type="button" className={run.runId === selected?.runId ? "selected" : ""} onClick={() => onSelectRunId(run.runId)}>
              <strong>{run.scenarioId || run.runId}</strong>
              <span>{run.status}</span>
              <small>{run.seed || "live runtime"}</small>
              <div className="reviewHistoryMetrics">
                <span>{run.summary?.eventGrowth ?? 0} events</span>
                <span>{run.summary?.memoryGrowth ?? 0} memories</span>
                <span>{run.summary?.validCandidateCount ?? 0} valid</span>
                <span>{run.summary?.snapshotCount ?? 0} snapshots</span>
              </div>
            </button>
          ))}
        </div>
      )}
      {!!jobs.length && (
        <div className="reviewHistoryList compactJobs">
          {jobs.slice(0, 4).map((job) => {
            const cancellable = job.status === "queued" || job.status === "running" || job.status === "paused";
            return (
            <div key={job.id} className="reviewJobCard">
              <strong>{job.kind} job</strong>
              <span>{job.status}</span>
              <small>{job.progress.phase} / {job.progress.percent}%</small>
              {cancellable && (
                <button type="button" onClick={() => onCancelJob(job.id)} disabled={busy}>
                  Cancel job
                </button>
              )}
            </div>
            );
          })}
        </div>
      )}
      <div className="reviewActionRow">
        <button type="button" onClick={onExportReplayBundle} disabled={busy || !selected}>Export Replay Bundle</button>
        <button type="button" onClick={onStartScenarioJob} disabled={busy}>Start scenario job</button>
        <button type="button" onClick={onStartBenchmarkJob} disabled={busy}>Start benchmark job</button>
      </div>
    </section>
  );
}

type ReplayDatasetCatalogPanelProps = {
  selectedRunId?: string;
  onSelectRunId: (runId: string) => void;
  busy?: boolean;
};

type V1Result<T> = { ok: boolean; data?: T; error?: { code: string; message: string } };

async function fetchV1<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = (await response.json()) as V1Result<T>;
  if (!data.ok || !data.data) throw new Error(data.error?.message || "Request failed");
  return data.data;
}

function summarizeAudit(summary?: ReplayCatalogSummary | null) {
  if (!summary) return "not synced";
  return `${summary.auditErrorCount} errors / ${summary.auditWarningCount} warnings`;
}

function runLabel(run: ReplayDatasetRun) {
  return run.experimentId || run.deterministicRunHash || run.runId;
}

function metricText(value: unknown, fallback = "-") {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function distributionLine(items?: DatasetReaderDistributionItem[], limit = 3) {
  return items?.slice(0, limit).map((item) => `${item.id}:${item.count}`).join(" / ") || "n/a";
}

function distributionShare(count: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

function formatMsBand(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  return `${Math.round(value / 100) / 10}s`;
}

function sortDistribution(items: DatasetReaderDistributionItem[], sort: DistributionSort) {
  return [...items].sort((left, right) => {
    if (sort === "count-desc") return right.count - left.count || left.id.localeCompare(right.id);
    if (sort === "count-asc") return left.count - right.count || left.id.localeCompare(right.id);
    if (sort === "name-desc") return right.id.localeCompare(left.id) || right.count - left.count;
    return left.id.localeCompare(right.id) || right.count - left.count;
  });
}

function sortWorldPackages<T extends { packageId: string; name: string }>(items: T[], sort: DistributionSort) {
  return [...items].sort((left, right) => {
    const leftLabel = `${left.name} ${left.packageId}`;
    const rightLabel = `${right.name} ${right.packageId}`;
    if (sort === "name-desc") return rightLabel.localeCompare(leftLabel);
    return leftLabel.localeCompare(rightLabel);
  });
}

function sortPublicCases(items: PublicCaseSummaryIndexItem[], sort: PublicCaseSort) {
  return [...items].sort((left, right) => {
    if (sort === "tick-desc") return right.tick - left.tick || left.ordinal - right.ordinal;
    if (sort === "warnings-desc") return right.evidenceWarningCount - left.evidenceWarningCount || left.ordinal - right.ordinal;
    if (sort === "case-type-asc") return left.caseType.localeCompare(right.caseType) || left.ordinal - right.ordinal;
    return left.ordinal - right.ordinal;
  });
}

function packageLabel(entry: PackageCatalogEntry) {
  return entry.kind === "world-package" ? `${entry.name} / ${entry.packageId}` : `${entry.name} (experiment)`;
}

export function WorldPackageCatalogPanel({
  worldId,
  selectedScenarioPackId,
  onSelectPackId,
  busy = false
}: {
  worldId?: string;
  selectedScenarioPackId?: string;
  onSelectPackId: (packId: string) => void;
  busy?: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<PackageStatusFilter>("all");
  const [catalog, setCatalog] = useState<PackageCatalogListResult | null>(null);
  const [detail, setDetail] = useState<PackageCatalogDetail | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState("Package catalog not loaded.");
  const worldPackages = (catalog?.packages || []).filter((entry) => entry.kind === "world-package");
  const selected = worldPackages.find((entry) => entry.packageId === selectedPackageId)
    || worldPackages.find((entry) => entry.scenarioPackId === selectedScenarioPackId)
    || worldPackages[0]
    || null;

  async function loadCatalog() {
    const params = new URLSearchParams({ kind: "world-package", limit: "12" });
    if (statusFilter !== "all") params.set("status", statusFilter);
    const data = await fetchV1<PackageCatalogListResult>(`/api/v1/query/town/package-catalog?${params.toString()}`);
    setCatalog(data);
    setStatus(`Package catalog loaded: ${data.summary.validPackageCount} valid / ${data.summary.invalidPackageCount} invalid.`);
    return data;
  }

  useEffect(() => {
    let cancelled = false;
    loadCatalog()
      .then((data) => {
        if (!cancelled && !selectedPackageId) {
          const preferred = data.packages.find((entry) => entry.kind === "world-package" && entry.scenarioPackId === selectedScenarioPackId)
            || data.packages.find((entry) => entry.kind === "world-package");
          if (preferred) setSelectedPackageId(preferred.packageId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCatalog(null);
          setDetail(null);
          setStatus("Failed to load the package catalog safely. Retry the review request.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter, selectedScenarioPackId]);

  useEffect(() => {
    if (!selected?.packageId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    fetchV1<PackageCatalogDetail>(`/api/v1/query/town/package-catalog/${encodeURIComponent(selected.packageId)}`)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.packageId]);

  async function syncPackages() {
    setSyncing(true);
    try {
      const data = await fetchV1<{ summary: PackageCatalogListResult["summary"]; sync: { syncedPackageCount: number; validPackageCount: number; invalidPackageCount: number } }>(
        "/api/v1/command/town/package-catalog/sync",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      );
      setStatus(`Synced ${data.sync.syncedPackageCount} package(s): ${data.sync.validPackageCount} valid, ${data.sync.invalidPackageCount} invalid.`);
      await loadCatalog();
    } catch {
      setStatus("Failed to sync the package catalog safely. Retry the review request.");
    } finally {
      setSyncing(false);
    }
  }

  async function selectWorldPackage() {
    if (!worldId || !selected) return;
    try {
      const data = await fetchV1<{ currentExperiment: { scenarioPackId: string }; scenarioPacks?: Array<ScenarioPack & { source?: string }> }>(
        "/api/v1/command/town/world-pack/select",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ worldId, packageId: selected.packageId }) }
      );
      onSelectPackId(data.currentExperiment.scenarioPackId);
      setStatus(`Selected ${selected.packageId}. ScenarioPack ${data.currentExperiment.scenarioPackId} is now bound with its map/rules.`);
    } catch {
      setStatus("Failed to select the world package safely. The last confirmed selection remains active.");
    }
  }

  async function validateSelectedPackage() {
    if (!selected) return;
    setValidating(true);
    try {
      const data = await fetchV1<{ ok: boolean; errors: string[]; warnings: string[]; summary: Record<string, unknown> }>(
        "/api/v1/command/town/world-pack/validate",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packageId: selected.packageId }) }
      );
      setStatus(`Validated ${selected.packageId}: ${data.ok ? "ok" : "failed"}, ${data.errors.length} errors, ${data.warnings.length} warnings.`);
      await loadCatalog();
    } catch {
      setStatus("Failed to validate the world package safely. Retry the review request.");
    } finally {
      setValidating(false);
    }
  }

  async function exportSelectedPackage() {
    if (!selected) return;
    setExporting(true);
    try {
      const data = await fetchV1<{
        packageId: string;
        relativeExportPath: string;
        fileCount: number;
        bytes: number;
        validation: { ok: boolean; errors: string[]; warnings: string[] };
      }>(
        "/api/v1/command/town/world-pack/export",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packageId: selected.packageId, format: "folder" }) }
      );
      setStatus(`Exported ${data.packageId}: ${data.relativeExportPath} (${data.fileCount} files, ${data.validation.warnings.length} warnings).`);
    } catch {
      setStatus("Failed to export the world package safely. Retry the review request.");
    } finally {
      setExporting(false);
    }
  }

  const detailPackage = detail && detail.package ? detail.package : null;
  const selectedDetail = detailPackage?.packageId === selected?.packageId ? detailPackage : selected;
  const canSelect = Boolean(worldId && selected && selected.status === "valid");

  return (
    <section className="runCatalogPanel worldPackagePanel" data-testid="world-package-catalog">
      <div className="panelHeaderLine">
        <h3>World Packages</h3>
        <span>{catalog ? `${catalog.summary.validPackageCount} valid / ${catalog.summary.invalidPackageCount} invalid` : "not synced"}</span>
      </div>
      <div className="reviewMetricGrid compact">
        <span><b>{catalog?.summary.packageCount ?? 0}</b>packages</span>
        <span><b>{worldPackages.length}</b>world packs</span>
        <span><b>{catalog?.summary.lastSyncedAt ? "yes" : "no"}</b>SQLite sync</span>
        <span className={(catalog?.summary.invalidPackageCount || 0) === 0 ? "pass" : "fail"}><b>{catalog?.summary.invalidPackageCount ?? 0}</b>invalid</span>
      </div>
      <div className="reviewPresetToolbar">
        <label>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as PackageStatusFilter)}>
            <option value="all">all</option>
            <option value="valid">valid</option>
            <option value="invalid">invalid</option>
          </select>
        </label>
        <label>
          Package
          <select value={selected?.packageId || ""} onChange={(event) => setSelectedPackageId(event.target.value)}>
            {worldPackages.map((entry) => (
              <option key={entry.packageId} value={entry.packageId}>
                {entry.name}{entry.status === "invalid" ? " (invalid)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      {selectedDetail && (
        <div className="reviewStack" data-testid="world-package-detail">
          <div className="reviewMetricGrid compact">
            <span className={selectedDetail.status === "valid" ? "pass" : "fail"}><b>{selectedDetail.status}</b>status</span>
            <span><b>{selectedDetail.metrics.agentCount ?? 0}</b>agents</span>
            <span><b>{selectedDetail.metrics.factionCount ?? 0}</b>factions</span>
            <span><b>{selectedDetail.metrics.taskTemplateCount ?? 0}</b>tasks</span>
            <span><b>{selectedDetail.license || "n/a"}</b>license</span>
            <span><b>{selectedDetail.ecosystemCatalogId || "n/a"}</b>ecosystem</span>
          </div>
          <div className="reviewHistoryList compactJobs">
            <div className="reviewJobCard">
              <strong>{packageLabel(selectedDetail)}</strong>
              <span>{selectedDetail.relativePath}</span>
              <small>{selectedDetail.contentHash?.slice(0, 16) || "no hash"}</small>
            </div>
            <div className="reviewJobCard">
              <strong>Bound packs</strong>
              <span>{selectedDetail.scenarioPackId || "-"} / {selectedDetail.mapPackId || "-"} / {selectedDetail.ruleCatalogId || "-"}</span>
              <small>{selectedDetail.agentPackId || "no agent pack"} / {selectedDetail.ecosystemCatalogId || "no ecosystem"}</small>
            </div>
          </div>
          {selectedDetail.validation.errors.length > 0 && (
            <small>{selectedDetail.validation.errors.slice(0, 2).join("; ")}</small>
          )}
        </div>
      )}
      <div className="reviewActionRow">
        <button type="button" onClick={syncPackages} disabled={busy || syncing}>
          {syncing ? "Syncing..." : "Sync Package Catalog"}
        </button>
        <button type="button" onClick={validateSelectedPackage} disabled={busy || validating || !selected}>
          {validating ? "Validating..." : "Validate Package"}
        </button>
        <button type="button" onClick={exportSelectedPackage} disabled={busy || exporting || !selected || selected.status !== "valid"}>
          {exporting ? "Exporting..." : "Export Package"}
        </button>
        <button type="button" onClick={selectWorldPackage} disabled={busy || !canSelect}>
          Select World Package
        </button>
      </div>
      <small data-testid="world-package-status">{status}</small>
    </section>
  );
}

export function ReplayDatasetCatalogPanel({ selectedRunId, onSelectRunId, busy = false }: ReplayDatasetCatalogPanelProps) {
  const [kindFilter, setKindFilter] = useState<ReplayCatalogFilter>("all");
  const [statusFilter, setStatusFilter] = useState<ReplayCatalogStatusFilter>("all");
  const [catalog, setCatalog] = useState<ReplayCatalogListResult | null>(null);
  const [detail, setDetail] = useState<ReplayCatalogRunDetail | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState("Replay catalog not loaded.");
  const selected = catalog?.runs.find((run) => run.runId === selectedRunId) || catalog?.runs[0] || null;

  async function loadCatalog() {
    const params = new URLSearchParams({ limit: "12" });
    if (kindFilter !== "all") params.set("kind", kindFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const data = await fetchV1<ReplayCatalogListResult>(`/api/v1/query/town/replay-catalog?${params.toString()}`);
    setCatalog(data);
    setStatus(`Replay catalog loaded: ${data.total} indexed run(s), ${summarizeAudit(data.summary)}.`);
    return data;
  }

  useEffect(() => {
    let cancelled = false;
    loadCatalog()
      .then((data) => {
        if (!cancelled && !selectedRunId && data.runs[0]) onSelectRunId(data.runs[0].runId);
      })
      .catch(() => {
        if (!cancelled) {
          setCatalog(null);
          setDetail(null);
          setStatus("Failed to load the replay catalog safely. Retry the review request.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [kindFilter, statusFilter]);

  useEffect(() => {
    const runId = selectedRunId || selected?.runId;
    if (!runId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    fetchV1<ReplayCatalogRunDetail>(`/api/v1/query/town/replay-catalog/${encodeURIComponent(runId)}`)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.runId, selectedRunId]);

  async function syncCatalog() {
    setSyncing(true);
    try {
      const data = await fetchV1<{ audit: { errorCount: number; warningCount: number; secretLeakCount: number; hiddenTruthLeakCount: number }; sync: { syncedRunCount: number; syncedFileCount: number } }>(
        "/api/v1/command/town/replay-catalog/sync",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      );
      setStatus(`Synced ${data.sync.syncedRunCount} run(s) / ${data.sync.syncedFileCount} file(s). Audit: ${data.audit.errorCount} errors, ${data.audit.warningCount} warnings, ${data.audit.secretLeakCount} secret leaks, ${data.audit.hiddenTruthLeakCount} hidden-answer leaks.`);
      await loadCatalog();
    } catch {
      setStatus("Failed to sync the replay catalog safely. Retry the review request.");
    } finally {
      setSyncing(false);
    }
  }

  const activeDetail = detail?.run.runId === (selectedRunId || selected?.runId) ? detail : null;
  const auditOk = catalog?.summary ? catalog.summary.auditErrorCount === 0 && catalog.summary.secretLeakCount === 0 && catalog.summary.hiddenTruthLeakCount === 0 : false;

  return (
    <section className="runCatalogPanel replayDatasetPanel" data-testid="replay-dataset-catalog">
      <div className="panelHeaderLine">
        <h3>Replay Dataset</h3>
        <span>{catalog ? `${catalog.summary.runCount} runs / ${catalog.summary.indexedFileCount} files` : "not synced"}</span>
      </div>
      <div className="reviewMetricGrid compact">
        <span className={auditOk ? "pass" : "fail"}><b>{catalog ? (auditOk ? "ok" : "check") : "n/a"}</b>audit</span>
        <span><b>{catalog?.summary.auditErrorCount ?? 0}</b>errors</span>
        <span><b>{catalog?.summary.auditWarningCount ?? 0}</b>warnings</span>
        <span><b>{catalog?.summary.secretLeakCount ?? 0}</b>secret leaks</span>
        <span><b>{catalog?.summary.hiddenTruthLeakCount ?? 0}</b>hidden-answer</span>
        <span><b>{catalog?.summary.lastSyncedAt ? "yes" : "no"}</b>SQLite sync</span>
      </div>
      <div className="reviewPresetToolbar">
        <label>
          Kind
          <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as ReplayCatalogFilter)}>
            <option value="all">all</option>
            <option value="scenario">scenario</option>
            <option value="benchmark">benchmark</option>
            <option value="campaign">campaign</option>
            <option value="simulation-quality">simulation-quality</option>
            <option value="experiment-matrix">experiment-matrix</option>
            <option value="catalog-expansion">catalog-expansion</option>
            <option value="ecosystem-ablation">ecosystem-ablation</option>
          </select>
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ReplayCatalogStatusFilter)}>
            <option value="all">all</option>
            <option value="completed">completed</option>
            <option value="passed">passed</option>
            <option value="failed">failed</option>
            <option value="unknown">unknown</option>
          </select>
        </label>
      </div>
      <div className="reviewActionRow">
        <button type="button" onClick={syncCatalog} disabled={busy || syncing}>
          {syncing ? "Syncing..." : "Sync Replay Catalog"}
        </button>
      </div>
      {!!catalog?.runs.length && (
        <div className="reviewHistoryList">
          {catalog.runs.slice(0, 6).map((run) => (
            <button key={run.runId} type="button" className={run.runId === (selectedRunId || selected?.runId) ? "selected" : ""} onClick={() => onSelectRunId(run.runId)}>
              <strong>{runLabel(run)}</strong>
              <span>{run.kind} / {run.status}</span>
              <small>{run.runId}</small>
              <div className="reviewHistoryMetrics">
                <span>{run.tickCount ?? "-"} ticks</span>
                <span>{run.runId === activeDetail?.run.runId ? activeDetail.run.files.length : run.files.length} files</span>
                <span>{metricText(run.metrics?.caseCount ?? run.metrics?.uniqueCaseCount)} cases</span>
                <span>{run.qualityScore ?? "-"} score</span>
              </div>
            </button>
          ))}
        </div>
      )}
      {!catalog?.runs.length && <small>No replay runs are indexed in SQLite yet. Use Sync Replay Catalog.</small>}
      {activeDetail && (
        <div className="reviewStack" data-testid="replay-dataset-detail">
          <div className="reviewMetricGrid compact">
            <span><b>{activeDetail.run.files.length}</b>files</span>
            <span><b>{activeDetail.findings.filter((finding) => finding.severity === "error").length}</b>errors</span>
            <span><b>{activeDetail.findings.filter((finding) => finding.severity === "warning").length}</b>warnings</span>
            <span><b>{activeDetail.run.normalized ? "yes" : "no"}</b>normalized</span>
          </div>
          <div className="reviewHistoryList compactJobs">
            {activeDetail.run.files.slice(0, 4).map((file) => (
              <div key={file.path} className="reviewJobCard">
                <strong>{file.name}</strong>
                <span>{file.bytes} bytes</span>
                <small>{file.sha256.slice(0, 12)} / {file.path}</small>
              </div>
            ))}
          </div>
        </div>
      )}
      <small data-testid="replay-dataset-status">{status}</small>
    </section>
  );
}

export function PublicReviewCatalogPanel({ busy = false }: { busy?: boolean }) {
  const [catalog, setCatalog] = useState<PublicReviewCatalog | null>(null);
  const [view, setView] = useState<PublicCatalogView>("overview");
  const [status, setStatus] = useState("Public catalog not loaded.");

  useEffect(() => {
    let cancelled = false;
    fetch("/review-catalog/index.json")
      .then((response) => {
        if (!response.ok) throw new Error("Public review catalog not found. Run npm run public-catalog:build first.");
        return response.json() as Promise<PublicReviewCatalog>;
      })
      .then((data) => {
        if (!cancelled) {
          setCatalog(data);
          setStatus(`Public catalog loaded: ${data.summary.datasetCount} dataset(s).`);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCatalog(null);
          setStatus("Failed to load the public review catalog safely. Retry the review request.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const primary = catalog?.datasets[0] || null;
  const auditOk = primary?.audit
    ? primary.audit.ok && primary.audit.errorCount === 0 && primary.audit.secretLeakCount === 0 && primary.audit.hiddenTruthLeakCount === 0
    : false;
  const topCaseTypes = distributionLine(primary?.caseTypeDistribution);
  const topEvidenceTypes = distributionLine(primary?.evidenceTypeDistribution);
  const contentSummary = catalog?.contentSummary || null;
  const staticBoundaryOk = Boolean(catalog?.publicBoundary.staticOnly && catalog.publicBoundary.apiRoutesAllowed === false && catalog.publicBoundary.artifactBodiesIncluded === false);
  const gateStable = Boolean(primary?.gate.ok && auditOk && primary.readerIndexHash);
  const contentTableRows = contentSummary
    ? Object.entries(contentSummary.tableCounts).map(([name, count]) => ({ name, count }))
    : [];
  const storyCaseCount = primary?.readerSummary.caseCount ?? catalog?.summary.caseCount ?? 0;
  const storyCaseTypeCount = primary?.readerSummary.distinctCaseTypeCount ?? catalog?.summary.distinctCaseTypeCount ?? 0;
  const storyEvidenceNodeCount = primary?.readerSummary.evidenceGraph.evidenceNodeCount ?? catalog?.summary.evidenceNodeCount ?? 0;
  const stableWorld = catalog?.stableWorld || null;
  const worldSystemCards = [
    { label: "Roles", count: contentSummary?.roleCount ?? 0, detail: `${contentSummary?.coverage.rolesWithCases ?? 0} linked to case types` },
    { label: "Locations", count: contentSummary?.locationCount ?? 0, detail: "map anchors for public-safe case ecology" },
    { label: "Resources", count: contentSummary?.resourceCount ?? 0, detail: `${contentSummary?.coverage.resourcesWithRoles ?? 0} linked to roles` },
    { label: "Factions", count: contentSummary?.factionCount ?? 0, detail: `${contentSummary?.coverage.factionsWithResources ?? 0} linked to resources` },
    { label: "Events", count: contentSummary?.eventArchetypeCount ?? 0, detail: `${contentSummary?.coverage.eventArchetypesWithFactions ?? 0} linked to factions` },
    { label: "Growth Lines", count: contentSummary?.progressionLineCount ?? 0, detail: `${contentSummary?.coverage.progressionLinesWithEvents ?? 0} linked to events` }
  ];
  const stableWorldOk = Boolean(
    stableWorld?.gate.ok
      && stableWorld.diagnostics.blockerCount === 0
      && stableWorld.regression.blockedCount === 0
      && stableWorld.regression.regressedCount === 0
  );
  const stableWorldHashList = Object.values(stableWorld?.deterministicRunHashes || {})
    .map((hash) => hash.slice(0, 10))
    .join(" / ");
  const stableWorldSeedStatus = stableWorld && stableWorld.gate.passedSeedCount === stableWorld.seedCount ? "pass" : "check";
  const stableWorldSeedCards = stableWorld?.seeds.map((seed) => ({
    seed,
    status: stableWorldSeedStatus,
    hash: stableWorld.deterministicRunHashes[seed] || "pending"
  })) || [];
  const stableWorldRuntimeSpread = stableWorld
    ? Math.max(0, stableWorld.gate.maxRuntimeMs - stableWorld.gate.minRuntimeMs)
    : 0;
  const stableWorldDiagnosticsRows = ["ok", "watch", "risk", "blocker"].map((key) => ({
    key,
    count: stableWorld?.diagnostics.findingCounts[key] ?? 0
  }));
  const stableWorldRegressionRows = ["improved", "unchanged", "watch", "regressed", "blocked"].map((key) => ({
    key,
    count: stableWorld?.regression.deltaCounts[key] ?? 0
  }));
  const stableWorldHashRows = Object.entries(stableWorld?.deterministicRunHashes || {}).map(([seed, hash]) => ({
    seed,
    hash,
    shortHash: hash.slice(0, 14)
  }));
  const stableWorldUniqueHashCount = new Set(stableWorldHashRows.map((row) => row.hash)).size;
  const caseQuality = catalog?.caseQuality || null;
  const caseQualityOk = Boolean(caseQuality?.nonBlocking && caseQuality.averageScore >= 0 && caseQuality.minScore >= 0);
  const caseQualityDimensions = caseQuality?.dimensionAverages || {};
  const worldSystemInfluence = catalog?.worldSystemInfluence || null;
  const worldSystemInfluenceOk = Boolean(
    worldSystemInfluence
      && worldSystemInfluence.seedCount === 3
      && worldSystemInfluence.tickCount === 120
      && worldSystemInfluence.aggregate.appliedBiasCount > 0
      && worldSystemInfluence.aggregate.maxBias <= 4
      && Object.values(worldSystemInfluence.safety).every(Boolean)
  );
  const influenceHashList = worldSystemInfluence?.perSeed.map((seed) => seed.deterministicHash.slice(0, 10)).join(" / ") || "";
  const influenceActionDeltas = Object.entries(worldSystemInfluence?.aggregate.actionKindDelta || {})
    .filter(([, value]) => value !== 0)
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]) || left[0].localeCompare(right[0]))
    .slice(0, 4);
  const reviewerGatewayCards = [
    {
      label: "Pack",
      target: "dataset",
      metric: `${catalog?.summary.worldPackageCount ?? 0} packages`,
      question: "Is the public package trustworthy?",
      detail: "Dataset reader, world packages, content hash, and static release snapshot.",
      action: "Inspect package snapshot"
    },
    {
      label: "Replay",
      target: "stable-world",
      metric: `${stableWorld?.seedCount ?? 0} seeds`,
      question: "Can the world be replayed and checked?",
      detail: "Stable-world proof, deterministic hashes, diagnostics, and regression counts.",
      action: "Open replay proof"
    },
    {
      label: "Map",
      target: "content",
      metric: `${contentSummary?.worldSystemCount ?? 0} systems`,
      question: "Is the world wide enough to grow?",
      detail: "Roles, places, resources, factions, event archetypes, and growth lines.",
      action: "Review world systems"
    },
    {
      label: "Agent",
      target: "influence",
      metric: `${worldSystemInfluence?.aggregate.appliedBiasCount ?? 0} bias`,
      question: "Do world systems affect behavior?",
      detail: "Short on/off audit proves bounded hint influence without candidate loss.",
      action: "Check agent influence"
    }
  ];
  const publicDemoSteps = ["Pack", "Replay", "Map", "Agent", "Proof", "Boundary"];
  const reviewPathSteps = [
    { label: "Trust Snapshot", target: "overview", detail: "Gate, audit, static boundary, reader hash." },
    { label: "Stable World Proof", target: "stable-world", detail: "3 seed 1000 tick diagnostics and regression summary." },
    { label: "World-System Influence Proof", target: "influence", detail: "Short on/off audit proving bounded hint impact." },
    { label: "Dataset Reader", target: "dataset", detail: "5000 tick aggregate reader summary." },
    { label: "Public Case Explorer", target: "public-case", detail: "Spoiler-safe case summary cards." },
    { label: "Evidence Distribution", target: "evidence", detail: "Aggregate evidence and case-type slices." },
    { label: "Audit Boundary", target: "audit", detail: "Allowed fetches, leak scan, no raw bodies." }
  ];
  const catalogViews: Array<{ id: PublicCatalogView; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "datasets", label: "Datasets" },
    { id: "content", label: "Content" },
    { id: "boundary", label: "Boundary" }
  ];
  const proofStripCards = [
    {
      label: "Static Boundary",
      target: "audit",
      status: staticBoundaryOk ? "pass" : "fail",
      metric: staticBoundaryOk ? "zero /api/*" : "check",
      detail: "static-only"
    },
    {
      label: "Stable World",
      target: "stable-world",
      status: stableWorldOk ? "pass" : "fail",
      metric: stableWorldOk ? "all pass" : "check",
      detail: `${stableWorld?.seedCount ?? 0} seeds`
    },
    {
      label: "Case Quality",
      target: "case-quality",
      status: caseQualityOk ? "pass" : "fail",
      metric: caseQuality?.overallStatus || "pending",
      detail: `${caseQuality?.averageScore ?? 0} score`
    },
    {
      label: "World-System Influence",
      target: "influence",
      status: worldSystemInfluenceOk ? "pass" : "fail",
      metric: worldSystemInfluenceOk ? "proved" : "check",
      detail: `${worldSystemInfluence?.aggregate.appliedBiasCount ?? 0} bias`
    }
  ];
  function focusReviewerTarget(target: string) {
    if (target === "overview" || target === "stable-world" || target === "influence" || target === "case-quality") {
      setView("overview");
      if (target === "stable-world" || target === "influence" || target === "case-quality") {
        window.setTimeout(() => {
          const selector = target === "influence"
            ? "[data-testid='world-system-influence-proof']"
            : target === "case-quality"
              ? "[data-testid='case-quality-proof']"
              : "[data-testid='stable-world-proof']";
          document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 20);
      }
      return;
    }
    if (target === "content") {
      setView("content");
      window.setTimeout(() => {
        document.querySelector("[data-testid='public-review-snapshot-detail']")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 20);
      return;
    }
    if (target === "audit") setView("boundary");
    window.dispatchEvent(new CustomEvent("detective-reviewer-focus", { detail: { target } }));
    window.setTimeout(() => {
      document.querySelector("[data-testid='dataset-package-panel']")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 20);
  }

  return (
    <section className="runCatalogPanel publicCatalogPanel" data-testid="public-review-catalog">
      <div className="panelHeaderLine">
        <h3>Public Review Snapshot</h3>
        <span>{catalog ? `Public Demo Vertical Slice: ${catalog.summary.datasetCount} dataset(s)` : "not generated"}</span>
      </div>
      <div className="reviewerHome" data-testid="reviewer-home">
        <div className="reviewerHomeLead">
          <span>Reviewer Home</span>
          <h2>Reviewer Main Path</h2>
          <p>Start with Pack, Replay, Map, and Agent to judge whether the simulator is trustworthy, reproducible, expandable, and behaviorally influenced by world systems.</p>
        </div>
        <div className="reviewerHomeStats" aria-label="Static reviewer headline metrics">
          <span><b>{primary?.gate.tickCount ?? 5000}</b>tick dataset</span>
          <span><b>{storyCaseCount}</b>cases</span>
          <span><b>{storyCaseTypeCount}</b>case types</span>
          <span><b>{contentSummary?.worldSystemCount ?? 0}</b>world systems</span>
          <span><b>{contentSummary?.worldSystemRecordCount ?? 0}</b>system rows</span>
          <span><b>{storyEvidenceNodeCount}</b>evidence nodes</span>
          <span className={auditOk ? "pass" : "fail"}><b>{auditOk ? "clean" : "check"}</b>audit clean</span>
          <span className={staticBoundaryOk ? "pass" : "fail"}><b>{staticBoundaryOk ? "zero" : "check"}</b>/api/*</span>
          <span><b>{primary?.readerIndexHash.slice(0, 12) || "pending"}</b>reader hash</span>
          <span className={stableWorldOk ? "pass" : "fail"}><b>{stableWorld?.seedCount ?? 0}</b>seeds</span>
          <span><b>{stableWorld?.ticks ?? 0}</b>ticks each</span>
          <span className={caseQualityOk ? "pass" : "fail"}><b>{caseQuality?.averageScore ?? 0}</b>quality score</span>
          <span className={worldSystemInfluenceOk ? "pass" : "fail"}><b>{worldSystemInfluence?.aggregate.appliedBiasCount ?? 0}</b>hint bias</span>
        </div>
      </div>
      <div className="reviewerGateway" data-testid="reviewer-gateway" aria-label="Reviewer gateway">
        <div className="reviewerGatewayHeader">
          <div>
            <strong>Reviewer Main Path</strong>
            <span>Four decisions before drilling into proof details.</span>
          </div>
          <small>{staticBoundaryOk ? "static-only / zero /api/* / aggregate-only" : "boundary check required"}</small>
        </div>
        <div className="reviewerGatewayCards">
          {reviewerGatewayCards.map((card) => (
            <button key={card.label} type="button" onClick={() => focusReviewerTarget(card.target)}>
              <span>{card.label}</span>
              <strong>{card.metric}</strong>
              <em>{card.question}</em>
              <small>{card.detail}</small>
              <small className="nextStep">{card.action}</small>
            </button>
          ))}
        </div>
        <div className="reviewerGatewayProofs" data-testid="proof-strip" aria-label="Proof Strip">
          {proofStripCards.map((card) => (
            <button key={card.label} type="button" className={card.status} onClick={() => focusReviewerTarget(card.target)}>
              <b>{card.metric}</b>
              <span>{card.label}</span>
              <small>{card.detail}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="publicDemoSlice" data-testid="public-demo-vertical-slice">
        <div>
          <strong>Public Demo Vertical Slice</strong>
          <span>Pack, Replay, Map, and Agent reviewed through tracked static snapshots.</span>
        </div>
        <div className="publicDemoSteps" aria-label="Public demo review path">
          {publicDemoSteps.map((step) => (
            <span key={step}>{step}</span>
          ))}
        </div>
      </div>
      <div className="reviewerTrustStrip" data-testid="trust-snapshot">
        <span className={primary?.gate.ok ? "pass" : "fail"}><b>{primary?.gate.ok ? "ok" : "check"}</b>5000 gate</span>
        <span className={auditOk ? "pass" : "fail"}><b>{auditOk ? "clean" : "check"}</b>audit</span>
        <span className={staticBoundaryOk ? "pass" : "fail"}><b>{staticBoundaryOk ? "static-only" : "check"}</b>boundary</span>
        <span className={gateStable ? "pass" : "fail"}><b>{gateStable ? "stable" : "pending"}</b>artifact stability</span>
        <span className={stableWorldOk ? "pass" : "fail"}><b>{stableWorldOk ? "all pass" : "check"}</b>stable world</span>
        <span className={caseQualityOk ? "pass" : "fail"}><b>{caseQuality?.overallStatus || "pending"}</b>case quality</span>
        <span className={worldSystemInfluenceOk ? "pass" : "fail"}><b>{worldSystemInfluenceOk ? "bounded" : "check"}</b>hint influence</span>
        <span><b>{catalog?.summary.datasetCount ?? 0}</b>datasets</span>
        <span><b>{catalog?.summary.sourceRunCount ?? 0}</b>source runs</span>
      </div>
      <div className="proofDetailsHeader" data-testid="proof-details">
        <strong>Proof Details</strong>
        <span>Drill into the public-safe summaries behind the main path. These details contain aggregate counts and hashes only.</span>
      </div>
      <div className="stableWorldProof" data-testid="stable-world-proof">
        <div className="stableWorldProofLead">
          <span>Stable World Proof</span>
          <strong>{stableWorld?.seedCount ?? 0} seeds / {stableWorld?.ticks ?? 0} ticks each / {stableWorldOk ? "all pass" : "check"}</strong>
          <small>Public-safe 1000 tick stability summary derived from local diagnostics and regression artifacts.</small>
        </div>
        <div className="stableWorldProofMetrics" aria-label="Stable world proof metrics">
          <span><b>{stableWorld?.gate.worstCandidateRepeatRate ?? 0}%</b>repeat</span>
          <span><b>{stableWorld?.aggregate.actionKindCount ?? 0}</b>action kinds</span>
          <span><b>{stableWorld?.aggregate.institutionDecisionCount ?? 0}</b>institution decisions</span>
          <span><b>{stableWorld?.diagnostics.overallStatus || "pending"}</b>diagnostics</span>
          <span className={stableWorld?.diagnostics.blockerCount === 0 ? "pass" : "fail"}><b>{stableWorld?.diagnostics.blockerCount === 0 ? "no blockers" : "blockers"}</b>diagnostics</span>
          <span><b>{stableWorld?.regression.overallStatus || "pending"}</b>regression</span>
          <span className={stableWorld?.regression.blockedCount === 0 && stableWorld?.regression.regressedCount === 0 ? "pass" : "fail"}><b>{stableWorld?.regression.blockedCount === 0 && stableWorld?.regression.regressedCount === 0 ? "no blocked/regressed" : "check"}</b>regression</span>
          <span><b>{stableWorldHashList || "pending"}</b>deterministic hashes</span>
        </div>
        {stableWorld && (
          <div className="stableWorldDrilldown" data-testid="stable-world-drilldown">
            <div className="stableWorldDrilldownBlock seedPassCards">
              <strong>Per-seed Pass Cards</strong>
              <div>
                {stableWorldSeedCards.map((card) => (
                  <span key={card.seed} className={card.status === "pass" ? "pass" : "fail"}>
                    <b>{card.status}</b>
                    <small>{card.seed}</small>
                    <small>{stableWorld.ticks} ticks / {card.hash.slice(0, 14)}</small>
                  </span>
                ))}
              </div>
            </div>
            <div className="stableWorldDrilldownBlock">
              <strong>Runtime Band</strong>
              <div className="stableWorldBand">
                <span><b>{formatMsBand(stableWorld.gate.minRuntimeMs)}</b>min</span>
                <span><b>{formatMsBand(stableWorld.gate.maxRuntimeMs)}</b>max</span>
                <span><b>{formatMsBand(stableWorldRuntimeSpread)}</b>spread</span>
              </div>
              <small>Aggregate-only runtime range from the sanitized benchmark summary.</small>
            </div>
            <div className="stableWorldDrilldownBlock">
              <strong>Diagnostics Finding Counts</strong>
              <div className="stableWorldCountRows">
                {stableWorldDiagnosticsRows.map((row) => (
                  <span key={row.key} className={row.key === "risk" || row.key === "blocker" ? (row.count === 0 ? "pass" : "fail") : ""}>
                    <b>{row.count}</b>{row.key}
                  </span>
                ))}
              </div>
            </div>
            <div className="stableWorldDrilldownBlock">
              <strong>Regression Delta Counts</strong>
              <div className="stableWorldCountRows">
                {stableWorldRegressionRows.map((row) => (
                  <span key={row.key} className={row.key === "regressed" || row.key === "blocked" ? (row.count === 0 ? "pass" : "fail") : ""}>
                    <b>{row.count}</b>{row.key}
                  </span>
                ))}
              </div>
            </div>
            <div className="stableWorldDrilldownBlock stableWorldHashCompare">
              <strong>Deterministic Hash Comparison</strong>
              <div>
                {stableWorldHashRows.map((row) => (
                  <span key={row.seed}>
                    <b>{row.shortHash}</b>
                    <small>{row.seed}</small>
                  </span>
                ))}
              </div>
              <small>{stableWorldUniqueHashCount} unique deterministic hashes / public summary hash {catalog?.stableWorldSummaryHash?.slice(0, 16) || "pending"}</small>
            </div>
          </div>
        )}
      </div>
      {caseQuality && (
        <div className="stableWorldProof caseQualityProof" data-testid="case-quality-proof">
          <div className="stableWorldProofLead">
            <span>Case Quality Proof</span>
            <strong>{caseQuality.averageScore} average score / {caseQuality.minScore} lowest seed / {caseQuality.overallStatus}</strong>
            <small>Non-blocking public-safe quality summary derived from aggregate stable-world metrics only.</small>
          </div>
          <div className="stableWorldProofMetrics" aria-label="Case quality proof metrics">
            <span><b>{caseQuality.averageScore}</b>average score</span>
            <span><b>{caseQuality.minScore}</b>lowest seed score</span>
            <span><b>{caseQuality.overallStatus}</b>status</span>
            <span><b>{caseQualityDimensions["fair-play-evidence"] ?? 0}</b>fair-play evidence</span>
            <span><b>{caseQualityDimensions["case-diversity"] ?? 0}</b>diversity</span>
            <span><b>{caseQualityDimensions["cross-case-continuity"] ?? 0}</b>continuity</span>
            <span><b>{caseQualityDimensions["institution-relevance"] ?? 0}</b>institution</span>
            <span className="pass"><b>{caseQuality.nonBlocking ? "non-blocking" : "check"}</b>quality gate</span>
          </div>
        </div>
      )}
      {worldSystemInfluence && (
        <div className="stableWorldProof worldSystemInfluenceProof" data-testid="world-system-influence-proof">
          <div className="stableWorldProofLead">
            <span>World-System Influence Proof</span>
            <strong>{worldSystemInfluence.seedCount} seeds / {worldSystemInfluence.tickCount} ticks / {worldSystemInfluenceOk ? "bounded influence proved" : "check"}</strong>
            <small>Public-safe on/off audit summary proving table-derived hints affect action ordering without changing candidate legality.</small>
          </div>
          <div className="stableWorldProofMetrics" aria-label="World-system influence proof metrics">
            <span><b>{worldSystemInfluence.aggregate.appliedBiasCount}</b>applied bias</span>
            <span className={worldSystemInfluence.aggregate.maxBias <= 4 ? "pass" : "fail"}><b>{worldSystemInfluence.aggregate.maxBias}</b>max bias</span>
            <span><b>{worldSystemInfluence.aggregate.hintedActionShare}%</b>hinted action share</span>
            <span><b>{worldSystemInfluence.aggregate.institutionLabelCoverage}%</b>institution labels</span>
            <span><b>{worldSystemInfluence.aggregate.validCandidateTrendDelta}</b>valid candidate delta</span>
            <span className={worldSystemInfluence.safety.noLegalCandidateLoss ? "pass" : "fail"}><b>{worldSystemInfluence.safety.noLegalCandidateLoss ? "no candidate loss" : "check"}</b>candidate legality</span>
            <span className={worldSystemInfluence.safety.publicSafe ? "pass" : "fail"}><b>{worldSystemInfluence.safety.publicSafe ? "public-safe" : "check"}</b>boundary</span>
            <span><b>{influenceHashList || "pending"}</b>deterministic hashes</span>
          </div>
          <div className="stableWorldDrilldown" data-testid="world-system-influence-drilldown">
            <div className="stableWorldDrilldownBlock seedPassCards">
              <strong>Per-seed Influence Cards</strong>
              <div>
                {worldSystemInfluence.perSeed.map((seed) => (
                  <span key={seed.seed} className={seed.maxBias <= 4 && seed.appliedBiasCount > 0 ? "pass" : "fail"}>
                    <b>{seed.hintedActionShare}% hinted</b>
                    <small>{seed.seed}</small>
                    <small>{seed.appliedBiasCount} bias / max {seed.maxBias} / {seed.deterministicHash.slice(0, 14)}</small>
                  </span>
                ))}
              </div>
            </div>
            <div className="stableWorldDrilldownBlock">
              <strong>Action Kind Delta</strong>
              <div className="stableWorldCountRows">
                {(influenceActionDeltas.length ? influenceActionDeltas : [["unchanged", 0] as [string, number]]).map(([kind, delta]) => (
                  <span key={kind}>
                    <b>{delta > 0 ? `+${delta}` : delta}</b>{kind}
                  </span>
                ))}
              </div>
              <small>Aggregate action-kind delta only; no candidate list, NPC id, evidence id, or replay body.</small>
            </div>
            <div className="stableWorldDrilldownBlock">
              <strong>Safety Flags</strong>
              <div className="stableWorldCountRows">
                {Object.entries(worldSystemInfluence.safety).map(([key, value]) => (
                  <span key={key} className={value ? "pass" : "fail"}>
                    <b>{value ? "ok" : "check"}</b>{key}
                  </span>
                ))}
              </div>
              <small>Public summary hash {catalog?.worldSystemInfluenceSummaryHash?.slice(0, 16) || "pending"} / no runtime authority.</small>
            </div>
          </div>
        </div>
      )}
      <div className="reviewerPath" data-testid="review-path" aria-label="Static reviewer path">
        <div className="reviewerPathHeader">
          <strong>Review Path</strong>
          <span>Follow the public-safe review sequence before inspecting lower-priority engineering panels.</span>
        </div>
        {reviewPathSteps.map((step, index) => (
          <button key={step.label} type="button" onClick={() => focusReviewerTarget(step.target)}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{step.label}</strong>
            <small>{step.detail}</small>
          </button>
        ))}
      </div>
      <div className="reviewTabRow" role="tablist" aria-label="Public catalog sections">
        {catalogViews.map((item) => (
          <button key={item.id} type="button" className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {primary && (
        <div className="reviewStack" data-testid="public-review-snapshot-detail">
          {view === "overview" && (
            <div className="primaryEvidenceGrid" data-testid="primary-evidence">
              <div className="reviewJobCard">
                <strong>Public Catalog</strong>
                <span>{primary.datasetId}</span>
                <small>Catalog step / reader {primary.readerIndexHash.slice(0, 16)} / {primary.staticPath}</small>
              </div>
              <div className="reviewJobCard">
                <strong>Dataset</strong>
                <span>{primary.gate.tickCount} tick detective dataset / {storyCaseCount} cases / {storyCaseTypeCount} case types</span>
                <small>{primary.gate.laterCaseInfluenceRate}% later influence / {primary.gate.evidenceGraphWarnings} evidence warnings</small>
              </div>
              <div className="reviewJobCard">
                <strong>Case Summary</strong>
                <span>{primary.readerSummary.solvedCaseCount} solved / {primary.readerSummary.failedCaseCount} failed / {primary.readerSummary.caseGraph.influencedLaterCaseCount} later-influenced</span>
                <small>{topCaseTypes}</small>
              </div>
              <div className="reviewJobCard">
                <strong>Evidence Distribution</strong>
                <span>{storyEvidenceNodeCount} evidence nodes / {primary.readerSummary.evidenceGraph.completenessRate}% complete</span>
                <small>{topEvidenceTypes}</small>
              </div>
              {contentSummary && (
                <div className="reviewJobCard">
                  <strong>World Systems</strong>
                  <span>{contentSummary.worldSystemCount ?? 0} systems / {contentSummary.worldSystemRecordCount ?? 0} aggregate rows</span>
                  <small>roles, locations, resources, factions, events, growth lines / {contentSummary.validation.ok ? "coverage ok" : "coverage check"}</small>
                </div>
              )}
              {stableWorld && (
                <div className="reviewJobCard">
                  <strong>Stable World Proof</strong>
                  <span>{stableWorld.seedCount} seeds / {stableWorld.ticks} ticks / {stableWorld.gate.passedSeedCount} pass</span>
                  <small>{stableWorld.aggregate.repeatRate}% repeat / {stableWorld.aggregate.actionKindCount} action kinds / diagnostics {stableWorld.diagnostics.overallStatus} / regression {stableWorld.regression.overallStatus}</small>
                </div>
              )}
              {caseQuality && (
                <div className="reviewJobCard">
                  <strong>Case Quality Proof</strong>
                  <span>{caseQuality.averageScore} average score / {caseQuality.minScore} lowest seed / {caseQuality.overallStatus}</span>
                  <small>fair-play {caseQualityDimensions["fair-play-evidence"] ?? 0} / diversity {caseQualityDimensions["case-diversity"] ?? 0} / continuity {caseQualityDimensions["cross-case-continuity"] ?? 0} / non-blocking</small>
                </div>
              )}
              {worldSystemInfluence && (
                <div className="reviewJobCard">
                  <strong>World-System Influence Proof</strong>
                  <span>{worldSystemInfluence.aggregate.appliedBiasCount} applied bias / max {worldSystemInfluence.aggregate.maxBias} / {worldSystemInfluence.aggregate.hintedActionShare}% hinted actions</span>
                  <small>{worldSystemInfluence.safety.noLegalCandidateLoss ? "no candidate loss" : "candidate check"} / {worldSystemInfluence.aggregate.institutionLabelCoverage}% institution labels / public-safe short audit</small>
                </div>
              )}
              <div className="reviewJobCard">
                <strong>Explore aggregates</strong>
                <span>Open Public Dataset Explorer for case types, evidence types, world packages, and gate/audit slices.</span>
                <small>aggregate-only / no raw case body / no spoiler fields</small>
              </div>
              <div className="reviewJobCard">
                <strong>Audit Status</strong>
                <span>{auditOk ? "audit clean" : "audit check"} / {primary.audit.errorCount} errors / {primary.audit.hiddenTruthLeakCount} hidden-answer leaks</span>
                <small>{primary.audit.warningCount} legacy warnings / {primary.audit.secretLeakCount} secret leaks</small>
              </div>
              <div className="reviewJobCard">
                <strong>Static Boundary</strong>
                <span>{staticBoundaryOk ? "zero /api/* / no artifact bodies" : "boundary check required"}</span>
                <small>{catalog?.publicBoundary.allowedFetchPrefixes.join(" ")}</small>
              </div>
            </div>
          )}
          {view === "datasets" && (
            <div className="reviewHistoryList compactJobs">
              {catalog?.datasets.map((dataset) => (
                <div key={dataset.datasetId} className="reviewJobCard">
                  <strong>{dataset.datasetId}</strong>
                  <span>{dataset.sourceRunId}</span>
                  <small>{dataset.readerIndexHash.slice(0, 16)} / {dataset.readerSummary.caseCount} cases / {dataset.readerSummary.evidenceGraph.evidenceNodeCount} evidence nodes</small>
                </div>
              ))}
              <div className="reviewJobCard">
                <strong>Dataset Reader paths</strong>
                <span>{primary.manifestPath}</span>
                <small>{primary.readerIndexPath} / {primary.datasetCardPath}</small>
              </div>
            </div>
          )}
          {view === "content" && (
            <div className="reviewStack">
              <div className="reviewMetricGrid compact">
                <span><b>{contentSummary?.worldSystemCount ?? 0}</b>world systems</span>
                <span><b>{contentSummary?.worldSystemRecordCount ?? 0}</b>system rows</span>
                <span><b>{contentSummary?.caseTypeCount ?? 0}</b>case types</span>
                <span><b>{contentSummary?.evidenceTypeCount ?? 0}</b>evidence types</span>
                <span><b>{contentSummary?.locationCount ?? 0}</b>locations</span>
                <span><b>{contentSummary?.roleCount ?? 0}</b>roles</span>
                <span><b>{contentSummary?.resourceCount ?? 0}</b>resources</span>
                <span><b>{contentSummary?.factionCount ?? 0}</b>factions</span>
                <span><b>{contentSummary?.eventArchetypeCount ?? 0}</b>events</span>
                <span><b>{contentSummary?.progressionLineCount ?? 0}</b>growth lines</span>
                <span className={contentSummary?.validation.ok ? "pass" : "fail"}><b>{contentSummary?.validation.ok ? "ok" : "check"}</b>validation</span>
              </div>
              <div className="worldSystemOverview" data-testid="world-system-overview">
                {worldSystemCards.map((card) => (
                  <div key={card.label} className="reviewJobCard">
                    <strong>{card.label}</strong>
                    <span>{card.count} aggregate rows</span>
                    <small>{card.detail}</small>
                  </div>
                ))}
              </div>
              <div className="reviewHistoryList compactJobs">
                <div className="reviewJobCard">
                  <strong>Content Tables</strong>
                  <span>{contentSummary?.packId || "detective content"} / {contentSummary?.schemaVersion || "n/a"}</span>
                  <small>{contentSummary ? `${contentSummary.validation.errorCount} errors / ${contentSummary.validation.warningCount} warnings / aggregate-only table summary` : "content summary not published"}</small>
                </div>
                {contentTableRows.map((row) => (
                  <div key={row.name} className="reviewJobCard">
                    <strong>{row.name}</strong>
                    <span>{row.count} records</span>
                    <small>aggregate count only / no source table body</small>
                  </div>
                ))}
              </div>
            </div>
          )}
          {view === "boundary" && (
            <div className="reviewHistoryList compactJobs">
              <div className="reviewJobCard">
                <strong>Static Boundary</strong>
                <span>{staticBoundaryOk ? "static review only / zero /api/*" : "boundary check required"}</span>
                <small>{catalog?.publicBoundary.allowedFetchPrefixes.join(" ")}</small>
              </div>
              <div className="reviewJobCard">
                <strong>Tracked public release snapshots</strong>
                <span>/review-catalog/index.json / /dataset-reader/*</span>
                <small>not runtime authority / no replay bodies / no package source bodies</small>
              </div>
              <div className="reviewJobCard">
                <strong>Audit Status</strong>
                <span>{auditOk ? "clean" : "check"} / {primary.audit.errorCount} errors / {primary.audit.secretLeakCount} secret leaks / {primary.audit.hiddenTruthLeakCount} hidden-answer leaks</span>
                <small>{gateStable ? "reader hash and 5000 gate present" : "hash or gate missing"}</small>
              </div>
            </div>
          )}
        </div>
      )}
      <small data-testid="public-review-catalog-status">{busy ? "Review busy." : status}</small>
    </section>
  );
}

export function DatasetPackagePanel({ busy = false, runtimeMode = "server" }: { busy?: boolean; runtimeMode?: RuntimeMode }) {
  const [catalog, setCatalog] = useState<DatasetPackageListResult | null>(null);
  const [detail, setDetail] = useState<DatasetPackageManifest | null>(null);
  const [staticReader, setStaticReader] = useState<{ manifest: StaticDatasetReaderManifest; readerIndex: DatasetReaderIndex; caseSummaryIndex: PublicCaseSummaryIndex } | null>(null);
  const [distributionView, setDistributionView] = useState<DistributionExplorerView>(runtimeMode === "static-demo" ? "public-case" : "case");
  const [distributionSearch, setDistributionSearch] = useState("");
  const [distributionSort, setDistributionSort] = useState<DistributionSort>("count-desc");
  const [publicCaseSort, setPublicCaseSort] = useState<PublicCaseSort>("ordinal-asc");
  const [publicCaseTypeFilter, setPublicCaseTypeFilter] = useState("all");
  const [publicCaseLocationFilter, setPublicCaseLocationFilter] = useState("all");
  const [publicCaseWarningFilter, setPublicCaseWarningFilter] = useState("all");
  const [selectedBucketId, setSelectedBucketId] = useState("");
  const [selectedPublicCaseId, setSelectedPublicCaseId] = useState("");
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState("Dataset packages not loaded.");
  const isStaticReader = runtimeMode === "static-demo";
  const selected = detail || catalog?.packages[0] || null;
  const staticDatasetId = "detective-town-v3-5000-campaign";

  async function loadPackages() {
    if (isStaticReader) {
      const base = `/dataset-reader/${staticDatasetId}`;
      const [manifestResponse, readerResponse, caseSummaryResponse] = await Promise.all([
        fetch(`${base}/manifest-lite.json`),
        fetch(`${base}/reader-index.json`),
        fetch(`${base}/case-summary-index.json`)
      ]);
      if (!manifestResponse.ok) throw new Error("Static dataset reader manifest not found. Run npm run dataset:static-reader first.");
      if (!readerResponse.ok) throw new Error("Static dataset reader index not found. Run npm run dataset:static-reader first.");
      if (!caseSummaryResponse.ok) throw new Error("Static public case summary index not found. Run npm run dataset:static-reader first.");
      const manifest = await manifestResponse.json() as StaticDatasetReaderManifest;
      const readerIndex = await readerResponse.json() as DatasetReaderIndex;
      const caseSummaryIndex = await caseSummaryResponse.json() as PublicCaseSummaryIndex;
      setCatalog(null);
      setDetail(null);
      setStaticReader({ manifest, readerIndex, caseSummaryIndex });
      setStatus(`Static dataset reader loaded: ${manifest.datasetId}.`);
      return null;
    }
    const data = await fetchV1<DatasetPackageListResult>("/api/v1/query/town/dataset-packages");
    setCatalog(data);
    const first = data.packages[0] || null;
    setDetail(first);
    setStaticReader(null);
    setStatus(`Dataset packages loaded: ${data.summary.packageCount} package(s), ${data.summary.validPackageCount} valid.`);
    return data;
  }

  useEffect(() => {
    let cancelled = false;
    loadPackages().catch(() => {
      if (!cancelled) {
        setCatalog(null);
        setDetail(null);
        setStatus("Failed to load dataset packages safely. Retry the review request.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isStaticReader]);

  useEffect(() => {
    if (!isStaticReader) return;
    function handleReviewerFocus(event: Event) {
      const target = (event as CustomEvent<{ target?: string }>).detail?.target;
      if (target === "public-case") setDistributionView("public-case");
      if (target === "evidence") setDistributionView("evidence");
      if (target === "audit") setDistributionView("gate");
      if (target === "dataset") setDistributionView("public-case");
      window.setTimeout(() => {
        document.querySelector("[data-testid='dataset-package-panel']")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 20);
    }
    window.addEventListener("detective-reviewer-focus", handleReviewerFocus);
    return () => window.removeEventListener("detective-reviewer-focus", handleReviewerFocus);
  }, [isStaticReader]);

  async function exportDataset() {
    if (isStaticReader) return;
    setExporting(true);
    try {
      const data = await fetchV1<DatasetPackageExportReport>(
        "/api/v1/command/town/dataset-package/export",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId: "campaign-campaign-validation-5000", datasetId: "detective-town-v3-5000-campaign" })
        }
      );
      setStatus(`Exported ${data.datasetId}: ${data.relativeExportPath} (${data.fileCount} files, ${data.bytes} bytes).`);
      await loadPackages();
    } catch {
      setStatus("Failed to export the dataset package safely. Retry the review request.");
    } finally {
      setExporting(false);
    }
  }

  const gate = isStaticReader ? staticReader?.manifest.gate : selected?.gate;
  const audit = isStaticReader ? staticReader?.manifest.audit : selected?.audit;
  const auditOk = audit ? audit.ok && audit.errorCount === 0 && audit.secretLeakCount === 0 && audit.hiddenTruthLeakCount === 0 : false;
  const reader = isStaticReader ? staticReader?.readerIndex.summary : selected?.readerSummary;
  const caseDistribution = isStaticReader ? staticReader?.readerIndex.caseTypeDistribution || [] : reader?.topCaseTypes || [];
  const evidenceDistribution = isStaticReader ? staticReader?.readerIndex.evidenceTypeDistribution || [] : reader?.topEvidenceTypes || [];
  const worldPackageSummaries = isStaticReader ? staticReader?.readerIndex.worldPackages || [] : selected?.worldPackages || [];
  const topCaseTypes = distributionLine(caseDistribution);
  const topEvidenceTypes = distributionLine(evidenceDistribution);
  const packageCountLabel = isStaticReader
    ? (staticReader ? "static reader" : "not generated")
    : (catalog ? `${catalog.summary.packageCount} package(s)` : "not exported");
  const datasetId = isStaticReader ? staticReader?.manifest.datasetId : selected?.datasetId;
  const sourceRunId = isStaticReader ? staticReader?.manifest.sourceRunId : selected?.sourceRunId;
  const contentHash = isStaticReader ? staticReader?.manifest.contentHash : selected?.contentHash;
  const generatedAt = isStaticReader ? staticReader?.manifest.generatedAt : selected?.generatedAt;
  const fileCount = isStaticReader ? staticReader?.manifest.fileCount : selected?.fileCount;
  const bytes = isStaticReader ? staticReader?.manifest.bytes : selected?.bytes;
  const worldPackageCount = isStaticReader ? staticReader?.readerIndex.worldPackages.length : selected?.worldPackages.length;
  const readerHash = isStaticReader ? staticReader?.manifest.readerIndexHash : selected?.readerIndexHash;
  const caseSummaryHash = isStaticReader ? staticReader?.manifest.caseSummaryIndexHash : undefined;
  const publicCases = isStaticReader ? staticReader?.caseSummaryIndex.cases || [] : [];
  const publicCaseSummary = isStaticReader ? staticReader?.caseSummaryIndex.summary : undefined;
  const hasDataset = isStaticReader ? Boolean(staticReader) : Boolean(selected);
  const explorerTabs: Array<{ id: DistributionExplorerView; label: string }> = [
    { id: "case", label: "Case Types" },
    { id: "evidence", label: "Evidence Types" },
    { id: "public-case", label: "Public Case Explorer" },
    { id: "world", label: "World Packages" },
    { id: "gate", label: "Gate & Audit" }
  ];
  const rawSelectedDistribution = distributionView === "evidence" ? evidenceDistribution : caseDistribution;
  const selectedDistributionTotal = rawSelectedDistribution.reduce((total, item) => total + item.count, 0);
  const normalizedDistributionSearch = distributionSearch.trim().toLowerCase();
  const selectedDistribution = useMemo(() => {
    if (distributionView !== "case" && distributionView !== "evidence") return [];
    const filtered = normalizedDistributionSearch
      ? rawSelectedDistribution.filter((item) => item.id.toLowerCase().includes(normalizedDistributionSearch))
      : rawSelectedDistribution;
    return sortDistribution(filtered, distributionSort);
  }, [distributionView, rawSelectedDistribution, normalizedDistributionSearch, distributionSort]);
  const filteredWorldPackages = useMemo(() => {
    const filtered = normalizedDistributionSearch
      ? worldPackageSummaries.filter((pack) => `${pack.name} ${pack.packageId}`.toLowerCase().includes(normalizedDistributionSearch))
      : worldPackageSummaries;
    return sortWorldPackages(filtered, distributionSort);
  }, [worldPackageSummaries, normalizedDistributionSearch, distributionSort]);
  const publicCaseTypes = useMemo(() => [...new Set(publicCases.map((item) => item.caseType))].sort((left, right) => left.localeCompare(right)), [publicCases]);
  const publicCaseLocations = useMemo(() => [...new Set(publicCases.map((item) => item.locationId))].sort((left, right) => left.localeCompare(right)), [publicCases]);
  const filteredPublicCases = useMemo(() => {
    const filtered = publicCases.filter((item) => {
      const searchable = `${item.publicCaseId} ${item.caseType} ${item.locationId} ${item.outcome}`.toLowerCase();
      if (normalizedDistributionSearch && !searchable.includes(normalizedDistributionSearch)) return false;
      if (publicCaseTypeFilter !== "all" && item.caseType !== publicCaseTypeFilter) return false;
      if (publicCaseLocationFilter !== "all" && item.locationId !== publicCaseLocationFilter) return false;
      if (publicCaseWarningFilter === "clean" && item.evidenceWarningCount > 0) return false;
      if (publicCaseWarningFilter === "warnings" && item.evidenceWarningCount === 0) return false;
      return true;
    });
    return sortPublicCases(filtered, publicCaseSort);
  }, [publicCases, normalizedDistributionSearch, publicCaseTypeFilter, publicCaseLocationFilter, publicCaseWarningFilter, publicCaseSort]);
  const selectedDistributionBucket = selectedDistribution.find((item) => item.id === selectedBucketId) || selectedDistribution[0] || null;
  const selectedWorldPackage = filteredWorldPackages.find((pack) => pack.packageId === selectedBucketId) || filteredWorldPackages[0] || null;
  const selectedPublicCase = filteredPublicCases.find((item) => item.publicCaseId === selectedPublicCaseId) || filteredPublicCases[0] || null;
  const selectedBucketLabel = distributionView === "world"
    ? selectedWorldPackage?.packageId
    : distributionView === "public-case"
      ? selectedPublicCase?.publicCaseId
    : selectedDistributionBucket?.id;
  const selectedBucketCount = selectedDistributionBucket?.count ?? 0;
  const selectedBucketShare = selectedDistributionBucket ? distributionShare(selectedDistributionBucket.count, selectedDistributionTotal) : "0%";
  const selectedBucketSource = datasetId || staticDatasetId;
  const selectedBucketBoundary = isStaticReader ? "static-only boundary / zero /api/*" : "server package summary";
  const selectedDistributionVisibleTotal = selectedDistribution.reduce((total, item) => total + item.count, 0);
  const explorerTitle = distributionView === "evidence" ? "Evidence type distribution" : "Case type distribution";

  return (
    <section className="runCatalogPanel datasetPackagePanel" data-testid="dataset-package-panel">
      <div className="panelHeaderLine">
        <h3>{isStaticReader ? "Dataset Reader" : "Dataset Package"}</h3>
        <span>{packageCountLabel}</span>
      </div>
      <div className="reviewMetricGrid compact">
        <span className={gate?.ok ? "pass" : "fail"}><b>{gate?.ok ? "ok" : "n/a"}</b>5000 gate</span>
        <span><b>{gate?.uniqueCases ?? 0}</b>cases</span>
        <span><b>{gate?.distinctCaseTypeCount ?? 0}</b>types</span>
        <span><b>{gate?.candidateRepeatRate ?? 0}%</b>repeat</span>
        <span><b>{gate?.laterCaseInfluenceRate ?? 0}%</b>later influence</span>
        <span className={auditOk ? "pass" : "fail"}><b>{auditOk ? "ok" : "check"}</b>audit</span>
      </div>
      {hasDataset && (
        <div className="reviewStack" data-testid="dataset-package-detail">
          <div className="reviewHistoryList compactJobs">
            <div className="reviewJobCard">
              <strong>{datasetId}</strong>
              <span>{sourceRunId}</span>
              <small>{contentHash?.slice(0, 16) || "no hash"} / {generatedAt || "not generated"}</small>
            </div>
            <div className="reviewJobCard">
              <strong>Files</strong>
              <span>{fileCount ?? 0} files / {bytes ?? 0} bytes</span>
              <small>{worldPackageCount ?? 0} world packages summarized / reader {readerHash?.slice(0, 12) || "not indexed"} / case index {caseSummaryHash?.slice(0, 12) || "not indexed"}</small>
            </div>
            <div className="reviewJobCard">
              <strong>Case Summary</strong>
              <span>{reader ? `${reader.caseCount} cases / ${reader.distinctCaseTypeCount} case types / ${reader.distinctEvidenceTypeCount} evidence types` : "reader index not exported"}</span>
              <small>{reader ? `Reader Summary / solved ${reader.solvedCaseCount} / failed ${reader.failedCaseCount} / public case summaries ${publicCaseSummary?.caseCount ?? 0}` : "run Export Dataset to refresh"}</small>
            </div>
            <div className="reviewJobCard">
              <strong>Evidence Distribution</strong>
              <span>{topCaseTypes}</span>
              <small>{topEvidenceTypes}</small>
            </div>
            <div className="reviewJobCard">
              <strong>Audit Status</strong>
              <span>{auditOk ? "audit clean" : "audit check"} / {audit?.errorCount ?? 0} errors / {audit?.hiddenTruthLeakCount ?? 0} hidden-answer leaks</span>
              <small>{audit?.warningCount ?? 0} warnings / {audit?.secretLeakCount ?? 0} secret leaks</small>
            </div>
          </div>
          {isStaticReader && (
            <div className="distributionExplorer" data-testid="distribution-explorer">
              <div className="panelHeaderLine">
                <h4>Public Dataset Explorer</h4>
                <span>Distribution Explorer / aggregate-only public reader</span>
              </div>
              <div className="datasetReaderNextStep" data-testid="dataset-reader-next-step">
                <strong>Reviewer next step</strong>
                <span>Start with Public Case Explorer, then compare Evidence Distribution and Audit Boundary before trusting the snapshot.</span>
              </div>
              <div className="distributionExplorerIntro">
                <strong>Aggregate slices only</strong>
                <span>Search distributions, sort buckets, and inspect selected public summaries without raw case bodies.</span>
              </div>
              <div className="reviewTabRow" role="tablist" aria-label="Distribution explorer sections">
                {explorerTabs.map((item) => (
                  <button key={item.id} type="button" className={distributionView === item.id ? "active" : ""} onClick={() => setDistributionView(item.id)}>
                    {item.label}
                  </button>
                ))}
              </div>
              {distributionView !== "gate" && (
                <div className="distributionExplorerControls" aria-label="Public dataset explorer controls">
                  <label>
                    Search distributions
                    <input
                      value={distributionSearch}
                      onChange={(event) => setDistributionSearch(event.target.value)}
                      placeholder={distributionView === "world" ? "package id or name" : distributionView === "public-case" ? "public case id, type, or location" : "case or evidence type id"}
                    />
                  </label>
                  {distributionView === "public-case" ? (
                    <label>
                      Sort public cases
                      <select value={publicCaseSort} onChange={(event) => setPublicCaseSort(event.target.value as PublicCaseSort)}>
                        <option value="ordinal-asc">ordinal low to high</option>
                        <option value="tick-desc">tick high to low</option>
                        <option value="warnings-desc">warnings high to low</option>
                        <option value="case-type-asc">case type A to Z</option>
                      </select>
                    </label>
                  ) : (
                    <label>
                      Sort buckets
                      <select value={distributionSort} onChange={(event) => setDistributionSort(event.target.value as DistributionSort)}>
                        <option value="count-desc">count high to low</option>
                        <option value="count-asc">count low to high</option>
                        <option value="name-asc">name A to Z</option>
                        <option value="name-desc">name Z to A</option>
                      </select>
                    </label>
                  )}
                  {distributionView === "public-case" && (
                    <>
                      <label>
                        Case type filter
                        <select value={publicCaseTypeFilter} onChange={(event) => setPublicCaseTypeFilter(event.target.value)}>
                          <option value="all">all case types</option>
                          {publicCaseTypes.map((caseType) => (
                            <option key={caseType} value={caseType}>{caseType}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Location filter
                        <select value={publicCaseLocationFilter} onChange={(event) => setPublicCaseLocationFilter(event.target.value)}>
                          <option value="all">all locations</option>
                          {publicCaseLocations.map((location) => (
                            <option key={location} value={location}>{location}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Warning status filter
                        <select value={publicCaseWarningFilter} onChange={(event) => setPublicCaseWarningFilter(event.target.value)}>
                          <option value="all">all warning states</option>
                          <option value="clean">clean evidence summary</option>
                          <option value="warnings">has evidence warnings</option>
                        </select>
                      </label>
                    </>
                  )}
                </div>
              )}
              {(distributionView === "case" || distributionView === "evidence") && (
                <div className="reviewStack">
                  <div className="reviewJobCard">
                    <strong>{explorerTitle}</strong>
                    <span>{selectedDistribution.length} visible buckets / {selectedDistributionVisibleTotal} visible records / {selectedDistributionTotal} total records</span>
                    <small>local slice of reader-index.json; no raw case body exposed</small>
                  </div>
                  <div className="distributionSelectedCard" data-testid="public-dataset-explorer-selection">
                    <strong>Selected bucket</strong>
                    <span>{selectedBucketLabel || "no bucket selected"}</span>
                    <small>{selectedBucketCount} records / {selectedBucketShare} of public aggregate / source {selectedBucketSource}</small>
                    <small>reader {readerHash?.slice(0, 16) || "not indexed"} / {selectedBucketBoundary}</small>
                  </div>
                  <div className="distributionList">
                    {selectedDistribution.map((item) => (
                      <button key={item.id} type="button" className={`distributionRow ${selectedDistributionBucket?.id === item.id ? "selected" : ""}`} onClick={() => setSelectedBucketId(item.id)}>
                        <strong>{item.id}</strong>
                        <span>{item.count}</span>
                        <small>{distributionShare(item.count, selectedDistributionTotal)}</small>
                      </button>
                    ))}
                    {!selectedDistribution.length && (
                      <div className="distributionEmpty">No aggregate buckets match the current search.</div>
                    )}
                  </div>
                </div>
              )}
              {distributionView === "world" && (
                <div className="reviewStack">
                  <div className="distributionSelectedCard" data-testid="public-dataset-explorer-world-selection">
                    <strong>Selected world package</strong>
                    <span>{selectedWorldPackage ? `${selectedWorldPackage.name} / ${selectedWorldPackage.packageId}` : "no package selected"}</span>
                    <small>{selectedWorldPackage?.license || "no license"} / reader {readerHash?.slice(0, 16) || "not indexed"}</small>
                    <small>source {selectedBucketSource} / {selectedBucketBoundary}</small>
                  </div>
                  <div className="reviewHistoryList compactJobs">
                    {filteredWorldPackages.map((pack) => (
                    <button key={pack.packageId} type="button" className={`reviewJobCard distributionPackageButton ${selectedWorldPackage?.packageId === pack.packageId ? "selected" : ""}`} onClick={() => setSelectedBucketId(pack.packageId)}>
                      <strong>{pack.name}</strong>
                      <span>{pack.packageId} / {pack.version}</span>
                      <small>{pack.license || "no license"} / {pack.contentHash?.slice(0, 16) || "no hash"}</small>
                    </button>
                    ))}
                    {!filteredWorldPackages.length && (
                      <div className="distributionEmpty">No world package summaries match the current search.</div>
                    )}
                  </div>
                </div>
              )}
              {distributionView === "public-case" && (
                <div className="reviewStack">
                  <div className="reviewMetricGrid compact">
                    <span><b>{filteredPublicCases.length}</b>visible public cases</span>
                    <span><b>{publicCaseSummary?.caseCount ?? 0}</b>case summary index</span>
                    <span><b>{publicCaseSummary?.evidenceCompleteCount ?? 0}</b>complete evidence</span>
                    <span><b>{publicCaseSummary?.evidenceWarningCaseCount ?? 0}</b>warning cases</span>
                    <span><b>{publicCaseSummary?.laterInfluencedCaseCount ?? 0}</b>influenced cases</span>
                    <span><b>{publicCaseSummary?.totalEvidenceCount ?? 0}</b>evidence references</span>
                  </div>
                  <div className="distributionSelectedCard">
                    <strong>Case Summary Index</strong>
                    <span>{publicCaseSummary?.caseCount ?? 0} spoiler-safe public case cards / {publicCaseSummary?.caseTypeCount ?? 0} case types / {publicCaseSummary?.locationCount ?? 0} locations</span>
                    <small>manifest hash {caseSummaryHash?.slice(0, 16) || "not indexed"} / source {selectedBucketSource}</small>
                  </div>
                  <div className="distributionSelectedCard" data-testid="public-case-explorer-selection">
                    <strong>Selected public case</strong>
                    <span>{selectedPublicCase ? `${selectedPublicCase.publicCaseId} / ${selectedPublicCase.caseType} / ${selectedPublicCase.locationId}` : "no public case selected"}</span>
                    <small>{selectedPublicCase ? `ordinal ${selectedPublicCase.ordinal} / tick ${selectedPublicCase.tick} / outcome ${selectedPublicCase.outcome}` : "adjust filters to select a public case"}</small>
                    <small>{selectedPublicCase ? `source case hash ${selectedPublicCase.sourceCaseHash}` : "source case hash unavailable"}</small>
                  </div>
                  <div className="distributionSelectedCard">
                    <strong>Evidence/Influence Summary</strong>
                    <span>{selectedPublicCase ? `${selectedPublicCase.evidenceCount} evidence count / ${selectedPublicCase.evidenceWarningCount} warning count / ${selectedPublicCase.institutionCount} institutions` : "no public case selected"}</span>
                    <small>{selectedPublicCase ? `complete ${selectedPublicCase.evidenceComplete ? "yes" : "no"} / incoming ${selectedPublicCase.laterInfluence.incomingEdgeCount} / outgoing ${selectedPublicCase.laterInfluence.outgoingEdgeCount}` : "aggregate-only public summary"}</small>
                    <small>edge type counts: {selectedPublicCase?.edgeTypeCounts.map((item) => `${item.id}:${item.count}`).join(" / ") || "none"}</small>
                  </div>
                  <div className="distributionSelectedCard">
                    <strong>Audit Boundary</strong>
                    <span>spoiler-safe public case summary / static-only boundary</span>
                    <small>no raw case body / no event chain / no actor identity chain / no replay or package body</small>
                    <small>case index {caseSummaryHash?.slice(0, 16) || "not indexed"} / reader {readerHash?.slice(0, 16) || "not indexed"}</small>
                  </div>
                  <div className="distributionList publicCaseList">
                    {filteredPublicCases.map((item) => (
                      <button key={item.publicCaseId} type="button" className={`distributionRow publicCaseRow ${selectedPublicCase?.publicCaseId === item.publicCaseId ? "selected" : ""}`} onClick={() => setSelectedPublicCaseId(item.publicCaseId)}>
                        <strong>{item.publicCaseId}</strong>
                        <span>{item.caseType} / {item.locationId}</span>
                        <small>tick {item.tick} / evidence {item.evidenceCount} / warnings {item.evidenceWarningCount}</small>
                      </button>
                    ))}
                    {!filteredPublicCases.length && (
                      <div className="distributionEmpty">No public case summaries match the current filters.</div>
                    )}
                  </div>
                </div>
              )}
              {distributionView === "gate" && (
                <div className="reviewStack">
                  <div className="reviewMetricGrid compact">
                    <span className={gate?.ok ? "pass" : "fail"}><b>{gate?.ok ? "ok" : "check"}</b>5000 gate</span>
                    <span><b>{reader?.solvedCaseCount ?? 0}</b>solved</span>
                    <span><b>{reader?.failedCaseCount ?? 0}</b>failed</span>
                    <span><b>{reader?.caseGraph.laterCaseInfluenceRate ?? 0}%</b>later influence</span>
                    <span><b>{reader?.evidenceGraph.warningCount ?? 0}</b>evidence warnings</span>
                    <span className={auditOk ? "pass" : "fail"}><b>{auditOk ? "clean" : "check"}</b>audit status</span>
                  </div>
                  <div className="distributionSelectedCard">
                    <strong>Static boundary summary</strong>
                    <span>{selectedBucketBoundary}</span>
                    <small>{audit?.errorCount ?? 0} errors / {audit?.secretLeakCount ?? 0} secret leaks / {audit?.hiddenTruthLeakCount ?? 0} hidden-answer leaks</small>
                    <small>reader {readerHash?.slice(0, 16) || "not indexed"} / source {selectedBucketSource}</small>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {!isStaticReader ? (
        <div className="reviewActionRow">
          <button type="button" onClick={exportDataset} disabled={busy || exporting}>
            {exporting ? "Exporting..." : "Export Dataset"}
          </button>
        </div>
      ) : (
        <small>Static reader uses public files only and does not call /api/*.</small>
      )}
      <small data-testid="dataset-package-status">{status}</small>
    </section>
  );
}

function numberValue(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildDraft(preset?: ScenarioPreset | null): ScenarioPresetDraft {
  const firstBranch = preset?.config.branches?.[0];
  const firstIntervention = firstBranch?.interventions?.[0];
  return {
    name: preset?.name || preset?.config.name || "Review preset",
    description: preset?.description || "",
    seed: preset?.config.seed || "",
    baselineSteps: preset?.config.baselineSteps ?? 45,
    branchName: firstBranch?.name || "Primary branch",
    branchSteps: firstBranch?.steps ?? 12,
    actorId: firstIntervention?.intervention.actorId || "",
    interventionKind: firstIntervention?.intervention.kind || "resource",
    interventionValue: String(firstIntervention?.intervention.value ?? ""),
    atTickOffset: firstIntervention?.atTickOffset ?? 1,
    minValidCandidates: preset?.config.passCriteria?.minValidCandidates ?? 1,
    requireHardLogic: preset?.config.passCriteria?.requireHardLogic ?? true,
    maxBlockedCandidates: preset?.config.passCriteria?.maxBlockedCandidates ?? 8,
    minEventGrowth: preset?.config.passCriteria?.minEventGrowth ?? 1,
    minMemoryGrowth: preset?.config.passCriteria?.minMemoryGrowth ?? 1
  };
}

type ScenarioPresetEditorProps = {
  presets: ScenarioPreset[];
  selectedPresetId: string;
  onSelectPresetId: (presetId: string) => void;
  onRunScenario: (config: ScenarioConfig) => void;
  onSavePreset: (preset: ScenarioPreset, overwrite: boolean) => void;
  onDeletePreset: (presetId: string) => void;
  busy?: boolean;
};

export function ScenarioPresetEditor({
  presets,
  selectedPresetId,
  onSelectPresetId,
  onRunScenario,
  onSavePreset,
  onDeletePreset,
  busy = false
}: ScenarioPresetEditorProps) {
  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId) || presets[0] || null,
    [presets, selectedPresetId]
  );
  const [draft, setDraft] = useState<ScenarioPresetDraft>(() => buildDraft(selectedPreset));

  useEffect(() => {
    setDraft(buildDraft(selectedPreset));
  }, [selectedPreset]);

  const presetCountLabel = `${presets.length} preset${presets.length === 1 ? "" : "s"}`;
  const customPresetId = selectedPreset && !selectedPreset.builtIn
    ? selectedPreset.id
    : `custom-${slugify(draft.name)}`;
  const overwrite = Boolean(selectedPreset && !selectedPreset.builtIn && selectedPreset.id === customPresetId);

  function updateDraft<K extends keyof ScenarioPresetDraft>(key: K, value: ScenarioPresetDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function buildConfig(): ScenarioConfig {
    return {
      name: draft.name,
      seed: draft.seed,
      baselineSteps: Math.max(1, numberValue(String(draft.baselineSteps), 45)),
      branches: [{
        id: `${slugify(draft.branchName)}-branch`,
        name: draft.branchName,
        steps: Math.max(1, numberValue(String(draft.branchSteps), 12)),
        interventions: [{
          atTickOffset: Math.max(0, numberValue(String(draft.atTickOffset), 1)),
          intervention: {
            actorId: draft.actorId,
            kind: draft.interventionKind,
            value: draft.interventionKind === "relationship-pressure"
              ? numberValue(draft.interventionValue, 78)
              : draft.interventionValue
          }
        }]
      }],
      passCriteria: {
        minValidCandidates: Math.max(0, numberValue(String(draft.minValidCandidates), 1)),
        requireHardLogic: draft.requireHardLogic,
        maxBlockedCandidates: Math.max(0, numberValue(String(draft.maxBlockedCandidates), 8)),
        minEventGrowth: Math.max(0, numberValue(String(draft.minEventGrowth), 1)),
        minMemoryGrowth: Math.max(0, numberValue(String(draft.minMemoryGrowth), 1))
      }
    };
  }

  function savePreset() {
    onSavePreset({
      id: customPresetId,
      name: draft.name,
      description: draft.description,
      config: {
        ...buildConfig(),
        id: customPresetId
      }
    }, overwrite);
  }

  return (
    <section className="reviewPresetLibrary" data-testid="scenario-preset-library">
      <div className="panelHeaderLine">
        <h3>Scenario Presets</h3>
        <span>{presetCountLabel}</span>
      </div>
      <div className="reviewPresetToolbar">
        <label>
          Preset
          <select value={selectedPreset?.id || ""} onChange={(event) => onSelectPresetId(event.target.value)}>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}{preset.builtIn ? " (built-in)" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="reviewPresetSummary">
          <span>{selectedPreset?.description || "Lightweight editor for one primary branch."}</span>
          <span>{selectedPreset?.builtIn ? "Read-only template" : "Custom preset"}</span>
        </div>
      </div>
      <div className="reviewPresetGrid">
        <label>
          Name
          <input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} />
        </label>
        <label>
          Seed
          <input value={draft.seed} onChange={(event) => updateDraft("seed", event.target.value)} />
        </label>
        <label>
          Description
          <input value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} />
        </label>
        <label>
          Baseline steps
          <input type="number" min={1} value={draft.baselineSteps} onChange={(event) => updateDraft("baselineSteps", numberValue(event.target.value, 45))} />
        </label>
        <label>
          Branch name
          <input value={draft.branchName} onChange={(event) => updateDraft("branchName", event.target.value)} />
        </label>
        <label>
          Branch steps
          <input type="number" min={1} value={draft.branchSteps} onChange={(event) => updateDraft("branchSteps", numberValue(event.target.value, 12))} />
        </label>
        <label>
          Actor id
          <input value={draft.actorId} onChange={(event) => updateDraft("actorId", event.target.value)} />
        </label>
        <label>
          Intervention kind
          <select value={draft.interventionKind} onChange={(event) => updateDraft("interventionKind", event.target.value as TownRuntimeIntervention["kind"])}>
            <option value="resource">resource</option>
            <option value="knowledge">knowledge</option>
            <option value="relationship-pressure">relationship-pressure</option>
            <option value="goal">goal</option>
            <option value="location">location</option>
            <option value="action-bias">action-bias</option>
          </select>
        </label>
        <label>
          Intervention value
          <input value={draft.interventionValue} onChange={(event) => updateDraft("interventionValue", event.target.value)} />
        </label>
        <label>
          At tick offset
          <input type="number" min={0} value={draft.atTickOffset} onChange={(event) => updateDraft("atTickOffset", numberValue(event.target.value, 1))} />
        </label>
        <label>
          Min valid candidates
          <input type="number" min={0} value={draft.minValidCandidates} onChange={(event) => updateDraft("minValidCandidates", numberValue(event.target.value, 1))} />
        </label>
        <label className="checkboxField">
          <input type="checkbox" checked={draft.requireHardLogic} onChange={(event) => updateDraft("requireHardLogic", event.target.checked)} />
          Require hard logic
        </label>
        <label>
          Max blocked candidates
          <input type="number" min={0} value={draft.maxBlockedCandidates} onChange={(event) => updateDraft("maxBlockedCandidates", numberValue(event.target.value, 8))} />
        </label>
        <label>
          Min event growth
          <input type="number" min={0} value={draft.minEventGrowth} onChange={(event) => updateDraft("minEventGrowth", numberValue(event.target.value, 1))} />
        </label>
        <label>
          Min memory growth
          <input type="number" min={0} value={draft.minMemoryGrowth} onChange={(event) => updateDraft("minMemoryGrowth", numberValue(event.target.value, 1))} />
        </label>
      </div>
      <div className="reviewActionRow">
        <button type="button" className="secondaryButton full" onClick={() => onRunScenario(buildConfig())} disabled={busy}>
          Run selected preset
        </button>
        <button type="button" onClick={savePreset} disabled={busy || !draft.name.trim()}>
          Save preset
        </button>
        <button type="button" onClick={() => selectedPreset && onDeletePreset(selectedPreset.id)} disabled={busy || !selectedPreset || Boolean(selectedPreset.builtIn)}>
          Delete custom
        </button>
      </div>
    </section>
  );
}

type ScenarioRunHistoryProps = {
  runs: ScenarioRunSummary[];
  selectedRunId?: string;
  onSelectRunId: (scenarioId: string) => void;
};

export function ScenarioRunHistory({ runs, selectedRunId, onSelectRunId }: ScenarioRunHistoryProps) {
  return (
    <section className="reviewRunHistory" data-testid="scenario-run-history">
      <div className="panelHeaderLine">
        <h3>Scenario Run History</h3>
        <span>{runs.length} runs</span>
      </div>
      {!runs.length ? <small>No completed scenario runs yet.</small> : (
        <div className="reviewHistoryList">
          {runs.map((run) => (
            <button
              key={run.id}
              type="button"
              className={run.id === selectedRunId ? "selected" : ""}
              onClick={() => onSelectRunId(run.id)}
            >
              <strong>{run.name}</strong>
              <span>{run.status}</span>
              <small>{run.startedAt} {"->"} {run.completedAt}</small>
              <div className="reviewHistoryMetrics">
                <span>{run.branchCount} branch</span>
                <span>{run.baselineEventGrowth} events</span>
                <span>{run.baselineMemoryGrowth} memories</span>
                <span>{run.validCandidateCount} valid</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

type ReviewExportActionsProps = {
  busy?: boolean;
  onCopyJson: () => void;
  onExportMarkdown: () => void;
  onExportBundle: () => void;
};

export function ReviewExportActions({ busy = false, onCopyJson, onExportMarkdown, onExportBundle }: ReviewExportActionsProps) {
  return (
    <div className="reviewActionRow" data-testid="review-export-actions">
      <button type="button" className="secondaryButton full" onClick={onCopyJson} disabled={busy}>Copy JSON</button>
      <button type="button" onClick={onExportMarkdown} disabled={busy}>Export Markdown</button>
      <button type="button" onClick={onExportBundle} disabled={busy}>Export Review Bundle</button>
    </div>
  );
}

type BenchmarkSeedTableProps = {
  report: EmergenceBenchmarkReport | null;
  busy?: boolean;
  onRunBenchmark: (seedCount: 10 | 20) => void;
};

export function BenchmarkSeedTable({ report, busy = false, onRunBenchmark }: BenchmarkSeedTableProps) {
  const [filter, setFilter] = useState<BenchmarkFilter>("all");
  const filteredResults = useMemo(() => {
    if (!report) return [];
    if (filter === "pass") return report.results.filter((result) => result.passed);
    if (filter === "fail") return report.results.filter((result) => !result.passed);
    return report.results;
  }, [filter, report]);

  return (
    <section className="benchmarkSeedReview" data-testid="benchmark-seed-review">
      <div className="reviewActionRow benchmarkSeedToolbar">
        <div className="benchmarkFilterGroup">
          <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>all</button>
          <button type="button" className={filter === "pass" ? "active" : ""} onClick={() => setFilter("pass")}>pass</button>
          <button type="button" className={filter === "fail" ? "active" : ""} onClick={() => setFilter("fail")}>fail</button>
        </div>
        <div className="benchmarkRunGroup">
          <button type="button" onClick={() => onRunBenchmark(10)} disabled={busy}>Quick 10</button>
          <button type="button" onClick={() => onRunBenchmark(20)} disabled={busy}>Full 20</button>
        </div>
      </div>
      {!report ? <small>No benchmark report has been generated yet.</small> : (
        <div className="benchmarkSeedTableWrap" data-testid="benchmark-seed-table">
          <table className="benchmarkSeedTable">
            <thead>
              <tr>
                <th>Seed</th>
                <th>Result</th>
                <th>Quality</th>
                <th>Emergence</th>
                <th>Six-stage</th>
                <th>Route</th>
                <th>AutoSolve</th>
                <th>Steps</th>
                <th>Mature Tick</th>
                <th>Failures</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((result) => (
                <tr key={result.seed} className={result.passed ? "pass" : "fail"}>
                  <td>{result.seed}</td>
                  <td>{result.passed ? "pass" : "fail"}</td>
                  <td>{result.qualityScore}</td>
                  <td>{result.emergenceScore}</td>
                  <td>{result.sixStageComplete ? "yes" : "no"}</td>
                  <td>{result.routeCertified ? "yes" : "no"}</td>
                  <td>{result.autoSolvePassed ? "yes" : "no"}</td>
                  <td>{result.autoSolveStepCount ?? 0}</td>
                  <td>{result.matureTick ?? "-"}</td>
                  <td>{result.autoSolveFailureKinds?.join(", ") || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
