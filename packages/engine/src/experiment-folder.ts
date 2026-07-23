import { createStablePackHash, validateScenarioPack, type ScenarioPack, type ScenarioPackValidationReport } from "./scenario-pack";
import { validateTownMapPack, type TownMapPack, type TownMapPackValidationReport } from "./town-map-pack";
import { validateTownRuleCatalog, type RuleCatalogValidationReport, type TownRuleCatalog } from "./town-rules";

export type ExperimentFolderManifest = {
  id: string;
  name: string;
  version: string;
  schemaVersion: "experiment-folder.v1";
  description?: string;
  author?: string;
  createdAt: string;
  scenarioPackPath: "scenario-pack.json";
  mapPackPath: "map-pack.json";
  ruleCatalogPath: "rule-catalog.json";
  expectationsPath: "expectations.json";
  stepsPath: "steps.json";
};

export type ExperimentStepPlan = {
  seed: string;
  tickCount: number;
  minimumCaseCount: number;
  checkpointEveryTicks: number;
  qualityGate: {
    minCandidateDiversityScore: number;
    maxCandidateRepeatRate: number;
    minCausalLinkCount: number;
    minCrossCaseInfluenceCount: number;
  };
};

export type ExperimentFolderFiles = {
  "manifest.json": unknown;
  "steps.json": unknown;
  "scenario-pack.json": unknown;
  "map-pack.json": unknown;
  "rule-catalog.json": unknown;
  "expectations.json": unknown;
  "README.md"?: unknown;
};

export type ExperimentDiscoveryResult = {
  ok: boolean;
  experimentId?: string;
  hash?: string;
  errors: string[];
  warnings: string[];
  manifest?: ExperimentFolderManifest;
  steps?: ExperimentStepPlan;
  scenarioPack?: ScenarioPack;
  mapPack?: TownMapPack;
  ruleCatalog?: TownRuleCatalog;
  validations: {
    scenarioPack?: ScenarioPackValidationReport;
    mapPack?: TownMapPackValidationReport;
    ruleCatalog?: RuleCatalogValidationReport;
  };
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
    if (/sk-[a-z0-9]/i.test(value) || /api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token/i.test(path)) errors.push(`${path} may contain a secret`);
    if (hasAbsolutePath(value)) errors.push(`${path} contains an absolute path`);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => scanUnsafe(item, `${path}[${index}]`, errors));
  } else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (["runtime", "snapshot", "checkpoint", "benchmarkLatest", "hiddenDebugLog", "agent_state_snapshot"].includes(key)) {
        errors.push(`${path}.${key} contains runtime-only state`);
      }
      scanUnsafe(nested, `${path}.${key}`, errors);
    }
  }
  return errors;
}

function validateManifest(value: unknown, errors: string[]) {
  const manifest = value as Partial<ExperimentFolderManifest>;
  if (!manifest || typeof manifest !== "object") {
    errors.push("manifest.json must be an object");
    return null;
  }
  if (!manifest.id) errors.push("manifest.id is required");
  if (!manifest.name) errors.push("manifest.name is required");
  if (manifest.schemaVersion !== "experiment-folder.v1") errors.push("manifest.schemaVersion must be experiment-folder.v1");
  if (manifest.scenarioPackPath !== "scenario-pack.json") errors.push("manifest.scenarioPackPath must be scenario-pack.json");
  if (manifest.mapPackPath !== "map-pack.json") errors.push("manifest.mapPackPath must be map-pack.json");
  if (manifest.ruleCatalogPath !== "rule-catalog.json") errors.push("manifest.ruleCatalogPath must be rule-catalog.json");
  if (manifest.expectationsPath !== "expectations.json") errors.push("manifest.expectationsPath must be expectations.json");
  if (manifest.stepsPath !== "steps.json") errors.push("manifest.stepsPath must be steps.json");
  return manifest as ExperimentFolderManifest;
}

