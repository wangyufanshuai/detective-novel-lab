# World Simulation Depth

This project now has three complementary simulation layers:

- **Detective Town**: a hard-logic murder mystery engine. It simulates NPC life, extracts a case from `WorldEvent` logs, and validates fair-play deduction.
- **Persistent Agent Town**: a server-runtime loop where NPCs carry persistent goals, memories, plans, pressure, resources, and decision traces across ticks.
- **Living World Lab**: a broader observer workbench. It extracts a world graph from chapter text, audits extraction quality, applies local correction overlays, replays source-backed actor decisions, and supports bounded interventions.

## Local Rules Before Language

The important rule is the same in both layers: language is not the source of truth.

Detective Town validates:

- unique culprit;
- motive, means, opportunity;
- discoverable decisive evidence;
- memory-scoped testimony;
- non-culprit exclusion chains;
- reasoning coverage.

Living World Lab validates:

- graph references between entities, relationships, events, and development hooks;
- paragraph-backed evidence snippets;
- character state points tied to character entities;
- theme signals tied to known themes and chapter evidence;
- causal claims and chains with evidence;
- correction patches against their target objects and paragraph references;
- simulation steps with legal action candidates and provenance.

Audit Studio evaluates:

- evidence coverage;
- reference integrity;
- unresolved merge conflicts;
- extraction confidence;
- correction completion;
- whether corrected views remain valid without mutating original extraction results.

Persistent Agent Town validates:

- per-tick agent decision traces;
- complete action score fields;
- blocked action reasons for illegal choices;
- memory propagation and action consequence summaries;
- event and memory provenance for case candidates;
- candidate failure reasons before extraction;
- fair-play validation after a candidate becomes a playable case.
- v4.8 rule behavior: selected actions should be deterministic but not mechanically rotated, case candidates should be ranked by chain maturity and reviewable evidence, and institution pressure should influence the world before it becomes a direct case trigger.

## Persistent Runtime Loop

Persistent Agent Town adds a long-running form of Detective Town:

```text
NPC state -> propagated memory -> legal candidate actions -> local scoring -> WorldEvent -> consequence -> CaseCandidate -> validation
```

The runtime is deliberately stored inside existing world JSON instead of a new graph database. That keeps the project deployable as a local SQLite app while still making the agent loop observable through `/api/v1/query/town/*`.

Decision traces are first-class output. They now preserve tick phases, selected action consequences, propagated memory ids, and candidate chain stages. A failed or blocked candidate should answer "why did this not become a fair mystery?" instead of returning only `false`.

v4.8 keeps the same loop but tightens the behavior rules. Actor selection now accounts for recent participation and unresolved chain pressure; action selection keeps the highest legal score as authority but uses chain-stage need, institution/evidence pressure, and recent action mix as tie-breaks when candidates are close. Candidate queues are sorted toward triggered, evidence-backed, memory-scoped, exclusion-aware cases without relaxing the fair-play validator.

## Replay Provenance

Every Living World replay step has one of four provenance values:

| Value | Meaning |
| --- | --- |
| `source` | The replay matched an extracted source event. |
| `inferred` | The engine inferred a local transition from supported state. |
| `counterfactual` | The user/agent intervention selected a bounded alternate action. |
| `gap` | The engine stopped because evidence or legal action support was missing. |

This makes failures useful. A `gap` is not hidden; it tells the author where the source model lacks enough support.

## Correction Overlay Boundary

Living World corrections are overlays, not source rewrites:

- original chapter text stays unchanged;
- original paragraph evidence indexes stay unchanged;
- original extracted graph remains queryable through `/api/v1/query/novel/world-graph`;
- corrected output is queryable through `/api/v1/query/novel/corrected-world-graph`;
- every patch keeps an audit trail with created, applied, dismissed, or reverted status.

## Agent Intervention Boundary

Interventions are deliberately narrow. External agents can change actor conditions, but cannot directly edit world truth:

- actor location;
- actor knowledge availability;
- relationship pressure;
- resource possession;
- body capability.

After an intervention, the next branch remains bounded by `branchStepLimit` and is marked as counterfactual.

## Why This Matters

The comparison target is not "a nicer prompt." The target is an engine shape where a developer or agent can:

1. observe current state;
2. inspect source evidence;
3. decide an intervention;
4. apply it;
5. observe the changed branch;
6. evaluate whether the world still has enough evidence support.

That is the core step toward a persistent detective world.
# v5.28 Case-Scoped World Arc

The first persistent cross-case progression loop now uses the existing detective content tables as runtime context instead of display-only metadata. Successful extraction rebinds world-system hints to the actual candidate case type; progression lines retain resumable stages, and only followed, resolved, accepted player investigations advance them. Active incomplete lines contribute bounded ranking signals only. Per-case location, institution, and resource effects remain reversible, and truth, evidence coverage, route certification, candidate membership, and legal NPC actions remain invariant.
# v5.29 Faction Directive Runtime Cycle

World Arc progression now hands one player choice into the existing single-writer town simulation. Event-archetype content maps Support and Contain to an institution strategy and long-action kind; the zero-tick choice is only intent and opens a bounded 12-tick execution window, while the next legal cadence performs actor/resource checks and the normal multi-tick lifecycle applies the durable result. FIFO stage dedupe, stable actor tie-breaking, same-institution cadence suppression, and one-time reservation refund keep the operation deterministic and bounded. These effects may alter future unextracted case conditions, but never mutate the truth or certified route of an extracted case.

# v5.30 World Pressure Cascade

