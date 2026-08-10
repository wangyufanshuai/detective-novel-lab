import { memo, type RefObject } from "react";
import type {
  StrategicCommandAction,
  StrategicCommandViewModel,
  StrategicResourceRibbonItem
} from "@/app/campaign/strategic-command-model";
import type { StrategicPacingViewModel } from "@/app/campaign/strategic-pacing-model";
import styles from "./StrategicCommandSurfaces.module.css";

function ResourceItem({ item, core }: { item: StrategicResourceRibbonItem; core: boolean }) {
  return (
    <details
      className={styles.resourceItem}
      data-resource-kind={item.kind}
      data-resource-tone={item.tone}
      data-resource-core={core ? "true" : "false"}
    >
      <summary>
        <small>{item.label}</small>
        <b>{item.value}</b>
        <span>{item.trend}</span>
      </summary>
      <p>{item.detail}</p>
    </details>
  );
}

export const StrategicResourceRibbon = memo(function StrategicResourceRibbon({ items, panelOpen, onPanelToggle, triggerRef }: {
  items: StrategicResourceRibbonItem[];
  panelOpen: boolean;
  onPanelToggle: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <nav className={styles.resourceRibbon} data-testid="strategic-resource-ribbon" aria-label="Strategic resources">
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
        <span>All Resources</span><b>{items.length}</b>
      </button>
      <section
        id="strategic-all-resources"
        className={`${styles.resourceSheet} ${panelOpen ? styles.panelOpen : ""}`}
        data-testid="strategic-resource-sheet"
        aria-label="All strategic resources"
        aria-hidden={!panelOpen}
      >
        <header><span>All Resources</span><button type="button" onClick={onPanelToggle}>Close</button></header>
        <div>
          {items.map((item) => (
            <article key={item.kind} data-resource-tone={item.tone}>
              <span><small>{item.label}</small><b>{item.value}</b></span>
              <strong>{item.trend}</strong>
              <p>{item.detail}</p>
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
  if (!actions.length) return null;
  return (
    <section className={styles.queueGroup} data-queue-group={label.toLowerCase()}>
      <h3>{label}<span>{actions.length}</span></h3>
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
                <div><strong>{decision.label}</strong><small>{decision.disabledReason || decision.detail}</small></div>
                <b>{decision.kind === primary?.kind ? "CURRENT" : decision.enabled ? "READY" : "HELD"}</b>
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
        <span>Decision Queue</span><strong>{command.runtimeMode === "static-demo" ? "SERVER ONLY" : `${count} OPEN`}</strong><b>{panelOpen ? "Close" : "Open"}</b>
      </button>
      <div id="strategic-queue-body" className={styles.queueBody}>
        <div className={styles.sectionHeading}><span>Decision Queue</span><b>{command.runtimeMode === "static-demo" ? "SERVER ONLY" : `${count} OPEN`}</b></div>
        {command.runtimeMode === "static-demo" ? (
          <p>Static Runtime keeps the certified route read-only and creates no persistent world decision queue.</p>
        ) : count ? (
          <>
            <QueueGroup label="Now" actions={pacing.queueGroups.now} primary={pacing.primaryAction} offset={0} activeIndex={activeIndex} onActiveIndexChange={onActiveIndexChange} onNavigate={onNavigate} />
            <QueueGroup label="Soon" actions={pacing.queueGroups.soon} primary={pacing.primaryAction} offset={pacing.queueGroups.now.length} activeIndex={activeIndex} onActiveIndexChange={onActiveIndexChange} onNavigate={onNavigate} />
            <QueueGroup label="Later" actions={pacing.queueGroups.later} primary={pacing.primaryAction} offset={pacing.queueGroups.now.length + pacing.queueGroups.soon.length} activeIndex={activeIndex} onActiveIndexChange={onActiveIndexChange} onNavigate={onNavigate} />
          </>
        ) : <p>No Server decision is waiting. Continue the current public objective.</p>}
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
      title={action.disabledReason || action.detail}
      onClick={() => void onAction?.(action)}
    >
      <span>{primary ? resolving ? "RESOLVING" : "02 / CURRENT ACTION" : `P${action.priority}`}</span>
      <strong>{action.label}</strong>
      <small>{action.disabledReason || action.detail}</small>
    </button>
  );
}

export const StrategicActionBar = memo(function StrategicActionBar({ command, pacing, compact = false, onAction }: {
  command: StrategicCommandViewModel;
  pacing: StrategicPacingViewModel;
  compact?: boolean;
  onAction?: (action: StrategicCommandAction) => void | Promise<void>;
}) {
  const primary = pacing.primaryAction;
  const secondary = pacing.secondaryActions;
  const advanceAction = pacing.advanceState.action;
  const advanceAlreadyVisible = Boolean(advanceAction && (primary?.kind === advanceAction.kind || secondary.some((item) => item.kind === advanceAction.kind)));
  const resolving = pacing.actionLifecycle?.state === "resolving" || command.presentationFeedback.state === "resolving";
  const latestOutcome = pacing.phase === "resolve" ? pacing.recentSafeOutcomes[0] : undefined;
  const feedback = latestOutcome ? [
    { label: "Immediate Result", detail: latestOutcome.immediateResult },
    { label: "World Consequence", detail: latestOutcome.worldConsequence },
    { label: "Next Objective", detail: latestOutcome.nextObjective }
  ] : Object.values(command.outcomeFeedback);
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
      <section
        className={styles.outcomeFeedback}
        data-testid="command-deck-feedback"
        data-feedback-state={pacing.actionLifecycle?.state || command.presentationFeedback.state}
        data-feedback-tone={command.presentationFeedback.tone}
        aria-label="Latest strategic feedback"
        aria-live="polite"
      >
        {feedback.map((item) => <span key={item.label}><small>{item.label}</small><b>{item.detail}</b></span>)}
      </section>
      <section className={styles.actionContext} aria-label="Current action forecast">
        <span><small>BENEFIT</small><b>{pacing.safeForecast.immediateBenefit}</b></span>
        <span><small>COST / BOUNDARY</small><b>{pacing.safeForecast.visibleCost}</b></span>
      </section>
      <div className={styles.actionButtons} aria-label="Strategic commands">
        <div className={styles.secondaryActions}>
          {secondary.map((action) => <ActionButton key={action.kind} action={action} resolving={resolving} onAction={onAction} />)}
          {!advanceAlreadyVisible && advanceAction && !advanceAction.enabled ? <ActionButton action={advanceAction} resolving={resolving} onAction={onAction} /> : null}
        </div>
        {primary
          ? <ActionButton action={primary} primary resolving={resolving} onAction={onAction} />
          : <div className={styles.readonlyAction}><span>02 / CURRENT ACTION</span><strong>{pacing.advanceState.label}</strong><small>{pacing.advanceState.detail}</small></div>}
      </div>
    </footer>
  );
});
