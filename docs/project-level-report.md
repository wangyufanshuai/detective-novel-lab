# Project-Level Report: Detective Novel Lab vs GOD vs Cultivation Simulator

This report captures the v4.2 public-release baseline and the next planning track for Detective Novel Lab. It compares the project against two local reference projects used only as structural inspiration:

- `GOD-main`: public catalog, replay reader, map pack, agent pack, and operator-console organization.
- `AICultivationSimulator_WebMode`: large table-driven simulation content and packaged web runtime shape.

No code, assets, CSV data, music, scenario text, runtime data, or secrets are copied from either reference project.

## Executive Assessment

Detective Novel Lab is no longer just a web demo. It is a local-first detective narrative simulation platform with public dataset review, release artifact validation, and replay audit discipline.

| Area | Score | Rationale |
| --- | ---: | --- |
| Engineering completeness | 7.5 / 10 | The project has a substantial local engine, server runtime, static runtime, dataset package flow, public snapshots, and aggregate QA gate. |
| Simulation and research novelty | 8.5 / 10 | The strongest differentiator is source-backed detective emergence with spoiler-safe public review and local rule validation. |
| Product clarity | 6.5 / 10 | The project has several strong concepts, but the public-facing story needs one clearer main path. |
| Release maturity | 7 / 10 | v3.6 added deterministic public snapshots and release-local validation, but release handoff is still local and manual. |

The most important current risk is scope diffusion. Detective Town, Persistent Agent Town, Living World Lab, Review Mode, Dataset Package, World Package, ReplayBundle, and RunCatalog are all useful, but they compete for first-screen attention. The public story should become: **a verifiable 5000 tick detective-town dataset, reviewed through static public snapshots with no server data fetches**.

## Current Baseline

The v4.2 baseline has these strongest assets:

- 5000 tick campaign gate passed with 30 cases, 15 case types, zero repeat rate, full later-case influence, zero evidence warnings, and runtime under the release budget.
- Public static review uses tracked snapshots under `public/dataset-reader/` and `public/review-catalog/`.
- The static browser path is constrained to `/review-catalog/*` and `/dataset-reader/*`.
- Public case navigation is now backed by a spoiler-safe `case-summary-index.json` rather than raw case bodies.
- Public snapshots are deterministic: repeated generation with unchanged inputs must preserve file hashes.
- Replay audit remains the safety backstop for errors, secret leaks, and hidden-answer leaks.

Approximate project scale at the v3.6 review point:

| Area | Size |
| --- | ---: |
| Repository files | about 370 |
| API route/support files under `app/api/v1` | about 114 |
| Local scripts | about 46 |
| Documentation files | about 28 before this report |
| Public release snapshot files | 6 |

The public snapshot boundary is intentionally narrow:

- `public/dataset-reader/<datasetId>/reader-index.json`
- `public/dataset-reader/<datasetId>/case-summary-index.json`
- `public/dataset-reader/<datasetId>/manifest-lite.json`
- `public/dataset-reader/<datasetId>/dataset-card.md`
- `public/review-catalog/index.json`
- `public/review-catalog/catalog-card.md`

These files are tracked public release snapshots. They are not the runtime authority and do not contain full replay bodies, package source bodies, local database files, runtime snapshots, or private operational material.

## Reference Comparison

| Dimension | Detective Novel Lab | GOD | Cultivation Simulator |
| --- | --- | --- | --- |
| Core position | Detective narrative simulation, evidence chain review, dataset/replay audit | Agent-town operator console for observation, questions, intervention, and replay | Cultivation-world simulation game with world, sect, role, item, and event systems |
| Strongest capability | Verifiable release artifacts, 5000 tick gate, public safety validation | Clear public catalog across Experiment, Replay, Map Pack, and Agent Pack | Broad table-driven content model across many world systems |
| Static public organization | `public/dataset-reader/` and `public/review-catalog/` | `docs/site/data/catalog.js` and `docs/site/public-data/*` | `web_static/` plus `static/game_configs/*.csv` |
| Runtime boundary | Strong: public snapshots are review-only, not authority | Good: experiment, replay, and runtime state are separated in docs and package flow | More product-package oriented; boundaries are less central to the public story |
| Content extension | Currently package, fixture, and code driven | Pack driven: map, agent, experiment, replay | CSV/table driven: roles, regions, techniques, sects, events, materials, and world info |
| Audit posture | Strong release and public-boundary scans | Has a public-site validator, but safety is not the main product claim | No equivalent public artifact audit pattern observed in the packaged reference |
| Product clarity | Medium: strong internals but dense naming | Strong: one-screen control of an agent town | Strong: game genre and content tables make the value easy to understand |

What to borrow from GOD:

- A public catalog as the first navigational object.
- Clear separation between playable setup, replay output, map/agent packs, and local runtime data.
- A reviewer/operator surface that makes the main workflow visible without exposing internals first.

What to borrow from the cultivation simulator:

- Table-driven content growth.
- Explicit content categories for world, roles, locations, event types, resources, and progression.
- Validation as a content authoring habit, not only as runtime testing.

What not to borrow:

- Real-time intervention as the next main feature; it would dilute the public dataset review story.
- Reference assets, text, music, packaged tables, or scenario content.
- Remote services, new background workers, or a larger long-run gate before the public story is clearer.

## Strategic Direction

The next stage should keep the project's release-audit advantage while making the public experience easier to understand.

### v3.7: Project-Level Report and Release Commit Hygiene

Goal: turn v3.6 into a reviewable release candidate.

- Keep this report as the project-level handoff.
- Treat `public/dataset-reader/` and `public/review-catalog/` as tracked public snapshots.
- Keep local runtime data, generated package exports, databases, build output, and handoff notes out of commits unless explicitly requested.
- Use `qa:release-local` as the v3.6 public-release local gate.
- Do not add runtime features, API routes, schema changes, or a larger campaign gate.

Acceptance:

- `npm.cmd run qa:release-local -- --json`
- `npm.cmd run replay:audit -- --json`
- Public safety scan over the public snapshots and this report.

### v3.8: Table-Driven Detective Content Ecosystem

Goal: adopt the table-driven scale pattern without copying the cultivation reference.

- Introduce a minimum detective content table set for case types, locations, roles, motives, evidence types, misleading clue patterns, and escalation rules under `content/detective-v1/`.
- Start with read/validate/report behavior only; do not immediately replace engine internals.
- Make content summaries visible to Public Catalog as aggregate metadata only.
- Add `npm run content:validate` to check ids, references, distribution balance, and public-safety boundaries.

Acceptance:

- Existing 5000 tick public reader remains valid.
- A small preview summary can be generated from the detective content tables.
- Public snapshots continue to exclude private run bodies and spoiler-bearing fields.

### v3.9: Reviewer Experience Upgrade

Goal: make static review the main product experience.

- Present the static path as a Public Review Snapshot with Public Catalog, 5000 gate, case/evidence distributions, content table coverage, and audit status in the first reviewer flow.
- Add an aggregate-only Distribution Explorer for case type distribution, evidence type distribution, world package summaries, and gate/audit status.
- Reduce internal labels in Review Mode copy and emphasize that public snapshots are review artifacts, not runtime authority.
- Keep Server Runtime as the internal workbench, separate from public catalog authority.

Acceptance:

- `?runtime=static` still makes no server API requests.
- 390px viewport has no page-level horizontal overflow.
- Static browser QA checks Public Review Snapshot, Public Catalog, Dataset Reader, Distribution Explorer, Content Tables, and Static-only boundary copy.
- `?runtime=server` still shows Dataset Package, Replay Dataset, World Packages, RunCatalog, and ReplayBundle.

### v4.0: Public Demo Vertical Slice

Goal: make the public value understandable to a new reviewer.

- Lead with one story: the 5000 tick detective-town dataset is generated, audited, and reviewed through tracked static snapshots.
- Keep the public path simple: Catalog -> Dataset -> Case Summary -> Evidence Distribution -> Audit Status -> Static Boundary.
- Keep internal engine/API/database details as developer context, not the first public story.
- Use the existing release-local gate before public linking; do not add a larger campaign gate as a release blocker.

Acceptance:

- `?runtime=static` shows Public Demo Vertical Slice, Catalog, Dataset, Case Summary, Evidence Distribution, Audit Status, Static Boundary, Content Tables, and Distribution Explorer.
- Public snapshots can be regenerated locally without content drift.
- Static browser QA confirms zero `/api/*`, allowed fetches only under `/review-catalog/*` and `/dataset-reader/*`, and no 390px page-level horizontal overflow.
- Final replay audit remains clean for errors, secret leaks, and hidden-answer leaks.

### v4.1: Aggregate Public Dataset Explorer

Goal: make public aggregate review interactive without publishing raw case data.

- Keep the v4.0 public path as the first story, then let reviewers explore aggregate slices.
- Add a Public Dataset Explorer for Case Types, Evidence Types, World Packages, and Gate & Audit.
- Support local search, sort, and selected-bucket summaries using only `reader-index.json`, `manifest-lite.json`, and `review-catalog/index.json`.
- Keep the future case-level explorer as a separate v4.2 design that would need a spoiler-safe public case summary artifact.

Acceptance:

- `?runtime=static` shows Public Dataset Explorer, Search distributions, Sort buckets, Case Types, Evidence Types, World Packages, and Gate & Audit.
- Static browser QA exercises search/sort/tab interactions and still confirms zero `/api/*`.
- No raw case bodies, culprit fields, hidden-answer fields, point-in-time state dumps, agent state snapshots, replay bodies, or package source bodies are added to public artifacts.
- `?runtime=server` remains the internal Dataset Package / Replay Dataset / World Packages / RunCatalog / ReplayBundle workbench.

### v4.2: Spoiler-Safe Public Case Summary Index

Goal: let reviewers move from aggregate distributions into public case cards without publishing private case material.

- Add `case-summary-index.json` to each tracked static reader bundle.
- Derive public case cards from the validated dataset package case/evidence graphs during static reader export.
- Expose a Public Case Explorer inside the static Public Dataset Explorer with search, sort, case type filter, location filter, and warning status filter.
- Keep case cards limited to public case id, source case hash, ordinal, tick, case type, outcome, location id, institution count, evidence count, warning count, completion flag, influence edge counts, and edge type counts.
- Keep raw case bodies, person ids, evidence ids, event chains, source edge details, replay bodies, and package bodies out of public artifacts.

Acceptance:

- `public/dataset-reader/<datasetId>/` contains exactly `reader-index.json`, `case-summary-index.json`, `dataset-card.md`, and `manifest-lite.json`.
- `public/review-catalog/index.json` records case summary path, hash, and count using only public reader files.
- Static browser QA exercises Public Case Explorer and still confirms zero `/api/*`.
- Public artifact scans block secret-looking values, absolute local paths, private runtime fields, and raw case graph identifiers.