Directive completion now turns the existing long action's clamp-aware applied result into a short cross-case feedback pulse. Evidence contamination has first signal priority, followed by public opinion, institution pressure, and actual reserved resource spend; content `caseTypeIds` remain the preferred focus, with a stable action/resource fallback. Same-focus same-direction pulses merge to three layers, opposing directions remain independently auditable, active/history state is bounded, and the final signed candidate-ranking effect is clamped to `[-2,+2]`. Reads and previews are idempotent; only a successful future extraction consumes one FIFO layer. This adds a visible feedback loop between durable world action and the next case queue without mutating candidate membership, current/extracted case truth, evidence coverage, certified routes, legal actions, or judgement.

# v5.31 Player Main Path Consolidation and Runtime Modularization

The player-facing world campaign now resolves its existing lead, arc, directive, outcome, handoff, and pressure states into one safe Current world action before rendering the detailed state. This reduces competing calls to action without deleting the underlying deterministic lifecycle. The corresponding UI is isolated in a dedicated component, and World Pressure mechanics are isolated in a dedicated engine module while retaining the existing runtime JSON and exports. This is a structural release: no new modifier, endpoint, schema, public artifact, or proof surface is introduced.

# v5.32 Unified Influence Budget

Player-earned future-case influence now passes through one pure ledger at the final candidate-ordering boundary. The ledger records the safe source class and bounded signed contribution for the ready handoff, an advanced active World Arc, and active World Pressure; the final aggregate is clamped to `[-3,+3]`. Existing compatibility helpers delegate to the same source derivation, so there is no second scoring path. The ledger is derived from existing Persistent Town state rather than persisted as a new authority. Public runtime, World Campaign, and Situation Brief expose only aggregate source count, direction, strength, and the fixed cap. Eligibility, candidate membership, validity, truth, evidence coverage, route certification, legal actions, and judgement remain invariant.

# v5.33 Player Resource Commitment

The first case-scoped player economy decision now uses the existing town resource ledger rather than a display-only score. Join opens one optional choice: Police Time -> Search, Informant Trust -> Question, or Evidence Integrity -> Challenge. A zero-tick decision moves exactly two units from available to reserved. The existing successful investigation endpoints are the consumption authority; the matching lane moves the actual reserve into spent state once and applies one clamp-aware benefit to location resource pressure, witness fear, or evidence contamination. Wrong theory leaves the reservation untouched. Accepted theory or route-integrity-successful case switch returns only unused reserved units once. The current/extracted case truth, evidence, route certificate, legal actions, and judgement remain frozen, while future town conditions may observe the durable resource spend and bounded benefit.

# v5.34 Faction Relationship Ledger

Prior player choices now alter how existing institutions treat the investigator across cases. A bounded internal matrix covers all eight existing institution kinds. Completed Support/Contain operations, actually spent case resources, and accepted real-player cases create deterministic, deduplicated standing changes; previews, autosolve, wrong theories, failed extraction, and repeated calls do not.

Public runtime exposes only safe `trusted`, `neutral`, `strained`, or `hostile` bands and aggregate counts. Internal values, source keys, case/directive bindings, ticks, and applied deltas remain private. Trusted, strained, and hostile bands adjust only the cost or availability of a future matching Player Resource Commitment. No relationship result can change an extracted case's truth, route certificate, evidence coverage, legal actions, or judgement. Recovery remains an explicit future action rather than hidden time decay.

# v5.35 World Event Offer Lifecycle

Completed real-player faction directives can now enqueue a bounded, content-configured world opportunity. The lifecycle is explicit and deterministic: `offered` can be accepted or declined without advancing the town clock; an accepted offer waits for the next legal institution cadence, then reuses existing actor selection, resource reservation, long-action progress, event emission, completion delta, and one-time refund rules. A completed offer adds one explicit relationship recovery for the operating institution. Resource-aware creation prefers the alternate faction response and falls back to the completed response only when that configured operation is currently affordable; it never creates resources or bypasses catalog costs. If no actor, relationship, institution, or resource prerequisite is legal, the offer fails safely and names a recovery path.

Offer state lives only in the existing Persistent Town JSON and is bounded by FIFO retention and a deadline. Public runtime, Situation Brief, Journal, Debrief, Replay, and Case & World Consequence expose safe labels, progress, deadline bands, and terminal guidance while stripping source/directive/case/event/actor/action/institution/resource/tick keys. Preview, reads, autosolve, wrong theories, case-switch settlement, and failed extraction do not create or consume offers. Static Runtime presents only the Server-only lifecycle boundary, keeps the certified seven-step route unchanged, and makes zero `/api/*` requests. This is a world-opportunity loop, not a proof card or a new event queue.

# v5.36 Investigator Progression

Real manual investigation now leaves a bounded practice trace in the existing Persistent Town JSON. Search, Question, Challenge, evidence selection, and accepted theory each map to a safe competency band; repeated source keys are idempotent and the internal ledger is capped. Public projection exposes only practice points, developing/established status, competency labels, unlock labels, and a low-spoiler next action.

Progression is a future-facing assist layer, not a hidden difficulty modifier. Established lane practice can reduce one matching future resource reservation (never below one), and established case-closure practice enables one retry for a failed or expired World Event Offer. Autosolve, counterfactual interventions, previews, wrong theories without selected evidence, and case-switch settlement do not award marks. The active or extracted case remains byte-stable in truth, route certificate, evidence coverage, legal actions, and judgement. Static Runtime shows only a read-only Server-only boundary and continues to make zero `/api/*` requests.

# v5.37 Content Expansion and Authoring Grammar

