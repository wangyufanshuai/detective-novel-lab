import type { Evidence, EvidenceNotebookItem, PlayableCaseNextAction, PlayerTheory } from "@/lib/engine";
import type { CertifiedInvestigationActionAdapter } from "@/app/hooks/useCertifiedInvestigationActions";
import type { FinalDetectiveWorkspaceActionKind } from "./final-detective-workspace-model";
import type { InvestigationActionResult } from "./investigation-action-result";

/** Dispatch the actual route action, including Observe within the Search phase. */
export async function executeCertifiedInvestigationStep(input: {
  kind: FinalDetectiveWorkspaceActionKind;
  action?: PlayableCaseNextAction;
  adapter: CertifiedInvestigationActionAdapter;
  observeCaseWindow: () => void | Promise<void>;
  focusStep: (action: PlayableCaseNextAction) => void;
  notebookItems: EvidenceNotebookItem[];
  discoveredEvidence: Evidence[];
  theory: PlayerTheory;
  selectedCharacterId?: string;
  selectedEvidenceId?: string;
  question?: string;
  submitTheory: () => InvestigationActionResult | Promise<InvestigationActionResult>;
  onRecover?: () => void | Promise<void>;
}): Promise<InvestigationActionResult> {
  const { kind, action, adapter } = input;
  if (kind === "join") return adapter.joinCase();
  if (kind === "observe" || (kind === "search" && action?.kind === "observe")) {
    await input.observeCaseWindow();
    return { status: "succeeded", detail: "Case window reviewed. Continue to search the scene." };
  }
  if (kind === "search") {
    if (action?.targetEvidenceId) return adapter.discoverEvidence(action.targetEvidenceId);
    const locationId = action?.targetLocationId || input.notebookItems.find((item) => !item.discovered)?.locationId;
    if (locationId) return adapter.discoverFirstSceneEvidence(locationId);
  }
  if (kind === "question" || kind === "challenge") {
    const characterId = action?.targetCharacterId || input.selectedCharacterId;
    const evidenceId = kind === "challenge" ? action?.targetEvidenceId || input.selectedEvidenceId : undefined;
    if (characterId && (kind !== "challenge" || evidenceId)) {
      const question = input.question?.trim() || (kind === "challenge"
        ? "Please explain this evidence and whether it changes your earlier statement."
        : "Where were you during the incident window, and what did you observe?");
      return adapter.runInterrogationTarget(characterId, evidenceId, question);
    }
  }
  if (kind === "select-evidence") {
    const clue = input.discoveredEvidence.find((item) => !input.theory.evidenceIds.includes(item.id));
    if (clue) {
      adapter.toggleTheoryEvidence(clue.id);
      return { status: "succeeded", detail: "Discovered evidence added to the theory." };
    }
  }
  if (kind === "submit") return input.submitTheory();
  if (kind === "review-source") return adapter.revealSolution();
  if (kind === "recover" && input.onRecover) {
    await input.onRecover();
    return { status: "succeeded", detail: "Theory recovery opened. Review the visible recovery status." };
  }
  if (action) input.focusStep(action);
  return { status: "blocked", detail: "Choose the required witness or discovered evidence before continuing." };
}
