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
- Confirm Server Runtime shows one **Unified influence budget** for Handoff, World Arc, and World Pressure with a fixed `±3` total cap; Static shows only the read-only Server-only boundary, no persistent values or controls, and zero `/api/*`.
- Confirm Static shows only the **Server-only world event offer lifecycle** with no offer buttons or persistent deadline state. Server QA should cover offered → accepted → running/completed or resource-gated failed, with no raw source, action, institution, actor, resource, or tick keys.
- Confirm Server Runtime shows **Case Resource** ready after Join, reserves exactly one available choice at zero tick with zero events, changes to used after its matching certified Search / Question / Challenge, and returns an unused reserve once after accepted theory or successful case switch. Public text must contain no raw session, case, location, or resource keys.
- Confirm Static Runtime shows only the read-only **player resource commitment** boundary with no Reserve buttons, no persistent state, zero `/api/*`, and no page-level overflow at 390px.
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
