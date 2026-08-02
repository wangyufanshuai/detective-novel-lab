export type SafeContextActionKind = "search" | "question" | "challenge" | "inspect" | "advance";

export type SafeContextAction = {
  kind: SafeContextActionKind;
  label: string;
  detail: string;
  enabled: boolean;
};

export type ContextActionResolverInput = {
  contextKind?: "location" | "institution" | "actor";
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
};

/**
 * Pure presentation selector. It never creates or validates an investigation
 * action; the returned kinds are dispatched through the existing handlers.
 */
export function resolveSafeContextActions(input: ContextActionResolverInput): SafeContextAction[] {
  const actions: SafeContextAction[] = [];
  const add = (kind: SafeContextActionKind, label: string, detail: string, enabled = true) => {
    if (actions.some((action) => action.kind === kind)) return;
    actions.push({ kind, label, detail, enabled });
  };

  if (!input.contextKind) {
    add("inspect", "Select a public object", "Choose a location or character on the map.", false);
    return actions;
  }

  if (input.contextKind === "institution") {
    add("inspect", "Inspect institution", "Review the public institution status without changing the certified case route.");
    if (input.theorySubmitted && !input.judgementAccepted) {
      add("advance", "Return to case recovery", "Resolve the current certified theory gap before optional world action.");
    }
  } else if (input.contextKind === "location") {
    if (!input.hasSession || !input.joined) {
      add("advance", "Join investigation", "Create a player session before searching this location.", input.hasCase !== false);
    } else if (!input.observed) {
      add("advance", "Observe case window", "Review the case window before searching for clues.");
    } else if (input.hasSearchableEvidence) {
      add("search", "Search location", "Use the certified investigation route to inspect this public place.");
    } else {
      add("inspect", "Inspect location", "Review the public location context; no searchable clue is currently available.");
    }
    if (input.hasDiscoveredEvidence && !input.challengedTestimony) {
      add("challenge", "Prepare a challenge", "Select a discovered clue before testing a testimony contradiction.");
    }
    if (input.revealAvailable) add("advance", "Review conclusion", "Open the certified conclusion review.");
  } else {
    if (!input.hasSession || !input.joined) {
      add("advance", "Join investigation", "Create a player session before questioning this character.", input.hasCase !== false);
    } else if (!input.observed) {
      add("advance", "Observe case window", "Review the case window before questioning a character.");
    } else {
      add("question", "Question character", "Ask a focused question using the existing memory-scoped route.");
    }
    if (input.hasDiscoveredEvidence && !input.challengedTestimony) {
      add("challenge", "Challenge testimony", "Present a discovered clue to test the current statement.");
    }
    if (input.revealAvailable) add("advance", "Review conclusion", "Open the certified conclusion review.");
  }

  if (input.theorySubmitted && !input.judgementAccepted) {
    add("advance", "Repair theory", "Review the remaining certified gap before submitting again.");
  }

  return actions.slice(0, 3);
}
