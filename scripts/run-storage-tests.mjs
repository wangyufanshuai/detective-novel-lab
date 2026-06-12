import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const runtimeDir = path.join(process.cwd(), "outputs", "storage-test-runtime");
const backupDir = path.join(process.cwd(), "outputs", "backups", "storage-test");
fs.rmSync(runtimeDir, { recursive: true, force: true });
fs.rmSync(backupDir, { recursive: true, force: true });
fs.mkdirSync(runtimeDir, { recursive: true });

const sourcePath = path.join(runtimeDir, "source.db");
const db = new Database(sourcePath);
db.exec("create table worlds (id text primary key, data text not null);");
db.prepare("insert into worlds (id, data) values (?, ?)").run("world-storage-smoke", JSON.stringify({ ok: true }));
db.close();

const output = execFileSync("node", [
  "scripts/backup-sqlite.mjs",
  "--database",
  sourcePath,
  "--out",
  backupDir,
  "--label",
  "storage-smoke"
], { encoding: "utf8" });

const summary = JSON.parse(output);
assert.equal(summary.ok, true, "backup script reports success");
assert.equal(fs.existsSync(summary.backupPath), true, "backup file exists");
assert.equal(summary.backupPath.startsWith(backupDir), true, "backup is written under requested directory");

const backup = new Database(summary.backupPath, { readonly: true, fileMustExist: true });
const row = backup.prepare("select id, data from worlds where id = ?").get("world-storage-smoke");
backup.close();
assert.equal(row.id, "world-storage-smoke", "backup preserves source rows");
assert.deepEqual(JSON.parse(row.data), { ok: true }, "backup preserves JSON data");

console.log("Storage backup tests passed.");
