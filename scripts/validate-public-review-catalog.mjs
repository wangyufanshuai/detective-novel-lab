import { validatePublicReviewCatalog } from "./public-review-catalog-lib.mjs";

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const json = hasFlag("json");
const catalogRoot = argValue("catalog-root", "public/review-catalog");

try {
  const report = validatePublicReviewCatalog({ catalogRoot });
  if (!report.ok) throw new Error(report.errors.join("; "));
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Public review catalog validation: ok`);
    console.log(`Path: ${report.relativePath}`);
    console.log(`Datasets: ${report.catalog?.summary.datasetCount ?? 0}`);
    console.log(`Gate ok: ${report.catalog?.summary.gateOkCount ?? 0}`);
    console.log(`Audit ok: ${report.catalog?.summary.auditOkCount ?? 0}`);
    console.log(`Files: ${report.fileCount}`);
    console.log(`Bytes: ${report.bytes}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  if (json) console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  else console.error(message);
  process.exit(1);
}
