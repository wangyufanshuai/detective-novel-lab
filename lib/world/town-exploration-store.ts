import crypto from "node:crypto";
import { enableTownResidentLife, prepareResidentLifeDecisions, queueResidentLifeDecision, setResidentLifePlannerMode } from "@/packages/engine/src/town/resident-life";
import { reserveResidentLifeModelAttempt, type ResidentLifeContext } from "@/packages/engine/src/town/resident-cognition";
import { chooseResidentLife } from "./resident-life-provider";
import { observedTownPassages, rememberTownPassages, type TownObservedMotion } from "@/packages/engine/src/town/observed-passages";
import { getDb, worldRepository } from "./repository";
import { withPrivateWorldAccess } from "./private-world-access";
import { createRiverbendWorld, RIVERBEND_VISITABLE_SCENES, RIVERBEND_WORLD_REVISION } from "@/packages/engine/src/riverbend-world";
import { advancePersistentTownTick, type PersistentTownRuntime } from "@/packages/engine/src/persistent-town";
import { enableTownResidentWork, prepareResidentWorkDecision, queueResidentWorkDecision, reserveResidentWorkModelAttempt, RESIDENT_WORK_JOBS, type ResidentWorkChoice, type ResidentWorkContext } from "@/packages/engine/src/town/resident-work";
import { chooseResidentWork, residentDecisionProviderFromEnv, type ResidentDecisionProvider } from "./resident-decision-provider";
import { executeTownArrival, observeTownResidents, startTownExploration, townExplorationPlayerView, validateTownExplorationBinding, type TownExplorationBinding, type TownExplorationState } from "@/packages/engine/src/town-exploration";
import type { WorldState } from "@/packages/engine/src/world-types";
import type { TownPlayCommand, TownPlayResult, TownPlayView } from "@/lib/town-play-contract";
import { executeTownInvestigation, projectTownInvestigation, InvestigationError, type TownInvestigation } from "./riverbend-investigation";
import { CLASSIC_LIVING_ACTORS, CLASSIC_LIVING_ASSET_SHA256, CLASSIC_LIVING_PLACES, CLASSIC_LIVING_REVISION } from "@/lib/classic-living-contract";

export class TownPlayError extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); this.name = "TownPlayError"; }
}
export type TownPlayCredentials = { id: string; secret: string };
export type TownPlayProfile = "riverbend" | "classic-living";
type Session = { state: TownExplorationState; binding: TownExplorationBinding; visitedSceneIds: string[]; investigation?: TownInvestigation; createdAt: string; updatedAt: string };
type Row = { id: string; world_id: string; owner_hash: string; data: string };
type RuntimeWorld = WorldState & { persistentRuntime: PersistentTownRuntime };
type Owned = { db: ReturnType<typeof getDb>; row: Row; session: Session; world: RuntimeWorld; map: NonNullable<PersistentTownRuntime["mapPacks"]>[number] };
type WorkBatch = {
  fingerprint: string; reserved_revision: number; status: "running" | "completed" | "abandoned";
  expires_at: number; contexts_json: string;
};
type WorkBatchContext = { context: ResidentWorkContext | ResidentLifeContext; budgetReserved: boolean };
const initialized = new WeakSet<ReturnType<typeof getDb>>();
const digest = (secret: string) => crypto.createHash("sha256").update(secret).digest("hex");

function database() {
  const db = getDb();
  if (!initialized.has(db)) {
    db.exec(`
      create table if not exists town_exploration_sessions (
        id text primary key, world_id text not null unique, owner_hash text not null,
        data text not null, updated_at text not null
      );
      create table if not exists town_exploration_receipts (
        session_id text not null, action_id text not null, fingerprint text not null,
        response_json text not null, created_at text not null,
        primary key(session_id, action_id)
      );
      create table if not exists town_resident_work_batches (
        session_id text not null, action_id text not null, world_id text not null,
        fingerprint text not null, reserved_revision integer not null,
        status text not null, expires_at integer not null, contexts_json text not null,
        primary key(session_id, action_id)
      );
    `);
    initialized.add(db);
  }
  return db;
}

