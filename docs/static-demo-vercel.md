# Vercel Static Demo

The public demo target for v0.1.0 is a browser-only Static Demo deployment. It does not need API keys, SQLite, or writable filesystem access.

## Deploy

1. Import the GitHub repository into Vercel.
2. Keep the default build command:

```bash
npm run build
```

3. Keep `vercel.json` committed. It sets:

```json
{ "env": { "NEXT_PUBLIC_DEMO_MODE": "static" } }
```

4. Deploy and open the generated Vercel URL.
5. Use this public entry:

```text
https://<project>.vercel.app/?runtime=static
```

## No-Secret Guarantee

Static Demo must not require:

- `DEEPSEEK_API_KEY`
- `.env` or `.env.local`
- SQLite write access
- Any `/api/*` call during the playable browser flow

The v3.4 Dataset Reader is also static-only. It reads sanitized public files from `public/dataset-reader/<datasetId>/`:

- `manifest-lite.json`
- `reader-index.json`
- `case-summary-index.json`
- `dataset-card.md`

The v3.6 Public Catalog shell is static-only as well. In v4.0 it is presented as a **Public Demo Vertical Slice**: Catalog -> Dataset -> Case Summary -> Evidence Distribution -> Audit Status -> Static Boundary. In v4.1 the same static path adds an aggregate-only **Public Dataset Explorer** with search and sort controls for case type distribution, evidence type distribution, world package summaries, and gate/audit status. In v4.2 it adds a **Public Case Explorer** backed by `case-summary-index.json`, a spoiler-safe public case summary artifact with public case ids, source case hashes, type/location/tick, evidence counts, warning counts, and influence edge counts only. In v4.9 the static entry is simplified into a reviewer-first home: Reviewer Home -> Trust Snapshot -> Review Path -> Dataset Reader -> Public Case Explorer -> Evidence Distribution -> Audit Boundary. In v5.4 the same home adds **Stable World Proof**, backed by `public/review-catalog/stable-world-summary.json`, a sanitized three-seed 1000 tick benchmark summary with seed labels, deterministic hashes, aggregate gate metrics, diagnostics counts, regression delta counts, and artifact file hashes only. In v5.5 the same public schema is reused for an aggregate-only drilldown. In v5.6 the home adds **Case Quality Proof**, backed by `public/review-catalog/case-quality-summary.json`, a non-blocking sanitized benchmark summary with only aggregate scores, dimension scores, status counts, seed labels, deterministic hashes, and artifact file hashes. In v5.7 the first reviewer surface adds **Reviewer Gateway** with Pack, Replay, Map, and Agent entry cards plus a World Systems overview for roles, locations, resources, factions, event archetypes, and progression lines. In v5.8 the browser-local Authoring guide adds Resource, Faction, Event Archetype, and Growth Line selectors so authors can preview world-system safe text without changing ids, proof structure, runtime authority, or public dataset snapshots. In v5.9 the same tables feed a bounded Server Runtime hint layer: resource pressure, faction lane, event archetype, and growth-line labels add deterministic tie-break bias to compatible NPC action candidates and annotate institution decisions, while Static Runtime still remains zero `/api/*`. In v5.10 `audit:world-system-hints` adds a local aggregate-only on/off influence audit under `outputs/` so reviewers can verify that hints affect action ordering without changing public artifacts or long-run gates. In v5.11 the Static Reviewer adds **World-System Influence Proof**, backed by `public/review-catalog/world-system-influence-summary.json`, a sanitized projection of that short audit with seed labels, counts, percentages, action-kind deltas, safety flags, and deterministic hashes only. In v5.12 the Static Reviewer opens with **Reviewer Main Path**: Pack, Replay, Map, and Agent cards each show the reviewer question, primary metric, and next action, followed by a compact Proof Strip that jumps into existing proof details. In v5.13 the player-facing investigation panel opens with **Playable Investigation Path**: Join, Search, Question, Challenge, Select Evidence, Submit, and Review Source are shown as low-spoiler steps, and Static Runtime joins locally without `/api/*`. In v5.14 **Static Playthrough Proof** adds a browser-local Run Certified Playthrough action that proves the Static Premium case reaches accepted theory using Route Certificate, Truth Ledger coverage, and auto-solve metrics without publishing raw bodies or ids. The static UI reads `public/review-catalog/index.json`, which embeds the stable-world, case-quality, and world-system influence summaries, hash-links their standalone summary files, and includes only aggregate detective content counts. The files under `public/dataset-reader/` and `public/review-catalog/` are tracked public release snapshots: deployable static artifacts that are regenerated and stability-checked locally, not runtime authorities.

v5.15 adds **Server Playthrough Proof** for local Server Runtime review: after an emerged Persistent Agent Town case is extracted, reviewers can run an explicit certified playthrough that persists a dedicated auto-player session and displays only aggregate completion metrics. Static Runtime remains zero `/api/*`, and this Server proof does not add public artifacts or refresh `public/dataset-reader`.

v5.16 adds **Source Review Unlock** after accepted theory in both Static and Server Runtime. The solved-case workbench gathers Source Trail, Proof Obligations, Certified Route, and Conclusion Review from existing local intake, ledger, certificate, proof tour, and reveal data. It does not add public catalog files, publish raw case/replay bodies, or refresh `public/dataset-reader`.

v5.17 adds **Guided Manual Run** below the player path. A reviewer or player can click one low-spoiler step at a time through Join, Search, Question, Challenge, Select Evidence, Submit, and Review Source. Static Runtime remains browser-local with zero `/api/*`; Server Runtime reuses existing local investigation APIs only.

v5.18 adds **Guided Step Journal** below Guided Manual Run. The journal records session-only low-spoiler step results, progress deltas, next actions, certified fallback use, and source review unlock status without writing public catalog files, repo JSON, SQLite schema, or dataset snapshots.

