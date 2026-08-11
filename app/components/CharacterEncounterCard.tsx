"use client";

import {
  AlertTriangle,
  Check,
  Clock3,
  Eye,
  MessageSquare,
  Minus,
  Shield,
  Sparkles,
  X
} from "lucide-react";
import type { ComponentType } from "react";
import type {
  CharacterEncounterPosture,
  CharacterEncounterViewModel
} from "@/app/campaign/character-encounter-model";
import type { SafeContextActionKind } from "@/app/campaign/context-action-resolver";
import { useAppLocale } from "@/app/localization/locale-context";
import styles from "./CharacterEncounterCard.module.css";

const POSTURE_ICON: Record<CharacterEncounterPosture, ComponentType<{ size?: number; "aria-hidden"?: boolean }>> = {
  supportive: Sparkles,
  guarded: Shield,
  busy: Clock3,
  avoidant: AlertTriangle,
  routine: Minus
};

const ACTION_ICON: Partial<Record<SafeContextActionKind, ComponentType<{ size?: number; "aria-hidden"?: boolean }>>> = {
  observe: Eye,
  question: MessageSquare,
  challenge: Shield,
  review: Check
};

export function CharacterEncounterCard({
  encounter,
  onAction,
  onDismiss
}: {
  encounter: CharacterEncounterViewModel;
  onAction: (kind: SafeContextActionKind) => void;
  onDismiss: () => void;
}) {
  const { t, text } = useAppLocale();
  const PostureIcon = POSTURE_ICON[encounter.posture];
  return (
    <aside
      className={styles.card}
      data-testid="character-encounter"
      data-posture={encounter.posture}
      data-availability={encounter.availability}
      aria-label={t("encounter.aria", { actor: text(encounter.actorName) })}
    >
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.eyebrow}>{t("encounter.title")}</span>
          <strong>{text(encounter.actorName)}</strong>
          <p>{text(encounter.roleLabel)} · {text(encounter.locationLabel)}</p>
        </div>
        <button type="button" className={styles.dismiss} data-testid="character-encounter-close" onClick={onDismiss} aria-label={t("encounter.close")}>
          <X size={17} aria-hidden />
        </button>
      </header>

      <section className={styles.posture} aria-label={t("encounter.postureAria", { posture: text(encounter.postureLabel) })}>
        <span className={styles.postureIcon}><PostureIcon size={16} aria-hidden /></span>
        <div>
          <b>{text(encounter.postureLabel)}</b>
          <p>{text(encounter.postureDetail)}</p>
        </div>
        <em>{text(encounter.availabilityLabel)}</em>
      </section>

      <dl className={styles.publicContext}>
        <div>
          <dt>{t("encounter.publicStanding")}</dt>
          <dd><b>{text(encounter.factionLabel)}</b><span>{text(encounter.factionStandingLabel)}</span></dd>
        </div>
        <div>
          <dt>{t("encounter.caseContact")}</dt>
          <dd>{text(encounter.progressLabel)}</dd>
        </div>
      </dl>

      {encounter.latestReaction && (
        <div className={styles.reaction} data-testid="character-encounter-reaction">
          <span>{t("encounter.latestReaction")}</span>
          <p>{text(encounter.latestReaction)}</p>
        </div>
      )}

      <div className={styles.nextAction}>
        <span>{t("encounter.nextAction")}</span>
        <p>{text(encounter.nextAction)}</p>
      </div>

      {encounter.actions.length > 0 && (
        <div className={styles.actions} aria-label={t("encounter.actionsAria")}>
          {encounter.actions.map((action) => {
            const ActionIcon = ACTION_ICON[action.kind] || Eye;
            return (
              <button
                key={action.kind}
                type="button"
                className={action.primary ? styles.primary : undefined}
                data-encounter-action={action.kind}
                disabled={!action.enabled}
                title={text(action.enabled ? action.detail : action.disabledReason || action.detail)}
                onClick={() => onAction(action.kind)}
              >
                <ActionIcon size={15} aria-hidden />
                <span><b>{text(action.label)}</b><small>{text(action.detail)}</small></span>
                {action.shortcut && <kbd>{action.shortcut}</kbd>}
              </button>
            );
          })}
        </div>
      )}

      <small className={styles.boundary}>{text(encounter.boundaryLabel)}</small>
    </aside>
  );
}
