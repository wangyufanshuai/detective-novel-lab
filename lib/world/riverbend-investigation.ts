import { evidenceWeatherBlock } from "@/packages/engine/src/riverbend-weather";
import { RIVERBEND_PLAY_DAYS } from "@/packages/engine/src/riverbend-world";
import { createHash } from "node:crypto";
import { buildCasePackage, casePackDay, casePackReady, type CasePack } from "@/packages/engine/src/case-pack";
import { RIVERBEND_CASES, riverbendCasePack, type RiverbendCaseScript } from "@/packages/engine/src/riverbend-case";
import { detectContradictionHit, makeRuleBoundInterrogation, submitWorldTheory, updateTestimonyWithContradiction } from "@/packages/engine/src/world-case";
import { isPlayerTheoryInput } from "@/packages/engine/src/judgement";
import { certifyPlayableCase } from "@/packages/engine/src/route-certificate";
import type { WorldState, PlayerSession, CaseFromLog, WorldEvent } from "@/packages/engine/src/world-types";
import type { TownCaseAction, TownCaseView, TownCommissionView, TownClosedCaseView, TownCaseSeriesView } from "@/lib/town-play-contract";
import { worldRepository as repo } from "./repository";

/** This reference and frozen dialogue live only inside the owned private save.
 * `key` names the authored case; saves made before case two have none and are case one. */
export type TownInvestigation = { caseId: string; sessionId: string; factSha256: string; script: RiverbendCaseScript; key?: string };
export class InvestigationError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
const packOf = (ref: TownInvestigation): CasePack => riverbendCasePack(ref.key ?? RIVERBEND_CASES[0].key) ?? RIVERBEND_CASES[0];
function ownedRecords(worldId: string, ref: TownInvestigation) {
  const c = repo.getCase(ref.caseId), session = repo.getSession(ref.sessionId);
  if (!c || !session || c.worldId !== worldId || session.worldId !== worldId || session.caseId !== c.id) throw new InvestigationError("这份案件手记暂时无法恢复，原记录已保留。");
  return { c, session };
}
const isSolved = (worldId: string, ref?: TownInvestigation) => !!ref && ownedRecords(worldId, ref).session.judgement?.accepted === true;

/** The next authored case in line: none while one is still open. It may not be
 * ready yet when its history belongs to a later morning (`casePackReady`). */
function nextPack(worldId: string, ref: TownInvestigation | undefined, closed: TownInvestigation[]) {
  if (ref && !isSolved(worldId, ref)) return null;
  const done = new Set([...closed, ...(ref ? [ref] : [])].map(r => packOf(r).key));
  return RIVERBEND_CASES.find(pack => !done.has(pack.key) && (!pack.after || done.has(pack.after))) ?? null;
}

/** A commission waiting for a later morning names only that day: its hook would
 * describe something that has not happened in the town yet. */
export function projectTownCommission(worldId: string, ref: TownInvestigation | undefined, closed: TownInvestigation[] = [], clock?: { day: number; currentTime: string }): TownCommissionView | null {
  const pack = nextPack(worldId, ref, closed);
  if (!pack) return null;
  if (clock && !casePackReady(pack, clock)) return { ordinal: pack.ordinal, hook: "河湾暂时没有新的委托。", detail: `第 ${casePackDay(pack)} 天早上再来看看；旅馆傍晚起可以订房过夜。`, openAt: [], opensOnDay: casePackDay(pack) };
  // The first authored scene is the player's concrete next stop. Keep the
  // commission's original alternatives in the private pack, but make the
  // public hand-off deterministic so the tracker and journal agree.
  return { ordinal: pack.ordinal, hook: pack.commission.hook, detail: pack.commission.detail, openAt: [...pack.commission.openAt], primarySceneId: pack.scenes[0] };
}

