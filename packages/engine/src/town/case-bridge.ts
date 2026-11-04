/** P0 contract only: public facts may seed a reader-safe writing draft.
 * Author truth requires a separate authenticated export, never this DTO. */
export type CaseStoryLink = {
  schema: "case-story-link.v1"; surface: "player"; worldId: string; worldRevision: number;
  caseId: string; truthRevision: string; branchId: string; chapterId: string;
  facts: Array<{ id: string; sourceRef: string; firstVisibleChapter: number }>;
};
export function validateCaseStoryLink(link: CaseStoryLink, source: { worldId: string; worldRevision: number; caseId: string; truthRevision: string; discoveredEvidenceIds: string[] }) {
  if (Object.keys(link).some(key => !["schema", "surface", "worldId", "worldRevision", "caseId", "truthRevision", "branchId", "chapterId", "facts"].includes(key))) throw new Error("Forbidden story fields");
  if (link.schema !== "case-story-link.v1" || link.surface !== "player" || !link.branchId || !link.chapterId ||
    link.worldId !== source.worldId || link.worldRevision !== source.worldRevision || link.caseId !== source.caseId || link.truthRevision !== source.truthRevision)
    throw new Error("Story link needs the current explicit world and case revision");
  if (link.facts.length > 100 || new Set(link.facts.map(f => f.id)).size !== link.facts.length) throw new Error("Duplicate or oversized facts");
  for (const fact of link.facts) {
    if (Object.keys(fact).some(key => !["id", "sourceRef", "firstVisibleChapter"].includes(key)) || !source.discoveredEvidenceIds.includes(fact.id) ||
      fact.sourceRef !== `evidence:${fact.id}` || !Number.isSafeInteger(fact.firstVisibleChapter) || fact.firstVisibleChapter < 1)
      throw new Error("Story fact is undiscovered or has no explicit disclosure chapter");
  }
  return structuredClone(link);
}
