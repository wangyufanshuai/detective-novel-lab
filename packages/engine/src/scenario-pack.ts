import { createPersistentTownRuntime, type ScenarioConfig } from "./persistent-town";
import type { NPCProfile, WorldLocation, WorldState } from "./world-types";
import { catalogToTownRuleRuntimeState, createDefaultTownRuleCatalog, validateTownRuleCatalog, type TownInstitution, type TownProfession, type TownRuleCatalog } from "./town-rules";
import { townMapPackToLocations, validateTownMapPack, type TownMapPack } from "./town-map-pack";
import type { WorldAssetManifest } from "./world-package";

export type ScenarioPackManifest = {
  id: string;
  name: string;
  version: string;
  schemaVersion: "scenario-pack.v1";
  author?: string;
  description?: string;
  createdAt: string;
  entrypoint: "scenario.json";
};

export type ScenarioPackWorld = {
  seed: string;
  mode: WorldState["mode"];
  timelineHours: number;
  locations: WorldLocation[];
  npcs: NPCProfile[];
  institutions: TownInstitution[];
  professions: TownProfession[];
};

export type ScenarioPackRules = {
  enabledModules: Array<"institutions" | "professions" | "long-actions" | "public-opinion" | "evidence-contamination" | "case-aftermath">;
  phaseConfig: { snapshotEveryTicks: number; maxRunningLongActions: number };
  thresholds: {
    maxEvidenceContamination: number;
    maxPublicOpinionHeat: number;
    minInstitutionTrust: number;
  };
  longActionKinds: string[];
};

export type ScenarioPackExpectations = {
  minValidCandidates: number;
  minEvidenceCoverage: number;
  maxEvidenceContamination: number;
  maxPublicOpinionHeat: number;
  benchmarkPreset?: "quick-10" | "full-20";
};

export type ScenarioPack = {
  manifest: ScenarioPackManifest;
  world: ScenarioPackWorld;
  rules: ScenarioPackRules;
  scenario: ScenarioConfig;
  expectations: ScenarioPackExpectations;
  assets?: Record<string, string>;
  docs?: Record<string, string>;
};

export type ScenarioPackValidationReport = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    packId?: string;
    npcCount: number;
    locationCount: number;
    institutionCount: number;
    hasSeed: boolean;
    hasScenario: boolean;
  };
};

export type PackRegistryEntry = {
  id: string;
  kind: "scenario" | "map" | "rule-catalog";
  name: string;
  version: string;
  source: "built-in" | "imported" | "experiment-folder";
  current?: boolean;
  hash?: string;
  importedAt?: string;
  experimentId?: string;
  experimentHash?: string;
  worldPackageId?: string;
  worldPackageHash?: string;
  validationOk?: boolean;
};

export type WorldPackageReceipt = {
  schema: "world-package-receipt.v1";
  packageId: string;
  version: string;
  license: string;
  sourceRelativePath: string;
  contentHash: string;
  receiptHash: string;
  fileCount: number;
  bytes: number;
  files: Array<{ name: string; bytes: number; sha256: string }>;
  bindings: {
    scenarioPackId?: string;
    mapPackId?: string;
    ruleCatalogId?: string;
    agentPackId?: string;
    ecosystemCatalogId?: string;
  };
  validation: {
    ok: boolean;
    errors: string[];
    warnings: string[];
  };
  assetManifest?: WorldAssetManifest;
};

export type CurrentExperimentRef = {
  scenarioPackId: string;
  mapPackId: string;
  ruleCatalogId: string;
  selectedAt: string;
  experimentId?: string;
  experimentHash?: string;
  experimentPathHash?: string;
  worldPackageId?: string;
  worldPackageHash?: string;
  worldPackageReceipt?: WorldPackageReceipt;
  agentPackId?: string;
  ecosystemCatalogId?: string;
  sourceWorldId?: string;
  branchWorldId?: string;
  runId?: string;
  scenarioPackHash?: string;
  mapPackHash?: string;
  ruleCatalogHash?: string;
  engineVersion?: string;
};