The detective content pack now contains 16 case types, 10 event archetypes, and 8 progression lines. New authored contrasts cover missing archive records, clinic inventory timing, dock witness substitution, editorial coercion, household escrow, and forged permits. These rows reuse the existing 19 evidence families, nine roles, seven motives, six resources, six factions, directive response catalog, and long-action engine rather than creating parallel runtime systems.

Backward-compatible optional metadata—`authoredCluster`, `contrastKey`, and `campaignTags`—defines a compact campaign grammar under the unchanged `detective-content-pack.v1` schema. Validation rejects unsafe metadata, duplicate contrast keys within a cluster, clusters without an authored event or progression line, broken references, and institution-incompatible directive responses. Deterministic short-campaign selection chooses distinct case types and distinct clusters before any repeat. This is source-content expansion and authoring support, not a public artifact refresh or another player-facing proof surface.

# v5.38 Failure and Recovery

Failure is now a bounded runtime state rather than a dead end or silent reset. Rejected theory, resource shortage, hostile relationship, blocked faction operation, and failed or expired opportunity sources enqueue one deduplicated recovery action in existing Persistent Town JSON. The queue is FIFO and capped at 32 records.

Player Start or Defer decisions are zero tick and produce no event. Route review and alternate-response guidance complete immediately because they only point back to already legal choices. Resource restoration, trust rebuilding, and opportunity reopening complete on the next institution cadence; each records only its actual clamped delta, and an offer may be reopened by campaign recovery once. The active case truth, required evidence, route certificate, candidate membership, legal action set, and judgement remain unchanged.

# v5.39 Arc Convergence Finale

The short campaign can now converge through three distinct histories without introducing a privileged faction build. Coalition accepts trusted standing or a completed world opportunity; Resilience accepts a completed recovery; Pressure-balance accepts a completed directive or consumed cross-case pressure. Every route also requires two real accepted cases and two advanced World Arc stages, and stable precedence makes the selected safe context deterministic when histories overlap.

Readiness places the shared `court-intimidation` finale family into only the first future candidate slot before the normal candidate validation pass and gives it one fixed `+3` ordering signal. It does not create a case, select a culprit, inject evidence, bypass validity, or remove alternatives. Choosing a non-finale case leaves convergence ready. Route-integrity-successful finale extraction binds the state to that frozen case; only its accepted theory completes the cycle.

Internal qualification signals, active case binding, and ticks remain in existing Persistent Town JSON. Public runtime and Situation Brief expose only locked/forming/ready/active/completed status, two bounded progress labels, a safe approach label, and next action. No endpoint, SQLite/public/content schema, background task, public artifact, synthetic event, or proof card is added.

# v6.0 Complete Three-to-Five-Case Campaign

The campaign layer now orchestrates existing authorities instead of adding a parallel mission engine. A clean runtime opens a campaign; route-integrity-successful extraction activates a chapter; a real accepted player theory closes it; world choices occupy the transition; v5.39 readiness exposes the shared finale; finale extraction and its accepted theory complete the journey. The intended route closes three cases, while internal accepted-case history and ordinal display remain bounded at five.

The public Campaign Journey shows only chapter status, `n/3` progress, one primary action, up to four aggregate consequence labels, and a replay prompt. Internal case IDs, accepted ticks, and per-case history stay inside existing runtime JSON and are stripped by public projection. Situation Brief reuses the same summary.

Campaign completion unlocks a bounded causal debrief. Its beats are derived from certified closure count, safe convergence approach, relationship bands, completed directive/offer/recovery counts, and consumed pressure count. It never infers an unsupported cause and never displays raw IDs, keys, bodies, truth, evidence, or source material. Source Review remains the authority for case correctness; Campaign Debrief explains only how visible world choices accumulated.

# v6.1 Town Social Response Cycle

Player-driven world results now receive one short ambient presentation cycle. The only sources are an accepted theory settling a Follow World Lead Outcome, a completed player-selected Faction Directive, a completed accepted World Event Offer, or a Campaign Recovery that records a non-zero resource, relationship, or opportunity restoration. Skip, wrong theory, autosolve, Defer, Decline, failure, expiry, zero-delta recovery, preview, and read paths do not create a cycle. Source keys are idempotent, cycles are FIFO, only one advances at a time, each contains at most three distinct living NPCs, and the complete queue/history is capped at 24.

Direction reuses the existing World Pressure applied-result precedence: evidence contamination, public heat/fear/rumor/media, police trust, institution pressure, then bounded restoration signals. `relief` becomes supportive public posture and `rising` becomes guarded posture. The public target is selected deterministically from the action/outcome location when public, then the affected institution's strongest public influence, then the first stable public place. NPC selection prefers affected institution staff by rank, workload, and stable key; then current occupants, residents related to the source actor, and a stable living fallback. Fixed reaction families describe public coordination, reassurance, routine recovery, watchfulness, avoidance, or changed routine.

The state is quarantined from simulation authority. A positive town tick advances one ambient reaction but creates no `WorldEvent`, memory, observation, propagation, decision trace, relationship authority, location profile delta, rule-state delta, evidence-chain delta, candidate-cache invalidation, or action-score input. In paired tests, worlds with and without the cycle retain identical events, memories, observations, NPC decisions, rule state, location profiles, candidates and order, and legal action sets. Public runtime strips source, NPC, location, institution, and tick keys; World Campaign may show safe name, role, place, and reaction, while Situation Brief shows only the latest one.
# v7.2 Investigation Operations Economy

The former one-choice case resource commitment is now the compatibility surface for a bounded case Operations plan. A real player may assign at most two of the three certified lanes: Search uses Police Time, Question uses Informant Trust, and Challenge uses Evidence Integrity. Costs still come from the existing faction-standing terms and investigator-practice discount. Plan confirmation and replanning reserve or return actual ledger capacity atomically without a tick or event; a used lane cannot be removed, and all remaining reserves return once at accepted closure or successful case switch.

