import { deriveSuspectMatrix } from "./validators";
import type { DeductionCase, Judgement, PlayerTheory } from "./types";

function textHits(userText: string, targetText: string) {
  const user = userText.trim();
  const target = targetText.trim();
  if (!user || !target) return false;
  if (user.length <= 6) return target.includes(user);
  return user.includes(target.slice(0, 8)) || target.includes(user.slice(0, 8));
}

export function judgeTheory(deductionCase: DeductionCase, theory: PlayerTheory, discoveredEvidenceIds: string[]): Judgement {
  const missing: string[] = [];
  const contradictions: string[] = [];
  const discovered = new Set(discoveredEvidenceIds);
  const selected = new Set(theory.evidenceIds);
  const decisive = deductionCase.truth.decisiveEvidenceIds || [];

  if (theory.culpritId !== deductionCase.truth.culpritId) contradictions.push("The accused culprit does not match the truth.");
  if (!theory.motive.trim()) missing.push("Missing motive explanation.");
  else if (!textHits(theory.motive, deductionCase.truth.motive)) missing.push("Motive explanation does not cover the core motive.");
  if (!theory.method.trim()) missing.push("Missing method explanation.");
  else if (!textHits(theory.method, deductionCase.truth.method)) missing.push("Method explanation does not cover the core mechanism.");

  for (const id of decisive) {
    if (!discovered.has(id)) missing.push(`Key evidence not discovered: ${id}`);
    if (!selected.has(id)) missing.push(`Key evidence missing from theory: ${id}`);
  }

  const matrix = deriveSuspectMatrix(deductionCase);
  for (const row of matrix.filter((item) => !item.isCulprit)) {
    if (row.excludedByEvidenceIds.length && !row.excludedByEvidenceIds.some((id) => selected.has(id) && discovered.has(id))) {
      missing.push(`Missing evidence to exclude suspect "${row.name}".`);
    }
  }

  const motiveHit = textHits(theory.motive, deductionCase.truth.motive);
  const methodHit = textHits(theory.method, deductionCase.truth.method);
  const coveredDecisive = decisive.filter((id) => selected.has(id) && discovered.has(id)).length;
  const excludedRows = matrix.filter((row) => !row.isCulprit && row.excludedByEvidenceIds.some((id) => selected.has(id) && discovered.has(id))).length;
  const nonCulprits = matrix.filter((row) => !row.isCulprit).length;
  const score =
    (theory.culpritId === deductionCase.truth.culpritId ? 30 : 0) +
    (motiveHit ? 18 : 0) +
    (methodHit ? 18 : 0) +
    Math.round((coveredDecisive / Math.max(decisive.length, 1)) * 24) +
    Math.round((excludedRows / Math.max(nonCulprits, 1)) * 10);
  const accepted = score >= 90 && contradictions.length === 0 && missing.length === 0;

  return {
    accepted,
    score,
    missing: Array.from(new Set(missing)),
    contradictions,
    explanation: accepted
      ? "Theory accepted: culprit, motive, method, key evidence, and exclusion chain are closed."
      : "Theory is incomplete: culprit, motive, method, key evidence, or exclusion chain still needs work."
  };
}
