export type DatasetPackageFile = {
  path: string;
  bytes: number;
  sha256: string;
  role: "manifest" | "card" | "snapshot" | "audit" | "run-metadata" | "world-package" | "reader" | "checksum";
};

export type DatasetGateSummary = {
  tickCount: number;
  uniqueCases: number;
  distinctCaseTypeCount: number;
  candidateRepeatRate: number;
  laterCaseInfluenceRate: number;
  evidenceGraphWarnings: number;
  runtimeMs: number;
  ok: boolean;
};

export type DatasetPackageManifest = {
  schemaVersion: "dataset-package.v1";
  datasetId: string;
  title: string;
  generatedAt: string;
  sourceRunId: string;
  sourceRunKind: string;
  replayIndexSnapshotPath: "replay-index.snapshot.json";
  packageIndexSnapshotPath: "package-index.snapshot.json";
  auditReportPath: "audit-report.json";
  datasetCardPath: "dataset-card.md";
  readerIndexPath?: "reader-index.json";
  checksumPath: "checksums.sha256";
  contentHash: string;
  fileCount: number;
  bytes: number;
  gate: DatasetGateSummary;
  audit: {
    ok: boolean;
    errorCount: number;
    warningCount: number;
    secretLeakCount: number;
    hiddenTruthLeakCount: number;
  };
  files: DatasetPackageFile[];
  readerSummary?: DatasetReaderSummary;
  readerIndexHash?: string;
  worldPackages: Array<{
    packageId: string;
    name: string;
    version: string;
    license?: string;
    relativePath: string;
    contentHash?: string;
  }>;
};

export type DatasetReaderDistributionItem = {
  id: string;
  count: number;
};

export type PublicCaseSummaryIndexItem = {
  publicCaseId: string;
  sourceCaseHash: string;
  ordinal: number;
  tick: number;
  caseType: string;
  outcome: string;
  locationId: string;
  institutionCount: number;
  evidenceCount: number;
  evidenceWarningCount: number;
  evidenceComplete: boolean;
  laterInfluence: {
    incomingEdgeCount: number;
    outgoingEdgeCount: number;
    incomingStrengthTotal: number;
    outgoingStrengthTotal: number;
  };
  edgeTypeCounts: DatasetReaderDistributionItem[];
};

export type PublicCaseSummaryIndex = {
  schemaVersion: "public-case-summary-index.v1";
  datasetId: string;
  sourceRunId: string;
  generatedAt: string;
  caseCount: number;
  cases: PublicCaseSummaryIndexItem[];
  summary: {
    caseCount: number;
    caseTypeCount: number;
    locationCount: number;
    evidenceCompleteCount: number;
    evidenceWarningCaseCount: number;
    totalEvidenceCount: number;
    laterInfluencedCaseCount: number;
    edgeTypeDistribution: DatasetReaderDistributionItem[];
  };
};

export type DatasetReaderSummary = {
  caseCount: number;
  solvedCaseCount: number;
  failedCaseCount: number;
  distinctCaseTypeCount: number;
  topCaseTypes: DatasetReaderDistributionItem[];
  distinctEvidenceTypeCount: number;
  topEvidenceTypes: DatasetReaderDistributionItem[];
  caseGraph: {
    nodeCount: number;
    edgeCount: number;
    influencedLaterCaseCount: number;
    laterCaseInfluenceRate: number;
    topEdgeTypes: DatasetReaderDistributionItem[];
  };
  evidenceGraph: {
    nodeCount: number;
    edgeCount: number;
    evidenceNodeCount: number;
    caseNodeCount: number;
    warningCount: number;
    completeEvidenceCaseCount: number;
    resolvedEvidenceCaseCount: number;
    completenessRate: number;
  };
  worldPackageCount: number;
};

export type DatasetReaderIndex = {
  schemaVersion: "dataset-reader.v1";
  datasetId: string;
  sourceRunId: string;
  generatedAt: string;
  gate: DatasetGateSummary;
  audit: DatasetPackageManifest["audit"];
  summary: DatasetReaderSummary;
  caseTypeDistribution: DatasetReaderDistributionItem[];
  evidenceTypeDistribution: DatasetReaderDistributionItem[];
  worldPackages: Array<{
    packageId: string;
    name: string;
    version: string;
    license?: string;
    contentHash?: string;
  }>;
  files: Array<{
    path: string;
    bytes: number;
    sha256: string;
    role: DatasetPackageFile["role"];
  }>;
};

