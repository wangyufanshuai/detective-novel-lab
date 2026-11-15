"use client";
import { useEffect, useRef, useState } from "react";
import type { TownPlayView } from "@/lib/town-play-contract";
import { archiveSolvedCase, rememberSolvedCase, type ArchivedCase } from "./case-archive";

type Snapshot = { worldId: string; entries: ArchivedCase[]; message: string };
export function useTownCaseArchive(view: TownPlayView | null) {
  const [saved, setSaved] = useState<Snapshot>({ worldId: "", entries: [], message: "" });
  const memory = useRef(saved);
  const worldId = view?.worldId ?? "";
  const current = view?.investigation ?? null;
  useEffect(() => {
    if (!worldId) return;
    const fallback = memory.current.worldId === worldId ? memory.current.entries : [];
    let result: Pick<Snapshot, "entries" | "message">;
    try { result = rememberSolvedCase(localStorage, worldId, current, fallback); }
    catch {
      const entry = archiveSolvedCase(current);
      result = { entries: entry ? [...fallback.filter(c => c.id !== entry.id), entry] : fallback, message: "浏览器暂不支持本机留存，请及时导出当前手记。" };
    }
    const next = { worldId, ...result };
    memory.current = next; setSaved(next);
  }, [worldId, current]);
  return saved.worldId === worldId && !!worldId ? { ...saved, ready: true } : { worldId, entries: [], message: "", ready: false };
}
