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
- `GET /api/v1/query/town/runtime?worldId=...`
- `GET /api/v1/query/town/agents?worldId=...`
- `GET /api/v1/query/town/agent?worldId=...&npcId=...`
- `GET /api/v1/query/town/candidates?worldId=...`
- `GET /api/v1/query/town/brief?worldId=...`
- `GET /api/v1/query/town/emergence-proof?worldId=...&candidateId=...`
- `GET /api/v1/query/town/scenario?worldId=...&scenarioId=...`
- `GET /api/v1/query/town/scenario/report?worldId=...&scenarioId=...`
- `GET /api/v1/query/town/snapshots?worldId=...`
- `GET /api/v1/query/town/snapshot/diff?worldId=...&from=...&to=...`
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
- `POST /api/v1/command/town/runtime/start`
- `POST /api/v1/command/town/runtime/pause`
- `POST /api/v1/command/town/runtime/step`
- `POST /api/v1/command/town/runtime/reset`
- `POST /api/v1/command/town/agent/intervene`
- `POST /api/v1/command/town/case/extract`
- `POST /api/v1/command/town/scenario/run`
- `POST /api/v1/command/town/snapshot/rollback`
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

`GET /api/v1/query/case?caseId=...&includeIntake=true` recomputes the same intake for an existing case. Passing `sessionId` lets the route mark discovered evidence, ready witness challenges, wrong-theory progress, next action, and solved source trail visibility. Omitting `includeIntake` preserves the old response shape.

`playableIntake` may include optional `routeIntegrity`, `progress`, `progressStages`, `nextAction`, and `blockedReasons` fields. These are additive and can be ignored by older clients.

## Scenario Runner And Time Machine

Scenario endpoints turn Persistent Agent Town into a reproducible experimentation loop:

```text
create town -> run scenario -> inspect report -> compare snapshots -> rollback if needed
```

`POST /api/v1/command/town/scenario/run` accepts a `ScenarioConfig` with baseline steps, counterfactual branches, scheduled interventions, and pass criteria. The baseline branch is persisted to the runtime world. Counterfactual branches are compared in the report and do not overwrite original source facts.

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
