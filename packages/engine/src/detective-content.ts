import type { InstitutionStrategy, LongActionKind, TownInstitutionKind } from "./town-rules";

export type DetectiveContentManifest = {
  id: string;
  name: string;
  version: string;
  schemaVersion: "detective-content-pack.v1";
  createdAt: string;
  description?: string;
};

export type DetectiveCaseTypeRow = {
  id: string;
  label: string;
  family: string;
  tags: string[];
  evidenceTypeIds: string[];
  roleIds: string[];
  motiveIds: string[];
  weight: number;
  authoredCluster?: string;
  contrastKey?: string;
  campaignTags?: string[];
};

export type DetectiveLocationRow = {
  id: string;
  label: string;
  kind: string;
  tags: string[];
  caseTypeIds: string[];
  evidenceTypeIds: string[];
  weight: number;
};

export type DetectiveRoleRow = {
  id: string;
  label: string;
  kind: string;
  tags: string[];
  motiveIds: string[];
  caseTypeIds: string[];
  publicDescription: string;
};

export type DetectiveMotiveRow = {
  id: string;
  label: string;
  category: string;
  tags: string[];
  caseTypeIds: string[];
  roleIds: string[];
  publicDescription: string;
};

export type DetectiveEvidenceTypeRow = {
  id: string;
  label: string;
  kind: string;
  tags: string[];
  caseTypeIds: string[];
  contaminationRisk: number;
  publicDescription: string;
};

export type DetectiveRedHerringPatternRow = {
  id: string;
  label: string;
  caseTypeIds: string[];
  evidenceTypeIds: string[];
  roleIds: string[];
  risk: number;
  publicDescription: string;
};

export type DetectiveEscalationRuleRow = {
  id: string;
  label: string;
  triggerTags: string[];
  caseTypeIds: string[];
  evidenceTypeIds: string[];
  publicEffect: string;
  weight: number;
};

export type DetectiveResourceRow = {
  id: string;
  label: string;
  kind: string;
  tags: string[];
  caseTypeIds: string[];
  locationIds: string[];
  roleIds: string[];
  pressure: number;
  publicDescription: string;
};

export type DetectiveFactionRow = {
  id: string;
  label: string;
  kind: string;
  tags: string[];
  caseTypeIds: string[];
  locationIds: string[];
  roleIds: string[];
  resourceIds: string[];
  publicTension: string;
  weight: number;
  authoredCluster?: string;
  campaignTags?: string[];
};

export type DetectiveEventArchetypeRow = {
  id: string;
  label: string;
  kind: string;
  tags: string[];
  caseTypeIds: string[];
  locationIds: string[];
  roleIds: string[];
  resourceIds: string[];
  factionIds: string[];
  risk: number;
  publicDescription: string;
  authoredCluster?: string;
  campaignTags?: string[];
  directiveResponses?: {
    support: DetectiveDirectiveResponseConfig;
    contain: DetectiveDirectiveResponseConfig;
  };
};

export type DetectiveDirectiveResponseConfig = {
  institutionKind: TownInstitutionKind;
  strategy: InstitutionStrategy;
  longActionKind: LongActionKind;
  label: string;
  benefitLabel: string;
  costLabel: string;
};

export type DetectiveProgressionLineRow = {
  id: string;
  label: string;
  kind: string;
  tags: string[];
  caseTypeIds: string[];
  resourceIds: string[];
  factionIds: string[];
  eventArchetypeIds: string[];
  stageCount: number;
  publicDescription: string;
  authoredCluster?: string;
  campaignTags?: string[];
};

export type DetectiveContentPack = {
  manifest: DetectiveContentManifest;
  caseTypes: DetectiveCaseTypeRow[];
  locations: DetectiveLocationRow[];
  roles: DetectiveRoleRow[];
  motives: DetectiveMotiveRow[];
  evidenceTypes: DetectiveEvidenceTypeRow[];
  redHerringPatterns: DetectiveRedHerringPatternRow[];
  escalationRules: DetectiveEscalationRuleRow[];
  resources: DetectiveResourceRow[];
  factions: DetectiveFactionRow[];
  eventArchetypes: DetectiveEventArchetypeRow[];
  progressionLines: DetectiveProgressionLineRow[];
};

export type DetectiveContentValidationReport = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  summary: DetectiveContentSummary;
};

export type DetectiveContentAuthoringSelection = {
  caseTypeId: string;
  locationId: string;
  roleIds: string[];
  motiveId: string;
  evidenceTypeIds: string[];
  redHerringPatternId: string;
  resourceId: string;
  factionId: string;
  eventArchetypeId: string;
  progressionLineId: string;
};

export type DetectiveContentAuthoringPatch = {
  path: string;
  before: unknown;
  after: unknown;
  label: string;
  group: "case" | "characters" | "evidence" | "logic";
};

export type DetectiveContentAuthoringGuide = {
  selection: DetectiveContentAuthoringSelection;
  caseType?: DetectiveCaseTypeRow;
  location?: DetectiveLocationRow;
  roles: DetectiveRoleRow[];
  motive?: DetectiveMotiveRow;
  evidenceTypes: DetectiveEvidenceTypeRow[];
  redHerringPattern?: DetectiveRedHerringPatternRow;
  resource?: DetectiveResourceRow;
  faction?: DetectiveFactionRow;
  eventArchetype?: DetectiveEventArchetypeRow;
  progressionLine?: DetectiveProgressionLineRow;
  compatible: {
    locations: DetectiveLocationRow[];
    roles: DetectiveRoleRow[];
    motives: DetectiveMotiveRow[];
    evidenceTypes: DetectiveEvidenceTypeRow[];
    redHerringPatterns: DetectiveRedHerringPatternRow[];
    resources: DetectiveResourceRow[];
    factions: DetectiveFactionRow[];
    eventArchetypes: DetectiveEventArchetypeRow[];
    progressionLines: DetectiveProgressionLineRow[];
  };
  coverage: {
    compatibleLocationCount: number;
    compatibleRoleCount: number;
    compatibleMotiveCount: number;
    compatibleEvidenceTypeCount: number;
    compatibleRedHerringCount: number;
    compatibleResourceCount: number;
    compatibleFactionCount: number;
    compatibleEventArchetypeCount: number;
    compatibleProgressionLineCount: number;
    selectedEvidenceTypeCount: number;
  };
  riskSummary: {
    maxEvidenceContaminationRisk: number;
    averageEvidenceContaminationRisk: number;
    redHerringRisk: number;
    resourcePressure: number;
    eventRisk: number;
    progressionStageCount: number;
  };
  preview: {
    title: string;
    theme: string;
    premise: string;
    publicCaseFile: string;
    evidenceLabels: string[];
    roleLabels: string[];
    motiveLabel: string;
    redHerringLabels: string[];
    resourceLabel: string;
    factionLabel: string;
    eventArchetypeLabel: string;
    progressionLineLabel: string;
    worldSystemLabels: string[];
  };
  patches: DetectiveContentAuthoringPatch[];
};

export type DetectiveAuthoredCaseSequence = {
  caseTypeIds: string[];
  clusterIds: string[];
  distinctCaseTypeCount: number;
  distinctClusterCount: number;
  repeatedCaseTypeIds: string[];
  repeatedClusterIds: string[];
};

