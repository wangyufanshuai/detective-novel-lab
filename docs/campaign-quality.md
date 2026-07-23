# Campaign Quality

Campaign quality gates prove that the town simulation can run as a reproducible multi-case world rather than a prompt-first mystery generator.

## Core Commands

```powershell
npm run test:long-run
npm run test:simulation-quality
npm run benchmark:catalog-expansion
npm run benchmark:ecosystem-ablation
npm run benchmark:stable-world
npm run benchmark:campaign -- --ticks=1000
npm run benchmark:campaign -- --ticks=5000
npm run dataset:export -- --run=campaign-campaign-validation-5000
npm run dataset:validate -- --path=outputs/dataset-packages/detective-town-v3-5000-campaign
npm run dataset:smoke -- --path=outputs/dataset-packages/detective-town-v3-5000-campaign
npm run dataset:reader -- --path=outputs/dataset-packages/detective-town-v3-5000-campaign
npm run dataset:static-reader -- --path=outputs/dataset-packages/detective-town-v3-5000-campaign
npm run dataset:reader -- --path=public/dataset-reader/detective-town-v3-5000-campaign
npm run benchmark:experiment-matrix
npm run replay:audit
npm run replay:sync
npm run package:validate
npm run package:sync
npm run package:export -- --package=dock-court-market-town
npm run package:export -- --package=hospital-family-press-town
npm run package:export -- --package=city-hall-merchant-debt-town
```

`benchmark:campaign` writes a campaign artifact to `data/replay-store/<runId>/`. The 1000 tick run is the v5.0 single-seed Stable Detective World gate; `benchmark:stable-world` is the v5.1 three-seed stable world gate, the v5.2 stable-world diagnostics surface, the v5.3 local regression dashboard, the v5.4 public-safe reviewer summary source, the v5.5 static drilldown source, and the v5.6 non-blocking case-quality source. The 5000 tick run is the v3.0 campaign quality gate. v5.6 keeps 1000 ticks as the maximum validation budget per seed: action selection, candidate maturity ordering, institution pressure, evidence contamination, cross-case influence, deterministic world stability, and aggregate case quality must hold across `campaign-validation`, `stable-town-a`, and `stable-town-b` without regenerating public dataset snapshots. The stable-world run writes local `diagnostics-report.json`, `diagnostics-report.md`, `regression-report.json`, `regression-report.md`, `case-quality-report.json`, and `case-quality-report.md` alongside the quality report; `public-catalog:build` derives sanitized `public/review-catalog/stable-world-summary.json` and `public/review-catalog/case-quality-summary.json` from local aggregate reports. The public summaries contain seed labels, deterministic hashes, aggregate gate metrics, diagnostics counts, regression delta counts, case-quality scores, dimension scores, status counts, and source artifact file hashes; they do not publish full benchmark bodies. `benchmark:catalog-expansion` runs focused v2.5 catalog ablations and writes a catalog-expansion artifact. `benchmark:ecosystem-ablation` runs v2.7 table-driven ecology ablations and writes an ecosystem-ablation artifact. `benchmark:experiment-matrix` runs multiple experiment folders, seeds, and ablation variants, then writes an experiment-matrix artifact. `replay:audit` indexes these artifact types into `data/replay-store/index.json`; `replay:sync` mirrors the index into SQLite for local filtering and Review Mode inspection.
`package:validate`, `package:sync`, and `package:export` validate the v2.8 setup/export path. Exported world packages should validate again with `npm run package:validate -- --path=outputs/world-package-exports/<id>` before handoff.
`dataset:export`, `dataset:validate`, `dataset:smoke`, and `dataset:reader` validate the v3 public-style local handoff package for the 5000 tick campaign. The package snapshots replay/package indexes, copies local world package sources, writes sanitized run metadata plus checksums, and includes a v3.3 `reader-index.json` for offline aggregate review.
`dataset:static-reader` validates the full dataset package and writes the public v3.4 reader bundle to `public/dataset-reader/<datasetId>/`. The bundle is aggregate metadata only for `?runtime=static`; it contains no replay artifact bodies, SQLite data, world-pack source bodies, hidden fields, API keys, or absolute paths.
v2.9 fixes this as the engineering baseline for v3.0: package discovery/export stays Node-only, export metadata is relative-path only, generated reports are not counted as package source files, and SQLite remains a rebuildable metadata cache.

