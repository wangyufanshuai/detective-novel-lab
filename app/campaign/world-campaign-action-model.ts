import type { PlayerSession } from "@/lib/engine";
import type {
  ArcConvergenceSummary,
  CampaignRecoverySummary,
  CampaignSessionSummary,
  InvestigatorHeadquartersSummary,
  PlayerResourceCommitmentSummary,
  WorldArcDirectiveSummary,
  WorldArcSummary,
  WorldEventOfferSummary,
  WorldLeadHandoffSummary,
  WorldLeadOutcomeSummary,
  WorldLeadSummary,
  WorldPressureCascadeSummary
} from "./world-campaign-types";

export type CurrentWorldActionSurface =
  | "overview"
  | "lead"
  | "outcome"
  | "handoff"
  | "arc"
  | "directive"
  | "pressure"
  | "operations"
  | "offer"
  | "recovery"
  | "headquarters"
  | "convergence"
  | "campaign";

export type CurrentWorldAction = {
  status: string;
  label: string;
  detail: string;
  /** Presentation-only ownership; it never changes which action is legal. */
  surface: CurrentWorldActionSurface;
};

export function deriveCurrentWorldAction(input: {
  session: PlayerSession | null;
  lead?: WorldLeadSummary | null;
  outcome?: WorldLeadOutcomeSummary | null;
  handoff?: WorldLeadHandoffSummary | null;
  arc?: WorldArcSummary | null;
  directive?: WorldArcDirectiveSummary | null;
  pressure?: WorldPressureCascadeSummary | null;
  commitment?: PlayerResourceCommitmentSummary | null;
  offer?: WorldEventOfferSummary | null;
  recovery?: CampaignRecoverySummary | null;
  headquarters?: InvestigatorHeadquartersSummary | null;
  convergence?: ArcConvergenceSummary | null;
  campaign?: CampaignSessionSummary | null;
}): CurrentWorldAction {
  if (input.recovery?.status === "ready") return { status: "ready", label: "Choose the available recovery action", detail: input.recovery.nextAction, surface: "recovery" };
  if (input.recovery?.status === "scheduled") return { status: "scheduled", label: "Advance the recovery interval", detail: input.recovery.nextAction, surface: "recovery" };
  if (input.headquarters?.status === "ready") return { status: "ready", label: "Choose one Headquarters preparation", detail: input.headquarters.nextAction, surface: "headquarters" };
  if (input.headquarters?.status === "prepared") return { status: "prepared", label: "Extract the next case with preparation active", detail: input.headquarters.nextAction, surface: "headquarters" };
  if (input.campaign?.status === "completed") return { status: "completed", label: input.campaign.primaryActionLabel, detail: input.campaign.nextAction, surface: "campaign" };
  if (input.directive?.status === "ready" || input.directive?.status === "blocked") return { status: input.directive.status, label: "Choose one faction response", detail: input.directive.nextAction, surface: "directive" };
  if (input.directive?.status === "scheduled" || input.directive?.status === "running") return { status: input.directive.status, label: "Advance the existing town operation", detail: input.directive.nextAction, surface: "directive" };
  if (input.offer?.status === "offered") return { status: "offered", label: "Choose this world opportunity", detail: input.offer.nextAction, surface: "offer" };
  if (input.offer?.status === "accepted" || input.offer?.status === "running") return { status: input.offer.status, label: "Advance the accepted opportunity", detail: input.offer.nextAction, surface: "offer" };
  if (!input.session && input.handoff?.status === "ready") return { status: "ready", label: "Choose the next legal case", detail: input.handoff.nextAction, surface: "handoff" };
  if (input.convergence?.status === "ready") return { status: "ready", label: "Choose a finale-family case or any legal alternative", detail: input.convergence.nextAction, surface: "convergence" };
  if (input.convergence?.status === "active") return { status: "active", label: "Resolve the converged campaign case", detail: input.convergence.nextAction, surface: "convergence" };
  if (input.session && (input.commitment?.planStatus === "ready" || input.commitment?.planStatus === "blocked")) return { status: input.commitment.planStatus, label: "Plan investigation operations", detail: input.commitment.nextAction, surface: "operations" };
  if (input.lead?.status === "pending") return { status: "choice", label: "Choose how to approach this case", detail: "Follow the safe world lead or keep the certified route order.", surface: "lead" };
  if (input.session && (input.commitment?.planStatus === "planned" || input.commitment?.planStatus === "active")) return { status: input.commitment.planStatus, label: `Resolve the next legal ${input.commitment.priorityOrder[0] || "investigation"} operation`, detail: input.commitment.nextAction, surface: "operations" };
  if (input.outcome?.status === "active") return { status: "active", label: "Close the certified investigation", detail: input.outcome.nextAction, surface: "outcome" };
  if (input.pressure?.status === "active") return { status: "active", label: "Carry world pressure into a future case", detail: input.pressure.nextAction, surface: "pressure" };
  if (input.lead) return { status: input.lead.status, label: "Continue the certified investigation", detail: input.lead.nextAction, surface: "lead" };
  if (input.arc) return { status: input.arc.status, label: "Continue the case-scoped world line", detail: input.arc.nextAction, surface: "arc" };
  return { status: "ready", label: "Continue the existing investigation path", detail: "World systems remain optional and never replace certified case work.", surface: "overview" };
}