v5.19 adds **Solved Case Debrief** after Source Review Unlock. The debrief summarizes Player Route, Evidence Closure, Source Confidence, and Next Replay Goal from existing local session, journal, proof coverage, route certificate, and source review data. It is a solved-case UI summary, not public catalog authority, dataset refresh, SQLite change, or long gate.

v5.20 adds **Replay Goal Coach** below Solved Case Debrief. The coach turns Next Replay Goal into a local replay-practice action for reducing certified fallback, manually selecting evidence, using fewer guided clicks, and reviewing source after submit. Static replay attempts stay browser-local with zero `/api/*`; Server Runtime reuses the existing local join/session flow.

v5.21 adds **Replay Attempt Scorecard** below Replay Goal Coach. The scorecard shows pending and completed descriptive deltas for guided clicks, certified fallback, selected evidence, proof gaps, source review unlock, and completed replay goals after a local replay attempt. It is not a public catalog artifact, score gate, dataset refresh, SQLite change, runtime scoring change, or long gate.

v5.22 adds **Manual Evidence Drill** near Replay Goal Coach and Replay Attempt Scorecard. During an active replay attempt, discovered evidence appears as low-spoiler cards with Add to Theory / Remove from Theory controls so manual evidence selection becomes an actual practice step before submit. The drill is session-local UI state; it is not a public catalog artifact, API endpoint, dataset refresh, SQLite change, runtime scoring change, or long gate.

v5.23 adds **Manual Theory Drill** after Manual Evidence Drill. During an active replay attempt, suspect, motive, and method are Manual First: discovered clue prompts guide free text without truth fields, and certified fallback must be explicitly approved for remaining or unresolved fields. The drill is session-local UI state; it is not a public catalog artifact, API endpoint, dataset refresh, SQLite change, runtime scoring change, or long gate.

v5.24 adds **Replay Practice Loop** above Replay Goal Coach. The loop summarizes Start, Discover, Pick Evidence, Fill Theory, Submit, Review Source, and Scorecard phases with manual/fallback aggregate counts and a low-spoiler next action. It is session-local information architecture polish; it is not a public catalog artifact, API endpoint, dataset refresh, SQLite change, runtime scoring change, or long gate.

v5.25 adds **World Lead Loop** after Join in Server Runtime. A deterministic safe lead derived from existing resource, faction, event, and progression hints can be followed or skipped. Follow writes only a per-session decision to existing Persistent Town state JSON and prioritizes the next eligible certified Search, Question, or Challenge; it never changes truth, evidence coverage, candidate legality, public artifacts, or Static Runtime. Static shows a read-only Server Runtime boundary with zero `/api/*` requests.

v5.26 adds **Shared World Lead Outcome Cycle**. Completing a followed eligible lead creates one shared, bounded, reversible Server Runtime effect for the current case: the fixed Search / Question / Challenge mapping updates existing location, mapped institution, and resource-ledger state with an explicit benefit and tradeoff. The effect settles after accepted theory or before another case opens. It does not change truth, evidence coverage, route certification, NPC legal actions, public artifacts, or Static Runtime; the static panel remains explanatory and zero `/api/*`.

v5.27 adds **Case Aftermath Handoff**. Only an accepted player theory that settles a followed World Lead outcome prepares one Server Runtime-only preference for the next case queue: Search / Question / Challenge map to evidence-tampering / false-testimony / court-intimidation, and the final ranking receives only a fixed `+2` bonus. The first successful next extraction consumes it even if the player chooses another legal candidate. The handoff keeps internal case keys in existing runtime JSON and exposes only ready/consumed, direction, and next-action text; it never changes candidate membership, truth, evidence coverage, route certification, NPC legal actions, public artifacts, or Static Runtime.

v5.28 adds **Case-Scoped World Arc**. Successful Server Runtime extraction binds world-system hints to the actual extracted case type and activates or resumes its safe progression line. A followed, resolved lead plus accepted player theory advances one stage; the active line may add only fixed `+1` ranking preferences without changing legal sets or certified fairness. Static displays the Server-only boundary and never stores arc progress, exposes internal keys, or requests `/api/*`.

v5.29 adds **Faction Directive Runtime Cycle**. A real-player accepted Follow that advances the case-scoped arc prepares one Server Runtime-only Support / Contain choice. The choice is a zero-tick schedule that opens a bounded 12-tick execution window; the selected content-configured institution and existing long action start on a later legal cadence, then persist their bounded ledger, opinion, and evidence-chain result as town history. Defer remains open, blocked work can use its alternate response, and internal case, actor, institution, event, and action keys never enter the safe summary. Static shows only this Server-only boundary, renders no directive controls or state, and remains zero `/api/*`.

v5.30 adds **World Pressure Cascade**. A completed Server Runtime directive derives one bounded pressure pulse from the existing long action's actual clamp-aware result. The pulse affects only the final ordering of future unextracted candidates, is consumed one layer per successful extraction, and never changes candidate membership, validity, truth, certified route, evidence coverage, legal actions, or judgement. Static displays only the Server-only pressure-cascade explanation: it renders no persisted pressure state or controls and makes zero `/api/*` requests.

v5.31 adds **Player Main Path Consolidation**. World Lead, Arc, Directive, Pressure, Outcome, and Handoff are presented through one Case & World Consequence surface with a single Current world action. Static renders the same hierarchy as a read-only Server-only boundary, without persistent state or controls. Existing certified investigation steps, public artifacts, and zero `/api/*` behavior remain unchanged.

v5.32 adds **Unified Influence Budget**. Handoff, active World Arc, and World Pressure now pass through one deterministic final-ordering ledger with a fixed `±3` combined cap. Static renders only the Server-only read-only explanation and never requests persistent influence state.