export type ScenarioPackRunSource = {
  sourceWorldId?: string;
  branchWorldId: string;
  runId: string;
  scenarioPackId: string;
  scenarioPackHash: string;
  mapPackId: string;
  mapPackHash: string;
  ruleCatalogId: string;
  ruleCatalogHash: string;
  engineVersion: string;
};

export type PackRunManifest = ScenarioPackRunSource & {
  createdAt: string;
  scenarioSeed: string;
  npcCount: number;
  locationCount: number;
};

function nowIso() {
  return new Date().toISOString();
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function createStablePackHash(value: unknown) {
  const text = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `h${(hash >>> 0).toString(36)}`;
}

function slug(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "scenario-pack";
}

function hasAbsolutePath(value: string) {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("/") || value.startsWith("\\\\");
}

function scanUnsafe(value: unknown, path = "$", errors: string[] = []) {
  if (typeof value === "string") {
    if (/sk-[a-z0-9]/i.test(value) || /api[_-]?key/i.test(path)) errors.push(`${path} may contain a secret`);
    if (hasAbsolutePath(value)) errors.push(`${path} contains an absolute path`);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => scanUnsafe(item, `${path}[${index}]`, errors));
  } else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (["runtime", "snapshot", "benchmarkLatest", "hiddenDebugLog", "agent_state_snapshot"].includes(key)) {
        errors.push(`${path}.${key} contains runtime-only state`);
      }
      scanUnsafe(nested, `${path}.${key}`, errors);
    }
  }
  return errors;
}

export function createScenarioPackFromWorld(world: WorldState, scenario: ScenarioConfig = {}, options: Partial<Pick<ScenarioPackManifest, "id" | "name" | "author" | "description">> = {}): ScenarioPack {
  const ruleState = catalogToTownRuleRuntimeState(createDefaultTownRuleCatalog(world, 0), 0);
  const name = options.name || scenario.name || "Small Town Review";
  const id = options.id || slug(name);
  return {
    manifest: {
      id,
      name,
      version: "1.0.0",
      schemaVersion: "scenario-pack.v1",
      author: options.author,
      description: options.description || "Portable detective town scenario pack.",
      createdAt: nowIso(),
      entrypoint: "scenario.json"
    },
    world: {
      seed: scenario.seed || world.seed,
      mode: world.mode,
      timelineHours: world.timelineHours || 24,
      locations: world.locations.map((location) => ({ ...location, connectedLocationIds: [...location.connectedLocationIds] })),
      npcs: world.npcs.map((npc) => ({
        ...npc,
        schedule: { ...npc.schedule },
        relationships: { ...npc.relationships },
        skills: [...npc.skills],
        memoryEventIds: [...npc.memoryEventIds]
      })),
      institutions: ruleState.institutions,
      professions: ruleState.professions
    },
    rules: {
      enabledModules: ["institutions", "professions", "long-actions", "public-opinion", "evidence-contamination", "case-aftermath"],
      phaseConfig: { snapshotEveryTicks: 1, maxRunningLongActions: 8 },
      thresholds: { maxEvidenceContamination: 70, maxPublicOpinionHeat: 80, minInstitutionTrust: 35 },
      longActionKinds: [
        "investigate-scene",
        "file-police-report",
        "publish-rumor",
        "suppress-story",
        "tamper-evidence",
        "protect-witness",
        "bribe-witness",
        "conduct-autopsy",
        "audit-ledger",
        "family-pressure"
      ]
    },
    scenario: {
      id: scenario.id || id,
      name,
      seed: scenario.seed || world.seed,
      worldOptions: scenario.worldOptions || { mode: world.mode, npcCount: world.npcs.length, timelineHours: world.timelineHours || 24 },
      baselineSteps: scenario.baselineSteps || 12,
      branches: scenario.branches || [],
      passCriteria: scenario.passCriteria || { minValidCandidates: 1, minEventGrowth: 1, minMemoryGrowth: 1 }
    },
    expectations: {
      minValidCandidates: scenario.passCriteria?.minValidCandidates ?? 1,
      minEvidenceCoverage: 80,
      maxEvidenceContamination: 70,
      maxPublicOpinionHeat: 80,
      benchmarkPreset: "quick-10"
    },
    assets: {},
    docs: {
      "README.md": `# ${name}\n\n${options.description || "Portable detective town scenario pack."}\n`
    }
  };
}