### v4.3: Content-Guided Case Authoring

Goal: turn the table-driven content ecosystem into browser-local authoring guidance without making content tables editable at runtime.

- Add a `Content` tab to the existing Case Authoring Workbench.
- Read `content/detective-v1/` as built-in, source-controlled, read-only template input.
- Let authors choose compatible case type, location, roles, motive, evidence types, and red-herring pattern.
- Preview and apply only safe public text changes to the current `AuthoringDraft`.
- Keep ids, suspect matrix, clue order, critical reasoning chain, proof structure, world events, SQLite, and public artifacts unchanged.
- Reuse `validateAuthoringDraft` after apply so broken drafts are visible immediately.

Acceptance:

- Static browser QA opens Authoring, enters the Content tab, previews a seed, applies it, and confirms title/theme/evidence text change while Run Draft is either available or clearly blocked.
- `?runtime=static` still makes zero `/api/*` requests after entering Authoring.
- `content:validate`, `test:world`, `tsc`, `build`, `qa:release-local`, and `replay:audit` remain clean.
- Public catalog continues to expose aggregate `contentSummary` only, not full content rows.

### v4.4: Authoring QA and Gallery Hardening

Implemented scope: harden browser-local content authoring before adding larger public or file-level features.

- Group Content Seed preview patches into Case, Characters, Evidence, and Logic.
- Save the full pre-apply draft to Local Case Gallery before every non-empty content seed application.
- Restore the snapshot through the existing `Load into Authoring` flow without adding a storage schema.
- Validate import/export round trips for gallery bundles containing both pre-apply and content-guided drafts.
- Extend static browser QA through apply, Gallery discovery, and title restoration.
- Keep the scope browser-local; defer file-level content-table editing and spoiler-safe public case body design to later versions.

Acceptance:

- Content seed application preserves ids, suspect matrix, clue order, timeline, and proof structure.
- Empty patch lists create no redundant backup.
- Static browser QA confirms backup/revert and still records zero `/api/*`.
- Public release artifact hashes remain stable because v4.4 changes no public artifact schema or generator.

### v4.5: Content Seed Undo and Session Audit Trail

Implemented scope: make browser-local content seeding reversible inside the Authoring Content tab without creating a new storage schema.

- Add a session-only Content Seed undo queue in the existing Authoring Workbench.
- Record the latest seed's before title, after title, case type label, patch count, validation result, and matching Gallery backup title.
- Restore the latest pre-apply draft through `Undo Content Seed` without leaving the Content tab.
- Keep the v4.4 Local Case Gallery backup as the durable browser-local revert path.
- Clear the session undo queue when a template, import, or Gallery entry replaces the active draft.
- Keep public artifacts unchanged: no new reader/catalog files, no raw case bodies, no public content rows, and no schema expansion.

Acceptance:

- Static browser QA applies a content seed, confirms `Content Seed Undo` is visible, restores the original title through session undo, then verifies the Gallery backup still restores the same title.
- `?runtime=static` remains zero `/api/*`.
- `content:validate`, `test:world`, `tsc`, `build`, `qa:release-local`, and `replay:audit` remain clean.
- Public release artifact hashes remain stable because v4.5 changes no public artifact generator.

### v4.6: Authoring Safe Diff Review

Implemented scope: make browser-local content seeding auditable before and after apply without exposing spoiler-bearing fields.

- Add `Safe Diff Review` inside the existing Authoring Content tab.
- Show pending safe diff from the selected content seed before apply.
- Show applied safe diff by comparing the session before snapshot with the current draft after apply.
- Group safe diffs as Case, Characters, Evidence, and Logic.
- Keep the allowlist public-only: case public text, character surface text, evidence visible text, and red-herring labels.
- Exclude ids, hidden truth fields, true evidence meanings, timeline truth, suspect matrix, clue order, critical reasoning chain, source event ids, replay bodies, and package bodies.
- Keep v4.5 Undo Content Seed and Gallery backup as the restore paths.
- Keep public artifacts unchanged: no new reader/catalog files, no raw case bodies, no public content rows, and no schema expansion.

Acceptance:

- Static browser QA confirms `Safe Diff Review`, `Pending safe diff`, `Applied safe diff`, and `Content Seed Undo`.
- Undo restores the original title and clears the applied diff.
- Gallery backup still restores the same pre-apply draft.
- `?runtime=static` remains zero `/api/*`.
- `content:validate`, `test:world`, `tsc`, `build`, `qa:release-local`, and `replay:audit` remain clean.
- Public release artifact hashes remain stable because v4.6 changes no public artifact generator.

### v4.7: Authoring Workflow Coach

Implemented scope: make the browser-local Authoring workflow explain the current stage and next safe action without introducing new runtime authority.

- Add `Authoring Workflow Coach` to the Authoring inspector.
- Show Draft, Content Seed, Safe Diff, Validation, Run Draft, and Gallery Backup stages.
- Derive ready/active/blocked/done statuses from existing browser state: validation report, content seed patches, safe diff state, session seed history, Run Draft availability, and Gallery backup availability.
- Add `Next Action` that only focuses existing UI or opens the existing preview state; it never mutates draft content.
- Keep the coach public-safe: it shows summary counts and status text, not hidden truth, culprit identity, true evidence meaning, timeline truth, suspect matrix details, source event ids, replay bodies, or package bodies.
- Keep public artifacts unchanged: no new reader/catalog files, no raw case bodies, no public content rows, and no schema expansion.

Acceptance:

- Static browser QA confirms `Authoring Workflow Coach`, `Next Action`, and all six workflow stages.
- Preview routes the coach to Safe Diff review.
- Apply routes the coach to applied diff, Gallery backup, and Undo guidance.
- Undo restores the original title, clears applied diff, and returns the coach to pending or clean guidance.
- `?runtime=static` remains zero `/api/*`.
- `content:validate`, `test:world`, `tsc`, `build`, `qa:release-local`, and `replay:audit` remain clean.
- Public release artifact hashes remain stable because v4.7 changes no public artifact generator.

### v4.8: Core Simulation Rule Behavior Pass

Implemented scope: improve Persistent Agent Town's core detective simulation behavior without expanding the public release surface.

- Actor selection now considers recent actor participation and unresolved chain pressure, so high-priority agents do not monopolize every tick when another actor carries the next useful stage.
- Action selection still requires legal actions and keeps raw score as authority, but close candidates use deterministic chain-stage need, institution/evidence pressure, and recent action mix as tie-breaks.
- Case candidate queues now favor triggered, evidence-backed, memory-scoped, exclusion-aware chains before weaker forming candidates.
- Institution strategies surface court, dock, medical, and informant pressure earlier in the lifecycle, making their influence visible in 1000 tick campaigns without direct case injection.
- Long-run selection gives more weight to route completeness, evidence depth, provenance, and cross-case influence while preserving repeat penalties and fair-play validation.
- No public artifact schema, HTTP API, SQLite schema, Authoring UI, or Sci-Fi world feature is added.

Acceptance:

- `test:persistent-town` confirms deterministic action diversity, candidate maturity ordering, and institution strategy triggers.
- `test:world`, `tsc`, `build`, and `benchmark:campaign -- --ticks=1000` remain clean.
- Public release artifacts remain unchanged unless a separate release refresh intentionally regenerates them.
- 5000/10000 tick gates are out of scope for v4.8.

### v4.9: Static Reviewer Home Simplification

Implemented scope: simplify the static public review experience into a reviewer-first workflow without changing simulation rules or public artifact schemas.

- Add a `Reviewer Home` section above the existing Public Review Snapshot content.
- Make the first screen answer what the dataset is, why it is trustworthy, and where a reviewer should go next.
- Promote the headline public facts: 5000 tick detective dataset, 30 cases, 15 case types, 318 evidence nodes, audit clean status, zero `/api/*`, and reader hash.
- Replace equal-weight engineering summary cards with a clearer Trust Snapshot, Review Path, and Primary Evidence structure.
- Keep the static review path explicit: Trust Snapshot -> Dataset Reader -> Public Case Explorer -> Evidence Distribution -> Audit Boundary.
- Default the static Dataset Reader toward the spoiler-safe Public Case Explorer and add a reviewer next-step cue before the aggregate explorer.
- Keep Content Tables aggregate-only and keep server runtime panels separate from public catalog authority.
- No public artifact schema, HTTP API, SQLite schema, framework, background queue, simulation rule, 5000 tick refresh, or 10000 tick gate is added.

Acceptance:

- Static browser QA confirms `Reviewer Home`, `Trust Snapshot`, `Review Path`, `Dataset Reader`, `Public Dataset Explorer`, `Public Case Explorer`, `Evidence Distribution`, and `Audit Boundary`.
- `?runtime=static` remains zero `/api/*` and keeps the 390px mobile no-overflow requirement.
- `?runtime=server` still shows Dataset Package, Replay Dataset, World Packages, RunCatalog, and ReplayBundle.
- Public release artifact hashes remain stable because v4.9 changes only UI, QA assertions, and documentation.

### v5.0: Stable Detective World Gate

Implemented scope: turn the 1000 tick campaign into a stable detective world gate without changing public artifacts or external runtime boundaries.

- Add internal `worldStability` metrics to campaign/long-run reports: action mix, actor spread, valid candidate trend, institution decisions, evidence complete cases, repeat rate, and deterministic hash.
- Strengthen deterministic actor/action tie-breaks so chain-stage needs and institution pressure can diversify actions while legal action scoring remains the hard constraint.
- Strengthen candidate selection toward triggered, evidence-backed, memory-scoped, non-culprit-excluding, strong-provenance chains.
- Increase repeat/cooldown pressure for case types and locations in multi-case campaigns.
- Keep the v5.0 validation budget at 1000 ticks; no 5000/10000 tick rerun is required.
- No public artifact schema, HTTP API, SQLite schema, UI redesign, framework, background queue, or Sci-Fi world feature is added.

Acceptance:

- `benchmark:campaign -- --ticks=1000 --json` passes with at least 8 unique cases, at least 4 case types, repeat <= 20%, later influence >= 60%, evidence warnings 0, selected action kinds >= 6, largest action share <= 55%, institution decisions >= 4, and runtime <= 90000 ms.
- Same-seed 1000 tick runs produce the same deterministic run hash.
- `test:persistent-town`, `test:world`, `tsc`, `build`, `qa:release-local`, and `replay:audit` remain clean.
- Public release artifact hashes remain stable because v5.0 changes no public dataset/catalog generator output.

