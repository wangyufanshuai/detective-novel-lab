import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type {
  PackageCatalogDetail,
  PackageCatalogEntry,
  PackageCatalogIndex,
  PackageCatalogListResult,
  PackageCatalogSyncResult
} from "@/lib/package-catalog-types";
import type {
  ReplayAuditFinding,
  ReplayCatalogListFilters,
  ReplayCatalogListResult,
  ReplayCatalogRunDetail,
  ReplayCatalogSyncResult,
  ReplayDatasetFile,
  ReplayDatasetIndex,
  ReplayDatasetRun
} from "@/lib/replay-catalog-types";
import type {
  CaseFromLog,
  InterrogationLogEntry,
  NovelPersistentWorkspace,
  NovelProjectSummary,
  PlayerSession,
  WorldEvent,
  WorldState
} from "@/lib/engine";

type Row = {
  id: string;
  world_id?: string;
  case_id?: string;
  player_id?: string;
  data: string;
  created_at?: string;
  updated_at?: string;
};

type ReplayRunRow = {
  run_id: string;
  kind: string;
  status: string;
  started_at?: string | null;
  finished_at?: string | null;
  experiment_id?: string | null;
  seed?: string | null;
  tick_count?: number | null;
  quality_score?: number | null;
  deterministic_run_hash?: string | null;
  store_root: string;
  normalized: number;
  metrics_json?: string | null;
  warnings_json?: string | null;
  audit_json?: string | null;
  data: string;
  created_at: string;
  updated_at: string;
};

type ReplayFileRow = {
  run_id: string;
  name: string;
  path: string;
  bytes: number;
  sha256: string;
  declared: number;
  data: string;
};

type PackageCatalogRow = {
  package_id: string;
  kind: string;
  source: string;
  name: string;
  version: string;
  status: string;
  directory_name: string;
  relative_path: string;
  content_hash?: string | null;
  path_hash?: string | null;
  license?: string | null;
  attribution?: string | null;
  scenario_pack_id?: string | null;
  map_pack_id?: string | null;
  rule_catalog_id?: string | null;
  agent_pack_id?: string | null;
  ecosystem_catalog_id?: string | null;
  validation_json: string;
  metrics_json: string;
  data: string;
  created_at: string;
  updated_at: string;
};

const schemaVersion = 4;

export class NovelProjectConflictError extends Error {
  readonly current: NovelProjectSummary;

  constructor(current: NovelProjectSummary) {
    super(`Novel project ${current.id} changed on the server at ${current.updatedAt}`);
    this.name = "NovelProjectConflictError";
    this.current = current;
  }
}

export function databasePath() {
  const url = process.env.DATABASE_URL || "file:./data/mystery-town.db";
  if (url === "file:./data/mystery-town.db" || url === "./data/mystery-town.db") {
    return path.join(process.cwd(), "data", "mystery-town.db");
  }
  const rawPath = url.startsWith("file:") ? url.slice(5) : url;
  return path.isAbsolute(rawPath) ? rawPath : path.join(process.cwd(), "data", path.basename(rawPath));
}

let cachedDb: Database.Database | null = null;