Each successful certified lane is recorded exactly once. Supported work uses one `tickIntervalMinutes` block and applies the established location-pressure, witness-fear, or evidence-contamination benefit. Manual First uses no reserve and two blocks, but remains legal even when every resource is unavailable. These blocks are case-tempo accounting rather than hidden simulation: map selection costs zero, investigation endpoints do not run `advancePersistentTownTick`, and only the normal Advance Town command moves the world clock and executes NPC/institution phases.

Accepted closure converts total case tempo into at most `-1`, `0`, or `+1` actual location resource-pressure delta, clamp-aware and idempotent. Case-switch settlement refunds without applying this accepted-case tempo result. This is the only new future-world consequence; there is no new candidate bonus, event, memory, observation, proof rule, or currency. Current/extracted truth, evidence membership, Route Certificate, judgement, candidate membership, and NPC legal actions remain unchanged.

# v7.2.1 Investigation Authority & Replay Isolation Gate

The Operations loop now has an explicit authority boundary shared by runtime and UI:

- The first real player session in an active Campaign extraction cycle claims one internal authority record in the existing Persistent Town JSON. Its cycle identity is derived from the server's Campaign extraction sequence, not from a client-provided session label.
- A later join for the same cycle receives a safe, frozen `practice` view of the authoritative plan. It cannot reserve, replan, consume, refund, or settle a lane. A settled cycle cannot be reopened by a repeated accepted request.
- Search, Question, Challenge, investigator progression, Recovery creation, World Lead decisions, and accepted Campaign settlement all verify the same active cycle authority. `auto-player`, preview, wrong theory, source review, and Replay Practice remain non-authoritative.
- Replay may still persist its own player session and display browser-only Recovery guidance after a rejected theory. That guidance is deliberately local: no runtime JSON, tick, event, resource ledger, location pressure, Campaign history, handoff, arc, directive, or social consequence is written.
- Extracted case truth, evidence membership, testimony authority, Route Certificate, candidate ordering, judgement, NPC legal actions, and world events remain isolated from Replay. Public runtime continues to strip authority records and all internal keys.

This mirrors single-writer and mission-lifecycle patterns from AI Town, Wesnoth, Endless Sky, and Cataclysm-DDA without importing a second simulation engine. The important product effect is that a replay can teach the player the route without silently charging the world a second time. `test:investigation-operations`, Persistent Town API smoke, and Static Browser QA cover cycle idempotence, frozen practice summary, semantic Journal marker, zero-event replay, public projection, and 390px Operations Board.

# v7.3 Character Encounter Layer

Character Encounter turns map residents into a contextual presentation surface rather than a new simulation actor. Its pure model accepts public name, role, location, bounded institution/location pressure bands, safe faction standing, the public Town Social Response summary, player-known investigation progress, and actions already selected by the shared context resolver. It emits one of five postures—supportive, guarded, busy, avoidant, or routine—plus availability, public standing, at most one matching reaction, case-contact progress, and at most three existing actions. Stable precedence gives a matching social response priority, then closed/guarded faction standing, bounded public pressure, known contact, and routine fallback.

The encounter model never receives `WorldMapActor.status`, case role, MemoryRecord, hidden relationship, truth, raw event body, evidence source, decision trace, or internal keys. The map no longer uses hidden actor status to style the playable pins; each public posture instead has a visible symbol and text legend in addition to color. A resident outside the current certified character set receives public context only and no fabricated action.

# v7.4 Investigator Headquarters and Long-Term Progression

Investigator Progression now becomes a real cross-case intermission instead of a passive practice ledger. After an accepted first or second Campaign case, the existing runtime JSON prepares one Headquarters stage. The next successful extraction is gated until the player chooses one available direction; the choice itself is a zero-clock, zero-event command and does not reorder or remove candidates.

The five fixed directions are Field Search, Witness Work, Contradiction Analysis, Evidence Handling, and Institutional Access. Eligibility comes from the matching manual practice mark, with a stable Institutional Access fallback preventing a dead transition. A direction is recommended according to the selected Campaign, but every available direction remains legal. Field Search, Witness Work, and Contradiction Analysis discount one matching next-case reserve once; Evidence Handling schedules one safe Recovery assist through the existing cadence; Institutional Access exposes only a public institution-pressure band before Join.

The lifecycle is `ready → prepared → active → completed`, bounded to two Campaign intermissions. Repeated accepted requests, previews, autosolve, wrong theories, case-switch settlement, and replay do not create or consume a preparation. Extraction activates a prepared stage only after route integrity passes; accepted theory completes the active stage. Public projection retains only status, direction labels, bounded benefit text, progress, and next action. Internal cycle, case, target, tick, benefit-consumption, and Recovery-use fields remain private.

Headquarters is intentionally isolated from investigation authority. It never reveals a culprit, selects evidence, bypasses Challenge, edits truth, completes a Route Certificate, changes candidate membership/validity/order, changes evidence coverage or judgement, creates a second Recovery engine, or calls Agent intervention. The same Persistent Town resource ledger, progression marks, and Recovery cadence remain the only authority. Situation Brief and Guided Step Journal show compact aggregate state; Static Runtime shows only a Server-only boundary and continues to make zero `/api/*` requests.

