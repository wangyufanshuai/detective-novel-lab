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
  const PostureIcon = POSTURE_ICON[encounter.posture];
  return (
    <aside
      className={styles.card}
      data-testid="character-encounter"
      data-posture={encounter.posture}
      data-availability={encounter.availability}
      aria-label={`Character encounter with ${encounter.actorName}`}
    >
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.eyebrow}>Character encounter</span>
          <strong>{encounter.actorName}</strong>
          <p>{encounter.roleLabel} · {encounter.locationLabel}</p>
        </div>
        <button type="button" className={styles.dismiss} onClick={onDismiss} aria-label="Close character encounter">
          <X size={17} aria-hidden />
        </button>
      </header>

      <section className={styles.posture} aria-label={`Public posture: ${encounter.postureLabel}`}>
        <span className={styles.postureIcon}><PostureIcon size={16} aria-hidden /></span>
        <div>
          <b>{encounter.postureLabel}</b>
          <p>{encounter.postureDetail}</p>
        </div>
        <em>{encounter.availabilityLabel}</em>
      </section>

      <dl className={styles.publicContext}>
        <div>
          <dt>Public standing</dt>
          <dd><b>{encounter.factionLabel}</b><span>{encounter.factionStandingLabel}</span></dd>
        </div>
        <div>
          <dt>Case contact</dt>
          <dd>{encounter.progressLabel}</dd>
        </div>
      </dl>

      {encounter.latestReaction && (
        <div className={styles.reaction} data-testid="character-encounter-reaction">
          <span>Latest town reaction</span>
          <p>{encounter.latestReaction}</p>
        </div>
      )}

      <div className={styles.nextAction}>
        <span>Next legal action</span>
        <p>{encounter.nextAction}</p>
      </div>

      {encounter.actions.length > 0 && (
        <div className={styles.actions} aria-label="Character encounter actions">
          {encounter.actions.map((action) => {
            const ActionIcon = ACTION_ICON[action.kind] || Eye;
            return (
              <button
                key={action.kind}
                type="button"
                className={action.primary ? styles.primary : undefined}
                data-encounter-action={action.kind}
                disabled={!action.enabled}
                title={action.enabled ? action.detail : action.disabledReason}
                onClick={() => onAction(action.kind)}
              >
                <ActionIcon size={15} aria-hidden />
                <span><b>{action.label}</b><small>{action.detail}</small></span>
                {action.shortcut && <kbd>{action.shortcut}</kbd>}
              </button>
            );
          })}
        </div>
      )}

      <small className={styles.boundary}>{encounter.boundaryLabel}</small>
    </aside>
  );
}