export type StaticDatasetReaderManifest = {
  schemaVersion: "static-dataset-reader.v1";
  datasetId: string;
  sourceRunId: string;
  generatedAt: string;
  contentHash: string;
  readerIndexHash: string;
  caseSummaryIndexPath?: "case-summary-index.json";
  caseSummaryIndexHash?: string;
  fileCount: number;
  bytes: number;
  readerIndexPath: "reader-index.json";
  datasetCardPath: "dataset-card.md";
  gate: DatasetGateSummary;
  audit: DatasetPackageManifest["audit"];
  readerSummary: DatasetReaderSummary;
};

export type StaticDatasetReaderExportReport = {
  ok: boolean;
  datasetId: string;
  relativeExportPath: string;
  contentHash: string;
  readerIndexHash: string;
  caseSummaryIndexPath?: string;
  caseSummaryIndexHash?: string;
  fileCount: number;
  bytes: number;
  gate: DatasetGateSummary;
  audit: DatasetPackageManifest["audit"];
  readerSummary: DatasetReaderSummary;
  warnings: string[];
};

export type PublicReviewCatalogDataset = {
  datasetId: string;
  title: string;
  sourceRunId: string;
  generatedAt: string;
  staticPath: string;
  manifestPath: string;
  readerIndexPath: string;
  datasetCardPath: string;
  caseSummaryIndexPath?: string;
  contentHash: string;
  readerIndexHash: string;
  caseSummaryIndexHash?: string;
  caseSummaryCount?: number;
  fileCount: number;
  bytes: number;
  gate: DatasetGateSummary;
  audit: DatasetPackageManifest["audit"];
  readerSummary: DatasetReaderSummary;
  caseTypeDistribution: DatasetReaderDistributionItem[];
  evidenceTypeDistribution: DatasetReaderDistributionItem[];
  worldPackages: DatasetReaderIndex["worldPackages"];
};

export type PublicStableWorldSummary = {
  schemaVersion: "public-stable-world-summary.v1";
  generatedAt: string;
  sourceRunId: string;
  sourceKind: string;
  ticks: number;
  seeds: string[];
  seedCount: number;
  gate: {
    ok: boolean;
    passedSeedCount: number;
    failedSeedCount: number;
    worstCandidateRepeatRate: number;
    lowestDistinctCaseTypeCount: number;
    lowestSelectedActionKindCount: number;
    highestLargestSelectedActionShare: number;
    lowestInstitutionDecisionCount: number;
    minRuntimeMs: number;
    maxRuntimeMs: number;
  };
  deterministicRunHashes: Record<string, string>;
  diagnostics: {
    ok: boolean;
    overallStatus: string;
    findingCounts: Record<string, number>;
    blockerCount: number;
    riskCount: number;
    watchCount: number;
  };
  regression: {
    baselineAvailable: boolean;
    ok: boolean;
    overallStatus: string;
    deltaCounts: Record<string, number>;
    blockedCount: number;
    regressedCount: number;
    watchCount: number;
  };
  aggregate: {
    repeatRate: number;
    caseTypeCount: number;
    actionKindCount: number;
    largestActionShare: number;
    institutionDecisionCount: number;
    evidenceWarningCount: number;
    laterInfluenceRate: number;
  };
  artifactFiles: Array<{
    name: string;
    bytes: number;
    sha256: string;
  }>;
  publicBoundary: {
    sanitizedBenchmarkSummary: boolean;
    artifactBodiesIncluded: false;
    localPathsIncluded: false;
    excludedBodies: string[];
  };
};

export type PublicCaseQualitySummary = {
  schemaVersion: "public-case-quality-summary.v1";
  generatedAt: string;
  sourceRunId: string;
  sourceKind: "stable-world-case-quality";
  ticks: number;
  seeds: string[];
  seedCount: number;
  nonBlocking: true;
  overallStatus: "ok" | "watch" | "risk";
  averageScore: number;
  minScore: number;
  statusCounts: Record<"ok" | "watch" | "risk", number>;
  dimensionAverages: Record<string, number>;
  dimensionMinimums: Record<string, number>;
  perSeed: Array<{
    seed: string;
    status: "ok" | "watch" | "risk";
    score: number;
    caseCount: number;
    solvedCaseCount: number;
    distinctCaseTypeCount: number;
    evidenceCompleteCaseCount: number;
    evidenceWarningCount: number;
    laterCaseInfluenceRate: number;
    institutionDecisionCount: number;
    repeatRate: number;
    deterministicRunHash: string;
  }>;
  deterministicRunHashes: Record<string, string>;
  artifactFiles: Array<{
    name: string;
    bytes: number;
    sha256: string;
  }>;
  publicBoundary: {
    sanitizedBenchmarkSummary: boolean;
    artifactBodiesIncluded: false;
    localPathsIncluded: false;
    excludedBodies: string[];
  };
};