v5.33 adds **Player Resource Commitment**. Server Runtime opens one optional choice after Join: reserve Police Time for Search, Informant Trust for Question, Evidence Integrity for Challenge, or continue without a reserve. A matching successful investigation spends the existing ledger reservation once and applies a bounded world benefit; accepted theory or successful case switch returns an unused reserve once. Static renders only a Server-only read-only explanation, no resource values or controls, and no `/api/*` request.

v5.34 adds a Server-only **Faction Relationship Ledger** to the same Case & World Consequence surface. Static exposes neither persistent standing nor relationship-priced controls. Server Runtime projects only safe standing bands; internal faction values, source keys, case/directive bindings, ticks, and deltas stay private. Standing may alter only a future resource reserve's bounded cost or availability. The certified seven-step path remains unchanged and Static remains zero `/api/*`.

v5.35 adds a Server-only **World Event Offer Lifecycle**. Static renders the lifecycle boundary and explicitly states that persistent offers, deadlines, Accept/Decline controls, source/action/institution/resource state, and recovery choices are unavailable in the static bundle. Server Runtime alone may accept or decline at zero tick; the next institution cadence runs the existing long action and exposes only safe progress or terminal recovery copy. Static remains read-only, preserves the certified seven-step route, and makes zero `/api/*` requests.

v5.36 adds a Server-only **Investigator Progression** ledger. Static renders a read-only practice-profile boundary and does not persist marks, show unlock controls, or request `/api/*`. Server Runtime records only real manual investigation, evidence-selection, and accepted-theory practice in the existing Persistent Town JSON; the public summary contains bounded points, competency bands, and low-spoiler unlock labels. Internal source keys stay private, and progression never changes the active case's truth, route certificate, evidence coverage, or legal actions.

v5.37 expands the browser-local content pack to 16 case types, 10 event archetypes, and 8 progression lines. Static may display only public-safe labels, authored cluster counts, and authoring previews from these source tables; it does not persist campaign selection, request Server Runtime state, or refresh public dataset/review artifacts. The same zero `/api/*`, certified-route, and 390px no-overflow boundaries remain unchanged.

v5.38 keeps Failure and Recovery Server-only. Static displays one read-only boundary statement but never receives failure state, recovery targets, resource or institution keys, retry controls, or persistent recovery progress. It continues to make zero `/api/*` requests and preserves the same certified route and 390px no-overflow gate.

v5.39 keeps Arc Convergence and its finale lifecycle Server-only. Static may explain that several campaign histories can converge, but it never reads accepted-case counts, Arc stages, faction standings, recovery/offer/directive history, pressure consumption, finale candidate state, internal case bindings, or completion ticks. It exposes no convergence controls, requests no `/api/*`, and preserves the unchanged certified route and 390px no-overflow gate.

v6.0 keeps the complete Campaign Journey and causal finale debrief Server-only. Static displays one read-only three-case-campaign boundary but never persists chapter state, accepted-case history, consequence history, finale activation, debrief beats, or replay strategy. It exposes no campaign controls, makes zero `/api/*` requests, and retains the certified seven-step route plus the 390px no-overflow gate.

v6.1 keeps **Town Social Response Cycle** Server-only. Static displays one read-only boundary sentence but never reads the ambient queue, actor posture, NPC or location bindings, source result, progress, or persisted reaction history. It shows no reaction controls or Server state, makes zero `/api/*` requests, and preserves the certified seven-step route plus the 390px no-overflow gate. Server Runtime alone may show public NPC names, public role labels, public place names, and fixed low-spoiler reactions after a real player-driven world result.

v6.2/v6.2.1 keeps **Human Campaign Comprehension Gate** instrumentation and its fixed-slot Operations Guard Server-only and browser-local. The recorder exists only at `?runtime=server&study=1`; it writes bounded anonymous aggregate summaries to one private browser `localStorage` key and never changes runtime requests or game state. Slot order is derived rather than stored. `?runtime=static&study=1` renders no recorder, writes no study key, makes zero `/api/*` requests, and preserves the certified route and 390px boundary. The Static World Campaign surface only explains this Server-only boundary. No study data enters public catalogs, dataset readers, Server Runtime, SQLite, logs, or deployment artifacts.

The experimental v6.3 Command Deck keeps the same Static boundary. Static may use the shared presentation-only `InvestigationActionRegistry` for its fixed local demonstration, but no registry action can create a Server session, call `/api/*`, persist a world choice, read Server-only state, or bypass the certified static route. Map selection, the Context Drawer, keyboard focus, disabled explanations, and 390px layout remain browser-local. Internal action handler keys and target identifiers are never rendered.

v6.4 Town Map Lenses are also presentation-only. Static derives the Evidence lens from the fixed in-memory snapshot; Institution, Pressure, and Reaction show only whatever safe fixed-local signal is already present, otherwise an empty aggregate. Changing a lens writes no storage, changes no simulation or case state, and makes no request. Lens output contains public place/organization labels and bounded bands only, never runtime keys or raw deltas.

v6.5 Investigation Turn Loop is a local UI state machine around existing actions. Static may show Target, Action, Resolve, Feedback, and Next for its certified in-memory handlers, but the turn counter is not a simulation tick and is never persisted. It cannot authorize a Server action, add a payload field, or bypass the fixed Static case route; zero `/api/*` remains mandatory.

v6.6 World Consequence Legibility only aggregates summaries that the current runtime mode already permits. Static renders the fixed six-beat shell with its Server-only systems inactive and never fetches or reconstructs their state. The chain has no controls and no persistence; raw identifiers and deltas are sanitized before display.

