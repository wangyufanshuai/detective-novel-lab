import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { CaseFromLog, InterrogationLogEntry, PlayerSession, WorldEvent, WorldState } from "@/lib/engine";

type Row = {
  id: string;
  world_id?: string;
  case_id?: string;
  player_id?: string;
  data: string;
  created_at?: string;
  updated_at?: string;
};

const schemaVersion = 1;

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
  `);
  db.prepare(
    `insert into storage_meta (key, value, updated_at)
     values ('schema_version', ?, ?)
     on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at`
  ).run(String(schemaVersion), new Date().toISOString());
  cachedDb = db;
  return db;
}

function parseData<T>(row: Row | undefined) {
  return row ? (JSON.parse(row.data) as T) : null;
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
      return {
        schemaVersion,
        databasePath: databasePath(),
        walEnabled: String(journalMode).toLowerCase() === "wal",
        health: integrity === "ok" ? "ok" : "degraded",
        quickCheck: integrity,
        counts: { worlds: worldCount, events: eventCount, cases: caseCount }
      };
    } catch (error) {
      return {
        schemaVersion,
        databasePath: databasePath(),
        walEnabled: false,
        health: "error",
        error: error instanceof Error ? error.message : "Unknown storage error",
        counts: { worlds: 0, events: 0, cases: 0 }
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

  appendInterrogation(session: PlayerSession, entry: InterrogationLogEntry) {
    const next: PlayerSession = {
      ...session,
      interrogationLog: [...session.interrogationLog, entry],
      updatedAt: new Date().toISOString()
    };
    return this.saveSession(next);
  }
};