function cloneLocation(location: WorldLocation): WorldLocation {
  return { ...location, connectedLocationIds: [...(location.connectedLocationIds || [])] };
}

function cloneNpc(npc: NPCProfile): NPCProfile {
  return {
    ...npc,
    schedule: { ...npc.schedule },
    relationships: { ...npc.relationships },
    skills: [...npc.skills],
    memoryEventIds: [...npc.memoryEventIds]
  };
}

function applyMapConnections(locations: WorldLocation[], mapPack: TownMapPack) {
  const byId = new Map(locations.map((location) => [location.id, cloneLocation(location)]));
  for (const connection of mapPack.connections || []) {
    const from = byId.get(connection.from);
    const to = byId.get(connection.to);
    if (!from || !to) continue;
    if (!from.connectedLocationIds.includes(to.id)) from.connectedLocationIds.push(to.id);
    if (!to.connectedLocationIds.includes(from.id)) to.connectedLocationIds.push(from.id);
  }
  return Array.from(byId.values());
}

export function createWorldFromScenarioPack(
  pack: ScenarioPack,
  mapPack: TownMapPack,
  ruleCatalog: TownRuleCatalog,
  options: { sourceWorldId?: string; runId?: string; branchWorldId?: string; engineVersion?: string } = {}
) {
  const packValidation = validateScenarioPack(pack);
  if (!packValidation.ok) throw new Error(`Invalid ScenarioPack: ${packValidation.errors.join("; ")}`);
  const mapValidation = validateTownMapPack(mapPack);
  if (!mapValidation.ok) throw new Error(`Invalid TownMapPack: ${mapValidation.errors.join("; ")}`);
  const ruleValidation = validateTownRuleCatalog(ruleCatalog);
  if (!ruleValidation.ok) throw new Error(`Invalid TownRuleCatalog: ${ruleValidation.errors.join("; ")}`);
  const now = nowIso();
  const runId = options.runId || `packrun-${pack.manifest.id}-${Date.now().toString(36)}`;
  const branchWorldId = options.branchWorldId || `packrun-${pack.manifest.id}-${runId}`.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const baseLocations = townMapPackToLocations(mapPack).length ? townMapPackToLocations(mapPack) : pack.world.locations.map(cloneLocation);
  const locations = applyMapConnections(baseLocations, mapPack);
  const world: WorldState = {
    id: branchWorldId,
    seed: pack.world.seed,
    name: pack.manifest.name,
    mode: pack.world.mode,
    timelineHours: pack.world.timelineHours,
    day: 1,
    currentTime: "08:00",
    locations,
    npcs: pack.world.npcs.map(cloneNpc),
    memories: [],
    simulationReports: [],
    createdAt: now,
    updatedAt: now
  };
  const runtime = createPersistentTownRuntime(world, []);
  const scenarioPackHash = createStablePackHash(pack);
  const mapPackHash = createStablePackHash(mapPack);
  const ruleCatalogHash = createStablePackHash(ruleCatalog);
  const engineVersion = options.engineVersion || "persistent-town.v1";
  runtime.ruleState = catalogToTownRuleRuntimeState(ruleCatalog, 0);
  runtime.currentScenarioPackId = pack.manifest.id;
  runtime.currentMapPackId = mapPack.manifest.id;
  runtime.currentRuleCatalogId = ruleCatalog.id;
  runtime.currentExperiment = {
    scenarioPackId: pack.manifest.id,
    mapPackId: mapPack.manifest.id,
    ruleCatalogId: ruleCatalog.id,
    selectedAt: now,
    sourceWorldId: options.sourceWorldId,
    branchWorldId,
    runId,
    scenarioPackHash,
    mapPackHash,
    ruleCatalogHash,
    engineVersion
  };
  (world as WorldState & { persistentRuntime?: unknown }).persistentRuntime = runtime;
  const manifest: PackRunManifest = {
    sourceWorldId: options.sourceWorldId,
    branchWorldId,
    runId,
    scenarioPackId: pack.manifest.id,
    scenarioPackHash,
    mapPackId: mapPack.manifest.id,
    mapPackHash,
    ruleCatalogId: ruleCatalog.id,
    ruleCatalogHash,
    engineVersion,
    createdAt: now,
    scenarioSeed: pack.scenario.seed || pack.world.seed,
    npcCount: world.npcs.length,
    locationCount: world.locations.length
  };
  return { world, runtime, manifest, scenarioConfig: scenarioPackToScenarioConfig(pack) };
}

