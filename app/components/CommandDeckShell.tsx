import { memo, useState, type ReactNode } from "react";
import type { CampaignCommandDeckViewModel } from "@/app/campaign/command-deck-model";
import type { SafeContextActionKind } from "@/app/campaign/context-action-resolver";
import styles from "./CommandDeckShell.module.css";

function isPrimaryContextAction(kind: SafeContextActionKind) {
  return kind === "search" || kind === "question" || kind === "advance";
}

const TownPulseBar = memo(function TownPulseBar({ viewModel }: { viewModel: CampaignCommandDeckViewModel }) {
  const pulse = viewModel.townPulse;
  return (
    <header className={styles.commandDeckPulse} data-testid="command-deck-pulse">
      <div className={styles.commandDeckPulseBrand}>
        <span className={styles.commandDeckMark} aria-hidden="true">DT</span>
        <div>
          <span className={styles.commandDeckEyebrow}>Detective Town</span>
          <strong>{pulse.caseLabel}</strong>
        </div>
      </div>
      <div className={styles.commandDeckPulseMetrics} aria-label="Town pulse">
        <span><small>TIME</small><b>{pulse.timeLabel}</b></span>
        <span><small>HEAT</small><b>{pulse.heatLabel}</b></span>
        <span><small>TRUST</small><b>{pulse.trustLabel}</b></span>
        <span><small>PRESSURE</small><b>{pulse.pressureLabel}</b></span>
        <span><small>CAMPAIGN</small><b>{pulse.campaignLabel}</b></span>
      </div>
    </header>
  );
});

const InvestigationAgenda = memo(function InvestigationAgenda({ viewModel }: { viewModel: CampaignCommandDeckViewModel }) {
  const objective = viewModel.currentObjective;
  return (
    <section className={styles.commandDeckAgendaSummary} data-testid="command-deck-agenda">
      <div className={styles.commandDeckSectionHeading}>
        <span className={styles.commandDeckEyebrow}>Investigation Agenda</span>
        <span className={styles.commandDeckObjectiveBadge}>{objective.action}</span>
      </div>
      <h2>{objective.title}</h2>
      <p>{objective.detail}</p>
      <div className={styles.commandDeckAgendaMeta} aria-label="Objective status">
        <span><small>CERTIFIED STEP</small><b>{objective.phase}</b></span>
        <span><small>RECOVERY</small><b>{objective.recoveryLabel}</b></span>
        <span><small>CASE PROGRESS</small><b>{objective.progressLabel}</b></span>
      </div>
      <div className={styles.commandDeckNextAction}><small>NEXT</small><span>{objective.nextAction}</span></div>
    </section>
  );
});

const ContextSummary = memo(function ContextSummary({ viewModel, onAction }: { viewModel: CampaignCommandDeckViewModel; onAction?: (kind: SafeContextActionKind) => void }) {
  const context = viewModel.selectedContext;
  return (
    <section className={styles.commandDeckContextSummary} data-testid="command-deck-context" data-context-kind={context?.kind || "none"}>
      <span className={styles.commandDeckEyebrow}>Context Inspector</span>
      {context ? <>
        <h2>{context.label}</h2>
        <p>{context.detail}</p>
        {context.actions.length > 0 && (
          <div className={styles.commandDeckContextActions} aria-label="Context actions">
            {context.actions.map((action) => (
              <button
                key={action.kind}
                type="button"
                className={`${styles.commandDeckContextAction} ${isPrimaryContextAction(action.kind) ? styles.primary : ""}`}
                data-testid="command-deck-context-action"
                data-command-deck-primary={isPrimaryContextAction(action.kind) ? "true" : undefined}
                disabled={!action.enabled || !onAction}
                title={action.detail}
                onClick={() => onAction?.(action.kind)}
              >
                <strong>{action.label}</strong>
                <span>{action.detail}</span>
              </button>
            ))}
          </div>
        )}
      </> : <p>Select a public location or character on the map to inspect the next legal action.</p>}
    </section>
  );
});

