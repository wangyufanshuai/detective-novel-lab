import type { CaseFromLog } from "../world-types";
import type { PersistentTownRuntime, TownCaseType } from "../persistent-town";
import type { WorldSystemRuntimeActionKind, WorldSystemRuntimeHints } from "../detective-content";
import { detectiveCampaignForRuntime, type DetectiveCampaignId, type DetectiveCampaignRouteId } from "./campaign-catalog";
import { MIDNIGHT_CHORUS_CASES } from "./midnight-chorus-campaign";

export type AuthoredCampaignLeadFocus = "search" | "question" | "challenge";

export type AuthoredCampaignCaseDefinition = {
  campaignId: DetectiveCampaignId;
  routeId: DetectiveCampaignRouteId;
  ordinal: 1 | 2 | 3;
  caseFamily: TownCaseType;
  title: string;
  theme: string;
  publicPremise: string;
  publicCaseFile: string;
  causalBridge: string;
  occupationalPressure: string;
  evidenceFrame: string;
  evidenceTitles: {
    means: string;
    motive: string;
    opportunity: string;
    staging: string;
    trace: string;
    exclusion: string;
  };
  redHerrings: [string, string];
  rhythm: ["staging" | "opportunity" | "means" | "motive" | "trace", "staging" | "opportunity" | "means" | "motive" | "trace", "staging" | "opportunity" | "means" | "motive" | "trace", "staging" | "opportunity" | "means" | "motive" | "trace", "staging" | "opportunity" | "means" | "motive" | "trace"];
  witnessFrame: string;
  challengeFrame: string;
  leadFocus: AuthoredCampaignLeadFocus;
  aftermathLabel: string;
};

