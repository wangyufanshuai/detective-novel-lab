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
- Case Proof Ledger inspection.
- Scenario Runner and Time Machine endpoints.
- Emergence benchmark summary endpoint.
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

Use `examples/sdk/detective-town-client.mjs` as the executable reference client for this contract.
