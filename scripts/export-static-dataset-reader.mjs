import { exportStaticDatasetReader } from "../lib/dataset-package.ts";

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const packagePath = argValue("path");
const datasetId = argValue("dataset", "");
const json = hasFlag("json");

if (!packagePath) {
  console.error("Missing required --path=<dataset-package-path>.");
  process.exit(1);
}

try {
  const report = exportStaticDatasetReader({ path: packagePath, datasetId: datasetId || undefined });
  if (json) {
    console.log(JSON.stringify({ ok: true, export: report }, null, 2));
  } else {
    console.log(`Static dataset reader exported: ${report.datasetId}`);
    console.log(`Path: ${report.relativeExportPath}`);
    console.log(`Files: ${report.fileCount}`);
    console.log(`Bytes: ${report.bytes}`);
    console.log(`Reader hash: ${report.readerIndexHash}`);
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
