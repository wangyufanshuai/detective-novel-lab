import path from "node:path";
import { exportStaticDatasetReader, readDatasetPackageReader, validateDatasetPackage } from "../lib/dataset-package.ts";
import { assertInside, scanPublicTextFiles, toPosix, validateAllowedFileSet, validatePublicCaseSummaryIndexFile } from "./public-artifact-safety-lib.mjs";

const DEFAULT_PACKAGE_PATH = "outputs/dataset-packages/detective-town-v3-5000-campaign";
const DEFAULT_STATIC_PATH = "public/dataset-reader/detective-town-v3-5000-campaign";

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function scanPublicReader(relativePath) {
  const root = process.cwd();
  const target = path.resolve(root, relativePath);
  const rootPublic = path.resolve(root, "public", "dataset-reader");
  assertInside(rootPublic, target, "Static reader scan path");
  const label = toPosix(path.relative(root, target));
  const allowed = validateAllowedFileSet({ dir: target, allowedFiles: ["case-summary-index.json", "dataset-card.md", "manifest-lite.json", "reader-index.json"], label });
  const scan = scanPublicTextFiles({ dir: target, label });
  const caseSummary = validatePublicCaseSummaryIndexFile({ filePath: path.join(target, "case-summary-index.json"), label: `${label}/case-summary-index.json` });
  return {
    ok: allowed.ok && scan.ok && caseSummary.ok,
    findings: [...allowed.errors, ...scan.errors, ...caseSummary.errors].map((message) => ({ file: label, message }))
  };
}

const packagePath = argValue("path", DEFAULT_PACKAGE_PATH);
const datasetId = argValue("dataset", "");
const json = hasFlag("json");

try {
  const validation = validateDatasetPackage({ path: packagePath });
  if (!validation.ok) throw new Error(`Dataset package validation failed: ${validation.errors.join("; ")}`);

  const exported = exportStaticDatasetReader({ path: packagePath, datasetId: datasetId || undefined });
  const reader = readDatasetPackageReader({ path: exported.relativeExportPath || DEFAULT_STATIC_PATH });
  if (!reader.ok) throw new Error(`Static reader read failed: ${reader.validation?.errors?.join("; ") || "unknown error"}`);

  const scan = scanPublicReader(exported.relativeExportPath || DEFAULT_STATIC_PATH);
  if (!scan.ok) throw new Error(`Static reader safety scan failed: ${scan.findings.map((item) => `${item.file}: ${item.message}`).join("; ")}`);

  const report = {
    ok: true,
    datasetId: reader.datasetId,
    sourceRunId: reader.sourceRunId,
    staticReaderPath: exported.relativeExportPath,
    fileCount: reader.fileCount,
    bytes: exported.bytes,
    readerIndexHash: reader.readerIndexHash,
    caseSummaryIndexHash: reader.caseSummaryIndexHash,
    caseSummary: reader.caseSummary,
    gate: reader.gate,
    audit: reader.audit,
    summary: reader.summary,
    safetyScan: { ok: true, findingCount: 0 }
  };

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("Static reader QA: ok");
    console.log(`Dataset: ${report.datasetId}`);
    console.log(`Source run: ${report.sourceRunId}`);
    console.log(`Path: ${report.staticReaderPath}`);
    console.log(`Files: ${report.fileCount}`);
    console.log(`Bytes: ${report.bytes}`);
    console.log(`Reader hash: ${report.readerIndexHash}`);
    console.log(`Gate: ${report.gate.ok ? "ok" : "failed"} (${report.gate.tickCount} ticks, ${report.gate.uniqueCases} cases, ${report.gate.distinctCaseTypeCount} case types)`);
    console.log(`Audit: errors ${report.audit.errorCount}, warnings ${report.audit.warningCount}, secret leaks ${report.audit.secretLeakCount}, hidden truth leaks ${report.audit.hiddenTruthLeakCount}`);
    console.log(`Reader summary: ${report.summary.caseGraph.nodeCount} case nodes / ${report.summary.evidenceGraph.nodeCount} evidence nodes`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  if (json) console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  else console.error(message);
  process.exit(1);
}
