import { createStablePackHash, validateScenarioPack, type ScenarioPack } from "./scenario-pack";
import { validateTownMapPack, type TownMapPack } from "./town-map-pack";
import {
  catalogToTownRuleRuntimeState,
  validateTownRuleCatalog,
  type TownRuleCatalog,
  type TownResourceKind,
  type TownInstitutionKind
} from "./town-rules";
import type { NPCProfile } from "./world-types";

export type AgentPackAgent = Pick<NPCProfile, "id" | "name" | "role" | "homeLocationId" | "schedule" | "relationships" | "skills" | "alive"> & {
  profession?: string;
  institutionId?: string;
  publicMotive?: string;
  visibleClues?: string[];
  resourceNeeds?: Partial<Record<TownResourceKind, number>>;
};

export type AgentPack = {
  manifest: {
    id: string;
    name: string;
    version: string;
    schemaVersion: "agent-pack.v1";
    createdAt: string;
    description?: string;
  };
  agents: AgentPackAgent[];
};

export type EcosystemFaction = {
  id: string;
  name: string;
  institutionKind: TownInstitutionKind;
  pressureBias: number;
  resourceBias: Partial<Record<TownResourceKind, number>>;
  preferredCaseTypes: string[];
};

export type EcosystemResource = {
  kind: TownResourceKind;
  label: string;
  valueDelta: number;
  pressureDelta: number;
};

export type EcosystemTaskTemplate = {
  id: string;
  label: string;
  institutionKind: TownInstitutionKind;
  tags: string[];
  pressureDelta: number;
  evidenceKinds: string[];
};

export type EcosystemCatalog = {
  manifest: {
    id: string;
    name: string;
    version: string;
    schemaVersion: "ecosystem-catalog.v1";
    createdAt: string;
    description?: string;
  };
  factions: EcosystemFaction[];
  resources: EcosystemResource[];
  markets: Array<{ id: string; label: string; resource: TownResourceKind; volatility: number; tags: string[] }>;
  territories: Array<{ id: string; locationId: string; factionId: string; influence: number; tags: string[] }>;
  taskTemplates: EcosystemTaskTemplate[];
  randomWorldEvents: Array<{ id: string; label: string; weight: number; tags: string[]; pressureDelta: number }>;
  pressureRules: Array<{ id: string; resource: TownResourceKind; threshold: number; effect: string }>;
};

export type WorldPackageManifest = {
  id: string;
  name: string;
  version: string;
  schemaVersion: "world-package.v1";
  description?: string;
  author?: string;
  createdAt: string;
  license: string;
  scenarioPackPath: "scenario-pack.json";
  mapPackPath: "map-pack.json";
  ruleCatalogPath: "rule-catalog.json";
  agentPackPath: "agent-pack.json";
  ecosystemCatalogPath: "ecosystem-catalog.json";
  expectationsPath: "expectations.json";
};

export type WorldPackageFiles = {
  "manifest.json": unknown;
  "scenario-pack.json": unknown;
  "map-pack.json": unknown;
  "rule-catalog.json": unknown;
  "agent-pack.json": unknown;
  "ecosystem-catalog.json": unknown;
  "expectations.json": unknown;
  "README.md"?: unknown;
  "ATTRIBUTION.md"?: unknown;
};

export type WorldPackage = {
  manifest: WorldPackageManifest;
  scenarioPack: ScenarioPack;
  mapPack: TownMapPack;
  ruleCatalog: TownRuleCatalog;
  agentPack: AgentPack;
  ecosystemCatalog: EcosystemCatalog;
  expectations: unknown;
};

export type WorldPackageValidationReport = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    packageId?: string;
    scenarioPackId?: string;
    mapPackId?: string;
    ruleCatalogId?: string;
    agentPackId?: string;
    ecosystemCatalogId?: string;
    agentCount: number;
    factionCount: number;
    resourceCount: number;
    taskTemplateCount: number;
    randomWorldEventCount: number;
  };
  package?: WorldPackage;
  hash?: string;
};

function parseMaybeJson(value: unknown, fileName: string, errors: string[]) {
  if (typeof value !== "string") return value;
  if (fileName.endsWith(".md")) return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    errors.push(`${fileName} is not valid JSON`);
    return null;
  }
}

