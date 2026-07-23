# Agent Control API

`/api/v1/*` is the stable integration layer for external agents, scripts, and demos. It wraps the existing world, case, investigation, Persistent Agent Town, and Living World Lab routes without changing legacy APIs.

## Response Shape

Success:

```json
{ "ok": true, "data": {} }
```

Failure:

```json
{ "ok": false, "error": { "code": "BAD_REQUEST", "message": "worldId is required" } }
```

## OpenAPI And SDK

- Static OpenAPI contract: `public/openapi.v1.json`, served as `/openapi.v1.json`.
- Scope and compatibility notes: [api-v1-openapi.md](api-v1-openapi.md).
- Zero-dependency Node SDK starter: `examples/sdk/detective-town-client.mjs`.

The SDK is the executable reference for the stable external-agent subset. It is repo-local in v0.1.0 and is not published to npm.

`GET /api/v1/query/runtime/status` also reports SQLite storage health for Docker Server Runtime. The optional `storage` object includes `schemaVersion`, `databasePath`, `walEnabled`, `health`, `quickCheck`, and row counts. Existing clients can ignore this field.

## Query Endpoints

- `GET /api/v1/query/runtime/status`
- `GET /api/v1/query/world/state?worldId=...`
- `GET /api/v1/query/world/events?worldId=...`
- `GET /api/v1/query/world/memories?worldId=...&npcId=...`
- `GET /api/v1/query/case?caseId=...`
- `GET /api/v1/query/case?caseId=...&includeIntake=true&sessionId=...`
- `GET /api/v1/query/case/proof-ledger?caseId=...&sessionId=...&includeCertificate=true`
- `GET /api/v1/query/town/runtime?worldId=...`
- `GET /api/v1/query/town/agents?worldId=...`
- `GET /api/v1/query/town/agent?worldId=...&npcId=...`
- `GET /api/v1/query/town/candidates?worldId=...`
- `GET /api/v1/query/town/brief?worldId=...`
- `GET /api/v1/query/town/emergence-proof?worldId=...&candidateId=...`
- `GET /api/v1/query/town/scenarios?worldId=...`
- `GET /api/v1/query/town/scenario?worldId=...&scenarioId=...`
- `GET /api/v1/query/town/scenario/report?worldId=...&scenarioId=...`
- `GET /api/v1/query/town/scenario-packs?worldId=...`
- `GET /api/v1/query/town/scenario-packs/:packId?worldId=...`
- `GET /api/v1/query/town/map-packs?worldId=...`
- `GET /api/v1/query/town/map-packs/:packId?worldId=...`
- `GET /api/v1/query/town/rule-catalogs?worldId=...`
- `GET /api/v1/query/town/rule-state?worldId=...`
- `GET /api/v1/query/town/case-lifecycle?worldId=...`
- `GET /api/v1/query/town/snapshots?worldId=...`
- `GET /api/v1/query/town/snapshot/diff?worldId=...&from=...&to=...`
- `GET /api/v1/query/town/review/export?worldId=...&scenarioId=...&from=...&to=...&format=json|markdown&includeBenchmark=true|false`
- `GET /api/v1/query/town/runs?worldId=...`
- `GET /api/v1/query/town/runs/:runId?worldId=...`
- `GET /api/v1/query/town/runs/:runId/snapshots?worldId=...`
- `GET /api/v1/query/town/runs/:runId/diffs?worldId=...`
- `GET /api/v1/query/town/runs/compare?worldId=...&left=...&right=...`
- `GET /api/v1/query/town/runs/:runId/replay-bundle?worldId=...`
- `GET /api/v1/query/town/run-artifacts?limit=20`
- `GET /api/v1/query/town/run-artifacts/:runId`
- `GET /api/v1/query/town/run-artifacts/:runId/files`
- `GET /api/v1/query/town/run-jobs?worldId=...`
- `GET /api/v1/query/town/run-jobs/:jobId?worldId=...`
- `GET /api/v1/query/benchmark/emergence`
- `GET /api/v1/query/novel/world-graph?projectId=...`
- `GET /api/v1/query/novel/projects`
- `GET /api/v1/query/novel/project?projectId=...`
- `GET /api/v1/query/novel/identities?projectId=...`
- `GET /api/v1/query/novel/audit?projectId=...`
- `GET /api/v1/query/novel/corrections?projectId=...`
- `GET /api/v1/query/novel/corrected-world-graph?projectId=...`
- `GET /api/v1/query/novel/simulation?projectId=...&runId=...`
- `GET /api/v1/query/novel/detail?type=entity|event|relationship|development|causal-claim|causal-edge&id=...`

