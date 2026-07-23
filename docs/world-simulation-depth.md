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
