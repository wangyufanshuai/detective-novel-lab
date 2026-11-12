"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TownPlayView } from "@/lib/town-play-contract";

/**
 * First-play guide: nine steps through the first case, each finished by doing
 * it, never by clicking "next". Progress lives in this browser only. Players
 * who already had a save before the guide existed start with it off.
 */
const GUIDE_KEY = "detective-town:guide:v1";

/** Things the player has done at least once; kept so a reload does not repeat a step. */
export type GuideFlags = { moved: boolean; talked: boolean; mapped: boolean; boarded: boolean };
type Facts = GuideFlags & { hasCase: boolean; clues: number; questioned: number; corrected: number; solved: boolean };
type Saved = { version: 1; off: boolean; done: string[]; flags: GuideFlags };

export type GuideStep = {
  id: string;
  title: string;
  /** Desktop and touch wording; keys in 「」 render as key caps. */
  text: string;
  touch: string;
  /** Toolbar slot (1-based) to pulse, if any. */
  slot?: number;
  done: (f: Facts) => boolean;
};

export const GUIDE_STEPS: GuideStep[] = [
  { id: "walk", title: "在河湾走一走", text: "用「W」「A」「S」「D」或方向键沿着街道走动。", touch: "按住左下方的方向键走动。", done: f => f.moved },
  { id: "talk", title: "和居民打个招呼", text: "走近一位居民，出现提示后按「E」交谈。", touch: "走近一位居民，点一下出现的交谈提示。", done: f => f.talked },
  { id: "map", title: "看一眼全镇", text: "按「M」俯瞰全镇。每家店上方都有招牌，点一下就能在街上标记方向。", touch: "点工具栏的「地图」俯瞰全镇，点招牌标记方向。", slot: 2, done: f => f.mapped },
  { id: "commission", title: "领取第一宗委托", text: "右上角写着委托和地点。走到那里，在店门前按「E」，领取调查手记。", touch: "右上角写着委托和地点。走到那里，点店门提示领取调查手记。", done: f => f.hasCase },
  { id: "search", title: "搜查物证", text: "在有数字标记的店门前按「E」，进去或打开调查。走到带「◆」的物品旁再按「E」核对。", touch: "在有数字标记的店门前点提示。走到带「◆」的物品旁，点出现的提示核对。", done: f => f.clues > 0 },
  { id: "question", title: "当面询问", text: "头上有「?」的居民还没问过。走过去按「E」，先听他把话说完。", touch: "头上有「?」的居民还没问过。走过去点交谈，先听他把话说完。", done: f => f.questioned > 0 },
  { id: "challenge", title: "拿物证核对说法", text: "交谈时选一份物证出示。说法被改正时，对方头上会出现红色的「!」。", touch: "交谈时选一份物证出示。说法被改正时，对方头上会出现红色的「!」。", done: f => f.corrected > 0 },
  { id: "board", title: "在看板上理一理", text: "按「B」打开案件看板。红线连着被物证改正的说法，虚线是还没改变的。", touch: "在案件进度卡上点「看板」。红线连着被物证改正的说法。", done: f => f.boarded },
  { id: "solve", title: "提交结论", text: "按「K」打开案件本，在「整理推断」里选出你认定的人，再勾选证明动机和手法的物证。", touch: "在案件进度卡上点「案件本」，在「整理推断」里选出你认定的人并勾选物证。", slot: 3, done: f => f.solved }
];

const noFlags: GuideFlags = { moved: false, talked: false, mapped: false, boarded: false };

function read(): Saved | null {
  try {
    const raw = JSON.parse(localStorage.getItem(GUIDE_KEY) || "null");
    if (raw?.version !== 1 || !Array.isArray(raw.done)) return null;
    return { version: 1, off: raw.off === true, done: raw.done.filter((id: unknown) => typeof id === "string"), flags: { ...noFlags, ...raw.flags } };
  } catch { return null; }
}

export function useTownGuide(input: { view: TownPlayView | null; status: string; panel: string | null; overview: boolean; moved: boolean }) {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null);
  const loaded = useRef(false);

  // Load once the world status is known: a returning save starts with the guide off.
  useEffect(() => {
    if (loaded.current || input.status === "loading") return;
    loaded.current = true;
    setSaved(read() ?? { version: 1, off: input.status !== "new", done: [], flags: noFlags });
  }, [input.status]);
  useEffect(() => { if (saved) try { localStorage.setItem(GUIDE_KEY, JSON.stringify(saved)); } catch { /* private mode: the guide simply restarts next time */ } }, [saved]);

  // Remember one-off actions the view cannot tell us later.
  const mark = useCallback((flag: keyof GuideFlags) => setSaved(old => old && !old.flags[flag] ? { ...old, flags: { ...old.flags, [flag]: true } } : old), []);
  useEffect(() => { if (input.moved) mark("moved"); }, [input.moved, mark]);
  useEffect(() => { if (input.panel === "person") mark("talked"); if (input.panel === "board") mark("boarded"); }, [input.panel, mark]);
  useEffect(() => { if (input.overview) mark("mapped"); }, [input.overview, mark]);

  const c = input.view?.investigation ?? null;
  const facts: Facts = useMemo(() => ({
    ...(saved?.flags ?? noFlags),
    hasCase: !!c, clues: c?.clues.length ?? 0, questioned: c?.questionedIds.length ?? 0,
    corrected: c?.conversations.filter(line => line.corrected).length ?? 0, solved: !!c?.solved
  }), [saved?.flags, c]);

  const current = saved && !saved.off ? GUIDE_STEPS.find(step => !saved.done.includes(step.id)) ?? null : null;

  // A finished step shows a brief tick before the next one replaces it.
  useEffect(() => {
    if (!current || justDone || !current.done(facts)) return;
    setJustDone(current.id);
  }, [current, facts, justDone]);
  // Separate from the check above, so a view refresh cannot cancel the hand-off.
  useEffect(() => {
    if (!justDone) return;
    const timer = window.setTimeout(() => {
      setSaved(old => old ? { ...old, done: [...new Set([...old.done, justDone])] } : old);
      setJustDone(null);
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [justDone]);

  return {
    step: current,
    index: current ? GUIDE_STEPS.indexOf(current) : -1,
    total: GUIDE_STEPS.length,
    finishing: !!current && justDone === current.id,
    active: !!current,
    skip: () => setSaved(old => old ? { ...old, off: true } : old),
    restart: () => setSaved({ version: 1, off: false, done: [], flags: noFlags }),
    setEnabled: (on: boolean) => setSaved(old => ({ ...(old ?? { version: 1, done: [], flags: noFlags }), off: !on }))
  };
}