### v5.1: Multi-Seed Stable Detective World Gate

Implemented scope: prove the stable detective world behavior across three fixed 1000 tick seeds instead of relying on one campaign seed.

- Add `benchmark:stable-world` as the local multi-seed quality gate.
- Run `campaign-validation`, `stable-town-a`, and `stable-town-b` at 1000 ticks each.
- Reuse the v5.0 per-seed gate for cases, case types, repeat rate, later influence, evidence warnings, action mix, institution decisions, runtime, and deterministic hash.
- Extend simulation-quality reports with `summary.stability`: per-seed gate summaries plus worst/lowest aggregate stability metrics.
- Write only local replay-store artifacts; do not regenerate public dataset reader or review catalog snapshots.
- No public artifact schema, HTTP API, SQLite schema, UI redesign, framework, background queue, 5000/10000 tick gate, or Sci-Fi world feature is added.

Acceptance:

- `benchmark:stable-world -- --json` passes all three fixed seeds.
- Aggregate stability summary reports passed/failed seed counts, worst repeat rate, lowest case type count, lowest selected action kind count, highest largest action share, lowest institution decision count, and deterministic hashes.
- `benchmark:campaign -- --ticks=1000 --json` remains compatible and deterministic for `campaign-validation`.
- `test:persistent-town`, `test:world`, `tsc`, `build`, `qa:release-local`, and `replay:audit` remain clean.
- Public release artifact hashes remain stable because v5.1 changes no public dataset/catalog generator output.

### v5.2: Stable World Diagnostics Report

Implemented scope: make the v5.1 stable-world gate explainable without tuning simulation rules or changing public artifacts.

- Derive a local diagnostics report from the existing three-seed `SimulationQualityReport`.
- Add fixed diagnostic dimensions for action mix, actor spread, candidate maturity, case diversity, institution influence, evidence closure, cross-case influence, performance, and determinism.
- Classify findings as `ok`, `watch`, `risk`, or `blocker`, with actual value, target, short message, and recommended next inspection.
- Write `diagnostics-report.json` and `diagnostics-report.md` under the local stable-world replay-store artifact.
- Keep diagnostics spoiler-safe: no raw case bodies, hidden truth fields, culprit/victim ids, evidence ids, source event ids, checkpoints, agent snapshots, or replay/package bodies.
- Report actor concentration only by rank/share, not NPC id.
- No public artifact schema, HTTP API, SQLite schema, UI redesign, simulation rule tuning, 5000/10000 tick gate, or Sci-Fi world feature is added.

Acceptance:

- `benchmark:stable-world -- --json` still passes all three fixed seeds and now includes a compact diagnostics summary.
- The stable-world artifact manifest lists `diagnostics-report.json` and `diagnostics-report.md` with bytes and sha256.
- `test:simulation-quality`, `test:persistent-town`, `test:world`, `tsc`, `build`, `qa:release-local`, and `replay:audit` remain clean.
- Public release artifact hashes remain stable because v5.2 changes no public dataset/catalog generator output.

### v5.3: Stable World Regression Dashboard Artifact

Implemented scope: make stable-world changes comparable across local runs before tuning simulation rules.

- Read the previous local stable-world artifact before overwriting it.
- Derive `regression-report.json` and `regression-report.md` from previous vs current quality and diagnostics reports.
- Compare case count, case type count, repeat rate, later influence, evidence warnings, action kind count, largest action share, largest actor share, institution decisions, runtime, diagnostic finding counts, and top performance phase share.
- Classify deltas as `improved`, `unchanged`, `watch`, `regressed`, or `blocked`, with actual previous/current values and recommended next inspection.
- Gracefully handle missing previous artifacts with `baselineAvailable: false` instead of failing.
- Keep regression reports spoiler-safe: no raw case bodies, hidden truth fields, culprit/victim ids, evidence ids, source event ids, checkpoints, agent snapshots, or replay/package bodies.
- No public artifact schema, HTTP API, SQLite schema, UI redesign, simulation rule tuning, 5000/10000 tick gate, or Sci-Fi world feature is added.

Acceptance:

- `benchmark:stable-world -- --json` still passes all three fixed seeds and includes `diagnostics` plus `regression` summaries.
- The stable-world artifact manifest lists diagnostics and regression report files with bytes and sha256.
- A second stable-world run reports `baselineAvailable: true` and preserves deterministic hashes.
- `test:simulation-quality`, `test:persistent-town`, `test:world`, `tsc`, `build`, `qa:release-local`, and `replay:audit` remain clean.
- Public release artifact hashes remain stable because v5.3 changes no public dataset/catalog generator output.

### v5.4: Static Reviewer Stability Story

Implemented scope: bring the v5.3 stable-world diagnostics/regression proof into the public static reviewer story without changing simulation rules or rebuilding the 5000 tick dataset.

- Add `public/review-catalog/stable-world-summary.json` with schema `public-stable-world-summary.v1`.
- Derive the summary only from the local stable-world manifest, stability summary, diagnostics JSON, and regression JSON.
- Publish seed labels, 1000 tick budget, pass/fail seed counts, deterministic hashes, repeat/action/institution/runtime aggregates, diagnostics counts, regression delta counts, and source artifact file hashes.
- Extend `public/review-catalog/index.json` with `stableWorldSummaryPath`, `stableWorldSummaryHash`, and embedded `stableWorld` data for one static fetch.
- Keep the public summary sanitized: no full benchmark body, raw case body, culprit/victim ids, NPC ids, evidence ids, event/source ids, checkpoints, agent snapshots, local paths, SQLite, or server authority.
- Add **Stable World Proof** to Reviewer Home / Trust Snapshot so reviewers see the 5000 tick public dataset and the 3 seed 1000 tick stable-world proof in the same first-screen narrative.

Acceptance:

- `public-catalog:build -- --json` writes three review-catalog files and hash-links the stable-world summary.
- `public-catalog:validate -- --json` validates schema, allowed files, hash alignment, gate ok, diagnostics with no blockers, regression with no blocked/regressed deltas, and public-safety scanning.
- `qa:static-browser -- --json` confirms Stable World Proof, 3 seeds, 1000 ticks, diagnostics, regression, no blockers, zero `/api/*`, and no 390px overflow.
- `qa:release-local -- --json` keeps repeat-generation stability inside the new three-file review catalog.
- v5.4 is a public reviewer display upgrade, not simulation tuning, API work, SQLite work, a 5000/10000 tick rerun, or Sci-Fi expansion.

### v5.5: Stable World Reviewer Drilldown

Implemented scope: make the v5.4 Stable World Proof easier to inspect in the static reviewer without changing the public artifact schema or publishing benchmark bodies.

- Reuse embedded `public-review-catalog.v1.stableWorld` data from `public/review-catalog/index.json`.
- Add aggregate-only drilldown cards for per-seed pass status, runtime min/max/spread, diagnostics finding counts, regression delta counts, and deterministic hash comparison.
- Keep the same static fetch boundary: `/review-catalog/*` and `/dataset-reader/*` only.
- Keep `public/review-catalog/stable-world-summary.json` schema unchanged.

Acceptance:

- `qa:static-browser -- --json` confirms the drilldown sections are visible on desktop and 390px mobile, with zero `/api/*` requests and no page-level horizontal overflow.
- v5.5 is a public reviewer UI drilldown, not simulation tuning, API work, SQLite work, a public dataset refresh, or a 5000/10000 tick gate.

### v5.6: Case Quality Public Summary

Implemented scope: add a non-blocking aggregate case-quality layer so the public reviewer can see whether stable-world cases look reviewable as detective cases, not just stable as simulation output.

- Derive `case-quality-report.json` and `case-quality-report.md` from existing stable-world aggregate metrics.
- Score fair-play evidence, evidence provenance, case diversity, cross-case continuity, institution relevance, repeat control, and solution readiness.
- Add `public/review-catalog/case-quality-summary.json` with schema `public-case-quality-summary.v1`.
- Extend `public/review-catalog/index.json` with `caseQualitySummaryPath`, `caseQualitySummaryHash`, and embedded `caseQuality`.
- Add a compact **Case Quality Proof** card to Static Reviewer Home.
- Keep quality scoring non-blocking: low score can show `watch` or `risk`, but it does not fail release-local.
- Keep the public summary sanitized: no raw case body, culprit/victim ids, NPC ids, evidence ids, event/source ids, checkpoints, agent snapshots, local paths, SQLite, or full benchmark bodies.

Acceptance:

- `benchmark:stable-world -- --json` writes local case-quality reports and still passes all three fixed seeds.
- `public-catalog:build -- --json` writes four review-catalog files and hash-links both stable-world and case-quality summaries.
- `public-catalog:validate -- --json` validates case-quality schema, non-blocking status, required dimensions, hash alignment, and public-safety scanning.
- `qa:static-browser -- --json` confirms Case Quality Proof, average score, lowest seed score, fair-play evidence, diversity, continuity, institution, non-blocking status, zero `/api/*`, and no 390px overflow.
- v5.6 is a public reviewer quality-story upgrade, not simulation tuning, API work, SQLite work, a public dataset refresh, or a 5000/10000 tick gate.

### v5.7: Table-Driven World Gateway

Implemented scope: widen the public-safe content model and make the first static reviewer screen read like a game/simulator gateway without making new tables runtime authority.

- Add public-safe content tables for resources, factions, event archetypes, and progression lines.
- Extend the aggregate content summary with world-system counts and cross-reference coverage for roles, locations, resources, factions, events, and growth lines.
- Keep `public-review-catalog.v1` unchanged except additive `contentSummary` fields and table counts.
- Add **Reviewer Gateway** to Static Reviewer Home with Pack, Replay, Map, and Agent entry cards.
- Upgrade the Content view into a **World Systems overview** with aggregate-only cards and no raw content table bodies.
- Keep the public boundary unchanged: static fetches stay under `/review-catalog/*` and `/dataset-reader/*`.

Acceptance:

- `content:validate -- --json` validates all content tables and reports positive counts for resources, factions, event archetypes, progression lines, and linked world-system rows.
- `public-catalog:build -- --json` and `public-catalog:validate -- --json` preserve `public-review-catalog.v1` and publish only aggregate content summary additions.
- `qa:static-browser -- --json` confirms Reviewer Gateway, Pack/Replay/Map/Agent labels, World Systems overview, zero `/api/*`, and no 390px overflow.
- `public/dataset-reader` remains unchanged unless the static reader is explicitly refreshed.
- v5.7 is a public reviewer and table-driven content-surface upgrade, not simulation tuning, API work, SQLite work, a public dataset refresh, or a 5000/10000 tick gate.

