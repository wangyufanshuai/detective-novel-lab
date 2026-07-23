import { validateDatasetPackage } from "../lib/dataset-package.ts";

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

const report = validateDatasetPackage({ path: packagePath });
if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Dataset package validation: ${report.ok ? "ok" : "failed"}`);
  console.log(`Path: ${report.relativePath}`);
  console.log(`Files: ${report.fileCount}`);
  console.log(`Bytes: ${report.bytes}`);
  console.log(`Errors: ${report.errors.length}`);
  console.log(`Warnings: ${report.warnings.length}`);
  for (const error of report.errors.slice(0, 8)) console.log(`- ${error}`);
}
process.exit(report.ok ? 0 : 1);
