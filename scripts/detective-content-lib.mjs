import fs from "node:fs";
import path from "node:path";
import { assertInside, scanPublicTextFiles, toPosix } from "./public-artifact-safety-lib.mjs";

export const DETECTIVE_CONTENT_SCHEMA_VERSION = "detective-content-pack.v1";
export const DEFAULT_CONTENT_ROOT = "content/detective-v1";

const TABLE_FILES = {
  caseTypes: "case-types.json",
  locations: "locations.json",
  roles: "roles.json",
  motives: "motives.json",
  evidenceTypes: "evidence-types.json",
  redHerringPatterns: "red-herring-patterns.json",
  escalationRules: "escalation-rules.json",
  resources: "resources.json",
  factions: "factions.json",
  eventArchetypes: "event-archetypes.json",
  progressionLines: "progression-lines.json"
};

const FORBIDDEN_KEY_RE = /api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|culpritId|truth|checkpoint|agent_state_snapshot|hiddenDebugLog/i;
const FORBIDDEN_TEXT_RE = /\bsk-[A-Za-z0-9][A-Za-z0-9_-]{12,}\b|authorization:\s*bearer|\.env\.local|[A-Za-z]:[\\/]/i;
const DIRECTIVE_INSTITUTION_KINDS = new Set(["police", "media", "family", "commerce", "civic", "medical", "court", "dock_union"]);
const DIRECTIVE_STRATEGIES = new Set(["allocate-investigation", "chase-headline", "protect-family", "audit-ledger", "schedule-autopsy", "review-court-record", "trace-cargo", "cultivate-informant", "hold-position"]);
const DIRECTIVE_LONG_ACTION_KINDS = new Set(["investigate-scene", "file-police-report", "publish-rumor", "suppress-story", "tamper-evidence", "protect-witness", "bribe-witness", "conduct-autopsy", "audit-ledger", "family-pressure", "surveil-suspect", "interview-witness", "intimidate-witness", "request-warrant", "leak-to-press", "verify-alibi", "hold-inquest", "cross-examine-witness", "review-court-record", "trace-cargo", "bribe-dockhand", "inspect-warehouse", "seal-autopsy-record", "second-medical-opinion", "secure-evidence-locker", "protect-chain-of-custody", "summon-family-council", "pressure-editor", "cultivate-informant", "verify-anonymous-tip"]);
const DIRECTIVE_REQUIRED_INSTITUTION = {
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
const CASE_MECHANIC_PROFILES = new Set(["record-custody", "witness-timeline", "forensic-timing", "evidence-chain", "access-control"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function scanPublicSafe(value, label = "$", errors = []) {
  if (typeof value === "string") {
    if (FORBIDDEN_TEXT_RE.test(value)) errors.push(`${label} contains forbidden public text.`);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => scanPublicSafe(item, `${label}[${index}]`, errors));
  } else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      const nextLabel = `${label}.${key}`;
      if (FORBIDDEN_KEY_RE.test(key)) errors.push(`${nextLabel} contains a forbidden public key.`);
      scanPublicSafe(nested, nextLabel, errors);
    }
  }
  return errors;
}

function collectIds(rows, label, errors) {
  const ids = new Set();
  for (const row of rows) {
    const record = asRecord(row);
    if (!record || typeof record.id !== "string" || !record.id.trim()) {
      errors.push(`${label} row is missing id.`);
      continue;
    }
    if (ids.has(record.id)) errors.push(`${label} ${record.id} is duplicated.`);
    ids.add(record.id);
  }
  return ids;
}

