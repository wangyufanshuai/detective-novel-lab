# Agent Control API

`/api/v1/*` is the stable integration layer for external agents, scripts, and demos. It wraps the existing world, case, and investigation routes without changing legacy APIs.

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

## Command Endpoints

- `POST /api/v1/command/town/create`
- `POST /api/v1/command/player/join`
- `POST /api/v1/command/investigation/discover`
- `POST /api/v1/command/investigation/interrogate`
- `POST /api/v1/command/investigation/submit-theory`

## Smoke Test

```powershell
node scripts/run-agent-api-smoke.mjs
```

The script starts a temporary local server unless `AGENT_API_BASE_URL` is provided.
