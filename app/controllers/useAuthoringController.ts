"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import detectiveCaseTypes from "@/content/detective-v1/case-types.json";
import detectiveEscalationRules from "@/content/detective-v1/escalation-rules.json";
import detectiveEventArchetypes from "@/content/detective-v1/event-archetypes.json";
import detectiveEvidenceTypes from "@/content/detective-v1/evidence-types.json";
import detectiveFactions from "@/content/detective-v1/factions.json";
import detectiveLocations from "@/content/detective-v1/locations.json";
import detectiveManifest from "@/content/detective-v1/manifest.json";
import detectiveMotives from "@/content/detective-v1/motives.json";
import detectiveProgressionLines from "@/content/detective-v1/progression-lines.json";
import detectiveRedHerringPatterns from "@/content/detective-v1/red-herring-patterns.json";
import detectiveResources from "@/content/detective-v1/resources.json";
import detectiveRoles from "@/content/detective-v1/roles.json";
import { cloneLocal, loadLocal } from "@/app/lib/client-runtime";
import {
  applyAuthoringPatch,
  buildDetectiveContentAuthoringGuide,
  buildDetectiveContentSummary,
  buildEmergenceProofTrace,
  buildPlayerProofTour,
  buildWorldMapSnapshot,
  createCaseGalleryEntry,
  createContentSeedBackupEntry,
  createPremiumAuthoringDraft,
  exportAuthoringJson,
  exportAuthoringMarkdown,
  exportCaseGalleryBundle,
  importCaseGalleryEntries,
  listCaseTemplates,
  selectDefaultDetectiveContentAuthoringSelection,
  validateAuthoringDraft,
  type AuthoringDraft,
  type AuthoringValidationReport,
  type CaseGalleryEntry,
  type CaseTemplateId,
  type DetectiveContentAuthoringSelection,
  type DetectiveContentPack
} from "@/lib/engine";

export type AuthoringTab = "case" | "content" | "characters" | "evidence" | "scenes" | "timeline" | "logic" | "gallery";
type ContentSeedHistoryEntry = {
id: string;
createdAt: string;
beforeTitle: string;
afterTitle: string;
caseTypeLabel: string;
patchCount: number;
backupTitle: string;
draft: AuthoringDraft;
validation: {
  valid: boolean;
  errorCount: number;
};
};
type SafeDiffGroup = "case" | "characters" | "evidence" | "logic";
type SafeDiffItem = {
group: SafeDiffGroup;
label: string;
field: string;
before: string;
after: string;
};
type WorkflowCoachStageId = "draft" | "content-seed" | "safe-diff" | "validation" | "run-draft" | "gallery-backup";
type WorkflowCoachStatus = "ready" | "active" | "blocked" | "done";
type WorkflowCoachStage = {
id: WorkflowCoachStageId;
label: string;
status: WorkflowCoachStatus;
detail: string;
};
type WorkflowCoachNextAction = {
label: string;
detail: string;
tone: WorkflowCoachStatus;
};

const safeDiffGroups: Array<{ id: SafeDiffGroup; label: string }> = [
{ id: "case", label: "Case" },
{ id: "characters", label: "Characters" },
{ id: "evidence", label: "Evidence" },
{ id: "logic", label: "Logic" }
];
const workflowCoachStages: Array<{ id: WorkflowCoachStageId; label: string }> = [
{ id: "draft", label: "Draft" },
{ id: "content-seed", label: "Content Seed" },
{ id: "safe-diff", label: "Safe Diff" },
{ id: "validation", label: "Validation" },
{ id: "run-draft", label: "Run Draft" },
{ id: "gallery-backup", label: "Gallery Backup" }
];

const authoringStorageKey = "detective-town-authoring-v1";
export const caseGalleryStorageKey = "detective-town-case-gallery-v1";
const caseTemplates = listCaseTemplates();
export const detectiveContentPack: DetectiveContentPack = {
  manifest: detectiveManifest as DetectiveContentPack["manifest"],
  caseTypes: detectiveCaseTypes as DetectiveContentPack["caseTypes"],
  locations: detectiveLocations,
  roles: detectiveRoles,
  motives: detectiveMotives,
  evidenceTypes: detectiveEvidenceTypes,
  redHerringPatterns: detectiveRedHerringPatterns,
  escalationRules: detectiveEscalationRules,
  resources: detectiveResources,
  factions: detectiveFactions,
  eventArchetypes: detectiveEventArchetypes as DetectiveContentPack["eventArchetypes"],
  progressionLines: detectiveProgressionLines
};
export const detectiveContentSummary = buildDetectiveContentSummary(detectiveContentPack);

function safeDiffText(value: unknown): string {
if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
if (typeof value === "string") return value;
if (typeof value === "number" || typeof value === "boolean") return String(value);
if (value == null) return "";
return "";
}

