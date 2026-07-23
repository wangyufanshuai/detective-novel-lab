export type ReplayDatasetFile = {
  name: string;
  path: string;
  bytes: number;
  sha256: string;
  declared?: boolean;
};

export type ReplayAuditFinding = {
  severity: "error" | "warning";
  code: string;
  runId: string;
  file?: string;
  message: string;
};

export type ReplayAuditReport = {
  ok: boolean;
  checkedRunCount: number;
  errorCount: number;
  warningCount: number;
  findings: ReplayAuditFinding[];
  secretLeakCount: number;
  hiddenTruthLeakCount: number;
};

export type ReplayDatasetRun = {
  runId: string;
  kind: string;
  status: string;
  startedAt?: string;
  finishedAt?: string;
  experimentId?: string;
  seed?: string | number;
  seeds?: Array<string | number>;
  tickCount?: number;
  qualityScore?: number;
  deterministicRunHash?: string;
  normalized?: boolean;
  files: ReplayDatasetFile[];
  metrics?: Record<string, unknown>;
  warnings: string[];
};

export type ReplayDatasetIndex = {
  schemaVersion: number;
  generatedAt: string;
  storeRoot: string;
  runs: ReplayDatasetRun[];
  summary: {
    runCount: number;
    byKind: Record<string, number>;
    completedRunCount: number;
    failedRunCount: number;
    indexedFileCount: number;
  };
  audit: ReplayAuditReport;
};

export type ReplayCatalogListFilters = {
  kind?: string;
  status?: string;
  experimentId?: string;
  seed?: string;
  minTicks?: number;
  limit?: number;
  offset?: number;
};

export type ReplayCatalogSummary = ReplayDatasetIndex["summary"] & {
  lastSyncedAt?: string;
  auditErrorCount: number;
  auditWarningCount: number;
  secretLeakCount: number;
  hiddenTruthLeakCount: number;
};

export type ReplayCatalogListResult = {
  runs: ReplayDatasetRun[];
  total: number;
  summary: ReplayCatalogSummary;
};

export type ReplayCatalogRunDetail = {
  run: ReplayDatasetRun;
  findings: ReplayAuditFinding[];
};

export type ReplayCatalogSyncResult = {
  syncedRunCount: number;
  syncedFileCount: number;
  findingCount: number;
  storeRoot: string;
  generatedAt: string;
};