v6.7 Campaign Content Expansion remains Server Runtime content. A selected local WorldPackage can bind Town Reckoning, Harbor Testimony, or Clinic Headlines before the first extraction, but Static does not inspect package source bodies, select a persistent campaign, reorder candidates, or expose internal campaign keys. Static retains its single fixed certified demonstration, zero `/api/*`, and the same truth, evidence, Route Certificate, judgement, and 390px boundaries.

v6.8 Presentation Pass is shared browser presentation only. Static may derive idle, available, selected, resolving, updated, blocked, or completed feedback from its existing in-memory demo action, render the shared state tokens, and emit an optional browser-local audio-cue event. It ships no audio asset, makes no request, writes no storage, and changes no certified route or public artifact. Reduced-motion remains mandatory at 390px and desktop widths.

v6.9 Controller and Surface Decomposition changes source ownership only. Static still uses the same browser-local handlers and certified seven-step demonstration; the new controller hooks do not contain API calls, and the split Map, Control, Investigation, Campaign, and Review surfaces do not add storage or runtime authority. The investigation/review stylesheet is loaded at the same cascade position formerly occupied by the matching `globals.css` suffix. Static therefore retains zero `/api/*`, no persistent Campaign selection, no protected-public refresh, reduced-motion behavior, and the 390px no-overflow boundary.

v7.0 Player Campaign Front Door exposes Town Reckoning, Harbor Testimony, and Clinic Headlines as three read-only safe previews in Static. The previews contain only public theme, surface, evidence-style, pressure, chapter, Finale, and replay wording; they are non-interactive and live in the control path rather than the overlay stack, so they cannot intercept the certified demonstration. Static renders no card selection state, Start Campaign, Continue Campaign, WorldPackage request, saved-world lookup, pre-simulation, or case extraction. The dedicated browser gate verifies three previews, zero `/api/*`, and no horizontal overflow at 390px.

v7.1 Nine Authored Case Trilogy remains a Server Runtime content treatment. Static keeps its single fixed certified demonstration and the three Front Door previews; it does not load authored case bodies, select a chapter treatment, persist a World Lead focus, or expose accepted-case aftermath state. Server applies an authored treatment only to a case generated from the existing world facts and reruns the ordinary validator before use. Public Server surfaces may show the authored title, premise, clue framing, safe route focus, and allow-listed aftermath sentence, but never the source events, truth, evidence membership, internal Campaign history, runtime keys, or raw case body. Static therefore retains zero `/api/*`, no persistent Campaign state, and the same 390px boundary.

v7.2 Investigation Operations Economy is Server-only. Static shows one read-only boundary sentence and never reads or persists support slots, resource availability, relationship-priced reserve cost, operation history, case-time totals, tempo settlement, or After Action results. It exposes no Use Support or Confirm Plan control and makes zero `/api/*` requests. Server planning is a zero-tick extension of the existing runtime-step command, while Search, Question, and Challenge continue through the existing certified endpoints. Map selection is presentation-only, investigation effort never hides a town tick, and only the existing Advance Town action moves the simulation clock. Static retains the fixed Manual First route and 390px no-overflow boundary.

v7.2.1 keeps the same Static boundary while closing Server Replay Isolation. Static never initializes an Operations authority, reads a practice/authoritative scope, stores a practice recovery, or renders persistent support controls; it remains zero `/api/*` with no-overflow at 390px. Server binds Operations to the first active Campaign extraction cycle and exposes later Replay sessions only as a frozen practice summary. Replay investigation and browser-only Recovery may explain or rehearse the route, but cannot write resources, pressure, progression, Campaign history, World Lead, or other Persistent Town consequences. Browser QA now checks the semantic Journal marker, frozen 3/3 case tempo, practice scope, and Server 390px Operations Board.

v7.3 Character Encounter is a shared presentation layer with different data boundaries. Static may derive a compact encounter from its fixed in-memory public actor, local case progress, and existing local action registry; it does not read Server faction, institution-pressure, Town Reaction, Operations authority, memory, or raw event state. Observe, Question, and Challenge remain the established deterministic Static handlers and make zero `/api/*` requests. Server may add only safe faction/posture/reaction labels already present in public summaries. Both modes render at most three actions and never render actor, case, location, institution, event, source, evidence, session, or handler keys. Static still writes no persistent encounter state and retains the 390px no-overflow boundary.

v8.0 Strategic Investigation Command Layer is presentation-only in Static. Static may render the fixed resource ribbon, objective hierarchy, map-first shell, context explanation, and three feedback layers from its existing in-memory demonstration. It never builds a Server decision queue, enables Advance Town, persists a command, or creates a request payload. All controls continue through established browser-local Static handlers, zero `/api/*` remains mandatory, the map stays visible in the 390px first viewport, and raw IDs, handler keys, truth, bodies, deltas, and Server summaries remain unavailable.

v8.1 Strategic Campaign Pacing remains presentation-only in Static. It derives the fixed phase, Current Objective, Why Now, local safe Forecast, Context, read-only resource explanations, and Immediate/World/Next feedback from the in-memory certified demonstration. Static has no enabled Pacing primary action, no Server Queue, no Advance Town, no session outcome persistence, no Study recorder, no `/api/*`, and no localStorage write. At 390px four core resource summaries remain visible and All Resources is a local mutually exclusive sheet; opening or closing it does not write storage. Static continues to use the unchanged seven-step local handlers and cannot expose Server world summaries or hidden authority.

v8.2 District Operations / Strategic Fronts is also presentation-only in Static. The Static shell may derive up to three read-only Investigation, Institution, and Pressure fronts from its existing in-memory public map labels, but it renders no front action and cannot persist a selection. Opening a front is mutually exclusive with Queue, Context, and All Resources, writes no localStorage, and makes no `/api/*` request. It never receives Server consequence state, raw identifiers, candidate data, truth, bodies, or resource deltas; the certified seven-step local route remains unchanged. At 390px the bounded front sheet stays above Current Action with no horizontal overflow.

