"use client";

import type { CampaignFrontDoorCard } from "@/app/campaign/campaign-front-door-model";
import { useAppLocale } from "@/app/localization/locale-context";
import styles from "./CampaignFrontDoor.module.css";

type VolumeId = CampaignFrontDoorCard["volumeId"];

const VOLUME_ORDER: readonly VolumeId[] = ["public-records", "moving-city", "midnight-signals"];

export function volumeMessageKey(volumeId: VolumeId) {
  return volumeId === "public-records" ? "front.volume.public" : volumeId === "moving-city" ? "front.volume.moving" : "front.volume.midnight";
}

export function groupCampaignsByVolume(cards: CampaignFrontDoorCard[]) {
  return VOLUME_ORDER.map((volumeId) => ({ volumeId, cards: cards.filter((card) => card.volumeId === volumeId) }));
}

export function CampaignSpine({ card, ordinal, selected, onSelect, disabled = false }: {
  card: CampaignFrontDoorCard;
  ordinal: number;
  selected: boolean;
  onSelect?: () => void;
  disabled?: boolean;
}) {
  const { number, text, t } = useAppLocale();
  const content = <>
    <span className={styles.spineOrdinal}>{number(ordinal).padStart(2, "0")}</span>
    <span className={styles.spineCopy}><b>{text(card.label)}</b><small>{text(card.districtLabel)}</small>{!onSelect && <small className={styles.spineRoutes}>{card.routes.map((route) => text(route.label)).join(" / ")}</small>}</span>
    <span className={styles.spineMark} aria-hidden="true">{selected ? "◆" : "·"}</span>
  </>;
  if (!onSelect) return <article className={styles.spineItem} data-testid="campaign-front-door-card">{content}</article>;
  return <button type="button" className={`${styles.spineItem} ${selected ? styles.spineSelected : ""}`} data-testid="campaign-front-door-card" aria-pressed={selected} onClick={onSelect} disabled={disabled} aria-label={`${t("front.archive.open")}: ${text(card.label)}`}>{content}</button>;
}

export function CampaignDossier({ card, ordinal, selectedRouteIndex, onSelectRoute, busy }: {
  card: CampaignFrontDoorCard;
  ordinal: number;
  selectedRouteIndex: number;
  onSelectRoute?: (index: number) => void;
  busy: boolean;
}) {
  const { number, text, locale } = useAppLocale();
  const cn = locale === "zh-CN";
  const route = card.routes[selectedRouteIndex] || card.routes[0];
  return <article className={styles.dossier} data-testid="campaign-front-door-dossier">
    <div key={card.presentationKey} className={styles.dossierAtmosphere} data-ready={card.coverReady ? "true" : "false"} style={card.coverPath ? { backgroundImage: `url(${card.coverPath})` } : undefined} aria-hidden="true" />
    <div className={styles.dossierTop}><span>{number(ordinal).padStart(2, "0")} / 12</span><span>{text(card.districtLabel)}</span></div>
    <div className={styles.dossierContent}>
      <div className={styles.dossierHeader}>
        <span className={styles.eyebrow}>{text(card.volumeLabel)} <span aria-hidden="true">—</span> {cn ? "三案一卷" : "Three connected cases"}</span>
        <h3>{text(card.label)}</h3>
        <p className={styles.theme}>{text(card.investigationTheme)}</p>
      </div>
      <div className={styles.routeChoice} data-testid="campaign-front-door-route-choice">
        <p className={styles.routeIntro}>{cn ? "选择调查路线" : "Choose your approach"}</p>
        <div className={styles.routeButtons} role="group" aria-label={`${text(card.label)} ${cn ? "调查路线" : "investigation route"}`}>
          {card.routes.map((routeOption, index) => <button type="button" key={routeOption.label} data-testid="campaign-front-door-route" aria-pressed={index === (card.routes[selectedRouteIndex] ? selectedRouteIndex : 0)} onClick={() => onSelectRoute?.(index)} disabled={busy}><span className={styles.routeNumber}>{index === 0 ? "I" : "II"}</span><span><b>{text(routeOption.label)}</b><small>{text(routeOption.chapterLabels[0])} <span aria-hidden="true">→</span> {text(routeOption.finaleLabel)}</small></span><span className={styles.routeCheck} aria-hidden="true">{index === (card.routes[selectedRouteIndex] ? selectedRouteIndex : 0) ? "●" : "○"}</span></button>)}
        </div>
      </div>
      <details className={styles.chapterDetails}>
        <summary>{cn ? "本卷三案" : "Inside this dossier"}<span aria-hidden="true">＋</span></summary>
        <ol className={styles.chapterRail} aria-label={`${text(card.label)} ${text(route.label)}`}>
          {route.chapterLabels.map((chapter, index) => <li key={chapter}><span>{number(index + 1).padStart(2, "0")}</span><b>{text(chapter)}</b></li>)}
        </ol>
      </details>
    </div>
  </article>;
}