const CASES: readonly AuthoredCampaignCaseDefinition[] = [
  {
    campaignId: "town-reckoning", routeId: "baseline", ordinal: 1, caseFamily: "archive-vanishing",
    title: "The Open Ledger", theme: "Public records can disappear without erasing the obligations they created.",
    publicPremise: "A routine archive check reveals that one public ledger was handled twice and witnessed only once. The death scene looks separate until custody times are compared.",
    publicCaseFile: "Establish who could move between the archive, the public counter, and the final scene while a record dispute was still active.",
    causalBridge: "The surviving custody gap will decide which civic office enters the next debt inquiry under pressure.",
    occupationalPressure: "Public staff are balancing access duties against fear of being blamed for a broken custody chain.",
    evidenceFrame: "Read every clue as part of a public-record custody trail",
    evidenceTitles: { means: "Restricted tool checkout", motive: "Suppressed correction notice", opportunity: "Counter-window sighting", staging: "Refiled scene marker", trace: "Archive fiber transfer", exclusion: "Public desk rollcall" },
    redHerrings: ["A loud fee dispute creates motive without access to the restricted record window.", "A copied key appears suspicious until its public checkout time excludes the holder."],
    rhythm: ["staging", "opportunity", "means", "motive", "trace"],
    witnessFrame: "The witness first remembers a public counter exchange, then recognizes which route continued toward the restricted stacks.",
    challengeFrame: "Compare the public counter time with the custody mark before treating access as guilt.",
    leadFocus: "search", aftermathLabel: "Archive custody becomes the civic baseline for the next chapter."
  },
  {
    campaignId: "town-reckoning", routeId: "baseline", ordinal: 2, caseFamily: "ledger-fraud",
    title: "The Debt Notice", theme: "Private obligation becomes public pressure when two ledgers describe the same payment differently.",
    publicPremise: "A debt notice, a corrected receipt, and a late institutional visit form competing accounts of the same obligation.",
    publicCaseFile: "Separate the real payment trail from the argument that made the easiest suspect visible.",
    causalBridge: "The resolved debt route determines which institution arrives at the Civic Reckoning with credibility intact.",
    occupationalPressure: "Clerks, merchants, and messengers face conflicting duties to preserve records, customers, and institutional standing.",
    evidenceFrame: "Treat amount, custody, and delivery time as one obligation chain",
    evidenceTitles: { means: "Altered payment instrument", motive: "Private debt escalation", opportunity: "Late delivery witness", staging: "Balanced account facade", trace: "Duplicate receipt impression", exclusion: "Closing-time attendance sheet" },
    redHerrings: ["The largest creditor has a visible motive but no route through the closing-time ledger exchange.", "A messenger carries the disputed notice yet the independent attendance sheet fixes the delivery window."],
    rhythm: ["motive", "opportunity", "staging", "means", "trace"],
    witnessFrame: "The witness remembers the delivery order but initially merges the public notice with a later private exchange.",
    challengeFrame: "Challenge the account only after amount, impression, and delivery time point to the same transaction.",
    leadFocus: "question", aftermathLabel: "The town carries one verified debt route into the final hearing."
  },
  {
    campaignId: "town-reckoning", routeId: "baseline", ordinal: 3, caseFamily: "court-intimidation",
    title: "The Closed Hearing", theme: "A hearing can be procedurally open while every useful witness feels privately closed off.",
    publicPremise: "The final civic hearing inherits two case histories, a sealed correction, and a witness route shaped by institutional pressure.",
    publicCaseFile: "Prove how access, intimidation, and physical trace converge without treating procedure itself as proof of guilt.",
    causalBridge: "This certified conclusion closes the Town Reckoning while preserving every earlier case as an independent truth.",
    occupationalPressure: "Court staff and civic witnesses must choose between routine procedure and public accountability.",
    evidenceFrame: "Build the hearing from independent custody, witness, and trace obligations",
    evidenceTitles: { means: "Restricted hearing access", motive: "Suppression instruction", opportunity: "Corridor witness interval", staging: "Reordered docket packet", trace: "Seal and surface transfer", exclusion: "Public hearing attendance" },
    redHerrings: ["A procedural objection delays the hearing but does not connect its author to the physical route.", "A witness changes tone under pressure while the attendance record still excludes them from the decisive interval."],
    rhythm: ["opportunity", "staging", "motive", "means", "trace"],
    witnessFrame: "The witness can identify the corridor interval only after the docket order is separated from the intimidation itself.",
    challengeFrame: "Use the physical custody chain to test the pressured statement; do not infer truth from confidence or status.",
    leadFocus: "challenge", aftermathLabel: "Civic procedure leaves a permanent, publicly accountable record."
  },
  {
    campaignId: "harbor-testimony", routeId: "baseline", ordinal: 1, caseFamily: "dock-smuggling",
    title: "The Broken Manifest", theme: "Cargo movement becomes testimony when every route leaves a timed public handoff.",
    publicPremise: "A manifest line breaks between the dock office and bonded storage while a death scene points toward the wrong end of the route.",
    publicCaseFile: "Reconstruct which handoff moved cargo, paperwork, and the responsible person through the same harbor interval.",
    causalBridge: "The verified route determines whose account can be trusted when witness identity becomes disputed.",
    occupationalPressure: "Dock workers, tally clerks, and carriers risk wages and standing when they contradict the official manifest.",
    evidenceFrame: "Read cargo, route, and witness time as one movement grammar",
    evidenceTitles: { means: "Cargo-tool access", motive: "Suppressed manifest discrepancy", opportunity: "Dock-gate sighting", staging: "Repacked route marker", trace: "Bonded-storage transfer", exclusion: "Shift-change rollcall" },
    redHerrings: ["A carrier handles the missing cargo but the shift rollcall removes them from the death-scene interval.", "A dock argument explains hostility while its route ends before bonded storage."],
    rhythm: ["opportunity", "means", "staging", "trace", "motive"],
    witnessFrame: "The witness remembers direction and load before recognizing the person who crossed the dock gate.",
    challengeFrame: "Test the route against both the manifest handoff and the bonded-storage trace.",
    leadFocus: "search", aftermathLabel: "One certified cargo route survives into the witness inquiry."
  },
  {
    campaignId: "harbor-testimony", routeId: "baseline", ordinal: 2, caseFamily: "false-testimony",
    title: "The Borrowed Voice", theme: "A statement can repeat accurate details while borrowing the wrong witness position.",
    publicPremise: "Two public accounts share phrases, timing, and route details that only one observer could have acquired directly.",
    publicCaseFile: "Separate direct observation from repeated testimony before using either account to complete the evidence chain.",
    causalBridge: "The corrected witness identity determines who enters the Harbor Inquest under protection and who enters under scrutiny.",
    occupationalPressure: "Informants, court messengers, and union witnesses weigh truthful correction against public retaliation.",
    evidenceFrame: "Compare source position, repeated detail, and contradiction timing",
    evidenceTitles: { means: "Statement-copy access", motive: "Witness pressure exchange", opportunity: "Overlapping route account", staging: "Rehearsed detail sequence", trace: "Shared wording marker", exclusion: "Independent location check" },
    redHerrings: ["The most hesitant speaker appears deceptive but lacks access to the copied statement.", "A confident correction arrives late yet is independently fixed to the correct public location."],
    rhythm: ["opportunity", "motive", "staging", "means", "trace"],
    witnessFrame: "The witness first repeats a borrowed route detail, then distinguishes what was personally seen from what was heard later.",
    challengeFrame: "Present the location check before the shared wording marker so the correction remains memory-scoped.",
    leadFocus: "question", aftermathLabel: "The harbor enters its inquest with one protected, source-grounded account."
  },
  {
    campaignId: "harbor-testimony", routeId: "baseline", ordinal: 3, caseFamily: "dock-witness-swap",
    title: "The Harbor Inquest", theme: "The final inquest turns on whether cargo custody and witness identity describe the same crossing.",
    publicPremise: "A protected witness, a swapped public identity, and a cargo route converge at the inquest without erasing either earlier case.",
    publicCaseFile: "Close the identity conflict through route, statement, and physical trace under the ordinary certified investigation rules.",
    causalBridge: "This conclusion fixes the harbor account while leaving another Campaign free to reach a different Finale family.",
    occupationalPressure: "Union representatives, court officers, and dock witnesses must preserve both safety and a verifiable public account.",
    evidenceFrame: "Bind identity to movement with three independent source surfaces",
    evidenceTitles: { means: "Protected-record access", motive: "Identity suppression order", opportunity: "Inquest-route sighting", staging: "Swapped witness marker", trace: "Cargo and document transfer", exclusion: "Protected attendance ledger" },
    redHerrings: ["A union officer can arrange protection but the attendance ledger excludes the decisive crossing.", "A cargo owner benefits from silence without access to the protected identity record."],
    rhythm: ["staging", "opportunity", "trace", "motive", "means"],
    witnessFrame: "The witness identifies the crossing only after protection status is separated from the public name used at the gate.",
    challengeFrame: "Challenge identity with the route and transfer trace together; a name discrepancy alone is not decisive.",
    leadFocus: "challenge", aftermathLabel: "Harbor accountability preserves both witness safety and the certified route."
  },
  {
    campaignId: "clinic-headlines", routeId: "baseline", ordinal: 1, caseFamily: "clinic-inventory-gap",
    title: "The Missing Interval", theme: "Medical timing becomes suspicious only when inventory and observation leave the same interval empty.",
    publicPremise: "A clinic inventory count and a public timing record disagree across one short interval before the final scene.",
    publicCaseFile: "Reconstruct access, dosage or tool handling, and witness position without treating medical authority as guilt.",
    causalBridge: "The verified interval determines which private access record becomes vulnerable to publication.",
    occupationalPressure: "Clinical staff balance patient privacy, inventory duty, and fear that any correction will look like concealment.",
    evidenceFrame: "Join inventory, forensic interval, and public observation",
    evidenceTitles: { means: "Clinical inventory access", motive: "Suppressed timing correction", opportunity: "Clinic-exit sighting", staging: "Normalized treatment record", trace: "Forensic interval residue", exclusion: "Shift and patient rollcall" },
    redHerrings: ["A staff member signs the inventory sheet but their patient rollcall excludes the final interval.", "A family visitor disputes treatment without access to the restricted clinical item."],
    rhythm: ["means", "opportunity", "trace", "staging", "motive"],
    witnessFrame: "The witness remembers the clinic exit but needs the inventory interval to separate routine movement from the decisive visit.",
    challengeFrame: "Use the forensic interval to test the correction; do not infer concealment from a changed medical record alone.",
    leadFocus: "search", aftermathLabel: "A certified clinical interval becomes the basis of the next access dispute."
  },
  {
    campaignId: "clinic-headlines", routeId: "baseline", ordinal: 2, caseFamily: "editorial-coercion",
    title: "The Private Copy", theme: "A private document becomes public leverage through access, copying, and editorial timing.",
    publicPremise: "A household copy and a newsroom version contain the same physical defect but reach the public record by different routes.",
    publicCaseFile: "Trace who could access, reproduce, and deploy the document while excluding people who only argued about its contents.",
    causalBridge: "The resolved publication route decides whether the final trust review begins as protection, scrutiny, or institutional repair.",
    occupationalPressure: "Family staff, editors, and medical workers face incompatible expectations of privacy and public accountability.",
    evidenceFrame: "Separate document access, copy mechanics, and publication pressure",
    evidenceTitles: { means: "Copying access record", motive: "Publication pressure exchange", opportunity: "Household-newsroom sighting", staging: "Edited provenance note", trace: "Matching copy defect", exclusion: "Household and desk rollcall" },
    redHerrings: ["The loudest privacy dispute supplies motive but not access to the copying surface.", "An editor receives the document yet the desk rollcall fixes receipt after the decisive interval."],
    rhythm: ["motive", "means", "staging", "opportunity", "trace"],
    witnessFrame: "The witness initially remembers the published copy, then separates that memory from the earlier household handoff.",
    challengeFrame: "Compare the copy defect and handoff time before asking who benefited from publication.",
    leadFocus: "question", aftermathLabel: "The town carries one verified publication route into the trust review."
  },
  {
    campaignId: "clinic-headlines", routeId: "baseline", ordinal: 3, caseFamily: "medical-coverup",
    title: "The Public Trust Review", theme: "Trust depends on whether medical custody, household access, and public correction can be audited together.",
    publicPremise: "The final review inherits a missing interval, a copied private record, and a public account shaped by reputation pressure.",
    publicCaseFile: "Resolve the medical custody conflict through timing, access, testimony, and trace without replacing the certified judgement path.",
    causalBridge: "This conclusion closes Clinic Headlines and records which form of public trust the town chose to preserve.",
    occupationalPressure: "Medical reviewers, household representatives, and press workers risk institutional trust when they correct the shared record.",
    evidenceFrame: "Close the review with independent medical, access, and publication obligations",
    evidenceTitles: { means: "Restricted clinical access", motive: "Trust suppression directive", opportunity: "Review-window sighting", staging: "Rewritten custody summary", trace: "Medical and copy transfer", exclusion: "Review attendance record" },
    redHerrings: ["A critic has reason to damage the institution but no access to the restricted medical chain.", "A family representative changes a public statement while the attendance record excludes the decisive handling interval."],
    rhythm: ["trace", "opportunity", "means", "motive", "staging"],
    witnessFrame: "The witness separates reputation pressure from the handling interval before correcting the public account.",
    challengeFrame: "Use custody and timing together; public embarrassment is not a substitute for physical proof.",
    leadFocus: "challenge", aftermathLabel: "The final review leaves a permanent, auditable public-trust record."
  },
  {
    campaignId: "town-reckoning", routeId: "counter-route", ordinal: 1, caseFamily: "permit-forgery",
    title: "The Counterfeit Permit", theme: "A public authorization becomes private leverage when its signature and delivery route disagree.",
    publicPremise: "A market permit bears the right seal, the wrong pressure pattern, and a delivery time that no public counter can confirm.",
    publicCaseFile: "Determine who could prepare, carry, and stage the authorization while the visible market dispute drew attention elsewhere.",
    causalBridge: "The verified permit route decides which household obligation becomes vulnerable to commercial pressure.",
    occupationalPressure: "Permit clerks, stall stewards, and couriers must protect public access while merchants contest who was authorized to trade.",
    evidenceFrame: "Read signature, counter time, and market delivery as one authorization chain",
    evidenceTitles: { means: "Permit press access", motive: "Market exclusion notice", opportunity: "Counter-to-stall sighting", staging: "Rehung authorization copy", trace: "Seal pressure transfer", exclusion: "Permit desk attendance" },
    redHerrings: ["A rejected merchant has a visible grievance but never enters the permit preparation route.", "A courier carries the copied form after the independent counter record closes the decisive interval."],
    rhythm: ["opportunity", "staging", "means", "trace", "motive"],
    witnessFrame: "The witness first recalls the market argument, then separates it from the quieter permit handoff at the public counter.",
    challengeFrame: "Question the route before the signature; a convincing seal does not prove when or where the permit was prepared.",
    leadFocus: "question", aftermathLabel: "A verified authorization trail carries merchant pressure into the household inquiry."
  },
  {
    campaignId: "town-reckoning", routeId: "counter-route", ordinal: 2, caseFamily: "household-escrow",
    title: "The Held Inheritance", theme: "An escrow protects property only while every person agrees which document entered custody.",
    publicPremise: "A household receipt, a market valuation, and a copied key describe three versions of the same protected inheritance.",
    publicCaseFile: "Separate legitimate escrow handling from the private confrontation that made one family representative look responsible.",
    causalBridge: "The recovered custody sequence determines which signature reaches the final inheritance review with authority intact.",
    occupationalPressure: "Household stewards, merchants, and legal clerks face competing duties to family privacy, valuation, and public recordkeeping.",
    evidenceFrame: "Treat receipt, key access, and valuation time as one escrow obligation",
    evidenceTitles: { means: "Escrow key impression", motive: "Withheld valuation notice", opportunity: "Household entry interval", staging: "Reordered custody envelope", trace: "Receipt-paper transfer", exclusion: "Household service rollcall" },
    redHerrings: ["A family claimant disputes the valuation but lacks access to the escrow key during the handling interval.", "A merchant profits from delay while the service rollcall places the exchange elsewhere."],
    rhythm: ["motive", "means", "opportunity", "trace", "staging"],
    witnessFrame: "The witness remembers the argument about value before identifying which envelope actually crossed the household threshold.",
    challengeFrame: "Challenge the custody account only after the key impression and receipt transfer describe the same handling route.",
    leadFocus: "challenge", aftermathLabel: "The household releases one auditable escrow sequence into the inheritance review."
  },
  {
    campaignId: "town-reckoning", routeId: "counter-route", ordinal: 3, caseFamily: "forged-will",
    title: "The Borrowed Signature", theme: "Inheritance authority depends on the route of a signature, not the confidence of the person presenting it.",
    publicPremise: "The final review joins a counterfeit permit, a disputed escrow, and a testament whose signature appears in two custody histories.",
    publicCaseFile: "Prove how preparation, access, witness position, and material trace converge without treating inheritance conflict as guilt.",
    causalBridge: "This certified conclusion closes the merchant route while preserving each earlier investigation as an independent truth.",
    occupationalPressure: "Legal clerks, household witnesses, and market representatives risk property and standing when they correct the inherited record.",
    evidenceFrame: "Build the testament route from independent signature, custody, and exclusion surfaces",
    evidenceTitles: { means: "Document press access", motive: "Inheritance diversion instruction", opportunity: "Review-room interval", staging: "Substituted testament cover", trace: "Ink and paper transfer", exclusion: "Witness attendance register" },
    redHerrings: ["A disinherited claimant has motive without access to the document press or review-room interval.", "A household witness changes a public account while the attendance register excludes the decisive substitution."],
    rhythm: ["trace", "means", "staging", "opportunity", "motive"],
    witnessFrame: "The witness distinguishes seeing the signature from seeing the document enter custody before correcting the final account.",
    challengeFrame: "Search the material route first; resemblance between signatures cannot replace custody and opportunity proof.",
    leadFocus: "search", aftermathLabel: "The inheritance review leaves a permanent public record of signature and custody."
  },
  {
    campaignId: "harbor-testimony", routeId: "counter-route", ordinal: 1, caseFamily: "witness-disappearance",
    title: "The Empty Watch", theme: "A missing witness leaves a route behind even when every public account describes an ordinary shift change.",
    publicPremise: "One dock watch ends without a relief signature, while a telegram and a gate sighting point in opposite directions.",
    publicCaseFile: "Reconstruct the witness route before cargo ownership turns absence into an accusation.",
    causalBridge: "The protected movement trail determines which official seal can be trusted in the next custody dispute.",
    occupationalPressure: "Watch officers, dockworkers, and informants balance shift duties against fear that cooperation will expose them to retaliation.",
    evidenceFrame: "Join watch time, gate movement, and message custody before judging absence",
    evidenceTitles: { means: "Watch-route access", motive: "Protection withdrawal notice", opportunity: "Unrelieved gate interval", staging: "Abandoned shift marker", trace: "Telegram and dock transfer", exclusion: "Relief crew rollcall" },
    redHerrings: ["A dockworker leaves the shift loudly but the relief rollcall fixes their later location.", "A cargo owner benefits from silence without access to the missing watch route."],
    rhythm: ["staging", "trace", "opportunity", "motive", "means"],
    witnessFrame: "The witness first describes an empty post, then identifies the direction taken before the relief bell.",
    challengeFrame: "Challenge the absence only after message custody and gate time establish a movement trail.",
    leadFocus: "challenge", aftermathLabel: "A protected watch route survives into the official-seal inquiry."
  },
  {
    campaignId: "harbor-testimony", routeId: "counter-route", ordinal: 2, caseFamily: "false-testimony",
    title: "The Borrowed Seal", theme: "An official mark can validate a document while concealing who controlled its custody.",
    publicPremise: "Two statements rely on the same harbor seal, but only one speaker could have seen when it left the court messenger's pouch.",
    publicCaseFile: "Separate direct observation from repeated authority before the borrowed seal enters the final custody review.",
    causalBridge: "The corrected seal history decides which break in the evidence chain becomes visible at the tribunal.",
    occupationalPressure: "Court messengers, tally clerks, and protected witnesses risk employment and safety when they contradict an official-looking document.",
    evidenceFrame: "Compare statement position, seal custody, and contradiction timing",
    evidenceTitles: { means: "Seal-pouch access", motive: "Custody silence exchange", opportunity: "Messenger-route sighting", staging: "Rehearsed seal account", trace: "Wax and paper marker", exclusion: "Court-dock attendance check" },
    redHerrings: ["The most nervous witness appears unreliable but never handles the seal pouch.", "A tally clerk sees the document after the attendance check closes the decisive custody interval."],
    rhythm: ["opportunity", "means", "trace", "staging", "motive"],
    witnessFrame: "The witness separates seeing the sealed document from hearing a later explanation of how it arrived.",
    challengeFrame: "Search the custody route before relying on the authority implied by the seal itself.",
    leadFocus: "search", aftermathLabel: "The harbor carries one source-grounded seal history into the custody tribunal."
  },
  {
    campaignId: "harbor-testimony", routeId: "counter-route", ordinal: 3, caseFamily: "evidence-tampering",
    title: "The Broken Chain", theme: "A protected witness remains safe only when the evidence chain can survive independent public review.",
    publicPremise: "The final tribunal inherits a missing watch, a borrowed seal, and a trace packet whose custody changes across two official handoffs.",
    publicCaseFile: "Resolve the custody break through source, route, and material trace without assuming that official possession proves integrity.",
    causalBridge: "This certified conclusion closes the chain-protection route without rewriting the cargo-first Harbor Inquest.",
    occupationalPressure: "Evidence clerks, union stewards, and court officers must protect both a vulnerable witness and an auditable chain.",
    evidenceFrame: "Bind every trace to an independent handoff, location, and exclusion record",
    evidenceTitles: { means: "Restricted packet access", motive: "Chain suppression order", opportunity: "Transfer-corridor interval", staging: "Relabeled evidence wrapper", trace: "Broken seal transfer", exclusion: "Custody desk register" },
    redHerrings: ["A union steward can arrange protection but never enters the restricted packet route.", "A court officer disputes the handling rule while the desk register excludes the decisive transfer."],
    rhythm: ["trace", "staging", "means", "motive", "opportunity"],
    witnessFrame: "The witness identifies the transfer only after the protected route is separated from the public evidence label.",
    challengeFrame: "Question each handoff in order; institutional status is not a substitute for chain integrity.",
    leadFocus: "question", aftermathLabel: "The custody tribunal preserves witness safety through an auditable evidence chain."
  },
  {
    campaignId: "clinic-headlines", routeId: "counter-route", ordinal: 1, caseFamily: "family-scandal",
    title: "The Quiet Household", theme: "Household protection can distort a public medical account without changing the underlying clinical interval.",
    publicPremise: "A family letter, a visitor record, and a corrected clinic statement disagree about who requested silence first.",
    publicCaseFile: "Separate private protection from access and opportunity before the household account becomes public leverage.",
    causalBridge: "The verified household route determines which protected copy reaches editorial custody.",
    occupationalPressure: "Family representatives, servants, and clinic clerks balance privacy duties against the need to correct a public account.",
    evidenceFrame: "Read letter custody, visitor time, and clinic access as independent obligations",
    evidenceTitles: { means: "Household document access", motive: "Silence request letter", opportunity: "Visitor-clinic interval", staging: "Reordered family packet", trace: "Letter and record transfer", exclusion: "Household attendance sheet" },
    redHerrings: ["A relative demands privacy but never enters the document handling route.", "A servant carries the packet after the attendance sheet closes the decisive clinic interval."],
    rhythm: ["motive", "opportunity", "trace", "means", "staging"],
    witnessFrame: "The witness first remembers the family confrontation, then separates it from the earlier request delivered to the clinic.",
    challengeFrame: "Question the request route before interpreting silence as concealment.",
    leadFocus: "question", aftermathLabel: "One verified household account becomes the starting point for the protected-copy inquiry."
  },
  {
    campaignId: "clinic-headlines", routeId: "counter-route", ordinal: 2, caseFamily: "household-escrow",
    title: "The Escrow Copy", theme: "A protected copy becomes leverage when household custody and newsroom receipt describe different handoffs.",
    publicPremise: "An escrow envelope and an editorial proof share a physical defect but no agreed delivery route.",
    publicCaseFile: "Trace access, copying, and receipt while excluding people whose dispute concerned only the document's contents.",
    causalBridge: "The resolved copy route determines which editorial decision reaches the final correction hearing.",
    occupationalPressure: "Household stewards, legal custodians, and editors face incompatible promises of privacy, verification, and publication.",
    evidenceFrame: "Treat escrow access, copy mechanics, and newsroom receipt as one custody chain",
    evidenceTitles: { means: "Protected copying access", motive: "Publication leverage exchange", opportunity: "Escrow-newsroom interval", staging: "Rewritten receipt cover", trace: "Matching paper defect", exclusion: "Household and desk register" },
    redHerrings: ["An editor argues for publication without access to the protected copying surface.", "A family representative handles the envelope after the dual register fixes the decisive handoff."],
    rhythm: ["means", "trace", "staging", "motive", "opportunity"],
    witnessFrame: "The witness distinguishes receiving the published proof from seeing the earlier escrow envelope leave custody.",
    challengeFrame: "Challenge the copy route only when the paper defect and receipt interval point to the same handoff.",
    leadFocus: "challenge", aftermathLabel: "The protected-copy route carries one auditable source chain into the correction hearing."
  },
  {
    campaignId: "clinic-headlines", routeId: "counter-route", ordinal: 3, caseFamily: "editorial-coercion",
    title: "The Correction Deadline", theme: "Public correction is trustworthy only when source custody survives deadline and reputation pressure.",
    publicPremise: "The final hearing joins a household silence request, an escrow copy, and an editorial deadline shaped by medical reputation.",
    publicCaseFile: "Resolve who controlled access, publication timing, and physical trace without treating an embarrassing headline as proof.",
    causalBridge: "This certified conclusion closes the public-correction route while preserving the clinical review as a distinct replay.",
    occupationalPressure: "Editors, medical reviewers, and household representatives risk trust when they correct the same record for different reasons.",
    evidenceFrame: "Close the correction chain with independent source, timing, and material obligations",
    evidenceTitles: { means: "Restricted proof access", motive: "Correction suppression directive", opportunity: "Deadline-room interval", staging: "Substituted proof order", trace: "Source-copy transfer", exclusion: "Editorial hearing attendance" },
    redHerrings: ["A critic benefits from a damaging headline but never accesses the restricted proof route.", "A medical representative revises a statement while the attendance record excludes the decisive substitution."],
    rhythm: ["staging", "trace", "opportunity", "means", "motive"],
    witnessFrame: "The witness separates deadline pressure from the moment the source copy entered editorial custody.",
    challengeFrame: "Search the source and timing chain together; reputation pressure cannot replace material proof.",
    leadFocus: "search", aftermathLabel: "The correction hearing leaves a permanent public record of source custody and timing."
  },
  ...MIDNIGHT_CHORUS_CASES
] as const;

