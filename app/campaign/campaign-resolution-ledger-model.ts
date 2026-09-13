import type { CampaignCommandBrief } from "./campaign-command-brief-model";
import type { CampaignBeatPresentation } from "./campaign-transition-model";
import type { GuidedStepJournalEntry } from "./replay-practice-model";
import type { StrategicCommandViewModel } from "./strategic-command-model";
import type { StrategicActionLifecycle, StrategicSafeOutcome } from "./strategic-pacing-model";

export type CampaignResolutionLedgerStatus = "idle" | "resolving" | "recorded" | "rejected" | "blocked" | "cancelled" | "failed" | "completed";
export type CampaignResolutionLedgerTone = "quiet" | "info" | "focus" | "warning" | "success";

export type CampaignResolutionChain = {
  result: string;
  worldChange: string;
  objectiveProgress: string;
  nextAction: string;
};

export type CampaignResolutionLedgerEntry = {
  signature: string;
  status: CampaignResolutionLedgerStatus;
  tone: CampaignResolutionLedgerTone;
  actionLabel: string;
  chain: CampaignResolutionChain;
  authorityNote: string;
};

export type CampaignResolutionLedger = {
  runtimeMode: StrategicCommandViewModel["runtimeMode"];
  status: CampaignResolutionLedgerStatus;
  latest: CampaignResolutionLedgerEntry;
  entries: CampaignResolutionLedgerEntry[];
  entryCount: number;
  maxEntries: 6;
  authorityNote: string;
};

export type CampaignResolutionLedgerInput = {
  command: StrategicCommandViewModel;
  commandBrief: CampaignCommandBrief;
  transition?: CampaignBeatPresentation;
  guidedJournal?: readonly GuidedStepJournalEntry[];
  recentSafeOutcomes?: readonly StrategicSafeOutcome[];
  actionLifecycle?: StrategicActionLifecycle;
};

const MAX_ENTRIES = 6 as const;
const NO_WORLD_CHANGE = "No persistent world change";
const AUTHORITY_NOTE = "Case truth, evidence coverage, the certified route, judgement, and NPC legal actions remain unchanged.";
const RAW_IDENTIFIER_PATTERN = /\b(?:case|npc|event|source|location|institution|resource|evidence|scene|session|world|campaign|package|character)-[a-z0-9-]*\d[a-z0-9-]*\b/gi;
const PRIVATE_FIELD_PATTERN = /\b(?:culpritId|victimId|hiddenTruth|rawBody|agentSnapshot|checkpoint|sqlite|sessionId|caseId|sourceId|eventId|npcId|locationId|institutionId|resourceId|selectedAnswer|playerText)\b/gi;
const ABSOLUTE_PATH_PATTERN = /(?:[A-Za-z]:[\\/]|\/(?:Users|home|tmp|var)\/)[^\s,;]*/gi;
const WORLD_JOURNAL_PATTERN = /(?:^|[\s-])(?:world|campaign|faction|town|headquarters|operations?|resources?|arc|directive|pressure|offer|recovery|handoff|standing|progression|social)(?:$|[\s-])/i;