function safeDiffGroupForPath(path: string): SafeDiffGroup | null {
if (/^caseFromLog\.deductionCase\.(title|theme|premise|publicCaseFile)$/.test(path)) return "case";
if (/^caseFromLog\.deductionCase\.characters\.\d+\.(role|publicBio|motive)$/.test(path)) return "characters";
if (/^caseFromLog\.deductionCase\.evidence\.\d+\.(title|visibleDescription)$/.test(path)) return "evidence";
if (path === "caseFromLog.deductionCase.logicPuzzle.redHerrings") return "logic";
return null;
}

function safeDiffFieldLabel(path: string): string {
const character = path.match(/^caseFromLog\.deductionCase\.characters\.(\d+)\.(role|publicBio|motive)$/);
if (character) {
  const field = character[2] === "publicBio" ? "public bio" : character[2] === "motive" ? "motive surface" : "role";
  return `Character ${Number(character[1]) + 1} ${field}`;
}
const evidence = path.match(/^caseFromLog\.deductionCase\.evidence\.(\d+)\.(title|visibleDescription)$/);
if (evidence) {
  const field = evidence[2] === "visibleDescription" ? "visible description" : "title";
  return `Evidence ${Number(evidence[1]) + 1} ${field}`;
}
const labels: Record<string, string> = {
  "caseFromLog.deductionCase.title": "Case title",
  "caseFromLog.deductionCase.theme": "Theme",
  "caseFromLog.deductionCase.premise": "Premise",
  "caseFromLog.deductionCase.publicCaseFile": "Public case file",
  "caseFromLog.deductionCase.logicPuzzle.redHerrings": "Red herring labels"
};
return labels[path] || "Safe field";
}

function safeDiffFieldName(path: string): string {
const parts = path.split(".");
return parts.slice(-2).join(".");
}

function safeDiffItem(path: string, before: unknown, after: unknown, label = safeDiffFieldLabel(path)): SafeDiffItem | null {
const group = safeDiffGroupForPath(path);
if (!group) return null;
const beforeText = safeDiffText(before);
const afterText = safeDiffText(after);
if (beforeText === afterText) return null;
return { group, label, field: safeDiffFieldName(path), before: beforeText, after: afterText };
}

function safeCoachMessage(value: string) {
return value
  .replace(/\b(case|npc|agent|event|evidence|character|scene|timeline|world|session)-[A-Za-z0-9_-]+\b/g, "[private id]")
  .replace(/\b(culprit|truth|trueMeaning|checkpoint|sourceEventIds?|replay|package body)\b/gi, "[private field]")
  .slice(0, 160);
}

function buildAppliedSafeDiff(before: AuthoringDraft, after: AuthoringDraft): SafeDiffItem[] {
const beforeCase = before.caseFromLog.deductionCase;
const afterCase = after.caseFromLog.deductionCase;
const items: SafeDiffItem[] = [];
const push = (path: string, beforeValue: unknown, afterValue: unknown, label?: string) => {
  const item = safeDiffItem(path, beforeValue, afterValue, label);
  if (item) items.push(item);
};

push("caseFromLog.deductionCase.title", beforeCase.title, afterCase.title);
push("caseFromLog.deductionCase.theme", beforeCase.theme, afterCase.theme);
push("caseFromLog.deductionCase.premise", beforeCase.premise, afterCase.premise);
push("caseFromLog.deductionCase.publicCaseFile", beforeCase.publicCaseFile, afterCase.publicCaseFile);

const characterCount = Math.max(beforeCase.characters.length, afterCase.characters.length);
for (let index = 0; index < characterCount; index += 1) {
  const beforeCharacter = beforeCase.characters[index];
  const afterCharacter = afterCase.characters[index];
  push(`caseFromLog.deductionCase.characters.${index}.role`, beforeCharacter?.role, afterCharacter?.role);
  push(`caseFromLog.deductionCase.characters.${index}.publicBio`, beforeCharacter?.publicBio, afterCharacter?.publicBio);
  push(`caseFromLog.deductionCase.characters.${index}.motive`, beforeCharacter?.motive, afterCharacter?.motive);
}

const evidenceCount = Math.max(beforeCase.evidence.length, afterCase.evidence.length);
for (let index = 0; index < evidenceCount; index += 1) {
  const beforeEvidence = beforeCase.evidence[index];
  const afterEvidence = afterCase.evidence[index];
  push(`caseFromLog.deductionCase.evidence.${index}.title`, beforeEvidence?.title, afterEvidence?.title);
  push(`caseFromLog.deductionCase.evidence.${index}.visibleDescription`, beforeEvidence?.visibleDescription, afterEvidence?.visibleDescription);
}

push("caseFromLog.deductionCase.logicPuzzle.redHerrings", beforeCase.logicPuzzle.redHerrings, afterCase.logicPuzzle.redHerrings);
return items;
}

