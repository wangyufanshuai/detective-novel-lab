# Dataset Package

The dataset package is a local, copyable handoff artifact for the v3 5000 tick campaign gate. It is generated from existing replay and package catalogs; it is not a new source of truth.

## Commands

```powershell
npm run replay:audit
npm run package:sync -- --json
npm run benchmark:campaign -- --ticks=5000
npm run dataset:export -- --run=campaign-campaign-validation-5000
npm run dataset:validate -- --path=outputs/dataset-packages/detective-town-v3-5000-campaign
npm run dataset:smoke -- --path=outputs/dataset-packages/detective-town-v3-5000-campaign
npm run dataset:reader -- --path=outputs/dataset-packages/detective-town-v3-5000-campaign
npm run dataset:static-reader -- --path=outputs/dataset-packages/detective-town-v3-5000-campaign
npm run dataset:reader -- --path=public/dataset-reader/detective-town-v3-5000-campaign
npm run content:validate
npm run public-catalog:build
npm run public-catalog:validate
```

## Folder Contract

`outputs/dataset-packages/<datasetId>/` contains:

- `dataset-manifest.json`: schema, source run, gate summary, audit summary, content hash, file list.
- `dataset-card.md`: human-readable offline review card.
- `reader-index.json`: aggregate offline reader index for the selected run.
- `replay-index.snapshot.json`: replay dataset index snapshot.
- `package-index.snapshot.json`: package catalog index snapshot.
- `audit-report.json`: replay audit report snapshot.
- `runs/<runId>/`: sanitized selected-run metadata mirror.
- `world-packs/<packageId>/`: local project world package source copies.
- `checksums.sha256`: per-file checksums.

`public/dataset-reader/<datasetId>/` is the v3.4 tracked static reader release snapshot for public review. It contains only:

- `reader-index.json`: aggregate reader metadata copied from the validated dataset package.
- `case-summary-index.json`: spoiler-safe public case cards derived from the validated case/evidence graphs.
- `dataset-card.md`: public-safe reader card generated from aggregate metadata.
- `manifest-lite.json`: dataset id, source run, hashes, file count, bytes, gate summary, audit summary, and reader summary.

`public/review-catalog/` is the v3.6 tracked public catalog release snapshot. It contains only:

- `index.json`: static public index derived from verified dataset-reader manifests and reader indexes.
- `catalog-card.md`: public-safe catalog summary for human review.

## Safety Boundary

Dataset packages must not include API keys, `.env.local`, absolute local paths, SQLite database files, runtime checkpoints, agent state snapshots, hidden debug logs, `truth`, or `culpritId`. Source replay artifacts are not rewritten; the dataset export sanitizes its copied run metadata.

v3.2 keeps dataset package operations as Node-only local adapters. Export and validation are constrained to `data/replay-store/`, `data/package-catalog/`, local `world-packs/`, and `outputs/dataset-packages/`; generated package folders and catalog snapshots are rebuildable handoff artifacts, not new runtime authorities.

v3.3 adds `reader-index.json` for offline review. It contains gate status, audit counts, case/evidence graph summaries, case type and evidence type distributions, copied world package summaries, and file metadata. It does not contain raw package body text, raw case graph nodes, hidden truth fields, checkpoints, agent state, API keys, or absolute paths.

v3.4 adds a public static reader bundle under `public/dataset-reader/<datasetId>/`. In v4.2 the static bundle is generated from a validated full dataset package and contains only `reader-index.json`, `case-summary-index.json`, `dataset-card.md`, and `manifest-lite.json`. It does not copy replay artifacts, copied world-pack source bodies, SQLite data, local catalog snapshots, private case bodies, API keys, or absolute paths. The full dataset package remains the local handoff artifact; the static reader bundle is only the tracked public review snapshot for `?runtime=static`.

v3.6 adds `public/review-catalog/` as a public index shell over the static reader bundle. In v4.2 it is generated only from `public/dataset-reader/<datasetId>/manifest-lite.json`, `reader-index.json`, and `case-summary-index.json`; it does not read `data/`, `outputs/`, SQLite, server APIs, replay bodies, or package source bodies. The public catalog is a tracked public release snapshot, not a new runtime authority.

v3.8 adds aggregate detective content table summaries to the public catalog. The source tables live under `content/detective-v1/` and are validated by `npm run content:validate`; only counts and coverage metadata are copied into `public/review-catalog/index.json`. The public catalog still does not copy raw content rows or become a runtime authority.

v4.2 adds `case-summary-index.json` for spoiler-safe public case navigation. Each public case card contains a public case id, source case hash, ordinal, tick, case type, outcome, location id, institution count, evidence count, warning count, completion flag, influence edge counts, and edge type counts. It does not include raw case ids, person ids, evidence ids, aftermath ids, edge sources, edge explanations, raw graph bodies, replay bodies, or package bodies.

## Reader Path

Offline: open `dataset-card.md`, then inspect `reader-index.json`, then verify `checksums.sha256`. The `dataset:reader` command prints the same aggregate summary without requiring the dev server, SQLite, `data/replay-store/`, or `data/package-catalog/`.

For public static review, run `dataset:static-reader` after validating the full package, then run `public-catalog:build` and open `/?runtime=static`. The **Public Catalog** panel fetches `/review-catalog/index.json`; the **Dataset Reader** panel fetches only `/dataset-reader/<datasetId>/manifest-lite.json`, `/dataset-reader/<datasetId>/reader-index.json`, and `/dataset-reader/<datasetId>/case-summary-index.json`. Static review must not call `/api/*`. `dataset:reader -- --path=public/dataset-reader/<datasetId>` validates and summarizes the static bundle without using the original dataset package directory. `qa:release-local` repeats static reader and catalog generation and verifies the tracked public snapshots do not change when inputs are unchanged.

In Review Mode, choose the persistent town workspace and inspect the **Dataset Package** panel. It shows the latest package, 5000 tick gate metrics, audit status, file count, bytes, content hash, reader summary, and an **Export Dataset** action. The panel is metadata-only and does not expose package body text.
