"use client";

import { useEffect, useRef, useState } from "react";
import type { TownCaseAction, TownCaseView, TownCommissionView, TownPlayView } from "@/lib/town-play-contract";
import type { PlayerTheory } from "@/packages/engine/src/types";
import styles from "./town-play.module.css";
import { caseClueNumber, casePeople, missingTheoryFields, restoreCaseDraft } from "./case-notebook";
import { TownEvidencePreview } from "./TownEvidencePreview";

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
      {entry && <div ref={dialogueRef} className={styles.dialogueCard} aria-label={`${entry.name}的对话`}>
        <span className={styles.eyebrow}>{entry.corrected ? "核对后的说法" : "当面听到的说法"}</span><h4>{entry.name}</h4><p>{entry.answer}</p>
        {present && c.questionedIds.includes(person) && c.clues.length > 0 && <><div className={styles.challengeRow}><label htmlFor="town-challenge-evidence">拿物证核对<select aria-label="拿物证核对" id="town-challenge-evidence" value={evidenceId} onChange={e => setEvidenceId(e.target.value)}><option value="">选择已取得的物证</option>{c.clues.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label><button className={styles.primary} disabled={disabled || !c.clues.some(e => e.id === evidenceId)} onClick={() => void command({ kind: "case-challenge", characterId: person, evidenceId })}>出示物证</button></div><TownEvidencePreview investigation={c} personId={person} evidenceId={evidenceId} /></>}
      </div>}
    </>}
  </section>;
}

