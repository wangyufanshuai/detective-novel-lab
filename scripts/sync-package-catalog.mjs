import { buildPackageCatalogIndex, writePackageCatalogIndex } from "../lib/world-package-catalog.ts";
import { worldRepository } from "../lib/world/repository.ts";

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const root = argValue("root", process.cwd());
const json = hasFlag("json");
const index = buildPackageCatalogIndex(root);
const indexPath = writePackageCatalogIndex(index);
const sync = worldRepository.syncPackageCatalogIndex(index);

const output = {
  ok: index.summary.invalidPackageCount === 0,
  indexPath,
  summary: index.summary,
  sync: { ...sync, indexPath }
};

if (json) {
  console.log(JSON.stringify(output, null, 2));
} else {
  console.log(`Package catalog synced: ${sync.syncedPackageCount} package(s), ${sync.validPackageCount} valid, ${sync.invalidPackageCount} invalid.`);
  console.log(`Index: ${indexPath}`);
}

if (!output.ok) process.exitCode = 1;