v8.3 changes code ownership only. Static Guided target projection still reads the same in-memory session, Route Certificate, selected evidence, and optional public-safe World Lead label. Guided actions still call the same browser-local Join/Search/Question/Challenge/theory functions, and theory submission still delegates to `submitDemoTheory`; the new workflow modules do not import or call `/api/*` for Static. No storage key, request boundary, visible stage, fallback rule, source-review unlock, or public artifact changes.

v8.4 also changes ownership only. Static Map, Command Deck, Guided, and direct investigation controls now share one certified action adapter, but that adapter still delegates to `discoverDemoEvidence`, `interrogateDemoNpc`, `submitDemoTheory`, and `revealDemoSolution` in memory. Certified playthrough remains local and non-authoritative; selection/navigation modules cannot import request helpers. Splitting Core Actions, Route & Review, and Debrief & Replay preserves the same DOM order, controls, copy, test ids, storage behavior, seven-step path, and 390px layout. Static still makes zero `/api/*` requests and receives no Server world state.

v8.5 keeps that boundary while moving bootstrap ownership. Static runtime resolves its mode before the World Session adapter can call live-eval, world create/load/tick, or any v1 query; map and deduction graph are built from the local demo engine. The Campaign Front Door and Continue sequence are Server-only adapters, and Static renders the same read-only Campaign summaries without selection, persistence, or controls. This is a client code-ownership split only: no public artifact, browser storage key, Server schema, endpoint, or case authority is exposed to Static, and the 390px/zero-API gates remain unchanged.

Allowed Static Demo data fetches are:

- `/review-catalog/*`
- `/dataset-reader/*`

It must not fetch replay-store artifacts, SQLite data, world-pack source bodies, local dataset packages, full benchmark reports, or any `/api/*` route.

Server Runtime features remain available for local or Docker users:

- Persistent Agent Town
- Scenario Runner
- World State Time Machine rollback
- Agent API scripts
- Living World correction API

## Browser QA

Before linking a public URL from the README:

```powershell
npm run qa:static-reader -- --json
npm run content:validate -- --json
npm run public-catalog:build -- --json
npm run public-catalog:validate -- --json
npm run qa:static-browser -- --json
npm run qa:release-local -- --json
npm run build
```

- Open `/?runtime=static`.
- Confirm **Playable Investigation Path** appears in the investigation panel with Join, Search, Question, Challenge, Select Evidence, Submit, and Review Source; clicking the first next action must stay browser-local and make no `/api/*` request.
- Confirm **Guided Manual Run** appears below the playable path; repeatedly clicking **Run Next Guided Step** completes the Static seven-step path and unlocks Source Review without `/api/*`.
- Confirm **Guided Step Journal** appears below Guided Manual Run and records Join, Search, Question, Challenge, Select Evidence, Submit, and Review Source entries without raw ids or hidden truth.
- Confirm **Static Playthrough Proof** appears below the playable path; clicking **Run Certified Playthrough** shows completed / accepted theory, route certified, auto route pass, challenge hits, selected evidence, and covered obligations without `/api/*`.
- Confirm **Source Review Unlock** appears after accepted theory and opens the **Source Review Workbench** with Source Trail, Proof Obligations, Certified Route, and Conclusion Review without `/api/*` in Static Runtime.
- Confirm **Solved Case Debrief** appears after accepted theory and shows Player Route, Evidence Closure, Source Confidence, and Next Replay Goal without raw ids or hidden truth.
- Confirm **Replay Practice Loop** appears after Debrief, shows Start, Discover, Pick Evidence, Fill Theory, Submit, Review Source, and Scorecard phases, and updates current phase, next action, manual/fallback counts, source review unlock, and scorecard status during replay.
- Confirm **Replay Goal Coach** appears after Debrief, shows Reduce fallback, Manual evidence selection, Fewer guided clicks, and Review source after submit, and clicking **Start Replay Attempt** keeps Static Runtime at zero `/api/*`.
- Confirm **Manual Evidence Drill** appears during an active replay attempt after route evidence is discovered, Add to Theory updates selected evidence/manual-pick counts, and guided select-evidence waits for manual picks before submit.
- Confirm **Manual Theory Drill** appears after manual evidence is ready, suspect/motive/method fields update the Journal and Scorecard, guided submit does not auto-fallback, and explicit certified fallback can complete unresolved fields without showing hidden truth.
- Confirm **Replay Attempt Scorecard** appears with pending replay delta after **Start Replay Attempt**, then completed replay delta after the replay reaches accepted theory; it must show previous/current descriptive deltas without raw ids or hidden truth.
- Confirm **World Lead** appears after Join in Server Runtime, Follow / Keep Certified Route persist a safe status without advancing a tick or generating an event, Follow resolves after its eligible guided Search / Question / Challenge, and no raw ids or hidden truth are shown.
- Confirm a resolved followed lead shows one active low-spoiler **world effect** with benefit/tradeoff text, and accepted theory changes it to settled in the World Lead panel, Journal, Debrief, Replay Practice Loop, and Scorecard without raw ids or hidden truth.
- Confirm accepted player theory after a settled followed outcome shows a safe **next-case handoff ready** status; the first successful next extraction shows **consumed**, records the safe Journal aggregate, and leaves the player free to select any legal candidate.
- Confirm Static Runtime shows the read-only **World Lead** Server Runtime boundary after Join without Follow / Skip controls and without `/api/*` requests.
- Confirm Static Runtime describes the Server-only **Faction Directive** boundary without Support / Contain / Defer controls and without `/api/*` requests.
- Confirm Static Runtime describes the Server-only **Investigator Progression** boundary without persistent practice controls and without `/api/*` requests.
- Confirm a completed Server directive shows an active low-spoiler **World Pressure** summary in Server Runtime, a successful next extraction consumes one layer, Journal/Debrief/Replay/Scorecard show only aggregate state, and no source/resource/action keys or raw deltas appear.
- Confirm an accepted Follow settlement prepares **Town Reactions**, three normal positive ticks expose no more than one distinct named resident per tick, Situation Brief shows only the latest safe role/place reaction, and the public runtime contains no internal ambient queue or raw keys. Static must show only the Server-only boundary with no buttons or `/api/*`.
- Confirm `?runtime=static&study=1` shows the Server-only campaign study boundary but no **Campaign Study Recorder**, leaves `detective-town-campaign-study-v1` unset, makes zero `/api/*` requests, and remains free of horizontal overflow at 390px. Run `npm run qa:campaign-study -- --json` for the paired Server/Static study gate.
- Confirm Static Runtime describes the **Server-only pressure cascade** without persistent state, controls, or `/api/*` requests; at 390px it has no page-level horizontal overflow.
- Confirm Static and Server Runtime both show one **Current world action** inside the consolidated world surface; Server prioritizes the actionable choice while Static keeps the certified path and exposes no world controls.
- Confirm Server Runtime shows **Campaign Pacing** inside the existing Campaign surface with Current Objective, Why Now, and a collapsed What Changes / What Stays Fair disclosure; Situation Brief, Journal, Debrief, and Replay expose aggregate context only. Static shows only the Server-only Campaign Pacing boundary, no persistent chapter state or controls, and zero `/api/*`.
- Confirm Server Runtime shows one **Unified influence budget** for Handoff, World Arc, and World Pressure with a fixed `±3` total cap; Static shows only the read-only Server-only boundary, no persistent values or controls, and zero `/api/*`.
- Confirm Static shows only the **Server-only world event offer lifecycle** with no offer buttons or persistent deadline state. Server QA should cover offered → accepted → running/completed or resource-gated failed, with no raw source, action, institution, actor, resource, or tick keys.
- Confirm Server Runtime shows the **Case Operations Board** after Join, permits zero to two supported Search / Question / Challenge lanes, confirms or replans atomically at zero tick with zero events, and keeps Manual First legal when support is unavailable. Each lane resolves once through the existing handler and After Action reports safe cost, gain, pressure, time, and next direction.