const evidenceIdByKind = {
  means: "ev-means",
  motive: "ev-motive",
  opportunity: "ev-opportunity",
  staging: "ev-staging",
  trace: "ev-trace"
} as const;

export function listAuthoredCampaignCaseDefinitions() {
  return CASES;
}

export function getAuthoredCampaignCaseDefinition(campaignId: DetectiveCampaignId, ordinal: number, routeId: DetectiveCampaignRouteId = "baseline") {
  return CASES.find((item) => item.campaignId === campaignId && item.routeId === routeId && item.ordinal === ordinal) || null;
}

export function authoredCampaignCaseForRuntime(runtime: Pick<PersistentTownRuntime, "campaignSession" | "currentExperiment" | "currentScenarioPackId">) {
  const campaign = detectiveCampaignForRuntime(runtime);
  const hasExplicitCampaign = campaign.id !== "town-reckoning" || Boolean(runtime.currentExperiment?.worldPackageId);
  if (!hasExplicitCampaign) return null;
  const completed = runtime.campaignSession?.completedCycleKeys?.length || 0;
  const ordinal = runtime.campaignSession?.status === "finale-ready" || runtime.campaignSession?.status === "finale-active" ? 3 : Math.max(1, Math.min(3, completed + 1));
  return getAuthoredCampaignCaseDefinition(campaign.id, ordinal, runtime.campaignSession?.routeId || "baseline");
}