function safeText(value: unknown, fallback: string, maximum = 220) {
  const normalized = String(value || "")
    .replace(ABSOLUTE_PATH_PATTERN, "")
    .replace(RAW_IDENTIFIER_PATTERN, "")
    .replace(PRIVATE_FIELD_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();
  return (normalized || fallback).slice(0, maximum).trim() || fallback;
}

function stableSignature(parts: readonly string[]) {
  let hash = 2166136261;
  for (const character of parts.join("\u241f")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `resolution-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function statusTone(status: CampaignResolutionLedgerStatus): CampaignResolutionLedgerTone {
  if (status === "resolving") return "focus";
  if (status === "blocked" || status === "rejected" || status === "failed") return "warning";
  if (status === "completed") return "success";
  if (status === "recorded") return "info";
  return "quiet";
}

function currentProgress(command: StrategicCommandViewModel) {
  return safeText(
    command.caseRhythm?.progressLabel
      || command.campaignPacing?.progressLabel
      || command.currentObjective.progressLabel
      || command.campaignProgress.progressLabel,
    "The current objective remains at its recorded stage.",
    180
  );
}

function hasWorldJournalSignal(entry: GuidedStepJournalEntry) {
  return WORLD_JOURNAL_PATTERN.test(`${entry.journalKey || ""} ${entry.label}`);
}

function buildEntry(input: {
  status: CampaignResolutionLedgerStatus;
  actionLabel: unknown;
  result: unknown;
  worldChange: unknown;
  objectiveProgress: unknown;
  nextAction: unknown;
  authorityNote: unknown;
}): CampaignResolutionLedgerEntry {
  const status = input.status;
  const actionLabel = safeText(input.actionLabel, status === "idle" ? "No action resolved" : "Recorded action", 100);
  const chain = {
    result: safeText(input.result, status === "resolving" ? "The current action is resolving." : "No result has been recorded yet.", 220),
    worldChange: safeText(input.worldChange, NO_WORLD_CHANGE, 220),
    objectiveProgress: safeText(input.objectiveProgress, "The current objective remains at its recorded stage.", 180),
    nextAction: safeText(input.nextAction, "Continue the next legal action.", 220)
  };
  return {
    signature: stableSignature([status, actionLabel, chain.result, chain.worldChange, chain.objectiveProgress]),
    status,
    tone: statusTone(status),
    actionLabel,
    chain,
    authorityNote: safeText(input.authorityNote, AUTHORITY_NOTE, 240)
  };
}

function journalEntry(
  entry: GuidedStepJournalEntry,
  command: StrategicCommandViewModel,
  brief: CampaignCommandBrief
): CampaignResolutionLedgerEntry {
  const worldRelated = hasWorldJournalSignal(entry);
  return buildEntry({
    status: entry.status === "blocked" ? "blocked" : "recorded",
    actionLabel: entry.label,
    result: entry.result,
    worldChange: worldRelated && command.runtimeMode === "server" ? entry.progressDelta : NO_WORLD_CHANGE,
    objectiveProgress: worldRelated ? currentProgress(command) : entry.progressDelta,
    nextAction: entry.nextAction || brief.nextAction,
    authorityNote: brief.safeBoundary
  });
}

function safeOutcomeEntry(
  outcome: StrategicSafeOutcome,
  command: StrategicCommandViewModel,
  brief: CampaignCommandBrief
): CampaignResolutionLedgerEntry {
  const status = outcome.state === "failed-safe" ? "failed" : outcome.state === "succeeded" ? "recorded" : outcome.state;
  return buildEntry({
    status,
    actionLabel: outcome.actionLabel || "Recorded investigation action",
    result: outcome.immediateResult,
    worldChange: command.runtimeMode !== "server" || ["blocked", "cancelled", "failed-safe"].includes(outcome.state)
      ? NO_WORLD_CHANGE
      : outcome.worldChange ?? (outcome.state === "succeeded" && command.worldConsequenceTimeline.state !== "empty" ? outcome.worldConsequence : NO_WORLD_CHANGE),
    objectiveProgress: currentProgress(command),
    nextAction: outcome.nextObjective || brief.nextAction,
    authorityNote: brief.safeBoundary
  });
}

function ledgerStatus(input: CampaignResolutionLedgerInput, history: readonly CampaignResolutionLedgerEntry[]): CampaignResolutionLedgerStatus {
  const state = input.actionLifecycle?.state;
  if (state === "selected" || state === "resolving") return "resolving";
  if (state) return state === "failed-safe" ? "failed" : state === "succeeded" ? "recorded" : state;
  if (input.transition?.phase === "action-resolving" || input.command.presentationFeedback.state === "resolving") return "resolving";
  if (input.command.presentationFeedback.state === "blocked") return "blocked";
  if (input.command.presentationFeedback.state === "completed" || input.command.campaignPacing?.status === "settled") return "completed";
  if (history[0] && ["rejected", "blocked", "cancelled", "failed"].includes(history[0].status)) return history[0].status;
  if (history.length || input.command.presentationFeedback.state === "updated" || input.transition?.visible) return "recorded";
  return "idle";
}

function currentWorldChange(input: CampaignResolutionLedgerInput, base?: CampaignResolutionLedgerEntry) {
  if (input.command.runtimeMode === "static-demo") return NO_WORLD_CHANGE;
  if (input.actionLifecycle && ["selected", "resolving", "blocked", "cancelled", "failed-safe"].includes(input.actionLifecycle.state)) return NO_WORLD_CHANGE;
  if (input.actionLifecycle?.worldChange !== undefined) return input.actionLifecycle.worldChange;
  if (input.actionLifecycle && input.actionLifecycle.state !== "succeeded") return NO_WORLD_CHANGE;
  if (base && ["rejected", "blocked", "cancelled", "failed"].includes(base.status)) return NO_WORLD_CHANGE;
  // A recorded "no change" is itself authoritative. An old transition or
  // world lead must not be re-attributed to the latest investigation action.
  if (base) return base.chain.worldChange;
  const transitionOwnsWorldChange = input.transition?.kind === "world-choice-resolved"
    || input.transition?.kind === "case-opened"
    || input.transition?.kind === "chapter-transition"
    || input.transition?.kind === "finale-ready"
    || input.transition?.kind === "campaign-completed";
  if (transitionOwnsWorldChange && input.command.worldConsequenceTimeline.state !== "empty") {
    return `${input.command.worldConsequenceTimeline.headline}: ${input.command.worldConsequenceTimeline.summary}`;
  }
  return NO_WORLD_CHANGE;
}

function currentEntry(
  input: CampaignResolutionLedgerInput,
  status: CampaignResolutionLedgerStatus,
  base?: CampaignResolutionLedgerEntry
): CampaignResolutionLedgerEntry {
  const transition = input.transition;
  const resolving = status === "resolving";
  const idle = status === "idle";
  return buildEntry({
    status,
    actionLabel: idle
      ? "No action resolved"
      : resolving
      ? input.actionLifecycle?.action?.label || transition?.title || input.command.primaryAction?.label || input.command.presentationFeedback.label
      : base?.actionLabel || transition?.eyebrow || input.command.presentationFeedback.label,
    result: idle
      ? "No result has been recorded yet."
      : resolving
      ? input.actionLifecycle?.detail || transition?.detail || input.command.presentationFeedback.detail
      : base?.chain.result || input.command.presentationFeedback.detail || input.command.outcomeFeedback.immediate.detail,
    worldChange: resolving ? NO_WORLD_CHANGE : currentWorldChange(input, base),
    objectiveProgress: base?.chain.objectiveProgress || currentProgress(input.command),
    nextAction: input.commandBrief.nextAction,
    authorityNote: input.commandBrief.safeBoundary
  });
}

function uniqueBounded(entries: readonly CampaignResolutionLedgerEntry[]) {
  const seen = new Set<string>();
  const result: CampaignResolutionLedgerEntry[] = [];
  for (const entry of entries) {
    if (entry.status === "idle" || entry.status === "resolving" || seen.has(entry.signature)) continue;
    seen.add(entry.signature);
    result.push({ ...entry, chain: { ...entry.chain } });
    if (result.length === MAX_ENTRIES) break;
  }
  return result;
}

/**
 * Canonical, public-safe resolution projection. It reads existing presentation
 * state only and never executes a request, writes storage, or changes authority.
 */
export function buildCampaignResolutionLedger(input: CampaignResolutionLedgerInput): CampaignResolutionLedger {
  const journalHistory = [...(input.guidedJournal || [])]
    .reverse()
    .map((entry) => journalEntry(entry, input.command, input.commandBrief));
  const actionHistory = (input.recentSafeOutcomes || []).map((outcome) => safeOutcomeEntry(outcome, input.command, input.commandBrief));
  const initialHistory = uniqueBounded([...actionHistory, ...journalHistory]);
  const status = ledgerStatus(input, initialHistory);
  const latest = currentEntry(input, status, initialHistory[0]);
  const entries = uniqueBounded([latest, ...initialHistory]);
  return {
    runtimeMode: input.command.runtimeMode,
    status,
    latest,
    entries,
    entryCount: entries.length,
    maxEntries: MAX_ENTRIES,
    authorityNote: safeText(input.commandBrief.safeBoundary, AUTHORITY_NOTE, 240)
  };
}
