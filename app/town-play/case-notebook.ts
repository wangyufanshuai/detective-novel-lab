import type { TownCaseView, TownPlayView } from "@/lib/town-play-contract";
import type { PlayerTheory } from "@/packages/engine/src/types";

/** Only discovered public records belong in the notebook or its local draft. */
export function restoreCaseDraft(value: unknown, c: TownCaseView): PlayerTheory {
  const saved = value && typeof value === "object" ? value as Partial<PlayerTheory> : {};
  const found = new Set(c.clues.map(e => e.id));
  const ids = (input: unknown) => Array.isArray(input) ? [...new Set(input.filter((id): id is string => typeof id === "string" && found.has(id)))] : [];
  const motiveEvidenceIds = ids(saved.proof?.motiveEvidenceIds);
  const methodEvidenceIds = ids(saved.proof?.methodEvidenceIds);
  return {
    culpritId: c.suspects.some(p => p.id === saved.culpritId) ? saved.culpritId! : "",
    motive: typeof saved.motive === "string" ? saved.motive.slice(0, 600) : "",
    method: typeof saved.method === "string" ? saved.method.slice(0, 600) : "",
    evidenceIds: [...new Set([...ids(saved.evidenceIds), ...motiveEvidenceIds, ...methodEvidenceIds])],
    proof: { motiveEvidenceIds, methodEvidenceIds }
  };
}

export function missingTheoryFields(draft: PlayerTheory) {
  return [!draft.culpritId && "调查对象", !draft.proof?.motiveEvidenceIds.length && "动机物证", !draft.proof?.methodEvidenceIds.length && "手法物证", !draft.evidenceIds.length && "引用材料"].filter((label): label is string => !!label);
}

/** Keep the printed clue number stable when the player discovers items out of order. */
export function caseClueNumber(id: string, fallback: number) {
  return id.match(/-(\d+)$/)?.[1] ?? String(fallback).padStart(2, "0");
}

/** A directory from the received public notebook, never an NPC schedule. */
export function casePeople(c: TownCaseView, residents: TownPlayView["residents"], places: Array<{ id: string }>) {
  const people = new Map(c.suspects.map(p => [p.id, p]));
  for (const line of c.conversations) if (!people.has(line.characterId)) people.set(line.characterId, { id: line.characterId, name: line.name, role: residents.find(p => p.npcId === line.characterId)?.role ?? "证人" });
  return [...people.values()].map(person => {
    const seen = residents.find(p => p.npcId === person.id);
    return {
      ...person, questioned: c.questionedIds.includes(person.id),
      corrected: c.conversations.some(line => line.characterId === person.id && line.corrected),
      sighting: seen ? `上次见于${seen.locationName} · 第 ${seen.day} 天 ${seen.time}` : "尚未亲眼见到，目击后会留下记录。",
      sceneId: seen?.sceneId && places.some(place => place.id === seen.sceneId) ? seen.sceneId : null
    };
  });
}

/** Repeated-check feedback is based only on a discovered clue and visible dialogue. */
export function evidenceCheckRecord(c: TownCaseView, personId: string, evidenceId: string) {
  const clue = c.clues.find(item => item.id === evidenceId);
  if (!clue) return null;
  const previous = [...c.conversations].reverse().find(line => line.characterId === personId && line.evidenceId === evidenceId);
  return { clue, previous };
}