- Confirm Server Runtime shows **Investigator Headquarters** after an accepted first or second Campaign case: `ready` exposes five bounded direction tiles, extraction is clearly blocked until one direction is chosen, the choice returns no events and no clock movement, extraction changes the summary to `active`, and accepted closure changes it to `completed`. The public summary must contain no cycle, case, target, resource, action, Recovery source, or tick key. Static Runtime shows only the Server-only Headquarters boundary, no tiles or extraction controls, and zero `/api/*`.
- Confirm accepted theory settles Investigation Operations, returns unused support once, and applies at most one bounded tempo-pressure point; case switch returns unused support without an accepted result. Situation Brief, Journal, Debrief, Replay, and Scorecard show aggregates only, with no raw session, case, location, resource, tick, or delta keys.
- Confirm Static Runtime shows only the read-only **investigation operations economy** boundary with no support/plan buttons, no persistent state, zero `/api/*`, and no page-level overflow at 390px.
- Confirm Server Runtime shows safe faction standing bands after Join, records one change after a spent case resource or accepted case, and records the completed Support/Contain result only once. Trusted/strained/hostile standing may change only the next visible reserve cost or availability; public text must contain no internal faction key, numeric score, source key, case/directive binding, delta, or tick.
- Confirm Static Runtime shows only the Server-only **faction relationship ledger** boundary with no persistent standing or relationship-priced controls, zero `/api/*`, and no page-level overflow at 390px.
- Confirm Server Runtime shows directive ready -> defer -> scheduled -> running -> completed, Situation Brief progress, and Journal / Debrief / Replay aggregates without raw ids.
- Confirm **Server Playthrough Proof** appears for an extracted Server Runtime emerged case; clicking **Run Server Certified Playthrough** shows completed / accepted theory, source-backed route, challenge hits, selected evidence, and covered obligations while using only local Server Runtime APIs.
- Confirm Server Runtime can also complete the emerged case by repeatedly clicking **Run Next Guided Step**, then shows Source Review Unlock and the workbench.
- Confirm Server Runtime also shows the Guided Step Journal, Solved Case Debrief, Replay Practice Loop, Replay Goal Coach, Manual Evidence Drill, Manual Theory Drill, and Replay Attempt Scorecard after guided completion, including explicit fallback use, field-level manual/fallback counts, proof gaps, review unlock status, replay attempt activation, manual evidence picks, current phase, next action, and completed replay delta.
- Confirm **Reviewer Home** shows **Reviewer Main Path**, 5000 tick dataset, case count, case type count, world-system count, system row count, evidence node count, audit clean status, zero `/api/*`, and reader hash.
- Confirm **Reviewer Main Path** shows Pack, Replay, Map, and Agent cards with reviewer questions, aggregate metrics, next actions, and routes into existing static review views without `/api/*`.
- Confirm **Proof Strip** shows Static Boundary, Stable World, Case Quality, and World-System Influence status buttons, and that proof details remain below the main path.
- Confirm **Stable World Proof** shows 3 seeds, 1000 ticks each, all pass, diagnostics, regression, no blockers, no blocked/regressed deltas, deterministic hash snippets, per-seed pass cards, runtime band, diagnostics finding counts, regression delta counts, and deterministic hash comparison.
- Confirm **Case Quality Proof** shows average score, lowest seed score, status, fair-play evidence, diversity, continuity, institution, and non-blocking status.
- Confirm **Trust Snapshot** and **Review Path** are visible, and the review path focuses Dataset Reader, Public Case Explorer, Evidence Distribution, and Audit Boundary without loading server data.
- Confirm the **Public Demo Vertical Slice** still shows Pack, Replay, Map, Agent, Proof, Boundary, Content Tables, and zero `/api/*`.
- Confirm **World Systems overview** shows roles, locations, resources, factions, events, and growth lines as aggregate-only cards.
- Confirm the **Dataset Reader** panel shows the 5000 tick gate, audit summary, reader hash, case/evidence totals, top distributions, world package count, **Reviewer next step**, and **Public Dataset Explorer**.
- Confirm **Public Dataset Explorer** search/sort controls work across Case Types, Evidence Types, World Packages, and Gate & Audit without exposing raw case bodies or spoiler fields.
- Confirm **Public Case Explorer** search, sort, case type filter, location filter, and warning status filter work from `case-summary-index.json`; selected cards show only public case id, source case hash, ordinal/tick, type, location, evidence count, warning count, and influence edge counts.
- Open **Authoring** and confirm `Authoring Workflow Coach` shows the Draft, Content Seed, Safe Diff, Validation, Run Draft, and Gallery Backup stages plus `Next Action`. Then open **Content** and confirm the browser-local Content-Guided Case Authoring tab shows Resource, Faction, Event Archetype, and Growth Line selectors, world-system metrics, world-system preview labels, `Safe Diff Review`, apply/undo flow, `Content Seed Undo`, and `Before Content Seed` Local Case Gallery restore. This flow may update browser `localStorage`, but it must not call `/api/*`, write SQLite, write repo JSON, change ids/proof structure, or publish full content rows into public artifacts.
- Confirm no `/api/*` requests are made and static data fetches stay under `/review-catalog/*` and `/dataset-reader/*`.
- Confirm `qa:release-local` reports `publicArtifactsStable: true`.
- Run `npm run dataset:static-reader -- --path=outputs/dataset-packages/detective-town-v3-5000-campaign` before build when refreshing the public reader bundle.
- Open `/openapi.v1.json` and confirm valid JSON.
- Check desktop and mobile widths for page-level horizontal overflow.
- Confirm the console has no app runtime errors.

