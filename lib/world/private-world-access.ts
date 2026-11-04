import { AsyncLocalStorage } from "node:async_hooks";
import type Database from "better-sqlite3";

const scope = new AsyncLocalStorage<string>();
const registeredDatabases = new WeakSet<Database.Database>();

export function hasPrivateWorldRegistry(db: Database.Database) {
  if (registeredDatabases.has(db)) return true;
  const exists = !!db.prepare("select 1 from sqlite_master where type = 'table' and name = 'town_exploration_sessions'").get();
  if (exists) registeredDatabases.add(db);
  return exists;
}

/** A server capability, never a request parameter. The owning session secret
 * must be verified before entering this scope. AsyncLocalStorage prevents a
 * concurrent legacy request from borrowing another request's authorization. */
export function withPrivateWorldAccess<T>(worldId: string, action: () => T): T {
  return scope.run(worldId, action);
}

export function canAccessWorld(db: Database.Database, worldId: string) {
  if (scope.getStore() === worldId || !hasPrivateWorldRegistry(db)) return true;
  return !db.prepare("select 1 from town_exploration_sessions where world_id = ?").get(worldId);
}

export function assertWorldWrite(db: Database.Database, worldId: string) {
  if (!canAccessWorld(db, worldId)) throw new Error("Private town access requires an authenticated exploration session");
}

export function assertBoundRecordWrite(db: Database.Database, table: "world_events" | "cases" | "sessions", id: string, worldId: string) {
  assertWorldWrite(db, worldId);
  const existing = db.prepare(`select world_id from ${table} where id = ?`).get(id) as { world_id: string } | undefined;
  if (existing) assertWorldWrite(db, existing.world_id);
}