function withOwned<T>(credentials: TownPlayCredentials, action: (owned: Owned) => T): T {
  const db = database();
  const row = db.prepare("select id, world_id, owner_hash, data from town_exploration_sessions where id = ?").get(credentials.id) as Row | undefined;
  const presented = digest(credentials.secret);
  if (!row || !/^[a-f0-9]{64}$/.test(row.owner_hash) || !crypto.timingSafeEqual(Buffer.from(row.owner_hash, "hex"), Buffer.from(presented, "hex"))) throw new TownPlayError("SESSION_FORBIDDEN", "这份河湾手记属于另一个浏览器。", 401);
  return withPrivateWorldAccess(row.world_id, () => {
    const session = JSON.parse(row.data) as Session;
    const world = worldRepository.getWorld(row.world_id) as RuntimeWorld | null;
    if (!world?.persistentRuntime || session.state.sessionId !== row.id || session.state.worldId !== row.world_id) throw new TownPlayError("WORLD_UNAVAILABLE", "手记对应的小镇暂时无法恢复。", 409);
    if (![RIVERBEND_WORLD_REVISION, CLASSIC_LIVING_REVISION].includes(session.binding.revision) || (session.binding.revision === CLASSIC_LIVING_REVISION && session.binding.assetSha256 !== CLASSIC_LIVING_ASSET_SHA256)) throw new TownPlayError("BINDING_CHANGED", "这份手记需要与当前小镇版本核对，旧记录已保留。", 409);
    const map = world.persistentRuntime.mapPacks?.find(map => map.manifest.id === session.binding.mapId);
    if (!map) throw new TownPlayError("MAP_UNAVAILABLE", "手记对应的街区地图暂时无法恢复。", 409);
    validateTownExplorationBinding(world, map, session.binding);
    return action({ db, row, session, world, map });
  });
}

function project(world: RuntimeWorld, session: Session): TownPlayView {
  const publicWorld = townExplorationPlayerView(world, session.binding, session.state, world.persistentRuntime);
  const life=world.persistentRuntime.residentLife;
  return { ...publicWorld, assetSha256: session.binding.assetSha256, visitedSceneIds: [...session.visitedSceneIds], lastArrival: session.state.lastArrival ? { ...session.state.lastArrival } : undefined, investigation: projectTownInvestigation(world.id, publicWorld.sceneId, session.investigation), ...(world.persistentRuntime.residentWork ? { residentWorkEnabled: true } : {}),
    ...(life?{residentLife:{schema:life.schema,elapsedMinutes:(world.persistentRuntime.tick-life.startedAtTick)*world.persistentRuntime.tickIntervalMinutes,remainingMinutes:Math.max(0,(life.endTick-world.persistentRuntime.tick)*world.persistentRuntime.tickIntervalMinutes),plannerMode:life.planner.mode,proposalCount:life.planner.proposals.length,modelCalls:life.planner.providerBudget.used?null:0 as const,modelAttemptsReserved:life.planner.providerBudget.used}}:{}), };
}

export function readTownPlay(credentials: TownPlayCredentials, profile?: TownPlayProfile): TownPlayView {
  return withOwned(credentials, ({ world, session }) => {
    if (profile && session.binding.revision !== (profile === "classic-living" ? CLASSIC_LIVING_REVISION : RIVERBEND_WORLD_REVISION)) throw new TownPlayError("BINDING_CHANGED", "这份手记属于另一段小镇日程。", 409);
    return project(world, session);
  });
}

