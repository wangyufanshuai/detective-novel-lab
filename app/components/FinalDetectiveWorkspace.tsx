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

const EVIDENCE_ACTION_LABELS = {
  "focus-source": "Focus source",
  "prepare-challenge": "Prepare challenge",
  "add-theory": "Add to theory",
  "remove-theory": "Remove from theory"
} as const;

function statusLabel(value: boolean) {
  return value ? "complete" : "missing";
}

export function FinalDetectiveWorkspace({
  model, currentAction, notebookItems, discoveredEvidence, characters, actionAdapter,
  onIntakeNextAction, onNotebookAction, selectedCharacterId, setSelectedCharacterId,
  selectedEvidenceId, setSelectedEvidenceId, question, setQuestion, theory, setTheory,
  submitTheory, gapCards, onGapSelect, onCampaignRecoveryStart, busy
}: FinalDetectiveWorkspaceProps) {
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

  function runEvidenceAction(sourceIndex: number, action: keyof typeof EVIDENCE_ACTION_LABELS) {
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
      aria-label="Final Detective Workspace"
    >
      <header className={styles.objective} data-testid="final-workspace-objective">
        <div><span>{model.objective.phase} / Current Objective</span><h2>{model.objective.title}</h2><p>{model.objective.detail}</p></div>
        <b>{model.objective.progressLabel}</b>
        <nav aria-label="Certified investigation progress">
          {model.progress.map((item) => <span key={item.key} className={styles[item.state]}><strong>{item.label}</strong><small>{item.metric}</small></span>)}
        </nav>
      </header>

      <section className={styles.currentTask} data-testid="case-intake-next-action">
        <span>Current Task / {model.stage}</span><strong>{model.currentTask.label}</strong><p>{model.currentTask.detail}</p><b>{model.currentTask.metric}</b>
      </section>

      <div className={styles.workspaceGrid} data-testid="final-workspace-active-area">
        <aside className={styles.intelligence} aria-label="Evidence and testimony">
          <section className={styles.pane} data-testid="final-workspace-evidence">
            <header><div><FileSearch size={16} /><span>Evidence</span></div><b>{model.evidence.discoveredCount}/{model.evidence.totalCount} found · {model.evidence.selectedCount} selected</b></header>
            <div className={styles.cardList}>
              {model.evidence.rows.map((item) => (
                <article key={item.key} className={`${styles.card} ${styles[item.state]} ${item.current ? styles.current : ""}`}>
                  <span>{item.state} / {item.provenanceLabel}</span><strong>{item.title}</strong><p>{item.description}</p>
                  {!!item.supportLabels.length && <div className={styles.tags}>{item.supportLabels.map((label) => <em key={`${item.key}:s:${label}`}>supports {label}</em>)}</div>}
                  {!!item.contradictionLabels.length && <div className={styles.tags}>{item.contradictionLabels.map((label) => <em className={styles.warning} key={`${item.key}:c:${label}`}>tests {label}</em>)}</div>}
                  <div className={styles.contextActions}>{item.actions.map((action) => <button type="button" key={action} onClick={() => runEvidenceAction(item.sourceIndex, action)} disabled={busy}>{EVIDENCE_ACTION_LABELS[action]}</button>)}</div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.pane} data-testid="final-workspace-testimony">
            <header><div><MessageSquare size={16} /><span>Testimony</span></div><b>{model.testimony.questionedCount}/{model.testimony.totalCount} heard · {model.testimony.contradictionCount} challenged</b></header>
            <div className={styles.cardList}>
              {model.testimony.rows.map((item) => (
                <button type="button" key={item.key} className={`${styles.card} ${styles.testimonyCard} ${styles[item.state]} ${item.selected ? styles.current : ""}`} onClick={() => setSelectedCharacterId(characters[item.characterIndex]?.id || "")}>
                  <span>{item.state} / {item.roleLabel}</span><strong>{item.actorName}</strong><p>{item.statement}</p>
                  {!!item.evidenceLabels.length && <small>Presented: {item.evidenceLabels.join(" / ")}</small>}
                  {!!item.contradictionLabels.length && <small>Exposed: {item.contradictionLabels.join(" / ")}</small>}
                </button>
              ))}
            </div>
          </section>
        </aside>

        <main className={styles.context} aria-label="Active investigation context">
          <section className={styles.pane} data-testid="final-workspace-context">
            <header><div><BookOpenCheck size={16} /><span>Active Context</span></div><b>{model.activeContext.locationLabel}</b></header>
            <dl className={styles.contextSummary}>
              <div><dt>Witness</dt><dd>{model.activeContext.actorLabel}</dd></div>
              <div><dt>Public statement</dt><dd>{model.activeContext.testimonyLabel}</dd></div>
              <div><dt>Visible scope</dt><dd>{model.activeContext.scopeLabel}</dd></div>
            </dl>
            <label>Witness
              <select value={selectedCharacterIndex >= 0 ? String(selectedCharacterIndex) : ""} onChange={(event) => setSelectedCharacterId(characters[Number(event.target.value)]?.id || "")}>
                <option value="">Choose a witness</option>
                {model.testimony.rows.map((item) => <option key={item.key} value={item.characterIndex}>{item.actorName} · {item.roleLabel}</option>)}
              </select>
            </label>
            <label>Discovered clue
              <select value={selectedEvidenceIndex >= 0 ? String(selectedEvidenceIndex) : ""} onChange={(event) => setSelectedEvidenceId(notebookItems[Number(event.target.value)]?.evidenceId || "")}>
                <option value="">No clue presented</option>
                {model.evidence.rows.filter((item) => item.state !== "locked").map((item) => <option key={item.key} value={item.sourceIndex}>{item.title}</option>)}
              </select>
            </label>
            <label>Question or challenge
              <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about the public incident window or test one statement with a discovered clue." />
            </label>
          </section>

          <section className={styles.pane} data-testid="final-workspace-contradictions">
            <header><div><ShieldCheck size={16} /><span>Contradictions</span></div><b>{model.contradictions.length} visible relation(s)</b></header>
            <div className={styles.cardList}>
              {model.contradictions.length ? model.contradictions.map((item) => <article key={item.key} className={`${styles.card} ${styles[item.state]}`}><span>{item.state}</span><strong>{item.label}</strong><p>{item.detail}</p></article>) : <p className={styles.empty}>Question witnesses and discover clues before testing a public contradiction.</p>}
            </div>
          </section>

          {model.recovery.state !== "empty" && <section className={`${styles.pane} ${styles.recovery}`} data-testid="final-workspace-recovery">
            <header><div><ShieldCheck size={16} /><span>Recovery</span></div><b>{model.recovery.state}</b></header>
            <strong>{model.recovery.label}</strong><p>{model.recovery.detail}</p><small>{model.recovery.costLabel}</small><em>{model.recovery.nextAction}</em>
          </section>}
        </main>

        <aside className={styles.theory} aria-label="Theory workspace">
          <section className={styles.pane} data-testid="final-workspace-theory" data-theory-state={model.theory.state}>
            <header><div><ShieldCheck size={16} /><span>Theory</span></div><b>{model.theory.statusLabel}</b></header>
            <div className={styles.readiness}>
              <span data-complete={model.theory.suspectComplete}><b>{statusLabel(model.theory.suspectComplete)}</b>suspect</span>
              <span data-complete={model.theory.motiveComplete}><b>{statusLabel(model.theory.motiveComplete)}</b>motive</span>
              <span data-complete={model.theory.methodComplete}><b>{statusLabel(model.theory.methodComplete)}</b>method</span>
              <span data-complete={model.theory.evidenceComplete}><b>{model.theory.selectedEvidenceCount}</b>evidence</span>
            </div>
            <label>Suspect hypothesis
              <select data-testid="theory-culprit" value={selectedSuspectIndex >= 0 ? String(selectedSuspectIndex) : ""} onChange={(event) => setTheory((current) => ({ ...current, culpritId: characters[Number(event.target.value)]?.id || "" }))}>
                <option value="">Choose a suspect</option>{characters.map((character, index) => <option key={character.id} value={index}>{character.name}</option>)}
              </select>
            </label>
            <label>Motive hypothesis<textarea placeholder="Explain the pressure or conflict supported by discovered clues." value={theory.motive} onChange={(event) => setTheory((current) => ({ ...current, motive: event.target.value }))} /></label>
            <label>Method hypothesis<textarea placeholder="Explain the means and scene mechanism supported by discovered clues." value={theory.method} onChange={(event) => setTheory((current) => ({ ...current, method: event.target.value }))} /></label>
            <div className={styles.selectedEvidence}><span>Selected evidence</span>{model.theory.selectedEvidenceLabels.length ? model.theory.selectedEvidenceLabels.map((label) => <b key={label}>{label}</b>) : <small>Select discovered clues from the Evidence pane.</small>}</div>
            {!!model.theory.missingCategories.length && <div className={styles.missing}><span>Public gaps</span>{model.theory.missingCategories.map((label) => <b key={label}>{label}</b>)}</div>}
          </section>
        </aside>
      </div>

      <section ref={sourceReviewRef} tabIndex={-1} className={`${styles.sourceReview} ${styles[model.sourceReview.state]}`} data-testid="source-review-unlock">
        <header><div><span>Source Review Unlock</span><strong>{model.sourceReview.statusLabel}</strong></div><b>{model.sourceReview.state === "locked" ? "accepted theory required" : "audit ready"}</b></header>
        <div className={styles.sourceMetrics}><span><b>{model.sourceReview.sourceCount}</b>source events</span><span><b>{model.sourceReview.coveredObligations}/{model.sourceReview.totalObligations}</b>covered obligations</span></div>
        {model.sourceReview.state === "locked" ? <small>Complete the certified route and submit an accepted theory before source labels and conclusion review are shown.</small> : <div className={styles.sourceGrid} data-testid="source-review-workbench">
          {(["source", "obligation", "route", "conclusion"] as const).map((category) => <section key={category} data-testid={`source-review-${category === "source" ? "trail" : category === "obligation" ? "obligations" : category}`}><strong>{category === "source" ? "Source Trail" : category === "obligation" ? "Proof Obligations" : category === "route" ? "Certified Route" : "Conclusion Review"}</strong>{model.sourceReview.rows.filter((item) => item.category === category).map((item) => <article key={item.key} className={styles[item.state]}><span>{item.state}</span><b>{item.label}</b><small>{item.detail}</small></article>)}</section>)}
        </div>}
      </section>

      <footer className={styles.actionBar} data-testid="final-workspace-current-action">
        <div><span>Current Action</span><strong>{model.currentTask.action.label}</strong><small id="final-workspace-action-detail">{model.currentTask.nextAction}</small></div>
        <button type="button" className={styles.primaryAction} data-testid="final-workspace-primary-action" data-action-kind={model.currentTask.action.kind} aria-describedby="final-workspace-action-detail" onClick={() => void runPrimaryAction()} disabled={busy || !model.currentTask.action.enabled}>
          <span data-testid="case-intake-next"><span data-testid="playable-path-next-action">
            {model.currentTask.action.kind === "join"
              ? <span data-testid="case-intake-join">{busy ? "Resolving…" : model.currentTask.action.label}</span>
              : model.currentTask.action.kind === "submit"
                ? <span data-testid="submit-theory">{busy ? "Resolving…" : model.currentTask.action.label}</span>
                : busy ? "Resolving…" : model.currentTask.action.label}
          </span></span>
        </button>
      </footer>

      {ledger && <section className={styles.resolution} data-testid="final-workspace-latest-resolution"><CampaignResolutionChain entry={ledger.latest} testId="final-workspace-resolution-chain" mode="history" /></section>}
      <small className={styles.boundary}>{model.authorityNote} The workspace stores no second selection state and never validates a theory in the browser.</small>
    </section>
  );
}