### v5.8: World-System Authoring Guide

Implemented scope: promote the v5.7 world-system tables into the browser-local Authoring guide and QA without changing persistent-town runtime behavior or public dataset snapshots.

- Add engine-side content types for resources, factions, event archetypes, and progression lines.
- Extend `DetectiveContentPack`, content summary, and content validation so engine tests and browser authoring use the same table contract as the public catalog builder.
- Add Resource, Faction, Event Archetype, and Growth Line selections to Content-Guided Case Authoring.
- Fold selected world-system labels into preview-only public text fields and Safe Diff; do not edit ids, suspect matrix, clue order, truth, timeline, or proof structure.
- Extend static browser QA to verify the new authoring controls while preserving zero `/api/*` behavior.

Acceptance:

- `test:world` reads all detective content tables and verifies world-system coverage, selection, preview labels, and safe patch boundaries.
- `qa:static-browser -- --json` confirms Resource/Faction/Event/Growth Line controls, world-system metrics, safe diff, Gallery backup, zero `/api/*`, and no 390px overflow.
- `content:validate`, `tsc`, `build`, and `qa:release-local` remain clean.
- `public/dataset-reader` remains unchanged.
- v5.8 is an Authoring+QA upgrade, not runtime tuning, API work, SQLite work, a public artifact schema change, or a 5000/10000 tick gate.

### v5.9: World-System Runtime Hints

Implemented scope: promote the v5.7/v5.8 world-system tables into a bounded Server Runtime hint layer without making raw content tables public runtime authority.

- Add `WorldSystemRuntimeHints`, `WorldSystemRuntimeHintSummary`, and `deriveWorldSystemRuntimeHints` in the engine content module.
- Persistent Agent Town can carry optional world-system hints and summary fields.
- Compatible NPC action candidates receive deterministic `worldSystemBias` used only in tie-break scoring, capped at four points and never used as a hard legality filter.
- Institution decisions include public-safe world-system labels in internal reason summaries without changing institution kinds, resource ledger schema, SQLite schema, or replay bundle schema.
- Agent UI shows **World-System Runtime Hints** for Server Runtime: resource pressure, faction lane, event archetype, growth line, action hint count, max bias, and applied count.
- QA covers deterministic hint derivation, bounded bias, unchanged action legality, public-safe hint summary text, and Server Runtime hint summary visibility.
- v5.9 does not change `public-review-catalog.v1`, does not publish raw content table bodies, does not refresh `public/dataset-reader`, and does not run the 5000/10000 tick gates.

### v5.10: World-System Influence Audit

Implemented scope: add a local aggregate-only on/off audit proving that v5.9 world-system hints influence action ordering without becoming public runtime authority.

- Add `WorldSystemInfluenceAuditReport`, seed results, and delta summaries to the engine.
- Add `npm run audit:world-system-hints`, defaulting to three seeds and 120 ticks per baseline/hinted pair.
- Write `outputs/world-system-influence-audit.json` and `.md` with only seed labels, action-kind distributions, counts, percentages, runtime, safety flags, and deterministic hashes.
- Enforce safety invariants: max bias <= 4, no increase in no-legal-candidate decisions, deterministic seed hashes, and public-safe aggregate output.
- The Agent panel now labels the Server Runtime hint health area as **World-System Influence Audit** and points reviewers to the local audit command.
- `qa:release-local` includes the local audit and keeps it out of long-run gates.
- v5.10 does not change `public-review-catalog.v1`, does not publish raw content table bodies, does not refresh `public/dataset-reader`, and does not run the 5000/10000 tick gates.

### v5.11: Public World-System Influence Proof

Implemented scope: project the v5.10 local influence audit into a tracked, public-safe Static Reviewer proof without publishing raw replay or case bodies.

- Add `public/review-catalog/world-system-influence-summary.json` with schema `public-world-system-influence-summary.v1`.
- Keep `public-review-catalog.v1`; add `worldSystemInfluenceSummaryPath`, `worldSystemInfluenceSummaryHash`, and embedded `worldSystemInfluence` fields.
- The public summary includes only seed labels, tick count, aggregate bias counts, max bias, hinted action share, institution label coverage, action-kind deltas, safety flags, and deterministic hashes.
- Static Reviewer Home now shows **World-System Influence Proof** next to Stable World Proof and Case Quality Proof.
- `qa:release-local` runs `audit:world-system-hints` before `public-catalog:build`, so the public proof is generated from the current short audit.
- v5.11 does not change runtime scoring, SQLite schema, `detective-content-pack.v1`, `public/dataset-reader`, or 5000/10000 tick gate strategy.

### v5.12: Reviewer Main Path Simplification

Implemented scope: reorganize Static Reviewer information architecture around the external reviewer path without changing schemas, runtime scoring, or public raw artifacts.

- Replace the first reviewer decision surface with **Reviewer Main Path**: Pack, Replay, Map, and Agent cards.
- Each main-path card now carries the reviewer question, one primary metric, concise context, and a next action.
- Add a compact **Proof Strip** for Static Boundary, Stable World, Case Quality, and World-System Influence; each item jumps to the existing proof details.
- Preserve Stable World Proof, Case Quality Proof, and World-System Influence Proof as drilldowns under **Proof Details**.
- Static browser QA checks Reviewer Main Path, Proof Strip, Pack/Replay/Map/Agent questions, zero `/api/*`, and 390px no-overflow behavior.
- v5.12 does not change `public-review-catalog.v1`, does not add public files, does not refresh `public/dataset-reader`, and does not run 5000/10000 tick gates.

### v5.13: Playable Investigation Main Path

Implemented scope: make the player-facing route as easy to understand as the reviewer route without changing public schemas, runtime scoring, SQLite, or public dataset snapshots.

- Add **Playable Investigation Path** above the investigation panel for both Static and Server Runtime.
- The path fixes the seven user-facing steps: Join, Search, Question, Challenge, Select Evidence, Submit, and Review Source.
- The path reuses existing Case Intake, Investigation Coach, Truth Ledger, Route Certificate, session progress, evidence notebook, and theory state.
- Static Runtime uses a browser-local join/session path and keeps every path action inside existing map, evidence, NPC, theory, or logic UI.
- The path displays only low-spoiler labels, status, and aggregate counts; it does not render culprit/victim ids, NPC ids, evidence ids, event/source ids, hidden truth, raw bodies, or source trails.
- Static browser QA checks Playable Investigation Path, seven step labels, low-spoiler boundary copy, zero `/api/*`, and 390px no-overflow behavior.
- v5.13 does not change `public-review-catalog.v1`, does not add public files, does not refresh `public/dataset-reader`, and does not run 5000/10000 tick gates.

### v5.14: Static Playthrough Completion Proof

Implemented scope: prove the Static Premium case can complete through the v5.13 player path without changing public schemas, runtime scoring, SQLite, or public dataset snapshots.

- Add **Static Playthrough Proof** below Playable Investigation Path.
- The proof uses existing Route Certificate, Truth Ledger proof coverage, and `autoSolvePlayableCase` to report route certified, auto route pass, accepted theory, challenge hits, selected evidence, and covered obligations.
- Add **Run Certified Playthrough** as an explicit browser-local action that updates only Static Runtime session/progress/theory state.
- Proof UI stays aggregate-only and does not render culprit/victim ids, NPC ids, evidence ids, event/source ids, hidden truth, raw bodies, or source trails.
- Static browser QA clicks the proof action, checks completed / accepted theory plus aggregate metrics, confirms zero `/api/*`, and keeps 390px no-overflow behavior.
- v5.14 does not change `public-review-catalog.v1`, does not add public files, does not refresh `public/dataset-reader`, and does not run 5000/10000 tick gates.

### v5.15: Server Playthrough Completion Proof

Implemented scope: prove extracted Server Runtime emerged cases can complete through the same player path without changing public schemas, runtime scoring, SQLite schema, or public dataset snapshots.

- Reuse the v5.14 proof card as a generic Certified Playthrough Proof surface for Static and Server modes.
- Add **Server Playthrough Proof** below Playable Investigation Path when a source-backed Persistent Agent Town case is active.
- Extend `/api/v1/command/investigation/autosolve` with additive `includeSession`; default responses remain spoiler-safe summaries, while explicit persisted server proof can return the dedicated auto-player session.
- Add **Run Server Certified Playthrough** as an explicit Server Runtime action that persists only an auto-player session and updates existing session/progress/theory state.
- Browser QA now extracts an emerged case, runs the server certified playthrough, checks completed / accepted theory plus aggregate metrics, and keeps Static Runtime at zero `/api/*`.
- v5.15 does not change `public-review-catalog.v1`, does not add public files, does not refresh `public/dataset-reader`, and does not run 5000/10000 tick gates.

### v5.16: Unified Source Review Unlock

Implemented scope: make accepted-theory completion readable as a source-backed audit without adding public artifacts, APIs, runtime scoring, or dataset refresh.

- Add **Source Review Unlock** below the playable path and certified proof cards.
- Show locked aggregate status before solve and unlocked source-backed audit status after accepted theory.
- Add **Source Review Workbench** with Source Trail, Proof Obligations, Certified Route, and Conclusion Review, reusing existing Case Intake, Truth Ledger, Proof Coverage, Route Certificate, Proof Tour, and reveal text.
- Route `Review Source` actions back to the Investigation panel workbench so Static and Server completion share one review path.
- Static browser QA checks the completed Source Review Workbench in Static Runtime and Server emerged-case Runtime while preserving zero `/api/*` for Static and 390px no-overflow behavior.
- v5.16 does not change `public-review-catalog.v1`, does not add public files, does not refresh `public/dataset-reader`, and does not run 5000/10000 tick gates.

### v5.17: Guided Manual Investigation Run

Implemented scope: make the seven-step player path manually runnable while keeping certified autosolve as proof, not the default player path.

- Add **Guided Manual Run** below Playable Investigation Path.
- `Run Next Guided Step` advances exactly one low-spoiler player step through Join, Search, Question, Challenge, Select Evidence, Submit, and Review Source.
- Static Runtime uses existing browser-local demo actions; Server Runtime reuses existing local join/discover/interrogate/submit APIs.
- Certified Playthrough Proof remains available as proof, while Guided Manual Run becomes the player-facing completion path.
- Static browser QA checks Static and Server guided completion, Source Review unlock, zero `/api/*` for Static, and 390px no-overflow behavior.
- v5.17 does not change public schemas, public artifacts, dataset snapshots, SQLite schema, world-system scoring, or long-run gates.

### v5.18: Guided Step Journal

Implemented scope: make each guided step understandable without adding public artifacts, APIs, storage schema, or runtime scoring changes.