export type PublicWorldSystemInfluenceSummary = {
  schemaVersion: "public-world-system-influence-summary.v1";
  generatedAt: string;
  sourceKind: "world-system-influence-audit";
  seedCount: number;
  tickCount: number;
  aggregate: {
    appliedBiasCount: number;
    maxBias: number;
    hintedActionShare: number;
    institutionLabelCoverage: number;
    validCandidateTrendDelta: number;
    actionKindDelta: Record<string, number>;
  };
  safety: {
    maxBiasOk: boolean;
    noLegalCandidateLoss: boolean;
    deterministicHashOk: boolean;
    publicSafe: boolean;
  };
  perSeed: Array<{
    seed: string;
    tickCount: number;
    hintedActionShare: number;
    appliedBiasCount: number;
    maxBias: number;
    validCandidateTrendDelta: number;
    deterministicHash: string;
  }>;
  publicBoundary: {
    sanitizedAuditSummary: true;
    rawBodiesIncluded: false;
    rawIdsIncluded: false;
    localPathsIncluded: false;
    runtimeAuthority: false;
    excludedBodies: string[];
  };
};

export type PublicReviewCatalog = {
  schemaVersion: "public-review-catalog.v1";
  generatedAt: string;
  summary: {
    datasetCount: number;
    sourceRunCount: number;
    worldPackageCount: number;
    gateOkCount: number;
    auditOkCount: number;
    totalBytes: number;
    latestGeneratedAt?: string;
    caseCount: number;
    distinctCaseTypeCount: number;
    evidenceNodeCount: number;
    publicCaseSummaryCount?: number;
  };
  publicBoundary: {
    staticOnly: true;
    apiRoutesAllowed: false;
    artifactBodiesIncluded: false;
    allowedFetchPrefixes: string[];
  };
  contentSummary?: {
    packId?: string;
    schemaVersion?: "detective-content-pack.v1";
    tableCounts: Record<string, number>;
    caseTypeCount: number;
    evidenceTypeCount: number;
    locationCount: number;
    roleCount: number;
    motiveCount: number;
    redHerringPatternCount: number;
    escalationRuleCount: number;
    resourceCount?: number;
    factionCount?: number;
    eventArchetypeCount?: number;
    progressionLineCount?: number;
    worldSystemCount?: number;
    worldSystemRecordCount?: number;
    coverage: {
      caseTypesWithEvidence: number;
      caseTypesWithRoles: number;
      caseTypesWithMotives: number;
      evidenceTypesWithCases: number;
      rolesWithCases: number;
      motivesWithCases: number;
      resourcesWithCases?: number;
      resourcesWithRoles?: number;
      factionsWithResources?: number;
      eventArchetypesWithFactions?: number;
      progressionLinesWithEvents?: number;
      worldSystemsWithRefs?: number;
    };
    validation: {
      ok: boolean;
      errorCount: number;
      warningCount: number;
    };
  };
  stableWorldSummaryPath?: string;
  stableWorldSummaryHash?: string;
  stableWorld?: PublicStableWorldSummary;
  caseQualitySummaryPath?: string;
  caseQualitySummaryHash?: string;
  caseQuality?: PublicCaseQualitySummary;
  worldSystemInfluenceSummaryPath?: string;
  worldSystemInfluenceSummaryHash?: string;
  worldSystemInfluence?: PublicWorldSystemInfluenceSummary;
  datasets: PublicReviewCatalogDataset[];
};

export type DatasetPackageExportReport = {
  ok: boolean;
  datasetId: string;
  relativeExportPath: string;
  manifestPath: "dataset-manifest.json";
  contentHash: string;
  fileCount: number;
  bytes: number;
  gate: DatasetGateSummary;
  audit: DatasetPackageManifest["audit"];
  readerSummary?: DatasetReaderSummary;
  readerIndexHash?: string;
  warnings: string[];
};

export type DatasetPackageValidationReport = {
  ok: boolean;
  datasetId?: string;
  relativePath: string;
  fileCount: number;
  bytes: number;
  errors: string[];
  warnings: string[];
  gate?: DatasetGateSummary;
  audit?: DatasetPackageManifest["audit"];
  readerSummary?: DatasetReaderSummary;
};

export type DatasetPackageListResult = {
  packages: DatasetPackageManifest[];
  total: number;
  summary: {
    packageCount: number;
    totalBytes: number;
    validPackageCount: number;
    latestGeneratedAt?: string;
  };
};
