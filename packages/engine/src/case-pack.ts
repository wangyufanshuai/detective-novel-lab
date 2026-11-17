import type { Character, DeductionCase, Evidence } from "./types";
import type { CaseFromLog, MemoryRecord, WorldEvent, WorldState } from "./world-types";
import { validateWorldCase } from "./world-case";
import { buildCaseQualityReport, buildTravelConstraint, shortestTravelMinutes } from "./world-analysis";
import { certifyPlayableCase } from "./route-certificate";

/**
 * PRIVATE authored case data. A pack is plain data: the people, clues, the
 * hidden history and the reasoning that proves it. `buildCasePackage` turns a
 * pack into the engine's case structures and refuses any pack that does not
 * validate against the world (real places and people, possible journeys,
 * source-backed clues, a certified play route). Never import packs in a client.
 */
export type CasePack = {
  /** Frozen content revision; changing it means a new save fact. */
  revision: string;
  /** Stable key; the case id is `${worldId}-${key}-v1` and the session `${ownerId}-${key}`. */
  key: string;
  ordinal: string;
  title: string;
  theme: string;
  premise: string;
  publicCaseFile: string;
  /** Asked on the theory form, e.g. "谁移走了原图". */
  question: string;
  /** Headline once solved; `{person}` is replaced with the culprit's name. */
  verdict: string;
  /** Before opening: what the town notices, and where the notebook is handed out. */
  commission: { hook: string; detail: string; openAt: string[]; refusal: string };
  /** The previous case that must be closed first. */
  after?: string;
  /** The town day this case's history happens on (default 1). Play starts at
   * day 1 08:00 and the player sleeps through each night at the inn, so a day-N
   * case's history fills the early hours of day N and its commission opens at
   * 08:00 that morning, once the previous case is closed. */
  day?: number;
  /** Hidden history window on that day, inclusive ("HH:MM"); must end by 08:00. */
  window: { from: string; to: string };
  ids: { clue: string; search: string };
  historyTag: string;
  historyNote: string;
  timelineSource: string;
  culpritId: string;
  witnessId: string;
  suspectIds: string[];
  culprit: { motive: string; means: string; opportunity: string };
  others: { motive: string; means: string; opportunity: string };
  statements: Record<string, string>;
  /** Clue number → resident → corrected statement. */
  revisions: Record<string, Record<number, string>>;
  evidence: Array<{ n: number; at: string; title: string; text: string; meaning: string; related: string[]; contradicts?: string[]; search: string; needsPresent?: string }>;
  history: Array<{ key: string; time: string; at: string; type: WorldEvent["type"]; actors: string[]; summary: string; tags?: string[]; clue?: number; publicVersion?: string; contradictedBy?: number[] }>;
  scenes: string[];
  relationships: DeductionCase["relationships"];
  exclusions: Array<{ characterId: string; reason: string; clues: number[] }>;
  reasoning: Array<{ id: string; conclusion: string; clues: number[] }>;
  redHerrings: string[];
  decisive: number[];
  /** The intended accepted theory: clue numbers that prove motive and method. Used by the
   * auto-playthrough check, never sent to a player. */
  answer: { motive: number[]; method: number[] };
  sources: { motive: number; means: number; opportunity: number; staging: number; trace: number; groupAlibi: number };
  events: { trigger: string; motive: string; means: string[]; opportunity: string; staging: string; trace: string; groupAlibi: string; scene: string; prep: string };
  ending: string[];
};

export type CaseScript = {
  revision: string;
  targets: Array<{ id: string; sceneId: string; label: string; evidenceId: string; needsPresent?: string }>;
  statements: Record<string, string>;
  revisions: Record<string, Record<string, string>>;
  ending: string[];
};

export type CasePackage = { caseFromLog: CaseFromLog; events: WorldEvent[]; memories: MemoryRecord[]; script: CaseScript };

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
/** Minutes since day 1 00:00, so histories on different days order correctly. */
const absolute = (e: Pick<WorldEvent, "day" | "time">) => (e.day - 1) * 24 * 60 + minutes(e.time);
export const casePackDay = (pack: Pick<CasePack, "day">) => pack.day ?? 1;
/** Morning play starts; a pack's commission opens no earlier than 08:00 on its day. */
export const CASE_DAY_OPENS = "08:00";
export function casePackReady(pack: Pick<CasePack, "day">, clock: { day: number; currentTime: string }) {
  return clock.day > casePackDay(pack) || (clock.day === casePackDay(pack) && clock.currentTime >= CASE_DAY_OPENS);
}

