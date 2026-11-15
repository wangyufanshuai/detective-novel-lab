"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TownCaseView, TownPlayView } from "@/lib/town-play-contract";
import type { PlayerTheory } from "@/packages/engine/src/types";
import { caseNextStep } from "./TownInvestigation";
import styles from "./town-play.module.css";
import { townSound } from "./town-sound";
import { casePeople } from "./case-notebook";

type Props = {
  investigation: TownCaseView;
  residents: TownPlayView["residents"];
  places: Array<{ id: string; label: string }>;
  openBook: (tab: "clues" | "testimony" | "theory" | "ending") => void;
  onMark?: (sceneId: string) => void;
};
type Pick = { kind: "person" | "clue"; id: string } | null;
type Line = { key: string; x1: number; y1: number; x2: number; y2: number; corrected: boolean; active: boolean };

const fallbackPlaces = [
  { id: "cafe", label: "咖啡馆" }, { id: "books", label: "旧书店" }, { id: "police", label: "警务所" },
  { id: "station", label: "车站" }, { id: "post", label: "邮局" }, { id: "inn", label: "旅馆" }
];

/** Corkboard view of one case. Reads only the public case view and the local draft. */
export function TownCaseBoard({ investigation: c, residents, places, openBook, onMark }: Props) {
  const canvas = useRef<HTMLDivElement>(null);
  const [pick, setPick] = useState<Pick>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState<PlayerTheory | undefined>(c.lastTheory);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`detective-town:case-draft:${c.id}`);
      if (raw) setDraft(JSON.parse(raw));
    } catch { /* The submitted theory, if any, is already shown. */ }
  }, [c.id]);

  // A string joins a person and an item only after the player showed it to them.
  const links = useMemo(() => {
    const seen = new Map<string, { personId: string; clueId: string; corrected: boolean }>();
    for (const line of c.conversations) {
      if (!line.evidenceId) continue;
      const key = `${line.characterId}:${line.evidenceId}`;
      const old = seen.get(key);
      seen.set(key, { personId: line.characterId, clueId: line.evidenceId, corrected: line.corrected || old?.corrected === true });
    }
    return [...seen.values()];
  }, [c.conversations]);
  const linked = (kind: "person" | "clue", id: string) => !!pick && (pick.kind === kind ? pick.id === id
    : links.some(l => pick.kind === "person" ? l.personId === pick.id && l.clueId === id : l.clueId === pick.id && l.personId === id));

  useLayoutEffect(() => {
    const root = canvas.current;
    if (!root) return;
    const measure = () => {
      const box = root.getBoundingClientRect();
      const anchor = (selector: string, side: "left" | "right") => {
        const el = root.querySelector<HTMLElement>(selector);
        if (!el || !el.offsetParent) return null;
        const r = el.getBoundingClientRect();
        return { x: (side === "right" ? r.right - 10 : r.left + 10) - box.left, y: r.top + 16 - box.top };
      };
      const next: Line[] = [];
      for (const l of links) {
        const a = anchor(`[data-board-person="${l.personId}"]`, "right"), b = anchor(`[data-board-clue="${l.clueId}"]`, "left");
        if (!a || !b) continue;
        const active = !!pick && (pick.kind === "person" ? pick.id === l.personId : pick.id === l.clueId);
        next.push({ key: `${l.personId}:${l.clueId}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y, corrected: l.corrected, active });
      }
      setLines(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [links, pick]);

  const placeList = places.length ? places : fallbackPlaces;
  // Suspects first, then anyone else the player has questioned (witnesses).
  const people = [...c.suspects.map(p => ({ ...p, witness: false })), ...[...new Map(c.conversations.filter(l => !c.suspects.some(p => p.id === l.characterId)).map(l => [l.characterId, l.name])).entries()].map(([id, personName]) => ({ id, name: personName, role: residents.find(p => p.npcId === id)?.role ?? "证人", witness: true }))];
  const resident = (id: string) => residents.find(p => p.npcId === id);
  const said = (id: string) => c.conversations.filter(l => l.characterId === id);
  const step = caseNextStep(c);
  const name = (id: string) => c.suspects.find(p => p.id === id)?.name ?? c.conversations.find(l => l.characterId === id)?.name;
  const clueTitle = (id: string) => c.clues.find(e => e.id === id)?.title;
  const focusLines = pick ? c.conversations.filter(l => pick.kind === "person" ? l.characterId === pick.id : l.evidenceId === pick.id) : [];
  const focusedPerson = pick?.kind === "person" ? casePeople(c, residents, placeList).find(person => person.id === pick.id) : null;
  const toggle = (next: NonNullable<Pick>) => { townSound().play("pin"); setPick(old => old?.kind === next.kind && old.id === next.id ? null : next); };

  return <div className={styles.board} data-picked={pick ? pick.kind : "none"}>
    <div ref={canvas} className={styles.boardCanvas}>
      <svg className={styles.boardStrings} aria-hidden="true">
        {lines.map(l => <path key={l.key} data-corrected={l.corrected} data-active={l.active}
          d={`M${l.x1},${l.y1} C${(l.x1 + l.x2) / 2},${Math.max(l.y1, l.y2) + 36} ${(l.x1 + l.x2) / 2},${Math.max(l.y1, l.y2) + 36} ${l.x2},${l.y2}`} />)}
      </svg>

      <section className={styles.boardPeople} aria-label="人物">
        <h3>人物 <small>{people.filter(p => c.questionedIds.includes(p.id)).length}/{people.length} 已询问</small></h3>
        {people.map(p => {
          const seen = resident(p.id), heard = said(p.id), corrected = heard.filter(l => l.corrected).length;
          return <button key={p.id} data-board-person={p.id} aria-pressed={pick?.kind === "person" && pick.id === p.id} data-linked={linked("person", p.id)}
            className={styles.boardCard} onClick={() => toggle({ kind: "person", id: p.id })}>
            <span className={styles.boardPin} aria-hidden="true" />
            <span className={styles.personInitial} aria-hidden="true">{p.name.slice(0, 1)}</span>
            <span><strong>{p.name}</strong><small>{p.role}</small>
              <em>{seen ? `上次见于${seen.locationName} · 第 ${seen.day} 天 ${seen.time}` : "尚未亲眼见到"}</em>
              <span className={styles.boardChips}>{p.witness && <i data-muted="true">证人</i>}{c.questionedIds.includes(p.id) ? <i>已询问</i> : <i data-muted="true">未询问</i>}{corrected > 0 && <i data-tone="red">说法更正 {corrected}</i>}</span>
            </span>
          </button>;
        })}
      </section>

      <section className={styles.boardClues} aria-label="物证">
        <h3>物证 <small>{c.clues.length}/{c.clues.length + c.leads.reduce((sum, lead) => sum + lead.open, 0)} 已核对</small></h3>
        <div className={styles.boardPlaces}>
          {placeList.map(place => {
            const found = c.clues.filter(e => e.sceneId === place.id), open = c.leads.find(lead => lead.sceneId === place.id)?.open ?? 0;
            if (!found.length && !open) return null;
            return <div key={place.id} className={styles.boardPlace}>
              <h4>{place.label.replace(/^河湾/, "")}</h4>
              {found.map(e => <button key={e.id} data-board-clue={e.id} aria-pressed={pick?.kind === "clue" && pick.id === e.id} data-linked={linked("clue", e.id)}
                className={styles.boardClue} onClick={() => toggle({ kind: "clue", id: e.id })}>
                <span className={styles.boardPin} aria-hidden="true" /><strong>{e.title}</strong><span>{e.description}</span>
              </button>)}
              {Array.from({ length: open }, (_, i) => <div key={i} className={styles.boardBlank}>?<span>尚未核对</span></div>)}
            </div>;
          })}
        </div>
      </section>

      <section className={styles.boardTheory} aria-label="推断">
        <h3>推断</h3>
        <p className={styles.boardNext}>{step.hint}</p>
        {c.solved && c.resolution ? <>
          <div className={styles.boardVerdict}><small>已归档</small><strong>{c.resolution.person}</strong></div>
          <button className={styles.primary} onClick={() => openBook("ending")}>回看案件经过 →</button>
        </> : <>
          <dl className={styles.boardDraft}>
            <dt>调查对象</dt><dd>{(draft?.culpritId && name(draft.culpritId)) || "尚未选定"}</dd>
            <dt>动机物证</dt><dd>{draft?.proof?.motiveEvidenceIds?.length || 0} 份</dd>
            <dt>手法物证</dt><dd>{draft?.proof?.methodEvidenceIds?.length || 0} 份</dd>
            <dt>引用材料</dt><dd>{draft?.evidenceIds?.length || 0} 份</dd>
          </dl>
          {c.message && <p className={styles.quiet}>{c.message}</p>}
          <button className={styles.primary} onClick={() => openBook("theory")}>整理推断 →</button>
        </>}
      </section>
    </div>

    <section className={styles.boardFocus} aria-live="polite" aria-label="对照">
      {focusedPerson && <div className={styles.boardSighting}><p>{focusedPerson.sighting}。地点是目击记录，居民可能已经离开。</p>{focusedPerson.sceneId && onMark && <button type="button" className={styles.textButton} onClick={() => onMark(focusedPerson.sceneId!)} aria-label={`标记${focusedPerson.name}上次目击地点`}>标记目击地点 →</button>}</div>}
      {!pick && <p className={styles.quiet}>选中一个人或一件物证。红线是物证改正了说法，虚线是出示过但没有改变说法。</p>}
      {pick && !focusLines.length && <p className={styles.quiet}>{pick.kind === "person" ? `还没有和${name(pick.id)}谈过。走到其所在地点，按 E 交谈。` : `还没有拿「${clueTitle(pick.id)}」核对任何人的说法。`}</p>}
      {focusLines.map(l => <article key={l.id} data-corrected={l.corrected}>
        <small>{l.name}{l.evidenceId ? ` · 出示「${clueTitle(l.evidenceId) ?? "物证"}」` : " · 初次询问"}{l.corrected ? " · 说法已更正" : ""}</small>
        <p>{l.answer}</p>
      </article>)}
    </section>
  </div>;
}