Observe, Question, and Challenge dispatch through `InvestigationActionRegistry` and the existing Command Deck action function, so Search/Question/Challenge costs, testimony authority, Operations authority, Replay isolation, and judgement remain exactly where they were. The card has no persistence helper, endpoint, event, tick, candidate input, memory write, or NPC action call. Town Social Response can therefore change what a resident visibly appears to be doing without rewriting testimony, evidence, legal actions, candidates, truth, Route Certificate, or judgement.

# v7.5 Campaign Command Deck and Production Hardening

The v7.5 integration gate treats the existing world loops as one Campaign experience rather than adding another consequence layer. A production Server playthrough now runs Town Reckoning, Harbor Testimony, and Clinic Headlines independently, completing Opening, Escalation, and Finale chapters for a total of nine authored cases. Each case uses the existing Front Door selection, route-integrity extraction, Headquarters intermission, World Lead decision, Operations plan, explicit Recovery path, certified investigation handlers, and accepted-theory settlement.

The gate is deliberately automated and single-writer. A dedicated nine-case API playthrough uses a temporary database, never the default local database, and deletes its database/WAL/SHM files after the run. A 24-seed invariant sweep compares Headquarters and cross-case pressure variants with a baseline: candidate membership, candidate authority fields, truth, evidence coverage, Route Certificate, judgement, NPC legal action sets, and same-seed ordering must remain unchanged. The existing Persistent Town API smoke remains the detailed directive/offer/pressure/social-response lifecycle gate.

The Command Deck follows a Civilization-style information hierarchy without copying assets or layout: one Current Action, a compact campaign progress rail, map-first context, and foldable secondary world summaries. Browser gates cover the Front Door, Headquarters ready/prepared/active/completed, Encounter actions, keyboard/focus behavior, reduced motion, 44px controls, 390/768/1440 widths, screenshot evidence, and Static zero `/api/*`. Production budgets remain runtime JSON under 4 MB, sampled p95 tick under 250 ms, and no more than 130 API route files. Public projections continue to omit raw identifiers, hidden truth, raw bodies, internal resource/action keys, absolute paths, and tick fields.

This closes the v7.5 integration and hardening prerequisite. It does not change investigation authority, create a second case engine, or claim v6.2 Human Gate completion; that status remains **instrumentation ready** until the required真人 sessions exist.
# v8.0 Strategic Investigation Command Layer

The Strategic Command layer is the presentation and orchestration boundary above the existing simulation, not another simulation system. It reads only public-safe Campaign, Operations, Headquarters, World Lead, Arc, Directive, Pressure, Social Response, map-lens, context-action, and journal summaries. Its deterministic queue gives precedence to Campaign blockers, certified investigation, Recovery, player world choices, result acknowledgement, Headquarters/Operations, Advance Town, and next-case review.

Commands are dispatch tokens for existing handlers. The layer does not enter case generation, candidate validity, truth, evidence coverage, Route Certificate, judgement, NPC scoring/legal actions, memories, events, long actions, candidate cache, runtime JSON, SQLite, or localStorage. A 64-sample property gate keeps one primary action, at most three secondary actions, and verifies that representative authority projections remain unchanged. The production nine-case playthrough now verifies the Strategic Command certified-search adapter once for each authored case while the established v7.5 fairness sweep remains authoritative for cross-case invariants.

The information architecture follows patterns from Unciv/Freeciv resource-and-turn surfaces, OpenXcom decision handling, Endless Sky lifecycle states, Wesnoth objective/authority separation, and OpenTTD simulation/presentation isolation. Only structure and lifecycle ideas are reused; no upstream code, assets, copy, or brand styling are included.

# v8.1 Strategic Campaign Pacing & Progressive Disclosure

Strategic Pacing is a pure presentation projection over v8.0 Strategic Command. It reads only the public-safe command model, current objective, Investigation Turn, selected Context, presentation feedback, world-consequence timeline, campaign progress, and React-session safe outcome history. It emits the six visible phases, Why Now, one legal primary action, at most three legal secondary actions, Now/Soon/Later groups, essential/context/detail disclosure priorities, a safe forecast, a public focus target, the existing Advance state, and at most five deduplicated outcomes. It has no DOM, fetch, storage, runtime, case, event, candidate, memory, or simulation dependency.

Execution remains single-writer. The frontend lifecycle wraps the existing command adapter Promise and never constructs a replacement request body. `selected` and `resolving` are transient presentation states; `succeeded`, `blocked`, and `failed-safe` produce the same three safe feedback layers. A blocked or failed-safe result explicitly states that case authority did not change and points back to an already legal next action. Opening Context, Queue, Forecast, Inspector detail, or All Resources consumes no tick or resource.

The nine-case gate now derives Inspect, Execute, and Resolve for every authored case, verifies the certified Search dispatch token, and compares the complete Persistent Town projection before and after Pacing derivation while ignoring only the read-generated `updatedAt` timestamp. The established v7.5 24-seed sweep remains the authority proof for candidate membership/order, truth, evidence coverage, Route Certificate, judgement, and NPC legal actions. No endpoint, schema, proof card, public artifact, background process, or second state machine was added.

# v8.2 District Operations / Strategic Fronts

District Operations is a spatial projection of world state that already exists; it is not another consequence engine. The pure front model reads only public-safe Strategic Command actions, map-lens location signals, the current objective, and the six-beat world-consequence timeline. A fixed Investigation / Institution / Pressure order yields at most three fronts and exactly one current front. Signal strength uses the existing quiet/watch/high bands, ties resolve by stable public location label, and only enabled actions from the established Decision Queue may appear.

