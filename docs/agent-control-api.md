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

## Query Endpoints

- `GET /api/v1/query/runtime/status`
- `GET /api/v1/query/world/state?worldId=...`
- `GET /api/v1/query/world/events?worldId=...`
- `GET /api/v1/query/world/memories?worldId=...&npcId=...`
- `GET /api/v1/query/case?caseId=...`
- `GET /api/v1/query/town/runtime?worldId=...`
- `GET /api/v1/query/town/agents?worldId=...`
- `GET /api/v1/query/town/agent?worldId=...&npcId=...`
- `GET /api/v1/query/town/candidates?worldId=...`
- `GET /api/v1/query/town/emergence-proof?worldId=...&candidateId=...`
- `GET /api/v1/query/town/scenario?worldId=...&scenarioId=...`
- `GET /api/v1/query/town/scenario/report?worldId=...&scenarioId=...`
- `GET /api/v1/query/town/snapshots?worldId=...`
- `GET /api/v1/query/town/snapshot/diff?worldId=...&from=...&to=...`
- `GET /api/v1/query/benchmark/emergence`
- `GET /api/v1/query/novel/world-graph?projectId=...`
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
- `POST /api/v1/command/novel/correction/suggest`
- `POST /api/v1/command/novel/correction/apply`
- `POST /api/v1/command/novel/correction/dismiss`
- `POST /api/v1/command/novel/correction/revert`
- `POST /api/v1/command/novel/simulation/start`
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
import text -> query world graph -> start replay -> advance -> intervene -> query changed branch
```

Minimal smoke flow:

```powershell
node scripts/run-novel-agent-api-smoke.mjs
```

The server keeps a lightweight in-memory runtime record for these endpoints. Browser workbench state still uses IndexedDB, and Detective Town server mode still uses SQLite.

## Smoke Test

```powershell
node scripts/run-agent-api-smoke.mjs
node scripts/run-novel-agent-api-smoke.mjs
node scripts/run-persistent-town-api-smoke.mjs
node scripts/run-scenario-runner-api-smoke.mjs
```

The script starts a temporary local server unless `AGENT_API_BASE_URL` is provided.