export function buildCasePackage(world: WorldState, pack: CasePack, now: string): CasePackage {
  const id = `${world.id}-${pack.key}-v1`;
  const eventId = (key: string) => `${id}-${key}`;
  const clue = (n: number) => `${pack.ids.clue}-${String(n).padStart(2, "0")}`;
  const { culpritId, suspectIds, statements } = pack;
  const evidence: Evidence[] = pack.evidence.map(e => ({ id: clue(e.n), title: e.title, location: e.at, visibleDescription: e.text, trueMeaning: e.meaning, relatedCharacterIds: e.related, discoverable: true, isKey: true, unlocks: [], contradicts: e.contradicts ?? [], supportsConclusion: [], discoveryDifficulty: "easy" }));
  const events: WorldEvent[] = pack.history.map(h => ({ id: eventId(h.key), worldId: world.id, day: casePackDay(pack), time: h.time, locationId: h.at, type: h.type, actorIds: h.actors, relatedCharacterIds: [...h.actors], summary: h.summary, publicSummary: pack.historyNote, hidden: true, tags: [pack.historyTag, ...(h.tags ?? [])], ...(h.clue ? { evidenceId: clue(h.clue) } : {}) }));
  const revisions: CaseScript["revisions"] = Object.fromEntries(Object.entries(pack.revisions).map(([npcId, byClue]) => [npcId, Object.fromEntries(Object.entries(byClue).map(([n, text]) => [clue(Number(n)), text]))]));
  const characters: Character[] = world.npcs.map(npc => {
    const facts = npc.id === culpritId ? pack.culprit : pack.others;
    return {
      id: npc.id, name: npc.name, role: npc.role, publicBio: `${npc.name}是${world.name}的${npc.role}。`,
      secret: npc.secret, motive: facts.motive, means: facts.means, opportunity: facts.opportunity,
      isCulprit: npc.id === culpritId, isSuspect: suspectIds.includes(npc.id), alibi: statements[npc.id], initialStatement: statements[npc.id],
      knowledgeScope: events.filter(e => e.actorIds.includes(npc.id)).map(e => e.id), liePolicy: npc.liePolicy,
      contradictionTriggers: Object.keys(revisions[npc.id] || {})
    };
  });
  const truthOf = characters.find(c => c.id === culpritId)!;
  const deductionCase: DeductionCase = {
    id, triggerKind: "nonfatal_incident", title: pack.title, theme: pack.theme, premise: pack.premise, publicCaseFile: pack.publicCaseFile,
    truth: { culpritId, motive: truthOf.motive, method: truthOf.means, opportunity: truthOf.opportunity,
      decisiveEvidenceIds: pack.decisive.map(clue),
      trueTimeline: pack.history.map((h, i) => ({ id: events[i].id, time: h.time, event: h.summary, characterIds: h.actors, isPublic: false, source: pack.timelineSource, publicVersion: h.publicVersion ?? "", contradictedByEvidenceIds: (h.contradictedBy ?? []).map(clue) })) },
    characters, evidence,
    scenes: pack.scenes.map(locationId => ({ id: locationId, name: world.locations.find(l => l.id === locationId)!.name, description: world.locations.find(l => l.id === locationId)!.description, evidenceIds: evidence.filter(e => e.location === locationId).map(e => e.id) })),
    relationships: pack.relationships,
    logicPuzzle: {
      suspectMatrix: [],
      exclusionChains: pack.exclusions.map(x => ({ characterId: x.characterId, reason: x.reason, evidenceIds: x.clues.map(clue) })),
      criticalReasoningChain: pack.reasoning.map(r => ({ id: r.id, conclusion: r.conclusion, evidenceIds: r.clues.map(clue) })),
      redHerrings: pack.redHerrings, requiredClueOrder: []
    }
  };
  const memories: MemoryRecord[] = characters.flatMap(character => events.filter(e => e.actorIds.includes(character.id)).map(e => ({ id: `${e.id}-memory-${character.id}`, worldId: world.id, npcId: character.id, kind: "direct" as const, eventId: e.id, day: e.day, summary: e.summary, confidence: 1, visibleToPlayer: false, challengeableEvidenceIds: character.contradictionTriggers })));
  const testimonies = characters.map(character => ({ id: `${id}-testimony-${character.id}`, caseId: id, characterId: character.id, initialStatement: character.initialStatement, currentStatement: character.initialStatement, contradictionEvidenceIds: character.contradictionTriggers, exposedContradictions: [], revised: false, memoryIds: memories.filter(m => m.npcId === character.id).map(m => m.id) })).filter(t => t.memoryIds.length > 0);
  const s = pack.sources, k = pack.events;
  const sourceMap: CaseFromLog["sourceMap"] = {
    motiveEvidenceId: clue(s.motive), meansEvidenceId: clue(s.means), opportunityEvidenceId: clue(s.opportunity), stagingEvidenceId: clue(s.staging), traceEvidenceId: clue(s.trace), groupAlibiEvidenceId: clue(s.groupAlibi), sourceEventIds: events.map(e => e.id), triggeredEventId: eventId(k.trigger),
    evidenceSourceEventIds: Object.fromEntries(evidence.map(e => [e.id, events.filter(v => v.evidenceId === e.id).map(v => v.id)])),
    chainStageSourceEventIds: { motive: [eventId(k.motive)], means: k.means.map(eventId), opportunity: [eventId(k.opportunity)] }, memorySourceIds: memories.map(m => m.id)
  };
  const generationProfile: CaseFromLog["generationProfile"] = {
    seed: pack.revision, triggerKind: "nonfatal_incident", triggerEventId: eventId(k.trigger),
    // Legacy profile requires this field even for nonfatal incidents. No weapon
    // is instantiated or inferred from it; triggerKind is authoritative.
    archetype: "blade", victimId: "", culpritId, witnessId: pack.witnessId, focusSuspectIds: suspectIds,
    sceneLocationId: k.scene, prepLocationId: k.prep, motiveEventId: eventId(k.motive), meansEventId: eventId(k.means[0]), opportunityEventId: eventId(k.opportunity), deathEventId: "", stagingEventId: eventId(k.staging), traceEventId: eventId(k.trace), groupAlibiEventId: eventId(k.groupAlibi), decisiveEvidenceIds: deductionCase.truth.decisiveEvidenceIds
  };
  const enrichedWorld = { ...world, memories: [...world.memories, ...memories] };
  const caseFromLog: CaseFromLog = { id, worldId: world.id, sourceEventIds: events.map(e => e.id), deathEventId: "", triggeredEventId: eventId(k.trigger), triggerKind: "nonfatal_incident", generationProfile, sourceMap, testimonies, deductionCase, qualityReport: buildCaseQualityReport(enrichedWorld, events, { deductionCase, generationProfile, testimonies }), validation: validateWorldCase(enrichedWorld, events, deductionCase), createdAt: now };
  const script: CaseScript = {
    revision: pack.revision, statements, revisions,
    targets: pack.evidence.map((e, index) => ({ id: `${pack.ids.search}-${index + 1}`, sceneId: e.at, label: e.search, evidenceId: clue(e.n), ...(e.needsPresent ? { needsPresent: e.needsPresent } : {}) })),
    ending: pack.ending
  };
  const bundle = { caseFromLog, events, memories, script };
  const problems = validateCasePackage(world, bundle, pack.window, casePackDay(pack));
  if (problems.length) throw new Error(`Case ${pack.key} authoring failed: ${problems.join("; ")}`);
  return bundle;
}

