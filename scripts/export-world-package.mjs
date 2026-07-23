import { exportWorldPackage } from "../lib/world-package-catalog.ts";

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const packageId = argValue("package");
const outRoot = argValue("out");
const format = argValue("format", "folder");
const json = hasFlag("json");

if (!packageId) {
  console.error("Missing required --package=<id>.");
  process.exit(1);
}

try {
  const report = exportWorldPackage({
    packageId,
    outRoot: outRoot || undefined,
    format
  });
  if (json) {
    console.log(JSON.stringify({ ok: true, export: report }, null, 2));
  } else {
    console.log(`WorldPackage exported: ${report.packageId}`);
    console.log(`Path: ${report.relativeExportPath}`);
    console.log(`Files: ${report.fileCount}`);
    console.log(`Bytes: ${report.bytes}`);
    console.log(`Hash: ${report.contentHash || "n/a"}`);
    console.log(`Warnings: ${report.validation.warnings.length}`);
  }
} catch (error) {
  if (json) {
    console.log(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, null, 2));
  } else {
    console.error(error instanceof Error ? error.message : "Unknown error");
  }
  process.exit(1);
}
