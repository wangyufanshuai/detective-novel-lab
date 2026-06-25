# Changelog

## Unreleased

### Added

- Added the `greenhouse-blade` premium hard case to expand the built-in Case Library.
- Added a browser-only Local Case Gallery for Authoring mode with built-in template cards, local draft saves, JSON bundle import/export, and Static Demo launch for valid drafts.
- Added SQLite storage health reporting, transactional world/case/event saves, and a local backup script for Docker Server Runtime.
- Added a deeper Persistent Agent Town simulation loop with staged tick phases, expanded NPC actions, memory propagation, pressure ledger entries, action consequences, and candidate chain stages.
- Added a deterministic Town Situation Brief with ranked hot locations, high-risk NPCs, observation mix, and case-readiness guidance for operators and external agents.
- Added a one-click Living World Lab sample project with five analyzed chapters, evidence indexes, a ready batch queue, and a grounded replay.
- Added a SQLite-backed Living World Lab Project Library with explicit save, open, save-copy, conflict detection, backup coverage, and cross-restart restoration.
- Added a durable canonical entity identity registry, pending identity review, and baseline-linked novel replay branches with actor and causal state diffs.
- Added Playable Case Intake for emerged Persistent Agent Town candidates, including low-spoiler route tasks, source counts, witness challenge planning, and source-backed investigation entry.
- Added a deterministic Truth Ledger for emerged cases, with proof obligations, player coverage, gap mapping, and a read-only `/api/v1/query/case/proof-ledger` endpoint.
- Added a Route Certificate that proves a case can be completed through search, witness questioning, testimony challenge, evidence selection, and accepted theory submission.

### Changed

- Docker Server smoke now validates runtime storage health, premium case creation, and Scenario Runner execution.
- Productized Living World Lab with chapter queue summaries, merged-graph progress, Audit Studio flow steps, and replay provenance counts for source, inferred, counterfactual, and gap steps.
- Novel replay now accumulates evidence-backed knowledge and owned resources checkpoint by checkpoint; identity or correction changes mark older replays stale instead of silently continuing on mismatched state.
- Polished Persistent Agent Town's Agent panel into a compact Review Mode for technical evaluation.
- Scenario Runner now surfaces checks, branch comparison, and copyable report JSON in the workbench.
- Time Machine now shows a snapshot timeline, expanded diff details, baseline quick selection, and rollback confirmation.
- Benchmark Dashboard now has clearer pass/fail/unavailable states.
- Emerged case extraction can now return a spoiler-safe `playableIntake`, and `GET /api/v1/query/case` can include it with `includeIntake=true`.
- Playable Case Intake now includes route integrity, player progress, next action, and pre-persistence blocking for candidates that cannot support a complete search -> witness -> challenge -> theory loop.
- Playable Case Intake, wrong-theory gap cards, route integrity, and judgement feedback now derive from Truth Ledger proof coverage instead of separate lightweight stage heuristics.
- Emerged case extraction now requires a passing Route Certificate before persistence, and Proof Ledger can reveal the full certified route after a correct solution.

## v0.1.0 - 2026-06-11

First public release candidate for Detective Town / Living World Lab.

### Added

- Scenario Runner for deterministic baseline and counterfactual town experiments.
- World State Time Machine with snapshots, diffs, and rollback for persistent town runtime state.
- Stable `/api/v1/*` Agent API coverage for town runtime, scenarios, snapshots, benchmark visibility, and Living World correction loops.
- Zero-dependency Node examples for external agents.
- Benchmark Dashboard for emergence benchmark summaries.
- Static Demo / Server Runtime / Agent API onboarding flow in the README.
- Docker Smoke and expanded GitHub Actions CI.

### Release Notes

- Static Demo is designed for public Vercel deployment with no API key and no writable SQLite directory.
- Server Runtime remains local/Docker-first and powers SQLite-backed Agent API features.
- DeepSeek remains optional surface language support; local TypeScript rules decide culprit, evidence validity, fairness, and player judgement.

### Known Limits

- No hosted Server Runtime is included in v0.1.0.
- The SDK is a repo-local starter, not an npm package.
- Multiplayer, accounts, and long-running hosted runtime operations are outside this release.
