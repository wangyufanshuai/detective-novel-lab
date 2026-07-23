import { readDatasetPackageReader } from "../lib/dataset-package.ts";

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const packagePath = argValue("path");
const json = hasFlag("json");

if (!packagePath) {
  console.error("Missing required --path=<dataset-package-path>.");
  process.exit(1);
}

const report = readDatasetPackageReader({ path: packagePath });
if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Dataset reader: ${report.ok ? "ok" : "failed"}`);
  if (report.ok) {
    console.log(`Dataset: ${report.datasetId}`);
    console.log(`Source run: ${report.sourceRunId}`);
    console.log(`Gate: ${report.gate.ok ? "ok" : "failed"}`);
    console.log(`Cases: ${report.summary.caseCount}`);
    console.log(`Case types: ${report.summary.distinctCaseTypeCount}`);
    console.log(`Evidence types: ${report.summary.distinctEvidenceTypeCount}`);
    console.log(`Case graph: ${report.summary.caseGraph.nodeCount} nodes / ${report.summary.caseGraph.edgeCount} edges`);
    console.log(`Evidence graph: ${report.summary.evidenceGraph.nodeCount} nodes / ${report.summary.evidenceGraph.edgeCount} edges`);
    console.log(`World packages: ${report.summary.worldPackageCount}`);
    console.log(`Reader hash: ${report.readerIndexHash}`);
  } else {
    for (const error of report.validation.errors.slice(0, 8)) console.log(`- ${error}`);
  }
}

process.exit(report.ok ? 0 : 1);