## Command Endpoints

- `POST /api/v1/command/town/create`
- `POST /api/v1/command/player/join`
- `POST /api/v1/command/investigation/discover`
- `POST /api/v1/command/investigation/interrogate`
- `POST /api/v1/command/investigation/submit-theory`
- `POST /api/v1/command/investigation/autosolve`
- `POST /api/v1/command/town/runtime/start`
- `POST /api/v1/command/town/runtime/pause`
- `POST /api/v1/command/town/runtime/step`
- `POST /api/v1/command/town/runtime/reset`
- `POST /api/v1/command/town/agent/intervene`
- `POST /api/v1/command/town/case/extract`

`POST /api/v1/command/town/runtime/step` also accepts one optional zero-tick player decision at a time. `playerResourceCommitmentDecision: { sessionId, choice }` uses `choice = police-time | informant-trust | evidence-integrity | none`, requires `steps: 0`, and cannot be combined with `worldLeadDecision` or `worldArcDirectiveDecision`. The response contains only the safe `playerResourceCommitment` summary; internal session, case, location, resource, and tick bindings remain inside existing Server Runtime JSON.

From v5.34, each resource option also contains a safe standing label and its actual bounded reserve cost. Existing join, investigation, theory, runtime-step, and Situation Brief responses may include `factionRelationship`, containing only standing bands, aggregate counts, and low-spoiler guidance. Internal numeric values, faction keys, source keys, case/directive bindings, and ticks are never projected. No new command or endpoint is introduced.

From v5.35, existing runtime-step responses may also include `worldEventOffer`. The optional request field is zero-tick only:

```json
{ "worldEventOfferDecision": { "choice": "accept" } }
```

`choice` is `accept` or `decline`; it cannot be combined with another zero-tick world decision. Accept records intent only. The next normal Persistent Town cadence reuses the configured institution and long-action catalog, returning safe `offered`, `accepted`, `running`, `completed`, `failed`, or `expired` summaries. A response may include only labels, deadline band, progress, queue count, benefit/cost copy, recovery guidance, and next action. Source directive/event/case keys, actor, institution, action, resource, reservation, and tick fields remain internal. If a prerequisite is unavailable, the offer fails without an event or resource mutation beyond any recorded reservation refund. No new endpoint, schema, event queue, or public artifact is introduced.

From v5.36, join, manual investigation, theory submission, and runtime-step responses may also include a safe `investigatorProgression` summary. It contains only bounded practice points, competency labels/levels, unlock labels, status, and a low-spoiler next action. Manual Search, Question, Challenge, evidence selection, and accepted theory can record one idempotent practice step in the existing runtime JSON; autosolve and counterfactual branches do not. Established lane practice may lower one future matching reserve cost, while established case-closure practice may expose one retry for a failed or expired offer. Internal source keys and the progression ledger are never projected, and this optional summary adds no endpoint or schema.
- `POST /api/v1/command/town/scenario/run`
- `POST /api/v1/command/town/scenario-pack/export`
- `POST /api/v1/command/town/scenario-pack/import`
- `POST /api/v1/command/town/scenario-pack/validate`
- `POST /api/v1/command/town/map-pack/export`
- `POST /api/v1/command/town/map-pack/import`
- `POST /api/v1/command/town/map-pack/validate`
- `POST /api/v1/command/town/experiment/select`
- `POST /api/v1/command/town/experiment/new-run`
- `POST /api/v1/command/town/scenario/preset/save`
- `POST /api/v1/command/town/scenario/preset/delete`
- `POST /api/v1/command/town/run-job/start`
- `POST /api/v1/command/town/run-job/tick`
- `POST /api/v1/command/town/run-job/cancel`
- `POST /api/v1/command/town/run-job/resume`
- `POST /api/v1/command/town/snapshot/rollback`
- `POST /api/v1/command/benchmark/emergence/run`
- `POST /api/v1/command/novel/import`
- `POST /api/v1/command/novel/analyze`
- `POST /api/v1/command/novel/evidence-index`
- `POST /api/v1/command/novel/ask`
- `POST /api/v1/command/novel/blueprint`
- `POST /api/v1/command/novel/project/save`
- `POST /api/v1/command/novel/identity/resolve`
- `POST /api/v1/command/novel/correction/suggest`
- `POST /api/v1/command/novel/correction/apply`
- `POST /api/v1/command/novel/correction/dismiss`
- `POST /api/v1/command/novel/correction/revert`
- `POST /api/v1/command/novel/simulation/start`
- `POST /api/v1/command/novel/simulation/branch`
- `POST /api/v1/command/novel/simulation/advance`
- `POST /api/v1/command/novel/simulation/intervene`
- `POST /api/v1/command/novel/simulation/rewind`
- `POST /api/v1/command/novel/simulation/explain`

