"use client";

import type { InvestigationRoomProjection } from "@/lib/engine";
import dynamic from "next/dynamic";
import styles from "./InvestigationRoomProjectionSurface.module.css";

const ProceduralRoomRuntime = dynamic(
  () => import("./ProceduralRoomRuntime").then((module) => module.ProceduralRoomRuntime),
  { ssr: false }
);

const triggerLabels: Record<string, string> = {
  fatal: "致命事件",
  nonfatal_incident: "非致命事件",
  population_flow: "人口流动"
};

export function InvestigationRoomProjectionSurface({ projection }: { projection: InvestigationRoomProjection | null }) {
  if (!projection) return null;
  const traceable = projection.integrity.traceable;
  const solved = projection.mode === "player" && projection.evidenceNodeIds.some((id) => !id.includes("locked-"));
  const visibleSteps = projection.routeStepIds.slice(0, 8);
  const visibleEvidence = projection.evidenceNodeIds.slice(0, 6);

  return (
    <section className={styles.surface} data-testid="investigation-room-projection" data-room-id={projection.roomId} data-case-id={projection.caseId}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>ROOM PROJECTION / 证据室</span>
          <h2>雾灯证据室</h2>
          <p>把世界事件、证据节点和调查路线放进同一个可追溯空间。</p>
        </div>
        <div className={`${styles.badge} ${traceable ? styles.badgeReady : styles.badgeLocked}`}>
          <span className={styles.badgeDot} aria-hidden="true" />
          {traceable ? "来源可回溯" : solved ? "证据链已解锁" : "低剧透模式"}
        </div>
      </header>

      <div className={styles.viewport} role="img" aria-label="候选 GLB 调查证据室预览">
        <ProceduralRoomRuntime roomId={projection.roomId} caseId={projection.caseId}>
          <div className={styles.backWall} />
          <div className={styles.sideWall} />
          <div className={styles.floor} />
          <div className={styles.lamp} />
          <div className={styles.caseBoard}>
            <span>CASE ROUTE</span>
            <strong>{triggerLabels[projection.triggerKind || ""] || "世界事件"}</strong>
            <small>{projection.triggeredEventId ? "真实触发事件已接入" : "触发事件身份暂时锁定"}</small>
          </div>
          <div className={styles.table}>
            <div className={styles.tableTop}>
              <span>证据桌 / EVIDENCE TABLE</span>
              <strong>{visibleEvidence.length || "—"}</strong>
              <small>节点</small>
            </div>
            <div className={styles.evidencePins} aria-hidden="true">
              {visibleEvidence.map((id, index) => <i key={id} className={id.includes("locked-") ? styles.pinLocked : styles.pin} style={{ "--pin-index": index } as React.CSSProperties} />)}
            </div>
          </div>
          <div className={styles.routeRail} aria-hidden="true">
            {visibleSteps.map((id, index) => <i key={id} className={index === 0 ? styles.routeNodeActive : styles.routeNode} style={{ "--route-index": index } as React.CSSProperties} />)}
          </div>
          <div className={styles.arrival}>SOUTH ARRIVAL</div>
        </ProceduralRoomRuntime>
      </div>

      <div className={styles.metaGrid}>
        <div><span>房间</span><strong>{projection.roomId}</strong></div>
        <div><span>案件</span><strong>{projection.caseId}</strong></div>
        <div><span>路线</span><strong>{projection.routeStepIds.length} steps</strong></div>
        <div><span>来源</span><strong>{projection.sourceEventIds.length || "锁定"}</strong></div>
      </div>
      <div className={styles.routeList} aria-label="调查路线节点">
        {projection.routeStepIds.slice(0, 6).map((stepId, index) => <span key={stepId}><b>{String(index + 1).padStart(2, "0")}</b>{projection.mode === "player" && stepId.startsWith("route-step:") ? `调查步骤 ${index + 1}` : stepId}</span>)}
      </div>
    </section>
  );
}