/** Stronger than structural references alone: every clue resolves to real
 * source events, all sources use this world and actual actors/places, and
 * dialogue revisions have corresponding testimony evidence. */
export function validateCasePackage(world: WorldState, bundle: CasePackage, window: CasePack["window"], day = 1): string[] {
  const errors: string[] = [];
  const { caseFromLog: c, events, memories, script } = bundle;
  const eventIds = new Set(events.map(e => e.id)), npcIds = new Set(world.npcs.map(n => n.id)), places = new Set(world.locations.map(l => l.id));
  if (eventIds.size !== events.length) errors.push("Duplicate source identity");
  for (const e of events) {
    if (e.worldId !== world.id || !places.has(e.locationId) || e.actorIds.some(id => !npcIds.has(id))) errors.push(`Invalid source ownership ${e.id}`);
    if (!Number.isSafeInteger(day) || day < 1 || e.day !== day || !/^\d\d:[0-5]\d$/.test(e.time) || e.time < window.from || e.time > window.to || window.to > CASE_DAY_OPENS) errors.push(`Invalid opening time ${e.id}`);
  }
  for (const t of c.deductionCase.truth.trueTimeline) {
    const source = events.find(e => e.id === t.id);
    if (!source || source.time !== t.time || source.summary !== t.event || JSON.stringify(source.actorIds) !== JSON.stringify(t.characterIds)) errors.push(`Timeline drift ${t.id}`);
  }
  errors.push(...journeyProblems(world, events));
  for (const e of c.deductionCase.evidence) {
    const refs = c.sourceMap.evidenceSourceEventIds?.[e.id] || [];
    if (!refs.length || refs.some(id => !events.some(v => v.id === id && v.evidenceId === e.id))) errors.push(`Unbacked clue ${e.id}`);
    if (!script.targets.some(t => t.evidenceId === e.id && t.sceneId === e.location)) errors.push(`Unsearchable clue ${e.id}`);
  }
  for (const t of script.targets) if (t.needsPresent && !npcIds.has(t.needsPresent)) errors.push(`Unknown present resident ${t.id}`);
  for (const m of memories) if (!eventIds.has(m.eventId) || m.worldId !== world.id || !events.some(e => e.id === m.eventId && e.actorIds.includes(m.npcId))) errors.push(`Unsupported direct memory ${m.id}`);
  for (const [npcId, revisions] of Object.entries(script.revisions)) for (const evidenceId of Object.keys(revisions)) if (!c.testimonies.some(t => t.characterId === npcId && t.contradictionEvidenceIds.includes(evidenceId))) errors.push(`Unsupported revision ${npcId}`);
  const validation = validateWorldCase({ ...world, memories: [...world.memories, ...memories] }, events, c.deductionCase);
  if (!validation.valid) errors.push(...validation.issues);
  const certificate = certifyPlayableCase(c, events);
  if (!certificate.routeCertified || !certificate.sourceBacked) errors.push(...certificate.blockers.map(b => b.label), ...(!certificate.sourceBacked ? ["Incomplete proof sources"] : []));
  return errors;
}