function hasAbsolutePath(value: string) {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("/") || value.startsWith("\\\\");
}

function scanUnsafe(value: unknown, path = "$", errors: string[] = []) {
  if (typeof value === "string") {
    if (/sk-[a-z0-9]/i.test(value) || /authorization:\s*bearer/i.test(value)) errors.push(`${path} may contain a secret`);
    if (/api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token/i.test(path)) errors.push(`${path} may contain a secret`);
    if (hasAbsolutePath(value)) errors.push(`${path} contains an absolute path`);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => scanUnsafe(item, `${path}[${index}]`, errors));
  } else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (/api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token/i.test(key)) errors.push(`${path}.${key} may contain a secret`);
      if (["runtime", "snapshot", "checkpoint", "benchmarkLatest", "hiddenDebugLog", "agent_state_snapshot"].includes(key)) {
        errors.push(`${path}.${key} contains runtime-only state`);
      }
      if (key === "truth" || key === "culpritId") errors.push(`${path}.${key} may contain hidden truth`);
      scanUnsafe(nested, `${path}.${key}`, errors);
    }
  }
  return errors;
}

function validateManifest(value: unknown, errors: string[]) {
  const manifest = value as Partial<WorldPackageManifest>;
  if (!manifest || typeof manifest !== "object") {
    errors.push("manifest.json must be an object");
    return null;
  }
  if (!manifest.id) errors.push("manifest.id is required");
  if (!manifest.name) errors.push("manifest.name is required");
  if (manifest.schemaVersion !== "world-package.v1") errors.push("manifest.schemaVersion must be world-package.v1");
  if (!manifest.license) errors.push("manifest.license is required");
  if (manifest.scenarioPackPath !== "scenario-pack.json") errors.push("manifest.scenarioPackPath must be scenario-pack.json");
  if (manifest.mapPackPath !== "map-pack.json") errors.push("manifest.mapPackPath must be map-pack.json");
  if (manifest.ruleCatalogPath !== "rule-catalog.json") errors.push("manifest.ruleCatalogPath must be rule-catalog.json");
  if (manifest.agentPackPath !== "agent-pack.json") errors.push("manifest.agentPackPath must be agent-pack.json");
  if (manifest.ecosystemCatalogPath !== "ecosystem-catalog.json") errors.push("manifest.ecosystemCatalogPath must be ecosystem-catalog.json");
  if (manifest.expectationsPath !== "expectations.json") errors.push("manifest.expectationsPath must be expectations.json");
  return manifest as WorldPackageManifest;
}

export function validateAgentPack(pack: unknown) {
  const candidate = pack as Partial<AgentPack>;
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!candidate || typeof candidate !== "object") errors.push("agent pack must be an object");
  if (candidate.manifest?.schemaVersion !== "agent-pack.v1") errors.push("agent-pack manifest.schemaVersion must be agent-pack.v1");
  if (!candidate.manifest?.id) errors.push("agent-pack manifest.id is required");
  if (!candidate.agents?.length) errors.push("agent-pack agents must not be empty");
  const ids = new Set<string>();
  for (const agent of candidate.agents || []) {
    if (!agent.id) errors.push("agent.id is required");
    if (agent.id && ids.has(agent.id)) errors.push(`agent ${agent.id} is duplicated`);
    if (agent.id) ids.add(agent.id);
    if (!agent.homeLocationId) errors.push(`agent ${agent.id || "(missing id)"} homeLocationId is required`);
    if (agent.visibleClues?.some((clue) => /culprit|hidden truth|truth\.culprit/i.test(clue))) errors.push(`agent ${agent.id || "(missing id)"} visibleClues may leak hidden truth`);
  }
  errors.push(...scanUnsafe(candidate));
  return { ok: errors.length === 0, errors: Array.from(new Set(errors)), warnings, pack: errors.length === 0 ? candidate as AgentPack : null };
}

