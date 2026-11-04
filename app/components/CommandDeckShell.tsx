"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock3, Compass, Fingerprint, FolderOpen, Headphones, Languages, Settings2, Volume2, VolumeX, Wrench, X } from "lucide-react";
import { getInvestigationActionDefinition } from "@/app/campaign/investigation-action-registry";
import { InvestigationActionExecutionProvider } from "./InvestigationActionExecution";
import type { InvestigationActionResult } from "@/app/campaign/investigation-action-result";
import type { StrategicCommandAction, StrategicCommandViewModel } from "@/app/campaign/strategic-command-model";
import { buildCampaignCommandBrief, type CampaignCommandBrief } from "@/app/campaign/campaign-command-brief-model";
import type { GuidedStepJournalEntry } from "@/app/campaign/replay-practice-model";
import type { SafeContextActionKind } from "@/app/campaign/context-action-resolver";
import type { TownMapLensKind } from "@/app/campaign/town-map-lens-model";
import { useCampaignTransitionTheatre } from "@/app/hooks/useCampaignTransitionTheatre";
import { useCampaignResolutionLedger } from "@/app/hooks/useCampaignResolutionLedger";
import { useCommandDeckOverlayArbiter } from "@/app/hooks/useCommandDeckOverlayArbiter";
import { useStrategicPacing } from "@/app/hooks/useStrategicPacing";
import { useAppLocale } from "@/app/localization/locale-context";
import { CampaignTransitionTheatre } from "./CampaignTransitionTheatre";
import { CampaignResolutionLedgerProvider } from "./CampaignResolutionLedger";
import type { InspectorTabId } from "./DetectiveTownUI";
import coreStyles from "./CommandDeckShell.module.css";
import responsiveStyles from "./CommandDeckShell.responsive.module.css";

export { CommandDeckCollapsible } from "./CommandDeckChrome";

const styles: Record<string, string> = { ...coreStyles, commandDeckShell: `${coreStyles.commandDeckShell} ${responsiveStyles.commandDeckShell}` };
export type NoirPlayerView = "explore" | "deduction" | "journal" | "settings" | "tools";
export type NoirPlayerPanel = { id: InspectorTabId; label: string; content: ReactNode };
type PlayerAudioControls = {
  muted: boolean; lowSensory: boolean; master: number;
  onToggleMuted: () => unknown; onToggleLowSensory: () => unknown;
  onMasterVolume: (value: number) => unknown; onUnlock: () => Promise<unknown>;
};