/** Each authored case in order with its day and where the player stands on it. */
export function projectCaseSeries(worldId: string, ref: TownInvestigation | undefined, closed: TownInvestigation[] = []): TownCaseSeriesView["cases"] {
  const done = new Set(closed.map(r => packOf(r).key));
  const active = ref ? packOf(ref).key : null;
  if (active && isSolved(worldId, ref)) done.add(active);
  const next = nextPack(worldId, ref, closed)?.key;
  return RIVERBEND_CASES.map(pack => {
    const state = done.has(pack.key) ? "closed" as const : pack.key === active ? "active" as const : pack.key === next ? "next" as const : "later" as const;
    return { ordinal: pack.ordinal, day: casePackDay(pack), state, ...(state === "closed" || state === "active" ? { title: pack.title } : {}) };
  });
}

/** Each authored case in order with its day and where the player stands on it. */
export function projectCaseSeries(worldId: string, ref: TownInvestigation | undefined, closed: TownInvestigation[] = []): TownCaseSeriesView["cases"] {
  const done = new Set(closed.map(r => packOf(r).key));
  const active = ref ? packOf(ref).key : null;
  if (active && isSolved(worldId, ref)) done.add(active);
  const next = nextPack(worldId, ref, closed)?.key;
  return RIVERBEND_CASES.map(pack => {
    const state = done.has(pack.key) ? "closed" as const : pack.key === active ? "active" as const : pack.key === next ? "next" as const : "later" as const;
    return { ordinal: pack.ordinal, day: casePackDay(pack), state, ...(state === "closed" || state === "active" ? { title: pack.title } : {}) };
  });
}

export function projectClosedCases(worldId: string, closed: TownInvestigation[] = []): TownClosedCaseView[] {
  return closed.map(ref => {
    const { c } = ownedRecords(worldId, ref);
    const pack = packOf(ref);
    return { id: c.id, ordinal: pack.ordinal, title: c.deductionCase.title, person: c.deductionCase.characters.find(p => p.id === c.deductionCase.truth.culpritId)?.name ?? "" };
  });
}

/** Explicit player whitelist. Even a rejected submission never returns the
 * engine's scores, missing private clue IDs, source graph or memory IDs. */
export function projectTownInvestigation(worldId: string, sceneId: string | null, ref?: TownInvestigation): TownCaseView | null {
  if (!ref) return null;
  const { c, session } = ownedRecords(worldId, ref);
  const pack = packOf(ref);
  const found = new Set(session.discoveredEvidenceIds), solved = session.judgement?.accepted === true;
  const name = (id: string) => c.deductionCase.characters.find(p => p.id === id)?.name || "居民";
  return {
    id: c.id, revision: ref.script.revision, ordinal: pack.ordinal, question: pack.question, title: c.deductionCase.title, premise: c.deductionCase.premise, brief: c.deductionCase.publicCaseFile, solved,
    suspects: c.deductionCase.characters.filter(p => p.isSuspect !== false).map(p => ({ id: p.id, name: p.name, role: p.role })),
    clues: c.deductionCase.evidence.filter(e => found.has(e.id)).map(e => ({ id: e.id, title: e.title, sceneId: e.location, description: e.visibleDescription })),
    searchTargets: ref.script.targets.filter(t => t.sceneId === sceneId).map(t => ({ id: t.id, label: t.label, found: found.has(t.evidenceId) })),
    leads: [...ref.script.targets.filter(t => !found.has(t.evidenceId)).reduce((open, t) => open.set(t.sceneId, (open.get(t.sceneId) || 0) + 1), new Map<string, number>())].map(([leadSceneId, open]) => ({ sceneId: leadSceneId, open })),
    conversations: session.interrogationLog.map(l => ({ id: l.id, characterId: l.characterId, name: name(l.characterId), question: l.question, answer: l.answer, ...(l.evidenceId ? { evidenceId: l.evidenceId } : {}), corrected: l.challenge?.hit === true })),
    questionedIds: [...new Set(session.interrogationLog.filter(l => !l.evidenceId).map(l => l.characterId))],
    ...(session.judgement ? { message: solved ? "证词、时间与物证已相互印证，案件归档。" : "这份结论还不能归档。请核对动机、手法、时间与排除依据，并当面核对有冲突的证词。" } : {}),
    ...(session.submittedTheory ? { lastTheory: structuredClone(session.submittedTheory) } : {}),
    ...(solved ? { resolution: { person: name(c.deductionCase.truth.culpritId), headline: pack.verdict.replace("{person}", name(c.deductionCase.truth.culpritId)), motive: c.deductionCase.truth.motive, method: c.deductionCase.truth.method, timeline: c.deductionCase.truth.trueTimeline.map(t => ({ time: t.time, event: t.event })).sort((a, b) => a.time.localeCompare(b.time)), ending: [...ref.script.ending] } } : {})
  };
}