export function getDb() {
  if (cachedDb) return cachedDb;
  const dbPath = databasePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    create table if not exists worlds (
      id text primary key,
      data text not null,
      created_at text not null,
      updated_at text not null
    );
    create table if not exists world_events (
      id text primary key,
      world_id text not null,
      data text not null,
      created_at text not null
    );
    create index if not exists idx_world_events_world on world_events(world_id);
    create table if not exists cases (
      id text primary key,
      world_id text not null,
      data text not null,
      created_at text not null
    );
    create index if not exists idx_cases_world on cases(world_id);
    create table if not exists sessions (
      id text primary key,
      world_id text not null,
      case_id text not null,
      player_id text not null,
      data text not null,
      created_at text not null,
      updated_at text not null
    );
    create index if not exists idx_sessions_world_case on sessions(world_id, case_id);
    create table if not exists storage_meta (
      key text primary key,
      value text not null,
      updated_at text not null
    );
    create table if not exists novel_projects (
      id text primary key,
      title text not null,
      genre_tone text not null,
      chapter_count integer not null,
      data text not null,
      created_at text not null,
      updated_at text not null
    );
    create index if not exists idx_novel_projects_updated on novel_projects(updated_at desc);
    create table if not exists replay_runs (
      run_id text primary key,
      kind text not null,
      status text not null,
      started_at text,
      finished_at text,
      experiment_id text,
      seed text,
      tick_count integer,
      quality_score real,
      deterministic_run_hash text,
      store_root text not null,
      normalized integer not null default 0,
      metrics_json text,
      warnings_json text,
      audit_json text,
      data text not null,
      created_at text not null,
      updated_at text not null
    );
    create index if not exists idx_replay_runs_finished on replay_runs(finished_at desc, started_at desc);
    create index if not exists idx_replay_runs_kind_status on replay_runs(kind, status);
    create index if not exists idx_replay_runs_experiment on replay_runs(experiment_id);
    create table if not exists replay_files (
      run_id text not null,
      path text not null,
      name text not null,
      bytes integer not null,
      sha256 text not null,
      declared integer not null default 0,
      data text not null,
      primary key (run_id, path)
    );
    create index if not exists idx_replay_files_run on replay_files(run_id);
    create table if not exists replay_audit_findings (
      id text primary key,
      run_id text not null,
      severity text not null,
      code text not null,
      file text,
      message text not null,
      data text not null
    );
    create index if not exists idx_replay_findings_run on replay_audit_findings(run_id);
    create index if not exists idx_replay_findings_severity on replay_audit_findings(severity);
    create table if not exists package_catalog (
      package_id text primary key,
      kind text not null,
      source text not null,
      name text not null,
      version text not null,
      status text not null,
      directory_name text not null,
      relative_path text not null,
      content_hash text,
      path_hash text,
      license text,
      attribution text,
      scenario_pack_id text,
      map_pack_id text,
      rule_catalog_id text,
      agent_pack_id text,
      ecosystem_catalog_id text,
      validation_json text not null,
      metrics_json text not null,
      data text not null,
      created_at text not null,
      updated_at text not null
    );
    create index if not exists idx_package_catalog_kind_status on package_catalog(kind, status);
    create index if not exists idx_package_catalog_source on package_catalog(source);
    create index if not exists idx_package_catalog_scenario on package_catalog(scenario_pack_id);
  `);
  db.prepare(
    `insert into storage_meta (key, value, updated_at)
     values ('schema_version', ?, ?)
     on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at`
  ).run(String(schemaVersion), new Date().toISOString());
  cachedDb = db;
  return db;
}

export function closeDatabase() {
  cachedDb?.close();
  cachedDb = null;
}

function parseData<T>(row: Row | undefined) {
  return row ? (JSON.parse(row.data) as T) : null;
}

function parseJsonField<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function isSafeReplayRelativePath(filePath: string) {
  if (!filePath || path.isAbsolute(filePath)) return false;
  const normalized = path.normalize(filePath);
  return normalized !== ".." && !normalized.startsWith(`..${path.sep}`) && !normalized.includes(`${path.sep}..${path.sep}`);
}

function isSafeCatalogRelativePath(filePath: string) {
  if (!filePath || path.isAbsolute(filePath)) return false;
  const normalized = path.normalize(filePath);
  return normalized !== ".." && !normalized.startsWith(`..${path.sep}`) && !normalized.includes(`${path.sep}..${path.sep}`);
}

function assertSafePackageCatalogEntry(entry: PackageCatalogEntry) {
  if (!isSafeCatalogRelativePath(entry.relativePath)) {
    throw new Error(`Package catalog relativePath must be relative and stay inside workspace: ${entry.relativePath}`);
  }
  if (/sk-[a-z0-9]/i.test(JSON.stringify(entry)) || /authorization:\s*bearer/i.test(JSON.stringify(entry))) {
    throw new Error(`Package catalog entry ${entry.packageId} may contain a secret-looking value.`);
  }
}

function assertSafeReplayRun(run: ReplayDatasetRun) {
  for (const file of run.files || []) {
    if (!isSafeReplayRelativePath(file.path)) {
      throw new Error(`Replay catalog file path must be relative and stay inside its run directory: ${run.runId}/${file.path}`);
    }
  }
}

function compactReplayRun(run: ReplayDatasetRun): ReplayDatasetRun {
  return { ...run, files: [] };
}

function replayRunFromRow(row: ReplayRunRow, includeFiles: boolean, files: ReplayDatasetFile[] = []): ReplayDatasetRun {
  const stored = parseJsonField<ReplayDatasetRun>(row.data, {
    runId: row.run_id,
    kind: row.kind,
    status: row.status,
    files: [],
    warnings: []
  });
  const run: ReplayDatasetRun = {
    ...stored,
    runId: row.run_id,
    kind: row.kind,
    status: row.status,
    startedAt: row.started_at || stored.startedAt,
    finishedAt: row.finished_at || stored.finishedAt,
    experimentId: row.experiment_id || stored.experimentId,
    seed: row.seed ?? stored.seed,
    tickCount: row.tick_count ?? stored.tickCount,
    qualityScore: row.quality_score ?? stored.qualityScore,
    deterministicRunHash: row.deterministic_run_hash || stored.deterministicRunHash,
    normalized: Boolean(row.normalized),
    metrics: parseJsonField<Record<string, unknown> | undefined>(row.metrics_json, stored.metrics),
    warnings: parseJsonField<string[]>(row.warnings_json, stored.warnings || []),
    files: includeFiles ? files : []
  };
  return run;
}

function replayFindingId(finding: ReplayAuditFinding, index: number) {
  return `${finding.runId}:${index}:${finding.severity}:${finding.code}:${finding.file || ""}`;
}

function replayCatalogSummary(db: Database.Database) {
  const rows = db.prepare("select kind, status from replay_runs").all() as Array<{ kind: string; status: string }>;
  const fileCount = (db.prepare("select count(*) as count from replay_files").get() as { count: number }).count;
  const auditCounts = db.prepare(`
    select
      sum(case when severity = 'error' then 1 else 0 end) as errors,
      sum(case when severity = 'warning' then 1 else 0 end) as warnings,
      sum(case when code like 'secret.%' then 1 else 0 end) as secretLeaks,
      sum(case when code like 'bundle.hidden%' then 1 else 0 end) as hiddenTruthLeaks
    from replay_audit_findings
  `).get() as { errors: number | null; warnings: number | null; secretLeaks: number | null; hiddenTruthLeaks: number | null };
  const meta = db.prepare("select value from storage_meta where key = 'replay_catalog_last_synced_at'").get() as { value: string } | undefined;
  const byKind: Record<string, number> = {};
  for (const row of rows) byKind[row.kind] = (byKind[row.kind] || 0) + 1;
  return {
    runCount: rows.length,
    byKind,
    completedRunCount: rows.filter((row) => row.status === "completed" || row.status === "passed").length,
    failedRunCount: rows.filter((row) => row.status === "failed" || row.status === "blocked").length,
    indexedFileCount: fileCount,
    lastSyncedAt: meta?.value,
    auditErrorCount: auditCounts.errors || 0,
    auditWarningCount: auditCounts.warnings || 0,
    secretLeakCount: auditCounts.secretLeaks || 0,
    hiddenTruthLeakCount: auditCounts.hiddenTruthLeaks || 0
  };
}

function packageEntryFromRow(row: PackageCatalogRow): PackageCatalogEntry {
  const stored = parseJsonField<PackageCatalogEntry>(row.data, {
    packageId: row.package_id,
    kind: row.kind as PackageCatalogEntry["kind"],
    source: row.source as PackageCatalogEntry["source"],
    name: row.name,
    version: row.version,
    status: row.status as PackageCatalogEntry["status"],
    directoryName: row.directory_name,
    relativePath: row.relative_path,
    validation: { ok: row.status === "valid", errors: [], warnings: [] },
    metrics: { fileCount: 0, bytes: 0 }
  });
  return {
    ...stored,
    packageId: row.package_id,
    kind: row.kind as PackageCatalogEntry["kind"],
    source: row.source as PackageCatalogEntry["source"],
    name: row.name,
    version: row.version,
    status: row.status as PackageCatalogEntry["status"],
    directoryName: row.directory_name,
    relativePath: row.relative_path,
    contentHash: row.content_hash || stored.contentHash,
    pathHash: row.path_hash || stored.pathHash,
    license: row.license || stored.license,
    attribution: row.attribution || stored.attribution,
    scenarioPackId: row.scenario_pack_id || stored.scenarioPackId,
    mapPackId: row.map_pack_id || stored.mapPackId,
    ruleCatalogId: row.rule_catalog_id || stored.ruleCatalogId,
    agentPackId: row.agent_pack_id || stored.agentPackId,
    ecosystemCatalogId: row.ecosystem_catalog_id || stored.ecosystemCatalogId,
    validation: parseJsonField(row.validation_json, stored.validation),
    metrics: parseJsonField(row.metrics_json, stored.metrics)
  };
}

function packageCatalogSummary(db: Database.Database) {
  const rows = db.prepare("select kind, source, status from package_catalog").all() as Array<{ kind: string; source: string; status: string }>;
  const byKind: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  for (const row of rows) {
    byKind[row.kind] = (byKind[row.kind] || 0) + 1;
    bySource[row.source] = (bySource[row.source] || 0) + 1;
  }
  const meta = db.prepare("select value from storage_meta where key = 'package_catalog_last_synced_at'").get() as { value: string } | undefined;
  return {
    packageCount: rows.length,
    validPackageCount: rows.filter((row) => row.status === "valid").length,
    invalidPackageCount: rows.filter((row) => row.status === "invalid").length,
    byKind,
    bySource,
    lastSyncedAt: meta?.value
  };
}

export const worldRepository = {
  schemaVersion,

  databasePath,

  storageHealth() {
    try {
      const db = getDb();
      const integrity = db.pragma("quick_check", { simple: true }) as string;
      const journalMode = db.pragma("journal_mode", { simple: true }) as string;
      const worldCount = (db.prepare("select count(*) as count from worlds").get() as { count: number }).count;
      const eventCount = (db.prepare("select count(*) as count from world_events").get() as { count: number }).count;
      const caseCount = (db.prepare("select count(*) as count from cases").get() as { count: number }).count;
      const novelProjectCount = (db.prepare("select count(*) as count from novel_projects").get() as { count: number }).count;
      const replayRunCount = (db.prepare("select count(*) as count from replay_runs").get() as { count: number }).count;
      const replayFileCount = (db.prepare("select count(*) as count from replay_files").get() as { count: number }).count;
      const packageCount = (db.prepare("select count(*) as count from package_catalog").get() as { count: number }).count;
      return {
        schemaVersion,
        databasePath: databasePath(),
        walEnabled: String(journalMode).toLowerCase() === "wal",
        health: integrity === "ok" ? "ok" : "degraded",
        quickCheck: integrity,
        counts: { worlds: worldCount, events: eventCount, cases: caseCount, novelProjects: novelProjectCount, replayRuns: replayRunCount, replayFiles: replayFileCount, packages: packageCount }
      };
    } catch (error) {
      return {
        schemaVersion,
        databasePath: databasePath(),
        walEnabled: false,
        health: "error",
        error: error instanceof Error ? error.message : "Unknown storage error",
        counts: { worlds: 0, events: 0, cases: 0, novelProjects: 0, replayRuns: 0, replayFiles: 0, packages: 0 }
      };
    }
  },

  saveWorld(world: WorldState) {
    const db = getDb();
    db.prepare(
      `insert into worlds (id, data, created_at, updated_at)
       values (@id, @data, @createdAt, @updatedAt)
       on conflict(id) do update set data = excluded.data, updated_at = excluded.updated_at`
    ).run({
      id: world.id,
      data: JSON.stringify(world),
      createdAt: world.createdAt,
      updatedAt: world.updatedAt
    });
    return world;
  },

  saveWorldBundle(input: { world: WorldState; events?: WorldEvent[]; activeCase?: CaseFromLog | null }) {
    const db = getDb();
    const saveWorldStatement = db.prepare(
      `insert into worlds (id, data, created_at, updated_at)
       values (@id, @data, @createdAt, @updatedAt)
       on conflict(id) do update set data = excluded.data, updated_at = excluded.updated_at`
    );
    const saveEventStatement = db.prepare(
      `insert or replace into world_events (id, world_id, data, created_at)
       values (@id, @worldId, @data, @createdAt)`
    );
    const saveCaseStatement = db.prepare(
      `insert into cases (id, world_id, data, created_at)
       values (@id, @worldId, @data, @createdAt)
       on conflict(id) do update set data = excluded.data`
    );
    const saveBundle = db.transaction(({ world, events = [], activeCase = null }: { world: WorldState; events?: WorldEvent[]; activeCase?: CaseFromLog | null }) => {
      saveWorldStatement.run({
        id: world.id,
        data: JSON.stringify(world),
        createdAt: world.createdAt,
        updatedAt: world.updatedAt
      });
      const now = new Date().toISOString();
      for (const event of events) saveEventStatement.run({ id: event.id, worldId: event.worldId, data: JSON.stringify(event), createdAt: now });
      if (activeCase) {
        saveCaseStatement.run({
          id: activeCase.id,
          worldId: activeCase.worldId,
          data: JSON.stringify(activeCase),
          createdAt: activeCase.createdAt
        });
      }
    });
    saveBundle(input);
    return input.world;
  },

  getWorld(id: string) {
    const row = getDb().prepare("select id, data from worlds where id = ?").get(id) as Row | undefined;
    return parseData<WorldState>(row);
  },

  listWorlds() {
    return (getDb().prepare("select id, data from worlds order by updated_at desc limit 20").all() as Row[]).map((row) => JSON.parse(row.data) as WorldState);
  },

  addEvents(events: WorldEvent[]) {
    if (!events.length) return [];
    const db = getDb();
    const statement = db.prepare(
      `insert or replace into world_events (id, world_id, data, created_at)
       values (@id, @worldId, @data, @createdAt)`
    );
    const now = new Date().toISOString();
    const insertMany = db.transaction((items: WorldEvent[]) => {
      for (const event of items) statement.run({ id: event.id, worldId: event.worldId, data: JSON.stringify(event), createdAt: now });
    });
    insertMany(events);
    return events;
  },

  getEvents(worldId: string) {
    return (getDb().prepare("select id, data from world_events where world_id = ? order by id asc").all(worldId) as Row[]).map(
      (row) => JSON.parse(row.data) as WorldEvent
    );
  },

  saveCase(caseFromLog: CaseFromLog) {
    getDb()
      .prepare(
        `insert into cases (id, world_id, data, created_at)
         values (@id, @worldId, @data, @createdAt)
         on conflict(id) do update set data = excluded.data`
      )
      .run({
        id: caseFromLog.id,
        worldId: caseFromLog.worldId,
        data: JSON.stringify(caseFromLog),
        createdAt: caseFromLog.createdAt
      });
    return caseFromLog;
  },

  getCase(id: string) {
    const row = getDb().prepare("select id, data from cases where id = ?").get(id) as Row | undefined;
    return parseData<CaseFromLog>(row);
  },

  getActiveCase(worldId: string) {
    const row = getDb().prepare("select id, data from cases where world_id = ? order by created_at desc limit 1").get(worldId) as Row | undefined;
    return parseData<CaseFromLog>(row);
  },

  saveSession(session: PlayerSession) {
    getDb()
      .prepare(
        `insert into sessions (id, world_id, case_id, player_id, data, created_at, updated_at)
         values (@id, @worldId, @caseId, @playerId, @data, @createdAt, @updatedAt)
         on conflict(id) do update set data = excluded.data, updated_at = excluded.updated_at`
      )
      .run({
        id: session.id,
        worldId: session.worldId,
        caseId: session.caseId,
        playerId: session.playerId,
        data: JSON.stringify(session),
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      });
    return session;
  },

  getSession(id: string) {
    const row = getDb().prepare("select id, data from sessions where id = ?").get(id) as Row | undefined;
    return parseData<PlayerSession>(row);
  },

  listSessions(worldId: string, caseId: string) {
    return (getDb().prepare("select id, data from sessions where world_id = ? and case_id = ? order by updated_at desc").all(worldId, caseId) as Row[]).map(
      (row) => JSON.parse(row.data) as PlayerSession
    );
  },

  saveNovelProject(workspace: NovelPersistentWorkspace, expectedUpdatedAt?: string | null) {
    const db = getDb();
    const select = db.prepare("select id, title, genre_tone, chapter_count, updated_at from novel_projects where id = ?");
    const upsert = db.prepare(
      `insert into novel_projects (id, title, genre_tone, chapter_count, data, created_at, updated_at)
       values (@id, @title, @genreTone, @chapterCount, @data, @createdAt, @updatedAt)
       on conflict(id) do update set
         title = excluded.title,
         genre_tone = excluded.genre_tone,
         chapter_count = excluded.chapter_count,
         data = excluded.data,
         updated_at = excluded.updated_at`
    );
    const save = db.transaction(() => {
      const current = select.get(workspace.project.id) as {
        id: string;
        title: string;
        genre_tone: string;
        chapter_count: number;
        updated_at: string;
      } | undefined;
      if (current && expectedUpdatedAt && current.updated_at !== expectedUpdatedAt) {
        throw new NovelProjectConflictError({
          id: current.id,
          title: current.title,
          genreTone: current.genre_tone,
          chapterCount: current.chapter_count,
          updatedAt: current.updated_at
        });
      }
      const updatedAt = new Date().toISOString();
      const next: NovelPersistentWorkspace = { ...workspace, version: 1, updatedAt };
      upsert.run({
        id: next.project.id,
        title: next.project.title,
        genreTone: next.project.genreTone,
        chapterCount: next.project.chapters.length,
        data: JSON.stringify(next),
        createdAt: current ? next.project.createdAt : next.project.createdAt || updatedAt,
        updatedAt
      });
      return next;
    });
    return save();
  },

  getNovelProject(id: string) {
    const row = getDb().prepare("select id, data from novel_projects where id = ?").get(id) as Row | undefined;
    return parseData<NovelPersistentWorkspace>(row);
  },

  getLatestNovelProject() {
    const row = getDb().prepare("select id, data from novel_projects order by updated_at desc limit 1").get() as Row | undefined;
    return parseData<NovelPersistentWorkspace>(row);
  },

  listNovelProjects(): NovelProjectSummary[] {
    return (getDb().prepare(
      "select id, title, genre_tone, chapter_count, updated_at from novel_projects order by updated_at desc limit 50"
    ).all() as Array<{ id: string; title: string; genre_tone: string; chapter_count: number; updated_at: string }>).map((row) => ({
      id: row.id,
      title: row.title,
      genreTone: row.genre_tone,
      chapterCount: row.chapter_count,
      updatedAt: row.updated_at
    }));
  },

  syncReplayDatasetIndex(index: ReplayDatasetIndex): ReplayCatalogSyncResult {
    const db = getDb();
    const now = new Date().toISOString();
    const runs = index.runs || [];
    for (const run of runs) assertSafeReplayRun(run);
    const findingsByRun = new Map<string, ReplayAuditFinding[]>();
    for (const finding of index.audit.findings || []) {
      const list = findingsByRun.get(finding.runId) || [];
      list.push(finding);
      findingsByRun.set(finding.runId, list);
    }

    const upsertRun = db.prepare(`
      insert into replay_runs (
        run_id, kind, status, started_at, finished_at, experiment_id, seed, tick_count,
        quality_score, deterministic_run_hash, store_root, normalized, metrics_json,
        warnings_json, audit_json, data, created_at, updated_at
      ) values (
        @runId, @kind, @status, @startedAt, @finishedAt, @experimentId, @seed, @tickCount,
        @qualityScore, @deterministicRunHash, @storeRoot, @normalized, @metricsJson,
        @warningsJson, @auditJson, @data, @createdAt, @updatedAt
      )
      on conflict(run_id) do update set
        kind = excluded.kind,
        status = excluded.status,
        started_at = excluded.started_at,
        finished_at = excluded.finished_at,
        experiment_id = excluded.experiment_id,
        seed = excluded.seed,
        tick_count = excluded.tick_count,
        quality_score = excluded.quality_score,
        deterministic_run_hash = excluded.deterministic_run_hash,
        store_root = excluded.store_root,
        normalized = excluded.normalized,
        metrics_json = excluded.metrics_json,
        warnings_json = excluded.warnings_json,
        audit_json = excluded.audit_json,
        data = excluded.data,
        updated_at = excluded.updated_at
    `);
    const deleteFiles = db.prepare("delete from replay_files where run_id = ?");
    const insertFile = db.prepare(`
      insert into replay_files (run_id, path, name, bytes, sha256, declared, data)
      values (@runId, @path, @name, @bytes, @sha256, @declared, @data)
      on conflict(run_id, path) do update set
        name = excluded.name,
        bytes = excluded.bytes,
        sha256 = excluded.sha256,
        declared = excluded.declared,
        data = excluded.data
    `);
    const deleteFindings = db.prepare("delete from replay_audit_findings where run_id = ?");
    const insertFinding = db.prepare(`
      insert or replace into replay_audit_findings (id, run_id, severity, code, file, message, data)
      values (@id, @runId, @severity, @code, @file, @message, @data)
    `);
    const sync = db.transaction(() => {
      const runIds = new Set(runs.map((run) => run.runId));
      for (const run of runs) {
        const runFindings = findingsByRun.get(run.runId) || [];
        const auditSummary = {
          errorCount: runFindings.filter((finding) => finding.severity === "error").length,
          warningCount: runFindings.filter((finding) => finding.severity === "warning").length,
          secretLeakCount: runFindings.filter((finding) => finding.code.startsWith("secret.")).length,
          hiddenTruthLeakCount: runFindings.filter((finding) => finding.code.startsWith("bundle.hidden")).length
        };
        upsertRun.run({
          runId: run.runId,
          kind: run.kind,
          status: run.status,
          startedAt: run.startedAt || null,
          finishedAt: run.finishedAt || null,
          experimentId: run.experimentId || null,
          seed: run.seed === undefined ? null : String(run.seed),
          tickCount: run.tickCount ?? null,
          qualityScore: run.qualityScore ?? null,
          deterministicRunHash: run.deterministicRunHash || null,
          storeRoot: index.storeRoot,
          normalized: run.normalized ? 1 : 0,
          metricsJson: JSON.stringify(run.metrics || {}),
          warningsJson: JSON.stringify(run.warnings || []),
          auditJson: JSON.stringify(auditSummary),
          data: JSON.stringify(run),
          createdAt: now,
          updatedAt: now
        });
        deleteFiles.run(run.runId);
        for (const file of run.files || []) {
          insertFile.run({
            runId: run.runId,
            path: file.path,
            name: file.name,
            bytes: file.bytes,
            sha256: file.sha256,
            declared: file.declared ? 1 : 0,
            data: JSON.stringify(file)
          });
        }
        deleteFindings.run(run.runId);
        runFindings.forEach((finding, indexInRun) => insertFinding.run({
          id: replayFindingId(finding, indexInRun),
          runId: finding.runId,
          severity: finding.severity,
          code: finding.code,
          file: finding.file || null,
          message: finding.message,
          data: JSON.stringify(finding)
        }));
      }
      const staleRows = db.prepare("select run_id from replay_runs").all() as Array<{ run_id: string }>;
      for (const row of staleRows) {
        if (runIds.has(row.run_id)) continue;
        db.prepare("delete from replay_files where run_id = ?").run(row.run_id);
        db.prepare("delete from replay_audit_findings where run_id = ?").run(row.run_id);
        db.prepare("delete from replay_runs where run_id = ?").run(row.run_id);
      }
      db.prepare(
        `insert into storage_meta (key, value, updated_at)
         values ('replay_catalog_last_synced_at', ?, ?)
         on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at`
      ).run(now, now);
    });
    sync();
    return {
      syncedRunCount: runs.length,
      syncedFileCount: runs.reduce((sum, run) => sum + (run.files?.length || 0), 0),
      findingCount: index.audit.findings.length,
      storeRoot: index.storeRoot,
      generatedAt: index.generatedAt
    };
  },

  listReplayCatalogRuns(filters: ReplayCatalogListFilters = {}): ReplayCatalogListResult {
    const db = getDb();
    const clauses: string[] = [];
    const params: Record<string, string | number> = {};
    if (filters.kind) {
      clauses.push("kind = @kind");
      params.kind = filters.kind;
    }
    if (filters.status) {
      clauses.push("status = @status");
      params.status = filters.status;
    }
    if (filters.experimentId) {
      clauses.push("experiment_id = @experimentId");
      params.experimentId = filters.experimentId;
    }
    if (filters.seed) {
      clauses.push("seed = @seed");
      params.seed = filters.seed;
    }
    if (typeof filters.minTicks === "number" && Number.isFinite(filters.minTicks)) {
      clauses.push("coalesce(tick_count, 0) >= @minTicks");
      params.minTicks = filters.minTicks;
    }
    const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
    const total = (db.prepare(`select count(*) as count from replay_runs ${where}`).get(params) as { count: number }).count;
    const limit = Math.max(1, Math.min(100, filters.limit || 30));
    const offset = Math.max(0, filters.offset || 0);
    const rows = db.prepare(`
      select * from replay_runs
      ${where}
      order by coalesce(finished_at, started_at, run_id) desc
      limit @limit offset @offset
    `).all({ ...params, limit, offset }) as ReplayRunRow[];
    return {
      runs: rows.map((row) => compactReplayRun(replayRunFromRow(row, false))),
      total,
      summary: replayCatalogSummary(db)
    };
  },

  getReplayCatalogRun(runId: string): ReplayCatalogRunDetail | null {
    const db = getDb();
    const row = db.prepare("select * from replay_runs where run_id = ?").get(runId) as ReplayRunRow | undefined;
    if (!row) return null;
    const fileRows = db.prepare("select * from replay_files where run_id = ? order by path asc").all(runId) as ReplayFileRow[];
    const findings = (db.prepare("select data from replay_audit_findings where run_id = ? order by id asc").all(runId) as Array<{ data: string }>)
      .map((finding) => parseJsonField<ReplayAuditFinding>(finding.data, { severity: "warning", code: "finding.parse-failed", runId, message: "Stored finding could not be parsed." }));
    const files = fileRows.map((fileRow) => parseJsonField<ReplayDatasetFile>(fileRow.data, {
      name: fileRow.name,
      path: fileRow.path,
      bytes: fileRow.bytes,
      sha256: fileRow.sha256,
      declared: Boolean(fileRow.declared)
    }));
    return { run: replayRunFromRow(row, true, files), findings };
  },

  listReplayCatalogFiles(runId: string): ReplayDatasetFile[] | null {
    const detail = this.getReplayCatalogRun(runId);
    return detail?.run.files || null;
  },

  syncPackageCatalogIndex(index: PackageCatalogIndex): PackageCatalogSyncResult {
    const db = getDb();
    const now = new Date().toISOString();
    const entries = index.packages || [];
    for (const entry of entries) assertSafePackageCatalogEntry(entry);
    const upsert = db.prepare(`
      insert into package_catalog (
        package_id, kind, source, name, version, status, directory_name, relative_path,
        content_hash, path_hash, license, attribution, scenario_pack_id, map_pack_id,
        rule_catalog_id, agent_pack_id, ecosystem_catalog_id, validation_json,
        metrics_json, data, created_at, updated_at
      ) values (
        @packageId, @kind, @source, @name, @version, @status, @directoryName, @relativePath,
        @contentHash, @pathHash, @license, @attribution, @scenarioPackId, @mapPackId,
        @ruleCatalogId, @agentPackId, @ecosystemCatalogId, @validationJson,
        @metricsJson, @data, @createdAt, @updatedAt
      )
      on conflict(package_id) do update set
        kind = excluded.kind,
        source = excluded.source,
        name = excluded.name,
        version = excluded.version,
        status = excluded.status,
        directory_name = excluded.directory_name,
        relative_path = excluded.relative_path,
        content_hash = excluded.content_hash,
        path_hash = excluded.path_hash,
        license = excluded.license,
        attribution = excluded.attribution,
        scenario_pack_id = excluded.scenario_pack_id,
        map_pack_id = excluded.map_pack_id,
        rule_catalog_id = excluded.rule_catalog_id,
        agent_pack_id = excluded.agent_pack_id,
        ecosystem_catalog_id = excluded.ecosystem_catalog_id,
        validation_json = excluded.validation_json,
        metrics_json = excluded.metrics_json,
        data = excluded.data,
        updated_at = excluded.updated_at
    `);
    const sync = db.transaction(() => {
      const packageIds = new Set(entries.map((entry) => entry.packageId));
      for (const entry of entries) {
        upsert.run({
          packageId: entry.packageId,
          kind: entry.kind,
          source: entry.source,
          name: entry.name,
          version: entry.version,
          status: entry.status,
          directoryName: entry.directoryName,
          relativePath: entry.relativePath,
          contentHash: entry.contentHash || null,
          pathHash: entry.pathHash || null,
          license: entry.license || null,
          attribution: entry.attribution || null,
          scenarioPackId: entry.scenarioPackId || null,
          mapPackId: entry.mapPackId || null,
          ruleCatalogId: entry.ruleCatalogId || null,
          agentPackId: entry.agentPackId || null,
          ecosystemCatalogId: entry.ecosystemCatalogId || null,
          validationJson: JSON.stringify(entry.validation),
          metricsJson: JSON.stringify(entry.metrics),
          data: JSON.stringify({ ...entry, syncedAt: now }),
          createdAt: now,
          updatedAt: now
        });
      }
      const staleRows = db.prepare("select package_id from package_catalog").all() as Array<{ package_id: string }>;
      for (const row of staleRows) {
        if (!packageIds.has(row.package_id)) db.prepare("delete from package_catalog where package_id = ?").run(row.package_id);
      }
      db.prepare(
        `insert into storage_meta (key, value, updated_at)
         values ('package_catalog_last_synced_at', ?, ?)
         on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at`
      ).run(now, now);
    });
    sync();
    return {
      syncedPackageCount: entries.length,
      validPackageCount: entries.filter((entry) => entry.status === "valid").length,
      invalidPackageCount: entries.filter((entry) => entry.status === "invalid").length,
      generatedAt: index.generatedAt
    };
  },

  listPackageCatalog(filters: { kind?: string; source?: string; status?: string; limit?: number; offset?: number } = {}): PackageCatalogListResult {
    const db = getDb();
    const clauses: string[] = [];
    const params: Record<string, string | number> = {};
    if (filters.kind) {
      clauses.push("kind = @kind");
      params.kind = filters.kind;
    }
    if (filters.source) {
      clauses.push("source = @source");
      params.source = filters.source;
    }
    if (filters.status) {
      clauses.push("status = @status");
      params.status = filters.status;
    }
    const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
    const total = (db.prepare(`select count(*) as count from package_catalog ${where}`).get(params) as { count: number }).count;
    const limit = Math.max(1, Math.min(100, filters.limit || 30));
    const offset = Math.max(0, filters.offset || 0);
    const rows = db.prepare(`
      select * from package_catalog
      ${where}
      order by status desc, kind asc, name asc
      limit @limit offset @offset
    `).all({ ...params, limit, offset }) as PackageCatalogRow[];
    return {
      packages: rows.map(packageEntryFromRow),
      total,
      summary: packageCatalogSummary(db)
    };
  },

  getPackageCatalogEntry(packageId: string): PackageCatalogDetail | null {
    const row = getDb().prepare("select * from package_catalog where package_id = ?").get(packageId) as PackageCatalogRow | undefined;
    if (!row) return null;
    return { package: packageEntryFromRow(row) };
  },

  appendInterrogation(session: PlayerSession, entry: InterrogationLogEntry) {
    const next: PlayerSession = {
      ...session,
      interrogationLog: [...session.interrogationLog, entry],
      updatedAt: new Date().toISOString()
    };
    return this.saveSession(next);
  }
};
