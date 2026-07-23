import path from "node:path";
import { buildReplayDatasetIndex, writeReplayDatasetIndex } from "./replay-audit-lib.mjs";

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

const storeDir = path.resolve(argValue("store", path.join(process.cwd(), "data", "replay-store")));
const database = argValue("db", "");
const jsonOnly = hasFlag("json");
if (database) process.env.DATABASE_URL = database;

const { index, audit } = await buildReplayDatasetIndex({ storeDir });
const indexPath = await writeReplayDatasetIndex(index, storeDir);
const { worldRepository, closeDatabase } = await import("../lib/world/repository.ts");
const sync = worldRepository.syncReplayDatasetIndex(index);
closeDatabase();

const result = {
  ok: audit.errorCount === 0,
  indexPath: path.relative(process.cwd(), indexPath).replace(/\\/g, "/"),
  audit,
  summary: index.summary,
  sync
};

if (jsonOnly) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log([
    `Replay catalog sync: ${result.ok ? "ok" : "audit has errors"}`,
    `Store: ${index.storeRoot}`,
    `Index: ${result.indexPath}`,
    `Runs synced: ${sync.syncedRunCount}`,
    `Files synced: ${sync.syncedFileCount}`,
    `Findings synced: ${sync.findingCount}`,
    `Errors: ${audit.errorCount}`,
    `Warnings: ${audit.warningCount}`,
    `Secret leaks: ${audit.secretLeakCount}`,
    `Hidden truth leaks: ${audit.hiddenTruthLeakCount}`
  ].join("\n"));
}

process.exitCode = audit.errorCount > 0 ? 1 : 0;
