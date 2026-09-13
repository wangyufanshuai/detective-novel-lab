import type { CaseFromLog, PlayerSession } from "@/lib/engine";

/** Build the deliberately small case view consumed by player clients. Private
 * truth, source maps and hidden event chains never cross this boundary. */
export function playerCaseProjection(caseFromLog: CaseFromLog, session?: PlayerSession | null) {
  const solved = Boolean(session?.judgement?.accepted);
  const discovered = new Set(session?.discoveredEvidenceIds || []);
  const source = caseFromLog.deductionCase;
  return {
    id: caseFromLog.id,
    worldId: caseFromLog.worldId,
    createdAt: caseFromLog.createdAt,
    deductionCase: {
      id: source.id,
      title: source.title,
      theme: source.theme,
      premise: source.premise,
      publicCaseFile: source.publicCaseFile,
      characters: source.characters.map((character) => ({
        id: character.id,
        name: character.name,
        role: character.role,
        publicDescription: character.publicBio
      })),
      evidence: source.evidence.map((evidence) => {
        const visible = solved || discovered.has(evidence.id);
        return {
          id: evidence.id,
          title: visible ? evidence.title : "密封档案",
          visibleDescription: visible ? evidence.visibleDescription : "调查后解锁该档案内容。",
          discoverable: evidence.discoverable,
          location: evidence.location
        };
      }),
      scenes: source.scenes.map((scene) => ({ id: scene.id, name: scene.name, description: scene.description })),
      relationships: source.relationships.map((relationship) => ({ ...relationship }))
    },
    // These fields are intentionally omitted: truth, logicPuzzle and sourceMap.
    session: session ? {
      id: session.id,
      worldId: session.worldId,
      caseId: session.caseId,
      playerId: session.playerId,
      displayName: session.displayName,
      discoveredEvidenceIds: session.discoveredEvidenceIds,
      interrogationLog: session.interrogationLog,
      submittedTheory: session.submittedTheory,
      judgement: session.judgement,
      revision: session.updatedAt
    } : undefined
  };
}