export type DetectiveContentSummary = {
  packId?: string;
  schemaVersion?: string;
  tableCounts: Record<string, number>;
  caseTypeCount: number;
  evidenceTypeCount: number;
  locationCount: number;
  roleCount: number;
  motiveCount: number;
  redHerringPatternCount: number;
  escalationRuleCount: number;
  resourceCount: number;
  factionCount: number;
  eventArchetypeCount: number;
  progressionLineCount: number;
  worldSystemCount: number;
  worldSystemRecordCount: number;
  authored: {
    clusterCount: number;
    caseTypeCount: number;
    eventArchetypeCount: number;
    progressionLineCount: number;
  };
  coverage: {
    caseTypesWithEvidence: number;
    caseTypesWithRoles: number;
    caseTypesWithMotives: number;
    evidenceTypesWithCases: number;
    rolesWithCases: number;
    motivesWithCases: number;
    resourcesWithCases: number;
    resourcesWithRoles: number;
    factionsWithResources: number;
    eventArchetypesWithFactions: number;
    progressionLinesWithEvents: number;
    worldSystemsWithRefs: number;
  };
  validation: {
    ok: boolean;
    errorCount: number;
    warningCount: number;
  };
};

export type WorldSystemRuntimeActionKind =
  | "obtain-resource"
  | "investigate"
  | "seek-alibi"
  | "pressure"
  | "spread-rumor"
  | "cover-up";

export type WorldSystemRuntimeBiasMap = Partial<Record<WorldSystemRuntimeActionKind, number>>;

export type WorldSystemRuntimeHintSummary = {
  schemaVersion: "world-system-runtime-hints.v1";
  active: boolean;
  resourcePressureLabel: string;
  factionLaneLabel: string;
  eventArchetypeLabel: string;
  progressionLineLabel: string;
  resourcePressure: number;
  eventRisk: number;
  progressionStageCount: number;
  publicLabels: string[];
  actionKinds: WorldSystemRuntimeActionKind[];
  appliedBiasCount: number;
  maxActionBias: number;
};

export type WorldSystemRuntimeHints = {
  schemaVersion: "world-system-runtime-hints.v1";
  packId?: string;
  source: {
    caseTypeId: string;
    resourceId?: string;
    factionId?: string;
    eventArchetypeId?: string;
    progressionLineId?: string;
    progressionCaseTypeIds: string[];
  };
  caseTypeLabel: string;
  resource: {
    label: string;
    kind: string;
    pressure: number;
    tags: string[];
  };
  faction: {
    label: string;
    kind: string;
    tags: string[];
  };
  eventArchetype: {
    label: string;
    kind: string;
    risk: number;
    tags: string[];
  };
  progressionLine: {
    label: string;
    kind: string;
    stageCount: number;
    tags: string[];
  };
  actionBias: WorldSystemRuntimeBiasMap;
  institutionLabels: string[];
  caseTypeBias: Record<string, number>;
  summary: WorldSystemRuntimeHintSummary;
};

const FORBIDDEN_KEY_RE = /api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|culpritId|truth|checkpoint|agent_state_snapshot|hiddenDebugLog/i;
const FORBIDDEN_TEXT_RE = /\bsk-[A-Za-z0-9][A-Za-z0-9_-]{12,}\b|authorization:\s*bearer|\.env\.local|[A-Za-z]:[\\/]/i;
const DIRECTIVE_INSTITUTION_KINDS = new Set(["police", "media", "family", "commerce", "civic", "medical", "court", "dock_union"]);
const DIRECTIVE_STRATEGIES = new Set(["allocate-investigation", "chase-headline", "protect-family", "audit-ledger", "schedule-autopsy", "review-court-record", "trace-cargo", "cultivate-informant", "hold-position"]);
const DIRECTIVE_LONG_ACTION_KINDS = new Set(["investigate-scene", "file-police-report", "publish-rumor", "suppress-story", "tamper-evidence", "protect-witness", "bribe-witness", "conduct-autopsy", "audit-ledger", "family-pressure", "surveil-suspect", "interview-witness", "intimidate-witness", "request-warrant", "leak-to-press", "verify-alibi", "hold-inquest", "cross-examine-witness", "review-court-record", "trace-cargo", "bribe-dockhand", "inspect-warehouse", "seal-autopsy-record", "second-medical-opinion", "secure-evidence-locker", "protect-chain-of-custody", "summon-family-council", "pressure-editor", "cultivate-informant", "verify-anonymous-tip"]);
const DIRECTIVE_REQUIRED_INSTITUTION: Record<string, DetectiveDirectiveResponseConfig["institutionKind"]> = {
  "file-police-report": "police",
  "protect-witness": "police",
  "conduct-autopsy": "medical",
  "request-warrant": "police",
  "hold-inquest": "court",
  "cross-examine-witness": "court",
  "review-court-record": "court",
  "trace-cargo": "dock_union",
  "inspect-warehouse": "dock_union",
  "seal-autopsy-record": "medical",
  "second-medical-opinion": "medical",
  "secure-evidence-locker": "police",
  "protect-chain-of-custody": "police"
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function hasStringId(value: unknown): value is { id: string } {
  return Boolean(asRecord(value) && typeof asRecord(value)?.id === "string" && String(asRecord(value)?.id).trim());
}

function scanPublicSafe(value: unknown, path = "$", errors: string[] = []) {
  if (typeof value === "string") {
    if (FORBIDDEN_TEXT_RE.test(value)) errors.push(`${path} contains forbidden public text.`);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => scanPublicSafe(item, `${path}[${index}]`, errors));
  } else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      const nextPath = `${path}.${key}`;
      if (FORBIDDEN_KEY_RE.test(key)) errors.push(`${nextPath} contains a forbidden public key.`);
      scanPublicSafe(nested, nextPath, errors);
    }
  }
  return errors;
}

function collectIds(rows: unknown[], label: string, errors: string[]) {
  const ids = new Set<string>();
  for (const row of rows) {
    if (!hasStringId(row)) {
      errors.push(`${label} row is missing id.`);
      continue;
    }
    if (ids.has(row.id)) errors.push(`${label} ${row.id} is duplicated.`);
    ids.add(row.id);
  }
  return ids;
}

function checkRefs(rows: unknown[], label: string, field: string, targetLabel: string, targetIds: Set<string>, errors: string[]) {
  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;
    const id = typeof record.id === "string" ? record.id : "(missing id)";
    const refs = asArray(record[field]);
    if (!refs.length) errors.push(`${label} ${id} ${field} must not be empty.`);
    for (const ref of refs) {
      if (typeof ref !== "string" || !targetIds.has(ref)) errors.push(`${label} ${id} references missing ${targetLabel} ${String(ref)}.`);
    }
  }
}

