import type { AuthoredCampaignCaseDefinition } from "./authored-campaign-cases";
import type { DetectiveCampaignDefinition } from "./campaign-catalog";

export const MIDNIGHT_CHORUS_CAMPAIGN = {
  id: "midnight-chorus",
  worldPackageIds: ["theatre-market-night-town"],
  label: "Midnight Chorus",
  themeLabel: "Public performance, backstage access, and night-watch accountability",
  routes: [
    {
      id: "baseline",
      label: "Public Reckoning",
      strategyLabel: "Follow public testimony, printed records, and night-watch procedure through the theatre district.",
      finaleLabel: "Lantern Inquiry",
      finaleCaseType: "police-misjudgment",
      replayContrast: "Compare public accountability with a backstage route built from private leverage, controlled access, and absence.",
      chapters: [
        {
          ordinal: 1,
          label: "Printed Whisper",
          objectiveLabel: "Establish which public account crossed from the theatre noticeboard into the midnight crowd.",
          preferredCaseTypes: ["media-rumor", "false-testimony", "editorial-coercion"],
          evidenceThemeLabel: "playbills, corrections, and public accounts",
          worldSurfaceLabel: "theatre publicity"
        },
        {
          ordinal: 2,
          label: "Missing Chorus",
          objectiveLabel: "Reconstruct a witness route between rehearsal, the market arcade, and the public square.",
          preferredCaseTypes: ["witness-disappearance", "media-rumor", "police-misjudgment"],
          evidenceThemeLabel: "attendance, movement, and corroboration",
          worldSurfaceLabel: "public witness safety"
        },
        {
          ordinal: 3,
          label: "Lantern Inquiry",
          objectiveLabel: "Resolve the night-watch error through certified proof and a public procedural record.",
          preferredCaseTypes: ["police-misjudgment"],
          evidenceThemeLabel: "watch logs, testimony, and exclusion",
          worldSurfaceLabel: "public accountability"
        }
      ]
    },
    {
      id: "counter-route",
      label: "Backstage Compact",
      strategyLabel: "Follow private leverage, service passages, and controlled evidence behind the theatre's public face.",
      finaleLabel: "Midnight Compact",
      finaleCaseType: "missing-person",
      replayContrast: "Compare the open inquiry with a backstage compact where access, silence, and resource pressure shape every lead.",
      chapters: [
        {
          ordinal: 1,
          label: "Price of Silence",
          objectiveLabel: "Trace which private obligation purchased access between the night market and the dressing rooms.",
          preferredCaseTypes: ["blackmail", "missing-person", "evidence-tampering"],
          evidenceThemeLabel: "receipts, favors, and backstage access",
          worldSurfaceLabel: "private leverage"
        },
        {
          ordinal: 2,
          label: "Moved Prop",
          objectiveLabel: "Audit how a controlled object crossed the service passage after the public doors closed.",
          preferredCaseTypes: ["evidence-tampering", "blackmail", "missing-person"],
          evidenceThemeLabel: "handling marks, passage timing, and custody",
          worldSurfaceLabel: "backstage evidence control"
        },
        {
          ordinal: 3,
          label: "Empty Cue",
          objectiveLabel: "Resolve the final absence without allowing the theatre's private agreement to replace proof.",
          preferredCaseTypes: ["missing-person"],
          evidenceThemeLabel: "absence, route, and protected testimony",
          worldSurfaceLabel: "midnight accountability"
        }
      ]
    }
  ]
} as const satisfies DetectiveCampaignDefinition;

