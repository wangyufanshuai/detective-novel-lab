import { smokeDatasetPackage } from "../lib/dataset-package.ts";

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

const report = smokeDatasetPackage({ path: packagePath });
if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Dataset package smoke: ${report.ok ? "ok" : "failed"}`);
  if (report.ok) {
    console.log(`Dataset: ${report.datasetId}`);
    console.log(`Source run: ${report.sourceRunId}`);
    console.log(`Replay runs: ${report.replayRunCount}`);
    console.log(`Packages: ${report.packageCount}`);
  } else {
    for (const error of report.validation.errors.slice(0, 8)) console.log(`- ${error}`);
  }
}
process.exit(report.ok ? 0 : 1);
