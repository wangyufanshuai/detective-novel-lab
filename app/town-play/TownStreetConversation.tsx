"use client";

import { useEffect, useState } from "react";
import type { TownCaseAction, TownPlayView } from "@/lib/town-play-contract";
import type { TownContact } from "./town-interaction";
import styles from "./town-play.module.css";
import { commissionHint } from "./TownInvestigation";
import { TownEvidencePreview } from "./TownEvidencePreview";

// Authored public flavour, not generated testimony or private simulation state.
const greetings: Record<string, string> = {
  "rb-song-tang": "歇歇脚吧。咖啡可以慢慢喝，想问的事也可以慢慢说。",
  "rb-zhou-yan": "你好。我是镇上的邮差。找地址的话，沿着门牌一路看过去就好。",
  "rb-xu-zhiwei": "修书要有耐心。纸页上的折痕、墨迹，都值得仔细看。",
  "rb-lu-xingzhou": "有什么需要帮忙的？把亲眼见到的事和自己的猜测分开说，会更清楚。",
  "rb-chen-hui": "你好。寄信、找人，都可以先把名字写清楚。",
  "rb-gu-yuanshan": "来河湾走走？车站在镇子的西边，钟楼是很好认的路标。",
  "rb-bai-lu": "花不一定要挑最鲜艳的。搭在一起舒服，就很好看。",
  "rb-lin-ali": "欢迎来河湾。走累了，可以去桥畔旅馆坐一会儿。",
  "rb-cheng-du": "我做木工。看一张桌子，先看它稳不稳，再看它漂不漂亮。",
  "rb-shen-ying": "我喜欢听人把事情从头讲一遍。细节往往藏在那些没有省略的句子里。",
  "rb-han-shuo": "钟表的快慢得仔细对。单看一次指针，未必知道它走得准不准。",
  "rb-jiang-zhi": "在镇上慢慢走吧。有空听听每个人的说法，再写进自己的手记。",
};

export function TownStreetConversation({ person, view, disabled, command, openBook, close }: {
  person: TownContact; view: TownPlayView | null; disabled: boolean;
  command: (action: TownCaseAction) => Promise<boolean>; openBook: () => void; close: () => void;
}) {
  const [fresh, setFresh] = useState(false);
  const [evidenceId, setEvidenceId] = useState("");
  const c = view?.investigation;
  useEffect(() => { setFresh(false); setEvidenceId(""); }, [c?.id, person.npcId]);
  const present = view?.sceneId === person.sceneId && view.residents.some(p => p.actorId === person.actorId && p.npcId === person.npcId && p.visibility === "observed" && p.sceneId === view.sceneId);
  const entry = c ? [...c.conversations].reverse().find(line => line.characterId === person.npcId) : null;
  const original = c?.conversations.find(line => line.characterId === person.npcId && !line.evidenceId);
  const ask = async (action: TownCaseAction) => { if (await command(action)) setFresh(true); };
  return <section className={styles.streetSpeech} aria-label={`${person.name}的街角交谈`}>
    <div className={styles.streetWords} aria-live="polite">
      <span className={styles.eyebrow}>{entry ? entry.corrected ? fresh ? "核对后的说法" : "手记里记下的更正" : entry.evidenceId ? "上次的核对记录" : fresh ? "当面听到的说法" : "手记里记下的原话" : "路上相遇"}</span>
      <p>{entry?.answer || greetings[person.npcId] || "你好。先沿着街道走走，认一认河湾的路吧。"}</p>
      {original && entry && original.answer !== entry.answer && <details className={styles.originalStatement}><summary>对照最初记下的原话</summary><p>{original.answer}</p></details>}
      {!present && <p role="status" className={styles.quiet}>对方已离开这次目击地点。先回街道看看吧。</p>}
      {(!c || c.solved) && view?.commission && <small>{view.commission.hook}。{commissionHint(view.commission)}</small>}
    </div>
    <div className={styles.streetActions}>
      {c && !c.solved && <button className={styles.primary} disabled={disabled || !present} onClick={() => void ask({ kind: "case-question", characterId: person.npcId })}>{entry ? "再问问早晨的事" : "问问早晨的事"}<small>交谈用五分钟</small></button>}
      {c && !c.solved && c.questionedIds.includes(person.npcId) && c.clues.length > 0 && <div className={styles.streetEvidence}><label htmlFor="street-challenge-evidence">拿物证核对<select id="street-challenge-evidence" aria-label="街角核对物证" value={evidenceId} onChange={event => setEvidenceId(event.target.value)}><option value="">选择已取得的物证</option>{c.clues.map(clue => <option key={clue.id} value={clue.id}>{clue.title}</option>)}</select></label><TownEvidencePreview investigation={c} personId={person.npcId} evidenceId={evidenceId} /><button className={styles.textButton} disabled={disabled || !present || !c.clues.some(clue => clue.id === evidenceId)} onClick={() => void ask({ kind: "case-challenge", characterId: person.npcId, evidenceId })}>出示这份物证 · 五分钟</button></div>}
      <div className={styles.streetLinks}>{c && <button className={styles.textButton} onClick={openBook}>翻开案件本</button>}<button className={styles.textButton} onClick={close}>继续走走</button></div>
    </div>
  </section>;
}