function validateSteps(value: unknown, errors: string[]) {
  const steps = value as Partial<ExperimentStepPlan>;
  if (!steps || typeof steps !== "object") {
    errors.push("steps.json must be an object");
    return null;
  }
  if (!steps.seed) errors.push("steps.seed is required");
  if (!Number.isFinite(steps.tickCount) || Number(steps.tickCount) <= 0) errors.push("steps.tickCount must be positive");
  if (!Number.isFinite(steps.minimumCaseCount) || Number(steps.minimumCaseCount) <= 0) errors.push("steps.minimumCaseCount must be positive");
  if (!Number.isFinite(steps.checkpointEveryTicks) || Number(steps.checkpointEveryTicks) <= 0) errors.push("steps.checkpointEveryTicks must be positive");
  const gate = steps.qualityGate;
  if (!gate) errors.push("steps.qualityGate is required");
  if (gate) {
    if (!Number.isFinite(gate.minCandidateDiversityScore)) errors.push("steps.qualityGate.minCandidateDiversityScore must be numeric");
    if (!Number.isFinite(gate.maxCandidateRepeatRate)) errors.push("steps.qualityGate.maxCandidateRepeatRate must be numeric");
    if (!Number.isFinite(gate.minCausalLinkCount)) errors.push("steps.qualityGate.minCausalLinkCount must be numeric");
    if (!Number.isFinite(gate.minCrossCaseInfluenceCount)) errors.push("steps.qualityGate.minCrossCaseInfluenceCount must be numeric");
  }
  return steps as ExperimentStepPlan;
}

export function validateExperimentFolderFiles(files: Partial<ExperimentFolderFiles>): ExperimentDiscoveryResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const required: Array<keyof ExperimentFolderFiles> = [
    "manifest.json",
    "steps.json",
    "scenario-pack.json",
    "map-pack.json",
    "rule-catalog.json",
    "expectations.json",
    "README.md"
  ];
  for (const fileName of required) {
    if (!(fileName in files)) errors.push(`${fileName} is required`);
  }
  const parsed = Object.fromEntries(
    Object.entries(files).map(([fileName, value]) => [fileName, parseMaybeJson(value, fileName, errors)])
  ) as Partial<ExperimentFolderFiles>;
  errors.push(...scanUnsafe(parsed));
  const manifest = validateManifest(parsed["manifest.json"], errors);
  const steps = validateSteps(parsed["steps.json"], errors);
  const scenarioValidation = validateScenarioPack(parsed["scenario-pack.json"]);
  const mapValidation = validateTownMapPack(parsed["map-pack.json"]);
  const ruleValidation = validateTownRuleCatalog(parsed["rule-catalog.json"]);
  if (!scenarioValidation.ok) errors.push(...scenarioValidation.errors.map((error) => `scenario-pack.json: ${error}`));
  if (!mapValidation.ok) errors.push(...mapValidation.errors.map((error) => `map-pack.json: ${error}`));
  if (!ruleValidation.ok) errors.push(...ruleValidation.errors.map((error) => `rule-catalog.json: ${error}`));
  warnings.push(...scenarioValidation.warnings.map((warning) => `scenario-pack.json: ${warning}`));
  warnings.push(...mapValidation.warnings.map((warning) => `map-pack.json: ${warning}`));
  warnings.push(...ruleValidation.warnings.map((warning) => `rule-catalog.json: ${warning}`));
  if (manifest && scenarioValidation.summary.packId && manifest.id !== scenarioValidation.summary.packId) {
    warnings.push(`manifest.id ${manifest.id} differs from scenario pack id ${scenarioValidation.summary.packId}`);
  }
  const uniqueErrors = Array.from(new Set(errors));
  const ok = uniqueErrors.length === 0;
  const scenarioPack = ok ? parsed["scenario-pack.json"] as ScenarioPack : undefined;
  const mapPack = ok ? parsed["map-pack.json"] as TownMapPack : undefined;
  const ruleCatalog = ok ? parsed["rule-catalog.json"] as TownRuleCatalog : undefined;
  const hash = ok ? createStablePackHash({
    manifest,
    steps,
    scenarioPack,
    mapPack,
    ruleCatalog,
    expectations: parsed["expectations.json"]
  }) : undefined;
  return {
    ok,
    experimentId: manifest?.id,
    hash,
    errors: uniqueErrors,
    warnings: Array.from(new Set(warnings)),
    manifest: ok ? manifest || undefined : manifest || undefined,
    steps: ok ? steps || undefined : steps || undefined,
    scenarioPack,
    mapPack,
    ruleCatalog,
    validations: {
      scenarioPack: scenarioValidation,
      mapPack: mapValidation,
      ruleCatalog: ruleValidation
    }
  };
}
