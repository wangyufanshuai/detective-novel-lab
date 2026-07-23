# API v1 OpenAPI Contract

`public/openapi.v1.json` documents the stable external-agent subset of `/api/v1/*`.

The file is intentionally static so a Vercel Static Demo can expose it at:

```text
/openapi.v1.json
```

## Scope

Included:

- Runtime status and capability discovery.
- Persistent Agent Town create/start/step/pause/reset flows.
- Agent and candidate inspection.
- Case Proof Ledger, Route Certificate inspection, and deterministic auto-solve regression.
- Scenario Runner, Scenario Preset library, Time Machine, and Review Bundle export endpoints.
- ScenarioPack export, import preview, validation, and built-in pack discovery.
- TownMapPack export, import preview, validation, and built-in semantic map discovery.
- TownRuleCatalog discovery and Current Experiment selection.
- Read-only rule-state and case-lifecycle inspection for Review Mode.
- Run Catalog, local replay-store artifact discovery, run comparison, replay bundle export, benchmark history rows, and cooperative run job records.
- Emergence benchmark summary, RunJob-backed Quick 10 / Full 20 execution, and the synchronous benchmark compatibility endpoint.
- Living World import, audit, and correction patch loop.

Excluded:

- Legacy `/api/worlds/*`, `/api/investigation/*`, and `/api/generate` routes.
- Browser-only Static Demo internals.
- DeepSeek live-eval endpoints and private local data files.

## Compatibility Rules

- Successful responses keep `{ "ok": true, "data": ... }`.
- Failed responses keep `{ "ok": false, "error": { "code": "...", "message": "..." } }`.
- New fields may be added inside `data` without a version bump.
- Existing endpoint names and required IDs should not be renamed inside `v1`.
- Static Demo must remain API-free; the OpenAPI file is documentation, not a runtime dependency.
- DeepSeek keys are never part of the contract. Live eval and dialogue clients read local `.env.local` / `.env` / process environment values only.

## Review Mode Types

The OpenAPI components document these stable Review Mode type names for SDKs and external agents:

- `ScenarioPreset`: editable experiment preset plus `builtIn` read-only marker.
- `ScenarioRunSummary`: compact run history row for comparing repeated scenario executions.
- `ReviewExportBundle`: portable JSON/Markdown review artifact containing scenario report, selected snapshots, selected diff, branch comparison, and optional latest benchmark. When `runId` is supplied, the endpoint reads the artifact bundle first.
- `ScenarioPack`: portable JSON experiment package containing manifest, world, rules, scenario, expectations, optional assets, and optional docs. Export/import preview/validate APIs are available in this version.
- `ScenarioPackValidationReport`: validation result used before import.
- `TownMapPack`: semantic map package containing manifest, locations, connections, interactions, spawn points, optional assets, and optional docs.
- `TownMapPackValidationReport`: validation result used before import preview or install.
- `TownRuleCatalog` and `TownResourceState`: rule catalog and resource state for police time, media attention, family influence, merchant credit, medical capacity, and evidence integrity.
- `PackRegistryEntry` and `CurrentExperimentRef`: productized experiment selection metadata recorded on the runtime, including source/branch world ids and pack hashes for pack-created runs.
- `RunCatalogEntry`: comparable run history row for live, scenario, and benchmark runs, merged from runtime JSON and `data/replay-store`.
- `RunArtifactManifest` and `RunArtifactFile`: local replay-store manifest and file inventory for shareable run artifacts.
- `RunSnapshot`, `RunDiff`, `RunComparison`, and `RunCommand`: replay-store shaped records derived from runtime JSON.
- `RunJob`: cancellable/resumable cooperative job record for scenario and benchmark work. `tick` advances scenario jobs or one benchmark seed at a time.
- `TownInstitution`, `TownProfession`, `LongActionInstance`, `PublicOpinionState`, `EvidenceContaminationState`, and `CaseAftermath`: world-rule depth types exposed through runtime snapshots and diffs.
- `EvidenceChainState`, `InstitutionDecision`, `TownResourceLedger`, and `CaseLifecycleView`: read-only rule-state/case-lifecycle records used to audit why later cases changed after prior resolutions.

Use `examples/sdk/detective-town-client.mjs` as the executable reference client for this contract.
