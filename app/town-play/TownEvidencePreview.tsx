import type { TownCaseView } from "@/lib/town-play-contract";
import { caseClueNumber, evidenceCheckRecord } from "./case-notebook";
import styles from "./town-play.module.css";

/** Reading an already discovered clue is free; only the explicit command spends time. */
export function TownEvidencePreview({ investigation, personId, evidenceId }: { investigation: TownCaseView; personId: string; evidenceId: string }) {
  const record = evidenceCheckRecord(investigation, personId, evidenceId);
  if (!record) return null;
  const { clue, previous } = record;
  return <aside className={styles.evidencePreview} aria-label="待出示物证预览">
    <small>物证 {caseClueNumber(clue.id, investigation.clues.indexOf(clue) + 1)} · 阅读不推进时间</small>
    <h4>{clue.title}</h4><p>{clue.description}</p>
    {previous && <p className={styles.evidenceHistory} role="status">已向{previous.name}出示过：{previous.corrected ? "说法已更正" : "当时的说法未改变"}。再次出示仍会用五分钟。</p>}
  </aside>;
}
