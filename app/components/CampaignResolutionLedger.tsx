"use client";

import { createContext, useContext, type ReactNode } from "react";
import type {
  CampaignResolutionLedger,
  CampaignResolutionLedgerEntry
} from "@/app/campaign/campaign-resolution-ledger-model";
import { useAppLocale } from "@/app/localization/locale-context";
import type { LocaleMessageKey } from "@/app/localization/locale-catalog";
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
  messageKey: LocaleMessageKey;
}> = [
  { key: "result", messageKey: "ledger.result" },
  { key: "worldChange", messageKey: "ledger.worldChange" },
  { key: "objectiveProgress", messageKey: "ledger.objectiveProgress" },
  { key: "nextAction", messageKey: "ledger.nextAction" }
];

export function CampaignResolutionChain({ entry, testId, mode = "latest", activeField, ariaLive }: {
  entry: CampaignResolutionLedgerEntry;
  testId?: string;
  mode?: "latest" | "history" | "theatre";
  activeField?: keyof CampaignResolutionLedgerEntry["chain"];
  ariaLive?: "polite" | "assertive";
}) {
  const { number, t, text } = useAppLocale();
  return (
    <article
      className={`${styles.entry} ${styles[mode]}`}
      data-testid={testId}
      data-resolution-surface={mode}
      data-resolution-state={entry.status}
      data-resolution-tone={entry.tone}
      data-feedback-state={entry.status}
      data-feedback-tone={entry.tone}
      aria-label={t("ledger.aria", { action: text(entry.actionLabel) })}
      aria-live={ariaLive}
    >
      <header className={styles.entryHeader}>
        <span>{mode === "history" ? t("ledger.recorded") : mode === "theatre" ? t("ledger.canonical") : t("ledger.latest")}</span>
        <strong>{text(entry.actionLabel)}</strong>
        <b>{text(entry.status)}</b>
      </header>
      {CHAIN_FIELDS.map((field, index) => (
        <span
          key={field.key}
          className={styles.chainField}
          data-resolution-field={field.key}
          data-active={field.key === activeField ? "true" : undefined}
        >
          <i aria-hidden="true">{number(index + 1).padStart(2, "0")}</i>
          <small>{t(field.messageKey)}</small>
          <b>{text(entry.chain[field.key])}</b>
        </span>
      ))}
      <footer>{text(entry.authorityNote)}</footer>
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
  const { number, t } = useAppLocale();
  if (!ledger) return null;
  return (
    <section
      className={styles.journal}
      data-testid="campaign-resolution-ledger"
      data-ledger-status={ledger.status}
      data-ledger-count={ledger.entryCount}
      aria-label={t("ledger.title")}
    >
      <header className={styles.journalHeader}>
        <div><span>{t("ledger.title")}</span><strong>{t("ledger.chain")}</strong></div>
        <b>{number(ledger.entryCount)}/{number(ledger.maxEntries)}</b>
      </header>
      <div className={styles.history}>
        {ledger.entries.length ? ledger.entries.map((entry) => (
          <CampaignResolutionChain key={entry.signature} entry={entry} testId="campaign-resolution-entry" mode="history" />
        )) : (
          <p>{t("ledger.empty")}</p>
        )}
      </div>
    </section>
  );
}
