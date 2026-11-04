import {
  applyEcosystemCatalogToRuleCatalog,
  createStablePackHash,
  type EcosystemCatalog,
  type TownRuleCatalog,
  type WorldPackageReceipt
} from "@/lib/engine";
import { buildPackageCatalogIndex, readWorldPackageSource } from "@/lib/world-package-catalog";

type WorldPackageDiscovery = NonNullable<ReturnType<typeof loadWorldPackage>>;

export type WorldPackageRegistryEntry = {
  id: string;
  name: string;
  version: string;
  source: "world-package";
  worldPackageId: string;
  worldPackageHash: string;
  worldPackageReceipt: WorldPackageReceipt;
  directoryName: string;
  scenarioPackId?: string;
  mapPackId?: string;
  ruleCatalogId?: string;
  agentPackId?: string;
  ecosystemCatalogId?: string;
  validationOk: boolean;
  validationSummary: {
    errors: string[];
    warnings: string[];
  };
  discovery: WorldPackageDiscovery;
};

function loadWorldPackage(packageId: string) {
  const source = readWorldPackageSource(packageId);
  if (!source) return null;
  return {
    ...source.validation,
    fileCount: source.fileCount,
    bytes: source.bytes,
    fileReceipts: source.fileReceipts,
    sourceRelativePath: source.relativePath,
    directoryName: source.directoryName
  };
}

export function listWorldPackageRegistryEntries(): WorldPackageRegistryEntry[] {
  const index = buildPackageCatalogIndex();
  return index.packages
    .filter((entry) => entry.kind === "world-package")
    .map((entry) => {
      const discovery = loadWorldPackage(entry.packageId) || {
        ok: false,
        errors: [`WorldPackage ${entry.packageId} could not be loaded.`],
        warnings: [],
        summary: {
          packageId: entry.packageId,
          scenarioPackId: "",
          mapPackId: "",
          ruleCatalogId: "",
          agentPackId: "",
          ecosystemCatalogId: "",
          agentCount: 0,
          factionCount: 0,
          resourceCount: 0,
          taskTemplateCount: 0,
          randomWorldEventCount: 0,
          assetCount: 0
        },
        package: undefined,
        hash: undefined,
        fileCount: 0,
        bytes: 0,
        fileReceipts: [],
        sourceRelativePath: `world-packs/${entry.directoryName}`,
        directoryName: entry.directoryName
      };
      const injectedRuleCatalog = discovery.package
        ? applyEcosystemCatalogToRuleCatalog(
            discovery.package.ruleCatalog as TownRuleCatalog,
            discovery.package.ecosystemCatalog as EcosystemCatalog
          )
        : null;
      const enriched = discovery.package && injectedRuleCatalog
        ? {
            ...discovery,
            package: {
              ...discovery.package,
              ruleCatalog: injectedRuleCatalog
            },
            hash: createStablePackHash({
              ...discovery.package,
              ruleCatalog: injectedRuleCatalog
            })
          }
        : discovery;
      const worldPackageHash = enriched.hash || entry.contentHash;
      const hashErrors = worldPackageHash ? [] : ["WorldPackage content hash is required before selection or replay."];
      const receiptPayload = {
        schema: "world-package-receipt.v1" as const,
        packageId: entry.packageId,
        version: entry.version,
        license: typeof enriched.package?.manifest?.license === "string" ? enriched.package.manifest.license : "unknown",
        sourceRelativePath: enriched.sourceRelativePath,
        contentHash: worldPackageHash || "",
        fileCount: enriched.fileCount,
        bytes: enriched.bytes,
        files: enriched.fileReceipts,
        bindings: {
          scenarioPackId: enriched.summary.scenarioPackId,
          mapPackId: enriched.summary.mapPackId,
          ruleCatalogId: enriched.summary.ruleCatalogId,
          agentPackId: enriched.summary.agentPackId,
          ecosystemCatalogId: enriched.summary.ecosystemCatalogId
        },
        validation: {
          ok: enriched.ok && hashErrors.length === 0,
          errors: [...enriched.errors, ...hashErrors],
          warnings: enriched.warnings
        },
        ...(enriched.package?.assetManifest ? { assetManifest: enriched.package.assetManifest } : {})
      };
      const worldPackageReceipt: WorldPackageReceipt = {
        ...receiptPayload,
        receiptHash: createStablePackHash(receiptPayload)
      };
      return {
        id: entry.packageId,
        name: entry.name,
        version: entry.version,
        source: "world-package" as const,
        worldPackageId: entry.packageId,
        worldPackageHash: worldPackageHash || "",
        worldPackageReceipt,
        directoryName: entry.directoryName,
        scenarioPackId: enriched.summary.scenarioPackId,
        mapPackId: enriched.summary.mapPackId,
        ruleCatalogId: enriched.summary.ruleCatalogId,
        agentPackId: enriched.summary.agentPackId,
        ecosystemCatalogId: enriched.summary.ecosystemCatalogId,
        validationOk: enriched.ok && hashErrors.length === 0,
        validationSummary: {
          errors: [...enriched.errors, ...hashErrors],
          warnings: enriched.warnings
        },
        discovery: enriched
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function findWorldPackageRegistryEntryById(packageId: string) {
  return listWorldPackageRegistryEntries().find((entry) =>
    entry.worldPackageId === packageId ||
    entry.scenarioPackId === packageId ||
    entry.mapPackId === packageId ||
    entry.ruleCatalogId === packageId
  ) || null;
}

export function findWorldPackageRegistryEntryByPackIds(input: {
  scenarioPackId?: string;
  mapPackId?: string;
  ruleCatalogId?: string;
}) {
  return listWorldPackageRegistryEntries().find((entry) =>
    (!input.scenarioPackId || entry.scenarioPackId === input.scenarioPackId || entry.worldPackageId === input.scenarioPackId) &&
    (!input.mapPackId || entry.mapPackId === input.mapPackId) &&
    (!input.ruleCatalogId || entry.ruleCatalogId === input.ruleCatalogId)
  ) || null;
}
