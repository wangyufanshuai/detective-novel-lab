import type { SchemaIssue, SchemaReport } from "./types";

type Shape = "string" | "boolean" | "array" | "object";

const topLevelRequired = [
  "id",
  "title",
  "theme",
  "premise",
  "publicCaseFile",
  "truth",
  "characters",
  "evidence",
  "scenes",
  "relationships",
  "logicPuzzle"
] as const;

const requiredShape: Record<string, Shape> = {
  id: "string",
  title: "string",
  theme: "string",
  premise: "string",
  publicCaseFile: "string",
  truth: "object",
  characters: "array",
  evidence: "array",
  scenes: "array",
  relationships: "array",
  logicPuzzle: "object"
};

const truthRequired = ["culpritId", "motive", "method", "opportunity", "decisiveEvidenceIds", "trueTimeline"] as const;
const characterRequired = [
  "id",
  "name",
  "role",
  "publicBio",
  "secret",
  "motive",
  "means",
  "opportunity",
  "isCulprit",
  "alibi",
  "initialStatement",
  "knowledgeScope",
  "liePolicy",
  "contradictionTriggers"
] as const;
const evidenceRequired = [
  "id",
  "title",
  "location",
  "visibleDescription",
  "trueMeaning",
  "relatedCharacterIds",
  "discoverable",
  "isKey",
  "unlocks",
  "contradicts",
  "supportsConclusion",
  "discoveryDifficulty"
] as const;
const sceneRequired = ["id", "name", "description", "evidenceIds"] as const;
const timelineRequired = ["id", "time", "event", "characterIds", "isPublic", "source", "publicVersion", "contradictedByEvidenceIds"] as const;
const logicRequired = ["suspectMatrix", "exclusionChains", "criticalReasoningChain", "redHerrings", "requiredClueOrder"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function issue(path: string, message: string, severity: "error" | "warning" = "error"): SchemaIssue {
  return { path, message, severity };
}

function checkRequired(record: Record<string, unknown>, fields: readonly string[], path: string, errors: SchemaIssue[]) {
  for (const field of fields) {
    if (!(field in record)) {
      errors.push(issue(`${path}.${field}`, "Missing required field."));
    }
  }
}

function checkArrayItems(items: unknown, path: string, fields: readonly string[], errors: SchemaIssue[]) {
  if (!Array.isArray(items)) {
    errors.push(issue(path, "Expected array."));
    return;
  }
  items.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(issue(`${path}[${index}]`, "Expected object item."));
      return;
    }
    checkRequired(item, fields, `${path}[${index}]`, errors);
  });
}

export const deductionCaseJsonSchema = {
  title: "DeductionCase",
  type: "object",
  required: topLevelRequired,
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    theme: { type: "string" },
    premise: { type: "string" },
    publicCaseFile: { type: "string" },
    truth: { type: "object" },
    characters: { type: "array" },
    evidence: { type: "array" },
    scenes: { type: "array" },
    relationships: { type: "array" },
    logicPuzzle: { type: "object" }
  }
} as const;

export function validateCaseSchema(value: unknown): SchemaReport {
  const errors: SchemaIssue[] = [];
  const warnings: SchemaIssue[] = [];
  const normalizedHints: string[] = [];

  if (!isRecord(value)) {
    return {
      valid: false,
      errors: [issue("$", "Expected a JSON object.")],
      warnings,
      normalizedHints
    };
  }

  checkRequired(value, topLevelRequired, "$", errors);
  for (const [field, shape] of Object.entries(requiredShape)) {
    if (!(field in value)) continue;
    const actual = Array.isArray(value[field]) ? "array" : typeof value[field];
    if (actual !== shape) {
      errors.push(issue(`$.${field}`, `Expected ${shape}, got ${actual}.`));
    }
  }

  if (isRecord(value.truth)) {
    checkRequired(value.truth, truthRequired, "$.truth", errors);
    checkArrayItems(value.truth.trueTimeline, "$.truth.trueTimeline", timelineRequired, errors);
  }

  checkArrayItems(value.characters, "$.characters", characterRequired, errors);
  checkArrayItems(value.evidence, "$.evidence", evidenceRequired, errors);
  checkArrayItems(value.scenes, "$.scenes", sceneRequired, errors);

  if (isRecord(value.logicPuzzle)) {
    checkRequired(value.logicPuzzle, logicRequired, "$.logicPuzzle", errors);
    if (!Array.isArray(value.logicPuzzle.suspectMatrix)) {
      warnings.push(issue("$.logicPuzzle.suspectMatrix", "Expected array. The rule engine can derive a matrix, but SDK consumers should provide an array.", "warning"));
    }
    if (Array.isArray(value.logicPuzzle.exclusionChains)) {
      for (const [index, chain] of value.logicPuzzle.exclusionChains.entries()) {
        if (!isRecord(chain)) continue;
        if ("suspectId" in chain && !("characterId" in chain)) normalizedHints.push(`$.logicPuzzle.exclusionChains[${index}].suspectId can be normalized to characterId.`);
        if ("exclusionEvidenceIds" in chain && !("evidenceIds" in chain)) {
          normalizedHints.push(`$.logicPuzzle.exclusionChains[${index}].exclusionEvidenceIds can be normalized to evidenceIds.`);
        }
        if ("evidence" in chain && !("evidenceIds" in chain)) normalizedHints.push(`$.logicPuzzle.exclusionChains[${index}].evidence can be normalized to evidenceIds.`);
      }
    }
    if (Array.isArray(value.logicPuzzle.suspectMatrix)) {
      for (const [index, row] of value.logicPuzzle.suspectMatrix.entries()) {
        if (isRecord(row) && "suspectId" in row && !("characterId" in row)) {
          normalizedHints.push(`$.logicPuzzle.suspectMatrix[${index}].suspectId can be normalized to characterId.`);
        }
      }
    }
    if (Array.isArray(value.logicPuzzle.criticalReasoningChain)) {
      value.logicPuzzle.criticalReasoningChain.forEach((step, index) => {
        if (typeof step === "string") normalizedHints.push(`$.logicPuzzle.criticalReasoningChain[${index}] string step can be parsed for evidence ids.`);
        if (isRecord(step) && "supportingEvidenceIds" in step && !("evidenceIds" in step)) {
          normalizedHints.push(`$.logicPuzzle.criticalReasoningChain[${index}].supportingEvidenceIds can be normalized to evidenceIds.`);
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalizedHints
  };
}