export function startTownPlay(existing?: TownPlayCredentials, profile: TownPlayProfile = "riverbend") {
  if (existing) return { credentials: existing, result: { view: readTownPlay(existing, profile), replayed: true } satisfies TownPlayResult };
  const db = database();
  return db.transaction(() => {
    const credentials = { id: crypto.randomUUID(), secret: crypto.randomBytes(32).toString("hex") };
    const now = new Date().toISOString();
    const { world, map, binding } = createRiverbendWorld({ worldId: `riverbend-${crypto.randomUUID()}`, now });
    if (profile === "classic-living") {
      binding.revision = CLASSIC_LIVING_REVISION;
      binding.assetSha256 = CLASSIC_LIVING_ASSET_SHA256;
      binding.residents = CLASSIC_LIVING_ACTORS.map(({ actorId, npcId }) => ({ actorId, npcId }));
      enableTownResidentWork(world, world.persistentRuntime);
    }
    const initial = startTownExploration(world, map, binding, credentials.id);
    const session: Session = { state: observeTownResidents(world, binding, initial, world.persistentRuntime), binding, visitedSceneIds: [], createdAt: now, updatedAt: now };
    worldRepository.saveWorld(world);
    db.prepare("insert into town_exploration_sessions (id, world_id, owner_hash, data, updated_at) values (?, ?, ?, ?, ?)").run(credentials.id, world.id, digest(credentials.secret), JSON.stringify(session), now);
    return { credentials, result: { view: project(world, session), replayed: false } satisfies TownPlayResult };
  }).immediate();
}

/** Every state change and durable retry receipt shares one SQLite transaction.
 * No network/model await belongs inside this synchronous command boundary. */
