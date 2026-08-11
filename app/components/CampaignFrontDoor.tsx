"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import type { CampaignFrontDoorCard } from "@/app/campaign/campaign-front-door-model";
import { useAppLocale } from "@/app/localization/locale-context";
import styles from "./CampaignFrontDoor.module.css";

function CampaignCard({ card, ordinal, selected, selectedRouteIndex, interactive, onSelect }: {
  card: CampaignFrontDoorCard;
  ordinal: number;
  selected: boolean;
  selectedRouteIndex: number;
  interactive: boolean;
  onSelect?: () => void;
}) {
  const { number, t, text } = useAppLocale();
  const route = card.routes[selectedRouteIndex] || card.routes[0];
  const content = (
    <>
      <div className={styles.cardTopline}><span>{t("front.campaign", { ordinal: number(ordinal) })}</span><b>{selected ? t("common.selected") : t("front.routes.count")}</b></div>
      <h3>{text(card.label)}</h3>
      <p className={styles.theme}>{text(card.investigationTheme)}</p>
      <div className={styles.routeRail} aria-label={`${text(card.label)} ${t("front.authoredRoute")}`}>
        {card.routes.map((item, index) => <span key={item.label} data-active={index === selectedRouteIndex}><b>{text(item.label)}</b><small>{index === 0 ? t("front.route.original") : t("front.route.counter")}</small></span>)}
      </div>
      <dl>
        <div><dt>{t("front.publicSurface")}</dt><dd>{text(route.primarySurfaceLabel)}</dd></div>
        <div><dt>{t("front.evidenceStyle")}</dt><dd>{text(route.evidenceStyleLabel)}</dd></div>
        <div><dt>{t("front.worldPressure")}</dt><dd>{text(route.pressureLabel)}</dd></div>
      </dl>
      <ol className={styles.chapterRail} aria-label={`${text(card.label)} ${text(route.label)} ${t("front.authoredRoute")}`}>
        {route.chapterLabels.map((chapter, index) => <li key={chapter}><span>{number(index + 1)}</span><b>{text(chapter)}</b></li>)}
      </ol>
      <div className={styles.finale}><span>{t("front.finale")}</span><strong>{text(route.finaleLabel)}</strong></div>
      <small>{text(route.replayContrast)}</small>
    </>
  );
  if (!interactive) return <article className={styles.card} data-testid="campaign-front-door-card">{content}</article>;
  return (
    <button
      type="button"
      className={`${styles.card} ${styles.cardButton} ${selected ? styles.selected : ""}`}
      data-testid="campaign-front-door-card"
      aria-pressed={selected}
      onClick={onSelect}
    >
      {content}
    </button>
  );
}

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
  const routeChoiceRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const { t, text } = useAppLocale();

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
    if (event.key === "Escape" && !busy) {
      event.preventDefault();
      onDismiss?.();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(stageRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])") || []);
    if (!focusable.length) {
      event.preventDefault();
      headingRef.current?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function selectCampaign(index: number) {
    onSelect?.(index);
    if (window.matchMedia("(max-width: 900px)").matches) requestAnimationFrame(() => routeChoiceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  if (runtimeMode === "static-demo") {
    return (
      <section className={styles.preview} data-testid="campaign-front-door" aria-label={t("front.aria.preview")}>
        <div className={styles.previewHeader}><span>{t("front.preview.label")}</span><b>{t("front.preview.boundary")}</b></div>
        <div className={styles.previewBoundary}>{t("front.preview.detail")}</div>
        <div className={styles.cards}>
          {cards.map((card, index) => <CampaignCard key={card.label} card={card} ordinal={index + 1} selected={false} selectedRouteIndex={0} interactive={false} />)}
        </div>
      </section>
    );
  }
  if (!open) return null;
  const selected = cards[selectedIndex] || cards[0];
  const selectedRoute = selected?.routes[selectedRouteIndex] || selected?.routes[0];
  return (
    <section className={styles.backdrop} data-testid="campaign-front-door">
      <div ref={stageRef} className={styles.stage} role="dialog" aria-modal="true" aria-labelledby="campaign-front-door-title" aria-describedby="campaign-front-door-description" onKeyDown={handleDialogKeyDown}>
        <header>
          <div><span className={styles.eyebrow}>{t("front.desk")}</span><h2 id="campaign-front-door-title" ref={headingRef} tabIndex={-1}>{t("front.title")}</h2></div>
          <p id="campaign-front-door-description">{t("front.detail")}</p>
        </header>
        <div className={styles.cards}>
          {cards.map((card, index) => (
            <CampaignCard key={card.label} card={card} ordinal={index + 1} selected={index === selectedIndex} selectedRouteIndex={index === selectedIndex ? selectedRouteIndex : 0} interactive onSelect={() => selectCampaign(index)} />
          ))}
        </div>
        {selected && <div ref={routeChoiceRef} className={styles.routeChoice} data-testid="campaign-front-door-route-choice">
          <div><span>{t("front.authoredRoute")}</span><b>{selectedRoute ? text(selectedRoute.label) : t("front.routeUnavailable")}</b><small>{selectedRoute ? text(selectedRoute.strategyLabel) : ""}</small></div>
          <div role="group" aria-label={`${text(selected.label)} ${t("front.authoredRoute")}`}>
            {selected.routes.map((route, index) => <button type="button" key={route.label} data-testid="campaign-front-door-route" aria-pressed={index === selectedRouteIndex} onClick={() => onSelectRoute?.(index)} disabled={busy}><b>{text(route.label)}</b><small>{index === 0 ? t("front.route.original.long") : t("front.route.counter.long")}</small></button>)}
          </div>
        </div>}
        <footer>
          <div className={styles.selectionSummary}><span>{t("front.selection")}</span><b>{selected && selectedRoute ? `${text(selected.label)} / ${text(selectedRoute.label)}` : t("front.campaignUnavailable")}</b><small role="status" aria-live="polite">{text(status)}</small></div>
          <div className={styles.actions}>
            {canContinue ? <button type="button" data-testid="campaign-front-door-continue" onClick={onContinue} disabled={busy}>{t("front.continueSaved")}</button> : null}
            <button type="button" data-testid="campaign-front-door-dismiss" onClick={onDismiss} disabled={busy}>{t("front.returnMap")}</button>
            <button type="button" className={styles.primary} data-testid="campaign-front-door-start" data-campaign-primary="true" onClick={onStart} disabled={busy || !selected || !selectedRoute}>{busy ? t("front.preparing") : t("front.start")}</button>
          </div>
        </footer>
      </div>
    </section>
  );
}
