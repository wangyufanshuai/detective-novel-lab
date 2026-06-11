import { getNovelRuntimeRecord, saveNovelRuntimeRecord, type NovelRuntimeRecord } from "@/app/api/v1/_novel-store";
import {
  applyNovelCorrectionOverlay,
  buildNovelCausalityReport,
  buildNovelQualityAuditReport,
  createSuggestedNovelCorrectionPatches,
  normalizeNovelCorrectionPatch,
  normalizeNovelCorrectionSet,
  revertNovelCorrectionPatch,
  validateNovelCorrectionSet,
  validateNovelWorldProject,
  type NovelCorrectionPatch
} from "@/lib/engine";

export function getNovelCorrectionContext(projectId?: string | null) {
  const record = getNovelRuntimeRecord(projectId);
  if (!record) return null;
  const correctionSet = normalizeNovelCorrectionSet(record.correctionSet, record.project);
  const correctedProject = applyNovelCorrectionOverlay(record.project, correctionSet);
  const auditReport = buildNovelQualityAuditReport(correctedProject, correctionSet, record.chapters);
  const usedPatchIds = new Set(correctionSet.patches.map((patch) => patch.id));
  const suggestedPatches = createSuggestedNovelCorrectionPatches(correctedProject, auditReport.issues)
    .filter((patch) => !usedPatchIds.has(patch.id));
  return {
    record,
    correctionSet,
    correctedProject,
    auditReport: { ...auditReport, suggestedPatches },
    suggestedPatches,
    correctionValidation: validateNovelCorrectionSet(correctionSet, record.project, record.chapters),
    correctedValidation: validateNovelWorldProject(correctedProject),
    causality: buildNovelCausalityReport(correctedProject)
  };
}

function withStatus(patch: NovelCorrectionPatch, status: NovelCorrectionPatch["status"], note?: string): NovelCorrectionPatch {
  const at = new Date().toISOString();
  const action = status === "applied" ? "applied" : status === "dismissed" ? "dismissed" : status === "reverted" ? "reverted" : "created";
  return {
    ...patch,
    status,
    updatedAt: at,
    auditTrail: [...patch.auditTrail, { at, action, note: note || `Patch ${status}.` }]
  };
}

export function saveCorrectionSet(record: NovelRuntimeRecord, patches: NovelCorrectionPatch[]) {
  const correctionSet = normalizeNovelCorrectionSet({
    ...record.correctionSet,
    projectId: record.project.id,
    patches,
    updatedAt: new Date().toISOString()
  }, record.project);
  return saveNovelRuntimeRecord({ ...record, correctionSet });
}

export function findCorrectionPatch(context: NonNullable<ReturnType<typeof getNovelCorrectionContext>>, patchId?: string | null, patchInput?: unknown) {
  if (patchInput) return normalizeNovelCorrectionPatch(patchInput);
  if (patchId) {
    return context.correctionSet.patches.find((patch) => patch.id === patchId) ||
      context.suggestedPatches.find((patch) => patch.id === patchId) ||
      null;
  }
  return context.suggestedPatches[0] || null;
}

export function upsertCorrectionPatch(record: NovelRuntimeRecord, patch: NovelCorrectionPatch, status: NovelCorrectionPatch["status"]) {
  const nextPatch = withStatus(patch, status);
  const patches = [nextPatch, ...record.correctionSet.patches.filter((item) => item.id !== patch.id)];
  return saveCorrectionSet(record, patches);
}

export function revertCorrection(record: NovelRuntimeRecord, patchId?: string | null) {
  const targetId = patchId || record.correctionSet.patches.find((patch) => patch.status === "applied")?.id;
  if (!targetId) return null;
  const nextSet = revertNovelCorrectionPatch(record.correctionSet, targetId);
  return saveNovelRuntimeRecord({ ...record, correctionSet: nextSet });
}