### v7.5 Static/Server boundary

v7.5 adds no Static simulation authority. The nine-case playthrough, Headquarters gate, World Lead settlement, Operations plan, explicit Recovery, Arc Finale, and public Campaign debrief are Server Runtime behaviors over the existing local runtime JSON. Static may describe the Command Deck and Campaign boundary, but it never selects a Campaign, persists a Headquarters choice, calls a runtime command, reads private Campaign history, or requests `/api/*`.

The paired v7.5 checks use a temporary Server database for the nine-case API playthrough and remove its database/WAL/SHM files after the run. Static browser QA remains read-only at 390px, keeps the certified route unchanged, and verifies zero `/api/*`, no study storage, no raw identifiers, no horizontal overflow, and no persistent world controls. The v6.2 recorder remains **instrumentation ready**; automated v7.5 coverage is not a substitute for the required human sessions.

### v8.6 Campaign Pacing boundary

v8.6 derives public pacing text from the existing three Campaign definitions and nine authored-case treatments. Server Runtime reuses that pure projection in the Command Deck, World Campaign, Situation Brief, Guided Journal, Debrief, and Replay surfaces. It explains the current objective, Why Now, the visible public-world consequence, the unchanged fair-play boundary, and the next-case context without creating a command, request, candidate preference, runtime record, event, tick, or storage entry.

Static does not initialize Server campaign state or expose the nine-case runtime projection in Journal, Debrief, or Replay. Its World Campaign surface contains one read-only `Server-only campaign pacing and content value` boundary, no buttons, and no persistent status. `?runtime=static&study=1` remains zero `/api/*`, writes no study storage, and has no horizontal overflow at 390px. Protected public catalogs are not regenerated for this presentation-only release.

### v8.7 Focused Resolution Theatre boundary

The Campaign Transition Theatre is a Server Runtime presentation layer over existing certified action results and Campaign progress. Static does not mount the Theatre, participate in overlay arbitration, retain transition phases, or synthesize Server consequences. After the local Join path it shows only `Server-only focused resolution and campaign transition theatre` inside the existing World Campaign boundary, with no controls or persistent status.

Static actions continue through the existing in-memory demonstration helpers. `?runtime=static&study=1` writes neither launch nor study storage, requests no `/api/*`, displays no persistent Theatre, and retains the 390px no-overflow gate. The v8.7 browser checks also require the Server Theatre to own its layer over Encounter, Context, Fronts, notifications, and toasts; opening Case Files keeps actor selection but hides the competing Encounter. This is presentation-only and does not regenerate protected public catalogs.

### v8.8 Objective-First boundary

Static retains one local Strategic Pacing objective and renames the read-only World Campaign duplicate to `Campaign priority`. It does not receive the Server focused subsystem state, open a persistent archive, or synthesize a world decision. Public Change and safe outcome details remain behind the local Safe Forecast disclosure; no Static control can schedule, persist, or advance a Server world action.

The same 390px gate now checks Current Objective -> Theatre/map -> Current Action ordering, one canonical objective, 44px disclosure controls, and zero horizontal overflow. `?runtime=static&study=1` still initializes no Study recorder, writes no localStorage, calls no `/api/*`, and does not regenerate `public/dataset-reader` or `public/review-catalog`.

### v8.9 Certified Case Rhythm boundary

