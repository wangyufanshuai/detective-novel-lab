import { buildPublicReviewCatalog } from "./public-review-catalog-lib.mjs";

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const json = hasFlag("json");
const readerRoot = argValue("reader-root", "public/dataset-reader");
const catalogRoot = argValue("catalog-root", "public/review-catalog");
const contentRoot = argValue("content-root", "content/detective-v1");

try {
  const report = buildPublicReviewCatalog({ readerRoot, catalogRoot, contentRoot });
  if (!report.ok) throw new Error(report.errors.join("; "));
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Public review catalog built: ${report.relativePath}`);
    console.log(`Datasets: ${report.catalog?.summary.datasetCount ?? 0}`);
    console.log(`Source runs: ${report.catalog?.summary.sourceRunCount ?? 0}`);
    console.log(`World packages: ${report.catalog?.summary.worldPackageCount ?? 0}`);
    console.log(`Content tables: ${report.catalog?.contentSummary?.caseTypeCount ?? 0} case types`);
    console.log(`Files: ${report.fileCount}`);
    console.log(`Bytes: ${report.bytes}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  if (json) console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  else console.error(message);
  process.exit(1);
}
