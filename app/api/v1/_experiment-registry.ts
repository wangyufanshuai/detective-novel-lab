import fs from "node:fs";
import path from "node:path";
import {
  createStablePackHash,
  validateExperimentFolderFiles,
  type ExperimentDiscoveryResult,
  type ExperimentFolderFiles
} from "@/lib/engine";

const REQUIRED_FILES = [
  "manifest.json",
  "steps.json",
  "scenario-pack.json",
  "map-pack.json",
  "rule-catalog.json",
  "expectations.json",
  "README.md"
] as const;

export type ExperimentRegistryEntry = {
  id: string;
  name: string;
  version: string;
  source: "experiment-folder";
  experimentId: string;
  experimentHash?: string;
  experimentPathHash: string;
  directoryName: string;
  scenarioPackId?: string;
  mapPackId?: string;
  ruleCatalogId?: string;
  validationOk: boolean;
  validationSummary: {
    errors: string[];
    warnings: string[];
  };
  discovery: ExperimentDiscoveryResult;
};

function safeDirectoryName(input: string) {
  return input.replace(/[^a-z0-9._-]/gi, "-");
}

function workspaceRoot() {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd());
}

function experimentsRoot() {
  return path.join(/*turbopackIgnore: true*/ workspaceRoot(), "experiments");
}

function readExperimentFiles(dir: string) {
  const files: Partial<ExperimentFolderFiles> = {};
  for (const fileName of REQUIRED_FILES) {
    const filePath = path.join(/*turbopackIgnore: true*/ dir, fileName);
    if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
      files[fileName] = fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf8");
    }
  }
  return files;
}

export function listExperimentRegistryEntries(): ExperimentRegistryEntry[] {
  const root = experimentsRoot();
  if (!fs.existsSync(/*turbopackIgnore: true*/ root)) return [];
  return fs.readdirSync(/*turbopackIgnore: true*/ root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const directoryName = safeDirectoryName(entry.name);
      const experimentDir = path.join(/*turbopackIgnore: true*/ root, entry.name);
      const discovery = validateExperimentFolderFiles(readExperimentFiles(experimentDir));
      const experimentId = discovery.experimentId || directoryName;
      const experimentPathHash = createStablePackHash({ directoryName, files: REQUIRED_FILES });
      return {
        id: experimentId,
        name: discovery.manifest?.name || experimentId,
        version: discovery.manifest?.version || "0.0.0",
        source: "experiment-folder" as const,
        experimentId,
        experimentHash: discovery.hash,
        experimentPathHash,
        directoryName,
        scenarioPackId: discovery.scenarioPack?.manifest.id,
        mapPackId: discovery.mapPack?.manifest.id,
        ruleCatalogId: discovery.ruleCatalog?.id,
        validationOk: discovery.ok,
        validationSummary: {
          errors: discovery.errors,
          warnings: discovery.warnings
        },
        discovery
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function findExperimentRegistryEntryByPackIds(input: {
  scenarioPackId?: string;
  mapPackId?: string;
  ruleCatalogId?: string;
}) {
  return listExperimentRegistryEntries().find((entry) =>
    (!input.scenarioPackId || entry.scenarioPackId === input.scenarioPackId || entry.experimentId === input.scenarioPackId) &&
    (!input.mapPackId || entry.mapPackId === input.mapPackId) &&
    (!input.ruleCatalogId || entry.ruleCatalogId === input.ruleCatalogId)
  ) || null;
}

export function findExperimentRegistryEntryById(experimentId: string) {
  return listExperimentRegistryEntries().find((entry) => entry.experimentId === experimentId || entry.scenarioPackId === experimentId) || null;
}