- Add **Guided Step Journal** below Guided Manual Run.
- Record session-only low-spoiler entries for Join, Search, Question, Challenge, Select Evidence, Submit, and Review Source.
- Entries show result summary, progress delta, next required action, certified fallback use, and review unlock status without raw ids or hidden truth.
- Static and Server Runtime use the same UI; Static remains browser-local and Server only reflects existing local API results.
- Static browser QA checks journal visibility, step coverage, fallback marker, review unlock, raw-id safety, zero `/api/*` for Static, and 390px no-overflow behavior.
- v5.18 does not change public schemas, public artifacts, dataset snapshots, SQLite schema, world-system scoring, or long-run gates.

### v5.19: Solved Case Debrief

Implemented scope: make the solved-case result understandable after Review Source without adding public artifacts, APIs, storage schema, or runtime scoring changes.

- Add **Solved Case Debrief** after Source Review Unlock.
- Summarize Player Route, Evidence Closure, Source Confidence, and Next Replay Goal from local session, journal, proof coverage, route certificate, and source review data.
- Show accepted status, guided step count, certified fallback marker, selected evidence, challenge hits, covered obligations, proof gaps, and source review unlock without raw ids or hidden truth.
- Static remains browser-local; Server Runtime reads existing local session/intake/proof state only.
- Static browser QA checks Static and Server Debrief visibility, section coverage, fallback/proof-gap metrics, raw-id safety, zero `/api/*` for Static, and 390px no-overflow behavior.
- v5.19 does not change public schemas, public artifacts, dataset snapshots, SQLite schema, world-system scoring, or long-run gates.

### v5.20: Replay Goal Coach

Implemented scope: turn solved-case replay advice into a local practice action without adding public artifacts, APIs, storage schema, or runtime scoring changes.

- Add **Replay Goal Coach** below Solved Case Debrief.
- Show Reduce fallback, Manual evidence selection, Fewer guided clicks, and Review source after submit goals from existing local session, journal, proof coverage, route certificate, and source review data.
- `Start Replay Attempt` resets the current investigation attempt while preserving the active case and proof data source; Static stays browser-local and Server reuses the existing local join/session flow.
- Coach displays attempt status, completed replay goals, current step, last result, previous guided steps, fallback use, selected evidence, proof gaps, and source review unlock without raw ids or hidden truth.
- Static browser QA checks Static and Server coach visibility, replay attempt activation, raw-id safety, zero `/api/*` for Static, and 390px no-overflow behavior.
- v5.20 does not change public schemas, public artifacts, dataset snapshots, SQLite schema, world-system scoring, or long-run gates.

### v5.21: Replay Attempt Scorecard

Implemented scope: make a replay attempt readable after completion without adding public artifacts, APIs, storage schema, scoring gates, or runtime scoring changes.

- Add **Replay Attempt Scorecard** below Replay Goal Coach.
- Show pending replay delta after `Start Replay Attempt`, then completed replay delta after accepted theory and Review Source unlock.
- Compare previous/current guided clicks, certified fallback, selected evidence, proof gaps, source review unlock, and completed replay goals using descriptive `improved / unchanged / regressed / completed / pending` labels only.
- Static remains browser-local; Server Runtime uses the existing local join/session and guided investigation flows.
- Static browser QA checks Static and Server Scorecard visibility, pending/completed state, descriptive deltas, raw-id safety, zero `/api/*` for Static, and 390px no-overflow behavior.
- v5.21 does not change public schemas, public artifacts, dataset snapshots, SQLite schema, world-system scoring, score gates, or long-run gates.

### v5.22: Manual Evidence Drill

Implemented scope: turn manual evidence selection from a scorecard statistic into an executable replay-practice step without adding public artifacts, APIs, storage schema, scoring gates, or runtime scoring changes.

- Add **Manual Evidence Drill** near Replay Goal Coach and Replay Attempt Scorecard.
- During an active replay attempt, discovered route evidence is shown as low-spoiler candidate cards with Add to Theory / Remove from Theory controls.
- Guided `select-evidence` uses Manual Pick First during replay attempts: it points the player to the drill instead of immediately adding every certified proof clue.
- Scorecard and Journal show manual picks, fallback picks, remaining proof slots, and ready-for-submit status without raw ids, hidden truth, raw case bodies, or replay bodies.
- Static browser QA checks Static and Server Drill visibility, Add to Theory behavior, manual-pick Scorecard signal, raw-id safety, zero `/api/*` for Static, and 390px no-overflow behavior.
- v5.22 does not change public schemas, public artifacts, dataset snapshots, SQLite schema, world-system scoring, API endpoints, score gates, or long-run gates.

### v5.23: Manual Theory Drill

Implemented scope: turn `Reduce fallback` into a field-level replay-practice step without adding public artifacts, APIs, storage schema, scoring gates, or runtime scoring changes.

- Add **Manual Theory Drill** after Manual Evidence Drill during active replay attempts.
- Suspect, motive, and method use Manual First inputs backed only by discovered evidence titles, visible descriptions, and public support labels.
- Guided `submit` waits on the Theory Drill when fields are incomplete or unresolved; it does not auto-fallback during replay attempts.
- Explicit certified fallback can fill only remaining or unresolved fields for internal judgement, without copying hidden answers into visible inputs.
- Journal, Coach, and Scorecard show manual theory field count, fallback theory field count, and blocked gap count without player text, raw ids, hidden truth, raw case bodies, or replay bodies.
- Static browser QA checks Static and Server Drill visibility, manual field updates, explicit fallback completion, field-level Scorecard signals, raw-id safety, zero `/api/*` for Static, and 390px no-overflow behavior.
- v5.23 does not change public schemas, public artifacts, dataset snapshots, SQLite schema, world-system scoring, API endpoints, score gates, or long-run gates.

### v5.24: Replay Practice Loop

Implemented scope: make the solved-case replay practice path readable as one status header without adding public artifacts, APIs, storage schema, scoring gates, or runtime scoring changes.

- Add **Replay Practice Loop** above Replay Goal Coach.
- Show fixed phases: Start, Discover, Pick Evidence, Fill Theory, Submit, Review Source, and Scorecard.
- Derive current phase and next action from existing replay attempt, Guided Manual Run, Manual Evidence Drill, Manual Theory Drill, Source Review Unlock, and Scorecard state.
- Show aggregate-only manual/fallback evidence picks, manual/fallback theory fields, blocked gaps, source review unlock, and scorecard status.
- Keep existing Replay Goal Coach, Manual Evidence Drill, Manual Theory Drill, and Replay Attempt Scorecard intact.
- Static browser QA checks Static and Server Loop visibility, active attempt phase changes, manual/fallback count updates, completed Scorecard readiness, raw-id safety, zero `/api/*` for Static, and 390px no-overflow behavior.
- v5.24 does not change public schemas, public artifacts, dataset snapshots, SQLite schema, world-system scoring, API endpoints, score gates, or long-run gates.

### v5.25: World Lead Loop

Implemented scope: turn existing world-system hints into one optional player-facing Server Runtime loop without adding a proof card, endpoint, SQLite schema, public artifact, or long-run gate.

- After Join, show one deterministic low-spoiler World Lead derived from the existing resource, faction, event, and progression hint bias map.
- Follow or Skip is recorded per session in existing Persistent Town state JSON through an optional field on the existing runtime command; zero-tick updates emit no simulation event.
- Follow may prioritize only an eligible certified Search, Question, or Challenge. It never changes the truth, evidence coverage, route certificate, candidate legality, or underlying NPC action bias.
- The lead resolves once its matching guided step completes; Journal records only aggregate safe status and next-action text.
- Static Runtime shows only the server-loop boundary, remains zero `/api/*`, and exposes no interactive decision.
- Browser QA checks Follow, resolved state, raw-id safety, Static boundary, and 390px no-overflow behavior; persistent tests and API smoke verify deterministic preview, per-session state, and zero-tick persistence.

### v5.26: Shared World Lead Outcome Cycle

Implemented scope: make the completed optional World Lead produce one player-visible, bounded world-state consequence for the active case without turning it into another proof card or changing certified detective fairness.

- A resolved Follow creates at most one shared active outcome per case in existing Persistent Town JSON. Search, Question, and Challenge use fixed benefit/tradeoff mappings over the existing location profile, faction-mapped institution, and resource ledger.
- The outcome records only internal case/location/institution/resource keys and actual clamped deltas. Public responses expose a safe active/settled summary with labels and next action only; `publicRuntime` strips the internal record.
- Activation and settlement are zero-tick, event-free updates. They do not alter truth, evidence coverage, route certificate, candidate availability, or NPC legal action sets.
- Accepted theory settles the active outcome; opening a different extracted case settles the previous one first. Incorrect theory submission stays a correction path and leaves the outcome active.
- World Lead, Guided Step Journal, Solved Case Debrief, Replay Practice Loop, and Replay Attempt Scorecard show only aggregate low-spoiler active/settled status. Static Runtime remains read-only and zero `/api/*`.
- Persistent tests, API smoke, and browser QA cover fixed mappings, deterministic/idempotent application, reversible deltas, zero-tick behavior, accepted-theory settlement, raw-id safety, Server flow, Static boundary, and 390px no-overflow behavior.

### v5.27: Case Aftermath Handoff

Implemented scope: carry one settled, player-earned World Lead consequence into a bounded next-case recommendation without making it a forced choice, a proof card, or a lasting world modifier.

- Only an accepted non-autosolve player theory that settles an active World Lead outcome prepares one `ready` handoff in existing Persistent Town JSON. Safety settlement while switching cases never creates one.
- The final candidate sort receives a deterministic `+2` bonus only for the fixed focus mapping: Search → evidence-tampering, Question → false-testimony, Challenge → court-intimidation. Candidate membership, validity, route certificate, coverage, truth, and legal NPC action sets remain untouched.
- Route-integrity-successful extraction consumes the handoff exactly once, even when the player selected a non-preferred legal candidate; previews, refreshes, failed extraction, ticks, and events do not consume it.
- Public projection strips settled/consumed case keys and ticks. World Lead, Journal, Debrief, Replay Practice Loop, and Scorecard expose only `ready` / `consumed`, safe direction, and a next action; Static remains explanatory, read-only, and zero `/api/*`.

### v5.28: Case-Scoped World Arc

Implemented scope: turn the existing resource, faction, event, and progression tables into a case-bound, resumable player loop without adding another proof card.

