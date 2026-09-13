"use client";

import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import type { CampaignFrontDoorCard } from "@/app/campaign/campaign-front-door-model";
import { useAppLocale } from "@/app/localization/locale-context";
import { CampaignDossier, CampaignSpine, groupCampaignsByVolume, volumeMessageKey } from "./CampaignFrontDoorArchive";
import styles from "./CampaignFrontDoor.module.css";

export function CampaignFrontDoor({
  runtimeMode,
  open,
  cards,
  selectedIndex,
  selectedRouteIndex,
  busy,
  status,
  canContinue,
  onSelect,
  onSelectRoute,
  onStart,
  onContinue,
  onDismiss
}: {
  runtimeMode: "server" | "static-demo";
  open: boolean;
  cards: CampaignFrontDoorCard[];
  selectedIndex: number;
  selectedRouteIndex: number;
  busy: boolean;
  status: string;
  canContinue: boolean;
  onSelect?: (index: number) => void;
  onSelectRoute?: (index: number) => void;
  onStart?: () => void;
  onContinue?: () => void;
  onDismiss?: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const { t, text, locale, setLocale } = useAppLocale();
  const cn = locale === "zh-CN";
  const groups = useMemo(() => groupCampaignsByVolume(cards), [cards]);

  useEffect(() => {
    if (runtimeMode !== "server" || !open) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modalRoot = stageRef.current?.closest<HTMLElement>("[data-testid='campaign-front-door']");
    const inertedSiblings = Array.from(modalRoot?.parentElement?.children || [])
      .filter((item): item is HTMLElement => item instanceof HTMLElement && item !== modalRoot && !item.inert);
    for (const sibling of inertedSiblings) sibling.inert = true;
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      for (const sibling of inertedSiblings) sibling.inert = false;
      const target = restoreFocusRef.current;
      if (target?.isConnected) window.requestAnimationFrame(() => target.focus());
    };
  }, [open, runtimeMode]);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !busy) { event.preventDefault(); onDismiss?.(); return; }
    if (event.key !== "Tab") return;
    const focusable = Array.from(stageRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])") || []);
    if (!focusable.length) { event.preventDefault(); headingRef.current?.focus(); return; }
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function selectCampaign(index: number) {
    onSelect?.(index);
    if (window.matchMedia("(max-width: 900px)").matches) requestAnimationFrame(() => stageRef.current?.querySelector<HTMLElement>("[data-testid='campaign-front-door-dossier']")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  if (runtimeMode === "static-demo") {
    return (
      <section className={styles.preview} data-testid="campaign-front-door" aria-label={t("front.aria.preview")}>
        <div className={styles.previewHeader}><span>{cn ? "小镇十二卷" : "Twelve town dossiers"}</span><b>{cn ? "系列案件预览" : "Campaign preview"}</b></div>
        <div className={styles.previewBoundary}>{cn ? "先看看这座小镇还有哪些故事。回到完整游戏即可选择路线并开始调查。" : "Explore the town's stories. Return to the full game to choose a route and begin."}</div>
        {groups.map((group) => <section key={group.volumeId} className={styles.previewVolume} aria-labelledby={`preview-volume-${group.volumeId}`}>
          <h3 id={`preview-volume-${group.volumeId}`}>{t(volumeMessageKey(group.volumeId))}</h3>
          <div className={styles.previewSpine}>{group.cards.map((card) => <CampaignSpine key={card.label} card={card} ordinal={cards.indexOf(card) + 1} selected={false} />)}</div>
        </section>)}
      </section>
    );
  }
  if (!open) return null;
  const selected = cards[selectedIndex] || cards[0];
  const selectedOrdinal = Math.max(0, cards.indexOf(selected)) + 1;
  return (
    <section className={styles.backdrop} data-testid="campaign-front-door">
      <div ref={stageRef} className={styles.stage} role="dialog" aria-modal="true" aria-labelledby="campaign-front-door-title" aria-describedby="campaign-front-door-description" onKeyDown={handleDialogKeyDown}>
        <header className={styles.archiveHeader}>
          <div className={styles.archiveBrand}><span className={styles.brandMark} aria-hidden="true">D<span>T</span></span><div><span className={styles.eyebrow}>DETECTIVE TOWN</span><h2 id="campaign-front-door-title" ref={headingRef} tabIndex={-1}>{cn ? "小镇疑云" : "The town dossiers"}</h2></div></div>
          <p id="campaign-front-door-description">{cn ? "十二卷往事，二十四条寻真之路。" : "Twelve stories. Twenty-four paths to the truth."}</p>
          <div className={styles.headerTools}>
            <button type="button" className={styles.localeSwitch} data-testid="campaign-front-door-locale" onClick={() => setLocale(cn ? "en-US" : "zh-CN")} aria-label={cn ? "切换到英文" : "Switch to Chinese"}>{cn ? "EN" : "中文"}</button>
            <button type="button" className={styles.close} data-testid="campaign-front-door-dismiss" onClick={onDismiss} disabled={busy} aria-label={cn ? "返回调查" : "Return to investigation"}>×</button>
          </div>
        </header>
        <div className={styles.archiveLayout}>
          <nav className={styles.archiveIndex} aria-label={t("front.archive.index")}>
            {groups.map((group) => <section key={group.volumeId} className={styles.volumeGroup}>
              <h3>{t(volumeMessageKey(group.volumeId))}</h3>
              <div className={styles.spineList}>{group.cards.map((card) => <CampaignSpine key={card.label} card={card} ordinal={cards.indexOf(card) + 1} selected={card === selected} onSelect={() => selectCampaign(cards.indexOf(card))} disabled={busy} />)}</div>
            </section>)}
          </nav>
          {selected && <CampaignDossier card={selected} ordinal={selectedOrdinal} selectedRouteIndex={selectedRouteIndex} onSelectRoute={onSelectRoute} busy={busy} />}
        </div>
        <footer>
          <div className={styles.selectionSummary}><span>{cn ? "即将展开的调查" : "Your next investigation"}</span><b>{selected ? `${text(selected.label)} · ${text(selected.routes[selectedRouteIndex]?.label || selected.routes[0].label)}` : t("front.campaignUnavailable")}</b><small role="status" aria-live="polite">{busy ? (cn ? "档案正在展开，请稍候…" : "Opening the dossier…") : /fail|error|invalid|unavailable|not available|无法|失败|无效|不可用/i.test(status) ? (cn ? "暂时无法打开这份档案。请重试或返回调查。" : "This dossier could not be opened. Try again or return to your investigation.") : ""}</small></div>
          <div className={styles.actions}>
            {canContinue ? <button type="button" data-testid="campaign-front-door-continue" onClick={onContinue} disabled={busy}>{cn ? "继续上次调查" : "Continue investigation"}</button> : null}
            <button type="button" className={styles.primary} data-testid="campaign-front-door-start" data-campaign-primary="true" onClick={onStart} disabled={busy || !selected}>{busy ? (cn ? "正在启程…" : "Preparing…") : (cn ? "开始调查" : "Begin investigation")}<span aria-hidden="true">↗</span></button>
          </div>
        </footer>
      </div>
    </section>
  );
}