function checkDirectiveResponses(rows: unknown[], errors: string[]) {
  for (const row of rows) {
    const record = asRecord(row);
    const responses = asRecord(record?.directiveResponses);
    if (!responses) continue;
    const id = typeof record?.id === "string" ? record.id : "(missing id)";
    for (const choice of ["support", "contain"] as const) {
      const response = asRecord(responses[choice]);
      if (!response) {
        errors.push(`eventArchetypes ${id} directiveResponses.${choice} is required.`);
        continue;
      }
      if (!DIRECTIVE_INSTITUTION_KINDS.has(String(response.institutionKind || ""))) errors.push(`eventArchetypes ${id} directiveResponses.${choice}.institutionKind is invalid.`);
      if (!DIRECTIVE_STRATEGIES.has(String(response.strategy || ""))) errors.push(`eventArchetypes ${id} directiveResponses.${choice}.strategy is invalid.`);
      if (!DIRECTIVE_LONG_ACTION_KINDS.has(String(response.longActionKind || ""))) errors.push(`eventArchetypes ${id} directiveResponses.${choice}.longActionKind is invalid.`);
      const requiredInstitution = DIRECTIVE_REQUIRED_INSTITUTION[String(response.longActionKind || "")];
      if (requiredInstitution && response.institutionKind !== requiredInstitution) errors.push(`eventArchetypes ${id} directiveResponses.${choice} does not match the long action institution requirement.`);
      for (const field of ["label", "benefitLabel", "costLabel"] as const) {
        if (typeof response[field] !== "string" || !response[field].trim()) errors.push(`eventArchetypes ${id} directiveResponses.${choice}.${field} is required.`);
      }
    }
  }
}

const AUTHORING_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function checkAuthoringGrammar(
  caseTypes: unknown[],
  eventArchetypes: unknown[],
  progressionLines: unknown[],
  errors: string[]
) {
  const checkRows = (rows: unknown[], label: string, requireContrastKey = false) => {
    for (const [index, row] of rows.entries()) {
      const record = asRecord(row);
      if (!record?.authoredCluster && !record?.campaignTags && !record?.contrastKey) continue;
      const cluster = record.authoredCluster;
      if (typeof cluster !== "string" || !AUTHORING_SLUG_RE.test(cluster)) errors.push(`${label}[${index}].authoredCluster must be a lowercase slug.`);
      const campaignTags = record.campaignTags;
      if (!Array.isArray(campaignTags) || !campaignTags.length || campaignTags.some((tag) => typeof tag !== "string" || !AUTHORING_SLUG_RE.test(tag))) {
        errors.push(`${label}[${index}].campaignTags must be a non-empty list of lowercase slugs.`);
      }
      if (requireContrastKey && (typeof record.contrastKey !== "string" || !AUTHORING_SLUG_RE.test(record.contrastKey))) {
        errors.push(`${label}[${index}].contrastKey must be a lowercase slug.`);
      }
    }
  };
  checkRows(caseTypes, "caseTypes", true);
  checkRows(eventArchetypes, "eventArchetypes");
  checkRows(progressionLines, "progressionLines");
  const seenContrast = new Set<string>();
  for (const row of caseTypes) {
    const record = asRecord(row);
    if (!record?.authoredCluster || !record?.contrastKey) continue;
    const key = `${record.authoredCluster}:${record.contrastKey}`;
    if (seenContrast.has(key)) errors.push(`caseTypes authored contrastKey ${key} is duplicated.`);
    seenContrast.add(key);
  }
  const progressionClusters = new Set(progressionLines.map((row) => asRecord(row)?.authoredCluster).filter((value): value is string => typeof value === "string"));
  const eventClusters = new Set(eventArchetypes.map((row) => asRecord(row)?.authoredCluster).filter((value): value is string => typeof value === "string"));
  for (const row of caseTypes) {
    const cluster = asRecord(row)?.authoredCluster;
    if (typeof cluster === "string" && !progressionClusters.has(cluster) && !eventClusters.has(cluster)) {
      errors.push(`caseTypes authoredCluster ${cluster} has no authored event or progression line.`);
    }
  }
}

function checkNumber(rows: unknown[], label: string, field: string, errors: string[], { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;
    const id = typeof record.id === "string" ? record.id : "(missing id)";
    const value = record[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
      errors.push(`${label} ${id} ${field} must be a number between ${min} and ${max}.`);
    }
  }
}

function countRowsWithRefs(rows: Array<Record<string, unknown>>, field: string) {
  return rows.filter((row) => Array.isArray(row[field]) && (row[field] as unknown[]).length > 0).length;
}

function countRowsWithAnyRefs(rows: Array<Record<string, unknown>>, fields: string[]) {
  return rows.filter((row) => fields.some((field) => Array.isArray(row[field]) && (row[field] as unknown[]).length > 0)).length;
}

function byWeightThenId<T extends { id: string; weight?: number }>(left: T, right: T) {
  const delta = (right.weight || 0) - (left.weight || 0);
  return delta || left.id.localeCompare(right.id);
}

function byTableOrder<T>(rows: T[], ids: string[]) {
  const order = new Map(ids.map((id, index) => [id, index]));
  return [...rows].sort((left, right) => (order.get((left as { id: string }).id) ?? Number.MAX_SAFE_INTEGER) - (order.get((right as { id: string }).id) ?? Number.MAX_SAFE_INTEGER));
}

function firstById<T extends { id: string }>(rows: T[], id: string | undefined, fallback?: T) {
  return rows.find((row) => row.id === id) || fallback || rows[0];
}