## Current Gates

- 100 tick smoke: at least 3 cases and deterministic hash stability.
- 500 tick campaign: at least 5 cases, candidate diversity >= 70, repeat rate <= 20%, evidence graph warnings == 0, runtime target under 30 seconds.
- 1000 tick campaign: at least 8 unique cases, at least 4 case types, candidate repeat rate <= 20%, case graph nodes match case count, later-case influence >= 60%, evidence graph warnings == 0, selected action kinds >= 6, largest selected action share <= 55%, institution decisions >= 4, deterministic hash stable for the same seed, runtime target under 90 seconds.
- Multi-seed Stable World: three fixed 1000 tick seeds must all pass the 1000 tick campaign gate, and the aggregate report must show worst/lowest stability metrics plus deterministic hashes for each seed.
- Stable World Diagnostics: the same multi-seed run must write local diagnostics with fixed dimensions for action mix, actor spread, candidate maturity, case diversity, institution influence, evidence closure, cross-case influence, performance, and determinism.
- Stable World Regression: the same multi-seed run compares the current report with the previous local stable-world artifact before overwrite, then writes per-seed current-vs-previous deltas.
- Stable World Public Summary: `public-catalog:build` must produce `public/review-catalog/stable-world-summary.json` with schema `public-stable-world-summary.v1`, three seeds, 1000 ticks, all seeds passing, zero diagnostic blockers, zero blocked/regressed regression deltas, and no local paths or raw body fields.
- Stable World Reviewer Drilldown: Static Reviewer Home must reuse the v5.4 public summary to show aggregate-only per-seed pass cards, runtime bands, diagnostics finding counts, regression delta counts, and deterministic hash comparison without adding raw case or replay bodies.
- Case Quality Public Summary: `public-catalog:build` must produce `public/review-catalog/case-quality-summary.json` with schema `public-case-quality-summary.v1`, non-blocking status, aggregate quality scores, fixed dimension scores, seed labels, deterministic hashes, artifact file hashes, and no local paths or raw body fields.
- 5000 tick campaign: at least 30 unique cases, at least 10 case types, candidate repeat rate <= 15%, case graph nodes match case count, later-case influence >= 70%, evidence graph warnings == 0, runtime target under 300000 ms.
- Catalog Expansion: default 100 ticks across 3 seeds for baseline, `no-court`, `no-dock-union`, `no-medical-chain`, and `no-informant-network`; each ablation must change at least 3 catalog metrics by 20% or more. Heavier local checks can pass `--ticks=200` or `--ticks=500`.
- Ecosystem Ablation: default 100 ticks across 3 seeds for baseline, `no-dock-economy`, `no-court-pressure`, `no-medical-record-chain`, and `no-family-obligation`; each ablation must change at least 3 ecosystem metrics by 20% or more. Heavier local checks can pass `--ticks=200` or `--ticks=500`.
- Package Export: each valid world pack can be exported as a local folder, and the exported folder validates with the same package validator. Export metadata must use relative paths and must not include package body text in API responses.
- Experiment Matrix: each selected experiment and seed runs baseline plus ablations; variants must produce at least the configured relative metric change threshold, default 20%.
- Dataset Package: the selected 5000 tick campaign can be exported, validated, and smoke-read offline from `outputs/dataset-packages/detective-town-v3-5000-campaign` without SQLite or the original replay-store directory.
- Dataset Reader: `reader-index.json` can be read offline and matches the manifest gate, audit summary, case/evidence distributions, graph summaries, and copied world package summary.
- Static Dataset Reader: `public/dataset-reader/detective-town-v3-5000-campaign` contains only `reader-index.json`, `dataset-card.md`, and `manifest-lite.json`; `?runtime=static` can render its summary without `/api/*`.
- v4.8 Rule Behavior Pass: the core Persistent Agent Town simulator should keep 1000 tick campaign gates green while reducing mechanical action rotation, prioritizing complete fair-play candidate chains, and making court/dock/medical/informant institution pressure visible in influence traces. It does not change public artifact schemas or require a 5000/10000 tick rerun.

