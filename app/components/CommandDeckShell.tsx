import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import type { StrategicCommandAction, StrategicCommandViewModel } from "@/app/campaign/strategic-command-model";
import { buildCampaignCommandBrief, type CampaignCommandBrief } from "@/app/campaign/campaign-command-brief-model";
import type { GuidedStepJournalEntry } from "@/app/campaign/replay-practice-model";
import type { SafeContextActionKind } from "@/app/campaign/context-action-resolver";
import type { TownMapLensKind } from "@/app/campaign/town-map-lens-model";
import { buildDistrictStrategicFrontsViewModel, type DistrictStrategicFront, type DistrictStrategicFrontKind } from "@/app/campaign/district-strategic-front-model";
import { useCampaignTransitionTheatre } from "@/app/hooks/useCampaignTransitionTheatre";
import { useCampaignResolutionLedger } from "@/app/hooks/useCampaignResolutionLedger";
import { useCommandDeckOverlayArbiter } from "@/app/hooks/useCommandDeckOverlayArbiter";
import { useStrategicPacing } from "@/app/hooks/useStrategicPacing";
import { CampaignTransitionTheatre } from "./CampaignTransitionTheatre";
import {
  CampaignResolutionLatest,
  CampaignResolutionLedgerProvider
} from "./CampaignResolutionLedger";
import { DistrictStrategicFronts } from "./DistrictStrategicFronts";
import { StrategicPacingSurface } from "./StrategicPacingSurface";
import { StrategicActionBar, StrategicDecisionQueue, StrategicResourceRibbon } from "./StrategicCommandSurfaces";
import coreStyles from "./CommandDeckShell.module.css";
import responsiveStyles from "./CommandDeckShell.responsive.module.css";
import pulseStyles from "./TownPulseBar.module.css";

const styles = {
  ...coreStyles,
  commandDeckShell: `${coreStyles.commandDeckShell} ${responsiveStyles.commandDeckShell}`,
  commandDeckGrid: `${coreStyles.commandDeckGrid} ${responsiveStyles.commandDeckGrid}`,
  commandDeckAgendaRail: `${coreStyles.commandDeckAgendaRail} ${responsiveStyles.commandDeckAgendaRail}`,
  commandDeckContextSummary: `${coreStyles.commandDeckContextSummary} ${responsiveStyles.commandDeckContextSummary}`,
  commandDeckLegacyControl: `${coreStyles.commandDeckLegacyControl} ${responsiveStyles.commandDeckLegacyControl}`,
  commandDeckMapArea: `${coreStyles.commandDeckMapArea} ${responsiveStyles.commandDeckMapArea}`,
  commandDeckMapIntel: `${coreStyles.commandDeckMapIntel} ${responsiveStyles.commandDeckMapIntel}`,
  commandDeckContextRail: `${coreStyles.commandDeckContextRail} ${responsiveStyles.commandDeckContextRail}`,
  commandDeckDrawerToggle: `${coreStyles.commandDeckDrawerToggle} ${responsiveStyles.commandDeckDrawerToggle}`,
  commandDeckContextDrawerBody: `${coreStyles.commandDeckContextDrawerBody} ${responsiveStyles.commandDeckContextDrawerBody}`,
  commandDeckInspectorDisclosure: `${coreStyles.commandDeckInspectorDisclosure} ${responsiveStyles.commandDeckInspectorDisclosure}`,
  commandDeckNotifications: `${coreStyles.commandDeckNotifications} ${responsiveStyles.commandDeckNotifications}`,
  drawerOpen: responsiveStyles.drawerOpen
} as typeof coreStyles & typeof responsiveStyles;

type CommandPanel = "context" | "queue" | "resources" | "fronts";

