"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { InvestigationActionResult } from "@/app/campaign/investigation-action-result";

export type InvestigationExecution = (label: string, execute: () => Promise<InvestigationActionResult>) => Promise<void>;
const ExecutionContext = createContext<InvestigationExecution | null>(null);

export function InvestigationActionExecutionProvider({ run, children }: { run: InvestigationExecution; children: ReactNode }) {
  return <ExecutionContext.Provider value={run}>{children}</ExecutionContext.Provider>;
}

export function useInvestigationActionExecution() {
  const run = useContext(ExecutionContext);
  return run || (async (_label: string, execute: () => Promise<InvestigationActionResult>) => { await execute(); });
}