Front selection changes React presentation state only: reuse an existing map lens, focus an existing public location, and reveal safe Why Now, visible benefit, cost/boundary, and next-action copy. It performs no fetch, tick, event, resource reservation, runtime write, candidate refresh, localStorage write, or case mutation. Front execution resolves the same dispatch token through the v8.0 adapter; no District endpoint, payload, handler, event, or persistence structure exists. Static exposes the bounded read-only shell without actions or Server summaries.

The responsive layer protects the playfield by making Fronts mutually exclusive with Resources, Queue, and Context and by suspending transient Character Encounter/location hover cards while the front panel owns the map detail edge. The nine-case gate now compares each extracted case and Persistent Town public projection before and after front derivation and verifies certified Search dispatch equivalence in all nine authored cases. Existing v7.5 invariants remain authoritative for candidate membership/order, truth, evidence coverage, Route Certificate, judgement, and NPC legal actions. No proof card, endpoint, schema, public artifact, background process, ranking modifier, or second authority was added.

# v8.3 Guided Workflow Boundary Split

The Guided player path is now separated by authority role. `deriveGuidedManualTarget` is a pure projection over the current session, certified Route Certificate, public scenes, selected theory evidence, and optional followed World Lead. `useTheorySubmissionActions` owns the unchanged Static/server theory-submit adapters and projects only already-safe world summaries into existing controllers and Journal entries. `useGuidedManualActions` executes one projected target by calling the existing Join, Search, Question, Challenge, selection, and submit functions.

This split adds no simulation state and no request. The server endpoint, request payload, response application order, zero-tick world-choice behavior, judgement, Recovery, source-review unlock, and replay fallback rules are unchanged. Static retains the same local engine path and zero `/api/*` boundary. The pure transition suite verifies the complete seven-stage progression, stable World Lead prioritization, determinism, and non-mutation; controller and nine-case gates remain authoritative for truth, evidence coverage, Route Certificate, judgement, candidate state, and NPC legal actions.

# v8.4 Certified Investigation Workspace Boundary Split

The player-facing investigation workspace now observes a strict simulation/presentation boundary. One typed certified action adapter owns the existing Join, Search, Question/Challenge, evidence-selection, and Reveal mutations; Map, Command Deck, Guided, and direct controls no longer reconstruct those actions independently. Theory judgement remains in its existing submission hook, and certified autosolve remains a separate non-authoritative validation adapter.

All location, actor, notebook, proof-tour, intake, Guided-task, gap, and graph navigation is isolated in a request-free browser hook. The seven-step path is a pure deterministic projection, while Core Actions, Route & Review, and Debrief & Replay are direct-import presentation surfaces. No renderer component owns simulation state, endpoint construction, candidate validity, truth, evidence membership, Route Certificate, judgement, NPC legality, world consequences, event generation, or tick advancement.

The adapter contract verifies request ownership, Static engine delegation, response-setter order, shared entry binding, navigation isolation, deterministic path output, and input non-mutation. Existing 24-seed fairness and nine-case Campaign gates remain the authority proof. No endpoint, schema, runtime field, ranking modifier, public artifact, storage key, background process, or proof card was added.

# v8.5 Town Bootstrap & Campaign Launch Boundary Split

v8.5 moves client orchestration boundaries without changing the simulation. World Session owns the existing persistence key, Static/Server bootstrap, world create/load/tick, hydration, and runtime/template switches. Read Queries owns only map, deduction-graph, and optional live-eval reads; its Static branch is local and the bootstrap resolves the requested runtime before invoking any Server read. Campaign Launch retains the existing WorldPackage selection, runtime-start, bounded candidate retry, route-integrity extraction, and post-success persistence sequence.

The remaining Headquarters decision stays in the established zero-tick world-choice adapter, while Persistent Town refresh and browser-only timers are lifecycle concerns. These modules cannot create a second authority: they do not alter case truth, evidence membership, Route Certificate, judgement, candidate validity/order, NPC legal actions, events, ticks, or world consequences. The root page is now 1,464 physical lines and the boundary suite checks ownership, Static-first initialization, idempotence, launch order, zero-tick semantics, request-free lifecycle code, and source budgets. Static continues to make zero `/api/*` requests.

# v8.6 Campaign Pacing & Content Value Loop

Campaign Pacing is a pure public projection over the existing Campaign catalog, nine authored case treatments, Campaign Session summary, Current Objective, and already-safe world-consequence summaries. Each chapter yields a public hook, current town surface, existing Search/Question/Challenge emphasis, visible consequence, Why Now, next-case context, and replay contrast. The model has no Persistent Town runtime state, candidate input, evidence/truth input, DOM, fetch, storage, endpoint, or action executor.

The projection does not create a second decision queue. Strategic Command keeps the same single legal primary action and at most three existing secondary actions; Campaign Pacing only supplies content-specific Why Now and safe-forecast wording. World Campaign reveals the current objective first and keeps What Changes / What Stays Fair collapsed. Situation Brief shows one compact context, while Guided Journal, Debrief, and Replay show aggregate pacing status without raw keys or source bodies. Static renders only a Server-only boundary and does not project persistent chapter state into those aggregate surfaces.

The nine-row content gate requires three distinct public hooks, three distinct primary world surfaces, and three distinct consequence labels within each Campaign. Same input is deterministic, missing summaries have a safe fallback, output is identifier-safe, and derivation does not mutate its catalog or detached authority. Existing v7.5 24-seed and nine-case gates remain authoritative for candidate membership/order, truth, evidence coverage, Route Certificate, judgement, and NPC legal actions. v8.6 adds no ranking modifier, endpoint, schema, runtime record, event, tick, public artifact, background process, or proof card; v6.2 remains **instrumentation ready**, not Human Gate passed.

# v8.7 Focused Resolution & Campaign Transition Theatre