/** Every resident's authored moves must be walkable in the time between them. */
function journeyProblems(world: WorldState, events: WorldEvent[]) {
  const errors: string[] = [];
  const roads = buildTravelConstraint(world);
  for (const npc of world.npcs) {
    const route = events.filter(e => e.actorIds.includes(npc.id)).sort((a, b) => absolute(a) - absolute(b));
    for (let i = 1; i < route.length; i++) if (shortestTravelMinutes(roads, route[i - 1].locationId, route[i].locationId) > absolute(route[i]) - absolute(route[i - 1])) errors.push(`Impossible historical journey ${npc.id}: ${route[i].id}`);
  }
  return errors;
}

/** Cases in one town share its mornings: their histories together must stay walkable,
 * ids must not collide, each `after` must name an earlier case, and a case may not
 * happen on an earlier day than the case it follows. */
export function validateCaseSeries(world: WorldState, packages: Array<{ pack: CasePack; bundle: CasePackage }>): string[] {
  const errors: string[] = [];
  const keys = packages.map(p => p.pack.key);
  if (new Set(keys).size !== keys.length) errors.push("Duplicate case key");
  for (const prefix of ["clue", "search"] as const) { const all = packages.map(p => p.pack.ids[prefix]); if (new Set(all).size !== all.length) errors.push(`Shared ${prefix} prefix`); }
  packages.forEach((p, i) => {
    if (p.pack.after && !keys.slice(0, i).includes(p.pack.after)) errors.push(`Case ${p.pack.key} follows an unknown or later case`);
    const before = packages.find(q => q.pack.key === p.pack.after);
    if (before && casePackDay(p.pack) < casePackDay(before.pack)) errors.push(`Case ${p.pack.key} happens on an earlier day than ${before.pack.key}`);
  });
  errors.push(...journeyProblems(world, packages.flatMap(p => p.bundle.events)).map(e => `Across cases: ${e}`));
  return errors;
}