export const MIDNIGHT_CHORUS_CASES = [
  {
    campaignId: "midnight-chorus", routeId: "baseline", ordinal: 1, caseFamily: "media-rumor",
    title: "The Printed Whisper", theme: "A rumor becomes actionable only when its revisions and public handoffs can be reconstructed.",
    publicPremise: "A theatre notice, a corrected playbill, and three conflicting accounts spread through the town square before midnight.",
    publicCaseFile: "Separate what the audience repeated from what the printing desk, box office, and night market could verify.",
    causalBridge: "The surviving publication route will determine which public witness can be protected in the next chapter.",
    occupationalPressure: "Performers, printers, vendors, and watch officers must protect their livelihoods while correcting a public story.",
    evidenceFrame: "Read each clue as one stage in a public account's revision and distribution",
    evidenceTitles: { means: "Restricted type block", motive: "Cancelled billing notice", opportunity: "Box-office handoff", staging: "Replaced display sheet", trace: "Fresh ink transfer", exclusion: "Rehearsal call ledger" },
    redHerrings: ["A critic repeats the damaging claim but leaves before the corrected sheet reaches the display frame.", "A vendor handles the first playbill while the print-room log excludes access to the decisive revision."],
    rhythm: ["opportunity", "staging", "trace", "motive", "means"],
    witnessFrame: "The witness distinguishes the phrase heard in the square from the wording printed beside the theatre doors.",
    challengeFrame: "Compare revision time and public handoff before treating repetition as authorship.",
    leadFocus: "question", aftermathLabel: "A verified public account becomes the foundation of the theatre district inquiry."
  },
  {
    campaignId: "midnight-chorus", routeId: "baseline", ordinal: 2, caseFamily: "witness-disappearance",
    title: "The Missing Chorus", theme: "A missing witness leaves a public rhythm of arrivals, pauses, and avoided checkpoints.",
    publicPremise: "One chorus member misses the final rehearsal after crossing the market arcade, while the public watch records an ordinary departure.",
    publicCaseFile: "Reconstruct the route from rehearsal call to market sighting without turning crowd memory into certified fact.",
    causalBridge: "The recovered movement sequence will decide whether the night watch enters the final inquiry as witness or subject.",
    occupationalPressure: "Stage staff, market porters, and patrol officers face pressure to preserve schedules without exposing private arrangements.",
    evidenceFrame: "Treat attendance, movement, and checkpoint time as one witness-safety route",
    evidenceTitles: { means: "Service-door restraint", motive: "Withdrawn witness request", opportunity: "Arcade crossing account", staging: "Signed departure board", trace: "Costume-thread snag", exclusion: "Public fountain roster" },
    redHerrings: ["A stage rival benefits from the absence but performs in public throughout the service-door interval.", "A porter changes a route description while the fountain roster excludes the hidden passage window."],
    rhythm: ["trace", "opportunity", "staging", "means", "motive"],
    witnessFrame: "The witness recalls where the chorus member stopped responding to greetings, not where the crowd assumed the journey ended.",
    challengeFrame: "Search the service route and public checkpoints together before assigning intent to the absence.",
    leadFocus: "search", aftermathLabel: "A protected movement record carries the missing chorus into a public night-watch review."
  },
  {
    campaignId: "midnight-chorus", routeId: "baseline", ordinal: 3, caseFamily: "police-misjudgment",
    title: "The Lantern Inquiry", theme: "Public safety fails when a plausible patrol account is accepted before its exclusions are tested.",
    publicPremise: "The town convenes an inquiry after a lantern checkpoint, a theatre alarm, and a public detention describe incompatible midnight routes.",
    publicCaseFile: "Determine which procedural shortcut converted an uncertain public sighting into an official conclusion.",
    causalBridge: "The inquiry joins publication custody and witness movement into one auditable account of the district's midnight response.",
    occupationalPressure: "Watch officers, civic clerks, and theatre stewards must distinguish institutional loyalty from defensible procedure.",
    evidenceFrame: "Audit patrol timing, recorded grounds, and excluded routes as one procedural chain",
    evidenceTitles: { means: "Watch-room seal", motive: "Suppressed correction request", opportunity: "Lantern-post interval", staging: "Retimed alarm entry", trace: "Checkpoint wax fragment", exclusion: "Square patrol muster" },
    redHerrings: ["A dismissed steward attacks the patrol publicly but cannot reach the alarm ledger during the disputed interval.", "A reporter receives an early correction while the press route excludes control of the watch-room seal."],
    rhythm: ["staging", "means", "opportunity", "trace", "motive"],
    witnessFrame: "The witness separates the person seen beneath the lantern from the conclusion later entered in the watch record.",
    challengeFrame: "Challenge the recorded conclusion against the checkpoint exclusions; confidence is not route integrity.",
    leadFocus: "challenge", aftermathLabel: "The Lantern Inquiry leaves a public standard for correcting night-watch error."
  },
  {
    campaignId: "midnight-chorus", routeId: "counter-route", ordinal: 1, caseFamily: "blackmail",
    title: "The Price of Silence", theme: "Backstage access becomes leverage when a private debt can close a public door.",
    publicPremise: "A night-market receipt, a dressing-room favor, and an altered rehearsal assignment expose a quiet demand for silence.",
    publicCaseFile: "Trace who could convert a private obligation into backstage access without treating embarrassment as proof.",
    causalBridge: "The verified access bargain will identify which evidence route becomes vulnerable after the public doors close.",
    occupationalPressure: "Performers, costumers, traders, and stagehands balance irregular income against the risk of losing backstage access.",
    evidenceFrame: "Read payment, access, and assignment changes as one bounded leverage chain",
    evidenceTitles: { means: "Master dressing key", motive: "Unpaid costume account", opportunity: "Market-stall exchange", staging: "Reassigned rehearsal card", trace: "Receipt-paper fragment", exclusion: "Front-of-house wage roll" },
    redHerrings: ["A lead performer hides a debt but remains under public rehearsal observation during the key exchange.", "A market lender profits from the demand while the wage roll excludes entry through the dressing corridor."],
    rhythm: ["trace", "staging", "opportunity", "motive", "means"],
    witnessFrame: "The witness remembers the receipt changing hands before the rehearsal card changed, not the private words exchanged.",
    challengeFrame: "Search the payment and access trail together; a secret obligation does not prove control of the corridor.",
    leadFocus: "search", aftermathLabel: "A verified backstage bargain exposes the custody risk behind the next closed-door inquiry."
  },
  {
    campaignId: "midnight-chorus", routeId: "counter-route", ordinal: 2, caseFamily: "evidence-tampering",
    title: "The Moved Prop", theme: "A familiar stage object becomes unreliable when service access and evidence handling share the same route.",
    publicPremise: "A marked prop returns to the wrong cabinet after the theatre closes, while every custodian reports following normal procedure.",
    publicCaseFile: "Reconstruct the object's handling route across the prop loft, service stair, and market loading door.",
    causalBridge: "The restored custody sequence will reveal which backstage agreement shaped the final absence.",
    occupationalPressure: "Prop staff, porters, investigators, and theatre managers face competing duties to preserve a performance and a reviewable chain.",
    evidenceFrame: "Treat handling marks, cabinet access, and service-door timing as one custody audit",
    evidenceTitles: { means: "Cabinet bypass tool", motive: "Cancelled inspection note", opportunity: "Service-stair crossing", staging: "Reset prop inventory", trace: "Gilt-dust transfer", exclusion: "Loading-door tally" },
    redHerrings: ["A prop maker disputes the inventory loudly but leaves through the counted loading door before the cabinet opens.", "A porter carries matching dust while the service tally excludes access to the bypass tool."],
    rhythm: ["means", "trace", "staging", "opportunity", "motive"],
    witnessFrame: "The witness distinguishes seeing the prop on the service stair from seeing who returned it to the cabinet.",
    challengeFrame: "Challenge the normal-procedure account with actual handling marks and route exclusions.",
    leadFocus: "challenge", aftermathLabel: "A restored prop-custody chain narrows the compact behind the final missing cue."
  },
  {
    campaignId: "midnight-chorus", routeId: "counter-route", ordinal: 3, caseFamily: "missing-person",
    title: "The Empty Cue", theme: "A disappearance cannot be resolved by the private agreement that made it convenient.",
    publicPremise: "The final cue arrives, a service gate opens, and one expected performer never crosses the stage or the public square.",
    publicCaseFile: "Resolve the absence through route, contact, and exclusion evidence while the theatre protects its midnight compact.",
    causalBridge: "The final review joins private leverage and evidence control into an accountable record of the missing route.",
    occupationalPressure: "Theatre owners, stage workers, market intermediaries, and patrol staff must choose between a convenient agreement and auditable testimony.",
    evidenceFrame: "Read the missed cue, protected route, and final contact as one disappearance timeline",
    evidenceTitles: { means: "Locked service-gate chain", motive: "Private settlement draft", opportunity: "Unanswered cue interval", staging: "Completed exit slate", trace: "Backstage chalk trail", exclusion: "Town-square lantern count" },
    redHerrings: ["A replacement performer gains the role but remains visible at the cue desk throughout the service-gate interval.", "A market intermediary drafted the settlement while the lantern count excludes the final backstage crossing."],
    rhythm: ["opportunity", "trace", "means", "staging", "motive"],
    witnessFrame: "The witness identifies the last answered cue and the route left unobserved, without claiming to know why it was used.",
    challengeFrame: "Question the final contact against route and exclusion evidence; the compact cannot stand in for proof.",
    leadFocus: "question", aftermathLabel: "The Midnight Compact ends with an auditable route for the person behind the empty cue."
  }
] as const satisfies readonly AuthoredCampaignCaseDefinition[];
