export type InvestigationActionKind =
  | "select-context"
  | "join"
  | "observe"
  | "search"
  | "question"
  | "challenge"
  | "select-evidence"
  | "edit-theory"
  | "submit"
  | "review"
  | "recover"
  | "inspect"
  | "advance";

export type InvestigationActionHandlerKey =
  | "selectContext"
  | "joinCase"
  | "showEvents"
  | "discoverSceneEvidence"
  | "interrogateCharacter"
  | "challengeTestimony"
  | "toggleTheoryEvidence"
  | "showTheory"
  | "submitTheory"
  | "showConclusion"
  | "showRecovery"
  | "showInstitution"
  | "showInvestigation";

export type InvestigationActionDefinition = {
  kind: InvestigationActionKind;
  label: string;
  detail: string;
  handlerKey: InvestigationActionHandlerKey;
  shortcut?: string;
  targetKinds: ReadonlyArray<"location" | "institution" | "actor" | "evidence" | "theory" | "none">;
};

/**
 * Presentation-only command catalog. Every entry delegates to an existing
 * authoritative handler; it never decides whether a case action is legal.
 */
export const INVESTIGATION_ACTION_REGISTRY = Object.freeze({
  "select-context": {
    kind: "select-context",
    label: "Select a public object",
    detail: "Choose a location, character, institution, or discovered clue on the map.",
    handlerKey: "selectContext",
    targetKinds: ["none"]
  },
  join: {
    kind: "join",
    label: "Join investigation",
    detail: "Create the player session used by the existing certified investigation route.",
    handlerKey: "joinCase",
    shortcut: "J",
    targetKinds: ["location", "actor", "evidence", "theory"]
  },
  observe: {
    kind: "observe",
    label: "Observe case window",
    detail: "Review the public event window before acting on the certified route.",
    handlerKey: "showEvents",
    shortcut: "O",
    targetKinds: ["location", "actor", "evidence", "theory"]
  },
  search: {
    kind: "search",
    label: "Search location",
    detail: "Inspect this public place through the existing certified search handler.",
    handlerKey: "discoverSceneEvidence",
    shortcut: "S",
    targetKinds: ["location"]
  },
  question: {
    kind: "question",
    label: "Question character",
    detail: "Ask the prepared focused question through the existing memory-scoped interrogation handler.",
    handlerKey: "interrogateCharacter",
    shortcut: "Q",
    targetKinds: ["actor"]
  },
  challenge: {
    kind: "challenge",
    label: "Challenge testimony",
    detail: "Use a discovered clue with the existing contradiction handler.",
    handlerKey: "challengeTestimony",
    shortcut: "C",
    targetKinds: ["actor"]
  },
  "select-evidence": {
    kind: "select-evidence",
    label: "Add clue to theory",
    detail: "Add or remove this discovered clue from the current theory evidence set.",
    handlerKey: "toggleTheoryEvidence",
    shortcut: "E",
    targetKinds: ["evidence"]
  },
  "edit-theory": {
    kind: "edit-theory",
    label: "Open theory workspace",
    detail: "Review the current culprit, motive, method, and selected evidence fields.",
    handlerKey: "showTheory",
    shortcut: "T",
    targetKinds: ["evidence", "theory"]
  },
  submit: {
    kind: "submit",
    label: "Submit theory",
    detail: "Send the current theory to the existing local judgement handler.",
    handlerKey: "submitTheory",
    shortcut: "Enter",
    targetKinds: ["theory"]
  },
  review: {
    kind: "review",
    label: "Review conclusion",
    detail: "Open the certified conclusion after the existing judgement accepts the theory.",
    handlerKey: "showConclusion",
    shortcut: "R",
    targetKinds: ["location", "actor", "evidence", "theory"]
  },
  recover: {
    kind: "recover",
    label: "Repair theory",
    detail: "Return to the current safe recovery guidance without revealing a hidden answer.",
    handlerKey: "showRecovery",
    shortcut: "R",
    targetKinds: ["location", "institution", "actor", "evidence", "theory"]
  },
  inspect: {
    kind: "inspect",
    label: "Inspect public context",
    detail: "Review public information without changing the certified case route.",
    handlerKey: "showInvestigation",
    shortcut: "I",
    targetKinds: ["location", "actor", "evidence"]
  },
  advance: {
    kind: "advance",
    label: "Inspect institution",
    detail: "Review public institution status without changing case authority.",
    handlerKey: "showInstitution",
    shortcut: "I",
    targetKinds: ["institution"]
  }
} satisfies Record<InvestigationActionKind, InvestigationActionDefinition>);

export function getInvestigationActionDefinition(kind: InvestigationActionKind): InvestigationActionDefinition {
  return INVESTIGATION_ACTION_REGISTRY[kind];
}

export function listInvestigationActionDefinitions(): InvestigationActionDefinition[] {
  return Object.values(INVESTIGATION_ACTION_REGISTRY);
}
