export function StaticWorldCampaignBoundary() {
  return (
    <section className="worldLeadPanel static" data-testid="world-lead-panel">
      <div className="worldLeadHeader"><div><span>World Lead</span><strong>Server Runtime loop</strong></div><b>static-safe</b></div>
      <div className="worldCampaignCurrentAction" data-testid="world-campaign-current-action"><span>Campaign priority</span><b>Continue the certified investigation path</b><small>World campaign choices remain Server-only.</small></div>
      <div className="worldInfluenceBudget empty" data-testid="world-influence-budget"><span><b>Server-only</b>unified influence budget</span><small>Static keeps future-case ordering read-only and never requests persistent influence state.</small></div>
      <div className="playerResourceCommitment static" data-testid="player-resource-commitment"><span><b>Server-only</b>investigation operations economy</span><small>Static keeps support slots, case-time accounting, resource reservation, and persistent plan controls read-only.</small></div>
      <div className="factionRelationshipSummary static" data-testid="faction-relationship-summary"><span><b>Server-only</b>faction relationship ledger</span><small>Static does not expose persistent standing or relationship-priced resource controls.</small></div>
      <div className="worldEventOffer static" data-testid="world-event-offer"><span><b>Server-only</b>world event offer lifecycle</span><small>Static exposes no persistent offer, deadline state, or Accept / Decline controls.</small></div>
      <div className="investigatorProgression static" data-testid="investigator-progression"><span><b>Server-only</b>investigator progression</span><small>Static does not persist practice marks, efficiency unlocks, or recovery retries.</small></div>
      <div className="campaignRecovery static" data-testid="campaign-recovery"><span><b>Server-only</b>failure and recovery</span><small>Static does not persist failure state, recovery intervals, or recovery decisions.</small></div>
      <div className="investigatorHeadquarters static" data-testid="investigator-headquarters"><span><b>Server-only</b>investigator headquarters</span><small>Static shows no preparation state, choice buttons, extraction gate, resource discount, or persistent Headquarters Recovery.</small></div>
      <div className="arcConvergence static" data-testid="arc-convergence"><span><b>Server-only</b>arc convergence finale</span><small>Static does not read campaign history, activate a finale candidate, or persist completion state.</small></div>
      <div className="campaignSession static" data-testid="campaign-session"><span><b>Server-only</b>three-case campaign journey</span><small>Static does not persist campaign chapters, consequence history, finale activation, or campaign debrief state, and does not select or persist an authored route.</small></div>
      <div className="campaignPacing static" data-testid="campaign-pacing"><span><b>Server-only</b>campaign pacing and content value</span><small>Static shows no persistent chapter context, world-choice state, or future-case result.</small></div>
      <div className="campaignPacing static" data-testid="campaign-transition-boundary"><span><b>Server-only</b>focused resolution and campaign transition theatre</span><small>Static creates no transition state, overlay lock, storage entry, or campaign result; its certified local demonstration remains unchanged.</small></div>
      <div className="townSocialResponse static" data-testid="town-social-response"><span><b>Server-only</b>town social response</span><small>Static does not read public NPC reactions, persist ambient posture, or expose response controls.</small></div>
      <div className="townSocialResponse campaignStudyBoundary static" data-testid="campaign-study-boundary"><span><b>Server-only</b>campaign comprehension study</span><small>Even with ?study=1, Static initializes no recorder, writes no study localStorage, and exposes no study controls.</small></div>
      <small>Static Runtime keeps the certified route unchanged. Investigation Operations, Investigator Headquarters, the case-scoped World Arc, the Support / Contain faction directive, the Server-only pressure cascade, town social response, and their unified influence budget run only in local Server Runtime and never call /api/* here.</small>
    </section>
  );
}
