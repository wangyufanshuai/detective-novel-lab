"use client";

import { useRef } from "react";
import { BookOpenCheck, FileSearch, MessageSquare, ShieldCheck } from "lucide-react";
import {
  CampaignResolutionChain,
  useCampaignResolutionLedgerContext
} from "@/app/components/CampaignResolutionLedger";
import type { FinalDetectiveWorkspace } from "@/app/campaign/final-detective-workspace-model";
import type { GapCard, NotebookAction } from "@/app/campaign/investigation-workspace-model";
import type { CertifiedInvestigationActionAdapter } from "@/app/hooks/useCertifiedInvestigationActions";
import { useAppLocale } from "@/app/localization/locale-context";
import type { LocaleMessageKey } from "@/app/localization/locale-catalog";
import type {
  DeductionCase,
  Evidence,
  EvidenceNotebookItem,
  PlayableCaseNextAction,
  PlayerTheory
} from "@/lib/engine";
import styles from "./FinalDetectiveWorkspace.module.css";

export type FinalDetectiveWorkspaceProps = {
  model: FinalDetectiveWorkspace;
  currentAction?: PlayableCaseNextAction;
  notebookItems: EvidenceNotebookItem[];
  discoveredEvidence: Evidence[];
  characters: DeductionCase["characters"];
  actionAdapter: CertifiedInvestigationActionAdapter;
  onIntakeNextAction: (action: PlayableCaseNextAction) => void;
  onNotebookAction: (item: EvidenceNotebookItem, action: NotebookAction) => void;
  selectedCharacterId: string;
  setSelectedCharacterId: (value: string) => void;
  selectedEvidenceId: string;
  setSelectedEvidenceId: (value: string) => void;
  question: string;
  setQuestion: (value: string) => void;
  theory: PlayerTheory;
  setTheory: (updater: (current: PlayerTheory) => PlayerTheory) => void;
  submitTheory: () => void;
  gapCards: GapCard[];
  onGapSelect: (card: GapCard) => void;
  onCampaignRecoveryStart?: () => void;
  busy: boolean;
};

const EVIDENCE_ACTION_KEYS: Record<"focus-source" | "prepare-challenge" | "add-theory" | "remove-theory", LocaleMessageKey> = {
  "focus-source": "workspace.focusSource",
  "prepare-challenge": "workspace.prepareChallenge",
  "add-theory": "workspace.addTheory",
  "remove-theory": "workspace.removeTheory"
} as const;

