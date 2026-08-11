import fs from "node:fs";
import path from "node:path";
import { sha256, writeJson } from "./lib/v10-release.mjs";

const root = process.cwd();
const jsonMode = process.argv.includes("--json");
const outputArg = process.argv.find((value) => value.startsWith("--output="));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const lockText = fs.readFileSync(path.join(root, "package-lock.json"), "utf8");
const lock = JSON.parse(lockText);
const lockRoot = lock.packages?.[""] || {};
const errors = [];

if (lock.lockfileVersion !== 3) errors.push(`lockfileVersion ${lock.lockfileVersion} is not supported`);
if (lockRoot.name !== packageJson.name || lockRoot.version !== packageJson.version) errors.push("package-lock root identity does not match package.json");

const rootKinds = [
  ["production", packageJson.dependencies || {}, lockRoot.dependencies || {}],
  ["development", packageJson.devDependencies || {}, lockRoot.devDependencies || {}]
];
const directDependencies = [];
for (const [kind, declared, lockedRoot] of rootKinds) {
  for (const name of Object.keys(declared).sort((left, right) => left.localeCompare(right))) {
    if (lockedRoot[name] !== declared[name]) errors.push(`${kind} dependency ${name} differs between package.json and package-lock.json`);
    const locked = lock.packages?.[`node_modules/${name}`];
    if (!locked?.version) errors.push(`${kind} dependency ${name} has no locked version`);
    directDependencies.push({
      name,
      kind,
      requested: declared[name],
      version: locked?.version || "missing",
      license: locked?.license || "missing"
    });
  }
}

const packages = Object.entries(lock.packages || {})
  .filter(([location]) => Boolean(location))
  .map(([location, metadata]) => ({ location, ...metadata }));
const licenseCounts = {};
let productionPackageCount = 0;
let developmentPackageCount = 0;
let optionalPackageCount = 0;
for (const dependency of packages) {
  if (!dependency.version) errors.push(`${dependency.location} has no locked version`);
  if (!dependency.license) errors.push(`${dependency.location} has no declared license`);
  if (dependency.resolved && !String(dependency.resolved).startsWith("https://")) errors.push(`${dependency.location} does not use an HTTPS registry source`);
  if (dependency.resolved && !dependency.integrity) errors.push(`${dependency.location} has no integrity digest`);
  if (dependency.integrity && !/^sha(?:256|384|512)-/i.test(dependency.integrity)) errors.push(`${dependency.location} has an unsupported integrity digest`);
  const license = dependency.license || "missing";
  licenseCounts[license] = (licenseCounts[license] || 0) + 1;
  if (dependency.dev) developmentPackageCount += 1;
  else productionPackageCount += 1;
  if (dependency.optional) optionalPackageCount += 1;
}

for (const forbidden of ["UNLICENSED", "SEE LICENSE IN"]) {
  if (Object.keys(licenseCounts).some((license) => license.toUpperCase().startsWith(forbidden))) errors.push(`dependency license requires manual resolution: ${forbidden}`);
}

const summary = {
  formatVersion: 1,
  releaseLine: "v10.0",
  project: { name: packageJson.name, version: packageJson.version, license: "MIT" },
  lockfile: { version: lock.lockfileVersion, sha256: sha256(lockText) },
  directDependencies,
  inventory: {
    lockedPackageCount: packages.length,
    productionPackageCount,
    developmentPackageCount,
    optionalPackageCount,
    licenseCounts: Object.fromEntries(Object.entries(licenseCounts).sort(([left], [right]) => left.localeCompare(right)))
  },
  policies: {
    exactLockedVersions: true,
    registrySourcesRequireHttps: true,
    registryEntriesRequireIntegrity: true,
    everyLockedPackageRequiresLicense: true
  },
  ok: errors.length === 0,
  errors
};

if (outputArg) {
  const output = path.resolve(root, outputArg.slice("--output=".length));
  const allowedRoot = path.resolve(root, "outputs");
  if (output !== allowedRoot && !output.startsWith(`${allowedRoot}${path.sep}`)) throw new Error("Supply-chain output must stay inside outputs/.");
  writeJson(output, summary);
}

console.log(jsonMode ? JSON.stringify(summary) : JSON.stringify(summary, null, 2));
if (!summary.ok) process.exitCode = 1;
