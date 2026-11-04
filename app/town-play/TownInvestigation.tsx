"use client";

import { useEffect, useRef, useState } from "react";
import type { TownCaseAction, TownCaseView, TownPlayView } from "@/lib/town-play-contract";
import type { PlayerTheory } from "@/packages/engine/src/types";
import styles from "./town-play.module.css";

type Props = { investigation: TownCaseView; residents: TownPlayView["residents"]; disabled: boolean; command: (action: TownCaseAction) => Promise<boolean> };
const placeNames: Record<string, string> = { books: "旧书店", cafe: "咖啡馆", police: "警务所", post: "邮局", inn: "旅馆", station: "车站" };

export function TownCasePlace({ investigation: c, residents, disabled, command, openBook }: Props & { openBook: () => void }) {
  const [person, setPerson] = useState("");
  const [evidenceId, setEvidenceId] = useState("");
  const observed = residents.filter(p => p.visibility === "observed");
  const entry = [...c.conversations].reverse().find(l => l.characterId === person);
  const dialogueRef = useRef<HTMLDivElement>(null);
  useEffect(() => { dialogueRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" }); }, [entry?.id, entry?.answer]);
  const present = observed.some(p => p.npcId === person);
  const stationStaff = observed.some(p => p.npcId === "rb-gu-yuanshan");
  return <section className={styles.caseWork} aria-label="地点调查">
    <div className={styles.caseHeading}><div><span className={styles.eyebrow}>调查手记</span><h3>{c.title}</h3></div><button className={styles.textButton} onClick={openBook}>打开案件本 →</button></div>
    {c.solved ? <p className={styles.caseResult}>这宗案件已经归档，可以回看证词和最后的经过。</p> : <>
      <p className={styles.quiet}>搜查和交谈各用五分钟。物证由原地点保管，手记收录你核对过的内容。</p>
      <div className={styles.searchChoices}>{c.searchTargets.map(target => <button key={target.id} disabled={disabled || target.found || (target.id === "rb-search-7" && !stationStaff)} onClick={() => void command({ kind: "case-search", targetId: target.id })}><span>{target.found ? "✓" : "◇"}</span>{target.label}{target.found ? " · 已记录" : target.id === "rb-search-7" && !stationStaff ? " · 等站员回来" : ""}</button>)}</div>
      <h4>面前的居民</h4>
      <div className={styles.casePeople}>{observed.map(p => <button key={p.npcId} disabled={disabled} aria-pressed={person === p.npcId} onClick={async () => { setPerson(p.npcId); setEvidenceId(""); await command({ kind: "case-question", characterId: p.npcId }); }}><span className={styles.personInitial} aria-hidden="true">{p.name.slice(0, 1)}</span><span><strong>交谈 · {p.name}</strong><small>{p.role}</small></span></button>)}</div>
      {!observed.length && <p className={styles.quiet}>眼下没有居民停留。可以先整理线索，或稍后回来。</p>}
      {entry && <div ref={dialogueRef} className={styles.dialogueCard} aria-label={`${entry.name}的对话`}><span className={styles.eyebrow}>{entry.corrected ? "核对后的说法" : "当面听到的说法"}</span><h4>{entry.name}</h4><p>{entry.answer}</p>{present && c.questionedIds.includes(person) && c.clues.length > 0 && <div className={styles.challengeRow}><label htmlFor="town-challenge-evidence">拿物证核对<select aria-label="拿物证核对" id="town-challenge-evidence" value={evidenceId} onChange={e => setEvidenceId(e.target.value)}><option value="">选择已取得的物证</option>{c.clues.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label><button className={styles.primary} disabled={disabled || !c.clues.some(e => e.id === evidenceId)} onClick={() => void command({ kind: "case-challenge", characterId: person, evidenceId })}>出示物证</button></div>}</div>}
    </>}
  </section>;
}

export function TownCaseBook({ investigation: c, disabled, command }: Props) {
  const [tab, setTab] = useState<"clues" | "testimony" | "theory" | "ending">(c.solved ? "ending" : "clues");
  const [draft, setDraft] = useState<PlayerTheory>({ culpritId: "", motive: "", method: "", evidenceIds: [], proof: { motiveEvidenceIds: [], methodEvidenceIds: [] } });
  const [loaded, setLoaded] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const key = `detective-town:case-draft:${c.id}`;
  useEffect(() => {
    let initial = c.lastTheory;
    try { const raw = localStorage.getItem(key); if (raw) { const saved = JSON.parse(raw); if (typeof saved.culpritId === "string" && Array.isArray(saved.evidenceIds) && Array.isArray(saved.proof?.motiveEvidenceIds) && Array.isArray(saved.proof?.methodEvidenceIds)) initial = saved; } }
    catch { setDraftMessage("本机草稿暂不可用，已提交的结论仍保存在手记里。"); }
    if (initial) setDraft(initial);
    setLoaded(true);
    // A mounted book owns a single case; server submissions must not overwrite
    // edits while the player is comparing evidence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { if (loaded) try { localStorage.setItem(key, JSON.stringify(draft)); } catch { setDraftMessage("草稿未能保存到浏览器，请及时提交或导出手记。"); } }, [draft, loaded, key]);
  const toggle = (kind: "evidenceIds" | "motiveEvidenceIds" | "methodEvidenceIds", id: string) => setDraft(old => {
    const current = kind === "evidenceIds" ? old.evidenceIds : old.proof?.[kind] || [];
    const next = current.includes(id) ? current.filter(v => v !== id) : [...current, id];
    return kind === "evidenceIds" ? { ...old, evidenceIds: next } : { ...old, proof: { motiveEvidenceIds: old.proof?.motiveEvidenceIds || [], methodEvidenceIds: old.proof?.methodEvidenceIds || [], [kind]: next } };
  });
  const tabs = [{ id: "clues", label: `物证 ${c.clues.length}/8` }, { id: "testimony", label: `证词 ${c.questionedIds.length}` }, { id: "theory", label: "整理推断" }, ...(c.solved ? [{ id: "ending", label: "案件归档" }] : [])] as const;
  return <section className={styles.caseWork} aria-label="案件本">
    <div className={styles.caseHeading}><div><span className={styles.eyebrow}>河湾 · 第一宗</span><h3>{c.title}</h3></div><span className={styles.caseSeal}>{c.solved ? "已归档" : "调查中"}</span></div>
    <p className={styles.prose}>{c.premise}</p>
    <details className={styles.caseBrief}><summary>展开受理记录</summary><p>{c.brief}</p></details>
    <div className={styles.caseTabs} aria-label="案件页签">{tabs.map(t => <button key={t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id as typeof tab)}>{t.label}</button>)}</div>
    {tab === "clues" && <><p className={styles.quiet}>只有亲自核对过的物证会写入这一页。六处地点都可以继续调查。</p>{c.clues.length ? <div className={styles.clueCards}>{c.clues.map((e, i) => <article key={e.id}><div><small>物证 {String(i + 1).padStart(2, "0")} · {placeNames[e.sceneId]}</small><h4>{e.title}</h4></div><p>{e.description}</p></article>)}</div> : <p className={styles.caseEmpty}>先到店门前按 E，检查展台、信件或交接记录。</p>}</>}
    {tab === "testimony" && <><p className={styles.quiet}>保留原话，也保留出示物证后的更正。记错与隐瞒需要分别判断。</p>{c.conversations.length ? <div className={styles.clueCards}>{c.conversations.map(l => <article key={l.id}><small>{l.evidenceId ? "物证核对" : "初次询问"}{l.corrected ? " · 说法已更正" : ""}</small><h4>{l.name}</h4><p className={styles.questionLine}>{l.question}</p><p>{l.answer}</p></article>)}</div> : <p className={styles.caseEmpty}>走近居民所在的地点，听听他们亲眼见过什么。</p>}</>}
    {tab === "theory" && <form className={styles.theoryForm} onSubmit={async e => { e.preventDefault(); await command({ kind: "case-submit", theory: draft }); }}>
      <p className={styles.quiet}>选出调查对象，将支持动机与手法的物证分开。时间核对和排除其他人的依据，也应列入提交材料。</p>
      <label htmlFor="town-case-person">谁移走了原图<select aria-label="谁移走了原图" id="town-case-person" disabled={c.solved || disabled} value={draft.culpritId} onChange={e => setDraft(old => ({ ...old, culpritId: e.target.value }))}><option value="">选择调查对象</option>{c.suspects.map(p => <option key={p.id} value={p.id}>{p.name} · {p.role}</option>)}</select></label>
      {([{ kind: "motiveEvidenceIds", title: "哪些物证解释动机" }, { kind: "methodEvidenceIds", title: "哪些物证证明使用的手法" }, { kind: "evidenceIds", title: "这次结论引用的全部材料" }] as const).map(group => <fieldset key={group.kind} disabled={c.solved || disabled}><legend>{group.title}</legend>{c.clues.map(e => <label key={e.id}><input type="checkbox" checked={(group.kind === "evidenceIds" ? draft.evidenceIds : draft.proof?.[group.kind] || []).includes(e.id)} onChange={() => toggle(group.kind, e.id)} />{e.title}</label>)}{!c.clues.length && <p className={styles.quiet}>还没有可引用的物证。</p>}{group.kind === "evidenceIds" && c.clues.length > 0 && <button type="button" className={styles.textButton} onClick={() => setDraft(old => ({ ...old, evidenceIds: c.clues.map(e => e.id) }))}>引用已取得的全部材料</button>}</fieldset>)}
      <label htmlFor="town-case-note">补充推断（可选）<textarea id="town-case-note" disabled={c.solved || disabled} rows={3} maxLength={600} value={draft.motive} onChange={e => setDraft(old => ({ ...old, motive: e.target.value }))} placeholder="把时间与物证如何相接写在这里……" /></label>
      {draftMessage && <p role="status" className={styles.quiet}>{draftMessage}</p>}
      {c.message && <p role="status" className={styles.caseResult}>{c.message}</p>}
      {!c.solved && <button className={styles.primary} type="submit" disabled={disabled || !draft.culpritId || !draft.evidenceIds.length}>提交这份结论 · 五分钟</button>}
      {c.solved && <button className={styles.primary} type="button" onClick={() => setTab("ending")}>翻到案件归档 →</button>}
    </form>}
    {tab === "ending" && c.resolution && <div className={styles.caseEnding}><span className={styles.eyebrow}>证据支持的经过</span><h4>{c.resolution.person}移走了原图</h4><p>{c.resolution.motive}</p><p>{c.resolution.method}</p><ol>{c.resolution.timeline.map((event, i) => <li key={i}><time>{event.time}</time><span>{event.event}</span></li>)}</ol><h4>后来</h4>{c.resolution.ending.map((text, i) => <p key={i}>{text}</p>)}</div>}
  </section>;
}