function authoredSequenceHash(seed: string, value: string) {
  let hash = 2166136261;
  for (const character of `${seed}:${value}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function selectAuthoredCaseTypeSequence(
  pack: DetectiveContentPack,
  input: { seed?: string; length?: number; availableCaseTypeIds?: string[] } = {}
): DetectiveAuthoredCaseSequence {
  const length = Math.max(0, Math.min(12, Math.floor(input.length ?? 3)));
  const available = new Set(input.availableCaseTypeIds || pack.caseTypes.map((row) => row.id));
  const rows = pack.caseTypes.filter((row) => available.has(row.id));
  const clusterFor = (row: DetectiveCaseTypeRow) => row.authoredCluster || row.family || "general";
  const clusters = new Map<string, DetectiveCaseTypeRow[]>();
  for (const row of rows) {
    const cluster = clusterFor(row);
    const bucket = clusters.get(cluster) || [];
    bucket.push(row);
    clusters.set(cluster, bucket);
  }
  const orderedClusters = [...clusters.entries()]
    .map(([cluster, bucket]) => [cluster, [...bucket].sort((left, right) => authoredSequenceHash(input.seed || "authored-sequence", left.id) - authoredSequenceHash(input.seed || "authored-sequence", right.id) || right.weight - left.weight || left.id.localeCompare(right.id))] as const)
    .sort((left, right) => authoredSequenceHash(input.seed || "authored-sequence", left[0]) - authoredSequenceHash(input.seed || "authored-sequence", right[0]) || left[0].localeCompare(right[0]));
  const selectedRows: DetectiveCaseTypeRow[] = [];
  for (let index = 0; index < length && orderedClusters.length; index += 1) {
    const clusterEntry = orderedClusters[index % orderedClusters.length];
    const bucket = clusterEntry[1];
    const row = bucket[Math.floor(index / orderedClusters.length) % bucket.length];
    if (row) selectedRows.push(row);
  }
  const caseTypeIds = selectedRows.map((row) => row.id);
  const clusterIds = selectedRows.map(clusterFor);
  const countValues = (values: string[]) => [...new Set(values)].filter((value) => values.filter((item) => item === value).length > 1);
  return {
    caseTypeIds,
    clusterIds,
    distinctCaseTypeCount: new Set(caseTypeIds).size,
    distinctClusterCount: new Set(clusterIds).size,
    repeatedCaseTypeIds: countValues(caseTypeIds),
    repeatedClusterIds: countValues(clusterIds)
  };
}

function setPatch(path: string, before: unknown, after: unknown, label: string): DetectiveContentAuthoringPatch | null {
  if (before === after) return null;
  const group = path.includes(".characters.")
    ? "characters"
    : path.includes(".evidence.")
      ? "evidence"
      : path.includes(".logicPuzzle.")
        ? "logic"
        : "case";
  return { path, before, after, label, group };
}

function publicText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function boundedRuntimeBias(value: number) {
  return Math.max(0, Math.min(4, Math.round(value)));
}

function compactTags(rows: Array<{ tags: string[] }>) {
  return Array.from(new Set(rows.flatMap((row) => row.tags || []).map((tag) => publicText(tag)).filter(Boolean))).slice(0, 8);
}

function buildRuntimeActionBias(input: {
  resource?: DetectiveResourceRow;
  faction?: DetectiveFactionRow;
  eventArchetype?: DetectiveEventArchetypeRow;
  progressionLine?: DetectiveProgressionLineRow;
}): WorldSystemRuntimeBiasMap {
  const { resource, faction, eventArchetype, progressionLine } = input;
  const tags = new Set([
    ...(resource?.tags || []),
    ...(faction?.tags || []),
    ...(eventArchetype?.tags || []),
    ...(progressionLine?.tags || [])
  ]);
  const actionBias: WorldSystemRuntimeBiasMap = {
    "obtain-resource": boundedRuntimeBias((resource?.pressure || 0) / 24),
    investigate: boundedRuntimeBias(((eventArchetype?.risk || 0) + (resource?.pressure || 0)) / 48),
    "seek-alibi": boundedRuntimeBias(tags.has("record") || tags.has("testimony") || tags.has("witness") ? 2 : (eventArchetype?.risk || 0) / 50),
    pressure: boundedRuntimeBias(((faction?.weight || 0) / 3) + (tags.has("debt") || tags.has("loyalty") ? 1 : 0)),
    "spread-rumor": boundedRuntimeBias(tags.has("headline") || tags.has("proof") || faction?.kind === "media" ? 3 : (eventArchetype?.risk || 0) / 70),
    "cover-up": boundedRuntimeBias(tags.has("custody") || tags.has("trace") || tags.has("source") ? 2 : (resource?.pressure || 0) / 60)
  };
  return Object.fromEntries(Object.entries(actionBias).filter(([, value]) => value > 0)) as WorldSystemRuntimeBiasMap;
}

export function deriveWorldSystemRuntimeHints(
  pack: DetectiveContentPack,
  context: { caseTypeId?: string } = {}
): WorldSystemRuntimeHints {
  const caseType = firstById(pack.caseTypes, context.caseTypeId, [...pack.caseTypes].sort(byWeightThenId)[0]);
  const compatibleResources = pack.resources
    .filter((row) => row.caseTypeIds.includes(caseType.id))
    .sort((left, right) => right.pressure - left.pressure || left.id.localeCompare(right.id));
  const resource = compatibleResources[0] || [...pack.resources].sort((left, right) => right.pressure - left.pressure || left.id.localeCompare(right.id))[0];
  const compatibleFactions = pack.factions
    .filter((row) => row.caseTypeIds.includes(caseType.id) && (!resource || row.resourceIds.includes(resource.id)))
    .sort(byWeightThenId);
  const faction = compatibleFactions[0] || [...pack.factions].sort(byWeightThenId)[0];
  const compatibleEventArchetypes = pack.eventArchetypes
    .filter((row) => row.caseTypeIds.includes(caseType.id)
      && (!resource || row.resourceIds.includes(resource.id))
      && (!faction || row.factionIds.includes(faction.id)))
    .sort((left, right) => right.risk - left.risk || left.id.localeCompare(right.id));
  const eventArchetype = compatibleEventArchetypes[0] || [...pack.eventArchetypes].sort((left, right) => right.risk - left.risk || left.id.localeCompare(right.id))[0];
  const compatibleProgressionLines = pack.progressionLines
    .filter((row) => row.caseTypeIds.includes(caseType.id)
      && (!resource || row.resourceIds.includes(resource.id))
      && (!faction || row.factionIds.includes(faction.id))
      && (!eventArchetype || row.eventArchetypeIds.includes(eventArchetype.id)))
    .sort((left, right) => right.stageCount - left.stageCount || left.id.localeCompare(right.id));
  const progressionLine = compatibleProgressionLines[0] || [...pack.progressionLines].sort((left, right) => right.stageCount - left.stageCount || left.id.localeCompare(right.id))[0];
  const actionBias = buildRuntimeActionBias({ resource, faction, eventArchetype, progressionLine });
  const publicLabels = [
    resource?.label,
    faction?.label,
    eventArchetype?.label,
    progressionLine?.label
  ].filter((label): label is string => Boolean(label)).map(publicText);
  const maxActionBias = Math.max(0, ...Object.values(actionBias).filter((value): value is number => typeof value === "number"));
  const summary: WorldSystemRuntimeHintSummary = {
    schemaVersion: "world-system-runtime-hints.v1",
    active: Boolean(caseType && resource && faction && eventArchetype && progressionLine),
    resourcePressureLabel: resource ? `${publicText(resource.label)} pressure ${resource.pressure}/100` : "No resource pressure",
    factionLaneLabel: faction ? `${publicText(faction.label)} lane` : "No faction lane",
    eventArchetypeLabel: eventArchetype ? publicText(eventArchetype.label) : "No event archetype",
    progressionLineLabel: progressionLine ? publicText(progressionLine.label) : "No progression line",
    resourcePressure: resource?.pressure || 0,
    eventRisk: eventArchetype?.risk || 0,
    progressionStageCount: progressionLine?.stageCount || 0,
    publicLabels,
    actionKinds: Object.keys(actionBias) as WorldSystemRuntimeActionKind[],
    appliedBiasCount: 0,
    maxActionBias
  };
  return {
    schemaVersion: "world-system-runtime-hints.v1",
    packId: pack.manifest.id,
    source: {
      caseTypeId: caseType?.id || "",
      resourceId: resource?.id,
      factionId: faction?.id,
      eventArchetypeId: eventArchetype?.id,
      progressionLineId: progressionLine?.id,
      progressionCaseTypeIds: [...(progressionLine?.caseTypeIds || [])].sort()
    },
    caseTypeLabel: publicText(caseType?.label || "Public case type"),
    resource: {
      label: publicText(resource?.label || "Public Resource"),
      kind: publicText(resource?.kind || "resource"),
      pressure: resource?.pressure || 0,
      tags: compactTags(resource ? [resource] : [])
    },
    faction: {
      label: publicText(faction?.label || "Public Faction"),
      kind: publicText(faction?.kind || "faction"),
      tags: compactTags(faction ? [faction] : [])
    },
    eventArchetype: {
      label: publicText(eventArchetype?.label || "Public Event"),
      kind: publicText(eventArchetype?.kind || "event"),
      risk: eventArchetype?.risk || 0,
      tags: compactTags(eventArchetype ? [eventArchetype] : [])
    },
    progressionLine: {
      label: publicText(progressionLine?.label || "Public Growth Line"),
      kind: publicText(progressionLine?.kind || "progression"),
      stageCount: progressionLine?.stageCount || 0,
      tags: compactTags(progressionLine ? [progressionLine] : [])
    },
    actionBias,
    institutionLabels: publicLabels.slice(0, 4),
    caseTypeBias: Object.fromEntries((progressionLine?.caseTypeIds || (caseType ? [caseType.id] : [])).map((caseTypeId) => [caseTypeId, 1])),
    summary
  };
}

export function buildDetectiveContentSummary(pack: Partial<DetectiveContentPack>, validation = { ok: true, errorCount: 0, warningCount: 0 }): DetectiveContentSummary {
  const caseTypes = (pack.caseTypes || []) as unknown as Array<Record<string, unknown>>;
  const evidenceTypes = (pack.evidenceTypes || []) as unknown as Array<Record<string, unknown>>;
  const roles = (pack.roles || []) as unknown as Array<Record<string, unknown>>;
  const motives = (pack.motives || []) as unknown as Array<Record<string, unknown>>;
  const locations = (pack.locations || []) as unknown as Array<Record<string, unknown>>;
  const resources = (pack.resources || []) as unknown as Array<Record<string, unknown>>;
  const factions = (pack.factions || []) as unknown as Array<Record<string, unknown>>;
  const eventArchetypes = (pack.eventArchetypes || []) as unknown as Array<Record<string, unknown>>;
  const progressionLines = (pack.progressionLines || []) as unknown as Array<Record<string, unknown>>;
  const worldSystemRecordCount = roles.length + locations.length + resources.length + factions.length + eventArchetypes.length + progressionLines.length;
  const authoredClusters = new Set(caseTypes.map((row) => row.authoredCluster).filter((value): value is string => typeof value === "string" && Boolean(value)));
  return {
    packId: pack.manifest?.id,
    schemaVersion: pack.manifest?.schemaVersion,
    tableCounts: {
      caseTypes: pack.caseTypes?.length || 0,
      locations: locations.length,
      roles: roles.length,
      motives: pack.motives?.length || 0,
      evidenceTypes: evidenceTypes.length,
      redHerringPatterns: pack.redHerringPatterns?.length || 0,
      escalationRules: pack.escalationRules?.length || 0,
      resources: resources.length,
      factions: factions.length,
      eventArchetypes: eventArchetypes.length,
      progressionLines: progressionLines.length
    },
    caseTypeCount: pack.caseTypes?.length || 0,
    evidenceTypeCount: evidenceTypes.length,
    locationCount: locations.length,
    roleCount: roles.length,
    motiveCount: pack.motives?.length || 0,
    redHerringPatternCount: pack.redHerringPatterns?.length || 0,
    escalationRuleCount: pack.escalationRules?.length || 0,
    resourceCount: resources.length,
    factionCount: factions.length,
    eventArchetypeCount: eventArchetypes.length,
    progressionLineCount: progressionLines.length,
    worldSystemCount: 6,
    worldSystemRecordCount,
    authored: {
      clusterCount: authoredClusters.size,
      caseTypeCount: caseTypes.filter((row) => typeof row.authoredCluster === "string").length,
      eventArchetypeCount: eventArchetypes.filter((row) => typeof row.authoredCluster === "string").length,
      progressionLineCount: progressionLines.filter((row) => typeof row.authoredCluster === "string").length
    },
    coverage: {
      caseTypesWithEvidence: countRowsWithRefs(caseTypes, "evidenceTypeIds"),
      caseTypesWithRoles: countRowsWithRefs(caseTypes, "roleIds"),
      caseTypesWithMotives: countRowsWithRefs(caseTypes, "motiveIds"),
      evidenceTypesWithCases: countRowsWithRefs(evidenceTypes, "caseTypeIds"),
      rolesWithCases: countRowsWithRefs(roles, "caseTypeIds"),
      motivesWithCases: countRowsWithRefs(motives, "caseTypeIds"),
      resourcesWithCases: countRowsWithRefs(resources, "caseTypeIds"),
      resourcesWithRoles: countRowsWithRefs(resources, "roleIds"),
      factionsWithResources: countRowsWithRefs(factions, "resourceIds"),
      eventArchetypesWithFactions: countRowsWithRefs(eventArchetypes, "factionIds"),
      progressionLinesWithEvents: countRowsWithRefs(progressionLines, "eventArchetypeIds"),
      worldSystemsWithRefs: countRowsWithAnyRefs([...resources, ...factions, ...eventArchetypes, ...progressionLines], [
        "caseTypeIds",
        "locationIds",
        "roleIds",
        "resourceIds",
        "factionIds",
        "eventArchetypeIds"
      ])
    },
    validation
  };
}

export function selectDefaultDetectiveContentAuthoringSelection(pack: DetectiveContentPack, previous?: Partial<DetectiveContentAuthoringSelection>): DetectiveContentAuthoringSelection {
  const caseType = firstById(pack.caseTypes, previous?.caseTypeId, [...pack.caseTypes].sort(byWeightThenId)[0]);
  const locations = pack.locations.filter((row) => row.caseTypeIds.includes(caseType.id)).sort(byWeightThenId);
  const evidenceTypes = byTableOrder(
    pack.evidenceTypes.filter((row) => row.caseTypeIds.includes(caseType.id)),
    caseType.evidenceTypeIds
  );
  const roles = byTableOrder(
    pack.roles.filter((row) => row.caseTypeIds.includes(caseType.id)),
    caseType.roleIds
  );
  const motives = byTableOrder(
    pack.motives.filter((row) => row.caseTypeIds.includes(caseType.id)),
    caseType.motiveIds
  );
  const selectedRoleIds = (previous?.roleIds || []).filter((id) => roles.some((row) => row.id === id));
  const selectedEvidenceTypeIds = (previous?.evidenceTypeIds || []).filter((id) => evidenceTypes.some((row) => row.id === id));
  const selectedMotive = firstById(motives, previous?.motiveId, motives[0]);
  const compatibleRedHerrings = pack.redHerringPatterns.filter((row) => row.caseTypeIds.includes(caseType.id));
  const selectedRedHerring = firstById(compatibleRedHerrings, previous?.redHerringPatternId, compatibleRedHerrings[0]);
  const compatibleResources = (pack.resources || []).filter((row) => row.caseTypeIds.includes(caseType.id)).sort((left, right) => right.pressure - left.pressure || left.id.localeCompare(right.id));
  const selectedResource = firstById(compatibleResources, previous?.resourceId, compatibleResources[0]);
  const compatibleFactions = (pack.factions || [])
    .filter((row) => row.caseTypeIds.includes(caseType.id) && (!selectedResource || row.resourceIds.includes(selectedResource.id)))
    .sort(byWeightThenId);
  const selectedFaction = firstById(compatibleFactions, previous?.factionId, compatibleFactions[0]);
  const compatibleEventArchetypes = (pack.eventArchetypes || [])
    .filter((row) => row.caseTypeIds.includes(caseType.id)
      && (!selectedResource || row.resourceIds.includes(selectedResource.id))
      && (!selectedFaction || row.factionIds.includes(selectedFaction.id)))
    .sort((left, right) => right.risk - left.risk || left.id.localeCompare(right.id));
  const selectedEventArchetype = firstById(compatibleEventArchetypes, previous?.eventArchetypeId, compatibleEventArchetypes[0]);
  const compatibleProgressionLines = (pack.progressionLines || [])
    .filter((row) => row.caseTypeIds.includes(caseType.id)
      && (!selectedResource || row.resourceIds.includes(selectedResource.id))
      && (!selectedFaction || row.factionIds.includes(selectedFaction.id))
      && (!selectedEventArchetype || row.eventArchetypeIds.includes(selectedEventArchetype.id)))
    .sort((left, right) => right.stageCount - left.stageCount || left.id.localeCompare(right.id));
  const selectedProgressionLine = firstById(compatibleProgressionLines, previous?.progressionLineId, compatibleProgressionLines[0]);
  return {
    caseTypeId: caseType.id,
    locationId: firstById(locations, previous?.locationId, locations[0])?.id || "",
    roleIds: selectedRoleIds.length ? selectedRoleIds.slice(0, 3) : roles.slice(0, 3).map((row) => row.id),
    motiveId: selectedMotive?.id || "",
    evidenceTypeIds: selectedEvidenceTypeIds.length ? selectedEvidenceTypeIds.slice(0, 4) : evidenceTypes.slice(0, 4).map((row) => row.id),
    redHerringPatternId: selectedRedHerring?.id || "",
    resourceId: selectedResource?.id || "",
    factionId: selectedFaction?.id || "",
    eventArchetypeId: selectedEventArchetype?.id || "",
    progressionLineId: selectedProgressionLine?.id || ""
  };
}

export function buildDetectiveContentAuthoringGuide(
  pack: DetectiveContentPack,
  draft: { caseFromLog: { deductionCase: {
    title: string;
    theme: string;
    premise: string;
    publicCaseFile: string;
    characters: Array<{ role: string; publicBio: string; motive: string }>;
    evidence: Array<{ title: string; visibleDescription: string }>;
    logicPuzzle: { redHerrings: string[] };
  } } },
  selectionInput?: Partial<DetectiveContentAuthoringSelection>
): DetectiveContentAuthoringGuide {
  const selection = selectDefaultDetectiveContentAuthoringSelection(pack, selectionInput);
  const caseType = firstById(pack.caseTypes, selection.caseTypeId, [...pack.caseTypes].sort(byWeightThenId)[0]);
  const compatibleLocations = pack.locations.filter((row) => row.caseTypeIds.includes(caseType.id)).sort(byWeightThenId);
  const compatibleEvidenceTypes = byTableOrder(
    pack.evidenceTypes.filter((row) => row.caseTypeIds.includes(caseType.id)),
    caseType.evidenceTypeIds
  );
  const compatibleRoles = byTableOrder(
    pack.roles.filter((row) => row.caseTypeIds.includes(caseType.id)),
    caseType.roleIds
  );
  const compatibleMotives = byTableOrder(
    pack.motives.filter((row) => row.caseTypeIds.includes(caseType.id)),
    caseType.motiveIds
  );
  const compatibleRedHerrings = pack.redHerringPatterns.filter((row) => row.caseTypeIds.includes(caseType.id));
  const compatibleResources = pack.resources.filter((row) => row.caseTypeIds.includes(caseType.id)).sort((left, right) => right.pressure - left.pressure || left.id.localeCompare(right.id));
  const selectedResourceForFilter = firstById(compatibleResources, selection.resourceId, compatibleResources[0]);
  const compatibleFactions = pack.factions
    .filter((row) => row.caseTypeIds.includes(caseType.id) && (!selectedResourceForFilter || row.resourceIds.includes(selectedResourceForFilter.id)))
    .sort(byWeightThenId);
  const selectedFactionForFilter = firstById(compatibleFactions, selection.factionId, compatibleFactions[0]);
  const compatibleEventArchetypes = pack.eventArchetypes
    .filter((row) => row.caseTypeIds.includes(caseType.id)
      && (!selectedResourceForFilter || row.resourceIds.includes(selectedResourceForFilter.id))
      && (!selectedFactionForFilter || row.factionIds.includes(selectedFactionForFilter.id)))
    .sort((left, right) => right.risk - left.risk || left.id.localeCompare(right.id));
  const selectedEventForFilter = firstById(compatibleEventArchetypes, selection.eventArchetypeId, compatibleEventArchetypes[0]);
  const compatibleProgressionLines = pack.progressionLines
    .filter((row) => row.caseTypeIds.includes(caseType.id)
      && (!selectedResourceForFilter || row.resourceIds.includes(selectedResourceForFilter.id))
      && (!selectedFactionForFilter || row.factionIds.includes(selectedFactionForFilter.id))
      && (!selectedEventForFilter || row.eventArchetypeIds.includes(selectedEventForFilter.id)))
    .sort((left, right) => right.stageCount - left.stageCount || left.id.localeCompare(right.id));
  const normalizedSelection = selectDefaultDetectiveContentAuthoringSelection(pack, {
    ...selection,
    locationId: compatibleLocations.some((row) => row.id === selection.locationId) ? selection.locationId : compatibleLocations[0]?.id,
    motiveId: compatibleMotives.some((row) => row.id === selection.motiveId) ? selection.motiveId : compatibleMotives[0]?.id,
    roleIds: selection.roleIds.filter((id) => compatibleRoles.some((row) => row.id === id)),
    evidenceTypeIds: selection.evidenceTypeIds.filter((id) => compatibleEvidenceTypes.some((row) => row.id === id)),
    redHerringPatternId: compatibleRedHerrings.some((row) => row.id === selection.redHerringPatternId) ? selection.redHerringPatternId : compatibleRedHerrings[0]?.id,
    resourceId: compatibleResources.some((row) => row.id === selection.resourceId) ? selection.resourceId : compatibleResources[0]?.id,
    factionId: compatibleFactions.some((row) => row.id === selection.factionId) ? selection.factionId : compatibleFactions[0]?.id,
    eventArchetypeId: compatibleEventArchetypes.some((row) => row.id === selection.eventArchetypeId) ? selection.eventArchetypeId : compatibleEventArchetypes[0]?.id,
    progressionLineId: compatibleProgressionLines.some((row) => row.id === selection.progressionLineId) ? selection.progressionLineId : compatibleProgressionLines[0]?.id
  });
  const location = firstById(compatibleLocations, normalizedSelection.locationId, compatibleLocations[0]);
  const roles = normalizedSelection.roleIds.map((id) => compatibleRoles.find((row) => row.id === id)).filter((row): row is DetectiveRoleRow => Boolean(row));
  const motive = firstById(compatibleMotives, normalizedSelection.motiveId, compatibleMotives[0]);
  const evidenceTypes = normalizedSelection.evidenceTypeIds.map((id) => compatibleEvidenceTypes.find((row) => row.id === id)).filter((row): row is DetectiveEvidenceTypeRow => Boolean(row));
  const redHerringPattern = firstById(compatibleRedHerrings, normalizedSelection.redHerringPatternId, compatibleRedHerrings[0]);
  const resource = firstById(compatibleResources, normalizedSelection.resourceId, compatibleResources[0]);
  const faction = firstById(compatibleFactions, normalizedSelection.factionId, compatibleFactions[0]);
  const eventArchetype = firstById(compatibleEventArchetypes, normalizedSelection.eventArchetypeId, compatibleEventArchetypes[0]);
  const progressionLine = firstById(compatibleProgressionLines, normalizedSelection.progressionLineId, compatibleProgressionLines[0]);
  const caseLabel = publicText(caseType.label);
  const locationLabel = publicText(location?.label || "Public Location");
  const motiveLabel = publicText(motive?.label || "Public Motive");
  const resourceLabel = publicText(resource?.label || "Public Resource");
  const factionLabel = publicText(faction?.label || "Public Faction");
  const eventArchetypeLabel = publicText(eventArchetype?.label || "Public Event");
  const progressionLineLabel = publicText(progressionLine?.label || "Public Growth Line");
  const worldSystemLabels = [resourceLabel, factionLabel, eventArchetypeLabel, progressionLineLabel].filter(Boolean);
  const title = `${caseLabel} at ${locationLabel}`;
  const theme = `${caseType.family} / ${motive?.category || "public-pressure"} / ${progressionLine?.kind || "world-system"}`;
  const premise = `${caseLabel} pressure emerges around ${locationLabel}. ${motive?.publicDescription || "Reviewer-safe public pressure motivates conflicting statements."} ${resource?.publicDescription || ""} ${faction?.publicTension || ""}`.trim();
  const evidenceLabels = evidenceTypes.map((row) => publicText(row.label));
  const publicCaseFile = [
    `${caseLabel} review file.`,
    `Primary location: ${locationLabel}.`,
    `Surface motive: ${motiveLabel}.`,
    `World system: ${worldSystemLabels.join(" -> ") || "public system"}.`,
    eventArchetype ? `Event pressure: ${publicText(eventArchetype.publicDescription)}` : "",
    progressionLine ? `Progression: ${publicText(progressionLine.publicDescription)}` : "",
    `Evidence families: ${evidenceLabels.join(", ") || "public evidence"}.`,
    "Generated from browser-local content guide; no raw case body or private runtime state is introduced."
  ].filter(Boolean).join(" ");
  const roleLabels = roles.map((row) => publicText(row.label));
  const redHerringLabels = redHerringPattern ? [publicText(redHerringPattern.label), publicText(redHerringPattern.publicDescription)] : [];
  const deductionCase = draft.caseFromLog.deductionCase;
  const patches = [
    setPatch("caseFromLog.deductionCase.title", deductionCase.title, title, "Case title"),
    setPatch("caseFromLog.deductionCase.theme", deductionCase.theme, theme, "Theme"),
    setPatch("caseFromLog.deductionCase.premise", deductionCase.premise, premise, "Premise"),
    setPatch("caseFromLog.deductionCase.publicCaseFile", deductionCase.publicCaseFile, publicCaseFile, "Public case file")
  ].filter((patch): patch is DetectiveContentAuthoringPatch => Boolean(patch));

  const editableCharacters = deductionCase.characters.map((character, index) => ({ character, index })).filter(({ character }) => character.role !== "死者");
  editableCharacters.slice(0, roles.length).forEach(({ character, index }, roleIndex) => {
    const role = roles[roleIndex];
    const roleMotive = motive && role.motiveIds.includes(motive.id) ? motive : compatibleMotives.find((row) => role.motiveIds.includes(row.id)) || motive;
    const nextBio = `${role.publicDescription} Content role: ${role.label}.`;
    const nextMotive = roleMotive ? `${roleMotive.label}: ${roleMotive.publicDescription}` : character.motive;
    const rolePatch = setPatch(`caseFromLog.deductionCase.characters.${index}.role`, character.role, role.label, `Character ${roleIndex + 1} role`);
    const bioPatch = setPatch(`caseFromLog.deductionCase.characters.${index}.publicBio`, character.publicBio, nextBio, `Character ${roleIndex + 1} public bio`);
    const motivePatch = setPatch(`caseFromLog.deductionCase.characters.${index}.motive`, character.motive, nextMotive, `Character ${roleIndex + 1} motive surface`);
    if (rolePatch) patches.push(rolePatch);
    if (bioPatch) patches.push(bioPatch);
    if (motivePatch) patches.push(motivePatch);
  });

  deductionCase.evidence.slice(0, evidenceTypes.length).forEach((evidence, index) => {
    const evidenceType = evidenceTypes[index];
    const titlePatch = setPatch(`caseFromLog.deductionCase.evidence.${index}.title`, evidence.title, evidenceType.label, `Evidence ${index + 1} title`);
    const visiblePatch = setPatch(
      `caseFromLog.deductionCase.evidence.${index}.visibleDescription`,
      evidence.visibleDescription,
      `${evidenceType.publicDescription} Contamination risk ${evidenceType.contaminationRisk}/100.`,
      `Evidence ${index + 1} visible description`
    );
    if (titlePatch) patches.push(titlePatch);
    if (visiblePatch) patches.push(visiblePatch);
  });

  const redHerringPatch = setPatch("caseFromLog.deductionCase.logicPuzzle.redHerrings", deductionCase.logicPuzzle.redHerrings, redHerringLabels, "Red herring labels");
  if (redHerringPatch) patches.push(redHerringPatch);

  const riskTotal = evidenceTypes.reduce((sum, row) => sum + row.contaminationRisk, 0);
  return {
    selection: normalizedSelection,
    caseType,
    location,
    roles,
    motive,
    evidenceTypes,
    redHerringPattern,
    resource,
    faction,
    eventArchetype,
    progressionLine,
    compatible: {
      locations: compatibleLocations,
      roles: compatibleRoles,
      motives: compatibleMotives,
      evidenceTypes: compatibleEvidenceTypes,
      redHerringPatterns: compatibleRedHerrings,
      resources: compatibleResources,
      factions: compatibleFactions,
      eventArchetypes: compatibleEventArchetypes,
      progressionLines: compatibleProgressionLines
    },
    coverage: {
      compatibleLocationCount: compatibleLocations.length,
      compatibleRoleCount: compatibleRoles.length,
      compatibleMotiveCount: compatibleMotives.length,
      compatibleEvidenceTypeCount: compatibleEvidenceTypes.length,
      compatibleRedHerringCount: compatibleRedHerrings.length,
      compatibleResourceCount: compatibleResources.length,
      compatibleFactionCount: compatibleFactions.length,
      compatibleEventArchetypeCount: compatibleEventArchetypes.length,
      compatibleProgressionLineCount: compatibleProgressionLines.length,
      selectedEvidenceTypeCount: evidenceTypes.length
    },
    riskSummary: {
      maxEvidenceContaminationRisk: evidenceTypes.reduce((max, row) => Math.max(max, row.contaminationRisk), 0),
      averageEvidenceContaminationRisk: evidenceTypes.length ? Math.round(riskTotal / evidenceTypes.length) : 0,
      redHerringRisk: redHerringPattern?.risk || 0,
      resourcePressure: resource?.pressure || 0,
      eventRisk: eventArchetype?.risk || 0,
      progressionStageCount: progressionLine?.stageCount || 0
    },
    preview: {
      title,
      theme,
      premise,
      publicCaseFile,
      evidenceLabels,
      roleLabels,
      motiveLabel,
      redHerringLabels,
      resourceLabel,
      factionLabel,
      eventArchetypeLabel,
      progressionLineLabel,
      worldSystemLabels
    },
    patches
  };
}

export function validateDetectiveContentPack(pack: Partial<DetectiveContentPack>): DetectiveContentValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!pack || typeof pack !== "object") errors.push("content pack must be an object.");
  if (pack.manifest?.schemaVersion !== "detective-content-pack.v1") errors.push("manifest.schemaVersion must be detective-content-pack.v1.");
  if (!pack.manifest?.id) errors.push("manifest.id is required.");

  const caseTypes = asArray(pack.caseTypes);
  const locations = asArray(pack.locations);
  const roles = asArray(pack.roles);
  const motives = asArray(pack.motives);
  const evidenceTypes = asArray(pack.evidenceTypes);
  const redHerringPatterns = asArray(pack.redHerringPatterns);
  const escalationRules = asArray(pack.escalationRules);
  const resources = asArray(pack.resources);
  const factions = asArray(pack.factions);
  const eventArchetypes = asArray(pack.eventArchetypes);
  const progressionLines = asArray(pack.progressionLines);

  for (const [label, rows] of Object.entries({ caseTypes, locations, roles, motives, evidenceTypes, redHerringPatterns, escalationRules, resources, factions, eventArchetypes, progressionLines })) {
    if (!rows.length) errors.push(`${label} must not be empty.`);
  }

  const caseTypeIds = collectIds(caseTypes, "caseTypes", errors);
  const locationIds = collectIds(locations, "locations", errors);
  const roleIds = collectIds(roles, "roles", errors);
  const motiveIds = collectIds(motives, "motives", errors);
  const evidenceTypeIds = collectIds(evidenceTypes, "evidenceTypes", errors);
  collectIds(redHerringPatterns, "redHerringPatterns", errors);
  collectIds(escalationRules, "escalationRules", errors);
  const resourceIds = collectIds(resources, "resources", errors);
  const factionIds = collectIds(factions, "factions", errors);
  const eventArchetypeIds = collectIds(eventArchetypes, "eventArchetypes", errors);
  const progressionLineIds = collectIds(progressionLines, "progressionLines", errors);

  const usesAuthoredCampaignGrammar = caseTypes.some((row) => typeof asRecord(row)?.authoredCluster === "string");
  if (usesAuthoredCampaignGrammar) {
    if (caseTypeIds.size < 12) errors.push("authored campaign grammar requires at least 12 case types.");
    if (eventArchetypeIds.size < 10) errors.push("authored campaign grammar requires at least 10 event archetypes.");
    if (progressionLineIds.size < 8) errors.push("authored campaign grammar requires at least 8 progression lines.");
  }

  if (locationIds.size < 3) warnings.push("locations has fewer than 3 rows.");
  for (const [label, ids] of Object.entries({ resources: resourceIds, factions: factionIds, eventArchetypes: eventArchetypeIds, progressionLines: progressionLineIds })) {
    if (ids.size < 5) warnings.push(`${label} has fewer than 5 rows.`);
  }
  checkRefs(caseTypes, "caseTypes", "evidenceTypeIds", "evidence type", evidenceTypeIds, errors);
  checkRefs(caseTypes, "caseTypes", "roleIds", "role", roleIds, errors);
  checkRefs(caseTypes, "caseTypes", "motiveIds", "motive", motiveIds, errors);
  checkRefs(locations, "locations", "caseTypeIds", "case type", caseTypeIds, errors);
  checkRefs(locations, "locations", "evidenceTypeIds", "evidence type", evidenceTypeIds, errors);
  checkRefs(roles, "roles", "motiveIds", "motive", motiveIds, errors);
  checkRefs(roles, "roles", "caseTypeIds", "case type", caseTypeIds, errors);
  checkRefs(motives, "motives", "caseTypeIds", "case type", caseTypeIds, errors);
  checkRefs(motives, "motives", "roleIds", "role", roleIds, errors);
  checkRefs(evidenceTypes, "evidenceTypes", "caseTypeIds", "case type", caseTypeIds, errors);
  checkRefs(redHerringPatterns, "redHerringPatterns", "caseTypeIds", "case type", caseTypeIds, errors);
  checkRefs(redHerringPatterns, "redHerringPatterns", "evidenceTypeIds", "evidence type", evidenceTypeIds, errors);
  checkRefs(redHerringPatterns, "redHerringPatterns", "roleIds", "role", roleIds, errors);
  checkRefs(escalationRules, "escalationRules", "caseTypeIds", "case type", caseTypeIds, errors);
  checkRefs(escalationRules, "escalationRules", "evidenceTypeIds", "evidence type", evidenceTypeIds, errors);
  checkRefs(resources, "resources", "caseTypeIds", "case type", caseTypeIds, errors);
  checkRefs(resources, "resources", "locationIds", "location", locationIds, errors);
  checkRefs(resources, "resources", "roleIds", "role", roleIds, errors);
  checkRefs(factions, "factions", "caseTypeIds", "case type", caseTypeIds, errors);
  checkRefs(factions, "factions", "locationIds", "location", locationIds, errors);
  checkRefs(factions, "factions", "roleIds", "role", roleIds, errors);
  checkRefs(factions, "factions", "resourceIds", "resource", resourceIds, errors);
  checkRefs(eventArchetypes, "eventArchetypes", "caseTypeIds", "case type", caseTypeIds, errors);
  checkRefs(eventArchetypes, "eventArchetypes", "locationIds", "location", locationIds, errors);
  checkRefs(eventArchetypes, "eventArchetypes", "roleIds", "role", roleIds, errors);
  checkRefs(eventArchetypes, "eventArchetypes", "resourceIds", "resource", resourceIds, errors);
  checkRefs(eventArchetypes, "eventArchetypes", "factionIds", "faction", factionIds, errors);
  checkDirectiveResponses(eventArchetypes, errors);
  checkAuthoringGrammar(caseTypes, eventArchetypes, progressionLines, errors);
  checkRefs(progressionLines, "progressionLines", "caseTypeIds", "case type", caseTypeIds, errors);
  checkRefs(progressionLines, "progressionLines", "resourceIds", "resource", resourceIds, errors);
  checkRefs(progressionLines, "progressionLines", "factionIds", "faction", factionIds, errors);
  checkRefs(progressionLines, "progressionLines", "eventArchetypeIds", "event archetype", eventArchetypeIds, errors);

  checkNumber(caseTypes, "caseTypes", "weight", errors, { min: 0 });
  checkNumber(locations, "locations", "weight", errors, { min: 0 });
  checkNumber(evidenceTypes, "evidenceTypes", "contaminationRisk", errors, { min: 0, max: 100 });
  checkNumber(redHerringPatterns, "redHerringPatterns", "risk", errors, { min: 0, max: 100 });
  checkNumber(escalationRules, "escalationRules", "weight", errors, { min: 0 });
  checkNumber(resources, "resources", "pressure", errors, { min: 0, max: 100 });
  checkNumber(factions, "factions", "weight", errors, { min: 0 });
  checkNumber(eventArchetypes, "eventArchetypes", "risk", errors, { min: 0, max: 100 });
  checkNumber(progressionLines, "progressionLines", "stageCount", errors, { min: 1, max: 12 });

  errors.push(...scanPublicSafe(pack));
  const uniqueErrors = Array.from(new Set(errors));
  const uniqueWarnings = Array.from(new Set(warnings));
  return {
    ok: uniqueErrors.length === 0,
    errors: uniqueErrors,
    warnings: uniqueWarnings,
    summary: buildDetectiveContentSummary(pack, {
      ok: uniqueErrors.length === 0,
      errorCount: uniqueErrors.length,
      warningCount: uniqueWarnings.length
    })
  };
}

export function loadBuiltInDetectiveContentPack(pack: DetectiveContentPack) {
  return validateDetectiveContentPack(pack);
}