export function commandTownPlay(credentials: TownPlayCredentials, command: TownPlayCommand, modelBatch?: { choices: ResidentWorkChoice[] }): TownPlayResult {
  const db = database();
  return db.transaction(() => withOwned(credentials, ({ session, world, map }) => {
    if (typeof command.actionId !== "string" || !/^[a-zA-Z0-9_-]{1,120}$/.test(command.actionId) || !Number.isSafeInteger(command.expectedSessionRevision) || !Number.isSafeInteger(command.expectedWorldRevision)) throw new TownPlayError("BAD_COMMAND", "请重新载入手记后再试。", 400);
    if (!["arrive", "wait", "work-enable", "life-enable", "life-mode", "work-step", "work-interrupt", "case-open", "case-search", "case-question", "case-challenge", "case-submit"].includes(command.kind)) throw new TownPlayError("BAD_COMMAND", "未知的小镇动作。", 400);
    if (session.binding.revision === CLASSIC_LIVING_REVISION && (command.kind.startsWith("case-") || (command.kind === "arrive" && !(CLASSIC_LIVING_PLACES as readonly string[]).includes(command.sceneId)))) throw new TownPlayError("PLACE_CLOSED", "这段日常目前开放车站、旧书店与旅馆。", 400);
    // Preserve the v1 arrival/wait fingerprint so pre-case durable retries work.
    const fingerprint = command.kind === "arrive" || command.kind === "wait" ? JSON.stringify({ kind: command.kind, target: command.kind === "arrive" ? command.sceneId : command.minutes, sessionRevision: command.expectedSessionRevision, worldRevision: command.expectedWorldRevision }) : JSON.stringify(command);
    const receipt = db.prepare("select fingerprint, response_json from town_exploration_receipts where session_id = ? and action_id = ?").get(credentials.id, command.actionId) as { fingerprint: string; response_json: string } | undefined;
    if (receipt) {
      if (receipt.fingerprint !== fingerprint) throw new TownPlayError("ACTION_REUSED", "同一个动作记录不能用于另一件事。", 409);
      return { ...(JSON.parse(receipt.response_json) as TownPlayResult), replayed: true };
    }
    const revision = world.persistentRuntime.commandRevision ?? 0;
    const beforeTick = world.persistentRuntime.tick;
    const events = worldRepository.getEvents(world.id);
    const lifeSourceEvents=events.filter(event=>!event.tags.includes("riverbend-authored-history"));
    const batch = modelBatch ? db.prepare("select * from town_resident_work_batches where session_id = ? and action_id = ?").get(credentials.id, command.actionId) as WorkBatch | undefined : undefined;
    if (modelBatch && (!batch || batch.fingerprint !== fingerprint || command.kind !== "work-step" || batch.status !== "running")) throw new TownPlayError("STATE_CHANGED", "这次居民决定已失效，请刷新后继续。", 409);
    const competing = db.prepare("select action_id from town_resident_work_batches where world_id = ? and status = 'running' and expires_at > ?").all(world.id, Date.now()) as { action_id: string }[];
    if (competing.some(item => !modelBatch || item.action_id !== command.actionId)) throw new TownPlayError("WORK_BUSY", "居民正在决定下一步，请稍后重试。", 503);
    if (session.state.revision !== command.expectedSessionRevision || revision !== (batch?.reserved_revision ?? command.expectedWorldRevision)) throw new TownPlayError("STATE_CHANGED", "小镇已发生变化，已保留你的手记；请刷新后继续。", 409);
    if (batch && modelBatch) {
      const entries = JSON.parse(batch.contexts_json) as WorkBatchContext[];
      if (modelBatch.choices.length !== entries.length) throw new TownPlayError("BAD_COMMAND", "居民决定未能完整读取。", 400);
      entries.forEach((entry, index) => entry.context.schema === "resident-life-context.v1"
        ? queueResidentLifeDecision(world, world.persistentRuntime, entry.context, modelBatch.choices[index],lifeSourceEvents)
        : queueResidentWorkDecision(world, world.persistentRuntime, entry.context, modelBatch.choices[index]));
    }
    // Existing riverbend.v1 saves retain their old records. Only new events
    // adopt the world namespace; reading or restoring does not rewrite history.
    world.persistentRuntime.eventIdentityPolicy = "world-scoped";
    // Authored opening history is immutable case evidence, not a new live
    // incident for the autonomous candidate extractor to consume again.
    const liveEvents = events.filter(e => !e.tags.includes("riverbend-authored-history"));
    let nextWorld: RuntimeWorld;
    let nextState: TownExplorationState;
    let addedEvents: typeof events;
    if (command.kind === "life-enable") {
      if(session.binding.revision!==RIVERBEND_WORLD_REVISION)throw new TownPlayError("BINDING_CHANGED","三日生活目前只开放河湾街区。",409);
      enableTownResidentLife(world,world.persistentRuntime);
      nextWorld=world;nextState={...session.state,revision:session.state.revision+1};addedEvents=[];
    } else if (command.kind === "life-mode") {
      if(!world.persistentRuntime.residentLife)throw new TownPlayError("LIFE_DISABLED","请先启用三日生活。",409);
      if(!["rules","offline-agent"].includes(command.mode))throw new TownPlayError("BAD_COMMAND","请选择日程或目标安排。",400);
      setResidentLifePlannerMode(world.persistentRuntime,command.mode);
      nextWorld=world;nextState={...session.state,revision:session.state.revision+1};addedEvents=[];
    } else if (command.kind === "work-enable") {
      enableTownResidentWork(world, world.persistentRuntime);
      nextWorld = world;
      nextState = { ...session.state, revision: session.state.revision + 1 };
      addedEvents = [];
    } else if (command.kind === "arrive") {
      if (!(RIVERBEND_VISITABLE_SCENES as readonly string[]).includes(command.sceneId) && command.sceneId !== "town-square") throw new TownPlayError("PLACE_CLOSED", "这处地点暂未开放到访。", 400);
      const result = executeTownArrival(world, liveEvents, map, session.binding, session.state, { actionId: command.actionId, sceneId: command.sceneId, expectedSessionRevision: command.expectedSessionRevision });
      nextWorld = result.world;
      nextState = result.state;
      addedEvents = result.events;
    } else if (command.kind === "wait" || command.kind === "work-step" || command.kind === "work-interrupt") {
      if (command.kind === "wait" && ![15, 30, 60].includes(command.minutes)) throw new TownPlayError("BAD_WAIT", "请选择手记中提供的等待时长。", 400);
      if (command.kind === "work-step" && !world.persistentRuntime.residentWork) throw new TownPlayError("WORK_DISABLED", "请先启用居民工作试验。", 409);
      if (command.kind === "work-interrupt") {
        const person = townExplorationPlayerView(world, session.binding, session.state, world.persistentRuntime).residents.find(person => person.npcId === command.npcId && person.visibility === "observed");
        if (!person?.work || person.work.status !== "working" || !world.persistentRuntime.dailyRoutine) throw new TownPlayError("NOT_WORKING_HERE", "请走到正在工作的居民身边。", 409);
        world.persistentRuntime.dailyRoutine.holds[command.npcId] = { untilTick: world.persistentRuntime.tick + 1, reason: "访客请居民暂时停下工作" };
      }
      const steps = command.kind === "wait" ? command.minutes / world.persistentRuntime.tickIntervalMinutes : 1;
      if (!Number.isSafeInteger(steps) || steps < 1 || steps > 60 || world.persistentRuntime.tick + steps > world.persistentRuntime.maxTicks) throw new TownPlayError("DAY_COMPLETE", "这段小镇日程已经结束，手记已保存。", 409);
      const result = advancePersistentTownTick(world, liveEvents, { steps, status: "paused" });
      nextWorld = { ...result.world, persistentRuntime: result.runtime };
      nextState = observeTownResidents(nextWorld, session.binding, { ...session.state, revision: session.state.revision + 1 }, result.runtime);
      addedEvents = result.events;
    } else {
      if (world.persistentRuntime.tick + 1 > world.persistentRuntime.maxTicks) throw new TownPlayError("DAY_COMPLETE", "这段小镇日程已经结束，手记已保存。", 409);
      const visible = townExplorationPlayerView(world, session.binding, session.state, world.persistentRuntime).residents.filter(p => p.visibility === "observed").map(p => p.npcId);
      try {
        const sceneId = session.binding.places.find(p => p.locationId === session.state.locationId)!.sceneId;
        const action = executeTownInvestigation({ world, sceneId, observedNpcIds: visible, ownerId: credentials.id, ref: session.investigation, command, events });
        const actingWorld = action.world as RuntimeWorld;
        if ((command.kind === "case-question" || command.kind === "case-challenge") && actingWorld.persistentRuntime.dailyRoutine) actingWorld.persistentRuntime.dailyRoutine.holds[command.characterId] = { untilTick: actingWorld.persistentRuntime.tick + 1, reason: "访客正在当面核对案情" };
        const result = advancePersistentTownTick(actingWorld, liveEvents, { steps: 1, status: "paused" });
        nextWorld = { ...result.world, persistentRuntime: result.runtime };
        nextState = observeTownResidents(nextWorld, session.binding, { ...session.state, revision: session.state.revision + 1 }, result.runtime);
        session.investigation = action.ref;
        addedEvents = [...action.events, ...result.events];
      } catch (error) {
        if (error instanceof InvestigationError) throw new TownPlayError("INVESTIGATION_ACTION", error.message, error.status);
        throw error;
      }
    }
    const now = new Date().toISOString();
    nextWorld.persistentRuntime.commandRevision = revision + 1;
    nextWorld.updatedAt = now;
    let motion: TownObservedMotion | undefined;
    if (session.binding.revision === CLASSIC_LIVING_REVISION && command.kind !== "arrive" && session.state.locationId === nextState.locationId) {
      const passages = observedTownPassages(session.binding, session.state, beforeTick, nextWorld.persistentRuntime.tick,
        nextWorld.persistentRuntime.dailyRoutine?.passages ?? [], "town-square", ["books", "station", "inn"]);
      if (passages.length) {
        nextState = rememberTownPassages(nextState, passages, nextWorld.persistentRuntime.tick);
        motion = { id: command.actionId, sessionId: nextState.sessionId,
          sceneId: passages[0].sceneId, fromWorldRevision: revision, toWorldRevision: revision + 1, passages };
      }
    }
    const next: Session = { ...session, state: nextState, updatedAt: now, visitedSceneIds: command.kind === "arrive" && command.sceneId !== "town-square" ? [...new Set([...session.visitedSceneIds, command.sceneId])] : [...session.visitedSceneIds] };
    if (!worldRepository.saveWorldBundleIfRuntimeRevision({ world: nextWorld, events: addedEvents, expectedRevision: revision })) throw new TownPlayError("STATE_CHANGED", "世界已更新，请刷新手记后继续。", 409);
    const saved = db.prepare("update town_exploration_sessions set data = ?, updated_at = ? where id = ? and world_id = ? and json_extract(data, '$.state.revision') = ?").run(JSON.stringify(next), now, credentials.id, world.id, session.state.revision);
    if (saved.changes !== 1) throw new TownPlayError("STATE_CHANGED", "手记已更新，请刷新后继续。", 409);
    const result: TownPlayResult = { view: project(nextWorld, next), replayed: false, ...(motion ? { motion } : {}) };
    db.prepare("insert into town_exploration_receipts (session_id, action_id, fingerprint, response_json, created_at) values (?, ?, ?, ?, ?)").run(credentials.id, command.actionId, fingerprint, JSON.stringify(result), now);
    if (batch) db.prepare("update town_resident_work_batches set status = 'completed' where session_id = ? and action_id = ?").run(credentials.id, command.actionId);
    return result;
  })).immediate();
}

