"use client";

import { useEffect } from "react";
import type { Evidence, PlayerTheory, PlayerTheoryProof } from "@/lib/engine";
import { useAppLocale } from "@/app/localization/locale-context";
import styles from "./TheoryProofFields.module.css";

/** Only player-discovered descriptions are presented; no truth/ledger answer keys. */
export function TheoryProofFields({ theory, setTheory, discoveredEvidence, busy = false }: {
  theory: PlayerTheory;
  setTheory: (updater: (current: PlayerTheory) => PlayerTheory) => void;
  discoveredEvidence: Evidence[];
  busy?: boolean;
}) {
  const { locale, text } = useAppLocale();
  const cn = locale === "zh-CN";
  useEffect(() => {
    setTheory((current) => current.proof || current.motive || current.method ? current : {
      ...current, proof: { motiveEvidenceIds: [], methodEvidenceIds: [] }
    });
  }, [setTheory]);
  function toggle(group: keyof PlayerTheoryProof, id: string) {
    setTheory((current) => {
      const proof = current.proof || { motiveEvidenceIds: [], methodEvidenceIds: [] };
      const ids = proof[group];
      return {
        ...current,
        evidenceIds: Array.from(new Set([...current.evidenceIds, id])),
        proof: { ...proof, [group]: ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id] }
      };
    });
  }
  return <div className={styles.proof} data-testid="theory-proof-fields">
    <p>{cn ? "分别关联支持动机与作案手法的证据。被勾选的证据会加入理论；机会、时间线和排除证据继续保留在总证据链中。" : "Link the evidence supporting motive and method. Checked clues join your theory; keep opportunity, timeline, and exclusion clues in the overall evidence chain."}</p>
    {(["motiveEvidenceIds", "methodEvidenceIds"] as const).map((group) => <fieldset key={group} disabled={busy} data-testid={`theory-proof-${group}`}>
      <legend>{group === "motiveEvidenceIds" ? cn ? "哪些证据说明动机？" : "Which clues establish motive?" : cn ? "哪些证据说明工具与作案手法？" : "Which clues establish tools and method?"}</legend>
      {discoveredEvidence.length ? discoveredEvidence.map((clue, index) => <label key={clue.id} className={styles.clue}>
        <input type="checkbox" data-testid={`theory-proof-${group}-${index}`} checked={Boolean(theory.proof?.[group].includes(clue.id) && theory.evidenceIds.includes(clue.id))} onChange={() => toggle(group, clue.id)} />
        <span><strong>{text(clue.title)}</strong><small>{text(clue.visibleDescription)}</small></span>
      </label>) : <small>{cn ? "先搜索现场，找到可以关联的证据。" : "Search the scene to find evidence you can link."}</small>}
    </fieldset>)}
    <small>{cn ? "下方文字是可选笔记，不参与证据判定，无需复述标准答案。" : "The notes below are optional and are not graded. You do not need to repeat an answer key."}</small>
  </div>;
}
