export type PackageCatalogKind = "world-package" | "experiment-folder";

export type PackageCatalogValidationSummary = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export type PackageCatalogEntry = {
  packageId: string;
  kind: PackageCatalogKind;
  source: "world-packs" | "experiments";
  name: string;
  version: string;
  status: "valid" | "invalid";
  directoryName: string;
  relativePath: string;
  contentHash?: string;
  pathHash?: string;
  license?: string;
  attribution?: string;
  scenarioPackId?: string;
  mapPackId?: string;
  ruleCatalogId?: string;
  agentPackId?: string;
  ecosystemCatalogId?: string;
  validation: PackageCatalogValidationSummary;
  metrics: {
    fileCount: number;
    bytes: number;
    factionCount?: number;
    resourceCount?: number;
    taskTemplateCount?: number;
    randomWorldEventCount?: number;
    agentCount?: number;
  };
  syncedAt?: string;
};

export type PackageCatalogIndex = {
  schemaVersion: 1;
  generatedAt: string;
  root: string;
  packages: PackageCatalogEntry[];
  summary: {
    packageCount: number;
    validPackageCount: number;
    invalidPackageCount: number;
    byKind: Record<string, number>;
    bySource: Record<string, number>;
  };
};

export type PackageCatalogSyncResult = {
  syncedPackageCount: number;
  validPackageCount: number;
  invalidPackageCount: number;
  generatedAt: string;
  indexPath?: string;
};

export type PackageCatalogListResult = {
  packages: PackageCatalogEntry[];
  total: number;
  summary: PackageCatalogIndex["summary"] & { lastSyncedAt?: string };
};

export type PackageCatalogDetail = {
  package: PackageCatalogEntry;
};