/** Reserve budget in SQLite, release the transaction, call providers, then
 * commit choices + one tick + retry receipt atomically. No model re-call on a
 * completed retry or a recovered expired batch. The lease is per owned world. */
type ProviderTesting = { provider: ResidentDecisionProvider | null; fetcher?: typeof fetch; timeoutMs?: number };
export function commandTownWorkStep(credentials: TownPlayCredentials, command: TownPlayCommand, testing?: ProviderTesting): Promise<TownPlayResult> {
  return commandTownResidentStep(credentials, command, "work", testing);
}
/** Server-only experimental entry point. No visitor route enables life model
 * calls. Explicit server opt-in AND a configured provider are both required. */
export function commandTownLifeStep(credentials: TownPlayCredentials, command: TownPlayCommand, testing?: ProviderTesting): Promise<TownPlayResult> {
  return commandTownResidentStep(credentials, command, "life", testing);
}
async function commandTownResidentStep(credentials: TownPlayCredentials, command: TownPlayCommand, mode: "work" | "life", testing?: ProviderTesting): Promise<TownPlayResult> {
  if (command.kind !== "work-step") throw new TownPlayError("BAD_COMMAND", "这不是居民工作动作。", 400);
  const provider = testing ? testing.provider : mode === "life" && process.env.RESIDENT_LIFE_AI_ENABLED !== "1" ? null : residentDecisionProviderFromEnv();
  const db = database();
  const prepared = db.transaction(() => withOwned(credentials, ({ world, session }) => {
    if (typeof command.actionId !== "string" || !/^[a-zA-Z0-9_-]{1,120}$/.test(command.actionId) || !Number.isSafeInteger(command.expectedSessionRevision) || !Number.isSafeInteger(command.expectedWorldRevision)) throw new TownPlayError("BAD_COMMAND", "请重新载入手记后再试。", 400);
    const fingerprint = JSON.stringify(command);
    const receipt = db.prepare("select fingerprint, response_json from town_exploration_receipts where session_id = ? and action_id = ?").get(credentials.id, command.actionId) as { fingerprint: string; response_json: string } | undefined;
    if (receipt) {
      if (receipt.fingerprint !== fingerprint) throw new TownPlayError("ACTION_REUSED", "同一个动作记录不能用于另一件事。", 409);
      return { result: { ...JSON.parse(receipt.response_json), replayed: true } as TownPlayResult };
    }
    const old = db.prepare("select * from town_resident_work_batches where session_id = ? and action_id = ?").get(credentials.id, command.actionId) as WorkBatch | undefined;
    const revision = world.persistentRuntime.commandRevision ?? 0;
    if (old) {
      if (old.fingerprint !== fingerprint) throw new TownPlayError("ACTION_REUSED", "同一个动作记录不能用于另一件事。", 409);
      if (old.status !== "running" || old.reserved_revision !== revision || session.state.revision !== command.expectedSessionRevision) throw new TownPlayError("STATE_CHANGED", "小镇已发生变化，请刷新后继续。", 409);
      if (old.expires_at > Date.now()) throw new TownPlayError("WORK_BUSY", "居民正在决定下一步，请稍后重试。", 503);
      return { entries: JSON.parse(old.contexts_json) as WorkBatchContext[], recovered: true };
    }
    if (session.state.revision !== command.expectedSessionRevision || revision !== command.expectedWorldRevision) throw new TownPlayError("STATE_CHANGED", "小镇已发生变化，请刷新后继续。", 409);
    if (!world.persistentRuntime.residentWork) throw new TownPlayError("WORK_DISABLED", "请先启用居民工作试验。", 409);
    if (mode === "life" && !world.persistentRuntime.residentLife) throw new TownPlayError("LIFE_DISABLED", "请先启用三日居民生活。", 409);
    if (world.persistentRuntime.tick >= world.persistentRuntime.maxTicks) throw new TownPlayError("DAY_COMPLETE", "这段小镇日程已经结束，手记已保存。", 409);
    if (db.prepare("select 1 from town_resident_work_batches where world_id = ? and status = 'running' and expires_at > ?").get(world.id, Date.now())) throw new TownPlayError("WORK_BUSY", "居民正在决定下一步，请稍后重试。", 503);
    const lifeSourceEvents=mode==="life"?worldRepository.getEvents(world.id).filter(event=>!event.tags.includes("riverbend-authored-history")):[];
    const contexts = mode === "life" ? prepareResidentLifeDecisions(world, world.persistentRuntime,lifeSourceEvents) : RESIDENT_WORK_JOBS.flatMap(job => { const context = prepareResidentWorkDecision(world, world.persistentRuntime, job.npcId); return context ? [context] : []; });
    if (!provider || !contexts.length) return { offline: true };
    let entries: WorkBatchContext[] = contexts.map(context => ({ context, budgetReserved: context.schema === "resident-life-context.v1"
      ? reserveResidentLifeModelAttempt(world.persistentRuntime, context) : reserveResidentWorkModelAttempt(world.persistentRuntime, context) }));
    world.persistentRuntime.commandRevision = revision + 1;
    if (mode === "life") {
      // Source references include the reserved revision. Rebuild the entire
      // observation, rather than patching one field of a stale context.
      const refreshed = prepareResidentLifeDecisions(world, world.persistentRuntime,lifeSourceEvents);
      entries = entries.map(entry => ({ ...entry, context: refreshed.find(context => context.npcId === entry.context.npcId)! }));
    } else entries.forEach(entry => { entry.context.worldRevision = revision + 1; });
    if (!worldRepository.saveWorldBundleIfRuntimeRevision({ world, events: [], expectedRevision: revision })) throw new TownPlayError("STATE_CHANGED", "世界已更新，请刷新后继续。", 409);
    db.prepare("update town_resident_work_batches set status = 'abandoned' where world_id = ? and status = 'running'").run(world.id);
    db.prepare("insert into town_resident_work_batches (session_id, action_id, world_id, fingerprint, reserved_revision, status, expires_at, contexts_json) values (?, ?, ?, ?, ?, 'running', ?, ?)").run(credentials.id, command.actionId, world.id, fingerprint, revision + 1, Date.now() + 25000, JSON.stringify(entries));
    return { entries, recovered: false };
  })).immediate();
  if (prepared.result) return prepared.result;
  if (prepared.offline) return commandTownPlay(credentials, command);
  const entries = prepared.entries!;
  const choices = prepared.recovered
    ? entries.map(entry => ({ candidateId: entry.context.schema === "resident-life-context.v1" ? entry.context.preferredId : entry.context.candidates[0].id, source: "error" as const }))
    : await Promise.all(entries.map(async entry => (await (entry.context.schema === "resident-life-context.v1"
      ? chooseResidentLife({ ...entry, context: entry.context, provider, fetcher: testing?.fetcher, timeoutMs: testing?.timeoutMs })
      : chooseResidentWork({ ...entry, context: entry.context, provider, fetcher: testing?.fetcher, timeoutMs: testing?.timeoutMs }))).choice));
  return commandTownPlay(credentials, command, { choices });
}
