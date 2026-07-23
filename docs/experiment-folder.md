# Experiment Folder

Experiment folders make Review Mode reproducible without adding a new database or HTTP surface. A folder under `experiments/<id>/` is a complete local run source: scenario pack, map pack, rule catalog, expectations, steps, and human notes live together and are validated before use.

v2.7 keeps experiment folders compatible and adds `world-packs/<id>/` for reusable local packages. Experiment folders are still the focused benchmark/review unit. World packages are the broader setup/catalog unit for selecting a scenario, map, rules, agents, and ecosystem as one package.

## Required Files

```text
experiments/<experiment-id>/
  manifest.json
  steps.json
  scenario-pack.json
  map-pack.json
  rule-catalog.json
  expectations.json
  README.md
```

- `manifest.json`: experiment id, version, hashes, and descriptive metadata.
- `steps.json`: deterministic run steps and reviewer path.
- `scenario-pack.json`: portable `ScenarioPack`.
- `map-pack.json`: portable `TownMapPack`.
- `rule-catalog.json`: portable `TownRuleCatalog`.
- `expectations.json`: quality gates and benchmark expectations.
- `README.md`: human-facing explanation.

Selecting an experiment-backed scenario pack atomically binds the scenario, map, and rule catalog from the same folder. This avoids mixing a folder scenario with a built-in map or catalog. The selected experiment id and hash are carried into branch worlds, run catalog rows, replay bundles, and artifact manifests when available.

v2.5 adds two rule-expansion experiment folders:

- `court-dock-conspiracy`: court docket, dock union, cargo records, and informant tips.
- `medical-inquest-chain`: medical evidence, inquest pressure, autopsy notes, and chain of custody.

These folders prove that expanded catalog content can be selected through the same experiment-backed ScenarioPack path as older folders. Old experiment catalogs are still valid; they are not required to include v2.5 institutions, resources, long actions, or evidence rules.

## World Package Files

```text
world-packs/<package-id>/
  manifest.json
  scenario-pack.json
  map-pack.json
  rule-catalog.json
  agent-pack.json
  ecosystem-catalog.json
  expectations.json
  README.md
  ATTRIBUTION.md      # optional
  assets/             # optional, validated later before public packaging
```

- `agent-pack.json`: public resident identities, professions, schedules, relationships, resource needs, visible motives, and public clue hooks.
- `ecosystem-catalog.json`: table-driven factions, resources, markets, territories, task templates, random world events, and pressure rules.
- `ATTRIBUTION.md`: optional local attribution note when a package includes license-sensitive inspiration or assets.

Selecting a world-package-backed ScenarioPack atomically binds the package MapPack, RuleCatalog, AgentPack, and EcosystemCatalog. The package flow is a local catalog/setup path, not a remote marketplace and not a new source of hidden truth.

## Write Your Own World Pack

Start with the required tree above and keep every file portable. Package ids should be lowercase, dash-separated, and safe as folder names. The manifest should name the package, version, source, license label, and bound pack ids. The scenario, map, rules, agents, and ecosystem should be authored as public setup data; do not put culprit truth, runtime checkpoints, agent state snapshots, hidden debug logs, local absolute paths, or API-key-like fields in the package.

Recommended local loop:

```powershell
npm run package:validate -- --package=<package-id>
npm run package:sync -- --json
npm run package:export -- --package=<package-id>
npm run package:validate -- --path=outputs/world-package-exports/<package-id>
```

Review Mode follows the same loop through the World Packages panel: sync packages, inspect validation and bindings, select a package, start a new run from the selected pack, inspect the Run Catalog and graph summary, then export ReviewBundle or ReplayBundle.

## Artifact Contract

Experiment-backed runs write artifacts under `data/replay-store/<runId>/`. Expected files include:

- `manifest.json`
- `scenario-pack.json`
- `map-pack.json`
- `rule-catalog.json`
- `experiment-manifest.json`
- `steps.json`
- `catalog-validation.json`
- `quality-report.json`
- `replay-bundle.json`
- `review-bundle.json`
- optional `case-graph.json` and `evidence-graph.json`

Artifacts use relative file paths only. They must not contain API keys, `.env.local` contents, runtime checkpoints, `agent_state_snapshot`, hidden debug logs, or hidden truth fields intended only for solved cases.

Scenario, benchmark, campaign, simulation-quality, and experiment-matrix artifacts all participate in the replay audit. Older CLI artifacts can have smaller manifests than API-written scenario artifacts; they are normalized in the generated index instead of being rewritten in place.
Catalog expansion and ecosystem ablation benchmark artifacts also participate in the replay audit. They record focused ablations without rewriting old experiment manifests.

## Replay Dataset Index

Run:

```powershell
npm run replay:audit
npm run replay:sync
```

The command scans `data/replay-store/<runId>/`, validates artifact integrity, and writes `data/replay-store/index.json`. The index records run kind, status, seed/tick metadata, quality score, deterministic hash, normalized metrics, file bytes, and sha256 hashes. Legacy campaign, simulation-quality, and experiment-matrix manifests are normalized in the index; their original `manifest.json` files are not rewritten.

`npm run replay:sync` keeps the replay-store files as the source of truth, then mirrors index metadata into the local SQLite replay catalog. SQLite stores queryable run/file metadata, hashes, metrics, and audit summaries only; it does not store artifact bodies, absolute paths, runtime checkpoints, API keys, or hidden truth.

`data/replay-store/index.json` and the SQLite catalog rows are generated local data under the ignored `data/` directory. They are useful for local audit, Review Mode inspection, dataset inspection, and future public replay export, but they are not source-controlled release artifacts by default.

## Package Catalog

Run:

```powershell
npm run package:validate
npm run package:sync
```

Package sync scans `experiments/` and `world-packs/`, validates required files, parses JSON, checks relative paths, rejects secret-looking fields and hidden truth fields, computes content hashes, writes `data/package-catalog/index.json`, and mirrors metadata into SQLite. Legacy experiment manifests are not rewritten; missing newer optional fields are normalized in the generated package index when safe.

SQLite stores package ids, kind, source, version, content hash, path hash, validation summary, metrics, license/attribution labels, and bound pack ids. It does not store package body text, artifact body text, absolute paths, runtime checkpoints, agent state snapshots, API keys, or hidden truth.

v2.9 keeps package discovery/export as a Node-only adapter. Route body validation can validate uploaded package files without scanning the filesystem; package id validation, sync, and export are limited to local workspace folders. The package validator treats `project-local*` licenses as local originals; other licenses remain usable but warn when `ATTRIBUTION.md` is missing.

v3.2 keeps the same contract but makes the filesystem boundary explicit for build and runtime. Package sync reads only `experiments/` and `world-packs/`; package export writes only under `outputs/world-package-exports/`; package catalog indexes and SQLite rows are generated local metadata, not source package content.

## Package Export Contract

Run:

```powershell
npm run package:export -- --package=<package-id>
```

The command writes a local folder export under `outputs/world-package-exports/<package-id>/`. The export includes the package source files, `README.md`, optional `ATTRIBUTION.md`, and a generated `package-export-report.json` with relative file paths, bytes, sha256 hashes, validation summary, and content hash. `package-export-report.json` uses `reportIncluded: false`, so `fileCount`, `bytes`, and `files[]` describe only the package source contract and exported-folder validation ignores the generated report file.

Exports exclude replay-store artifacts, package catalog indexes, SQLite files, runtime checkpoints, agent state snapshots, hidden truth, absolute local paths, and secret-looking content.

The export is still local generated data. It is meant for setup review, handoff, and later packaging; it is not a remote catalog upload and does not rewrite the source world pack.