export function validateEcosystemCatalog(catalog: unknown) {
  const candidate = catalog as Partial<EcosystemCatalog>;
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!candidate || typeof candidate !== "object") errors.push("ecosystem catalog must be an object");
  if (candidate.manifest?.schemaVersion !== "ecosystem-catalog.v1") errors.push("ecosystem manifest.schemaVersion must be ecosystem-catalog.v1");
  if (!candidate.manifest?.id) errors.push("ecosystem manifest.id is required");
  if (!candidate.factions?.length) errors.push("ecosystem factions must not be empty");
  if (!candidate.resources?.length) warnings.push("ecosystem resources are empty");
  if (!candidate.taskTemplates?.length) warnings.push("ecosystem taskTemplates are empty");
  const factionIds = new Set((candidate.factions || []).map((faction) => faction.id));
  for (const faction of candidate.factions || []) {
    if (!faction.id) errors.push("faction.id is required");
    if (!faction.institutionKind) errors.push(`faction ${faction.id || "(missing id)"} institutionKind is required`);
    if (!Number.isFinite(faction.pressureBias)) errors.push(`faction ${faction.id || "(missing id)"} pressureBias must be numeric`);
  }
  for (const territory of candidate.territories || []) {
    if (territory.factionId && !factionIds.has(territory.factionId)) errors.push(`territory ${territory.id || "(missing id)"} references missing faction ${territory.factionId}`);
  }
  for (const event of candidate.randomWorldEvents || []) {
    if (!event.id) errors.push("randomWorldEvents.id is required");
    if (!Number.isFinite(event.weight) || event.weight < 0) errors.push(`randomWorldEvent ${event.id || "(missing id)"} weight must be non-negative`);
  }
  errors.push(...scanUnsafe(candidate));
  return { ok: errors.length === 0, errors: Array.from(new Set(errors)), warnings: Array.from(new Set(warnings)), catalog: errors.length === 0 ? candidate as EcosystemCatalog : null };
}