export function FinalDetectiveWorkspace({
  model, currentAction, notebookItems, discoveredEvidence, characters, actionAdapter,
  onIntakeNextAction, onNotebookAction, selectedCharacterId, setSelectedCharacterId,
  selectedEvidenceId, setSelectedEvidenceId, question, setQuestion, theory, setTheory,
  submitTheory, gapCards, onGapSelect, onCampaignRecoveryStart, busy
}: FinalDetectiveWorkspaceProps) {
  const { number, t, text } = useAppLocale();
  const ledger = useCampaignResolutionLedgerContext();
  const sourceReviewRef = useRef<HTMLElement>(null);
  const selectedCharacterIndex = characters.findIndex((item) => item.id === selectedCharacterId);
  const selectedEvidenceIndex = notebookItems.findIndex((item) => item.evidenceId === selectedEvidenceId);
  const selectedSuspectIndex = characters.findIndex((item) => item.id === theory.culpritId);

  function focusSourceReview() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sourceReviewRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    sourceReviewRef.current?.focus({ preventScroll: true });
  }

  async function runPrimaryAction() {
    if (busy || !model.currentTask.action.enabled) return;
    const kind = model.currentTask.action.kind;
    if (kind === "join") {
      await actionAdapter.joinCase();
      return;
    }
    if (kind === "search") {
      if (currentAction?.targetEvidenceId) await actionAdapter.discoverEvidence(currentAction.targetEvidenceId);
      else if (currentAction?.targetLocationId) await actionAdapter.discoverFirstSceneEvidence(currentAction.targetLocationId);
      else {
        const target = notebookItems.find((item) => !item.discovered);
        if (target) onNotebookAction(target, "source");
        else if (currentAction) onIntakeNextAction(currentAction);
      }
      return;
    }
    if (kind === "question" || kind === "challenge") {
      const characterId = currentAction?.targetCharacterId || selectedCharacterId;
      const evidenceId = kind === "challenge" ? currentAction?.targetEvidenceId || selectedEvidenceId || undefined : selectedEvidenceId || undefined;
      const prompt = question.trim() || (kind === "challenge"
        ? "Please explain whether this discovered clue changes your earlier public statement."
        : "Where were you during the incident window, and what did you observe?");
      if (!currentAction?.targetCharacterId && question.trim() && characterId === selectedCharacterId) await actionAdapter.interrogateSelected();
      else if (characterId) await actionAdapter.runInterrogationTarget(characterId, evidenceId, prompt);
      else if (currentAction) onIntakeNextAction(currentAction);
      return;
    }
    if (kind === "select-evidence") {
      const target = discoveredEvidence.find((item) => !theory.evidenceIds.includes(item.id));
      if (target) actionAdapter.toggleTheoryEvidence(target.id);
      else if (currentAction) onIntakeNextAction(currentAction);
      return;
    }
    if (kind === "submit") {
      submitTheory();
      return;
    }
    if (kind === "recover") {
      if (model.runtimeMode === "server" && model.recovery.state === "ready" && onCampaignRecoveryStart) onCampaignRecoveryStart();
      else if (gapCards[0]) onGapSelect(gapCards[0]);
      return;
    }
    if (model.sourceReview.state === "unlocked") await actionAdapter.revealSolution();
    focusSourceReview();
  }

  function runEvidenceAction(sourceIndex: number, action: keyof typeof EVIDENCE_ACTION_KEYS) {
    const item = notebookItems[sourceIndex];
    if (!item) return;
    if (action === "focus-source") onNotebookAction(item, "source");
    else if (action === "prepare-challenge") onNotebookAction(item, "challenge");
    else actionAdapter.toggleTheoryEvidence(item.evidenceId);
  }

  return (
    <section
      className={styles.workspace}
      data-testid="final-detective-workspace"
      data-workspace-stage={model.stage}
      data-workspace-runtime={model.runtimeMode}
      aria-label={t("workspace.aria")}
    >
      <header className={styles.objective} data-testid="final-workspace-objective">
        <div><span>{text(model.objective.phase)} / {t("workspace.objective")}</span><h2>{text(model.objective.title)}</h2><p>{text(model.objective.detail)}</p></div>
        <b>{text(model.objective.progressLabel)}</b>
        <nav aria-label={t("workspace.progress")}>
          {model.progress.map((item) => <span key={item.key} className={styles[item.state]}><strong>{text(item.label)}</strong><small>{text(item.metric)}</small></span>)}
        </nav>
      </header>

      <section className={styles.currentTask} data-testid="case-intake-next-action">
        <span>{t("workspace.task")} / {text(model.stage)}</span><strong>{text(model.currentTask.label)}</strong><p>{text(model.currentTask.detail)}</p><b>{text(model.currentTask.metric)}</b>
      </section>

      <div className={styles.workspaceGrid} data-testid="final-workspace-active-area">
        <aside className={styles.intelligence} aria-label={t("workspace.evidenceTestimony")}>
          <section className={styles.pane} data-testid="final-workspace-evidence">
            <header><div><FileSearch size={16} aria-hidden="true" /><span>{t("workspace.evidence")}</span></div><b>{number(model.evidence.discoveredCount)}/{number(model.evidence.totalCount)} {t("workspace.found")} · {number(model.evidence.selectedCount)} {t("workspace.selected")}</b></header>
            <div className={styles.cardList}>
              {model.evidence.rows.map((item) => (
                <article key={item.key} className={`${styles.card} ${styles[item.state]} ${item.current ? styles.current : ""}`}>
                  <span>{text(item.state)} / {text(item.provenanceLabel)}</span><strong>{text(item.title)}</strong><p>{text(item.description)}</p>
                  {!!item.supportLabels.length && <div className={styles.tags}>{item.supportLabels.map((label) => <em key={`${item.key}:s:${label}`}>{t("workspace.supports")} {text(label)}</em>)}</div>}
                  {!!item.contradictionLabels.length && <div className={styles.tags}>{item.contradictionLabels.map((label) => <em className={styles.warning} key={`${item.key}:c:${label}`}>{t("workspace.tests")} {text(label)}</em>)}</div>}
                  <div className={styles.contextActions}>{item.actions.map((action) => <button type="button" key={action} onClick={() => runEvidenceAction(item.sourceIndex, action)} disabled={busy}>{t(EVIDENCE_ACTION_KEYS[action])}</button>)}</div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.pane} data-testid="final-workspace-testimony">
            <header><div><MessageSquare size={16} aria-hidden="true" /><span>{t("workspace.testimony")}</span></div><b>{number(model.testimony.questionedCount)}/{number(model.testimony.totalCount)} {t("workspace.heard")} · {number(model.testimony.contradictionCount)} {t("workspace.challenged")}</b></header>
            <div className={styles.cardList}>
              {model.testimony.rows.map((item) => (
                <button type="button" key={item.key} className={`${styles.card} ${styles.testimonyCard} ${styles[item.state]} ${item.selected ? styles.current : ""}`} aria-pressed={item.selected} onClick={() => setSelectedCharacterId(characters[item.characterIndex]?.id || "")}>
                  <span>{text(item.state)} / {text(item.roleLabel)}</span><strong>{text(item.actorName)}</strong><p>{text(item.statement)}</p>
                  {!!item.evidenceLabels.length && <small>{t("workspace.presented")} {item.evidenceLabels.map(text).join(" / ")}</small>}
                  {!!item.contradictionLabels.length && <small>{t("workspace.exposed")} {item.contradictionLabels.map(text).join(" / ")}</small>}
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className={styles.context} aria-label={t("workspace.contextAria")}>
          <section className={styles.pane} data-testid="final-workspace-context">
            <header><div><BookOpenCheck size={16} aria-hidden="true" /><span>{t("workspace.context")}</span></div><b>{text(model.activeContext.locationLabel)}</b></header>
            <dl className={styles.contextSummary}>
              <div><dt>{t("workspace.witness")}</dt><dd>{text(model.activeContext.actorLabel)}</dd></div>
              <div><dt>{t("workspace.statement")}</dt><dd>{text(model.activeContext.testimonyLabel)}</dd></div>
              <div><dt>{t("workspace.scope")}</dt><dd>{text(model.activeContext.scopeLabel)}</dd></div>
            </dl>
            <label>{t("workspace.witness")}
              <select name="investigation-witness" autoComplete="off" value={selectedCharacterIndex >= 0 ? String(selectedCharacterIndex) : ""} onChange={(event) => setSelectedCharacterId(characters[Number(event.target.value)]?.id || "")}>
                <option value="">{t("workspace.chooseWitness")}</option>
                {model.testimony.rows.map((item) => <option key={item.key} value={item.characterIndex}>{text(item.actorName)} · {text(item.roleLabel)}</option>)}
              </select>
            </label>
            <label>{t("workspace.clue")}
              <select name="investigation-clue" autoComplete="off" value={selectedEvidenceIndex >= 0 ? String(selectedEvidenceIndex) : ""} onChange={(event) => setSelectedEvidenceId(notebookItems[Number(event.target.value)]?.evidenceId || "")}>
                <option value="">{t("workspace.noClue")}</option>
                {model.evidence.rows.filter((item) => item.state !== "locked").map((item) => <option key={item.key} value={item.sourceIndex}>{text(item.title)}</option>)}
              </select>
            </label>
            <label>{t("workspace.question")}
              <textarea name="investigation-question" autoComplete="off" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t("workspace.questionPlaceholder")} />
            </label>
          </section>

          <section className={styles.pane} data-testid="final-workspace-contradictions">
            <header><div><ShieldCheck size={16} aria-hidden="true" /><span>{t("workspace.contradictions")}</span></div><b>{number(model.contradictions.length)} {t("workspace.relations")}</b></header>
            <div className={styles.cardList}>
              {model.contradictions.length ? model.contradictions.map((item) => <article key={item.key} className={`${styles.card} ${styles[item.state]}`}><span>{text(item.state)}</span><strong>{text(item.label)}</strong><p>{text(item.detail)}</p></article>) : <p className={styles.empty}>{t("workspace.contradictionsEmpty")}</p>}
            </div>
          </section>

          {model.recovery.state !== "empty" && <section className={`${styles.pane} ${styles.recovery}`} data-testid="final-workspace-recovery">
            <header><div><ShieldCheck size={16} aria-hidden="true" /><span>{t("workspace.recovery")}</span></div><b>{text(model.recovery.state)}</b></header>
            <strong>{text(model.recovery.label)}</strong><p>{text(model.recovery.detail)}</p><small>{text(model.recovery.costLabel)}</small><em>{text(model.recovery.nextAction)}</em>
          </section>}
        </section>

        <aside className={styles.theory} aria-label={t("workspace.theoryAria")}>
          <section className={styles.pane} data-testid="final-workspace-theory" data-theory-state={model.theory.state}>
            <header><div><ShieldCheck size={16} aria-hidden="true" /><span>{t("workspace.theory")}</span></div><b>{text(model.theory.statusLabel)}</b></header>
            <div className={styles.readiness}>
              <span data-complete={model.theory.suspectComplete}><b>{t(model.theory.suspectComplete ? "common.complete" : "common.missing")}</b>{t("workspace.suspect")}</span>
              <span data-complete={model.theory.motiveComplete}><b>{t(model.theory.motiveComplete ? "common.complete" : "common.missing")}</b>{t("workspace.motive")}</span>
              <span data-complete={model.theory.methodComplete}><b>{t(model.theory.methodComplete ? "common.complete" : "common.missing")}</b>{t("workspace.method")}</span>
              <span data-complete={model.theory.evidenceComplete}><b>{number(model.theory.selectedEvidenceCount)}</b>{t("workspace.theoryEvidence")}</span>
            </div>
            <label>{t("workspace.suspectHypothesis")}
              <select name="theory-suspect" autoComplete="off" data-testid="theory-culprit" value={selectedSuspectIndex >= 0 ? String(selectedSuspectIndex) : ""} onChange={(event) => setTheory((current) => ({ ...current, culpritId: characters[Number(event.target.value)]?.id || "" }))}>
                <option value="">{t("workspace.chooseSuspect")}</option>{characters.map((character, index) => <option key={character.id} value={index}>{text(character.name)}</option>)}
              </select>
            </label>
            <label>{t("workspace.motiveHypothesis")}<textarea name="theory-motive" autoComplete="off" placeholder={t("workspace.motivePlaceholder")} value={theory.motive} onChange={(event) => setTheory((current) => ({ ...current, motive: event.target.value }))} /></label>
            <label>{t("workspace.methodHypothesis")}<textarea name="theory-method" autoComplete="off" placeholder={t("workspace.methodPlaceholder")} value={theory.method} onChange={(event) => setTheory((current) => ({ ...current, method: event.target.value }))} /></label>
            <div className={styles.selectedEvidence}><span>{t("workspace.selectedEvidence")}</span>{model.theory.selectedEvidenceLabels.length ? model.theory.selectedEvidenceLabels.map((label) => <b key={label}>{text(label)}</b>) : <small>{t("workspace.selectEvidence")}</small>}</div>
            {!!model.theory.missingCategories.length && <div className={styles.missing}><span>{t("workspace.publicGaps")}</span>{model.theory.missingCategories.map((label) => <b key={label}>{text(label)}</b>)}</div>}
          </section>
        </aside>
      </div>

      <section ref={sourceReviewRef} tabIndex={-1} className={`${styles.sourceReview} ${styles[model.sourceReview.state]}`} data-testid="source-review-unlock">
        <header><div><span>{t("workspace.sourceReview")}</span><strong>{text(model.sourceReview.statusLabel)}</strong></div><b>{model.sourceReview.state === "locked" ? t("workspace.acceptedRequired") : t("workspace.auditReady")}</b></header>
        <div className={styles.sourceMetrics}><span><b>{number(model.sourceReview.sourceCount)}</b>{t("workspace.sourceEvents")}</span><span><b>{number(model.sourceReview.coveredObligations)}/{number(model.sourceReview.totalObligations)}</b>{t("workspace.covered")}</span></div>
        {model.sourceReview.state === "locked" ? <small>{t("workspace.sourceLocked")}</small> : <div className={styles.sourceGrid} data-testid="source-review-workbench">
          {(["source", "obligation", "route", "conclusion"] as const).map((category) => <section key={category} data-testid={`source-review-${category === "source" ? "trail" : category === "obligation" ? "obligations" : category}`}><strong>{category === "source" ? t("workspace.sourceTrail") : category === "obligation" ? t("workspace.proofObligations") : category === "route" ? t("workspace.certifiedRoute") : t("workspace.conclusion")}</strong>{model.sourceReview.rows.filter((item) => item.category === category).map((item) => <article key={item.key} className={styles[item.state]}><span>{text(item.state)}</span><b>{text(item.label)}</b><small>{text(item.detail)}</small></article>)}</section>)}
        </div>}
      </section>

      <footer className={styles.actionBar} data-testid="final-workspace-current-action">
        <div><span>{t("workspace.currentAction")}</span><strong>{text(model.currentTask.action.label)}</strong><small id="final-workspace-action-detail">{text(model.currentTask.nextAction)}</small></div>
        <button type="button" className={styles.primaryAction} data-testid="final-workspace-primary-action" data-action-kind={model.currentTask.action.kind} aria-describedby="final-workspace-action-detail" onClick={() => void runPrimaryAction()} disabled={busy || !model.currentTask.action.enabled}>
          <span data-testid="case-intake-next"><span data-testid="playable-path-next-action">
            {model.currentTask.action.kind === "join"
              ? <span data-testid="case-intake-join">{busy ? t("common.resolving") : text(model.currentTask.action.label)}</span>
              : model.currentTask.action.kind === "submit"
                ? <span data-testid="submit-theory">{busy ? t("common.resolving") : text(model.currentTask.action.label)}</span>
                : busy ? t("common.resolving") : text(model.currentTask.action.label)}
          </span></span>
        </button>
      </footer>

      {ledger && <section className={styles.resolution} data-testid="final-workspace-latest-resolution"><CampaignResolutionChain entry={ledger.latest} testId="final-workspace-resolution-chain" mode="history" /></section>}
      <small className={styles.boundary}>{text(model.authorityNote)} {t("workspace.boundary")}</small>
    </section>
  );
}
