import type { CaseTruthLedger, DeductionCase, PlayerTheory } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((id) => typeof id === "string" && id.length > 0 && id.trim() === id);
}

/** Fail closed even when callers bypass TypeScript with an unvalidated JSON body. */
export function isPlayerTheoryInput(value: unknown): value is PlayerTheory {
  if (!isRecord(value)) return false;
  if (Object.keys(value).some((key) => !["culpritId", "motive", "method", "evidenceIds", "proof"].includes(key))) return false;
  if (typeof value.culpritId !== "string" || typeof value.motive !== "string" || typeof value.method !== "string" || !isIdList(value.evidenceIds)) return false;
  if (!Object.hasOwn(value, "proof")) return true;
  const proof = value.proof;
  return isRecord(proof)
    && Object.keys(proof).every((key) => key === "motiveEvidenceIds" || key === "methodEvidenceIds")
    && isIdList(proof.motiveEvidenceIds)
    && isIdList(proof.methodEvidenceIds);
}

/** Formatting normalization only; this deliberately makes no semantic claims. */
export function matchesCanonicalStatement(input: string, canonical: string): boolean {
  const normalize = (text: string) => text.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const expected = normalize(canonical);
  return expected.length > 0 && normalize(input) === expected;
}

/** Never return expected evidence IDs or private ledger labels to the player. */
export function evaluateTheoryProof(
  deductionCase: DeductionCase,
  ledger: CaseTruthLedger,
  theory: PlayerTheory,
  discoveredEvidenceIds: string[]
): { motiveHit: boolean; methodHit: boolean; missing: string[] } {
  const proof = theory.proof;
  if (!proof) return { motiveHit: false, methodHit: false, missing: ["Missing structured evidence assignments."] };

  const discovered = new Set(discoveredEvidenceIds);
  const selected = new Set(theory.evidenceIds);
  const discoverable = new Set(deductionCase.evidence.filter((item) => item.discoverable).map((item) => item.id));
  const missing: string[] = [];

  function coversGroup(kind: "motive" | "means", assignedIds: string[], label: string) {
    const obligations = ledger.obligations.filter((item) => item.required && item.kind === kind);
    const assigned = new Set(assignedIds);
    if (!assigned.size) {
      missing.push(`${label} proof needs assigned evidence.`);
      return false;
    }
    if (assignedIds.some((id) => !discoverable.has(id) || !discovered.has(id) || !selected.has(id))) {
      missing.push(`${label} proof must use discovered evidence selected in the theory.`);
      return false;
    }
    const relevant = new Set(obligations.flatMap((item) => item.evidenceIds));
    const covered = obligations.length > 0
      && obligations.every((item) => item.characterIds.includes(theory.culpritId)
        && item.evidenceIds.length > 0
        && item.evidenceIds.every((id) => assigned.has(id)))
      && assignedIds.every((id) => relevant.has(id));
    if (!covered) missing.push(`${label} evidence assignments do not close the required proof for the accused character.`);
    return covered;
  }

  const motiveHit = coversGroup("motive", proof.motiveEvidenceIds, "Motive");
  const methodHit = coversGroup("means", proof.methodEvidenceIds, "Method");
  return { motiveHit, methodHit, missing };
}
