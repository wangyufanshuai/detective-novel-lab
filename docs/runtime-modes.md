# Runtime Modes

## Static Demo

Set `NEXT_PUBLIC_DEMO_MODE=static` or open `/?runtime=static`.

- Loads the deterministic Premium Showcase immediately.
- Stores investigation progress in `localStorage`.
- Uses memory-scoped rule replies for NPC interrogation.
- Never calls DeepSeek or requires SQLite.
- Intended for Vercel and public read-only demos.

## Server

Set `NEXT_PUBLIC_DEMO_MODE=server` or open `/?runtime=server`.

- Persists worlds and sessions in SQLite.
- Exposes the Agent Control API under `/api/v1`.
- Uses DeepSeek only for permitted NPC surface dialogue and optional solution prose.
- Preserves the same local rule engine as Static Demo.

The runtime selector is available in the World Settings drawer. Query parameters override the environment default.
