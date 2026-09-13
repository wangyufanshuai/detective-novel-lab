"use client";

import { useLayoutEffect, useRef } from "react";

type ActionIdentity = {
  worldId?: string;
  caseId?: string;
  sessionId?: string;
  runtimeMode: string;
};

type ActionToken = { scope: string; owner: object };

/** Request ownership only: settlement still belongs to the existing pacing ledger. */
export function createInvestigationActionScope(initialIdentity: ActionIdentity, setBusy: (busy: boolean) => void) {
  let scope = JSON.stringify(initialIdentity);
  let active: ActionToken | null = null;
  return {
    sync(identity: ActionIdentity) {
      const next = JSON.stringify(identity);
      if (scope === next) return;
      scope = next;
      if (active) {
        active = null;
        setBusy(false);
      }
    },
    begin(owner: object) {
      if (active) return null;
      active = { scope, owner };
      setBusy(true);
      return active;
    },
    matches(identity: ActionIdentity) {
      return scope === JSON.stringify(identity);
    },
    isCurrent(token: ActionToken) {
      return active === token && scope === token.scope;
    },
    finish(token: ActionToken) {
      if (active !== token) return;
      active = null;
      setBusy(false);
    },
    cancel(owner: object) {
      if (active?.owner !== owner) return;
      active = null;
      setBusy(false);
    }
  };
}

// React's stable state setter identifies one controller. Both mutation adapters
// share its request lock, without placing request bookkeeping in player state.
const scopes = new WeakMap<(busy: boolean) => void, ReturnType<typeof createInvestigationActionScope>>();

export function useInvestigationActionScope(identity: ActionIdentity, setBusy: (busy: boolean) => void) {
  const owner = useRef({});
  const mounted = useRef(false);
  let scope = scopes.get(setBusy);
  if (!scope) {
    scope = createInvestigationActionScope(identity, setBusy);
    scopes.set(setBusy, scope);
  }
  const currentScope = scope;
  useLayoutEffect(() => {
    currentScope.sync(identity);
  }, [currentScope, identity.worldId, identity.caseId, identity.sessionId, identity.runtimeMode]);
  useLayoutEffect(() => {
    mounted.current = true;
    const currentOwner = owner.current;
    return () => {
      mounted.current = false;
      currentScope.cancel(currentOwner);
    };
  }, [currentScope]);
  return {
    begin: () => mounted.current && currentScope.matches(identity) ? currentScope.begin(owner.current) : null,
    isCurrent: (token: ActionToken) => mounted.current && currentScope.isCurrent(token),
    finish: (token: ActionToken) => currentScope.finish(token)
  };
}