const TownPulseBar = memo(function TownPulseBar({ viewModel, resourcePanelOpen, onResourcePanelToggle, resourceTriggerRef }: {
  viewModel: StrategicCommandViewModel;
  resourcePanelOpen: boolean;
  onResourcePanelToggle: () => void;
  resourceTriggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const pulse = viewModel.townPulse;
  return (
    <header className={pulseStyles.pulse} data-testid="command-deck-pulse">
      <div className={pulseStyles.brand}>
        <span className={pulseStyles.mark} aria-hidden="true">DT</span>
        <div>
          <span className={styles.commandDeckEyebrow}>Detective Town</span>
          <strong>{pulse.caseLabel}</strong>
        </div>
      </div>
      <StrategicResourceRibbon items={viewModel.resourceRibbon} panelOpen={resourcePanelOpen} onPanelToggle={onResourcePanelToggle} triggerRef={resourceTriggerRef} />
    </header>
  );
});

const ContextSummary = memo(function ContextSummary({ viewModel, commandBrief, onAction, headingRef }: {
  viewModel: StrategicCommandViewModel;
  commandBrief: CampaignCommandBrief;
  onAction?: (kind: SafeContextActionKind) => void | Promise<void>;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const context = viewModel.selectedContext;
  return (
    <section className={styles.commandDeckContextSummary} data-testid="command-deck-context" data-context-kind={context?.kind || "none"} data-command-brief-layer="context">
      <span className={styles.commandDeckEyebrow}>04 / Context Rail</span>
      {context ? <>
        <h2 ref={headingRef} tabIndex={-1}>{context.label}</h2>
        <p>{context.detail}</p>
        {context.actions.length > 0 ? (
          <div className={styles.commandDeckContextActions} aria-label="Context actions">
            {context.actions.map((action) => (
              <button
                key={action.kind}
                type="button"
                className={styles.commandDeckContextAction}
                data-testid="command-deck-context-action"
                data-context-recommended={action.primary ? "true" : undefined}
                disabled={!action.enabled || !onAction}
                title={action.disabledReason || action.detail}
                aria-keyshortcuts={action.shortcut}
                onClick={() => void onAction?.(action.kind)}
              >
                <span className={styles.commandDeckActionTitle}><strong>{action.label}</strong>{action.shortcut ? <kbd>{action.shortcut}</kbd> : null}</span>
                <span>{action.disabledReason || action.detail}</span>
              </button>
            ))}
          </div>
        ) : null}
      </> : <p>{commandBrief.context.detail}</p>}
    </section>
  );
});

const NotificationStack = memo(function NotificationStack({ viewModel }: { viewModel: StrategicCommandViewModel }) {
  if (!viewModel.notifications.length) return null;
  return (
    <section className={styles.commandDeckNotifications} data-testid="command-deck-notifications" aria-live="polite">
      {viewModel.notifications.map((notification, index) => (
        <article key={`${notification.label}-${index}`} className={`${styles.commandDeckNotification} ${styles[notification.tone]}`}>
          <strong>{notification.label}</strong><span>{notification.detail}</span>
        </article>
      ))}
    </section>
  );
});

const MapIntel = memo(function MapIntel({ viewModel, commandBrief, activeLens, onLensChange }: {
  viewModel: StrategicCommandViewModel;
  commandBrief: CampaignCommandBrief;
  activeLens: TownMapLensKind;
  onLensChange: (lens: TownMapLensKind) => void;
}) {
  const active = viewModel.mapLenses.controls.find((control) => control.kind === activeLens) || viewModel.mapLenses.controls[0];
  return (
    <aside className={styles.commandDeckMapIntel} data-testid="command-deck-map-intel" aria-label="Map world signals" data-command-brief-layer="map">
      <div className={styles.commandDeckLensControls} role="group" aria-label="Town map lens">
        {viewModel.mapLenses.controls.map((control) => (
          <button key={control.kind} type="button" aria-pressed={control.kind === activeLens} data-testid="command-deck-map-lens" data-map-lens-kind={control.kind} onClick={() => onLensChange(control.kind)}>
            {control.label.toUpperCase()}
          </button>
        ))}
      </div>
      <span className={styles.commandDeckLensSummary}><small>03 / MAP FOCUS · {active?.label || "EVIDENCE"}</small><b>{commandBrief.focus.label}</b><em>{commandBrief.focus.detail}</em></span>
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

export function CommandDeckShell({ viewModel, commandBrief, guidedJournal, control, map, inspector, overlay, toasts, blockingOverlayActive = false, toastVisible = false, onContextAction, onStrategicAction, onStrategicFrontFocus }: {
  viewModel: StrategicCommandViewModel;
  commandBrief?: CampaignCommandBrief;
  control: ReactNode;
  map: ReactNode;
  inspector: ReactNode;
  overlay?: ReactNode;
  toasts?: ReactNode;
  blockingOverlayActive?: boolean;
  toastVisible?: boolean;
  guidedJournal?: readonly GuidedStepJournalEntry[];
  onContextAction?: (kind: SafeContextActionKind) => void | Promise<void>;
  onStrategicAction?: (action: StrategicCommandAction) => void | Promise<void>;
  onStrategicFrontFocus?: (locationName: string) => void;
}) {
  const pacing = useStrategicPacing(viewModel);
  const brief = commandBrief || buildCampaignCommandBrief({ command: viewModel });
  const theatre = useCampaignTransitionTheatre(viewModel, pacing.actionLifecycle);
  const resolutionLedger = useCampaignResolutionLedger({
    command: viewModel,
    commandBrief: brief,
    transition: theatre.presentation,
    guidedJournal,
    recentSafeOutcomes: pacing.recentSafeOutcomes
  });
  const districtFronts = useMemo(() => buildDistrictStrategicFrontsViewModel(viewModel), [viewModel]);
  const [activePanel, setActivePanel] = useState<CommandPanel | null>(null);
  const [inspectorDetailOpen, setInspectorDetailOpen] = useState(false);
  const [activeQueueIndex, setActiveQueueIndex] = useState(0);
  const [activeFrontKey, setActiveFrontKey] = useState<DistrictStrategicFrontKind | undefined>(districtFronts.currentFrontKey);
  const activeQueueIndexRef = useRef(0);
  const activePanelRef = useRef<CommandPanel | null>(null);
  const inspectorDetailOpenRef = useRef(false);
  const [activeMapLens, setActiveMapLens] = useState<TownMapLensKind>(viewModel.mapLenses.defaultLens);
  const mainRef = useRef<HTMLElement>(null);
  const contextTriggerRef = useRef<HTMLButtonElement>(null);
  const queueTriggerRef = useRef<HTMLButtonElement>(null);
  const resourceTriggerRef = useRef<HTMLButtonElement>(null);
  const frontTriggerRef = useRef<HTMLButtonElement>(null);
  const inspectorDetailTriggerRef = useRef<HTMLButtonElement>(null);
  const contextHeadingRef = useRef<HTMLHeadingElement>(null);
  const theatreHeadingRef = useRef<HTMLHeadingElement>(null);
  const theatreTriggerRef = useRef<HTMLElement | null>(null);
  const lastPanelTrigger = useRef<HTMLElement | null>(null);
  const previousContextLabel = useRef<string | undefined>(undefined);
  const previousFeedbackSignature = useRef<string | undefined>(undefined);
  const selectedContextLabel = viewModel.selectedContext?.label;
  const selectedContextKind = viewModel.selectedContext?.kind;
  const queueCount = viewModel.decisionQueue.length;
  const transitionVisible = viewModel.runtimeMode === "server" && theatre.presentation.visible;
  const overlayResolution = useCommandDeckOverlayArbiter({
    blockingOverlayActive,
    transitionVisible,
    transitionPhase: theatre.presentation.phase,
    encounterVisible: selectedContextKind === "actor" && !inspectorDetailOpen,
    activePanel: inspectorDetailOpen ? "context" : activePanel,
    notificationVisible: viewModel.notifications.length > 0,
    toastVisible
  });

  useEffect(() => {
    const next = queueCount ? Math.min(activeQueueIndexRef.current, queueCount - 1) : 0;
    activeQueueIndexRef.current = next;
    setActiveQueueIndex(next);
  }, [queueCount]);

  useEffect(() => {
    setActiveFrontKey(districtFronts.currentFrontKey);
  }, [districtFronts.currentFrontKey]);

  useEffect(() => {
    if (!selectedContextLabel || previousContextLabel.current === selectedContextLabel) return;
    const hadSelection = Boolean(previousContextLabel.current);
    previousContextLabel.current = selectedContextLabel;
    if (!hadSelection) return;
    const compact = window.matchMedia("(max-width: 900px)").matches;
    if (compact && activePanelRef.current === "fronts") return;
    if (compact && selectedContextKind === "actor") {
      updateActivePanel(null);
      return;
    }
    if (compact) {
      lastPanelTrigger.current = contextTriggerRef.current;
      updateActivePanel("context");
    }
    const frame = window.requestAnimationFrame(() => contextHeadingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [selectedContextKind, selectedContextLabel]);

  useEffect(() => {
    const feedback = viewModel.presentationFeedback;
    const previous = previousFeedbackSignature.current;
    previousFeedbackSignature.current = feedback.signature;
    if (!previous || previous === feedback.signature || feedback.audioCue === "none") return;
    window.dispatchEvent(new CustomEvent("detective-town:audio-cue", {
      detail: { cue: feedback.audioCue, state: feedback.state, tone: feedback.tone }
    }));
  }, [viewModel.presentationFeedback]);

  useEffect(() => {
    if (!overlayResolution.locksPanels) return;
    if (activePanelRef.current) updateActivePanel(null);
    if (inspectorDetailOpenRef.current) updateInspectorDetail(false);
  }, [overlayResolution.locksPanels]);

  useEffect(() => {
    if (!transitionVisible || blockingOverlayActive) return;
    const revealTheatre = () => {
      const heading = theatreHeadingRef.current;
      if (!heading) return;
      const compact = window.matchMedia("(max-width: 520px)").matches;
      if (compact) heading.closest<HTMLElement>("[data-testid='campaign-transition-theatre']")?.scrollIntoView({ block: "start" });
      heading.focus({ preventScroll: compact });
    };
    const frame = window.requestAnimationFrame(revealTheatre);
    window.addEventListener("resize", revealTheatre);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", revealTheatre);
    };
  }, [blockingOverlayActive, theatre.presentation.phase, transitionVisible]);

  function togglePanel(panel: CommandPanel, trigger: RefObject<HTMLButtonElement | null>) {
    if (overlayResolution.locksPanels) return;
    lastPanelTrigger.current = trigger.current;
    updateActivePanel(activePanelRef.current === panel ? null : panel);
  }

  function updateActivePanel(panel: CommandPanel | null) {
    activePanelRef.current = panel;
    setActivePanel(panel);
  }

  function updateInspectorDetail(open: boolean) {
    inspectorDetailOpenRef.current = open;
    setInspectorDetailOpen(open);
  }

  function closeTopSurface() {
    if (transitionVisible) {
      theatre.dismiss();
      window.requestAnimationFrame(() => theatreTriggerRef.current?.focus());
      return true;
    }
    if (inspectorDetailOpenRef.current) {
      updateInspectorDetail(false);
      inspectorDetailTriggerRef.current?.focus();
      return true;
    }
    if (!activePanelRef.current) return false;
    const trigger = lastPanelTrigger.current;
    updateActivePanel(null);
    trigger?.focus();
    return true;
  }

  function navigateQueue(delta: number) {
    if (!queueCount) return;
    lastPanelTrigger.current = queueTriggerRef.current;
    if (window.matchMedia("(max-width: 900px)").matches) updateActivePanel("queue");
    const next = (activeQueueIndexRef.current + delta + queueCount) % queueCount;
    activeQueueIndexRef.current = next;
    setActiveQueueIndex(next);
    window.requestAnimationFrame(() => {
      mainRef.current?.querySelector<HTMLElement>(`[data-queue-index="${next}"]`)?.focus();
    });
  }

  function updateActiveQueueIndex(index: number) {
    activeQueueIndexRef.current = index;
    setActiveQueueIndex(index);
  }

  function isEditableTarget(target: EventTarget | null) {
    return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
  }

  function handleShellKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.defaultPrevented || isEditableTarget(event.target)) return;
    if (event.key === "Escape") {
      if (closeTopSurface()) event.preventDefault();
      return;
    }
    if (transitionVisible || blockingOverlayActive) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "j" || event.key === "J" || event.key === "]") {
      event.preventDefault();
      navigateQueue(1);
      return;
    }
    if (event.key === "k" || event.key === "K" || event.key === "[") {
      event.preventDefault();
      navigateQueue(-1);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && pacing.viewModel.primaryAction) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("button, a, summary")) return;
      event.preventDefault();
      void handleStrategicAction(pacing.viewModel.primaryAction);
    }
  }

  async function handleStrategicAction(action: StrategicCommandAction) {
    theatreTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const opensInspector = action.target === "show-investigation"
      || action.target === "show-world-choice"
      || action.target === "show-headquarters"
      || action.target === "show-operations"
      || action.target === "show-next-case"
      || action.target === "review-outcome";
    if (opensInspector) {
      updateInspectorDetail(true);
      if (window.matchMedia("(max-width: 900px)").matches) {
        lastPanelTrigger.current = contextTriggerRef.current;
        updateActivePanel("context");
      }
    }
    await pacing.runAction(action, async (selected) => {
      await onStrategicAction?.(selected);
    });
  }

  async function handleContextAction(kind: SafeContextActionKind) {
    const strategicAction = viewModel.decisionQueue.find((action) => action.contextActionKind === kind && action.enabled);
    if (strategicAction) await handleStrategicAction(strategicAction);
    else await onContextAction?.(kind);
  }

  function selectDistrictFront(front: DistrictStrategicFront) {
    if (overlayResolution.locksPanels) return;
    setActiveFrontKey(front.key);
    setActiveMapLens(front.lens);
    onStrategicFrontFocus?.(front.districtLabel);
  }

  async function handleDistrictFrontAction(action: StrategicCommandAction, front: DistrictStrategicFront) {
    selectDistrictFront(front);
    updateActivePanel(null);
    await handleStrategicAction(action);
  }

  return (
    <CampaignResolutionLedgerProvider ledger={resolutionLedger}>
    <main
      ref={mainRef}
      className={`${styles.commandDeckShell} ${viewModel.runtimeMode === "static-demo" ? styles.static : styles.server}`}
      data-testid="command-deck-shell"
      data-map-lens={activeMapLens}
      data-presentation-state={viewModel.presentationFeedback.state}
      data-presentation-tone={viewModel.presentationFeedback.tone}
      data-pacing-phase={pacing.viewModel.phase}
      data-focus-target={pacing.viewModel.focusTarget}
      data-command-brief-status={brief.status}
      data-command-brief-focus={brief.focus.target}
      data-resolution-ledger-status={resolutionLedger.status}
      data-resolution-ledger-count={resolutionLedger.entryCount}
      data-active-panel={activePanel || "none"}
      data-panel-open={activePanel ? "true" : "false"}
      data-active-front={activeFrontKey || "none"}
      data-dominant-overlay={overlayResolution.dominant}
      data-suspend-encounter={overlayResolution.suspendEncounter ? "true" : "false"}
      data-suspend-location-hover={overlayResolution.suspendLocationHover ? "true" : "false"}
      data-suspend-context={overlayResolution.suspendContextDetail ? "true" : "false"}
      data-suspend-fronts={overlayResolution.suspendFronts ? "true" : "false"}
      data-suspend-notifications={overlayResolution.suspendNotifications ? "true" : "false"}
      data-suspend-toasts={overlayResolution.suspendToasts ? "true" : "false"}
      onKeyDown={handleShellKeyDown}
    >
      <TownPulseBar
        viewModel={viewModel}
        resourcePanelOpen={activePanel === "resources"}
        onResourcePanelToggle={() => togglePanel("resources", resourceTriggerRef)}
        resourceTriggerRef={resourceTriggerRef}
      />
      <div className={styles.commandDeckGrid} data-testid="command-deck-grid">
        <aside className={styles.commandDeckAgendaRail} data-testid="command-deck-agenda-rail">
          <StrategicPacingSurface command={viewModel} pacing={pacing.viewModel} brief={brief} />
          <StrategicActionBar command={viewModel} pacing={pacing.viewModel} compact onAction={onStrategicAction ? handleStrategicAction : undefined} />
          <CampaignResolutionLatest ledger={resolutionLedger} />
          <StrategicDecisionQueue
            command={viewModel}
            pacing={pacing.viewModel}
            panelOpen={activePanel === "queue"}
            onPanelToggle={() => togglePanel("queue", queueTriggerRef)}
            triggerRef={queueTriggerRef}
            activeIndex={activeQueueIndex}
            onActiveIndexChange={updateActiveQueueIndex}
            onNavigate={navigateQueue}
          />
          <div className={styles.commandDeckLegacyControl}>{control}</div>
        </aside>
        <section className={styles.commandDeckMapArea} data-testid="command-deck-map-area" tabIndex={-1}>
          {map}
          {!blockingOverlayActive && transitionVisible && <CampaignTransitionTheatre presentation={theatre.presentation} ledger={resolutionLedger} headingRef={theatreHeadingRef} onSkip={theatre.skip} onDismiss={() => {
            theatre.dismiss();
            window.requestAnimationFrame(() => theatreTriggerRef.current?.focus());
          }} />}
          <DistrictStrategicFronts
            model={districtFronts}
            selectedFrontKey={activeFrontKey}
            panelOpen={activePanel === "fronts"}
            triggerRef={frontTriggerRef}
            onPanelToggle={() => togglePanel("fronts", frontTriggerRef)}
            onSelect={selectDistrictFront}
            onAction={onStrategicAction ? handleDistrictFrontAction : undefined}
          />
          <MapIntel viewModel={viewModel} commandBrief={brief} activeLens={activeMapLens} onLensChange={setActiveMapLens} />
        </section>
        <aside className={`${styles.commandDeckContextRail} ${activePanel === "context" ? styles.drawerOpen : ""}`} data-testid="command-deck-context-rail">
          <button
            ref={contextTriggerRef}
            type="button"
            className={styles.commandDeckDrawerToggle}
            data-testid="command-deck-drawer-toggle"
            aria-expanded={activePanel === "context"}
            aria-controls="command-deck-context-drawer"
            disabled={overlayResolution.locksPanels}
            onClick={() => togglePanel("context", contextTriggerRef)}
          >
            <span>Context</span><strong>{viewModel.selectedContext?.label || "Select a map object"}</strong><b aria-hidden="true">{activePanel === "context" ? "Close" : "Open"}</b>
          </button>
          <div id="command-deck-context-drawer" className={styles.commandDeckContextDrawerBody}>
            <ContextSummary viewModel={viewModel} commandBrief={brief} onAction={handleContextAction} headingRef={contextHeadingRef} />
            <section className={styles.commandDeckInspectorDisclosure} data-inspector-open={inspectorDetailOpen ? "true" : "false"}>
              <button
                ref={inspectorDetailTriggerRef}
                type="button"
                className={styles.commandDeckInspectorToggle}
                aria-expanded={inspectorDetailOpen}
                aria-controls="command-deck-full-inspector"
                onClick={() => updateInspectorDetail(!inspectorDetailOpenRef.current)}
              >
                <span>Case files &amp; detail</span><b>{inspectorDetailOpen ? "Close" : "Open"}</b>
              </button>
              {inspectorDetailOpen ? <div id="command-deck-full-inspector" className={styles.commandDeckInspectorBody}>{inspector}</div> : null}
            </section>
          </div>
        </aside>
      </div>
      <NotificationStack viewModel={viewModel} />
      {overlay}
      {toasts}
    </main>
    </CampaignResolutionLedgerProvider>
  );
}