export type CaseBookTab = "clues" | "testimony" | "theory" | "ending";
export function TownCaseBook({ investigation: c, residents, disabled, command, initialTab, places = [], onMark }: Props & { initialTab?: CaseBookTab; places?: Array<{ id: string }>; onMark?: (sceneId: string) => void }) {
  const [tab, setTab] = useState<CaseBookTab>(initialTab && (initialTab !== "ending" || c.solved) ? initialTab : c.solved ? "ending" : "clues");
  const [draft, setDraft] = useState<PlayerTheory>({ culpritId: "", motive: "", method: "", evidenceIds: [], proof: { motiveEvidenceIds: [], methodEvidenceIds: [] } });
  const [loaded, setLoaded] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [clueQuery, setClueQuery] = useState("");
  const [cluePlace, setCluePlace] = useState("");
  const [witness, setWitness] = useState("");
  const [correctedOnly, setCorrectedOnly] = useState(false);
  const key = `detective-town:case-draft:${c.id}`;
  useEffect(() => {
    let initial = c.lastTheory;
    try { const raw = localStorage.getItem(key); if (raw) initial = JSON.parse(raw); }
    catch { setDraftMessage("本机草稿暂不可用，已提交的结论仍保存在手记里。"); }
    setDraft(restoreCaseDraft(initial, c));
    setLoaded(true);
    // A mounted book owns a single case; server submissions must not overwrite
    // edits while the player is comparing evidence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { if (loaded) try { localStorage.setItem(key, JSON.stringify(draft)); } catch { setDraftMessage("草稿未能保存到浏览器，请及时提交或导出手记。"); } }, [draft, loaded, key]);
  const toggle = (kind: "evidenceIds" | "motiveEvidenceIds" | "methodEvidenceIds", id: string) => setDraft(old => {
    const current = kind === "evidenceIds" ? old.evidenceIds : old.proof?.[kind] || [];
    const next = current.includes(id) ? current.filter(v => v !== id) : [...current, id];
    if (kind === "evidenceIds") return { ...old, evidenceIds: next, proof: { motiveEvidenceIds: (old.proof?.motiveEvidenceIds || []).filter(v => next.includes(v)), methodEvidenceIds: (old.proof?.methodEvidenceIds || []).filter(v => next.includes(v)) } };
    return { ...old, evidenceIds: [...new Set([...old.evidenceIds, ...next])], proof: { motiveEvidenceIds: old.proof?.motiveEvidenceIds || [], methodEvidenceIds: old.proof?.methodEvidenceIds || [], [kind]: next } };
  });
  const query = clueQuery.trim().toLocaleLowerCase();
  const visibleClues = c.clues.filter(e => (!cluePlace || e.sceneId === cluePlace) && (!query || `${e.title} ${e.description} ${placeNames[e.sceneId] ?? e.sceneId}`.toLocaleLowerCase().includes(query)));
  const witnesses = [...new Map(c.conversations.map(line => [line.characterId, line.name])).entries()];
  const visibleConversations = c.conversations.filter(line => (!witness || line.characterId === witness) && (!correctedOnly || line.corrected));
  const missing = missingTheoryFields(draft);
  const people = casePeople(c, residents, places);
  const tabs = [{ id: "clues", label: `物证 ${c.clues.length}/${c.clues.length + c.leads.reduce((sum, lead) => sum + lead.open, 0)}` }, { id: "testimony", label: `证词 ${c.questionedIds.length}` }, { id: "theory", label: "整理推断" }, ...(c.solved ? [{ id: "ending", label: "案件归档" }] : [])] as const;
  return <section className={styles.caseWork} aria-label="案件本">
    <div className={styles.caseHeading}><div><span className={styles.eyebrow}>河湾 · {c.ordinal}</span><h3>{c.title}</h3></div><span className={styles.caseSeal}>{c.solved ? "已归档" : "调查中"}</span></div>
    <p className={styles.prose}>{c.premise}</p>
    <details className={styles.caseBrief}><summary>展开受理记录</summary><p>{c.brief}</p></details>
    <div className={styles.caseTabs} aria-label="案件页签">{tabs.map(t => <button key={t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id as typeof tab)}>{t.label}</button>)}</div>
    {tab === "clues" && <>
      <p className={styles.quiet}>只有亲自核对过的物证会写入这一页。可以按地点归拢，也可以找一句记得的原话。</p>
      {c.clues.length > 0 && <>
        <div className={styles.notebookFilters}>
          <label htmlFor="town-clue-query">查找物证<input type="search" id="town-clue-query" value={clueQuery} onChange={e => setClueQuery(e.target.value)} placeholder="名称、时间或记录中的一句话" maxLength={120} /></label>
          <label htmlFor="town-clue-place">物证地点<select id="town-clue-place" value={cluePlace} onChange={e => setCluePlace(e.target.value)}><option value="">全部地点</option>{[...new Set(c.clues.map(e => e.sceneId))].map(id => <option key={id} value={id}>{placeNames[id] ?? id}</option>)}</select></label>
        </div>
        <div className={styles.notebookCount}><span role="status">显示 {visibleClues.length} / {c.clues.length} 份已取得物证</span>{(clueQuery || cluePlace) && <button type="button" className={styles.textButton} onClick={() => { setClueQuery(""); setCluePlace(""); }}>清除物证筛选</button>}</div>
      </>}
      {visibleClues.length ? <div className={styles.clueCards}>{visibleClues.map(e => <article key={e.id}><div><small>物证 {caseClueNumber(e.id, c.clues.indexOf(e) + 1)} · {placeNames[e.sceneId] ?? e.sceneId}</small><h4>{e.title}</h4></div><p>{e.description}</p></article>)}</div> : <p className={styles.caseEmpty}>{c.clues.length ? "没有符合筛选的物证。试试换一个词，或清除筛选。" : "先到店门前按 E，检查现场的物品和记录。"}</p>}
    </>}
    {tab === "testimony" && <>
      <p className={styles.quiet}>保留原话，也保留出示物证后的更正。记错与隐瞒需要分别判断。</p>
      <details className={styles.peopleDirectory} open={c.conversations.length === 0}>
        <summary>调查人物 · {people.filter(p => p.questioned).length}/{people.length} 已询问</summary>
        <p className={styles.quiet}>这里只保留亲眼见过的地点，居民可能已经离开。标记方向不推进时间。</p>
        <ul>{people.map(person => <li key={person.id}>
          <div><strong>{person.name}</strong><small>{person.role} · {person.questioned ? "已询问" : "尚未询问"}{person.corrected ? " · 说法已更正" : ""}</small><p>{person.sighting}</p></div>
          <div className={styles.peopleDirectoryActions}>
            {person.questioned && <button type="button" className={styles.textButton} onClick={() => { setWitness(person.id); setCorrectedOnly(false); }}>查看{person.name}的证词</button>}
            {person.sceneId && onMark && <button type="button" className={styles.textButton} onClick={() => onMark(person.sceneId!)} aria-label={`标记${person.name}上次目击地点`}>标记目击地点 →</button>}
          </div>
        </li>)}</ul>
      </details>
      {c.conversations.length > 0 && <>
        <div className={styles.notebookFilters}>
          <label htmlFor="town-testimony-person">查看谁的证词<select id="town-testimony-person" value={witness} onChange={e => setWitness(e.target.value)}><option value="">全部已询问居民</option>{witnesses.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <label className={styles.notebookCheck}><input type="checkbox" checked={correctedOnly} onChange={e => setCorrectedOnly(e.target.checked)} />只看已更正的说法</label>
        </div>
        <div className={styles.notebookCount}><span role="status">显示 {visibleConversations.length} / {c.conversations.length} 条当面记录</span>{(witness || correctedOnly) && <button type="button" className={styles.textButton} onClick={() => { setWitness(""); setCorrectedOnly(false); }}>清除证词筛选</button>}</div>
      </>}
      {visibleConversations.length ? <div className={styles.clueCards}>{visibleConversations.map(l => <article key={l.id}><small>{l.evidenceId ? "物证核对" : "初次询问"}{l.corrected ? " · 说法已更正" : ""}</small><h4>{l.name}</h4><p className={styles.questionLine}>{l.question}</p><p>{l.answer}</p>{l.evidenceId && c.clues.some(e => e.id === l.evidenceId) && <button type="button" className={styles.textButton} onClick={() => { setCluePlace(""); setClueQuery(c.clues.find(e => e.id === l.evidenceId)!.title); setTab("clues"); }}>回看物证 · {c.clues.find(e => e.id === l.evidenceId)!.title} →</button>}</article>)}</div> : <p className={styles.caseEmpty}>{c.conversations.length ? "还没有符合筛选的证词。已更正的说法会在当面核对后记入。" : "走近居民所在的地点，听听他们亲眼见过什么。"}</p>}
    </>}
    {tab === "theory" && <form className={styles.theoryForm} onSubmit={async e => { e.preventDefault(); if (loaded && !missing.length && !disabled && !c.solved) await command({ kind: "case-submit", theory: draft }); }}>
      <p className={styles.quiet}>选出调查对象，将支持动机与手法的物证分开；勾选时会一并列入引用材料。时间核对和排除其他人的依据，也应列入提交材料。</p>
      <label htmlFor="town-case-person">{c.question}<select aria-label={c.question} id="town-case-person" disabled={c.solved || disabled} value={draft.culpritId} onChange={e => setDraft(old => ({ ...old, culpritId: e.target.value }))}><option value="">选择调查对象</option>{c.suspects.map(p => <option key={p.id} value={p.id}>{p.name} · {p.role}</option>)}</select></label>
      {([{ kind: "motiveEvidenceIds", title: "哪些物证解释动机" }, { kind: "methodEvidenceIds", title: "哪些物证证明使用的手法" }, { kind: "evidenceIds", title: "这次结论引用的全部材料" }] as const).map(group => <fieldset key={group.kind} disabled={c.solved || disabled}><legend>{group.title}</legend>{c.clues.map(e => <label key={e.id}><input type="checkbox" checked={(group.kind === "evidenceIds" ? draft.evidenceIds : draft.proof?.[group.kind] || []).includes(e.id)} onChange={() => toggle(group.kind, e.id)} />{e.title}</label>)}{!c.clues.length && <p className={styles.quiet}>还没有可引用的物证。</p>}{group.kind === "evidenceIds" && c.clues.length > 0 && <button type="button" className={styles.textButton} onClick={() => setDraft(old => ({ ...old, evidenceIds: c.clues.map(e => e.id) }))}>引用已取得的全部材料</button>}</fieldset>)}
      <label htmlFor="town-case-note">补充推断（可选）<textarea id="town-case-note" disabled={c.solved || disabled} rows={3} maxLength={600} value={draft.motive} onChange={e => setDraft(old => ({ ...old, motive: e.target.value }))} placeholder="把时间与物证如何相接写在这里……" /></label>
      {draftMessage && <p role="status" className={styles.quiet}>{draftMessage}</p>}
      {c.message && <p role="status" className={styles.caseResult}>{c.message}</p>}
      {!c.solved && <><p className={styles.quiet} role="status">{missing.length ? `还需选择：${missing.join("、")}。` : "选择已填齐。提交后仍需由物证和当面核对支持结论。"}</p><button className={styles.primary} type="submit" disabled={disabled || !loaded || missing.length > 0}>提交这份结论 · 五分钟</button></>}
      {c.solved && <button className={styles.primary} type="button" onClick={() => setTab("ending")}>翻到案件归档 →</button>}
    </form>}
    {tab === "ending" && c.resolution && <div className={styles.caseEnding}><span className={styles.eyebrow}>证据支持的经过</span><h4>{c.resolution.headline}</h4><p>{c.resolution.motive}</p><p>{c.resolution.method}</p><ol>{c.resolution.timeline.map((event, i) => <li key={i}><time>{event.time}</time><span>{event.event}</span></li>)}</ol><h4>后来</h4>{c.resolution.ending.map((text, i) => <p key={i}>{text}</p>)}</div>}
  </section>;
}

type TrackerProps = {
  commission?: TownCommissionView | null;
  investigation: TownCaseView | null;
  places: Array<{ id: string; label: string }>;
  onMark: (sceneId: string) => void;
  onOpenBook: () => void;
  onOpenBoard: () => void;
};

/** The case's next step, always on screen while walking. Only public view data. */
/** A commission waiting to be taken, when no case is open. */
export function commissionHint(commission: TownCommissionView) {
  // Waiting for a later morning: the server already says when and how.
  if (commission.opensOnDay) return commission.detail;
  return `去${commission.openAt.map(id => placeNames[id] ?? id).join("或")}，领取调查手记。`;
}

/** Eyebrow for the next case: taken now, or on a later morning. */
export function commissionLabel(commission: TownCommissionView) {
  return commission.opensOnDay ? `下一宗 · 第 ${commission.opensOnDay} 天早上` : `新委托 · ${commission.ordinal}`;
}

export function caseNextStep(c: TownCaseView | null, commission?: TownCommissionView | null) {
  if (commission && (!c || c.solved)) return { title: commission.hook, hint: commissionHint(commission) };
  if (!c) return { title: "暂时没有委托", hint: "沿着街道走走，认一认河湾的居民。" };
  if (c.solved) return { title: c.title, hint: "案件已归档。可以回看证词与最后的经过。" };
  const open = c.leads.reduce((sum, lead) => sum + lead.open, 0);
  if (open) return { title: c.title, hint: `还有 ${c.leads.length} 处地点有未核对的物品。` };
  if (!c.conversations.some(line => line.corrected)) return { title: c.title, hint: "物证已经齐了。回到居民面前，出示物证核对说法。" };
  return { title: c.title, hint: "整理动机、手法与时间，在案件本里提交结论。" };
}

export function TownCaseTracker({ investigation: active, commission, places, onMark, onOpenBook, onOpenBoard }: TrackerProps) {
  // A finished case steps aside for the next commission.
  const c = commission && active?.solved ? null : active;
  const [open, setOpen] = useState(true);
  // Small screens start folded so the street stays visible.
  useEffect(() => { if (window.matchMedia("(max-width: 720px)").matches) setOpen(false); }, []);
  const step = caseNextStep(c, commission);
  const label = (id: string) => places.find(p => p.id === id)?.label ?? placeNames[id] ?? id;
  const order = (id: string) => { const index = places.findIndex(p => p.id === id); return index < 0 ? places.length : index; };
  const leads = c ? (c.solved ? [] : [...c.leads].sort((a, b) => order(a.sceneId) - order(b.sceneId))) : (commission?.openAt ?? []).map(sceneId => ({ sceneId, open: 0 }));
  const found = c?.clues.length ?? 0;
  const total = c ? found + c.leads.reduce((sum, lead) => sum + lead.open, 0) : 0;
  return <section className={styles.tracker} aria-label="案件进度" data-open={open} data-solved={c?.solved ?? false}>
    <button className={styles.trackerHead} aria-expanded={open} onClick={() => setOpen(v => !v)}>
      <span className={styles.eyebrow}>{c ? (c.solved ? "已归档" : `调查中 · ${c.ordinal}`) : commission ? commissionLabel(commission) : "河湾"}</span>
      <strong>{step.title}</strong>
      {c && <span className={styles.trackerPips} aria-label={`物证 ${found}/${total}`}>{Array.from({ length: total }, (_, i) => <i key={i} data-filled={i < found} />)}</span>}
      <span className={styles.trackerFold} aria-hidden="true">{open ? "−" : "+"}</span>
    </button>
    {open && <div className={styles.trackerBody}>
      <p>{step.hint}</p>
      {leads.length > 0 && <ul>{leads.map(lead => <li key={lead.sceneId}><button onClick={() => onMark(lead.sceneId)} aria-label={`在地图上标记${label(lead.sceneId)}${lead.open ? `，${lead.open} 处待核对` : ""}`}><span aria-hidden="true">◇</span>{label(lead.sceneId).replace(/^河湾/, "")}{lead.open > 0 && <small aria-hidden="true">{lead.open}</small>}</button></li>)}</ul>}
      {c && <div className={styles.trackerFoot}><span>证词 {c.questionedIds.length} · 更正 {c.conversations.filter(line => line.corrected).length}</span><span><button className={styles.textButton} onClick={onOpenBoard}>看板 <kbd>B</kbd></button><button className={styles.textButton} onClick={onOpenBook}>案件本 <kbd>K</kbd></button></span></div>}
    </div>}
  </section>;
}
