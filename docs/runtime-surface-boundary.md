# Runtime API surface boundary

The player runtime is the only surface allowed to return spoiler-safe projections. It is tagged with `surface: "player"` on the runtime start, runtime step, evidence discovery, and theory submission responses. These routes use `publicPlayerRuntime`, `publicPlayerWorld`, `publicTownQueue`, and `publicPlayerCase`.

Operator and authoring commands remain separate under the existing town command/query routes for scenario packs, experiments, snapshots, interventions, and package operations. They use the full `publicRuntime`/`publicWorld` projection and are not mounted in the player shell. They must be treated as an admin surface by the host authentication layer before exposure outside a trusted operator session. The shared `adminGuard(request)` accepts `RUNTIME_ADMIN_TOKENS` (comma-separated for overlap during rotation), the legacy `RUNTIME_ADMIN_TOKEN`, `Authorization: Bearer`, or a trusted proxy session via `RUNTIME_ADMIN_SESSION_TOKEN` and `x-runtime-admin-session`.

Each admin attempt records route, method, outcome, status, request id, and credential source in SQLite `admin_audit_events`; raw credentials are never stored. This document is a boundary contract: deployment must still place HTTPS, session issuance, proxy policy, and secret rotation around the application.

Before a production-like launch, run `npm run quality:production-config`. In local development the check reports unset operator credentials as an advisory warning; with `NODE_ENV=production` (or `REQUIRE_RUNTIME_ADMIN_CONFIG=1`) it fails unless a token or trusted proxy session secret is configured. The command checks only credential presence and implementation wiring and never prints secret values.