## Persistent Town Agent Loop

Persistent Town endpoints expose the observe -> decide -> act -> validate loop for Detective Town itself:

```text
create town -> start runtime -> step ticks -> inspect agents -> inspect candidates -> intervene -> extract playable case
```

Minimal smoke flow:

```powershell
node scripts/run-persistent-town-api-smoke.mjs
```

The runtime state is stored inside the persisted world JSON. New actions still become `WorldEvent` records, and extracted cases still use the existing fair-play validation and investigation APIs.

`GET /api/v1/query/town/brief` is a read-only situation summary for agents and the Command Center. It ranks current location pressure and NPC risk, aggregates selected action and observation kinds, reports case-chain readiness, and provides short signals for the next inspection step. It does not advance the runtime or mutate SQLite state.

## Playable Case Intake

Emerged Persistent Agent Town candidates can be bridged into the player investigation loop with a spoiler-safe intake. `POST /api/v1/command/town/case/extract` still returns `world`, `events`, `activeCase`, `candidate`, and `queue`; it may also return `playableIntake`. Before persistence, extraction checks route integrity; failures return `CASE_NOT_PLAYABLE` with low-spoiler blockers.

`GET /api/v1/query/case?caseId=...&includeIntake=true` recomputes the same intake for an existing case. Passing `sessionId` lets the route mark discovered evidence, ready witness challenges, wrong-theory progress, Coach next step, and solved source trail visibility. Omitting `includeIntake` preserves the old response shape.

`playableIntake` may include optional `routeIntegrity`, `proofCoverage`, `progress`, `progressStages`, `nextAction`, `blockedReasons`, and `coach` fields. These are additive and can be ignored by older clients.

Truth Ledger is the local proof source for emerged cases. It creates motive, means, opportunity, timeline, contradiction, exclusion, source, and conclusion obligations from the extracted case, source map, world events, testimonies, and suspect matrix. Route Certificate then proves the player can complete the route through search, witness questioning, challenge, evidence selection, and accepted local judgement. The same coverage drives route integrity, wrong-theory gaps, Case Intake next action, and judgement feedback.

Investigation Coach is the completion-rate layer for that same data. It maps session progress to `join`, `search`, `question`, `challenge`, `select-evidence`, `submit`, or `review-source`, plus a low-spoiler next step, completion condition, coverage counts, and blockers. It is local TypeScript logic and does not call DeepSeek.

- `GET /api/v1/query/case/proof-ledger?caseId=...&sessionId=...&includeCertificate=true`
- `POST /api/v1/command/investigation/autosolve`

The proof-ledger endpoint is read-only and returns `{ ledger, coverage }`, plus `certificate` when requested, inside the standard `{ ok: true, data }` envelope. Passing `sessionId` marks obligations covered by discovered evidence, selected theory evidence, challenge hits, and solved status. Without a solved session, certificate ids and route details stay low-spoiler.

The auto-solve command is a deterministic local regression path for development, QA, and benchmarks. Its body is `{ "caseId": "...", "persist": false, "includeSession": false, "includeDetails": false }`. By default it is a dry-run and returns only a spoiler-safe summary. With `persist=true`, a passing report saves a dedicated `auto-player` session in the existing sessions table; it does not overwrite real player sessions or change the active case. Failed reports stay read-only and return structured blockers. `includeSession=true` returns the persisted session alongside the spoiler-safe summary for Server Playthrough Proof UI. `includeDetails=true` remains a debugging path that returns the full route, synthetic session, judgement, and proof coverage.

## Scenario Runner And Time Machine

Scenario endpoints turn Persistent Agent Town into a reproducible experimentation loop:

```text
create town -> run scenario -> inspect report -> compare snapshots -> rollback if needed
```

`POST /api/v1/command/town/scenario/run` accepts a `ScenarioConfig` with baseline steps, counterfactual branches, scheduled interventions, and pass criteria. The baseline branch is persisted to the runtime world. Counterfactual branches are compared in the report and do not overwrite original source facts.

Review Mode adds a technical evaluator loop on top of the same runtime:

