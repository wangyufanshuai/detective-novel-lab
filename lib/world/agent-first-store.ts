import { getDb } from "./repository";
import { readTownPlay, startTownPlay, commandTownPlay, TownPlayError, type TownPlayCredentials } from "./town-exploration-store";
import { projectExplorationObservation } from "@/packages/engine/src/town/agent-observation";
import { parseExplorationIntent, admitExplorationIntent, RefereeRejection } from "@/packages/engine/src/town/agent-intent";

const project = (credentials: TownPlayCredentials) => projectExplorationObservation(readTownPlay(credentials, "riverbend"));
export const readAgentFirst = project;
function database() {
  const db = getDb();
  db.exec(`create table if not exists agent_first_receipts (
    session_id text not null, action_id text not null, intent_json text not null,
    response_json text not null, primary key(session_id, action_id))`);
  return db;
}
export function startAgentFirst(existing?: TownPlayCredentials) {
  const db = database();
  return db.transaction(() => {
    const started = startTownPlay(existing, "riverbend");
    // New, isolated visitor saves opt into the EXISTING ordinary-work engine.
    // Reads of previous saves never silently install a policy; no model is called.
    if (!existing) {
      const view = started.result.view;
      commandTownPlay(started.credentials, { kind: "work-enable", actionId: "agent-first-work-opt-in",
        expectedSessionRevision: view.revision, expectedWorldRevision: view.worldRevision });
    }
    return { credentials: started.credentials, observation: project(started.credentials) };
  }).immediate();
}
/** The public visitor can submit travel/wait intents, never resident cognition
 * or administrator interventions. The nested legacy transaction is a savepoint:
 * engine writes, observation and v12 provenance receipt all commit atomically. */
export function actAgentFirst(credentials: TownPlayCredentials, raw: unknown, phase: "propose" | "commit") {
  const intent = parseExplorationIntent(raw);
  // Authenticate BEFORE looking up durable receipts (including old retries).
  const observation = project(credentials);
  const inspect = () => {
    const db = getDb();
    const key = JSON.stringify(intent);
    const old = db.prepare("select intent_json, response_json from agent_first_receipts where session_id = ? and action_id = ?")
      .get(credentials.id, intent.actionId) as { intent_json: string; response_json: string } | undefined;
    if (old) {
      if (old.intent_json !== key) throw new RefereeRejection("ACTION_REUSED", "这个动作编号已经用于另一件事。", 409);
      return { ...JSON.parse(old.response_json), replayed: true };
    }
    const command = admitExplorationIntent(intent, observation);
    if (phase === "propose") return { observation, replayed: false, proposal: { schema: "agent-first-proposal.v1", actionId: intent.actionId, accepted: true, mutates: false } };
    const applied = commandTownPlay(credentials, command);
    const result = { observation: projectExplorationObservation(applied.view), replayed: applied.replayed,
      receipt: { schema: "agent-first-receipt.v1", actionId: intent.actionId, sourceRefs: intent.sourceRefs,
        fromWorldRevision: observation.worldRevision, toWorldRevision: applied.view.worldRevision } };
    db.prepare("insert into agent_first_receipts values (?, ?, ?, ?)").run(credentials.id, intent.actionId, key, JSON.stringify(result));
    return result;
  };
  if (phase === "propose") {
    // Proposals may read an existing ledger, but must not install or write one.
    const exists = getDb().prepare("select 1 from sqlite_master where type = 'table' and name = 'agent_first_receipts'").get();
    if (!exists) throw new TownPlayError("SESSION_REQUIRED", "请先开始手记。", 401);
    return inspect();
  }
  return database().transaction(inspect).immediate();
}