export function CommandDeckShell({ viewModel, commandBrief, guidedJournal, control, map, inspector, panels, activeInspectorTab = "investigation", onInspectorTabChange, onOpenCampaign, navigationRequest, audio, overlay, toasts, blockingOverlayActive = false, toastVisible = false, onContextAction, onStrategicAction, onStrategicFrontFocus }: {
  viewModel: StrategicCommandViewModel;
  commandBrief?: CampaignCommandBrief;
  control: ReactNode; map: ReactNode; inspector?: ReactNode;
  panels?: NoirPlayerPanel[];
  activeInspectorTab?: InspectorTabId;
  onInspectorTabChange?: (tab: InspectorTabId) => void;
  onOpenCampaign?: () => void;
  navigationRequest?: { view: NoirPlayerView; sequence: number };
  audio?: PlayerAudioControls;
  overlay?: ReactNode; toasts?: ReactNode;
  blockingOverlayActive?: boolean; toastVisible?: boolean;
  guidedJournal?: readonly GuidedStepJournalEntry[];
  onContextAction?: (kind: SafeContextActionKind) => void | InvestigationActionResult | Promise<void | InvestigationActionResult>;
  onStrategicAction?: (action: StrategicCommandAction) => void | InvestigationActionResult | Promise<void | InvestigationActionResult>;
  onStrategicFrontFocus?: (locationName: string) => void;
}) {
  const { locale, setLocale, text, number } = useAppLocale();
  const cn = locale === "zh-CN";
  const copy = cn ? {
    explore: "探索", deduction: "推理", journal: "日志", settings: "设置", tools: "工具", archive: "案件档案", town: "侦探小镇",
    current: "当前调查", next: "继续调查", mapFocus: "地图视角", context: "此处可调查", journalTitle: "每一步，都留下痕迹。",
    journalDetail: "回看事件与调查记录，重新串起那些被忽略的细节。", events: "事件记录", decisions: "行动回顾", empty: "调查尚未留下记录。去小镇里走走，第一条线索正在等你。",
    evidence: "证据与推理", people: "人物", review: "结案档案", settingsTitle: "按你的节奏，进入小镇。", settingsDetail: "语言、声音与动态效果。你的调查进度会保留。",
    language: "界面语言", languageDetail: "选择故事与界面的显示语言。", sound: "小镇的声音", soundDetail: "环境、音乐与行动提示。", soundOn: "声音已开启", soundOff: "声音已关闭",
    volume: "主音量", sensory: "减少动态效果", sensoryDetail: "减少转场与装饰动画，让线索更安静。", on: "已开启", off: "已关闭", resources: "小镇现况", routes: "待办与街区",
    toolsTitle: "幕后工作室", toolsDetail: "世界配置、运行控制与开发工具。", world: "世界配置", agents: "运行控制", developer: "开发信息", close: "关闭", browse: "浏览案件", result: "调查回音", progress: "调查进度",
    goal: "眼下的线索", waiting: "等待行动", district: "街区关注", actionHistory: "行动记录", noChoices: "当前没有其他待办。", actionAvailable: "可行动", readonly: "浏览模式"
  } : {
    explore: "Explore", deduction: "Deduce", journal: "Journal", settings: "Settings", tools: "Tools", archive: "Case archive", town: "Detective Town",
    current: "Current investigation", next: "Continue", mapFocus: "Map focus", context: "Investigate here", journalTitle: "Every step leaves a trace.",
    journalDetail: "Return to events and your investigation notes. Find what you missed.", events: "Events", decisions: "Action history", empty: "Your investigation has no entries yet. A first clue is waiting somewhere in town.",
    evidence: "Evidence & theory", people: "People", review: "Case review", settingsTitle: "Enter town at your own pace.", settingsDetail: "Language, sound and motion. Your investigation stays with you.",
    language: "Language", languageDetail: "Choose the language of the story and interface.", sound: "Sounds of the town", soundDetail: "Atmosphere, music and action cues.", soundOn: "Sound on", soundOff: "Sound off",
    volume: "Master volume", sensory: "Reduce motion", sensoryDetail: "Quieter transitions and fewer decorative effects.", on: "On", off: "Off", resources: "Town conditions", routes: "Decisions & districts",
    toolsTitle: "Behind the scenes", toolsDetail: "World configuration, runtime controls and development tools.", world: "World setup", agents: "Runtime", developer: "Developer", close: "Close", browse: "Browse cases", result: "A new development", progress: "Investigation progress",
    goal: "The thread to follow", waiting: "Awaiting action", district: "District focus", actionHistory: "Action record", noChoices: "No other decisions are waiting.", actionAvailable: "Ready", readonly: "Browse mode"
  };
  const pacing = useStrategicPacing(viewModel);
  const brief = commandBrief || buildCampaignCommandBrief({ command: viewModel });
  const theatre = useCampaignTransitionTheatre(viewModel, pacing.actionLifecycle);
  const resolutionLedger = useCampaignResolutionLedger({ command: viewModel, commandBrief: brief, transition: theatre.presentation, guidedJournal, actionLifecycle: pacing.actionLifecycle, recentSafeOutcomes: pacing.viewModel.recentSafeOutcomes });
  const [activeView, setActiveView] = useState<NoirPlayerView>("explore");
  const [journalTab, setJournalTab] = useState<"events" | "decisions">("events");
  const [toolTab, setToolTab] = useState<"world" | "agent" | "developer">("world");
  const [activeMapLens, setActiveMapLens] = useState<TownMapLensKind>(viewModel.mapLenses.defaultLens);
  const mainRef = useRef<HTMLElement>(null);
  const viewHeadingRef = useRef<HTMLHeadingElement>(null);
  const theatreHeadingRef = useRef<HTMLHeadingElement>(null);
  const theatreTriggerRef = useRef<HTMLElement | null>(null);
  const deskTriggerRef = useRef<HTMLElement | null>(null);
  const navigationRefs = useRef<Partial<Record<NoirPlayerView, HTMLButtonElement | null>>>({});
  const previousInspectorTab = useRef(activeInspectorTab);
  const previousActiveView = useRef<NoirPlayerView>(activeView);
  const previousNavigationSequence = useRef(navigationRequest?.sequence);
  const previousFeedbackSignature = useRef(viewModel.presentationFeedback.signature);
  const activeViewRef = useRef<NoirPlayerView>(activeView);
  activeViewRef.current = activeView;
  const resolving = pacing.actionLifecycle?.state === "selected" || pacing.actionLifecycle?.state === "resolving";
  const transitionVisible = viewModel.runtimeMode === "server" && theatre.presentation.visible;
  const overlayResolution = useCommandDeckOverlayArbiter({ blockingOverlayActive, transitionVisible, transitionPhase: theatre.presentation.phase, encounterVisible: activeView === "explore" && viewModel.selectedContext?.kind === "actor", activePanel: null, notificationVisible: false, toastVisible });
  const navigationLocked = blockingOverlayActive || resolving || transitionVisible;
  const primary = pacing.viewModel.primaryAction;
  const activePanelId = ["investigation", "people", "logic"].includes(activeInspectorTab) ? activeInspectorTab : "investigation";
  const panel = (id: InspectorTabId) => panels?.find((item) => item.id === id)?.content;
  const resultVisible = resolutionLedger.status !== "idle" && resolutionLedger.status !== "resolving" && !transitionVisible && !blockingOverlayActive;
  const contextualActions = (viewModel.selectedContext?.actions || []).filter((action) => action.kind !== primary?.contextActionKind);

  useEffect(() => {
    if (!navigationRequest || previousNavigationSequence.current === navigationRequest.sequence) return;
    previousNavigationSequence.current = navigationRequest.sequence;
    setActiveView(navigationRequest.view);
    if (navigationRequest.view === "deduction") { previousInspectorTab.current = "investigation"; onInspectorTabChange?.("investigation"); }
  }, [navigationRequest, onInspectorTabChange]);

  useEffect(() => {
    if (previousInspectorTab.current === activeInspectorTab) return;
    previousInspectorTab.current = activeInspectorTab;
    if (activeInspectorTab === "events") { setActiveView("journal"); setJournalTab("events"); }
    else if (activeInspectorTab === "agent" || activeInspectorTab === "developer") { setActiveView("tools"); setToolTab(activeInspectorTab); }
    else if (activeInspectorTab === "logic" || activeInspectorTab === "people") setActiveView("deduction");
    // Selecting a map location also selects the investigation tab. It must keep
    // the player on the map; deliberate actions and navigation open the desk.
  }, [activeInspectorTab]);

  useEffect(() => {
    const enteredDesk = previousActiveView.current !== activeView;
    previousActiveView.current = activeView;
    const reviewRequested = activeView === "deduction" && activeInspectorTab === "logic";
    if (!enteredDesk && !reviewRequested) return;
    const frame = window.requestAnimationFrame(() => viewHeadingRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [activeInspectorTab, activeView]);

  useEffect(() => {
    const feedback = viewModel.presentationFeedback;
    const previous = previousFeedbackSignature.current;
    previousFeedbackSignature.current = feedback.signature;
    if (previous === feedback.signature || feedback.audioCue === "none") return;
    window.dispatchEvent(new CustomEvent("detective-town:audio-cue", { detail: { cue: feedback.audioCue, state: feedback.state, tone: feedback.tone } }));
  }, [viewModel.presentationFeedback]);

  useEffect(() => {
  }, [overlayResolution.locksPanels]);

  useEffect(() => {
    if (!transitionVisible || blockingOverlayActive) return;
    const frame = window.requestAnimationFrame(() => theatreHeadingRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [blockingOverlayActive, theatre.presentation.phase, transitionVisible]);

  function navigate(view: NoirPlayerView, focus = true) {
    if (navigationLocked) return;
    if (view === "deduction" && document.activeElement instanceof HTMLElement) deskTriggerRef.current = document.activeElement;
    setActiveView(view);
    if (view === "deduction") { previousInspectorTab.current = "investigation"; onInspectorTabChange?.("investigation"); }
    if (view === "journal") { previousInspectorTab.current = "events"; setJournalTab("events"); onInspectorTabChange?.("events"); }
    if (focus) window.requestAnimationFrame(() => viewHeadingRef.current?.focus({ preventScroll: true }));
  }

  function selectInspector(tab: InspectorTabId) {
    previousInspectorTab.current = tab;
    onInspectorTabChange?.(tab);
  }

  function closeTopSurface() {
    if (blockingOverlayActive) return false;
    if (transitionVisible) {
      theatre.dismiss();
      window.requestAnimationFrame(() => {
        const trigger = theatreTriggerRef.current;
        if (trigger?.isConnected) trigger.focus();
        else navigationRefs.current[activeViewRef.current]?.focus();
      });
      return true;
    }
    if (activeView !== "explore" && !resolving) {
      setActiveView("explore");
      window.requestAnimationFrame(() => {
        const trigger = deskTriggerRef.current;
        if (trigger?.isConnected) trigger.focus();
        else navigationRefs.current.explore?.focus();
        deskTriggerRef.current = null;
      });
      return true;
    }
    return false;
  }

  function handleShellKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.defaultPrevented) return;
    if (event.key === "Escape") { if (closeTopSurface()) event.preventDefault(); return; }
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (navigationLocked || event.metaKey || event.ctrlKey || event.altKey || target?.closest("input, textarea, select, [contenteditable='true']")) return;
    if ((event.key === "Enter" || event.key === " ") && activeView === "explore" && primary && !target?.closest("button, a, summary")) { event.preventDefault(); void handleStrategicAction(primary); }
  }

  async function handleStrategicAction(action: StrategicCommandAction) {
    theatreTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const actionNeedsDesk = action.target === "show-world-choice" || action.target === "show-headquarters" || action.target === "show-operations" || action.target === "review-outcome"
      || action.target === "show-investigation" && !["join", "search", "observe"].includes(viewModel.currentObjective.action);
    if (actionNeedsDesk) {
      deskTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setActiveView("deduction"); selectInspector("investigation");
    }
    if (action.target === "show-next-case") { setActiveView("tools"); setToolTab("agent"); }
    await pacing.runAction(action, (selected) => onStrategicAction?.(selected));
  }

  async function handleContextAction(kind: SafeContextActionKind) {
    const strategicAction = viewModel.decisionQueue.find((action) => action.contextActionKind === kind && action.enabled);
    if (kind === "question" || kind === "challenge") {
      deskTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setActiveView("deduction"); selectInspector("investigation");
    }
    if (strategicAction) await handleStrategicAction(strategicAction);
    else {
      const definition = getInvestigationActionDefinition(kind);
      await pacing.runAction({ kind: "certified-investigation", target: "context-action", contextActionKind: kind, label: definition.label, detail: definition.detail, benefitLabel: definition.label, costLabel: "", enabled: Boolean(onContextAction), blocking: false, priority: 0 }, () => onContextAction?.(kind));
    }
  }

  const navItems = [
    { id: "explore" as const, label: copy.explore, icon: Compass, ordinal: "01" },
    { id: "deduction" as const, label: copy.deduction, icon: Fingerprint, ordinal: "02" },
    { id: "journal" as const, label: copy.journal, icon: BookOpen, ordinal: "03" },
    { id: "settings" as const, label: copy.settings, icon: Settings2, ordinal: "04" }
  ];

  return <CampaignResolutionLedgerProvider ledger={resolutionLedger} phase={theatre.presentation.phase}>
    <InvestigationActionExecutionProvider run={async (label, execute) => {
      theatreTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      await pacing.runAction({ kind: "certified-investigation", target: "show-investigation", label, detail: label, benefitLabel: label, costLabel: "", enabled: true, blocking: false, priority: 0 }, execute);
    }}>
        <main ref={mainRef} className={`noir-player ${styles.commandDeckShell}`} data-testid="command-deck-shell" data-player-view={activeView} data-map-lens={activeMapLens} data-current-objective={viewModel.currentObjective.action} data-primary-action-kind={primary?.kind || "none"} data-presentation-state={viewModel.presentationFeedback.state} data-presentation-tone={viewModel.presentationFeedback.tone} data-pacing-phase={pacing.viewModel.phase} data-focus-target={pacing.viewModel.focusTarget} data-command-brief-status={brief.status} data-command-brief-focus={brief.focus.target} data-resolution-ledger-status={resolutionLedger.status} data-resolution-ledger-count={resolutionLedger.entryCount} data-active-panel="none" data-dominant-overlay={overlayResolution.dominant} data-suspend-encounter={overlayResolution.suspendEncounter ? "true" : "false"} data-suspend-location-hover={overlayResolution.suspendLocationHover ? "true" : "false"} data-low-sensory={audio?.lowSensory ? "true" : "false"} onKeyDown={handleShellKeyDown}>
        <header className={styles.masthead} data-testid="command-deck-pulse">
          <button className={styles.brand} type="button" onClick={onOpenCampaign || (() => navigate("explore"))} disabled={navigationLocked} aria-label={copy.browse}><span className={styles.brandMark} aria-hidden="true">D<span>T</span></span><span className={styles.brandWordmark}>DETECTIVE<br /><b>TOWN</b></span></button>
          <div className={styles.caseIdentity}><span>{text(viewModel.townPulse.campaignLabel || copy.archive)}</span><strong>{text(viewModel.townPulse.caseLabel)}</strong></div>
          <div className={styles.townTime}><Clock3 size={14} aria-hidden="true" /><span>{text(viewModel.townPulse.timeLabel)}</span><i aria-hidden="true" /></div>
          <button type="button" className={styles.archiveButton} onClick={onOpenCampaign || (() => navigate("tools"))} disabled={navigationLocked}><FolderOpen size={16} aria-hidden="true" /><span>{copy.archive}</span></button>
        </header>
        <div className={styles.navigationBar}>
          <nav className={styles.primaryNavigation} aria-label={cn ? "玩家导航" : "Player navigation"}>
            {navItems.map(({ id, label, icon: Icon, ordinal }) => <button ref={(node) => { navigationRefs.current[id] = node; }} key={id} type="button" aria-current={activeView === id ? "page" : undefined} data-testid={`noir-nav-${id}`} disabled={navigationLocked} onClick={() => navigate(id, false)}><small>{ordinal}</small><Icon size={16} aria-hidden="true" /><span>{label}</span></button>)}
          </nav>
        <button ref={(node) => { navigationRefs.current.tools = node; }} type="button" className={styles.toolsEntry} aria-label={copy.tools} aria-current={activeView === "tools" ? "page" : undefined} disabled={navigationLocked} onClick={() => navigate("tools", false)} data-testid="noir-nav-tools"><Wrench size={14} aria-hidden="true" /><span>{copy.tools}</span></button>
        </div>
        <div className={styles.playerBody} inert={blockingOverlayActive || transitionVisible ? true : undefined}>
          {activeView === "explore" ? <>
            <section className={styles.objectiveBar} aria-label={copy.current} data-testid="noir-current-action">
              <div className={styles.objectiveCopy}><span>{copy.goal}</span><h1 ref={viewHeadingRef} tabIndex={-1}>{text(brief.objective.title)}</h1><p>{text(brief.objective.detail)}</p></div>
              <div className={styles.objectiveAction}><small>{text(viewModel.caseRhythm?.progressLabel || brief.objective.progressLabel)}</small>{primary ? <button type="button" className={styles.primaryAction} data-command-deck-primary="true" data-testid="strategic-primary-action" disabled={!primary.enabled || !onStrategicAction || resolving} title={text(primary.disabledReason || primary.detail)} onClick={() => void handleStrategicAction(primary)}><span>{text(resolving ? viewModel.presentationFeedback.label : primary.label)}</span><ArrowRight size={18} aria-hidden="true" /></button> : <span className={styles.quietStatus}>{viewModel.runtimeMode === "static-demo" ? copy.readonly : copy.waiting}</span>}</div>
            </section>
            <section className={styles.commandDeckMapArea} data-testid="command-deck-map-area" aria-label={copy.explore}>
              {map}
            </section>
            {viewModel.selectedContext && viewModel.selectedContext.kind !== "actor" && contextualActions.length > 0 && <section className={styles.contextStrip} aria-label={copy.context}><span><small>{copy.context}</small><b>{text(viewModel.selectedContext.label)}</b></span><div>{contextualActions.map((action) => <button type="button" key={action.kind} data-testid="command-deck-context-action" disabled={!action.enabled || !onContextAction || resolving} title={text(action.disabledReason || action.detail)} onClick={() => void handleContextAction(action.kind)}>{text(action.label)}<ArrowRight size={14} aria-hidden="true" /></button>)}</div></section>}
            {resultVisible && !toastVisible && <section className={styles.resultStrip} data-testid="command-deck-feedback" data-feedback-state={resolutionLedger.status} role="status"><span>{copy.result}</span><p>{text(resolutionLedger.latest.chain.result)}</p><button type="button" onClick={() => { navigate("journal"); setJournalTab("decisions"); }}>{copy.actionHistory}<ArrowRight size={14} aria-hidden="true" /></button></section>}
          </> : null}
          {activeView === "deduction" && <section className={styles.deductionWorkspace} data-testid="noir-deduction-workspace">
            <header className={styles.workspaceHeading}>
              <span>{cn ? "案件工作区 / 单一路径" : "CASE WORKSPACE / SINGLE PATH"}</span>
              <h1 ref={viewHeadingRef} tabIndex={-1}>{cn ? "现场证据 → 人物关系 → 推理链" : "Field evidence → People → Deduction chain"}</h1>
              <p>{cn ? "沿着一条调查路径推进；证据、证词和结论会保留在同一案件会话中。" : "Follow one investigation path. Evidence, testimony and theory stay in the same case session."}</p>
            </header>
            <div className={styles.workspaceContent}>{panels ? (activeInspectorTab === "logic" ? panel("logic") || panel("investigation") : panel("investigation")) : inspector}</div>
          </section>}
          {activeView === "journal" && <section className={styles.readingPage} data-testid="noir-journal"><header className={styles.pageHeading}><span>FIELD NOTES / {copy.journal}</span><h1 ref={viewHeadingRef} tabIndex={-1}>{copy.journalTitle}</h1><p>{copy.journalDetail}</p></header><nav className={styles.sectionTabs} aria-label={copy.journal}><button type="button" aria-pressed={journalTab === "events"} onClick={() => setJournalTab("events")}>{copy.events}</button><button type="button" aria-pressed={journalTab === "decisions"} onClick={() => setJournalTab("decisions")}>{copy.decisions}<span>{number(resolutionLedger.entryCount)}</span></button></nav>{journalTab === "events" ? <div className={styles.eventJournal}>{panel("events") || inspector}</div> : <div className={styles.journalEntries} data-testid="campaign-resolution-ledger">{resolutionLedger.entries.length ? resolutionLedger.entries.map((entry, index) => <article key={entry.signature} data-testid="campaign-resolution-entry"><span className={styles.entryNumber}>{number(resolutionLedger.entryCount - index).padStart(2, "0")}</span><div><span className={styles.entryStatus}>{text(entry.status)}</span><h2>{text(entry.actionLabel)}</h2><p>{text(entry.chain.result)}</p><dl><div><dt>{cn ? "小镇的回应" : "Town response"}</dt><dd>{text(entry.chain.worldChange)}</dd></div><div><dt>{copy.progress}</dt><dd>{text(entry.chain.objectiveProgress)}</dd></div><div><dt>{copy.next}</dt><dd>{text(entry.chain.nextAction)}</dd></div></dl></div></article>) : <p className={styles.emptyState}>{copy.empty}</p>}</div>}</section>}
          {activeView === "settings" && <section className={styles.readingPage} data-testid="noir-settings"><header className={styles.pageHeading}><span>PREFERENCES / {copy.settings}</span><h1 ref={viewHeadingRef} tabIndex={-1}>{copy.settingsTitle}</h1><p>{copy.settingsDetail}</p></header><div className={styles.settingsGrid}><section><div className={styles.settingLabel}><Languages size={21} aria-hidden="true" /><div><h2>{copy.language}</h2><p>{copy.languageDetail}</p></div></div><div className={styles.optionPair}><button type="button" aria-pressed={locale === "zh-CN"} onClick={() => setLocale("zh-CN")}>简体中文</button><button type="button" aria-pressed={locale === "en-US"} onClick={() => setLocale("en-US")}>English</button></div></section>{audio && <><section><div className={styles.settingLabel}><Headphones size={21} aria-hidden="true" /><div><h2>{copy.sound}</h2><p>{copy.soundDetail}</p></div></div><button type="button" className={styles.settingToggle} aria-pressed={!audio.muted} onClick={() => { void audio.onUnlock(); audio.onToggleMuted(); }}>{audio.muted ? <VolumeX size={17} aria-hidden="true" /> : <Volume2 size={17} aria-hidden="true" />}{audio.muted ? copy.soundOff : copy.soundOn}<i aria-hidden="true" /></button><label className={styles.volumeControl}><span>{copy.volume}<b>{number(Math.round(audio.master * 100))}%</b></span><input type="range" min="0" max="1" step="0.05" value={audio.master} onChange={(event) => audio.onMasterVolume(Number(event.target.value))} /></label></section><section><div className={styles.settingLabel}><Settings2 size={21} aria-hidden="true" /><div><h2>{copy.sensory}</h2><p>{copy.sensoryDetail}</p></div></div><button type="button" className={styles.settingToggle} aria-pressed={audio.lowSensory} onClick={audio.onToggleLowSensory}>{audio.lowSensory ? copy.on : copy.off}<i aria-hidden="true" /></button></section></>}<section className={styles.resourceOverview}><h2>{copy.resources}</h2><dl>{viewModel.resourceRibbon.map((item) => <div key={item.kind}><dt>{text(item.label)}</dt><dd>{text(item.value)}</dd></div>)}</dl></section></div></section>}
          {activeView === "tools" && <section className={styles.toolsPage} data-testid="noir-tools"><header className={styles.pageHeading}><span>STUDIO / {copy.tools}</span><h1 ref={viewHeadingRef} tabIndex={-1}>{copy.toolsTitle}</h1><p>{copy.toolsDetail}</p></header><p className={styles.adminLinkRow}><Link href="/admin/operations">打开运维观察</Link><span>只读 · 受保护</span></p><nav className={styles.sectionTabs} aria-label={copy.tools}>{([{ id: "world", label: copy.world }, { id: "agent", label: copy.agents }, { id: "developer", label: copy.developer }] as const).map((item) => <button type="button" key={item.id} aria-pressed={toolTab === item.id} onClick={() => { setToolTab(item.id); if (item.id !== "world") selectInspector(item.id); }}>{item.label}</button>)}</nav><div className={styles.toolsContent}>{toolTab === "world" ? control : panel(toolTab) || inspector}</div></section>}
        </div>
        {!blockingOverlayActive && transitionVisible && <div className={styles.transitionStage}><CampaignTransitionTheatre presentation={theatre.presentation} ledger={resolutionLedger} headingRef={theatreHeadingRef} onSkip={theatre.skip} onDismiss={() => closeTopSurface()} /></div>}
        {overlay}
        {!blockingOverlayActive && !transitionVisible ? toasts : null}
      </main>
    </InvestigationActionExecutionProvider>
  </CampaignResolutionLedgerProvider>;
}
