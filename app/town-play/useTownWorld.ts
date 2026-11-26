"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TownPlayAction, TownPlayCommand, TownPlayResult, TownPlayView } from "@/lib/town-play-contract";

const ENDPOINT = "/api/v1/town-play";
const PENDING_KEY = "detective-town:riverbend-pending:v1";
type Pending = { sessionId: string; command: TownPlayCommand };
class RequestFailure extends Error {
  constructor(message: string, public status: number) { super(message); }
}
const failureMessage = (error: unknown, fallback: string) => error instanceof RequestFailure ? error.message : fallback;
async function request(endpoint: string, body?: unknown): Promise<TownPlayResult | { view: null; replayed: false }> {
  const response = await fetch(endpoint, { method: body ? "POST" : "GET", credentials: "same-origin", cache: "no-store", ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const value = await response.json();
  if (!response.ok || !value.ok) throw new RequestFailure(value.error?.message || "手记暂时未能保存，请稍后重试。", response.status);
  return value.data;
}

export function useTownWorld(options: { endpoint?: string; pendingKey?: string; presentMotion?: boolean } = {}) {
  const endpoint = options.endpoint ?? ENDPOINT, pendingKey = options.pendingKey ?? PENDING_KEY;
  const presentMotion = options.presentMotion ?? false;
  const [view, setView] = useState<TownPlayView | null>(null);
  const viewRef = useRef<TownPlayView | null>(null);
  const [status, setStatus] = useState<"loading" | "new" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [restore, setRestore] = useState<{ key: string; sceneId: string } | null>(null);
  const [motion, setMotion] = useState<TownPlayResult["motion"] | null>(null);
  const deferred = useRef<{ motion: NonNullable<TownPlayResult["motion"]>; view: TownPlayView } | null>(null);
  const accept = useCallback((next: TownPlayView, reposition = false) => {
    const current = viewRef.current;
    if (current && current.sessionId === next.sessionId && current.worldRevision > next.worldRevision) return;
    viewRef.current = next; setView(next); setStatus("ready");
    if (reposition) setRestore({ key: crypto.randomUUID(), sceneId: next.sceneId || "town-square" });
  }, []);
  const finishMotion = useCallback((id: string) => {
    const waiting = deferred.current;
    if (!waiting || waiting.motion.id !== id) return;
    deferred.current = null; setMotion(null); accept(waiting.view);
  }, [accept]);
  const keepPending = useCallback((next: Pending | null) => {
    setPending(next);
    try { if (next) localStorage.setItem(pendingKey, JSON.stringify(next)); else localStorage.removeItem(pendingKey); } catch { /* In-memory retry remains available when storage is unavailable. */ }
  }, [pendingKey]);
  const load = useCallback(async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setMessage("");
    deferred.current = null; setMotion(null);
    try {
      let response = await request(endpoint);
      if (!response.view) { setStatus("new"); return; }
      accept(response.view);
      let saved: Pending | null = null;
      try { const text = localStorage.getItem(pendingKey); if (text) saved = JSON.parse(text); } catch { /* A corrupt draft cannot authorize a command. */ }
      if (saved?.sessionId === response.view.sessionId && saved.command) {
        keepPending(saved);
        response = await request(endpoint, saved.command);
        keepPending(null);
        response = await request(endpoint);
      }
      if (response.view) accept(response.view, true);
    } catch (error) {
      if (error instanceof RequestFailure && error.status >= 400 && error.status < 500) keepPending(null);
      setStatus("error"); setMessage(failureMessage(error, "暂时连不上小镇。原手记已保留，请重新连接后继续。"));
    }
    finally { locked.current = false; setBusy(false); }
  }, [accept, keepPending, endpoint, pendingKey]);
  useEffect(() => { void load(); }, [load]);
  const start = useCallback(async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setMessage("");
    try { const result = await request(endpoint, { kind: "start" }); if (result.view) accept(result.view, true); }
    catch (error) { setMessage(failureMessage(error, "暂时连不上小镇，请重试开始手记。")); }
    finally { locked.current = false; setBusy(false); }
  }, [accept, endpoint]);
  /** Only a closed notebook may be replaced; the page reloads into the new one. */
  const startFresh = useCallback(async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setMessage("");
    try { await request(endpoint, { kind: "start", fresh: true }); window.location.reload(); }
    catch (error) { setMessage(failureMessage(error, "暂时没能翻开新的手记，请重试。")); locked.current = false; setBusy(false); }
  }, [endpoint]);
  const submit = useCallback(async (command: TownPlayCommand) => {
    const current = viewRef.current;
    if (!current || locked.current || deferred.current) return false;
    locked.current = true; setBusy(true); setMessage("");
    keepPending({ sessionId: current.sessionId, command });
    try {
      const result = await request(endpoint, command);
      if (result.view) {
        const batch = result.motion;
        if (presentMotion && batch?.passages.length && batch.sessionId === current.sessionId && batch.sceneId === current.sceneId &&
          batch.sceneId === result.view.sceneId && batch.fromWorldRevision === current.worldRevision && batch.toWorldRevision === result.view.worldRevision) {
          // The server has committed. Present the witnessed crossing before
          // replacing the visible state; no second command may race it.
          deferred.current = { motion: batch, view: result.view }; setMotion(batch);
        } else accept(result.view);
      }
      keepPending(null); return true;
    } catch (error) {
      if (error instanceof RequestFailure && error.status >= 400 && error.status < 500) { keepPending(null); setStatus("error"); }
      setMessage(failureMessage(error, "这次行动尚未确认保存。请重试；小镇不会重复计算这一步的时间。"));
      return false;
    } finally { locked.current = false; setBusy(false); }
  }, [accept, keepPending, endpoint, presentMotion]);
  const command = useCallback((input: TownPlayAction) => {
    const current = viewRef.current;
    if (!current || pending || status !== "ready") return Promise.resolve(false);
    return submit({ ...input, actionId: crypto.randomUUID(), expectedSessionRevision: current.revision, expectedWorldRevision: current.worldRevision });
  }, [pending, status, submit]);
  return { view, status, busy, message, pending: !!pending, restore, motion, finishMotion, start, startFresh, reload: load, command, retry: () => pending ? submit(pending.command) : load() };
}