const NotificationStack = memo(function NotificationStack({ viewModel }: { viewModel: CampaignCommandDeckViewModel }) {
  if (!viewModel.notifications.length) return null;
  return (
    <section className={styles.commandDeckNotifications} data-testid="command-deck-notifications" aria-live="polite">
      {viewModel.notifications.map((notification, index) => (
        <article key={`${notification.label}-${index}`} className={`${styles.commandDeckNotification} ${styles[notification.tone]}`}>
          <strong>{notification.label}</strong>
          <span>{notification.detail}</span>
        </article>
      ))}
    </section>
  );
});

const MapIntel = memo(function MapIntel({ viewModel }: { viewModel: CampaignCommandDeckViewModel }) {
  return (
    <aside className={styles.commandDeckMapIntel} data-testid="command-deck-map-intel" aria-label="Map world signals">
      <span><small>INSTITUTION</small><b>{viewModel.mapSignals.institutionLabel}</b></span>
      <span><small>WORLD PRESSURE</small><b>{viewModel.mapSignals.pressureLabel}</b></span>
      <span><small>TOWN REACTION</small><b>{viewModel.mapSignals.socialResponseLabel}</b></span>
    </aside>
  );
});

export function CommandDeckCollapsible({ enabled, title, children }: { enabled: boolean; title: string; children: ReactNode }) {
  if (!enabled) return <>{children}</>;
  return (
    <details className={styles.commandDeckCollapsible} data-command-deck-collapsible>
      <summary>{title}</summary>
      <div className={styles.commandDeckCollapsibleBody}>{children}</div>
    </details>
  );
}

export function CommandDeckShell({ viewModel, control, map, inspector, overlay, toasts, onContextAction }: {
  viewModel: CampaignCommandDeckViewModel;
  control: ReactNode;
  map: ReactNode;
  inspector: ReactNode;
  overlay?: ReactNode;
  toasts?: ReactNode;
  onContextAction?: (kind: SafeContextActionKind) => void;
}) {
  const [contextDrawerOpen, setContextDrawerOpen] = useState(false);
  return (
    <main className={`${styles.commandDeckShell} ${viewModel.runtimeMode === "static-demo" ? styles.static : styles.server}`} data-testid="command-deck-shell">
      <TownPulseBar viewModel={viewModel} />
      <div className={styles.commandDeckGrid} data-testid="command-deck-grid">
        <aside className={styles.commandDeckAgendaRail} data-testid="command-deck-agenda-rail">
          <InvestigationAgenda viewModel={viewModel} />
          <div className={styles.commandDeckLegacyControl}>{control}</div>
        </aside>
        <section className={styles.commandDeckMapArea} data-testid="command-deck-map-area">
          {map}
          <MapIntel viewModel={viewModel} />
        </section>
        <aside className={`${styles.commandDeckContextRail} ${contextDrawerOpen ? styles.drawerOpen : ""}`} data-testid="command-deck-context-rail">
          <button
            type="button"
            className={styles.commandDeckDrawerToggle}
            data-testid="command-deck-drawer-toggle"
            aria-expanded={contextDrawerOpen}
            aria-controls="command-deck-context-drawer"
            onClick={() => setContextDrawerOpen((open) => !open)}
          >
            <span>Context</span>
            <strong>{viewModel.selectedContext?.label || "Select a map object"}</strong>
            <b aria-hidden="true">{contextDrawerOpen ? "Close" : "Open"}</b>
          </button>
          <div id="command-deck-context-drawer" className={styles.commandDeckContextDrawerBody}>
            <ContextSummary viewModel={viewModel} onAction={onContextAction} />
            {inspector}
          </div>
        </aside>
      </div>
      <NotificationStack viewModel={viewModel} />
      {overlay}
      {toasts}
    </main>
  );
}
