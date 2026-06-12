# Changelog

## Unreleased

### Added

- Added the `greenhouse-blade` premium hard case to expand the built-in Case Library.
- Added a browser-only Local Case Gallery for Authoring mode with built-in template cards, local draft saves, JSON bundle import/export, and Static Demo launch for valid drafts.
- Added SQLite storage health reporting, transactional world/case/event saves, and a local backup script for Docker Server Runtime.

### Changed

- Docker Server smoke now validates runtime storage health, premium case creation, and Scenario Runner execution.
- Polished Persistent Agent Town's Agent panel into a compact Review Mode for technical evaluation.
- Scenario Runner now surfaces checks, branch comparison, and copyable report JSON in the workbench.
- Time Machine now shows a snapshot timeline, expanded diff details, baseline quick selection, and rollback confirmation.
- Benchmark Dashboard now has clearer pass/fail/unavailable states.

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