```text
open ?runtime=server -> enter Persistent Agent Town -> choose ScenarioPack/MapPack -> New Run from Pack -> watch RunJob -> inspect Time Machine diff -> export Review Bundle
```

`GET /api/v1/query/town/scenarios?worldId=...` returns the current `ScenarioPreset[]`, `ScenarioRunSummary[]`, snapshots, selected scenario run, selected report, and latest diff context used by the UI. Built-in presets are read-only. Custom presets can be saved or overwritten through `POST /api/v1/command/town/scenario/preset/save` and deleted through `POST /api/v1/command/town/scenario/preset/delete`.

`ScenarioPack` is now a real portable JSON experiment package. It contains `manifest`, `world`, `rules`, `scenario`, `expectations`, optional `assets`, and optional `docs`. Exported packs exclude runtime snapshots, API keys, absolute local paths, latest benchmark artifacts, and hidden debug logs. `POST /api/v1/command/town/scenario-pack/import` supports `previewOnly=true` so agents can validate a pack without mutating the runtime.

`TownMapPack` is the semantic map-package companion to `ScenarioPack`. It contains `manifest`, `locations`, `connections`, `interactions`, `spawnPoints`, optional `assets`, and optional `docs`. The built-in `fog-lamp-town` pack is generated from the current location graph. Import preview validates missing locations, broken connections, bad spawn points, absolute paths, secret-looking values, and runtime-only state without mutating the town.

`TownRuleCatalog` lists the detective simulation rules used by the runtime: institutions, professions, resources, long action definitions, random events, and case pressure rules. The built-in `detective-default` catalog includes `police_time`, `media_attention`, `family_influence`, `merchant_credit`, `medical_capacity`, and `evidence_integrity`.

`GET /api/v1/query/town/rule-state` is a read-only runtime rule summary for Review Mode. It exposes institutions, public opinion, evidence contamination, concrete `EvidenceChainState` items, running long actions, recent institution strategy decisions, and the resource ledger. `GET /api/v1/query/town/case-lifecycle` exposes active/solved/failed case ids, cooldowns, institution pressure, next-case weights, and aftermath logs. These routes do not advance ticks or resolve cases.

Candidate extraction now separates preview from resolution internally. `extractPlayableCaseFromCandidate` can build/export a playable case view without mutating `caseLifecycle`; explicit resolution paths such as scenario runs, long-run validation, or `POST /api/v1/command/town/case/extract` call the resolution step that writes aftermath, institution/resource changes, and case lifecycle state.

Current Experiment endpoints record the selected `ScenarioPack`, `TownMapPack`, and `TownRuleCatalog` on the source runtime. `POST /api/v1/command/town/experiment/new-run` now creates an isolated branch world from those packs, persists that branch, and starts a queued scenario RunJob on the branch. The response is `{ sourceWorldId, worldId, currentExperiment, job }`; the returned `worldId` is the branch world and should be used for subsequent job ticks, run catalog queries, diffs, and exports.

Run Catalog endpoints expose comparable run history without rerunning simulation. They merge live runtime rows with local replay-store artifacts under `data/replay-store/<runId>/`; artifact manifests take precedence for the same `runId` because they include pack hashes and file inventory. Scenario and benchmark rows share the catalog, and completed RunJobs write artifact manifests, replay bundles, and benchmark summaries where applicable.

Run Artifact endpoints expose the local artifact store directly. A scenario artifact contains `manifest.json`, `scenario-pack.json`, `map-pack.json`, `rule-catalog.json`, `run-summary.json`, `snapshots.json`, `diffs.json`, `commands.json`, `replay-bundle.json`, and, when available, `review-bundle.json`. Benchmark artifacts also include `benchmark-summary.json`. Artifact files use relative names only; exported artifacts must not contain API keys, absolute paths, runtime checkpoints, or hidden debug logs.

Run Job endpoints create cancellable/resumable job records for scenario and benchmark work. `start` only queues work. `tick` advances one cooperative time slice: scenario jobs execute the short scenario run, while benchmark jobs process one seed and store partial progress in `job.result`. The current version records status and progress in runtime JSON; long-running benchmark execution can move behind the same API later without changing callers.

`GET /api/v1/query/town/review/export` returns a `ReviewExportBundle` as either JSON or Markdown. When `runId` is provided, it reads `review-bundle.json` from the artifact store first and does not rerun simulation. Without an artifact it falls back to the current runtime data. `scenarioId`, `from`, and `to` remain optional for the fallback path; when omitted the server uses the latest scenario run and its baseline diff where available.

