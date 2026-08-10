"use client";

import { useMemo } from "react";
import {
  buildCampaignResolutionLedger,
  type CampaignResolutionLedger,
  type CampaignResolutionLedgerInput
} from "@/app/campaign/campaign-resolution-ledger-model";

/** Request-free memoized projection over existing safe action and Journal state. */
export function useCampaignResolutionLedger(input: CampaignResolutionLedgerInput): CampaignResolutionLedger {
  const { command, commandBrief, transition, guidedJournal, recentSafeOutcomes } = input;
  return useMemo(() => buildCampaignResolutionLedger({
    command,
    commandBrief,
    transition,
    guidedJournal,
    recentSafeOutcomes
  }), [command, commandBrief, transition, guidedJournal, recentSafeOutcomes]);
}
