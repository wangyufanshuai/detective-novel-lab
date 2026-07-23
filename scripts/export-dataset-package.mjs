import { exportDatasetPackage } from "../lib/dataset-package.ts";

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const runId = argValue("run");
const datasetId = argValue("dataset", "detective-town-v3-5000-campaign");
const json = hasFlag("json");

if (!runId) {
  console.error("Missing required --run=<runId>.");
  process.exit(1);
}

try {
  const report = exportDatasetPackage({ runId, datasetId });
  if (json) {
    console.log(JSON.stringify({ ok: true, export: report }, null, 2));
  } else {
    console.log(`Dataset package exported: ${report.datasetId}`);
    console.log(`Path: ${report.relativeExportPath}`);
    console.log(`Files: ${report.fileCount}`);
    console.log(`Bytes: ${report.bytes}`);
    console.log(`Hash: ${report.contentHash}`);
    console.log(`Gate: ${report.gate.ok ? "ok" : "failed"}`);
  }
} catch (error) {
  if (json) {
    console.log(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, null, 2));
  } else {
    console.error(error instanceof Error ? error.message : "Unknown error");
  }
  process.exit(1);
}