export function builtInScenarioPacks(world: WorldState): ScenarioPack[] {
  return [
    createScenarioPackFromWorld(world, {
      id: "small-town-review",
      name: "Small Town Review",
      seed: `${world.seed}-small-town-review`,
      baselineSteps: 8,
      passCriteria: { minValidCandidates: 0, minEventGrowth: 1, minMemoryGrowth: 1, maxBlockedCandidates: 8 }
    }, { id: "small-town-review", name: "Small Town Review", description: "Fast pack for the five-minute review path." }),
    createScenarioPackFromWorld(world, {
      id: "evidence-contamination-pressure",
      name: "Evidence Contamination Pressure",
      seed: `${world.seed}-evidence-contamination`,
      baselineSteps: 14,
      passCriteria: { minValidCandidates: 1, minEventGrowth: 1, minMemoryGrowth: 1, maxBlockedCandidates: 8 }
    }, { id: "evidence-contamination-pressure", name: "Evidence Contamination Pressure", description: "Longer pack focused on media heat, pressure, and evidence pollution." })
  ];
}

export function validateScenarioPack(pack: unknown): ScenarioPackValidationReport {
  const candidate = pack as Partial<ScenarioPack>;
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!candidate || typeof candidate !== "object") errors.push("pack must be an object");
  if (!candidate.manifest?.id) errors.push("manifest.id is required");
  if (candidate.manifest?.schemaVersion !== "scenario-pack.v1") errors.push("manifest.schemaVersion must be scenario-pack.v1");
  if (candidate.manifest?.entrypoint !== "scenario.json") errors.push("manifest.entrypoint must be scenario.json");
  if (!candidate.world?.seed) errors.push("world.seed is required");
  if (!candidate.world?.locations?.length) errors.push("world.locations must not be empty");
  if (!candidate.world?.npcs?.length) errors.push("world.npcs must not be empty");
  if (!candidate.rules?.enabledModules?.length) warnings.push("rules.enabledModules is empty");
  if (!candidate.scenario) errors.push("scenario is required");
  if (!candidate.scenario?.seed) errors.push("scenario.seed is required");
  if (!candidate.expectations) warnings.push("expectations are missing");
  errors.push(...scanUnsafe(candidate));
  const uniqueErrors = Array.from(new Set(errors));
  return {
    ok: uniqueErrors.length === 0,
    errors: uniqueErrors,
    warnings: Array.from(new Set(warnings)),
    summary: {
      packId: candidate.manifest?.id,
      npcCount: candidate.world?.npcs?.length || 0,
      locationCount: candidate.world?.locations?.length || 0,
      institutionCount: candidate.world?.institutions?.length || 0,
      hasSeed: Boolean(candidate.world?.seed && candidate.scenario?.seed),
      hasScenario: Boolean(candidate.scenario)
    }
  };
}

export function scenarioPackToScenarioConfig(pack: ScenarioPack): ScenarioConfig {
  const validation = validateScenarioPack(pack);
  if (!validation.ok) throw new Error(`Invalid ScenarioPack: ${validation.errors.join("; ")}`);
  return {
    ...pack.scenario,
    id: pack.scenario.id || pack.manifest.id,
    name: pack.scenario.name || pack.manifest.name,
    seed: pack.scenario.seed || pack.world.seed,
    worldOptions: {
      mode: pack.world.mode,
      npcCount: pack.world.npcs.length,
      timelineHours: pack.world.timelineHours,
      ...pack.scenario.worldOptions
    }
  };
}

export function previewScenarioPackImport(pack: unknown) {
  const validation = validateScenarioPack(pack);
  return {
    validation,
    pack: validation.ok ? pack as ScenarioPack : null,
    installable: validation.ok,
    message: validation.ok
      ? `ScenarioPack ${validation.summary.packId} is valid and ready to import.`
      : `ScenarioPack is invalid: ${validation.errors.join("; ")}`
  };
}
