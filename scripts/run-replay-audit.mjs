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
const jsonOnly = hasFlag("json");
const strict = hasFlag("strict");

const { index, audit } = await buildReplayDatasetIndex({ storeDir });
const indexPath = await writeReplayDatasetIndex(index, storeDir);
const exitCode = audit.errorCount > 0 || (strict && audit.warningCount > 0) ? 1 : 0;
const displayIndexPath = path.relative(process.cwd(), indexPath).replace(/\\/g, "/");

if (jsonOnly) {
  console.log(JSON.stringify({ ok: exitCode === 0, indexPath: displayIndexPath, audit, summary: index.summary }, null, 2));
} else {
  console.log([
    `Replay audit: ${exitCode === 0 ? "ok" : "failed"}`,
    `Store: ${index.storeRoot}`,
    `Index: ${displayIndexPath}`,
    `Runs: ${audit.checkedRunCount}`,
    `Files: ${index.summary.indexedFileCount}`,
    `Errors: ${audit.errorCount}`,
    `Warnings: ${audit.warningCount}`,
    `Secret leaks: ${audit.secretLeakCount}`,
    `Hidden truth leaks: ${audit.hiddenTruthLeakCount}`
  ].join("\n"));
  const important = audit.findings
    .filter((finding) => finding.severity === "error" || strict)
    .slice(0, 30);
  if (important.length) {
    console.log("\nFindings:");
    for (const finding of important) {
      console.log(`- [${finding.severity}] ${finding.runId}/${finding.file || ""} ${finding.code}: ${finding.message}`);
    }
  }
  if (audit.findings.length > important.length) {
    console.log(`- ... ${audit.findings.length - important.length} more finding(s) in index.json`);
  }
}

process.exitCode = exitCode;
