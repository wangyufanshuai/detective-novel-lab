import {
  getInvestigationActionDefinition,
  type InvestigationActionHandlerKey,
  type InvestigationActionKind
} from "./investigation-action-registry";

export type SafeContextActionKind = InvestigationActionKind;

export type SafeContextAction = {
  kind: SafeContextActionKind;
  label: string;
  detail: string;
  enabled: boolean;
  primary: boolean;
  handlerKey: InvestigationActionHandlerKey;
  shortcut?: string;
  disabledReason?: string;
};

export type ContextActionResolverInput = {
  contextKind?: "location" | "institution" | "actor" | "evidence" | "theory";
  hasCase?: boolean;
  hasSession: boolean;
  observed: boolean;
  joined: boolean;
  hasSearchableEvidence: boolean;
  hasDiscoveredEvidence: boolean;
  challengedTestimony: boolean;
  theorySubmitted: boolean;
  judgementAccepted: boolean;
  revealAvailable: boolean;
  selectedEvidenceDiscovered?: boolean;
  selectedEvidenceInTheory?: boolean;
};

/**
 * Pure presentation selector. It never creates or validates an investigation
 * action; the returned kinds are dispatched through the existing handlers.
 */
export function resolveSafeContextActions(input: ContextActionResolverInput): SafeContextAction[] {
  const actions: SafeContextAction[] = [];
  const add = (kind: SafeContextActionKind, options: { enabled?: boolean; label?: string; detail?: string; disabledReason?: string } = {}) => {
    if (actions.some((action) => action.kind === kind)) return;
    const definition = getInvestigationActionDefinition(kind);
    const enabled = options.enabled !== false;
    actions.push({
      kind,
      label: options.label || definition.label,
      detail: options.detail || definition.detail,
      enabled,
      primary: false,
      handlerKey: definition.handlerKey,
      shortcut: definition.shortcut,
      disabledReason: enabled ? undefined : options.disabledReason || "This action is not available in the current public state."
    });
  };

  if (!input.contextKind) {
    add("select-context", { enabled: false, disabledReason: "Select a public map object to see its legal actions." });
    return actions;
  }

  if (input.contextKind === "institution") {
    add("advance");
    if (input.theorySubmitted && !input.judgementAccepted) {
      add("recover");
    }
  } else if (input.contextKind === "location") {
    if (!input.hasSession || !input.joined) {
      add("join", { enabled: input.hasCase !== false, disabledReason: "Create or extract a case before joining an investigation." });
    } else if (!input.observed) {
      add("observe");
    } else if (input.hasSearchableEvidence) {
      add("search");
    } else {
      add("inspect", { label: "Inspect location", detail: "Review this public place; no searchable clue is currently available." });
    }
    if (input.revealAvailable) add("review");
  } else if (input.contextKind === "actor") {
    if (!input.hasSession || !input.joined) {
      add("join", { enabled: input.hasCase !== false, disabledReason: "Create or extract a case before joining an investigation." });
    } else if (!input.observed) {
      add("observe");
    } else {
      add("question");
    }
    if (input.hasDiscoveredEvidence && !input.challengedTestimony) {
      add("challenge");
    }
    if (input.revealAvailable) add("review");
  } else if (input.contextKind === "evidence") {
    if (!input.hasSession || !input.joined) {
      add("join", { enabled: input.hasCase !== false, disabledReason: "Join the investigation before using a clue." });
    } else if (!input.selectedEvidenceDiscovered) {
      add("inspect", { enabled: false, label: "Clue not discovered", disabledReason: "Search its public location before using this clue." });
    } else {
      add("select-evidence", { label: input.selectedEvidenceInTheory ? "Remove clue from theory" : "Add clue to theory" });
      add("edit-theory");
    }
    if (input.revealAvailable) add("review");
  } else {
    if (!input.hasSession || !input.joined) add("join", { enabled: input.hasCase !== false });
    else if (!input.observed) add("observe");
    else if (input.judgementAccepted || input.revealAvailable) add("review");
    else if (input.theorySubmitted) {
      add("recover");
      add("edit-theory");
      add("submit");
    } else {
      add("edit-theory");
      add("submit");
    }
  }

  if (input.theorySubmitted && !input.judgementAccepted) {
    add("recover");
  }

  const visible = actions.slice(0, 3);
  const primaryIndex = visible.findIndex((action) => action.enabled);
  return visible.map((action, index) => ({ ...action, primary: index === primaryIndex }));
}
