"use client";

import { createContext, useContext, type ReactNode } from "react";
import type {
  CampaignResolutionLedger,
  CampaignResolutionLedgerEntry
} from "@/app/campaign/campaign-resolution-ledger-model";
import styles from "./CampaignResolutionLedger.module.css";

const ResolutionLedgerContext = createContext<CampaignResolutionLedger | null>(null);

export function CampaignResolutionLedgerProvider({ ledger, children }: {
  ledger: CampaignResolutionLedger;
  children: ReactNode;
}) {
  return <ResolutionLedgerContext.Provider value={ledger}>{children}</ResolutionLedgerContext.Provider>;
}

export function useCampaignResolutionLedgerContext() {
  return useContext(ResolutionLedgerContext);
}

const CHAIN_FIELDS: ReadonlyArray<{
  key: keyof CampaignResolutionLedgerEntry["chain"];
  label: string;
}> = [
  { key: "result", label: "Result" },
  { key: "worldChange", label: "World Change" },
  { key: "objectiveProgress", label: "Objective Progress" },
  { key: "nextAction", label: "Next Action" }
];

export function CampaignResolutionChain({ entry, testId, mode = "latest", activeField, ariaLive }: {
  entry: CampaignResolutionLedgerEntry;
  testId?: string;
  mode?: "latest" | "history" | "theatre";
  activeField?: keyof CampaignResolutionLedgerEntry["chain"];
  ariaLive?: "polite" | "assertive";
}) {
  return (
    <article
      className={`${styles.entry} ${styles[mode]}`}
      data-testid={testId}
      data-resolution-surface={mode}
      data-resolution-state={entry.status}
      data-resolution-tone={entry.tone}
      data-feedback-state={entry.status}
      data-feedback-tone={entry.tone}
      aria-label={`${entry.actionLabel} resolution`}
      aria-live={ariaLive}
    >
      <header className={styles.entryHeader}>
        <span>{mode === "history" ? "Recorded resolution" : mode === "theatre" ? "Canonical resolution" : "Latest resolution"}</span>
        <strong>{entry.actionLabel}</strong>
        <b>{entry.status}</b>
      </header>
      {CHAIN_FIELDS.map((field, index) => (
        <span
          key={field.key}
          className={styles.chainField}
          data-resolution-field={field.key}
          data-active={field.key === activeField ? "true" : undefined}
        >
          <i aria-hidden="true">{String(index + 1).padStart(2, "0")}</i>
          <small>{field.label}</small>
          <b>{entry.chain[field.key]}</b>
        </span>
      ))}
      <footer>{entry.authorityNote}</footer>
    </article>
  );
}

export function CampaignResolutionLatest({ ledger }: { ledger: CampaignResolutionLedger }) {
  return (
    <CampaignResolutionChain
      entry={ledger.latest}
      testId="command-deck-feedback"
      mode="latest"
      ariaLive={ledger.runtimeMode === "static-demo" ? "polite" : undefined}
    />
  );
}

export function CampaignResolutionJournal() {
  const ledger = useCampaignResolutionLedgerContext();
  if (!ledger) return null;
  return (
    <section
      className={styles.journal}
      data-testid="campaign-resolution-ledger"
      data-ledger-status={ledger.status}
      data-ledger-count={ledger.entryCount}
      aria-label="Campaign resolution ledger"
    >
      <header className={styles.journalHeader}>
        <div><span>Campaign Resolution Ledger</span><strong>Result → World Change → Objective Progress → Next Action</strong></div>
        <b>{ledger.entryCount}/{ledger.maxEntries}</b>
      </header>
      <div className={styles.history}>
        {ledger.entries.length ? ledger.entries.map((entry) => (
          <CampaignResolutionChain key={entry.signature} entry={entry} testId="campaign-resolution-entry" mode="history" />
        )) : (
          <p>No completed action is recorded yet. The Ledger derives only from this browser session&apos;s existing safe state.</p>
        )}
      </div>
    </section>
  );
}