export function validateWorldPackageFiles(files: Partial<WorldPackageFiles>): WorldPackageValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const required: Array<keyof WorldPackageFiles> = [
    "manifest.json",
    "scenario-pack.json",
    "map-pack.json",
    "rule-catalog.json",
    "agent-pack.json",
    "ecosystem-catalog.json",
    "expectations.json",
    "README.md"
  ];
  for (const fileName of required) {
    if (!(fileName in files)) errors.push(`${fileName} is required`);
  }
  const parsed = Object.fromEntries(
    Object.entries(files).map(([fileName, value]) => [fileName, parseMaybeJson(value, fileName, errors)])
  ) as Partial<WorldPackageFiles>;
  errors.push(...scanUnsafe(parsed));
  const manifest = validateManifest(parsed["manifest.json"], errors);
  if (manifest?.license && !manifest.license.startsWith("project-local") && !("ATTRIBUTION.md" in files)) {
    warnings.push("ATTRIBUTION.md is recommended for non-project-local package licenses");
  }
  const scenarioValidation = validateScenarioPack(parsed["scenario-pack.json"]);
  const mapValidation = validateTownMapPack(parsed["map-pack.json"]);
  const ruleValidation = validateTownRuleCatalog(parsed["rule-catalog.json"]);
  const agentValidation = validateAgentPack(parsed["agent-pack.json"]);
  const ecosystemValidation = validateEcosystemCatalog(parsed["ecosystem-catalog.json"]);
  if (!scenarioValidation.ok) errors.push(...scenarioValidation.errors.map((error) => `scenario-pack.json: ${error}`));
  if (!mapValidation.ok) errors.push(...mapValidation.errors.map((error) => `map-pack.json: ${error}`));
  if (!ruleValidation.ok) errors.push(...ruleValidation.errors.map((error) => `rule-catalog.json: ${error}`));
  if (!agentValidation.ok) errors.push(...agentValidation.errors.map((error) => `agent-pack.json: ${error}`));
  if (!ecosystemValidation.ok) errors.push(...ecosystemValidation.errors.map((error) => `ecosystem-catalog.json: ${error}`));
  warnings.push(...scenarioValidation.warnings.map((warning) => `scenario-pack.json: ${warning}`));
  warnings.push(...mapValidation.warnings.map((warning) => `map-pack.json: ${warning}`));
  warnings.push(...ruleValidation.warnings.map((warning) => `rule-catalog.json: ${warning}`));
  warnings.push(...agentValidation.warnings.map((warning) => `agent-pack.json: ${warning}`));
  warnings.push(...ecosystemValidation.warnings.map((warning) => `ecosystem-catalog.json: ${warning}`));
  const uniqueErrors = Array.from(new Set(errors));
  const ok = uniqueErrors.length === 0;
  const worldPackage = ok ? {
    manifest: manifest!,
    scenarioPack: parsed["scenario-pack.json"] as ScenarioPack,
    mapPack: parsed["map-pack.json"] as TownMapPack,
    ruleCatalog: parsed["rule-catalog.json"] as TownRuleCatalog,
    agentPack: parsed["agent-pack.json"] as AgentPack,
    ecosystemCatalog: parsed["ecosystem-catalog.json"] as EcosystemCatalog,
    expectations: parsed["expectations.json"]
  } : undefined;
  return {
    ok,
    errors: uniqueErrors,
    warnings: Array.from(new Set(warnings)),
    summary: {
      packageId: manifest?.id,
      scenarioPackId: scenarioValidation.summary.packId,
      mapPackId: mapValidation.summary.packId,
      ruleCatalogId: ruleValidation.summary.catalogId,
      agentPackId: (parsed["agent-pack.json"] as Partial<AgentPack> | undefined)?.manifest?.id,
      ecosystemCatalogId: (parsed["ecosystem-catalog.json"] as Partial<EcosystemCatalog> | undefined)?.manifest?.id,
      agentCount: (parsed["agent-pack.json"] as Partial<AgentPack> | undefined)?.agents?.length || 0,
      factionCount: (parsed["ecosystem-catalog.json"] as Partial<EcosystemCatalog> | undefined)?.factions?.length || 0,
      resourceCount: (parsed["ecosystem-catalog.json"] as Partial<EcosystemCatalog> | undefined)?.resources?.length || 0,
      taskTemplateCount: (parsed["ecosystem-catalog.json"] as Partial<EcosystemCatalog> | undefined)?.taskTemplates?.length || 0,
      randomWorldEventCount: (parsed["ecosystem-catalog.json"] as Partial<EcosystemCatalog> | undefined)?.randomWorldEvents?.length || 0
    },
    package: worldPackage,
    hash: worldPackage ? createStablePackHash(worldPackage) : undefined
  };
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function applyEcosystemCatalogToRuleCatalog(ruleCatalog: TownRuleCatalog, ecosystem: EcosystemCatalog): TownRuleCatalog {
  const next: TownRuleCatalog = JSON.parse(JSON.stringify(ruleCatalog)) as TownRuleCatalog;
  for (const resource of ecosystem.resources || []) {
    const target = next.resources.find((item) => item.kind === resource.kind);
    if (target) {
      target.value = clamp(target.value + resource.valueDelta);
      target.pressure = clamp(target.pressure + resource.pressureDelta);
    }
  }
  for (const faction of ecosystem.factions || []) {
    const target = next.institutions.find((institution) => institution.kind === faction.institutionKind);
    if (target) {
      target.pressure = clamp(target.pressure + faction.pressureBias);
      target.policyPressure = clamp(target.policyPressure + Math.ceil(faction.pressureBias / 2));
      for (const [resourceKind, delta] of Object.entries(faction.resourceBias || {}) as Array<[TownResourceKind, number]>) {
        const resource = next.resources.find((item) => item.kind === resourceKind);
        if (resource) resource.value = clamp(resource.value + delta);
      }
    }
  }
  for (const event of ecosystem.randomWorldEvents || []) {
    if (!next.randomEvents.some((item) => item.id === event.id)) {
      next.randomEvents.push({ id: event.id, label: event.label, weight: event.weight, tags: [...event.tags] });
    }
  }
  for (const rule of ecosystem.pressureRules || []) {
    if (!next.casePressureRules.some((item) => item.id === rule.id)) next.casePressureRules.push({ ...rule });
  }
  const validation = validateTownRuleCatalog(next);
  if (!validation.ok) throw new Error(`Ecosystem rule catalog injection failed: ${validation.errors.join("; ")}`);
  catalogToTownRuleRuntimeState(next, 0);
  return next;
}
