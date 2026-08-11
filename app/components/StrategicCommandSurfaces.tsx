"use client";

import { memo, type RefObject } from "react";
import type {
  StrategicCommandAction,
  StrategicCommandViewModel,
  StrategicResourceRibbonItem
} from "@/app/campaign/strategic-command-model";
import type { StrategicPacingViewModel } from "@/app/campaign/strategic-pacing-model";
import { useAppLocale } from "@/app/localization/locale-context";
import styles from "./StrategicCommandSurfaces.module.css";

function ResourceItem({ item, core }: { item: StrategicResourceRibbonItem; core: boolean }) {
  const { text } = useAppLocale();
  return (
    <details
      className={styles.resourceItem}
      data-resource-kind={item.kind}
      data-resource-tone={item.tone}
      data-resource-core={core ? "true" : "false"}
    >
      <summary>
        <small>{text(item.label)}</small>
        <b>{text(item.value)}</b>
        <span>{text(item.trend)}</span>
      </summary>
      <p>{text(item.detail)}</p>
    </details>
  );
}

export const StrategicResourceRibbon = memo(function StrategicResourceRibbon({ items, panelOpen, onPanelToggle, triggerRef }: {
  items: StrategicResourceRibbonItem[];
  panelOpen: boolean;
  onPanelToggle: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const { number, t, text } = useAppLocale();
  return (
    <nav className={styles.resourceRibbon} data-testid="strategic-resource-ribbon" aria-label={t("command.resourcesAria")}>
      {items.map((item, index) => <ResourceItem key={item.kind} item={item} core={index < 4} />)}
      <button
        ref={triggerRef}
        type="button"
        className={styles.allResourcesToggle}
        data-testid="strategic-all-resources-toggle"
        aria-expanded={panelOpen}
        aria-controls="strategic-all-resources"
        onClick={onPanelToggle}
      >
        <span>{t("command.resources")}</span><b>{number(items.length)}</b>
      </button>
      <section
        id="strategic-all-resources"
        className={`${styles.resourceSheet} ${panelOpen ? styles.panelOpen : ""}`}
        data-testid="strategic-resource-sheet"
        aria-label={t("command.resourcesAllAria")}
        aria-hidden={!panelOpen}
      >
        <header><span>{t("command.resources")}</span><button type="button" onClick={onPanelToggle}>{t("common.close")}</button></header>
        <div>
          {items.map((item) => (
            <article key={item.kind} data-resource-tone={item.tone}>
              <span><small>{text(item.label)}</small><b>{text(item.value)}</b></span>
              <strong>{text(item.trend)}</strong>
              <p>{text(item.detail)}</p>
            </article>
          ))}
        </div>
      </section>
    </nav>
  );
});

function QueueGroup({ label, actions, primary, offset, activeIndex, onActiveIndexChange, onNavigate }: {
  label: "Now" | "Soon" | "Later";
  actions: StrategicCommandAction[];
  primary?: StrategicCommandAction;
  offset: number;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onNavigate: (delta: number) => void;
}) {
  const { number, t, text } = useAppLocale();
  const groupLabel = t(`command.queue.${label.toLowerCase()}` as "command.queue.now" | "command.queue.soon" | "command.queue.later");
  if (!actions.length) return null;
  return (
    <section className={styles.queueGroup} data-queue-group={label.toLowerCase()}>
      <h3>{groupLabel}<span>{number(actions.length)}</span></h3>
      <ol>
        {actions.map((decision, localIndex) => {
          const index = offset + localIndex;
          return (
            <li
              key={`${decision.kind}:${decision.target}:${decision.contextActionKind || "none"}`}
              data-decision-kind={decision.kind}
              data-decision-primary={decision.kind === primary?.kind ? "true" : undefined}
              data-decision-enabled={decision.enabled ? "true" : "false"}
            >
              <button
                type="button"
                data-queue-entry
                data-queue-index={index}
                tabIndex={index === activeIndex ? 0 : -1}
                aria-current={decision.kind === primary?.kind ? "step" : undefined}
                onFocus={() => onActiveIndexChange(index)}
                onClick={() => onActiveIndexChange(index)}
                onKeyDown={(event) => {
                  if (event.key === "j" || event.key === "J" || event.key === "]") {
                    event.preventDefault();
                    event.stopPropagation();
                    onNavigate(1);
                  } else if (event.key === "k" || event.key === "K" || event.key === "[") {
                    event.preventDefault();
                    event.stopPropagation();
                    onNavigate(-1);
                  }
                }}
              >
                <span aria-hidden="true">{decision.priority}</span>
                <div><strong>{text(decision.label)}</strong><small>{text(decision.disabledReason || decision.detail)}</small></div>
                <b>{decision.kind === primary?.kind ? t("command.queue.current") : decision.enabled ? t("command.queue.ready") : t("command.queue.held")}</b>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export const StrategicDecisionQueue = memo(function StrategicDecisionQueue({ command, pacing, panelOpen, onPanelToggle, triggerRef, activeIndex, onActiveIndexChange, onNavigate }: {
  command: StrategicCommandViewModel;
  pacing: StrategicPacingViewModel;
  panelOpen: boolean;
  onPanelToggle: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onNavigate: (delta: number) => void;
}) {
  const { number, t } = useAppLocale();
  const count = pacing.queueGroups.now.length + pacing.queueGroups.soon.length + pacing.queueGroups.later.length;
  const queueState = command.runtimeMode === "static-demo" ? "readonly" : count ? "active" : "empty";
  return (
    <section className={`${styles.decisionQueue} ${panelOpen ? styles.panelOpen : ""}`} data-testid="strategic-decision-queue" data-queue-state={queueState}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.queueToggle}
        data-testid="strategic-queue-toggle"
        aria-expanded={panelOpen}
        aria-controls="strategic-queue-body"
        onClick={onPanelToggle}
      >
        <span>{t("command.queue")}</span><strong>{command.runtimeMode === "static-demo" ? t("command.serverOnly") : `${number(count)} ${t("command.queue.open")}`}</strong><b>{panelOpen ? t("common.close") : t("common.open")}</b>
      </button>
      <div id="strategic-queue-body" className={styles.queueBody}>
        <div className={styles.sectionHeading}><span>{t("command.queue")}</span><b>{command.runtimeMode === "static-demo" ? t("command.serverOnly") : `${number(count)} ${t("command.queue.open")}`}</b></div>
        {command.runtimeMode === "static-demo" ? (
          <p>{t("command.queue.readonly")}</p>
        ) : count ? (
          <>
            <QueueGroup label="Now" actions={pacing.queueGroups.now} primary={pacing.primaryAction} offset={0} activeIndex={activeIndex} onActiveIndexChange={onActiveIndexChange} onNavigate={onNavigate} />
            <QueueGroup label="Soon" actions={pacing.queueGroups.soon} primary={pacing.primaryAction} offset={pacing.queueGroups.now.length} activeIndex={activeIndex} onActiveIndexChange={onActiveIndexChange} onNavigate={onNavigate} />
            <QueueGroup label="Later" actions={pacing.queueGroups.later} primary={pacing.primaryAction} offset={pacing.queueGroups.now.length + pacing.queueGroups.soon.length} activeIndex={activeIndex} onActiveIndexChange={onActiveIndexChange} onNavigate={onNavigate} />
          </>
        ) : <p>{t("command.noDecision")}</p>}
      </div>
    </section>
  );
});

function ActionButton({ action, primary, resolving, onAction }: {
  action: StrategicCommandAction;
  primary?: boolean;
  resolving: boolean;
  onAction?: (action: StrategicCommandAction) => void | Promise<void>;
}) {
  const { t, text } = useAppLocale();
  return (
    <button
      type="button"
      className={primary ? styles.primaryAction : styles.secondaryAction}
      data-testid={primary ? "strategic-primary-action" : "strategic-secondary-action"}
      data-strategic-command-kind={action.kind}
      data-command-deck-primary={primary ? "true" : undefined}
      disabled={!action.enabled || !onAction || resolving}
      aria-busy={primary && resolving ? "true" : undefined}
      aria-keyshortcuts={primary ? "Enter Space" : undefined}
      title={text(action.disabledReason || action.detail)}
      onClick={() => void onAction?.(action)}
    >
      <span>{primary ? resolving ? t("common.resolving") : `02 / ${t("command.currentAction")}` : `P${action.priority}`}</span>
      <strong>{text(action.label)}</strong>
      <small>{text(action.disabledReason || action.detail)}</small>
    </button>
  );
}

export const StrategicActionBar = memo(function StrategicActionBar({ command, pacing, compact = false, onAction }: {
  command: StrategicCommandViewModel;
  pacing: StrategicPacingViewModel;
  compact?: boolean;
  onAction?: (action: StrategicCommandAction) => void | Promise<void>;
}) {
  const { t, text } = useAppLocale();
  const primary = pacing.primaryAction;
  const secondary = pacing.secondaryActions;
  const advanceAction = pacing.advanceState.action;
  const advanceAlreadyVisible = Boolean(advanceAction && (primary?.kind === advanceAction.kind || secondary.some((item) => item.kind === advanceAction.kind)));
  const resolving = pacing.actionLifecycle?.state === "resolving" || command.presentationFeedback.state === "resolving";
  return (
    <footer
      className={`${styles.actionBar} ${compact ? styles.compact : ""}`}
      data-testid="strategic-action-bar"
      data-command-brief-layer="action"
      data-command-placement={compact ? "agenda" : "footer"}
      data-advance-state={pacing.advanceState.state}
      data-action-lifecycle={pacing.actionLifecycle?.state || "idle"}
      data-pacing-phase={pacing.phase}
    >
      <section className={styles.actionContext} aria-label={t("command.actionForecast")}>
        <span><small>{t("command.benefit")}</small><b>{text(pacing.safeForecast.immediateBenefit)}</b></span>
        <span><small>{t("command.costBoundary")}</small><b>{text(pacing.safeForecast.visibleCost)}</b></span>
      </section>
      <div className={styles.actionButtons} aria-label={t("command.commands")}>
        <div className={styles.secondaryActions}>
          {secondary.map((action) => <ActionButton key={action.kind} action={action} resolving={resolving} onAction={onAction} />)}
          {!advanceAlreadyVisible && advanceAction && !advanceAction.enabled ? <ActionButton action={advanceAction} resolving={resolving} onAction={onAction} /> : null}
        </div>
        {primary
          ? <ActionButton action={primary} primary resolving={resolving} onAction={onAction} />
          : <div className={styles.readonlyAction}><span>02 / {t("command.currentAction")}</span><strong>{text(pacing.advanceState.label)}</strong><small>{text(pacing.advanceState.detail)}</small></div>}
      </div>
    </footer>
  );
});