Metric meanings:

- `uniqueCaseCount`: number of non-duplicated resolved/extracted case ids. It must match total case count for campaign gates.
- `distinctCaseTypeCount`: case-type diversity across the run.
- `candidateRepeatRate`: repeated culprit/victim/location/case-type signatures within a 240 tick campaign window. Later follow-up cases outside that window are treated as campaign consequences rather than immediate repeats.
- `causalLinkCount`: deterministic influence links observed across actions, memories, resources, institutions, evidence, and case lifecycle.
- `crossCaseInfluenceCount`: case graph edges that connect later cases to earlier case aftermath or shared world state.
- `laterCaseInfluenceRate`: percentage of later cases with at least one case graph edge pointing to prior cases.
- `caseGraphInfluencedLaterCases`: number of non-initial cases with one or more incoming influence edges from prior cases.
- `completeEvidenceCaseCount` / `resolvedEvidenceCaseCount`: resolved evidence graph case-use completeness; these counts must match for campaign gates.
- `evidenceGraphWarnings`: graph audit warnings for missing or incomplete evidence use in resolved cases.
- `worldStability.selectedActionKindCount`: number of distinct selected NPC action kinds in the run.
- `worldStability.largestSelectedActionShare`: percentage share of the most common selected action kind; v5.0 requires it to stay at or below 55% for 1000 ticks.
- `worldStability.activeActorCount` / `worldStability.largestActorShare`: actor spread diagnostics for detecting one NPC dominating the simulation rhythm.
- `worldStability.validCandidateCountTrend`: recent candidate count and valid-candidate count samples across the run.
- `worldStability.institutionDecisionCount`: number of institution strategy decisions retained in runtime rule state; v5.0 requires at least 4 for 1000 ticks.
- `worldStability.deterministicRunHash`: copy of the deterministic run hash used to confirm same-seed stability.
- `summary.stability`: v5.1 multi-seed aggregate containing passed/failed seed counts, worst repeat rate, lowest case type count, lowest selected action kind count, highest largest action share, lowest institution decision count, per-seed summaries, and deterministic hashes.
- `diagnostics-report.json` / `diagnostics-report.md`: v5.2 local-only benchmark diagnostics derived from the stable-world quality report. Findings use `ok`, `watch`, `risk`, and `blocker`: blocker means a gate violation or missing deterministic hash, risk means a passing metric is close to a threshold, watch means a non-blocking concentration or trend deserves inspection, and ok means the dimension has healthy margin.
- `regression-report.json` / `regression-report.md`: v5.3 local-only benchmark regression report comparing the current stable-world run against the previous local artifact at the same run id. Deltas use `improved`, `unchanged`, `watch`, `regressed`, and `blocked`; runtime thresholds are wider than deterministic metric thresholds because local machine load varies.
- `public/review-catalog/stable-world-summary.json`: v5.4 public-safe summary derived from the stable-world manifest, stability summary, diagnostics JSON, and regression JSON. v5.5 reuses this schema for the Static Reviewer drilldown; the local replay-store artifact remains the benchmark authority.
- `case-quality-report.json` / `case-quality-report.md`: v5.6 non-blocking benchmark quality report derived from aggregate stable-world metrics. Scores cover fair-play evidence, evidence provenance, case diversity, cross-case continuity, institution relevance, repeat control, and solution readiness.
- `public/review-catalog/case-quality-summary.json`: v5.6 public-safe quality summary derived from the stable-world manifest and case-quality JSON. It is a tracked static review snapshot used by Static Reviewer Home; the local replay-store artifact remains the benchmark authority.
- Regression reports compare case count, case type count, repeat rate, later influence, evidence warnings, action kind count, largest action share, largest actor share, institution decisions, runtime, diagnostic finding counts, and top performance phase share.
- Diagnostic reports intentionally avoid raw case bodies, hidden truth fields, culprit/victim ids, evidence ids, source event ids, checkpoints, agent snapshots, and replay/package bodies. Actor spread is reported only by rank/share, not by NPC id.
- `courtCaseCount` / `dockCaseCount` / `medicalCaseCount` / `informantCaseCount`: focused catalog-expansion metrics for new case type families.
- `*EvidenceCount`: focused count of new evidence graph kinds such as `court-record`, `cargo-log`, `autopsy-note`, and `anonymous-tip`.
- `*EnabledActionCount` and `*EvidenceRuleCount`: static catalog capability checks that prove ablation variants removed the intended rule surface.
- `resourcePressureTotal`, `institutionPressureTotal`, `ecosystemEventCount`, and `ecosystemEvidenceRuleCount`: v2.7 ecology metrics proving faction/resource/task/event tables are connected to runtime outcomes.
- `dockLinkedCaseCount`, `courtPressureCaseCount`, `medicalEvidenceChainCount`, and `familyObligationCaseCount`: focused ecosystem metrics for package-level ecology influence.