`POST /api/v1/command/benchmark/emergence/run` remains a synchronous compatibility endpoint. The UI uses RunJob for Quick 10 / Full 20 so benchmark work can show progress and be cancelled.

Stable Review Mode types:

- `ScenarioPreset`: `{ id, name, description?, builtIn?, updatedAt?, config }`.
- `ScenarioRunSummary`: `{ id, name, status, startedAt, completedAt, branchCount, baselineEventGrowth, baselineMemoryGrowth, validCandidateCount }`.
- `ReviewExportBundle`: `{ exportedAt, worldId, runtimeId, scenario, report, selectedSnapshots, selectedDiff, selectedBranchComparison, benchmark? }`.
- `ScenarioPack`: `{ manifest, world, rules, scenario, expectations, assets?, docs? }`.
- `ScenarioPackValidationReport`: `{ ok, errors, warnings, summary }`.
- `TownMapPack`: `{ manifest, locations, connections, interactions, spawnPoints, assets?, docs? }`.
- `TownMapPackValidationReport`: `{ ok, errors, warnings, summary }`.
- `TownRuleCatalog`: `{ id, name, version, resources, institutions, professions, longActionDefinitions, randomEvents, casePressureRules }`.
- `CurrentExperimentRef`: `{ scenarioPackId, mapPackId, ruleCatalogId, selectedAt, sourceWorldId?, branchWorldId?, runId?, scenarioPackHash?, mapPackHash?, ruleCatalogHash?, engineVersion? }`.
- `RunCatalogEntry`: `{ runId, kind?, artifactAvailable?, branchWorldId?, sourceWorldId?, packId?, mapPackId?, ruleCatalogId?, scenarioId?, seed?, startedAt, finishedAt?, status, engineVersion, summary, packMetadata? }`.
- `RunArtifactManifest`: `{ runId, kind, status, sourceWorldId?, branchWorldId, scenarioPackId?, scenarioPackHash?, mapPackId?, mapPackHash?, ruleCatalogId?, ruleCatalogHash?, engineVersion, startedAt, finishedAt, files }`.
- `RunArtifactFile`: `{ name, kind, bytes? }`.
- `RunJob`: `{ id, kind, status, worldId, scenarioId?, runId?, resultRunId?, seedCount?, progress, createdAt, updatedAt, result?, error? }`.
- `TownInstitution`, `TownProfession`, `LongActionInstance`, `PublicOpinionState`, `EvidenceContaminationState`, and `CaseAftermath` are stable additive runtime types for world-rule depth.

Time Machine snapshots capture tick, day/time, agent state, decision count, candidates, event ids, memory ids, and intervention ids. Public snapshot responses omit rollback checkpoints; rollback uses the server-side checkpoint stored inside the persisted world JSON.

Minimal smoke flow:

```powershell
node scripts/run-scenario-runner-api-smoke.mjs
```

## Living World Audit Loop

Audit endpoints expose an external correction loop:

```text
import text -> query audit -> suggest corrections -> apply patch -> query corrected graph -> revert if needed
```

Minimal smoke flow:

```powershell
node scripts/run-novel-agent-api-smoke.mjs
```

Correction commands update only the runtime `correctionSet`. They do not mutate original chapter text, original paragraph evidence indexes, or the original extracted graph.

## Living World Agent Loop

The novel/world endpoints expose the same loop used by agentic simulation projects:

```text
import text -> query world graph -> start replay -> advance baseline -> create branch at a completed checkpoint -> advance branch -> compare state diff
```

Minimal smoke flow:

```powershell
node scripts/run-novel-agent-api-smoke.mjs
```

Server Runtime persists complete Living World Lab workspaces in SQLite. Browser workbench state still keeps an IndexedDB draft fallback. A branch always receives a new `runId` and a `parentRunId`; its source replay remains available for comparison.

Identity decisions are deterministic project data. High-confidence same-identity candidates are stored as `auto-merged`; agents can confirm or reject pending candidates through `/api/v1/command/novel/identity/resolve`. Changing identity or an active correction makes replay runs stale, so clients must rebuild them before advancing.

## Smoke Test

```powershell
node scripts/run-agent-api-smoke.mjs
node scripts/run-novel-agent-api-smoke.mjs
node scripts/run-persistent-town-api-smoke.mjs
node scripts/run-scenario-runner-api-smoke.mjs
node scripts/run-sdk-client-smoke.mjs
```

The script starts a temporary local server unless `AGENT_API_BASE_URL` is provided.
