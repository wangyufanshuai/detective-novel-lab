"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ExplorationObservation } from "@/packages/engine/src/town/agent-observation";
import type { ExplorationAction, ExplorationIntent } from "@/packages/engine/src/town/agent-intent";

const endpoint = "/api/v1/town-play/agent-first", pendingKey = "agent-first-pending.v1";
type Result = { observation: ExplorationObservation | null; replayed: boolean };
class Failure extends Error { constructor(message: string, public status: number) { super(message); } }
async function request(body?: unknown): Promise<Result> {
  const response = await fetch(endpoint, { method: body ? "POST" : "GET", credentials: "same-origin", cache: "no-store",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Failure(result.error?.message || "手记未能载入。", response.status);
  return result.data;
}
export function useAgentFirst() {
  const [view, setView] = useState<ExplorationObservation | null>(null);
  const ref = useRef(view), lock = useRef(false);
  const [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false), [error, setError] = useState("");
  const [pending, setPending] = useState<ExplorationIntent | null>(null);
  const [restore, setRestore] = useState(0);
  const accept = useCallback((next: ExplorationObservation | null) => {
    if (next && ref.current?.sessionId === next.sessionId && ref.current.worldRevision > next.worldRevision) return;
    ref.current = next; setView(next);
  }, []);
  const remember = (intent: ExplorationIntent | null) => {
    setPending(intent);
    try { if (intent) localStorage.setItem(pendingKey, JSON.stringify({ sessionId: ref.current?.sessionId, intent })); else localStorage.removeItem(pendingKey); } catch { /* In-memory retry available */ }
  };
  const load = useCallback(async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      let result = await request(); accept(result.observation);
      let saved: string | null = null;
      try { saved = localStorage.getItem(pendingKey); } catch { /* Storage is optional */ }
      if (saved && result.observation) {
        let draft: ExplorationIntent | null = null;
        try { const parsed = JSON.parse(saved); if (parsed.sessionId === result.observation.sessionId) draft = parsed.intent; else remember(null); } catch { remember(null); }
        // The HTTP-only cookie, not draft metadata, selects the authoritative save.
        if (draft) { remember(draft); await request({ kind: "commit", intent: draft }); remember(null); result = await request(); accept(result.observation); }
      }
      setRestore(value => value + 1);
    } catch (err) {
      if (err instanceof Failure && err.status < 500) remember(null);
      setError(err instanceof Failure ? err.message : "暂时连不上小镇。请重连；原手记仍在。");
    } finally { lock.current = false; setBusy(false); setLoaded(true); }
  }, [accept]);
  useEffect(() => { void load(); }, [load]);
  const start = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { const result = await request({ kind: "start" }); accept(result.observation); setRestore(value => value + 1); }
    catch (err) { setError(err instanceof Failure ? err.message : "暂时无法开始，请重试。"); }
    finally { lock.current = false; setBusy(false); }
  };
  const commit = async (action: ExplorationAction) => {
    const current = ref.current;
    if (!current || lock.current || pending || error) return false;
    const intent: ExplorationIntent = { schema: "agent-first-intent.v1", actionId: crypto.randomUUID(),
      expectedSessionRevision: current.revision, expectedWorldRevision: current.worldRevision,
      reason: action.kind === "arrive" ? "访客亲自到达地点" : action.kind==="life-enable"?"访客启用三日居民生活":action.kind==="life-mode"?"访客选择居民生活安排方式":"访客停留观察一刻钟", sourceRefs: [current.sourceRef], action };
    lock.current = true; setBusy(true); setError(""); remember(intent);
    try { const result = await request({ kind: "commit", intent }); accept(result.observation); remember(null); return true; }
    catch (err) {
      if (err instanceof Failure && err.status < 500) remember(null);
      setError(err instanceof Failure ? err.message : "行动尚未确认保存。请重连；相同动作不会重复计时。"); return false;
    } finally { lock.current = false; setBusy(false); }
  };
  return { view, busy, loaded, error, pending: !!pending, restore, start, commit, reload: load };
}
