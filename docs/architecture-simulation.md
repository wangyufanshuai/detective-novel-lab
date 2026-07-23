# Simulation Architecture

Detective Novel Lab is a rules-first detective world simulator. The local TypeScript runtime owns culprit selection, method, evidence, timeline, case validation, graph construction, and replay audit. DeepSeek or another compatible LLM may supply NPC surface dialogue or optional prose, but it does not decide case truth or whether a theory is accepted.

## Reproducible Review Pipeline

The current Review Mode pipeline is:

```text
Experiment Folder
  or WorldPackage
  -> ScenarioPack / TownMapPack / TownRuleCatalog
  -> optional AgentPack / EcosystemCatalog
  -> branch world
  -> RunJob
  -> RunCatalog
  -> ReplayBundle / ReviewBundle
  -> data/replay-store/<runId>/
  -> data/replay-store/index.json
  -> SQLite replay catalog
  -> Package Catalog for reusable local sources
```

An experiment-backed scenario pack is selected as a complete folder source. Scenario, map, and rule catalog are bound atomically so a run cannot accidentally mix a folder scenario with a built-in map or catalog.

v2.7 adds `world-packs/<id>/` as a GOD-style local drop-folder package. A WorldPackage binds `scenario-pack.json`, `map-pack.json`, `rule-catalog.json`, `agent-pack.json`, `ecosystem-catalog.json`, expectations, README, and optional attribution into one selectable source. Sync discovers `experiments/` and `world-packs/`, validates hashes/license/attribution/safety, writes `data/package-catalog/index.json`, and mirrors metadata into SQLite as a rebuildable local query cache.

v2.8 adds a local setup/export path around the same package contract. Review Mode can sync, validate, select, and export a WorldPackage without adding a new page. `npm run package:export -- --package=<id>` and `POST /api/v1/command/town/world-pack/export` write metadata-only local exports under `outputs/world-package-exports/<id>/`. The folder export is intentionally simple: it copies the package source files and adds a hash/validation report. Zip export remains a later option unless an existing dependency can support it without adding a new framework.

v3.0 raises the campaign quality gate from the 1000 tick daily baseline to a 5000 tick long-run gate. This is a simulation and artifact-quality gate, not a product-surface expansion: it requires at least 30 unique cases, at least 10 case types, candidate repeat rate <= 15%, later-case influence >= 70%, evidence graph warnings == 0, runtime under 300000 ms, and a clean replay audit.

v3.1 adds a local dataset package handoff for that gate. `npm run dataset:export -- --run=campaign-campaign-validation-5000` writes `outputs/dataset-packages/detective-town-v3-5000-campaign/` with replay/package index snapshots, sanitized run metadata, local world package source copies, checksums, a dataset card, and an audit report. The replay-store files remain the source of truth; SQLite remains a rebuildable query cache; the dataset package is a copied offline review artifact.

v3.2 hardens the Node-only boundary for local discovery/export adapters. Package, experiment, and dataset directory reads are constrained to explicit workspace subtrees (`experiments/`, `world-packs/`, `data/*`, and `outputs/*`), so build-time tracing does not treat the full project as package input.

v3.3 adds an offline reader index inside the dataset package. `reader-index.json` summarizes the selected 5000 tick campaign gate, audit state, case/evidence graph totals, distributions, copied world packages, and file metadata. It is aggregate metadata only; raw package text, hidden truth fields, runtime checkpoints, agent state, API keys, absolute paths, and SQLite data remain outside the reader path.

## Runtime Responsibilities

- **Experiment Folder**: local multi-file source under `experiments/<id>/`, including manifest, steps, scenario pack, map pack, rule catalog, expectations, and notes.
- **ScenarioPack / TownMapPack / TownRuleCatalog**: portable JSON inputs for the branch world. Validation rejects absolute paths, runtime-only state, hidden debug logs, and secret-looking fields.
- **Branch World**: isolated runtime fork used for scenario runs and review jobs. The source world keeps current experiment selection; the branch world receives the runnable copy.
- **RunJob**: cooperative queued work record. Scenario jobs run the selected scenario; benchmark jobs process seed batches while exposing progress.
- **RunCatalog**: comparable run rows merged from live runtime history and local replay-store artifact manifests.
- **ReplayBundle / ReviewBundle**: portable reviewer outputs. Replay bundles are for deterministic replay inspection; review bundles are lower-spoiler reviewer artifacts.
- **Replay Store**: local artifact directory under `data/replay-store/<runId>/`.
- **Replay Dataset Index**: generated local catalog at `data/replay-store/index.json`, built by `npm run replay:audit`.
- **SQLite Replay Catalog**: local query cache populated by `npm run replay:sync` and Review Mode sync. It stores run/file metadata, hashes, metrics, and audit summaries, but not artifact body text.
- **Package Catalog**: local query cache populated by `npm run package:sync` and Review Mode sync. It stores package metadata, content hashes, validation summaries, license/attribution, and pack bindings only.
- **Package Export**: local folder artifact under `outputs/world-package-exports/<packageId>/` containing the package source files, validation report, hash report, and optional attribution. It excludes replay artifacts, SQLite data, runtime snapshots, hidden truth, absolute paths, and secrets.
- **Dataset Package**: local folder artifact under `outputs/dataset-packages/<datasetId>/` containing catalog snapshots, sanitized selected-run metadata, world package source copies, checksums, and a dataset card. It is meant for offline reader handoff, not as a new runtime authority.
- **Dataset Reader Index**: generated `reader-index.json` inside a dataset package. It lets a reviewer inspect the campaign gate and graph/distribution summary without the dev server, SQLite, or the original replay-store directory.
- **AgentPack**: public resident configuration for identities, profession, schedule, relationships, resource needs, visible motives, and public clue hooks. It does not contain culprit truth, runtime snapshots, or checkpoints.
- **EcosystemCatalog**: table-driven detective-town ecology: factions, resources, markets, territories, task templates, random world events, and pressure rules. It influences case type distribution, evidence type distribution, long-action success, cross-case edges, and evidence completeness.

