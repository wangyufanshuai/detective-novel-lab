import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { ReplayDatasetIndex } from "@/lib/replay-catalog-types";
import { worldRepository } from "@/lib/world/repository";

const execFileAsync = promisify(execFile);

function replayStoreDir(input?: string | null) {
  const requested = input || path.join("data", "replay-store");
  const resolved = path.resolve(/*turbopackIgnore: true*/ process.cwd(), requested);
  const workspace = path.resolve(/*turbopackIgnore: true*/ process.cwd());
  if (resolved !== workspace && !resolved.startsWith(`${workspace}${path.sep}`)) {
    throw new Error("Replay store must be inside the current workspace.");
  }
  return resolved;
}

export function readReplayDatasetIndex(store?: string | null): ReplayDatasetIndex {
  const storeDir = replayStoreDir(store);
  const indexPath = path.join(storeDir, "index.json");
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Replay dataset index not found at ${path.relative(/*turbopackIgnore: true*/ process.cwd(), indexPath).replace(/\\/g, "/")}. Run replay audit first.`);
  }
  return JSON.parse(fs.readFileSync(indexPath, "utf8")) as ReplayDatasetIndex;
}

export async function syncReplayCatalogFromStore(input: { store?: string | null } = {}) {
  const storeDir = replayStoreDir(input.store);
  const scriptPath = path.join(/*turbopackIgnore: true*/ process.cwd(), "scripts", "run-replay-audit.mjs");
  let auditCommand = { ok: true, stdout: "", stderr: "" };
  try {
    const result = await execFileAsync(process.execPath, [scriptPath, `--store=${storeDir}`, "--json"], {
      cwd: process.cwd(),
      env: process.env,
      timeout: 120_000,
      windowsHide: true
    });
    auditCommand = { ok: true, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    auditCommand = {
      ok: false,
      stdout: typeof error === "object" && error && "stdout" in error ? String(error.stdout) : "",
      stderr: error instanceof Error ? error.message : "Replay audit command failed."
    };
  }
  const index = readReplayDatasetIndex(storeDir);
  const sync = worldRepository.syncReplayDatasetIndex(index);
  return {
    auditCommand,
    audit: index.audit,
    summary: index.summary,
    generatedAt: index.generatedAt,
    storeRoot: index.storeRoot,
    sync
  };
}
