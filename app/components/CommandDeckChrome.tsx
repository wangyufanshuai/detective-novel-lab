"use client";

import { memo, type ReactNode, type RefObject } from "react";
import type { CampaignCommandBrief } from "@/app/campaign/campaign-command-brief-model";
import type { SafeContextActionKind } from "@/app/campaign/context-action-resolver";
import type { StrategicCommandViewModel } from "@/app/campaign/strategic-command-model";
import type { TownMapLensKind } from "@/app/campaign/town-map-lens-model";
import { useAppLocale } from "@/app/localization/locale-context";
import { StrategicResourceRibbon } from "./StrategicCommandSurfaces";
import coreStyles from "./CommandDeckShell.module.css";
import responsiveStyles from "./CommandDeckShell.responsive.module.css";
import pulseStyles from "./TownPulseBar.module.css";

const styles = {
  ...coreStyles,
  commandDeckContextSummary: `${coreStyles.commandDeckContextSummary} ${responsiveStyles.commandDeckContextSummary}`,
  commandDeckMapIntel: `${coreStyles.commandDeckMapIntel} ${responsiveStyles.commandDeckMapIntel}`,
  commandDeckNotifications: `${coreStyles.commandDeckNotifications} ${responsiveStyles.commandDeckNotifications}`
} as typeof coreStyles & typeof responsiveStyles;

export const TownPulseBar = memo(function TownPulseBar({ viewModel, resourcePanelOpen, onResourcePanelToggle, resourceTriggerRef }: {
  viewModel: StrategicCommandViewModel;
  resourcePanelOpen: boolean;
  onResourcePanelToggle: () => void;
  resourceTriggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const { text } = useAppLocale();
  const pulse = viewModel.townPulse;
  return (
    <header className={pulseStyles.pulse} data-testid="command-deck-pulse">
      <div className={pulseStyles.brand}>
        <span className={pulseStyles.mark} aria-hidden="true">DT</span>
        <div><span className={styles.commandDeckEyebrow}>Detective Town</span><strong>{text(pulse.caseLabel)}</strong></div>
      </div>
      <StrategicResourceRibbon items={viewModel.resourceRibbon} panelOpen={resourcePanelOpen} onPanelToggle={onResourcePanelToggle} triggerRef={resourceTriggerRef} />
    </header>
  );
});

export const ContextSummary = memo(function ContextSummary({ viewModel, commandBrief, onAction, headingRef }: {
  viewModel: StrategicCommandViewModel;
  commandBrief: CampaignCommandBrief;
  onAction?: (kind: SafeContextActionKind) => void | Promise<void>;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const { t, text } = useAppLocale();
  const context = viewModel.selectedContext;
  return (
    <section className={styles.commandDeckContextSummary} data-testid="command-deck-context" data-context-kind={context?.kind || "none"} data-command-brief-layer="context">
      <span className={styles.commandDeckEyebrow}>04 / {t("command.context")}</span>
      {context ? <>
        <h2 ref={headingRef} tabIndex={-1}>{text(context.label)}</h2>
        <p>{text(context.detail)}</p>
        {context.actions.length > 0 ? <div className={styles.commandDeckContextActions} aria-label={t("command.context")}>
          {context.actions.map((action) => <button
            key={action.kind}
            type="button"
            className={styles.commandDeckContextAction}
            data-testid="command-deck-context-action"
            data-context-recommended={action.primary ? "true" : undefined}
            disabled={!action.enabled || !onAction}
            title={text(action.disabledReason || action.detail)}
            aria-keyshortcuts={action.shortcut}
            onClick={() => void onAction?.(action.kind)}
          >
            <span className={styles.commandDeckActionTitle}><strong>{text(action.label)}</strong>{action.shortcut ? <kbd translate="no">{action.shortcut}</kbd> : null}</span>
            <span>{text(action.disabledReason || action.detail)}</span>
          </button>)}
        </div> : null}
      </> : <p>{text(commandBrief.context.detail)}</p>}
    </section>
  );
});

export const NotificationStack = memo(function NotificationStack({ viewModel }: { viewModel: StrategicCommandViewModel }) {
  const { text } = useAppLocale();
  if (!viewModel.notifications.length) return null;
  return <section className={styles.commandDeckNotifications} data-testid="command-deck-notifications">
    {viewModel.notifications.map((notification, index) => <article key={`${notification.label}-${index}`} className={`${styles.commandDeckNotification} ${styles[notification.tone]}`}>
      <strong>{text(notification.label)}</strong><span>{text(notification.detail)}</span>
    </article>)}
  </section>;
});

export const MapIntel = memo(function MapIntel({ viewModel, commandBrief, activeLens, onLensChange }: {
  viewModel: StrategicCommandViewModel;
  commandBrief: CampaignCommandBrief;
  activeLens: TownMapLensKind;
  onLensChange: (lens: TownMapLensKind) => void;
}) {
  const { t, text } = useAppLocale();
  const active = viewModel.mapLenses.controls.find((control) => control.kind === activeLens) || viewModel.mapLenses.controls[0];
  return <aside className={styles.commandDeckMapIntel} data-testid="command-deck-map-intel" aria-label={t("command.worldSignals")} data-command-brief-layer="map">
    <div className={styles.commandDeckLensControls} role="group" aria-label={t("command.mapFocus")}>
      {viewModel.mapLenses.controls.map((control) => <button key={control.kind} type="button" aria-pressed={control.kind === activeLens} data-testid="command-deck-map-lens" data-map-lens-kind={control.kind} onClick={() => onLensChange(control.kind)}>{text(control.label).toUpperCase()}</button>)}
    </div>
    <span className={styles.commandDeckLensSummary}><small>03 / {t("command.mapFocus")} · {text(active?.label || t("workspace.evidence"))}</small><b>{text(commandBrief.focus.label)}</b><em>{text(commandBrief.focus.detail)}</em></span>
  </aside>;
});

export function CommandDeckCollapsible({ enabled, title, children }: { enabled: boolean; title: string; children: ReactNode }) {
  const { text } = useAppLocale();
  if (!enabled) return <>{children}</>;
  return <details className={styles.commandDeckCollapsible} data-command-deck-collapsible>
    <summary>{text(title)}</summary><div className={styles.commandDeckCollapsibleBody}>{children}</div>
  </details>;
}
