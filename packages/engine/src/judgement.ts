import { deriveSuspectMatrix } from "./validators";
import type { DeductionCase, Judgement, PlayerTheory } from "./types";
import { buildDeductionCaseTruthLedger, evaluateCaseProofCoverage } from "./proof-ledger";
import { evaluateTheoryProof, isPlayerTheoryInput, matchesCanonicalStatement } from "./theory-proof";

export { isPlayerTheoryInput } from "./theory-proof";

export function judgeTheory(deductionCase: DeductionCase, theory: PlayerTheory, discoveredEvidenceIds: string[]): Judgement {
  if (!isPlayerTheoryInput(theory)) {
    return {
      accepted: false,
      score: 0,
      missing: ["Invalid theory format: use culpritId, motive, method, evidenceIds, and optional proof evidence assignments."],
      contradictions: [],
      explanation: "Theory rejected: the submission does not match the supported evidence-assignment contract."
    };
  }
  const missing: string[] = [];
  const contradictions: string[] = [];
  const discovered = new Set(discoveredEvidenceIds);
  const selected = new Set(theory.evidenceIds);
  const decisive = deductionCase.truth.decisiveEvidenceIds || [];
  const proofLedger = buildDeductionCaseTruthLedger(deductionCase);
  const proofCoverage = evaluateCaseProofCoverage(proofLedger, {
    discoveredEvidenceIds,
    selectedEvidenceIds: theory.evidenceIds
  });
  const proof = theory.proof ? evaluateTheoryProof(deductionCase, proofLedger, theory, discoveredEvidenceIds) : null;
  const motiveHit = proof ? proof.motiveHit : matchesCanonicalStatement(theory.motive, deductionCase.truth.motive);
  const methodHit = proof ? proof.methodHit : matchesCanonicalStatement(theory.method, deductionCase.truth.method);

  if (theory.culpritId !== deductionCase.truth.culpritId) contradictions.push("The accused culprit does not match the truth.");
  if (proof) missing.push(...proof.missing);
  else {
    if (!motiveHit) missing.push("Motive explanation requires a complete canonical statement or structured evidence assignments.");
    if (!methodHit) missing.push("Method explanation requires a complete canonical statement or structured evidence assignments.");
  }

  const discoverable = new Set(deductionCase.evidence.filter((item) => item.discoverable).map((item) => item.id));
  if (theory.evidenceIds.some((id) => !discoverable.has(id) || !discovered.has(id))) {
    missing.push("Theory evidence must be discoverable and already discovered.");
  }

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

  for (const gap of proofCoverage.gaps) {
    if (gap.missingEvidenceIds.length) {
      missing.push(`${gap.label}: ${gap.detail}`);
    }
  }

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
      : "Theory is incomplete: culprit, motive, method, key evidence, or exclusion chain still needs work.",
    proofCoverage
  };
}