const LEAD_ACTION_BY_FOCUS: Record<AuthoredCampaignLeadFocus, WorldSystemRuntimeActionKind> = {
  search: "investigate",
  question: "seek-alibi",
  challenge: "cover-up"
};

/**
 * Reorders the existing bounded runtime tendency so an authored chapter's
 * public World Lead is stable. It does not add an NPC action, change action
 * legality, or mutate the source/content bindings used by the case engine.
 */
export function withAuthoredCampaignLeadFocus(
  hints: WorldSystemRuntimeHints,
  focus: AuthoredCampaignLeadFocus
): WorldSystemRuntimeHints {
  const preferredAction = LEAD_ACTION_BY_FOCUS[focus];
  const actionBias = Object.fromEntries(
    (Object.entries(hints.actionBias) as Array<[WorldSystemRuntimeActionKind, number]>)
      .filter(([, value]) => typeof value === "number")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([kind, value]) => [kind, Math.max(0, Math.min(kind === preferredAction ? 4 : 3, value))])
  ) as WorldSystemRuntimeHints["actionBias"];
  actionBias[preferredAction] = 4;
  const actionKinds = (Object.entries(actionBias) as Array<[WorldSystemRuntimeActionKind, number]>)
    .filter(([, value]) => value > 0)
    .map(([kind]) => kind)
    .sort((left, right) => left.localeCompare(right));
  return {
    ...hints,
    actionBias,
    summary: {
      ...hints.summary,
      actionKinds,
      maxActionBias: 4
    }
  };
}