Theatre state is a browser-only presentation projection, not part of Persistent Town. The pure model reads existing public Strategic Command, Campaign Pacing, outcome-feedback, and action-lifecycle summaries and derives six beat kinds across the fixed Resolve, Result, Consequence, and Next rail. The hook observes the current handler lifecycle and safe feedback signature; it cannot execute an action, create an event, advance a tick, alter a candidate, or persist a phase.

One deterministic arbiter owns overlay precedence: blocking setup -> resolving action -> transition -> Character Encounter -> Context -> Strategic Fronts -> secondary panel -> notification/toast. Higher layers suspend pointer competition from lower layers while leaving safe map selection available during resolving. Inspector ownership hides the Encounter presentation but preserves the actor selection, and dismissing a resolving beat suppresses only that presentation completion rather than cancelling or repeating the authoritative action.

Public-safety sanitization removes identifier-like tokens, private field names, and absolute paths before rendering. Static does not activate the arbiter's transition branch and exposes only a Server-only explanation. Paired model/browser gates cover determinism, six beats, phase advancement, overlay exclusion, 44px controls, keyboard focus, reduced motion, request/storage isolation, 390/768/1440 layout, and unchanged detached truth, evidence coverage, Route Certificate, judgement, candidate state, and NPC legal actions. No endpoint, runtime field, schema, event, tick, ranking modifier, artifact, or proof card is added; v6.2 remains **instrumentation ready**.

# v8.8 Objective-First Command Deck

World action priority now carries a presentation-only surface discriminator. It selects which already-safe World Campaign subsystem is focused, while every other available public projection and its existing typed handler remains in one default-closed archive. The discriminator is not serialized, does not enter Persistent Town, and cannot enable an action that the established adapters disabled.

Strategic Pacing is the sole canonical Current Objective. At compact width it precedes the protected map, with the existing Current Action remaining the execution surface. Public Change and Latest Safe Outcome are progressive-disclosure context inside Safe Forecast rather than peer cards. Town Pulse, world-campaign presentation, manual replay actions, authoring launch construction, and graph navigation have independent source budgets.

The Objective-first gate covers deterministic focus priority, one Current Action marker, one focused subsystem, default-closed archive, request/storage isolation, mobile ordering, authority isolation, Static zero API, and 390/768/1440 layout. Existing truth, evidence coverage, Route Certificate, judgement, candidate membership/order, NPC legal actions, world consequences, endpoints, payloads, runtime fields, schemas, and protected public artifacts remain unchanged. v6.2 remains **instrumentation ready**.

# v8.9 Certified Case Rhythm

Certified Case Rhythm is a pure presentation projection over the existing playable intake, session judgement, public progress counts, and first safe recovery gap. It groups the unchanged seven-step route into Intake, Fieldwork, Deduction, and Review while retaining Observe as the legal browser preparation before Search. It does not validate truth, choose evidence, judge a theory, or alter a Route Certificate.

The Current Action either delegates to the matching certified adapter or focuses the next route target through the request-free navigation boundary. Search, Question, Challenge, and source review can execute through their existing handlers; evidence selection, theory submission, and rejected-theory repair remain Manual First and require the existing workspace controls. Full route detail is default-closed so the map remains the playfield rather than becoming a dashboard.

The dedicated gate verifies determinism, one current beat, safe recovery, input non-mutation, raw-reference sanitization, request/storage isolation, adapter reuse, and bounded source files. Browser QA verifies four beats, one Current Action, one-click samples, at most one panel switch, local settle under 3 seconds, dialogue settle under 12 seconds, 390/768/1440 layout, Theatre arbitration, and Static zero API. These timings are automated latency evidence, not Human Gate data. No endpoint, runtime field, schema, event, tick, candidate modifier, public artifact, or proof card is added.

# v9.0 Authored Campaign Route Variants

The Campaign catalog now keeps three public Campaign families while giving each an original and counter route. The route is explicit rather than seed-hidden: it is chosen before the first successful extraction, stored once in the existing Campaign session JSON, and rejected with a stable conflict response if a later request attempts to switch it. Legacy sessions without a route normalize to the original route.

Route content changes only future, unextracted Campaign material: chapter labels and objectives, bounded case-family preference, authored treatment, World Lead verb order, occupational pressure, causal bridge, aftermath, and Finale family. It does not create candidates or legalize actions. Route integrity still freezes the extracted case, and the existing truth, evidence membership, Route Certificate, judgement, and NPC legal-action invariants remain authoritative.

The catalog therefore grows from 9 to 18 authored treatments while each run remains three cases. Six production Server runs complete all 18 treatments through Join, World Lead, Search/Question/Challenge, rejected-theory Recovery, accepted theory, Headquarters, Arc convergence, and debrief. The original three-run/9-case gate remains as a compatibility check. Static shows both route names and the original route's read-only detail, never writes route state, and remains zero API.

# v9.1 Architecture Headroom Recovery

v9.1 changes code ownership without changing the simulation. Two request-free hooks now isolate the Map/Inspector/Workspace presentation graph and the certified Route Certificate/proof/Source Review graph from the root page. They consume existing controller state and pure engine projections only; neither can issue a request, advance a tick, write runtime state, or judge a case.

The Command Deck separates core and responsive style ownership, and the Campaign Front Door separates route/preview styles from its shell. Explicit post-core responsive loading preserves compact-map hit testing and Theatre arbitration. Existing action adapters, endpoint payloads, response application order, visible copy, DOM order, Static behavior, and case authority remain unchanged.