/** Caller must hold the authenticated world capability AND one SQLite immediate
 * transaction. No network/model request or client-supplied private case here. */
export function executeTownInvestigation(input: { world: WorldState; sceneId: string; observedNpcIds: string[]; ownerId: string; ref?: TownInvestigation; closed?: TownInvestigation[]; command: TownCaseAction; events: WorldEvent[] }) {
  const { world, sceneId, command } = input;
  const closed = input.closed ?? [];
  const now = new Date().toISOString();
  if (command.kind === "case-open") {
    if (input.ref && !isSolved(world.id, input.ref)) return { world, ref: input.ref, closed, events: [] as WorldEvent[] };
    const pack = nextPack(world.id, input.ref, closed);
    if (!pack) throw new InvestigationError("眼下没有新的委托。可以在手记里回看已归档的案件。");
    if (!casePackReady(pack, world)) throw new InvestigationError(`下一宗委托要到第 ${casePackDay(pack)} 天早上才会出现。`);
    if (!pack.commission.openAt.includes(sceneId)) throw new InvestigationError(pack.commission.refusal);
    const bundle = buildCasePackage(world, pack, now);
    const session: PlayerSession = { id: `${input.ownerId}-${pack.key}`, worldId: world.id, caseId: bundle.caseFromLog.id, playerId: input.ownerId, displayName: "河湾访客", discoveredEvidenceIds: [], interrogationLog: [], createdAt: now, updatedAt: now };
    repo.saveCase(bundle.caseFromLog); repo.saveSession(session);
    const factSha256 = createHash("sha256").update(JSON.stringify({ revision: bundle.script.revision, truth: bundle.caseFromLog.deductionCase.truth, evidence: bundle.caseFromLog.deductionCase.evidence, script: bundle.script })).digest("hex");
    return {
      world: { ...world, memories: [...world.memories, ...bundle.memories], npcs: world.npcs.map(n => ({ ...n, memoryEventIds: [...n.memoryEventIds, ...bundle.memories.filter(m => m.npcId === n.id).map(m => m.eventId)] })) },
      ref: { caseId: bundle.caseFromLog.id, sessionId: session.id, factSha256, script: bundle.script, key: pack.key },
      closed: input.ref ? [...closed, input.ref] : closed,
      events: bundle.events
    };
  }
  if (!input.ref) throw new InvestigationError(RIVERBEND_CASES[0].commission.refusal);
  const { c, session } = ownedRecords(world.id, input.ref);
  if (session.judgement?.accepted) throw new InvestigationError("这宗案件已经归档，可在手记里回看经过。");
  const pack = packOf(input.ref);
  let nextCase: CaseFromLog = c;
  if (command.kind === "case-search") {
    const target = input.ref.script.targets.find(t => t.id === command.targetId);
    if (!target || target.sceneId !== sceneId) throw new InvestigationError("需要亲自到达这处地点，才能核对物品。");
    // Saves from before case two carry no `needsPresent`; the authored pack still knows.
    const needsPresent = target.needsPresent ?? pack.evidence.find(e => `${pack.ids.clue}-${String(e.n).padStart(2, "0")}` === target.evidenceId)?.needsPresent;
    if (needsPresent && !input.observedNpcIds.includes(needsPresent)) {
      const who = world.npcs.find(n => n.id === needsPresent);
      throw new InvestigationError(`请等${who?.role ?? ""}${who?.name ?? "相关居民"}回来，再请对方一起核对。`);
    }
    // A clue found before the weather turned stays in the notebook; only an unfound one is blocked.
    const weather = target.weather ?? pack.evidence.find(e => `${pack.ids.clue}-${String(e.n).padStart(2, "0")}` === target.evidenceId)?.weather;
    const blocked = session.discoveredEvidenceIds.includes(target.evidenceId) ? null : evidenceWeatherBlock(weather, casePackDay(pack), world, RIVERBEND_PLAY_DAYS);
    if (blocked) throw new InvestigationError(blocked);
    session.discoveredEvidenceIds = [...new Set([...session.discoveredEvidenceIds, target.evidenceId])];
  } else if (command.kind === "case-question" || command.kind === "case-challenge") {
    const characterId = command.characterId;
    if (!input.observedNpcIds.includes(characterId) || !input.ref.script.statements[characterId]) throw new InvestigationError("这位居民现在不在你面前。请按上次目击去寻找，或稍后再来。");
    const evidenceId = command.kind === "case-challenge" ? command.evidenceId : undefined;
    if (evidenceId && !session.discoveredEvidenceIds.includes(evidenceId)) throw new InvestigationError("只能出示已经亲自找到并记入手记的物证。", 400);
    if (evidenceId && !session.interrogationLog.some(l => l.characterId === characterId && !l.evidenceId)) throw new InvestigationError("先听这位居民讲完，再拿物证核对他的说法。");
    const hit = detectContradictionHit(c.testimonies, characterId, evidenceId);
    const revision = evidenceId ? input.ref.script.revisions[characterId]?.[evidenceId] : undefined;
    const current = c.testimonies.find(t => t.characterId === characterId)?.currentStatement || input.ref.script.statements[characterId];
    const question = evidenceId ? `请用「${c.deductionCase.evidence.find(e => e.id === evidenceId)!.title}」核对刚才的说法。` : "请说说今天早晨你亲自知道的事。";
    const answer = evidenceId ? hit.hit && revision ? revision : "这份物证不能直接改正我刚才说的那件事。你可以把两者记下来，再核对时间、地点和亲眼见到的人。" : current;
    const entry = makeRuleBoundInterrogation(world, input.events.filter(e => c.sourceEventIds.includes(e.id)), c.deductionCase, session.id, characterId, question, session.discoveredEvidenceIds, evidenceId, answer);
    if (evidenceId) entry.challenge = { hit: hit.hit && !!revision, characterId, evidenceId, exposedContradictions: hit.hit && revision ? [evidenceId] : [], guidance: answer };
    session.interrogationLog = [...session.interrogationLog.filter(l => l.id !== entry.id), entry];
    if (hit.hit && revision) {
      const updated = updateTestimonyWithContradiction(c.testimonies, characterId, evidenceId);
      nextCase = { ...c, testimonies: updated.testimonies.map(t => t.characterId === characterId ? { ...t, currentStatement: revision } : t) };
    }
  } else if (command.kind === "case-submit") {
    if (!isPlayerTheoryInput(command.theory) || !command.theory.proof || !c.deductionCase.characters.some(p => p.id === command.theory.culpritId && p.isSuspect !== false)) throw new InvestigationError("请选择调查对象，并分别勾选支撑动机和手法的物证。", 400);
    if (command.theory.evidenceIds.some(id => !session.discoveredEvidenceIds.includes(id))) throw new InvestigationError("结论只能引用手记里已经取得的物证。", 400);
    const judgement = submitWorldTheory(c.deductionCase, command.theory, session.discoveredEvidenceIds);
    // The general legacy judge checks evidence coverage; this authored route
    // additionally requires hearing and challenging every required witness.
    const certificate = certifyPlayableCase(c, input.events.filter(e => c.sourceEventIds.includes(e.id)));
    const heardAndChallenged = certificate.requiredWitnessIds.every(id => session.interrogationLog.some(l => l.characterId === id && !l.evidenceId) && session.interrogationLog.some(l => l.characterId === id && l.challenge?.hit));
    session.submittedTheory = structuredClone(command.theory);
    session.judgement = { ...judgement, accepted: judgement.accepted && heardAndChallenged && certificate.routeCertified };
  } else throw new InvestigationError("未识别的调查动作。", 400);
  session.updatedAt = now;
  if (nextCase !== c) repo.saveCase(nextCase);
  repo.saveSession(session);
  return { world, ref: input.ref, closed, events: [] as WorldEvent[] };
}
