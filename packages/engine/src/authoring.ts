import { buildCaseLogicReport, buildDeductionGraph, deriveSuspectBoard, validateHardCaseLogic } from "./deduction-graph";
import { createPremiumShowcaseWorld } from "./premium-showcase";
import { validateCaseSchema } from "./schema";
import { getReasoningCoverage, validateCase } from "./validators";
import { validateWorldCase } from "./world-case";
import type { DeductionCase, ReasoningCoverage, SchemaReport } from "./types";
import type { CaseFromLog, CaseLogicReport, CaseTemplateId, DeductionGraph, SuspectBoardRow, WorldEvent, WorldState } from "./world-types";

export type AuthoringIssue = {
  id: string;
  severity: "error" | "warning";
  source: "schema" | "case" | "world" | "hard-logic" | "authoring";
  path: string;
  message: string;
};

export type AuthoringDraft = {
  version: 1;
  source: "premium-template" | "imported" | "custom";
  world: WorldState;
  events: WorldEvent[];
  caseFromLog: CaseFromLog;
  updatedAt: string;
};

export type AuthoringPatch =
  | { op: "set"; path: string; value: unknown }
  | { op: "delete-array-item"; path: string; id: string }
  | { op: "append-array-item"; path: string; value: unknown };

export type AuthoringValidationReport = {
  valid: boolean;
  hardLogicValid: boolean;
  schema: SchemaReport;
  issues: AuthoringIssue[];
  errors: AuthoringIssue[];
  warnings: AuthoringIssue[];
  qualityScore: number;
  logicStrength: number;
  misdirectionQuality: number;
  reasoningCoverage: ReasoningCoverage;
  suspectBoard: SuspectBoardRow[];
  deductionGraph: DeductionGraph;
  logicReport: CaseLogicReport;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function now() {
  return new Date().toISOString();
}

function issue(
  index: number,
  severity: "error" | "warning",
  source: AuthoringIssue["source"],
  path: string,
  message: string
): AuthoringIssue {
  return {
    id: `${source}-${severity}-${index}-${path.replace(/[^a-z0-9]+/gi, "-")}`,
    severity,
    source,
    path,
    message
  };
}

function pathParts(path: string) {
  return path
    .replace(/^\$\.?/, "")
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
}

function targetAt(root: Record<string, unknown>, path: string) {
  const parts = pathParts(path);
  const key = parts.pop();
  let current: unknown = root;
  for (const part of parts) {
    if (!current || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[part];
  }
  return key ? { parent: current as Record<string, unknown>, key } : null;
}

export function createAuthoringDraftFromCase(caseFromLog: CaseFromLog, world?: WorldState, events?: WorldEvent[]): AuthoringDraft {
  const fallback = world && events ? null : createPremiumShowcaseWorld("premium-showcase");
  return {
    version: 1,
    source: "premium-template",
    world: clone(world || fallback!.world),
    events: clone(events || fallback!.events),
    caseFromLog: clone(caseFromLog),
    updatedAt: now()
  };
}

export function createPremiumAuthoringDraft(templateId: CaseTemplateId = "archive-blunt"): AuthoringDraft {
  const premium = createPremiumShowcaseWorld("premium-showcase", templateId);
  return createAuthoringDraftFromCase(premium.activeCase, premium.world, premium.events);
}

export function applyAuthoringPatch(draft: AuthoringDraft, patch: AuthoringPatch): AuthoringDraft {
  const next = clone(draft);
  const target = targetAt(next as unknown as Record<string, unknown>, patch.path);
  if (!target) return { ...next, updatedAt: now() };

  if (patch.op === "set") {
    target.parent[target.key] = patch.value;
  }

  if (patch.op === "append-array-item") {
    const list = target.parent[target.key];
    if (Array.isArray(list)) list.push(patch.value);
  }

  if (patch.op === "delete-array-item") {
    const list = target.parent[target.key];
    if (Array.isArray(list)) {
      target.parent[target.key] = list.filter((item) => !item || typeof item !== "object" || (item as { id?: string }).id !== patch.id);
    }
  }

  next.updatedAt = now();
  return next;
}

export function validateAuthoringDraft(draft: AuthoringDraft): AuthoringValidationReport {
  const deductionCase = draft.caseFromLog.deductionCase;
  const schema = validateCaseSchema(deductionCase);
  const caseReport = validateCase(deductionCase);
  const worldReport = validateWorldCase(draft.world, draft.events, deductionCase);
  const hardReport = validateHardCaseLogic(draft.world, draft.events, draft.caseFromLog);
  const logicReport = buildCaseLogicReport(draft.world, draft.events, draft.caseFromLog);
  const deductionGraph = buildDeductionGraph(draft.caseFromLog, draft.events);
  const suspectBoard = deriveSuspectBoard(draft.caseFromLog, draft.events);
  const reasoningCoverage = getReasoningCoverage(deductionCase, deductionCase.evidence.filter((item) => item.discoverable).map((item) => item.id));
  const issues: AuthoringIssue[] = [];

  schema.errors.forEach((item, index) => issues.push(issue(index, "error", "schema", item.path, item.message)));
  schema.warnings.forEach((item, index) => issues.push(issue(index, "warning", "schema", item.path, item.message)));
  schema.normalizedHints.forEach((message, index) => issues.push(issue(index, "warning", "schema", "$", message)));
  caseReport.errors.forEach((message, index) => issues.push(issue(index, "error", "case", "$.caseFromLog.deductionCase", message)));
  caseReport.warnings.forEach((message, index) => issues.push(issue(index, "warning", "case", "$.caseFromLog.deductionCase", message)));
  worldReport.worldErrors.forEach((message, index) => issues.push(issue(index, "error", "world", "$.world", message)));
  worldReport.worldWarnings.forEach((message, index) => issues.push(issue(index, "warning", "world", "$.world", message)));
  hardReport.errors.forEach((message, index) => issues.push(issue(index, "error", "hard-logic", "$.caseFromLog", message)));

  if (!draft.events.length) issues.push(issue(0, "error", "authoring", "$.events", "A playable case needs world events as evidence sources."));
  if (!draft.caseFromLog.testimonies.length) issues.push(issue(1, "error", "authoring", "$.caseFromLog.testimonies", "A playable case needs memory-scoped testimonies."));

  const errors = issues.filter((item) => item.severity === "error");
  const warnings = issues.filter((item) => item.severity === "warning");
  return {
    valid: errors.length === 0,
    hardLogicValid: hardReport.valid,
    schema,
    issues,
    errors,
    warnings,
    qualityScore: draft.caseFromLog.qualityReport.qualityScore || draft.caseFromLog.qualityReport.score || 0,
    logicStrength: logicReport.logicStrength,
    misdirectionQuality: logicReport.misdirectionQuality,
    reasoningCoverage,
    suspectBoard,
    deductionGraph,
    logicReport
  };
}

export function exportAuthoringJson(draft: AuthoringDraft): string {
  return JSON.stringify(draft, null, 2);
}

export function exportAuthoringMarkdown(draft: AuthoringDraft): string {
  const c: DeductionCase = draft.caseFromLog.deductionCase;
  const board = deriveSuspectBoard(draft.caseFromLog, draft.events);
  const lines = [
    `# ${c.title}`,
    "",
    "## Public Case File",
    c.publicCaseFile,
    "",
    "## Characters",
    ...c.characters.map((item) => `- **${item.name}** (${item.role}): ${item.publicBio}`),
    "",
    "## Evidence",
    ...c.evidence.map((item) => `- **${item.id} / ${item.title}**: ${item.visibleDescription}`),
    "",
    "## Scenes",
    ...c.scenes.map((item) => `- **${item.name}**: ${item.description} Evidence: ${item.evidenceIds.join(", ") || "none"}`),
    "",
    "## True Timeline",
    ...c.truth.trueTimeline.map((item) => `- **${item.time}** ${item.event} Source: ${item.source}`),
    "",
    "## Suspect Matrix",
    ...board.map((row) => `- **${row.name}**: motive=${row.motive}, means=${row.means}, opportunity=${row.opportunity}, excludedBy=${row.exclusionEvidenceIds.join(", ") || "none"}`),
    "",
    "## Critical Reasoning Chain",
    ...c.logicPuzzle.criticalReasoningChain.map((item) => `- **${item.id}**: ${item.conclusion} Evidence: ${item.evidenceIds.join(", ")}`)
  ];
  return lines.join("\n");
}