Static derives the same Intake / Fieldwork / Deduction / Review rhythm entirely from its existing in-memory demo session. Observe remains the browser-local preparation before Search. The compact objective and default-closed full route can focus existing local targets, but they cannot persist a Campaign choice, call a Server handler, write Study state, or request `/api/*`.

Manual First remains authoritative for evidence and theory entry. The rhythm never auto-selects a clue, fills culprit/motive/method, submits a theory, or reveals a source review merely because a target is focused. Its automated click, panel-switch, and settle budgets are browser QA measurements only and do not claim human comprehension. Protected public catalogs remain read-only.

### v9.0 Authored Campaign route boundary

Static shows the original and counter route names for each of the three Campaign families while keeping the original route's safe three-chapter, evidence-style, world-surface, and Finale preview visible. It renders no route-choice buttons, does not send the internal route key, does not persist a Campaign route, and continues to request zero `/api/*`. The Front Door explicitly labels route choice, start, and continue as Server-only.

Server Runtime may select one of the six authored routes through the existing WorldPackage-select command. The internal route key remains inside the existing Persistent Town JSON and is removed with the rest of the internal Campaign session by the public projection. Static receives no persisted route summary, case body, raw identifier, hidden truth, or server consequence. The 390px gate covers both route labels without horizontal overflow, and protected public catalogs remain read-only.

### v9.1 Architecture Headroom boundary

v9.1 moves existing browser presentation derivations into two request-free hooks and divides Command Deck responsive CSS and Campaign Front Door route/preview CSS into independently budgeted files. It does not introduce a new Static or Server capability. The same action adapters, endpoints, payloads, response order, copy, DOM order, ARIA, and runtime authority remain in place.

Static still resolves its runtime mode before any Server bootstrap or read query, builds its Map, Inspector, certified audit, route preview, and Source Review from the existing in-memory demo, and makes zero `/api/*` requests. It does not persist Campaign route choice, world state, Theatre state, or Study data. The 390/768/1440 browser gates retain map interaction, keyboard focus, and no-horizontal-overflow coverage, and protected public catalogs remain read-only. v6.2 remains **instrumentation ready**, not Human Gate passed.

### v9.2 Campaign Command Clarity boundary

The v9.2 Command Brief is shared presentation only. Static derives the same fixed Objective -> Action -> Map -> Context hierarchy from its deterministic in-memory command view, but it never enables a persistent action, reads Server-only World Lead/Directive/Recovery state, writes study or launch storage, or creates a request. District Strategic Fronts remain read-only map focus; the mobile sheet is bounded below its trigger and does not cover Current Action. `?runtime=static&study=1` still initializes no recorder, makes zero `/api/*` requests, and preserves the certified seven-step route and 390px no-overflow boundary.

### v9.3 Command Resolution Ledger boundary

The v9.3 Ledger is another shared presentation projection, not a Static simulation feature. Static renders the same `Result -> World Change -> Objective Progress -> Next Action` structure from its in-memory certified demo and session-local Journal, but its world-change field is fixed to `No persistent world change`. It never reads Server outcomes, handoffs, directives, pressure pulses, resource deltas, or private runtime records, and it creates no Ledger storage key, endpoint, tick, event, or public artifact.

The compact order is Current Objective -> Current Action -> Latest Resolution -> Map -> Context. Transition Theatre remains Server-only, while the Static Latest Resolution and Journal are non-interactive explanations. `?runtime=static&study=1` continues to create zero `/api/*` requests, zero Study writes, no persistence control, and no horizontal overflow at 390px.

### v9.4 Final Detective Workspace boundary

Static and Server Runtime now render the same public-safe Final Detective Workspace projection. Static derives Evidence, Testimony, Contradictions, Theory readiness, Source Review, and its single Current Task from the existing deterministic in-memory demo. Its primary action delegates only to the established local demo helpers. It does not initialize Server state, persist a world choice, validate a theory in the presentation layer, or request `/api/*`.

Server Runtime uses the same workspace component, but its actions continue through the existing certified investigation adapter and unchanged Join, Discover, Interrogate, Submit Theory, and Reveal endpoints. Recovery remains an existing Server Campaign action; Source Review appears only after the existing judgement accepts the theory. The read-only Playable Investigation Path remains a secondary route audit rather than a duplicate action surface.

At wide desktop sizes, opening Case files & detail gives the workspace a bounded central three-column theatre. At 768px and 390px, container queries preserve Objective -> Current Task -> Evidence/Testimony -> Active Context -> Theory -> Source Review -> Latest Resolution as a single-column disclosure with 44px controls and no horizontal overflow. The workspace owns no `aria-live`; v9.3 keeps the single announcement owner. Static with `study=1` still shows no Study Recorder, writes no localStorage, and makes zero `/api/*` requests. Protected public catalogs remain read-only, and v6.2 remains **instrumentation ready**, not Human Gate passed.

### v9.5 Campaign Content boundary

Static now previews the fourth safe Campaign, **Midnight Chorus**, and its two read-only routes: Public Reckoning and Backstage Compact. The preview includes only public theme, chapter labels, strategy prose, evidence surface, pressure surface, Finale label, and replay contrast. It does not expose the internal Campaign key, WorldPackage key, case-family key, route key, case body, truth, or source binding.

The new theatre/market/night-watch package is consumed only by Server Runtime before extraction. Static does not load its runtime package, persist a route selection, show Start or Continue, write local study data, or request `/api/*`. The existing local demo remains deterministic and uses the same certified seven-step projection; authored breadth is represented as safe copy, not a second browser authority. The fourth-card and 390px checks are included in Campaign Front Door and Static Browser QA, while 390/768/1440 Command Deck QA remains the responsive authority gate. v6.2 remains **instrumentation ready**, not Human Gate passed.