## Graphs And Quality

Case Graph and Evidence Graph are audit outputs, not narrative decoration.

- **Case Graph** records resolved/forming cases, cross-case edges, institution pressure, shared NPC/location links, resource deltas, aftermath, public opinion, and evidence contamination influence.
- **Evidence Graph** records evidence nodes, source events, handlers, action links, contamination/publication/tamper edges, and whether each resolved case has complete evidence use.
- **Experiment Matrix** runs selected experiment folders across seeds and ablation variants, then compares baseline quality gates and relative metric deltas.
- **Catalog Expansion Benchmark** runs baseline plus `no-court`, `no-dock-union`, `no-medical-chain`, and `no-informant-network` catalog variants to prove v2.5 rule additions affect measurable distribution metrics without slowing the default Experiment Matrix.
- **Ecosystem Ablation Benchmark** runs baseline plus `no-dock-economy`, `no-court-pressure`, `no-medical-record-chain`, and `no-family-obligation` variants to prove v2.7 table-driven ecology changes measurable simulation outcomes.
- **Replay Audit** verifies artifact integrity, JSON parseability, sha256 hashes, graph consistency, and secret/hidden-truth safety.
- **5000 Tick Campaign Gate** proves the same campaign path can sustain longer runs with enough case volume, type diversity, prior-case influence, complete evidence graph use, and bounded runtime.

## v2.5 Rule Catalog Scope

The default TownRuleCatalog now covers the old six institutions plus `court` and `dock_union`, while keeping the historical `commerce`, `civic`, `medical`, `reporter`, and `dockworker` kinds for compatibility. It expands long actions to court inquests, dock cargo tracing, medical opinion chains, evidence custody, family councils, editor pressure, and informant handling.

The simulation still owns case type and evidence selection. New case types such as `dock-smuggling`, `forged-will`, `court-intimidation`, `blackmail`, and `witness-disappearance` are inferred from evidence kinds, institution pressure, public opinion, and lifecycle weights. LLM output does not decide these facts.

## v2.7 Package And Ecosystem Scope

The package flow borrows the shape of local setup/catalog systems: drop a folder, validate it, hash it, sync metadata, select it, and start a run. It does not copy external story text, CSV rows, icons, music, maps, or assets. The cultivation-style influence is structural: table-driven factions/resources/markets/tasks/events are rewritten as detective-town concepts such as dock cargo, court influence, hospital records, merchant debt, family obligation, press pressure, and police capacity.

WorldPackage selection is atomic. Selecting a package-backed ScenarioPack binds the package MapPack, RuleCatalog, AgentPack, and EcosystemCatalog together before creating a branch world. The LLM still has no authority over culprit, method, evidence, timeline, case graph, evidence graph, package validation, or audit status.

## Safety Boundary

Artifacts and indexes must not export:

- API keys, bearer tokens, `.env.local` contents, or local credentials.
- Absolute local filesystem paths.
- Runtime checkpoints, `agent_state_snapshot`, or hidden debug logs.
- `truth.culpritId` or hidden conclusion fields before the relevant solved/export surface has unlocked them.

The generated replay index stores relative artifact paths, bytes, sha256 hashes, normalized metadata, inferred metrics, and audit findings. v2.6 mirrors that metadata into SQLite as a rebuildable local query index. The replay-store files remain the source of truth; SQLite must not contain API keys, absolute paths, runtime checkpoints, agent snapshots, hidden truth, or artifact body text.

The package index stores relative package paths, metadata, hashes, validation summaries, license/attribution text labels, and pack ids. It does not store package body text in SQLite and must not contain API keys, absolute paths, runtime checkpoints, agent state snapshots, or hidden truth.

Package export follows the same boundary. Export responses return only metadata: package id, relative export path, content hash, validation summary, file count, bytes, and per-file hashes. They do not return package body text or absolute paths. Exported folders should validate with `npm run package:validate -- --path=outputs/world-package-exports/<id>`.

v2.9 hardens the file-system boundary. Pure WorldPackage validation is safe for route-level body validation; package discovery, sync, and export remain Node-only adapters that read only `experiments/`, `world-packs/`, and `outputs/world-package-exports/`. The export report uses `reportIncluded: false`, so `fileCount`, `bytes`, and `files[]` describe package source files only while `package-export-report.json` is generated beside them for audit.

v3.0 campaign artifacts keep the same boundary. The new 5000 tick run writes summary metrics plus relative file hashes into its manifest, then relies on `replay:audit` and `replay:sync` for catalog visibility. It does not grant the LLM new authority, add new API routes, create new SQLite tables, or move artifact truth into SQLite.

v3.1 dataset exports keep hidden truth out of the portable package by sanitizing run metadata copies. API routes for dataset packages return only metadata, relative paths, gate summaries, hashes, file counts, and audit counts; they do not return package body text or SQLite data.

v3.2 keeps generated files out of the source contract. `data/replay-store/index.json`, `data/package-catalog/index.json`, SQLite cache rows, `outputs/world-package-exports/`, and `outputs/dataset-packages/` are rebuildable local artifacts; source truth remains the TypeScript rules plus local package/replay folders.

## Current Non-Goals

v3.0 does not add background queues, remote services, new LLM authority, new package managers, new HTTP routes, new pages, or new SQLite authority. The HTTP routes and Review Mode controls remain limited to local replay/package catalog sync/query/select/validate/export; simulation truth remains inside the local TypeScript rules.
