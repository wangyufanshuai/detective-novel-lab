"use client";

import type { FinalDetectiveWorkspace } from "@/app/campaign/final-detective-workspace-model";
import type { GapCard, NotebookAction } from "@/app/campaign/investigation-workspace-model";
import type { CertifiedInvestigationActionAdapter } from "@/app/hooks/useCertifiedInvestigationActions";
import type { InvestigationActionResult } from "@/app/campaign/investigation-action-result";
import type { DeductionCase, Evidence, EvidenceNotebookItem, InterrogationLogEntry, PlayableCaseNextAction, PlayerTheory } from "@/lib/engine";
import { CinematicDeductionBoard } from "./CinematicDeductionBoard";
import styles from "./FinalDetectiveWorkspace.module.css";

export type FinalDetectiveWorkspaceProps = {
  model: FinalDetectiveWorkspace;
  currentAction?: PlayableCaseNextAction;
  observeCaseWindow: () => void | Promise<void>;
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
  dialogueLog?: InterrogationLogEntry[];
  question: string;
  setQuestion: (value: string) => void;
  theory: PlayerTheory;
  setTheory: (updater: (current: PlayerTheory) => PlayerTheory) => void;
  submitTheory: () => Promise<InvestigationActionResult>;
  gapCards: GapCard[];
  onGapSelect: (card: GapCard) => void;
  onCampaignRecoveryStart?: () => void;
  busy: boolean;
  lowSensory?: boolean;
  onToggleLowSensory?: () => void;
};

/** Every route uses the same controlled evidence desk and existing action adapter. */
export function FinalDetectiveWorkspace(props: FinalDetectiveWorkspaceProps) {
  return <section className={styles.workspace} data-testid="final-detective-workspace" data-workspace-stage={props.model.stage} data-workspace-runtime={props.model.runtimeMode}>
    <CinematicDeductionBoard {...props} variant="standard" lowSensory={props.lowSensory ?? true} />
  </section>;
}