function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export type UseAuthoringControllerInput = {
  caseTemplateId: CaseTemplateId;
  setCaseTemplateId: (value: CaseTemplateId) => void;
  timeValue: number;
  onRunDraft: (draft: AuthoringDraft, message: string) => void;
  persistLocalDrafts: boolean;
};

export function useAuthoringController(input: UseAuthoringControllerInput) {
  const loaded = useRef(false);
  const [authoringDraft, setAuthoringDraft] = useState<AuthoringDraft>(() => createPremiumAuthoringDraft());
  const [authoringTab, setAuthoringTab] = useState<AuthoringTab>("case");
  const [contentSelection, setContentSelection] = useState<DetectiveContentAuthoringSelection>(() => selectDefaultDetectiveContentAuthoringSelection(detectiveContentPack));
  const [authoringCharacterId, setAuthoringCharacterId] = useState("");
  const [authoringEvidenceId, setAuthoringEvidenceId] = useState("");
  const [authoringSceneId, setAuthoringSceneId] = useState("");
  const [authoringTimelineId, setAuthoringTimelineId] = useState("");
  const [authoringImportText, setAuthoringImportText] = useState("");
  const [authoringExportText, setAuthoringExportText] = useState("");
  const [authoringStatus, setAuthoringStatus] = useState("Authoring uses browser-local state; it does not request an AI provider or write SQLite.");
  const [caseGalleryEntries, setCaseGalleryEntries] = useState<CaseGalleryEntry[]>([]);
  const [caseGalleryLoaded, setCaseGalleryLoaded] = useState(false);
  const [contentSeedHistory, setContentSeedHistory] = useState<ContentSeedHistoryEntry[]>([]);
  const [contentSeedPreviewed, setContentSeedPreviewed] = useState(false);

const authoringReport: AuthoringValidationReport = useMemo(() => validateAuthoringDraft(authoringDraft), [authoringDraft]);
const builtInGalleryEntries = useMemo(
  () => caseTemplates.map((template) => createCaseGalleryEntry(createPremiumAuthoringDraft(template.id), { source: "built-in", templateId: template.id })),
  []
);
const authoringCase = authoringDraft.caseFromLog.deductionCase;
const authoringCharacters = authoringCase.characters.filter((character) => character.role !== "\u6b7b\u8005");
const authoringCharacter = authoringCase.characters.find((character) => character.id === authoringCharacterId) || authoringCharacters[0] || authoringCase.characters[0];
const authoringEvidence = authoringCase.evidence.find((item) => item.id === authoringEvidenceId) || authoringCase.evidence[0];
const authoringScene = authoringCase.scenes.find((item) => item.id === authoringSceneId) || authoringCase.scenes[0];
const authoringTimelineEvent = authoringCase.truth.trueTimeline.find((item) => item.id === authoringTimelineId) || authoringCase.truth.trueTimeline[0];
const contentAuthoringGuide = useMemo(
  () => buildDetectiveContentAuthoringGuide(detectiveContentPack, authoringDraft, contentSelection),
  [authoringDraft, contentSelection]
);
const pendingSafeDiff = useMemo(
  () => contentAuthoringGuide.patches
    .map((patch) => safeDiffItem(patch.path, patch.before, patch.after, patch.label))
    .filter((item): item is SafeDiffItem => Boolean(item)),
  [contentAuthoringGuide.patches]
);
const appliedSafeDiff = useMemo(
  () => contentSeedHistory[0] ? buildAppliedSafeDiff(contentSeedHistory[0].draft, authoringDraft) : [],
  [authoringDraft, contentSeedHistory]
);
const authoringChecklist = useMemo(
  () => [
    { label: "Schema", ok: authoringReport.schema.valid, tab: "case" as AuthoringTab },
    { label: "Content Guide", ok: contentAuthoringGuide.coverage.compatibleEvidenceTypeCount > 0 && contentAuthoringGuide.coverage.compatibleRoleCount > 0, tab: "content" as AuthoringTab },
    { label: "World-backed Evidence", ok: Boolean(authoringDraft.caseFromLog.qualityReport.worldBackedEvidence), tab: "evidence" as AuthoringTab },
    { label: "Memory-scoped Testimony", ok: Boolean(authoringDraft.caseFromLog.qualityReport.memoryScopedTestimony), tab: "characters" as AuthoringTab },
    { label: "Hard Logic", ok: authoringReport.hardLogicValid, tab: "logic" as AuthoringTab },
    { label: "Playable Runtime", ok: authoringReport.valid, tab: "logic" as AuthoringTab }
  ],
  [authoringDraft.caseFromLog.qualityReport.memoryScopedTestimony, authoringDraft.caseFromLog.qualityReport.worldBackedEvidence, authoringReport.hardLogicValid, authoringReport.schema.valid, authoringReport.valid, contentAuthoringGuide.coverage.compatibleEvidenceTypeCount, contentAuthoringGuide.coverage.compatibleRoleCount]
);
const authoringProofAudit = useMemo(() => {
  const trace = buildEmergenceProofTrace(authoringDraft.world, authoringDraft.events, authoringDraft.caseFromLog, {
    solved: true,
    discoveredEvidenceIds: authoringDraft.caseFromLog.deductionCase.evidence.map((item) => item.id)
  });
  const tour = buildPlayerProofTour(authoringDraft.caseFromLog, authoringDraft.events, trace, {
    id: "authoring-proof-audit",
    worldId: authoringDraft.world.id,
    caseId: authoringDraft.caseFromLog.id,
    playerId: "author",
    displayName: "Author",
    discoveredEvidenceIds: authoringDraft.caseFromLog.deductionCase.evidence.map((item) => item.id),
    interrogationLog: [],
    judgement: { accepted: true, score: 100, missing: [], contradictions: [], explanation: "Authoring proof audit" },
    createdAt: authoringDraft.updatedAt,
    updatedAt: authoringDraft.updatedAt
  });
  return {
    valid: trace.complete && trace.evaluation.proofComplete && tour.some((step) => step.stage === "conclusion" && step.complete),
    trace,
    tour
  };
}, [authoringDraft]);
const authoringBlocker = authoringReport.issues.find((item) => item.severity === "error");
const authoringWorkflowCoach = useMemo(() => {
  const latestSeed = contentSeedHistory[0];
  const pendingPatchCount = contentAuthoringGuide.patches.length;
  const backupAvailable = Boolean(latestSeed && caseGalleryEntries.some((entry) => entry.title === latestSeed.backupTitle));
  const safeDiffActive = Boolean(latestSeed) || (contentSeedPreviewed && pendingSafeDiff.length > 0);
  const stages: WorkflowCoachStage[] = workflowCoachStages.map((stage) => {
    if (stage.id === "draft") {
      return { ...stage, status: "done", detail: `${authoringCase.title || "Untitled draft"} is loaded in browser state.` };
    }
    if (stage.id === "content-seed") {
      if (latestSeed) return { ...stage, status: "done", detail: `${latestSeed.patchCount} safe text patches applied from ${latestSeed.caseTypeLabel}.` };
      if (pendingPatchCount > 0) return { ...stage, status: contentSeedPreviewed ? "active" : "ready", detail: `${pendingPatchCount} safe text patches are available for preview.` };
      return { ...stage, status: "ready", detail: "No content seed changes are pending for this selection." };
    }
    if (stage.id === "safe-diff") {
      if (latestSeed) return { ...stage, status: "done", detail: `${appliedSafeDiff.length} applied public-text fields are visible for review.` };
      if (contentSeedPreviewed && pendingSafeDiff.length > 0) return { ...stage, status: "active", detail: `${pendingSafeDiff.length} pending public-text fields are visible before apply.` };
      if (pendingSafeDiff.length > 0) return { ...stage, status: "ready", detail: "Preview the content seed to inspect the safe diff before applying." };
      return { ...stage, status: "ready", detail: "No safe diff is currently active." };
    }
    if (stage.id === "validation") {
      if (authoringReport.errors.length > 0) return { ...stage, status: "blocked", detail: `${authoringReport.errors.length} blocker(s), ${authoringReport.warnings.length} warning(s).` };
      return { ...stage, status: "done", detail: `Validation pass with ${authoringReport.warnings.length} warning(s).` };
    }
    if (stage.id === "run-draft") {
      if (authoringReport.valid) return { ...stage, status: "ready", detail: "Run Draft is available for the current browser-local case." };
      return { ...stage, status: "blocked", detail: "Run Draft is disabled until validation blockers are fixed." };
    }
    if (stage.id === "gallery-backup") {
      if (backupAvailable && latestSeed) return { ...stage, status: "done", detail: `Backup available: ${latestSeed.backupTitle}.` };
      if (latestSeed) return { ...stage, status: "active", detail: "Seed history is active; Gallery backup is expected in local browser storage." };
      return { ...stage, status: "ready", detail: "A Gallery backup will be created before any non-empty seed apply." };
    }
    return { ...stage, status: "ready", detail: "" };
  });

  let nextAction: WorkflowCoachNextAction;
  if (authoringBlocker) {
    nextAction = {
      label: "Fix validation blocker",
      detail: safeCoachMessage(authoringBlocker.message),
      tone: "blocked"
    };
  } else if (latestSeed) {
    nextAction = {
      label: "Review applied safe diff",
      detail: latestSeed.validation.valid
        ? "Applied diff is clean. You can Undo Content Seed, load the Gallery backup, Run Draft, or save the current draft."
        : `${latestSeed.validation.errorCount} blocker(s) remain after apply.`,
      tone: latestSeed.validation.valid ? "done" : "blocked"
    };
  } else if (pendingPatchCount > 0 && !contentSeedPreviewed) {
    nextAction = {
      label: "Preview Content Seed",
      detail: `${pendingPatchCount} browser-local safe text patches can be reviewed before apply.`,
      tone: "active"
    };
  } else if (pendingPatchCount > 0) {
    nextAction = {
      label: "Review pending safe diff",
      detail: `${pendingSafeDiff.length} public-text fields are ready for apply or selection changes.`,
      tone: "active"
    };
  } else if (authoringReport.valid) {
    nextAction = {
      label: "Run Draft or Save to Gallery",
      detail: "The current draft passes validation and can move to runtime or browser-local reuse.",
      tone: "ready"
    };
  } else {
    nextAction = {
      label: "Review Rule Report",
      detail: "Check validation issues before running the draft.",
      tone: "blocked"
    };
  }

  return { stages, nextAction, backupAvailable, safeDiffActive };
}, [
  appliedSafeDiff.length,
  authoringBlocker,
  authoringCase.title,
  authoringReport.errors.length,
  authoringReport.valid,
  authoringReport.warnings.length,
  caseGalleryEntries,
  contentAuthoringGuide.patches.length,
  contentSeedHistory,
  contentSeedPreviewed,
  pendingSafeDiff.length
]);
const authoringMapSnapshot = useMemo(
  () => buildWorldMapSnapshot(authoringDraft.world, authoringDraft.events, authoringDraft.caseFromLog, undefined, { day: 1, time: minutesToTime(input.timeValue) }),
  [authoringDraft, input.timeValue]
);

  useEffect(() => {
    if (!authoringCharacterId && authoringCharacters[0]) setAuthoringCharacterId(authoringCharacters[0].id);
    if (!authoringEvidenceId && authoringCase.evidence[0]) setAuthoringEvidenceId(authoringCase.evidence[0].id);
    if (!authoringSceneId && authoringCase.scenes[0]) setAuthoringSceneId(authoringCase.scenes[0].id);
    if (!authoringTimelineId && authoringCase.truth.trueTimeline[0]) setAuthoringTimelineId(authoringCase.truth.trueTimeline[0].id);
  }, [authoringCase, authoringCharacterId, authoringCharacters, authoringEvidenceId, authoringSceneId, authoringTimelineId]);

  useEffect(() => {
    if (loaded.current) return;
    if (!input.persistLocalDrafts) {
      setCaseGalleryLoaded(true);
      return;
    }
    loaded.current = true;
    const savedDraft = loadLocal<AuthoringDraft | null>(authoringStorageKey, null);
    if (savedDraft?.caseFromLog?.deductionCase) setAuthoringDraft(savedDraft);
    setCaseGalleryEntries(loadLocal<CaseGalleryEntry[]>(caseGalleryStorageKey, []));
    setCaseGalleryLoaded(true);
  }, [input.persistLocalDrafts]);

  useEffect(() => {
    if (!input.persistLocalDrafts) return;
    localStorage.setItem(authoringStorageKey, JSON.stringify(authoringDraft));
  }, [authoringDraft, input.persistLocalDrafts]);

  useEffect(() => {
    if (!caseGalleryLoaded || !input.persistLocalDrafts) return;
    localStorage.setItem(caseGalleryStorageKey, JSON.stringify(caseGalleryEntries));
  }, [caseGalleryEntries, caseGalleryLoaded, input.persistLocalDrafts]);

function patchAuthoring(path: string, value: unknown) {
  setContentSeedPreviewed(false);
  setAuthoringDraft((current) => applyAuthoringPatch(current, { op: "set", path, value }));
}

function updateContentSelection(next: Partial<DetectiveContentAuthoringSelection>) {
  setContentSeedPreviewed(false);
  setContentSelection((current) => selectDefaultDetectiveContentAuthoringSelection(detectiveContentPack, { ...current, ...next }));
}

function toggleContentRole(roleId: string) {
  const current = new Set(contentAuthoringGuide.selection.roleIds);
  if (current.has(roleId)) current.delete(roleId);
  else current.add(roleId);
  updateContentSelection({ roleIds: Array.from(current) });
}

function toggleContentEvidenceType(evidenceTypeId: string) {
  const current = new Set(contentAuthoringGuide.selection.evidenceTypeIds);
  if (current.has(evidenceTypeId)) current.delete(evidenceTypeId);
  else current.add(evidenceTypeId);
  updateContentSelection({ evidenceTypeIds: Array.from(current) });
}

function previewContentSeed() {
  setContentSeedPreviewed(true);
  setAuthoringTab("content");
  setAuthoringStatus(`Preview Content Seed: ${contentAuthoringGuide.patches.length} safe text fields would change for ${contentAuthoringGuide.caseType?.label || "selected case type"}. No ids, clue order, suspect matrix, or proof structure will be changed.`);
}

function applyContentSeed() {
  if (!contentAuthoringGuide.patches.length) {
    setAuthoringStatus("No changes pending. The current draft already matches this content seed, so no Gallery backup was created.");
    return;
  }
  const backup = createContentSeedBackupEntry(authoringDraft);
  mergeGalleryEntries([backup]);
  let next = authoringDraft;
  for (const patch of contentAuthoringGuide.patches) {
    next = applyAuthoringPatch(next, { op: "set", path: patch.path, value: patch.after });
  }
  const report = validateAuthoringDraft(next);
  const createdAt = new Date().toISOString();
  const historyEntry: ContentSeedHistoryEntry = {
    id: `content-seed:${createdAt}`,
    createdAt,
    beforeTitle: authoringDraft.caseFromLog.deductionCase.title,
    afterTitle: next.caseFromLog.deductionCase.title,
    caseTypeLabel: contentAuthoringGuide.caseType?.label || contentAuthoringGuide.selection.caseTypeId,
    patchCount: contentAuthoringGuide.patches.length,
    backupTitle: backup.title,
    draft: cloneLocal(authoringDraft),
    validation: {
      valid: report.valid,
      errorCount: report.errors.length
    }
  };
  setContentSeedHistory((current) => [historyEntry, ...current].slice(0, 5));
  setAuthoringDraft(next);
  setContentSeedPreviewed(true);
  setAuthoringStatus(report.valid
    ? `Apply Content Seed complete: ${contentAuthoringGuide.patches.length} browser-local text fields updated. Undo Content Seed or Gallery backup "${backup.title}" can restore the prior draft.`
    : `Apply Content Seed complete, but validation now has ${report.errors.length} blockers. The draft is kept; use Undo Content Seed or load Gallery backup "${backup.title}" to revert.`);
}

function undoLatestContentSeed() {
  const latest = contentSeedHistory[0];
  if (!latest) {
    setAuthoringStatus("No Content Seed undo entry is available in this browser session.");
    return;
  }
  setAuthoringDraft({ ...cloneLocal(latest.draft), updatedAt: new Date().toISOString() });
  resetAuthoringSelection();
  setContentSeedHistory((current) => current.slice(1));
  setContentSeedPreviewed(false);
  setAuthoringTab("content");
  setAuthoringStatus(`Undo Content Seed restored "${latest.beforeTitle}" from the session audit trail. Gallery backup "${latest.backupTitle}" remains available.`);
}

function focusAuthoringIssue(issue: AuthoringValidationReport["issues"][number]) {
  const text = `${issue.path} ${issue.message}`;
  if (text.includes("characters") || text.includes("characterId")) {
    setAuthoringTab("characters");
    const hit = authoringCase.characters.find((item) => text.includes(item.id) || text.includes(item.name));
    if (hit) setAuthoringCharacterId(hit.id);
    return;
  }
  if (text.includes("evidence")) {
    setAuthoringTab("evidence");
    const hit = authoringCase.evidence.find((item) => text.includes(item.id) || text.includes(item.title));
    if (hit) setAuthoringEvidenceId(hit.id);
    return;
  }
  if (text.includes("scenes") || text.includes("scene")) {
    setAuthoringTab("scenes");
    const hit = authoringCase.scenes.find((item) => text.includes(item.id) || text.includes(item.name));
    if (hit) setAuthoringSceneId(hit.id);
    return;
  }
  if (text.includes("timeline") || text.includes("trueTimeline") || text.includes("event")) {
    setAuthoringTab("timeline");
    const hit = authoringCase.truth.trueTimeline.find((item) => text.includes(item.id));
    if (hit) setAuthoringTimelineId(hit.id);
    return;
  }
  setAuthoringTab("logic");
}

function runAuthoringCoachNextAction() {
  if (authoringBlocker) {
    focusAuthoringIssue(authoringBlocker);
    setAuthoringStatus(`Authoring Workflow Coach: fix validation blocker - ${safeCoachMessage(authoringBlocker.message)}`);
    return;
  }
  if (contentSeedHistory[0]) {
    setAuthoringTab("content");
    setAuthoringStatus("Authoring Workflow Coach: review Applied safe diff, then use Undo Content Seed, Gallery backup, Run Draft, or Save to Gallery.");
    return;
  }
  if (contentAuthoringGuide.patches.length > 0 && !contentSeedPreviewed) {
    previewContentSeed();
    setAuthoringStatus(`Authoring Workflow Coach: Preview Content Seed opened ${contentAuthoringGuide.patches.length} safe text patches for Safe Diff Review.`);
    return;
  }
  if (contentAuthoringGuide.patches.length > 0) {
    setAuthoringTab("content");
    setAuthoringStatus("Authoring Workflow Coach: review Pending safe diff, then apply the content seed or adjust the selection.");
    return;
  }
  if (authoringReport.valid) {
    setAuthoringStatus("Authoring Workflow Coach: draft is runnable. Use Run Draft for playtest or Save to Gallery for browser-local reuse.");
    return;
  }
  setAuthoringTab("logic");
  setAuthoringStatus("Authoring Workflow Coach: review Rule Report before running this draft.");
}

function authoringEvidenceReferences(evidenceId: string) {
  const refs: string[] = [];
  for (const scene of authoringCase.scenes) {
    if (scene.evidenceIds.includes(evidenceId)) refs.push(`\u573a\u666f\uff1a${scene.name}`);
  }
  for (const event of authoringCase.truth.trueTimeline) {
    if (event.contradictedByEvidenceIds.includes(evidenceId)) refs.push(`\u65f6\u95f4\u7ebf\uff1a${event.time}`);
  }
  for (const row of authoringCase.logicPuzzle.suspectMatrix) {
    if (row.excludedByEvidenceIds.includes(evidenceId)) refs.push(`\u6392\u9664\u77e9\u9635\uff1a${row.name}`);
  }
  for (const step of authoringCase.logicPuzzle.criticalReasoningChain) {
    if (step.evidenceIds.includes(evidenceId)) refs.push(`\u63a8\u7406\u94fe\uff1a${step.id}`);
  }
  if (authoringCase.logicPuzzle.requiredClueOrder.includes(evidenceId)) refs.push("\u5fc5\u8981\u7ebf\u7d22\u987a\u5e8f");
  return refs;
}

function loadPremiumTemplate(templateId: CaseTemplateId = input.caseTemplateId) {
  const draft = createPremiumAuthoringDraft(templateId);
  setAuthoringDraft(draft);
  setAuthoringCharacterId("");
  setAuthoringEvidenceId("");
  setAuthoringSceneId("");
  setAuthoringTimelineId("");
  setAuthoringExportText("");
  setAuthoringImportText("");
  input.setCaseTemplateId(templateId);
  setContentSeedHistory([]);
  setContentSeedPreviewed(false);
  setAuthoringStatus("\u5df2\u6062\u590d\u6848\u4f8b\u6a21\u677f\uff0c\u53ef\u7ee7\u7eed\u7f16\u8f91\u6216\u76f4\u63a5 Run Draft\u3002");
}

function resetAuthoringSelection() {
  setAuthoringCharacterId("");
  setAuthoringEvidenceId("");
  setAuthoringSceneId("");
  setAuthoringTimelineId("");
}

function mergeGalleryEntries(entries: CaseGalleryEntry[]) {
  setCaseGalleryEntries((current) => {
    const byId = new Map(current.map((entry) => [entry.id, entry]));
    for (const entry of entries) byId.set(entry.id, entry);
    return Array.from(byId.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  });
}

function saveAuthoringToGallery() {
  const entry = createCaseGalleryEntry(authoringDraft, { source: "local" });
  mergeGalleryEntries([entry]);
  setAuthoringStatus(`Saved "${entry.title}" to the browser-local Case Gallery.`);
  setAuthoringTab("gallery");
}

function loadGalleryEntry(entry: CaseGalleryEntry) {
  setAuthoringDraft({ ...cloneLocal(entry.draft), source: entry.source === "built-in" ? "premium-template" : entry.draft.source, updatedAt: new Date().toISOString() });
  resetAuthoringSelection();
  if (entry.templateId) input.setCaseTemplateId(entry.templateId);
  setAuthoringExportText("");
  setContentSeedHistory([]);
  setContentSeedPreviewed(false);
  setAuthoringTab("case");
  setAuthoringStatus(`Loaded "${entry.title}" from Case Gallery.`);
}

function runGalleryEntry(entry: CaseGalleryEntry) {
  if (!entry.validation.valid) {
    setAuthoringStatus(`"${entry.title}" is not runnable. Fix validation errors before running.`);
    return;
  }
  setAuthoringDraft(cloneLocal(entry.draft));
  resetAuthoringSelection();
  setContentSeedHistory([]);
  setContentSeedPreviewed(false);
  input.onRunDraft(entry.draft, `Created a temporary Static Demo Runtime from gallery case "${entry.title}".`);
}

function deleteGalleryEntry(entryId: string) {
  setCaseGalleryEntries((current) => current.filter((entry) => entry.id !== entryId));
  setAuthoringStatus("Local gallery draft deleted. Built-in templates remain available.");
}

function exportGalleryEntry(entry: CaseGalleryEntry) {
  setAuthoringExportText(exportAuthoringJson(entry.draft));
  setAuthoringStatus(`Exported "${entry.title}" as AuthoringDraft JSON.`);
}

function deleteAuthoringEvidence() {
  if (!authoringEvidence) return;
  const refs = authoringEvidenceReferences(authoringEvidence.id);
  setContentSeedPreviewed(false);
  setAuthoringDraft((current) => applyAuthoringPatch(current, { op: "delete-array-item", path: "caseFromLog.deductionCase.evidence", id: authoringEvidence.id }));
  setAuthoringEvidenceId("");
  setAuthoringStatus(refs.length ? `\u8bc1\u636e\u5df2\u5220\u9664\uff0c\u4f46\u4ecd\u88ab\u5f15\u7528\uff1a${refs.join("\uff1b")}\u3002Rule Report \u4f1a\u963b\u65ad Run Draft\u3002` : "\u8bc1\u636e\u5df2\u5220\u9664\uff0c\u672a\u53d1\u73b0\u6b8b\u7559\u5f15\u7528\u3002");
}

function importAuthoringJson() {
  try {
    const parsed = JSON.parse(authoringImportText);
    const importedEntries = importCaseGalleryEntries(parsed, authoringDraft);
    if (parsed?.version === 1 && Array.isArray(parsed?.entries)) {
      if (!importedEntries.length) throw new Error("Gallery bundle did not contain valid AuthoringDraft entries.");
      mergeGalleryEntries(importedEntries.map((entry) => ({ ...entry, source: "imported" })));
      setAuthoringTab("gallery");
      setAuthoringStatus(`Imported ${importedEntries.length} gallery entries into browser-local Case Gallery.`);
      return;
    }
    if (importedEntries.length) {
      const entry = { ...importedEntries[0], source: "imported" as const };
      setAuthoringDraft(entry.draft);
      mergeGalleryEntries([entry]);
      resetAuthoringSelection();
      setContentSeedHistory([]);
      setContentSeedPreviewed(false);
    } else if (parsed?.id && parsed?.truth && parsed?.logicPuzzle) {
      const next = cloneLocal(authoringDraft);
      next.caseFromLog.deductionCase = parsed;
      next.source = "imported";
      next.updatedAt = new Date().toISOString();
      setAuthoringDraft(next);
      setContentSeedHistory([]);
      setContentSeedPreviewed(false);
    } else {
      throw new Error("JSON must be an AuthoringDraft or a standalone DeductionCase.");
    }
    setAuthoringStatus("Import complete. Draft was loaded and saved to the browser-local Case Gallery.");
  } catch {
    setAuthoringStatus("Import failed safely. Check the JSON structure and retry.");
  }
}

function exportAuthoring(kind: "json" | "markdown") {
  const text = kind === "json" ? exportAuthoringJson(authoringDraft) : exportAuthoringMarkdown(authoringDraft);
  setAuthoringExportText(text);
  setAuthoringStatus(kind === "json" ? "Runnable case JSON generated." : "Case Markdown notes generated.");
}

function exportGalleryBundle() {
  setAuthoringExportText(exportCaseGalleryBundle(caseGalleryEntries));
  setAuthoringStatus(`Exported ${caseGalleryEntries.length} local gallery drafts as a CaseGalleryBundle.`);
}

  function runAuthoringDraft() {
    input.onRunDraft(authoringDraft, "Created a temporary Static Demo Runtime from the current Authoring Draft.");
  }

  return {
    authoringDraft,
    setAuthoringDraft,
    authoringTab,
    setAuthoringTab,
    contentSelection,
    authoringCharacterId,
    setAuthoringCharacterId,
    authoringEvidenceId,
    setAuthoringEvidenceId,
    authoringSceneId,
    setAuthoringSceneId,
    authoringTimelineId,
    setAuthoringTimelineId,
    authoringImportText,
    setAuthoringImportText,
    authoringExportText,
    authoringStatus,
    setAuthoringStatus,
    caseGalleryEntries,
    contentSeedHistory,
    contentSeedPreviewed,
    authoringReport,
    builtInGalleryEntries,
    authoringCase,
    authoringCharacters,
    authoringCharacter,
    authoringEvidence,
    authoringScene,
    authoringTimelineEvent,
    contentAuthoringGuide,
    pendingSafeDiff,
    appliedSafeDiff,
    authoringChecklist,
    authoringProofAudit,
    authoringBlocker,
    authoringWorkflowCoach,
    authoringMapSnapshot,
    caseTemplates,
    caseTemplateId: input.caseTemplateId,
    safeDiffGroups,
    detectiveContentSummary,
    detectiveContentPack,
    patchAuthoring,
    updateContentSelection,
    toggleContentRole,
    toggleContentEvidenceType,
    previewContentSeed,
    applyContentSeed,
    undoLatestContentSeed,
    focusAuthoringIssue,
    runAuthoringCoachNextAction,
    authoringEvidenceReferences,
    loadPremiumTemplate,
    saveAuthoringToGallery,
    loadGalleryEntry,
    runGalleryEntry,
    deleteGalleryEntry,
    exportGalleryEntry,
    deleteAuthoringEvidence,
    importAuthoringJson,
    exportAuthoring,
    exportGalleryBundle,
    runAuthoringDraft
  };
}

export type AuthoringController = ReturnType<typeof useAuthoringController>;