function checkRefs(rows, label, field, targetLabel, targetIds, errors) {
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

function checkDirectiveResponses(rows, errors) {
  for (const row of rows) {
    const record = asRecord(row);
    const responses = asRecord(record?.directiveResponses);
    if (!responses) continue;
    const id = typeof record?.id === "string" ? record.id : "(missing id)";
    for (const choice of ["support", "contain"]) {
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
      for (const field of ["label", "benefitLabel", "costLabel"]) {
        if (typeof response[field] !== "string" || !response[field].trim()) errors.push(`eventArchetypes ${id} directiveResponses.${choice}.${field} is required.`);
      }
    }
  }
}

function checkMechanicProfiles(rows, errors) {
  for (const row of rows) {
    const record = asRecord(row);
    if (!record?.mechanicProfileId) continue;
    if (!CASE_MECHANIC_PROFILES.has(String(record.mechanicProfileId))) {
      errors.push(`caseTypes ${String(record.id || "(missing id)")} mechanicProfileId is invalid.`);
    }
  }
}

function checkNumber(rows, label, field, errors, { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
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

function countRowsWithRefs(rows, field) {
  return rows.filter((row) => Array.isArray(row?.[field]) && row[field].length > 0).length;
}

function countRowsWithAnyRefs(rows, fields) {
  return rows.filter((row) => fields.some((field) => Array.isArray(row?.[field]) && row[field].length > 0)).length;
}

export function readDetectiveContentPack({ contentRoot = DEFAULT_CONTENT_ROOT, root = process.cwd() } = {}) {
  const workspaceRoot = path.resolve(root);
  const resolvedContentRoot = assertInside(workspaceRoot, path.resolve(root, contentRoot), "Detective content root");
  const pack = {
    manifest: readJson(path.join(resolvedContentRoot, "manifest.json"))
  };
  for (const [key, fileName] of Object.entries(TABLE_FILES)) {
    pack[key] = readJson(path.join(resolvedContentRoot, fileName));
  }
  return { pack, resolvedContentRoot, relativePath: toPosix(path.relative(root, resolvedContentRoot)) };
}

export function buildDetectiveContentSummary(pack, validation = { ok: true, errorCount: 0, warningCount: 0 }) {
  const caseTypes = asArray(pack.caseTypes);
  const evidenceTypes = asArray(pack.evidenceTypes);
  const roles = asArray(pack.roles);
  const motives = asArray(pack.motives);
  const locations = asArray(pack.locations);
  const resources = asArray(pack.resources);
  const factions = asArray(pack.factions);
  const eventArchetypes = asArray(pack.eventArchetypes);
  const progressionLines = asArray(pack.progressionLines);
  const worldSystemRecordCount = roles.length + locations.length + resources.length + factions.length + eventArchetypes.length + progressionLines.length;
  return {
    packId: pack.manifest?.id,
    schemaVersion: pack.manifest?.schemaVersion,
    tableCounts: {
      caseTypes: asArray(pack.caseTypes).length,
      locations: locations.length,
      roles: roles.length,
      motives: asArray(pack.motives).length,
      evidenceTypes: evidenceTypes.length,
      redHerringPatterns: asArray(pack.redHerringPatterns).length,
      escalationRules: asArray(pack.escalationRules).length,
      resources: resources.length,
      factions: factions.length,
      eventArchetypes: eventArchetypes.length,
      progressionLines: progressionLines.length
    },
    caseTypeCount: asArray(pack.caseTypes).length,
    evidenceTypeCount: evidenceTypes.length,
    locationCount: locations.length,
    roleCount: roles.length,
    motiveCount: asArray(pack.motives).length,
    redHerringPatternCount: asArray(pack.redHerringPatterns).length,
    escalationRuleCount: asArray(pack.escalationRules).length,
    resourceCount: resources.length,
    factionCount: factions.length,
    eventArchetypeCount: eventArchetypes.length,
    progressionLineCount: progressionLines.length,
    worldSystemCount: 6,
    worldSystemRecordCount,
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

export function validateDetectiveContentPack(pack) {
  const errors = [];
  const warnings = [];
  if (!pack || typeof pack !== "object") errors.push("content pack must be an object.");
  if (pack.manifest?.schemaVersion !== DETECTIVE_CONTENT_SCHEMA_VERSION) errors.push(`manifest.schemaVersion must be ${DETECTIVE_CONTENT_SCHEMA_VERSION}.`);
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
  collectIds(progressionLines, "progressionLines", errors);

  if (locationIds.size < 3) warnings.push("locations has fewer than 3 rows.");
  for (const [label, ids] of Object.entries({ resources: resourceIds, factions: factionIds, eventArchetypes: eventArchetypeIds, progressionLines: new Set(progressionLines.map((row) => row?.id).filter(Boolean)) })) {
    if (ids.size < 5) warnings.push(`${label} has fewer than 5 rows.`);
  }
  checkRefs(caseTypes, "caseTypes", "evidenceTypeIds", "evidence type", evidenceTypeIds, errors);
  checkRefs(caseTypes, "caseTypes", "roleIds", "role", roleIds, errors);
  checkRefs(caseTypes, "caseTypes", "motiveIds", "motive", motiveIds, errors);
  checkMechanicProfiles(caseTypes, errors);
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
  checkRefs(progressionLines, "progressionLines", "caseTypeIds", "case type", caseTypeIds, errors);
  checkRefs(progressionLines, "progressionLines", "resourceIds", "resource", resourceIds, errors);
  checkRefs(progressionLines, "progressionLines", "factionIds", "faction", factionIds, errors);
  checkRefs(progressionLines, "progressionLines", "eventArchetypeIds", "event archetype", eventArchetypeIds, errors);

  checkNumber(caseTypes, "caseTypes", "weight", errors);
  checkNumber(locations, "locations", "weight", errors);
  checkNumber(evidenceTypes, "evidenceTypes", "contaminationRisk", errors, { min: 0, max: 100 });
  checkNumber(redHerringPatterns, "redHerringPatterns", "risk", errors, { min: 0, max: 100 });
  checkNumber(escalationRules, "escalationRules", "weight", errors);
  checkNumber(resources, "resources", "pressure", errors, { min: 0, max: 100 });
  checkNumber(factions, "factions", "weight", errors);
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

export function validateDetectiveContentDirectory({ contentRoot = DEFAULT_CONTENT_ROOT, root = process.cwd() } = {}) {
  const errors = [];
  const warnings = [];
  let pack = null;
  let resolvedContentRoot = "";
  let relativePath = contentRoot;
  try {
    const read = readDetectiveContentPack({ contentRoot, root });
    pack = read.pack;
    resolvedContentRoot = read.resolvedContentRoot;
    relativePath = read.relativePath;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read detective content pack.";
    return {
      ok: false,
      relativePath,
      errors: [message],
      warnings,
      summary: buildDetectiveContentSummary({}, { ok: false, errorCount: 1, warningCount: 0 })
    };
  }
  const required = ["manifest.json", ...Object.values(TABLE_FILES)];
  for (const fileName of required) {
    if (!fs.existsSync(path.join(resolvedContentRoot, fileName))) errors.push(`${fileName} is required.`);
  }
  const scan = scanPublicTextFiles({ dir: resolvedContentRoot, label: relativePath });
  errors.push(...scan.errors);
  const validation = validateDetectiveContentPack(pack);
  errors.push(...validation.errors);
  warnings.push(...validation.warnings);
  const uniqueErrors = Array.from(new Set(errors));
  const uniqueWarnings = Array.from(new Set(warnings));
  return {
    ok: uniqueErrors.length === 0,
    relativePath,
    errors: uniqueErrors,
    warnings: uniqueWarnings,
    summary: buildDetectiveContentSummary(pack, {
      ok: uniqueErrors.length === 0,
      errorCount: uniqueErrors.length,
      warningCount: uniqueWarnings.length
    })
  };
}