- The actual successfully extracted candidate now becomes the server authority for world-system hints. This closes the previous gap where runtime creation could keep the default case-type context after another case was opened.
- Progress is stored per internal progression line in existing Persistent Town JSON and resumes when a later case returns to that line. Public surfaces receive only label, active/completed status, aggregate stage progress, a safe world pulse, and next action.
- Only Follow -> matching certified step -> accepted player theory advances one stage. Skip, wrong theory, autosolve, failed extraction, preview, and case-switch safety settlement remain non-authoritative.
- An advanced incomplete line contributes a non-stacking `+1` to the stable top world-system NPC action and compatible candidate final sort. It changes ranking only; the legal action set, candidate set, validity, route certificate, evidence coverage, and truth remain identical.
- The design borrows separation and map-first presentation from [GOD](https://github.com/XiaoLuoLYG/GOD), rules-first world systems and query/command feedback from [Cultivation World Simulator](https://github.com/4thfever/cultivation-world-simulator), and server-owned input/state invariants from [AI Town](https://github.com/a16z-infra/ai-town/blob/main/ARCHITECTURE.md). No source code, assets, data, framework, remote service, or background runtime was copied.
- Persistent tests, API smoke, and browser QA cover deterministic focus mapping, fixed bonus invariants, ready-to-consumed lifecycle, safe persistence, no raw-key leakage, Static zero-API behavior, and 390px no-overflow behavior.
- The stage counter remains a bounded strategy signal: it does not rewrite an extracted case or its certified evidence route.

### v5.29: Faction Directive Runtime Cycle

Implemented scope: turn a real-player World Arc advance into one content-driven institution operation, so factions, resources, public opinion, evidence handling, and multi-tick runtime actions become a player-visible loop instead of another proof card.

- Each accepted followed lead that advances an Arc stage enqueues exactly one `(progression line, completed stage)` directive in existing Persistent Town JSON. Wrong theories, Skip, autosolve, previews, failed extraction, and case-switch settlement do not enqueue.
- Six built-in event archetypes configure safe Support and Contain mappings to existing institution strategies and long-action kinds. Legacy packs without the optional configuration remain valid and simply do not create a directive.
- Defer, Support, and Contain are zero-tick writes. Support or Contain opens a bounded 12-tick execution window and starts only on the next legal five-tick institution cadence; the selected institution's normal decision is suppressed for that cadence to prevent a double action.
- Existing long-action resource reservations, durations, institution deltas, public opinion, and evidence-chain resolution remain authoritative. Missing actors or resources produce a safe blocked state; a running failure refunds its recorded reservation once and permits the alternate response.
- Completed effects remain bounded town history and may influence future, not-yet-extracted cases through existing rules. Active/extracted truth, route certificate, evidence coverage, legal NPC candidates, and submitted judgement remain frozen.
- Public runtime strips the internal FIFO, case, progression, event, institution, actor, action, tick, and reservation keys. UI, Journal, Debrief, Replay Practice Loop, and Scorecard show only safe aggregate labels and status.
- Static Runtime remains explanatory, non-interactive, and zero `/api/*`; no endpoint, SQLite schema, public artifact, remote service, background task, or long-run gate was added.

### v5.30: World Pressure Cascade

Implemented scope: turn the durable result of a completed Faction Directive into a short, bounded, consumable signal for future case ordering, closing the feedback path from institution action back into the player-facing case queue without adding another proof card.

- Completion reads the existing long action's clamp-aware applied evidence, public-opinion, and institution deltas plus its actual recorded resource reservation. A fixed priority selects one `rising` or `relief` signal and reuses existing content `caseTypeIds`, with stable resource/action fallback when content focus is absent.
- Same-focus same-direction pulses merge to at most three layers; opposing directions coexist. Active and historical records are bounded, repeated reads are idempotent, and the total signed final-ranking effect is clamped to `[-2,+2]` independently from the v5.27 handoff `+2` and v5.28 Arc `+1`.
- Candidate preview, queue refresh, wrong theory, Skip, autosolve, failed extraction, and case-switch settlement neither create nor consume pressure. Only route-integrity-successful future extraction consumes one oldest active layer.
- Pressure affects ordering and explanation only. Candidate membership, validity, truth, route certificate, evidence coverage, NPC legal actions, current/extracted case objects, and judgement remain unchanged.
- Internal pulse source, case, directive, event, institution, resource, action, tick, and raw applied-result keys remain in the existing Persistent Town JSON only. Public runtime and UI expose active count, low-spoiler direction/focus, aggregate remaining layers, and next action.
- Situation Brief, World Lead context, Journal, Debrief, Replay Practice Loop, and Scorecard reuse existing aggregate surfaces. Static Runtime shows only a Server-only pressure-cascade explanation and remains non-interactive, zero `/api/*`, and safe at 390px.
- No endpoint, SQLite or content schema, public artifact, remote service, background task, dataset refresh, proof card, or long-run gate was added. The remaining product-depth constraint is still the breadth and variety of durable runtime loops, not a lack of audit panels.

### v5.31: Player Main Path Consolidation and Runtime Modularization

Implemented scope: begin converting the accumulated v5.25–v5.30 world systems from several competing status surfaces into one player-readable world campaign path, while reducing the largest UI and runtime module concentrations.

- World Lead, Outcome, Handoff, World Arc, Faction Directive, and World Pressure now share one **Case & World Consequence** surface. A deterministic **Current world action** prioritizes an open faction response, running operation, next-case handoff, pending lead choice, active case outcome, pressure carry, or normal certified continuation in that order.
- Existing detailed states, buttons, lifecycle labels, and browser test ids remain available inside the consolidated surface. This is hierarchy consolidation rather than feature deletion or another proof card.
- Static Runtime renders one read-only Current world action that keeps the certified investigation path. It exposes no Follow, Skip, Support, Contain, Defer, or persistent pressure control and remains zero `/api/*`.
- The world campaign UI moves from the general Detective Town component into `WorldCampaignPanel.tsx`. The original component keeps only the typed integration boundary.
- World Pressure derivation, clamp-aware direction selection, bounded merge/history, extraction consumption, safe projection, and candidate ranking bonus move from `persistent-town.ts` into `town/world-pressure.ts`; existing engine exports and runtime JSON remain compatible.
- No gameplay modifier, endpoint, SQLite/content/public schema, public artifact, background task, dataset refresh, or long gate is added. Candidate membership, validity, truth, route certificate, evidence coverage, legal NPC actions, and judgement remain unchanged.

### v5.32: Unified Influence Budget

Implemented scope: replace three independent player-earned final-sort additions with one auditable, bounded influence ledger without changing the underlying handoff, arc, or pressure lifecycles.

- Handoff keeps its fixed `+2`, an advanced compatible Arc keeps `+1`, and Pressure keeps its independently clamped `[-2,+2]` contribution, but their final signed total is now clamped to `[-3,+3]` before candidate ordering.
- The ledger is pure and derived from existing runtime state. It records stable source order, raw aggregate, applied aggregate, cap, and clamp status for tests and internal audit; it does not create a new persistence authority.
- Compatibility helpers now delegate to the same source derivation. Final candidate sorting consumes only `deriveCandidateInfluenceBudget`, preventing future modifiers from bypassing the shared budget.
- Public runtime, Case & World Consequence, and Situation Brief expose only active source count, safe source labels, direction, strength, and the `±3` cap. Internal case types, pulse keys, progression keys, source bindings, and raw ledger entries remain private.
- Static Runtime shows a read-only Server-only budget explanation with no controls or `/api/*`. No endpoint, SQLite/content/public schema, public artifact, dataset refresh, proof card, background task, or long gate is added.

### v5.33: Player Resource Commitment

Implemented scope: turn the existing town resource ledger into a real, case-scoped player decision inside the certified investigation path instead of adding another status or proof surface.

- Join opens exactly one optional choice for the current player session and case: Police Time -> Search, Informant Trust -> Question, Evidence Integrity -> Challenge, or no reserve. The fixed cost is two existing ledger units.
- Selection is a zero-tick, zero-event write. It moves the actual amount from `available` to `reserved`, never calls the agent intervention path, and does not create a second economy.
- The existing successful discover/interrogate endpoints are the consumption authority. Only the matching certified lane spends the reserve, moves it into `spentThisRun`, adds bounded pressure, and applies one clamp-aware benefit: local resource pressure -2, witness fear -2, or evidence contamination -2.
- A non-matching step, repeated step, wrong theory, preview, and read request cannot consume, refund, or duplicate the commitment. Accepted theory and route-integrity-successful case switch return only unused reservations once; a spent commitment is never refunded.
- Public runtime strips the internal session, case, location, raw resource, amount, and tick bindings. Case & World Consequence, Situation Brief, Journal, and responses expose only safe labels, lane, aggregate status, benefit/cost copy, and next action.
- Static Runtime shows only the Server-only read-only boundary with no choice controls or resource values. No endpoint, SQLite/content/public schema, public artifact, background task, proof card, dataset refresh, or long gate is added.

### v5.34: Faction Relationship Ledger

Implemented scope: make completed player choices change how existing institutions treat the investigator across cases, using a bounded internal ledger rather than a new mission or proof surface.

- The existing Persistent Town JSON now carries one investigator-to-institution matrix across all eight institution kinds. Values clamp to `[-10,10]`, history is capped at 64 entries, and stable source keys make accepted cases, spent resources, and completed directives idempotent.
- Completed Support improves its operating institution and, when distinct, its source faction. Completed Contain improves the operating institution while creating a bounded source-faction tradeoff. The same completion cannot apply twice.
- A genuinely spent Police Time, Informant Trust, or Evidence Integrity commitment improves its matching partner once. An accepted real-player case improves its source faction once. Autosolve, preview, wrong theory, failed extraction, and read requests cannot award standing.
- Public summaries expose only `trusted`, `neutral`, `strained`, or `hostile`, aggregate counts, safe labels, and next action. Internal faction kinds, values, source keys, case/directive bindings, deltas, and ticks are stripped.
- Trusted standing lowers a future matching resource reserve from two units to one; strained raises it to three; hostile can withhold that option. The relationship threshold is checked only when a future choice opens and never modifies current-case truth, evidence, route coverage, legal actions, candidate membership, or judgement.
- Static Runtime shows only the Server-only relationship boundary. No endpoint, SQLite/content/public schema, public artifact, background service, hidden decay, or proof card is added.

### v5.35: World Event Offer Lifecycle

Implemented scope: turn a completed faction directive into one bounded, player-readable world opportunity that uses the existing institution and long-action engine rather than a second mission system.

- A real-player completed directive may enqueue one content-configured offer with `offered -> accepted | declined -> running -> completed | failed | expired` lifecycle. The queue is FIFO and bounded; duplicate source directives do not create duplicate offers, and deadlines are processed only during normal Persistent Town ticks.
- Accept/Decline are zero-tick writes. Accept does not reserve resources or emit an event; the next legal institution cadence performs relationship, actor, resource, and catalog checks, then reuses the existing multi-tick action and event path. Completion applies one explicit relationship recovery; blocked/cancelled actions refund only their recorded reservation once.
- Offer creation is resource-aware without injecting resources: the alternate configured response is preferred, with a deterministic fallback to the completed response only when that operation is currently affordable. If both are unavailable, the offer remains honest and can fail safely with a bounded recovery explanation.
- Situation Brief, Case & World Consequence, and Journal expose status, benefit/cost copy, progress, deadline bands, queue count, and next action. Public projection strips directive/event/case/actor/action/institution/resource/reservation/tick keys. Static renders only a Server-only boundary with no controls and zero `/api/*`.

This is the first explicit offer/accept/complete opportunity loop in the world layer. It makes the existing directive result playable without adding a proof card, a background queue, a new endpoint, a schema migration, or a second action engine. The current and extracted case remain frozen: offer effects can shape only future world state, recovery, and future candidate context.

### v5.36: Investigator Progression

Implemented scope: give real manual investigation a bounded, explainable identity that improves future options without becoming a hidden truth channel or a second scoring system.

- Manual Search, Question, Challenge, evidence selection, and accepted theory now record idempotent practice marks in the existing Persistent Town JSON. Autosolve, counterfactual interventions, previews, wrong theories without selected evidence, and case-switch settlement do not award marks.
- Public projection exposes only developing/established status, bounded points, competency labels, unlock labels, and a low-spoiler next action. Source keys, session/case bindings, and the internal ledger stay private.
- Established lane competency reduces one future matching resource reserve by one unit (never below one). Established case-closure competency enables one bounded retry for a failed or expired World Event Offer. These effects apply only to future opportunities; the active and extracted case retain identical truth, route certificate, evidence coverage, legal actions, candidate membership, and judgement.
- Situation Brief, Journal, Debrief, Replay, and Scorecard reuse aggregate practice language. Static Runtime shows only a read-only Server-only boundary and makes zero `/api/*` requests.

This is the first player progression loop that rewards manual investigation quality without granting truth access. It adds no proof card, endpoint, schema migration, public artifact, background service, or long gate.

### v5.37: Content Expansion and Authoring Grammar

Implemented scope: raise replay value with authored content contrast and deterministic short-campaign planning instead of another runtime subsystem.

- The content pack expands from 10 to 16 case types, 6 to 10 event archetypes, and 6 to 8 progression lines while reusing the existing 19 evidence families, nine roles, seven motives, six resources, six factions, directive catalog, and long-action engine.
- Six new contrasts cover archive disappearance, clinic inventory timing, dock witness substitution, editorial coercion, household escrow, and forged permits. Each connects to compatible evidence, roles, motives, locations, resources, factions, events, and progression lines.
- Optional `authoredCluster`, `contrastKey`, and `campaignTags` metadata remains backward compatible under `detective-content-pack.v1`. Validation rejects invalid slugs, duplicate in-cluster contrast keys, orphan clusters, unsafe copy, broken references, and institution-incompatible directive mappings.
- Deterministic authored sequence selection chooses three distinct case types from three distinct clusters before repetition. Tests verify identical seeds produce identical sequences and every new case retains evidence, event, and progression coverage.
- Static and public artifacts are unchanged: source content may drive browser-local labels and Server Runtime hints, but no dataset/review catalog refresh, new endpoint, schema migration, or proof surface is introduced.

This closes the minimum v5.37 quantity gate and provides a real authoring grammar. The remaining gap is not another schema; it is failure recovery, human pacing evidence, and a complete three-to-five-case campaign.

### v5.38: Failure and Recovery

Implemented scope: turn known campaign failures into visible, bounded recovery choices instead of dead ends, developer resets, or hidden forgiveness.

- Rejected theories, unavailable case resources, hostile institution relationships, blocked faction operations, and failed or expired world opportunities enqueue one idempotent recovery record in existing Persistent Town JSON. Internal source, session, case, resource, institution, offer, tick, and applied-delta fields never enter public projection.
- The recovery queue is FIFO and capped at 32. Each failure source creates at most one recovery; Start and Defer are zero-tick decisions and never generate a synthetic WorldEvent.
- Certified-route review and alternate-response recovery complete immediately because they only return the player to already legal choices. Resource restoration, trust rebuilding, and opportunity reopening wait for the next existing institution cadence and apply only bounded, clamp-aware changes.
- Resource recovery restores two available units and eases one pressure point. Trust recovery applies at most four standing points. A failed or expired offer may be reopened by campaign recovery once; existing v5.36 investigator retry remains a separate earned option.
- Tests deliberately trigger theory, resource, relationship, and opportunity failures, prove dedupe and bounded history, then complete the unchanged certified judgement after multiple failures.

This completes the minimum fail-forward substrate required before Arc convergence. The next bottleneck is demonstrating that several distinct three-case histories can converge on a fair finale without requiring one faction or resource build.

### v5.39: Arc Convergence Finale

Implemented scope: turn several already-authoritative campaign histories into one shared finale condition while keeping the finale inside the ordinary certified case pipeline.

- Convergence requires two real accepted theories and two World Arc stages. A third signal may come from trusted standing/completed opportunity, completed recovery, or completed directive/consumed pressure, producing Coalition, Recovery, or Pressure-balance context respectively.
- Stable precedence makes overlapping histories deterministic. All approaches reach the same `court-intimidation` finale family but retain different low-spoiler context labels, so the result is shared without erasing the player's route.
- Ready convergence changes only the first future candidate's case-family preference and adds one fixed `+3` ordering signal. Validation still runs afterward. Other candidates remain available, and extracting an alternative leaves convergence ready.
- Successful route-integrity extraction of the finale-family candidate binds the state to that frozen case. Only an accepted theory for that exact case completes convergence; wrong theory, preview, failed extraction, autosolve, and unrelated accepted cases do not.
- Public runtime strips internal signal keys, case binding, and ticks. World Campaign, Situation Brief, and Journal display only status, safe approach, bounded progress, context, and next action. Static exposes only a Server-only explanation.
- Unit tests prove three distinct histories reach one finale family, non-finale freedom, bounded ranking, activation/completion idempotence, and no truth/evidence/route mutation.

This closes the missing convergence gate. v6.0 then turns that gate into a complete, bounded campaign journey rather than another isolated world subsystem.

### v6.0: Complete Three-Case Campaign

Implemented scope: package the existing case and world loops into one readable Server Runtime journey with a shared finale and a safe causal debrief.

- The internal campaign state is explicit and bounded: `opening | case-active | transition | finale-ready | finale-active | completed`, a target of three accepted cases, and a hard maximum history of five.
- Every successful extraction activates one campaign chapter. Generated cases may reuse their outer case key and candidate key, so an internal extraction sequence provides the authoritative chapter identity; repeated settlement remains idempotent while a later extraction is still a new chapter.
- Accepted player theories advance campaign progress. Autosolve, wrong theory, candidate preview, failed extraction, and reads do not. The first two cases retain the normal candidate and certified investigation pipeline.
- Once v5.39 convergence is ready, the first normally valid future candidate carries the finale family and is validated again. An invalid leading pressure pair can no longer hide the finale, and no finale candidate bypasses route integrity.
- Extracting the finale activates both Arc convergence and campaign finale state. An accepted theory for the bound finale closes both atomically and returns `3/3 campaign cases closed`.
- The existing World Campaign surface shows chapter, progress, one primary action, bounded consequence labels, and a replay prompt. The completed state unlocks a causal debrief built only from safe aggregates; it never exposes case bindings, ticks, resource keys, source keys, truth, or evidence identifiers.
- Production API smoke now performs the complete route: create town, extract case one, Join and Follow, investigate and submit, carry world consequences into case two, prepare and extract the validated shared finale, solve it through the unchanged theory endpoint, and assert the safe completed debrief.

This is the first verified start-to-finish three-case Server Runtime campaign. It completes the architecture and deterministic integration gate. It does not claim that the later v6.2 matrix of eight official human sessions has completed or that pacing and comprehension are production-proven; those remain the highest-priority product evidence gaps.

### v6.1: Town Social Response Cycle

Implemented scope: turn real player-driven world results into a short, deterministic character-facing reaction without creating a second simulation or investigation authority.

- Accepted Follow outcome settlement, completed player-selected Directive, completed accepted Offer, and Recovery with an actual resource/relationship/opportunity restoration prepare one internal ambient cycle. Skip, wrong theory, autosolve, Defer, Decline, failure, expiry, zero-delta recovery, preview, and reads do not.
- The lifecycle is bounded to `ready | active | settled`, one cycle advances at a time, one positive tick reveals at most one reaction, one cycle uses at most three distinct living NPCs, each source is idempotent, and total queued/history records are capped at 24.
- Consequence direction reuses the applied-delta priority already used by World Pressure. Public target place and NPC order are stable: action/outcome place or institution influence, then institution staff by rank/workload/key, current occupants, actor relationships, and stable living fallback.
- Public UI shows only resident name, public role, public place, fixed supportive/guarded reaction, progress, and next action. Situation Brief reduces this to the latest reaction. Internal source, NPC, location, institution, action, event, case, tick, and delta keys remain private.
- The ambient partition cannot write events, memories, observations, rule state, evidence chain, location authority, relationship authority, candidate cache, action score, or decision trace. Paired normal-tick tests prove identical events, memories, observations, rule state, location profiles, NPC states/decisions, candidate membership/order/validity inputs, and legal action sets with or without the response cycle.
- API smoke covers accepted Follow `ready -> active -> settled`, readable name/role/place output, no synthetic social event, public projection stripping, and additional Directive/Offer preparation. Static Browser QA requires only a Server-only boundary, no response controls, zero `/api/*`, and the existing 390px no-overflow gate.

This directly addresses the most visible gap against AI Town without sacrificing Detective Town's stronger determinism and fair-play isolation. It is deliberately an ambient presentation layer, not dialogue authority, case influence, or another proof card.

### v6.2: Human Campaign Comprehension Gate

Implemented scope: establish a privacy-bounded human-comprehension baseline instrument without changing the Campaign being measured.

- Only local Server Runtime with `?study=1` initializes the hook and renders a separate, default-collapsed Campaign Study Recorder. It starts only at Campaign `opening` with no active investigation session and never resets the town automatically.
- The pure model fixes cohort, protocol, scenario, lifecycle, stage, confusion, Finale rating, and Replay intent enums. It stores integer-second aggregates for stage and world-choice duration, first meaningful action, Recovery appearance/start/prompting, Guided Step and explicit fallback use, completion, and safe abandonment stage.
- The study hook observes only existing safe React state. Existing action handlers notify it after successful runtime advance, extraction, Join, certified investigation work, world choice, Recovery start, Guided Step, or explicit fallback. No study field enters an API payload, runtime object, tick, event, candidate, session, theory, or judgement.
- Browser persistence is one fixed `localStorage` key with at most 16 anonymous summaries. Active reloads become `interrupted`; no wall-clock reconstruction occurs. Official runs are retained before the newest pilots. Safe export removes measurement-only state and uses one fixed JSON filename.
- Privacy tests prohibit timestamps, identity/device data, world/case/session/NPC/location/source identifiers, seed, selected choice, player prose, event sequence, raw body, hidden truth, and absolute paths. Study data never enters SQLite, logs, public projection, or public artifacts.
- Dedicated browser QA proves Server start, first meaningful action, assessment, finalization, safe download, and unchanged runtime-step payload. The paired Static check proves no recorder, no study storage write, zero `/api/*`, and no 390px page overflow even with `study=1`.
- The moderator protocol fixes two pilots and eight eligible official attempts: mystery-first and systems-first each receive two standard and two Recovery-probe attempts. Completed and abandoned attempts remain in the denominator; technical interruptions require a new participant replacement. The protocol also fixes the 90-minute cap, intervention rule, confusion episodes, and exit thresholds.
- The aggregate analyzer enforces the exact 2 x 2 matrix, treats missing first action as infinite, applies the fixed confusion tie order, and emits only cohort/scenario and overall aggregates. The browser export stays outside the repository.

Current status is **instrumentation ready**, not **human gate passed**. No official human result is present in the repository. v6.2 must remain open until all eight uninterrupted official attempts end as completed or abandoned and every threshold is calculated from the safe export. If a threshold fails, the result must be reported honestly and v6.3 must target only the three most frequent confusion categories.

#### v6.2.1: Study Operations Guard

Before recruitment, the browser-local Recorder now derives one fixed P1–P2–O1–O8 sequence from existing safe run summaries. It renders protocol, cohort, and scenario as read-only slot metadata, validates the same slot again inside the hook, and closes after eight eligible official attempts. Pilot abandonment/interruption repeats its pilot; official abandonment consumes its slot; official interruption repeats with a same-cohort replacement. The analyzer separately verifies official order as well as 2 x 2 totals. This changes no stored study shape, Campaign path, API, runtime, tick, candidate, evidence, judgement, SQLite schema, or public artifact. Human status remains pending until the 12-person recruitment pool yields two completed pilots and eight eligible official attempts.

## Comparative Product Level After v6.2

The project is now strongest where many open-source simulation and mission games are weakest: deterministic fair-play investigation, source-backed evidence closure, reproducible cross-case world consequences, and public-safe audit. It has crossed from a collection of strong subsystems into a coherent three-case campaign architecture. It still trails mature games in authored volume, emotional presentation, visible social life, pacing evidence, and human-tested campaign comprehension.

| Dimension | Current level | Relative comparison | Main evidence | Remaining gap |
|---|---:|---|---|---|
| Detective logic and fairness | strong / near production architecture | stronger and more formal than general agent-town demos and most mission engines | truth ledger, route certificate, evidence coverage, deterministic judgement, unchanged finale certification | broader authored cases and external human fairness testing |
| Runtime determinism and audit | strong | stronger than typical content-heavy games; comparable to rules-first strategy tooling | stable seeds, snapshots, diffs, safe projections, invariant tests, full campaign API smoke | stop expanding evaluator surfaces; convert evidence into player-facing clarity |
| Living-world simulation | medium-strong, visibly improving | deeper state coupling and stricter audit than agent-town demos; still less conversationally expressive than AI Town and less expansive than systemic RPGs | NPC goals/actions, institutions, long actions, resources, opinion, evidence chain, relationships, directives, offers, pressure, deterministic named public reactions | reactions use bounded fixed families; authored faction/location texture and human pacing evidence remain limited |
| Player agency per case | medium-strong | meaningful bounded strategy without compromising truth; still less expressive than mature campaign games | Follow/Skip, Support/Contain/Defer, resource commitment, standing costs, offers, recovery, free non-finale selection | density and choice comprehension require human evidence |
| Cross-case campaign depth | strong architecture / medium-strong product | materially closer to a small Wesnoth-style scenario chain; far below Endless Sky's mission volume | explicit three-case session, transitions, fail-forward recovery, multi-route convergence, completed causal debrief | only one packaged length and one shared finale family; no production pacing evidence |
| Content scale | medium | above a narrow vertical slice, far below mature open-source games | 16 case types, 10 event archetypes, 8 progression lines, six authored contrasts | more locations, faction-specific reactions, bespoke transitions, and finale variants |
| Main-path UX | medium-strong architecture / medium product | has one primary campaign action and readable progress, but remains denser than polished games | Campaign Journey, Current world action, Guided route, Situation Brief, debrief | progressive disclosure, onboarding, feedback timing, accessibility, and playtest-driven editing |
| Failure and recovery | medium-strong | more explicit and auditable than many demos; less emotionally and narratively integrated than mature campaigns | FIFO recovery, bounded refunds/trust repair/reopen, certified-route return | recovery needs clearer fiction, previewed cost, and measured discoverability |
| Replay value | medium | strategy routes and authored contrast exist, but total content still limits novelty | three convergence approaches, consequence summaries, replay contrast, deterministic authored sequences | distinct finale contexts and campaign seeds need broader authored payoff |
| Static/public safety | strong | unusually strong for a local-first simulation project | zero `/api/*`, stripped internal state, forbidden scans, 390px gate | preserve as a release invariant; do not add more static proof panels |

Three reference projects remain useful, but they now highlight different gaps:

- [Endless Sky](https://github.com/endless-sky/endless-sky) remains the benchmark for mission volume, authored offer/accept/complete chains, and long-tail campaign discovery. Detective Town is stronger in formal evidence fairness and deterministic case audit, but nowhere near its content scale.
- [Battle for Wesnoth](https://github.com/wesnoth/wesnoth) remains the benchmark for legible scenario transitions, authored branching, difficulty communication, and campaign recovery. Detective Town now has a real campaign state machine and a more systemic town, but its transitions and emotional beats are less authored.
- [AI Town](https://github.com/a16z-infra/ai-town) remains the benchmark for visible agent social life and immediately readable autonomous behavior. Detective Town is much more constrained and auditable, but many of its strongest state changes are still summarized in panels rather than dramatized through characters.

The strategic conclusion after v6.2 instrumentation is that architecture is no longer the immediate uncertainty. The project can now gather privacy-safe evidence about whether people understand the current action, recover without prompting, explain the finale, and want to replay. The unknown is the result of the eight official sessions. Further runtime subsystems would have poor marginal value before that evidence exists.

## Forward Version Plan: v6.3+

Before v6.3 implementation, complete the fixed v6.2 matrix of eight official sessions. The gate requires median first meaningful action below 300 seconds; at least 7/8 sessions with no more than one main-objective misunderstanding and an overall mean no greater than one; at least 3/4 unprompted Recovery starts; at least 6/8 Campaign completions without moderator operation; at least 7/8 correct Finale explanations; and at least 4/8 different-route Replay intents. A failed metric keeps v6.2 open while still producing a truthful aggregate report.

### v6.3: Progressive Disclosure and Campaign Pacing

Goal: make the implemented architecture feel like play rather than an evaluator dashboard.

- Default-collapse proof, scorecard, and audit material until the player reaches Review Source or explicitly asks for detail. Keep Current world action, current certified case step, and immediate consequence above the fold.
- Add transition pacing states using the existing campaign summary: short case opening, one world consequence beat, one optional strategy decision, then the next case choice.
- Measure and cap simultaneous calls to action. Empty, blocked, and completed states must always provide one useful next action without exposing internal state.
- Exit gate: the 390px and desktop paths both complete without sideways scrolling, hidden primary controls, or requiring developer terminology.

### v6.4: Authored Consequence and Social Visibility Pass

Goal: make persistent state changes visible through people and places.

- Add backward-compatible content rows for faction-specific reactions, institution follow-up copy, location recovery/pressure beats, and witness availability context. Reuse existing runtime deltas and safe labels; do not create a dialogue authority or hidden-truth narration layer.
- Expand the v6.1 fixed reaction families with backward-compatible faction/location-specific texture only where playtests show repetition. Keep every label causal, low-spoiler, and backed by recorded state.
- Expand only where playtests show repetition. Prioritize distinct texture across the three packaged cases over raw row count.

### v6.5: Campaign Variety Without Fairness Drift

Goal: increase replay value while keeping one certified investigation authority.

- Author at least two additional three-case sequences and one additional finale context using the existing case, event, progression, recovery, and convergence grammar.
- Preserve shared fairness invariants: identical truth judgement rules, route certification, evidence coverage, legal action set, bounded influence budget, and safe public projection.
- Add deterministic campaign matrix tests across seeds and route choices. Compare candidate membership, completion reachability, consequence contrast, and debrief differentiation.

### v6.6: Operational and Release Readiness

Goal: turn the verified local product into a supportable release candidate without weakening privacy or determinism.

- Add concise failure diagnostics for local runtime loading, corrupted bounded state, and interrupted campaign resume. Prefer recovery and safe reset guidance over raw snapshots or absolute paths.
- Establish a release checklist that separates read-only validation from artifact refresh. Protected public catalogs may only change in an explicitly authorized artifact-release task.
- Run accessibility, keyboard, reduced-motion, localization-length, and slow-machine browser passes in addition to the current Static zero-API and 390px gates.
- A release candidate requires deterministic campaign completion, human comprehension targets, safe public scans, and documented rollback/recovery behavior. It does not require a new service, schema, endpoint, or background queue.

## Release Handoff Notes

Recommended future release scope for v6.0 or later:

- Include this report and any small documentation link updates.
- Include tracked public snapshots only when they were intentionally regenerated and passed stability validation.
- Exclude local data directories, generated package exports, build output, test artifacts, local handoff notes, and private environment files.

Recommended read-only final checks for a protected-artifact worktree:

```powershell
npm.cmd run qa:static-browser -- --json
npm.cmd run public-catalog:validate -- --json
```

`qa:release-local` is intentionally excluded when the task forbids refreshing `public/dataset-reader` or `public/review-catalog`, because that wrapper includes artifact-producing steps. Run it only in a separately authorized artifact-release task.

The final report should be treated as strategy and release handoff documentation. It does not change runtime authority, simulation rules, storage schema, public artifact contents, or deployment behavior.
