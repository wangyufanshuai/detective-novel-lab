import { validateDetectiveContentDirectory } from "./detective-content-lib.mjs";

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const json = hasFlag("json");
const contentRoot = argValue("path", "content/detective-v1");
const report = validateDetectiveContentDirectory({ contentRoot });

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Detective content validation: ${report.ok ? "ok" : "failed"}`);
  console.log(`Path: ${report.relativePath}`);
  console.log(`Case types: ${report.summary.caseTypeCount}`);
  console.log(`Evidence types: ${report.summary.evidenceTypeCount}`);
  console.log(`Warnings: ${report.warnings.length}`);
  for (const error of report.errors) console.error(`- ${error}`);
}

if (!report.ok) process.exit(1);