function evidenceLocationId(activeCase: CaseFromLog, evidenceId: string) {
  return activeCase.deductionCase.scenes.find((scene) => scene.evidenceIds.includes(evidenceId))?.id;
}

export function applyAuthoredCampaignCaseTreatment(activeCase: CaseFromLog, definition: AuthoredCampaignCaseDefinition) {
  const deductionCase = activeCase.deductionCase;
  deductionCase.title = definition.title;
  deductionCase.theme = definition.theme;
  deductionCase.premise = definition.publicPremise;
  deductionCase.publicCaseFile = `${definition.publicCaseFile} ${definition.causalBridge}`;

  const evidenceTitles = new Map([
    ["ev-means", definition.evidenceTitles.means],
    ["ev-motive", definition.evidenceTitles.motive],
    ["ev-opportunity", definition.evidenceTitles.opportunity],
    ["ev-staging", definition.evidenceTitles.staging],
    ["ev-trace", definition.evidenceTitles.trace],
    ["ev-town-rollcall", definition.evidenceTitles.exclusion]
  ]);
  const order = definition.rhythm.map((kind) => evidenceIdByKind[kind]);
  for (const evidence of deductionCase.evidence) {
    const authoredTitle = evidenceTitles.get(evidence.id);
    if (authoredTitle) evidence.title = authoredTitle;
    evidence.visibleDescription = `${definition.evidenceFrame}. ${evidence.visibleDescription}`;
    const index = order.indexOf(evidence.id as (typeof order)[number]);
    if (index >= 0) evidence.discoveryDifficulty = index < 2 ? "easy" : index < 4 ? "medium" : "hard";
  }

  const scenePriority = Array.from(new Set([
    evidenceLocationId(activeCase, order[0]),
    activeCase.generationProfile.sceneLocationId,
    activeCase.generationProfile.prepLocationId,
    evidenceLocationId(activeCase, order[1]),
    evidenceLocationId(activeCase, order[2])
  ].filter((value): value is string => Boolean(value))));
  deductionCase.scenes = [...deductionCase.scenes].sort((left, right) => {
    const leftIndex = scenePriority.indexOf(left.id);
    const rightIndex = scenePriority.indexOf(right.id);
    if (leftIndex < 0 && rightIndex < 0) return left.name.localeCompare(right.name);
    if (leftIndex < 0) return 1;
    if (rightIndex < 0) return -1;
    return leftIndex - rightIndex;
  }).map((scene, index) => index < 3 ? { ...scene, description: `${definition.occupationalPressure} ${scene.description}` } : scene);

  const focusIds = new Set(activeCase.generationProfile.focusSuspectIds);
  for (const character of deductionCase.characters) {
    if (character.role !== "死者") character.publicBio = `${character.publicBio} ${definition.occupationalPressure}`;
    if (focusIds.has(character.id) && !character.isCulprit) {
      character.motive = `${character.motive} ${definition.redHerrings[0]}`;
    }
  }

  deductionCase.logicPuzzle.redHerrings = [...definition.redHerrings];
  deductionCase.logicPuzzle.requiredClueOrder = order;
  for (const testimony of activeCase.testimonies) {
    const isWitness = testimony.characterId === activeCase.generationProfile.witnessId;
    if (isWitness) {
      testimony.initialStatement = definition.witnessFrame;
      testimony.currentStatement = definition.witnessFrame;
    }
    if (testimony.contradictionEvidenceIds.length) {
      testimony.contradictionEvidenceIds = order.filter((evidenceId) => testimony.contradictionEvidenceIds.includes(evidenceId));
      if (isWitness && !testimony.contradictionEvidenceIds.includes("ev-opportunity")) testimony.contradictionEvidenceIds.unshift("ev-opportunity");
    }
  }
  return activeCase;
}