## Replay Audit Rules

The replay audit treats the replay store as a local dataset catalog:

- `manifest.json` must exist for each run directory.
- Manifest-listed files must exist and stay inside the run directory.
- JSON artifacts must parse.
- File bytes and sha256 hashes are written to the index.
- Secret-looking values are errors, including provider key prefixes, API-key-like field names, bearer authorization headers, or `.env.local` references.
- Replay and review bundles must not export `checkpoint`, `agent_state_snapshot`, `hiddenDebugLog`, or `truth.culpritId`.
- Case graphs must not contain duplicate case ids and must match inferred case counts when available.
- Evidence graphs must have zero warnings and complete resolved-case evidence use.

Default audit mode allows legacy manifest warnings while still exiting successfully if there are no errors. `npm run replay:audit -- --strict` treats warnings as failures.

Recommended v3.0 baseline sequence:

```powershell
npm run test:replay-audit
npm run replay:audit
npm run replay:sync
npm run package:validate
npm run package:sync
npm run package:export -- --package=dock-court-market-town
npm run package:export -- --package=hospital-family-press-town
npm run package:export -- --package=city-hall-merchant-debt-town
npm run build
npm run test:persistent-town
npm run test:long-run
npm run test:simulation-quality
npm run benchmark:catalog-expansion
npm run benchmark:ecosystem-ablation
npm run benchmark:campaign -- --ticks=1000
npm run benchmark:experiment-matrix
npm run benchmark:campaign -- --ticks=5000
npm run dataset:export -- --run=campaign-campaign-validation-5000
npm run dataset:validate -- --path=outputs/dataset-packages/detective-town-v3-5000-campaign
npm run dataset:smoke -- --path=outputs/dataset-packages/detective-town-v3-5000-campaign
npm run dataset:reader -- --path=outputs/dataset-packages/detective-town-v3-5000-campaign
npm run dataset:static-reader -- --path=outputs/dataset-packages/detective-town-v3-5000-campaign
npm run dataset:reader -- --path=public/dataset-reader/detective-town-v3-5000-campaign
npm run replay:audit
```

For day-to-day work, stop after the 1000 tick campaign unless the branch changes campaign generation, graph construction, replay artifacts, or performance. For v3.0 readiness, run the full sequence: light tests, 1000 tick, matrix, 5000 tick, then replay audit. The final audit should report `Errors: 0`, `Secret leaks: 0`, and `Hidden truth leaks: 0`. Legacy manifest warnings are acceptable in default mode while older artifacts are still present.