Measured boundaries are `app/page.tsx` 976 / 1,100 lines; workspace presentation 280 / 400; certified audit 180 / 250; Command Deck component/core/responsive 456 / 500, 442 / 560, and 278 / 320; and Front Door core/routes 340 / 360 and 117 / 160. Runtime JSON is 2,815,674 / 4,000,000 bytes, the filesystem API count is 125 / 130, and sampled tick p95 is 12.45 / 250 ms. No endpoint, runtime field, schema, event, tick, ranking layer, public artifact, world rule, or proof card is added. v6.2 remains **instrumentation ready**, not Human Gate passed.

# v9.2 Campaign Command Clarity & Progressive Disclosure

v9.2 adds no simulation layer. `buildCampaignCommandBrief` is a pure projection over the existing safe Strategic Command view model. Its fixed hierarchy is `objective`, `action`, `map`, and `context`; it selects one enabled Current Action, one public map focus, one low-spoiler Why Now, and a bounded world-signal aggregate. The projection strips identifier-like tokens, private field names, absolute paths, and raw bodies before any surface renders it.

Command Deck, Map Intel, World Campaign, and Campaign Transition Theatre now reuse that same brief. Context, resource, queue, Journal, Replay, and source-review surfaces remain secondary and default-closed where the existing layout allows. District Strategic Fronts remain a selection-only projection of existing actions and map lenses; their mobile panel is tested using rectangle-area overlap so the 390px map remains separate from Current Action.

The authority boundary is unchanged: no endpoint, payload, runtime field, SQLite/content/public schema, event, tick, ranking modifier, public artifact, or proof card is added. Presentation and navigation modules contain no request or mutation helpers. Server continues to show safe executable state; Static resolves locally, exposes only a Server-only boundary, and makes zero `/api/*` requests. Existing truth, evidence coverage, Route Certificate, judgement, candidate membership/order, NPC legal actions, and world consequences remain the authoritative invariants. v6.2 remains **instrumentation ready**, not Human Gate passed.

# v9.3 Command Resolution & Consequence Ledger

v9.3 does not deepen the simulation; it makes the existing simulation causally legible. `buildCampaignResolutionLedger` merges the already-safe Strategic outcome projection with the session-local Guided Journal and produces one bounded four-stage explanation: Result, World Change, Objective Progress, and Next Action. It stores nothing. The existing five-item Strategic outcome memory remains the fallback source, the Journal remains the historical source, semantic signatures remove duplicates, and at most six completed entries are presented.

World Change is deliberately conservative. Ordinary certified investigation steps state `No persistent world change`; player-driven World Lead, Directive, Offer, Recovery, accepted-theory aftermath, and successful case-transition records can surface their already-public bounded change. Static always uses the no-persistence fallback. The model strips raw identifier patterns, private field names, paths, player-text markers, and raw-body markers before rendering.

Command Deck Latest Resolution, Campaign Transition Theatre, and Guided Journal consume the same object and shared chain component. The Theatre alone owns `aria-live`, while the other copies remain reviewable without duplicate announcements. This borrows Civilization-style post-command result layering, Unciv/Freeciv bounded notification history, Wesnoth objective/authority separation, Endless Sky mission-log lifecycle, and OpenRA blocked-command feedback without importing a second action engine or notification queue.

Measured boundaries are `app/page.tsx` 981 / 1,100 lines; Ledger model/hook/surface/CSS 244 / 350, 22 / 100, 108 / 180, and 186 / 260; Command Deck shell 493 / 500; runtime JSON 2,815,674 / 4,000,000 bytes; API routes fixed at 125; and sampled tick p95 9.55 / 250 ms. Truth, evidence coverage, Route Certificate, judgement, candidate membership/order, NPC legal actions, endpoint/payload order, tick/event behavior, and world consequence authority remain unchanged. v6.2 remains **instrumentation ready**, not Human Gate passed.

# v9.4 Final Detective Workspace

v9.4 changes the player-facing investigation composition without adding simulation depth. A pure request-free projection combines the existing playable intake, Certified Case Rhythm, public evidence notebook, public testimony records, contradiction labels, theory readiness, Recovery summary, Source Review audit, Campaign Command Brief, and Resolution Ledger into one bounded workspace. It derives display state only and cannot discover evidence, create testimony, validate a theory, settle Recovery, or reveal a conclusion.

The mutation boundary remains singular. Map context, Command Deck, Guided Manual Run, and the workspace call the same `CertifiedInvestigationActionAdapter`; theory submission remains owned separately by the existing theory action hook. Search, Question, Challenge, evidence selection, Submit, Recovery, and Reveal preserve their established payloads and response application order. The secondary Playable Investigation Path is now a read-only route audit, so it cannot compete with the one Current Task or one primary action.

The projection exposes discovered evidence provenance, public testimony summaries, known contradiction labels, aggregate theory gaps, and source-backed audit rows. It strips identifier-shaped tokens, private field names, raw bodies, player-text markers, and absolute paths. Character and evidence selectors render array indexes rather than internal keys; source review remains locked until the authoritative judgement accepts the theory. No new MemoryRecord, observation, evidence, WorldEvent, tick, case candidate, NPC action, or world consequence can originate from this workspace.

Measured boundaries are `app/page.tsx` 975 / 1,100 lines; workspace model/hook/surface/CSS 473 / 500, 23 / 100, 265 / 500, and 209 / 300; runtime JSON 2,815,674 / 4,000,000 bytes; API routes fixed at 125; and sampled tick p95 17.38 / 250 ms. The 24-seed authority invariants and six-route 18-case Campaign gate remain unchanged. This is investigation clarity and composition work, not a new world loop or proof card, and v6.2 remains **instrumentation ready**, not Human Gate passed.
