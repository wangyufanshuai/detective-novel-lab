"use client";

import { useRef } from "react";
import type { CampaignFrontDoorCard } from "@/app/campaign/campaign-front-door-model";
import styles from "./CampaignFrontDoor.module.css";

function CampaignCard({ card, ordinal, selected, selectedRouteIndex, interactive, onSelect }: {
  card: CampaignFrontDoorCard;
  ordinal: number;
  selected: boolean;
  selectedRouteIndex: number;
  interactive: boolean;
  onSelect?: () => void;
}) {
  const route = card.routes[selectedRouteIndex] || card.routes[0];
  const content = (
    <>
      <div className={styles.cardTopline}><span>Campaign {ordinal}</span><b>{selected ? "Selected" : "Two routes"}</b></div>
      <h3>{card.label}</h3>
      <p className={styles.theme}>{card.investigationTheme}</p>
      <div className={styles.routeRail} aria-label={`${card.label} authored routes`}>
        {card.routes.map((item, index) => <span key={item.label} data-active={index === selectedRouteIndex}><b>{item.label}</b><small>{index === 0 ? "Original route" : "Counter route"}</small></span>)}
      </div>
      <dl>
        <div><dt>Public surface</dt><dd>{route.primarySurfaceLabel}</dd></div>
        <div><dt>Evidence style</dt><dd>{route.evidenceStyleLabel}</dd></div>
        <div><dt>World pressure</dt><dd>{route.pressureLabel}</dd></div>
      </dl>
      <ol className={styles.chapterRail} aria-label={`${card.label} ${route.label} chapter structure`}>
        {route.chapterLabels.map((chapter, index) => <li key={chapter}><span>{index + 1}</span><b>{chapter}</b></li>)}
      </ol>
      <div className={styles.finale}><span>Finale</span><strong>{route.finaleLabel}</strong></div>
      <small>{route.replayContrast}</small>
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
  function selectCampaign(index: number) {
    onSelect?.(index);
    if (window.matchMedia("(max-width: 900px)").matches) requestAnimationFrame(() => routeChoiceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  if (runtimeMode === "static-demo") {
    return (
      <section className={styles.preview} data-testid="campaign-front-door" aria-label="Three read-only Campaign previews">
        <div className={styles.previewHeader}><span>Three Campaign previews</span><b>Server-only route choice / start / continue</b></div>
        <div className={styles.previewBoundary}>Static keeps both authored routes read-only. It does not select a route, persist a choice, or request `/api/*`.</div>
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
    <section className={styles.backdrop} data-testid="campaign-front-door" aria-label="Campaign front door">
      <div className={styles.stage}>
        <header>
          <div><span className={styles.eyebrow}>Detective Town / Campaign Desk</span><h2>Choose the pressure and authored route for your next three cases</h2></div>
          <p>Every route uses the same certified investigation authority. Your choice changes authored context, case-family preference, and replay contrast, never an extracted case truth.</p>
        </header>
        <div className={styles.cards}>
          {cards.map((card, index) => (
            <CampaignCard key={card.label} card={card} ordinal={index + 1} selected={index === selectedIndex} selectedRouteIndex={index === selectedIndex ? selectedRouteIndex : 0} interactive onSelect={() => selectCampaign(index)} />
          ))}
        </div>
        {selected && <div ref={routeChoiceRef} className={styles.routeChoice} data-testid="campaign-front-door-route-choice">
          <div><span>Authored route</span><b>{selectedRoute?.label || "Route unavailable"}</b><small>{selectedRoute?.strategyLabel}</small></div>
          <div role="group" aria-label={`${selected.label} route choice`}>
            {selected.routes.map((route, index) => <button type="button" key={route.label} data-testid="campaign-front-door-route" aria-pressed={index === selectedRouteIndex} onClick={() => onSelectRoute?.(index)} disabled={busy}><b>{route.label}</b><small>{index === 0 ? "Original three-case route" : "Counter-route replay"}</small></button>)}
          </div>
        </div>}
        <footer>
          <div className={styles.selectionSummary}><span>Selected campaign / route</span><b>{selected && selectedRoute ? `${selected.label} / ${selectedRoute.label}` : "Campaign unavailable"}</b><small role="status" aria-live="polite">{status}</small></div>
          <div className={styles.actions}>
            {canContinue ? <button type="button" data-testid="campaign-front-door-continue" onClick={onContinue} disabled={busy}>Continue saved Campaign</button> : null}
            <button type="button" data-testid="campaign-front-door-dismiss" onClick={onDismiss} disabled={busy}>Return to current map</button>
            <button type="button" className={styles.primary} data-testid="campaign-front-door-start" data-campaign-primary="true" onClick={onStart} disabled={busy || !selected || !selectedRoute}>{busy ? "Preparing campaign…" : "Start selected Campaign"}</button>
          </div>
        </footer>
      </div>
    </section>
  );
}
