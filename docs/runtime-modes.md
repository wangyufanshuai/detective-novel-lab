# Runtime Modes

## Static Demo

Set `NEXT_PUBLIC_DEMO_MODE=static` or open `/?runtime=static`.

- Loads the deterministic Premium Showcase immediately.
- Stores investigation progress in `localStorage`.
- Uses memory-scoped rule replies for NPC interrogation.
- Never calls DeepSeek or requires SQLite.
- Intended for Vercel and public read-only demos.
- In Review Mode, the Dataset Reader reads only `/dataset-reader/<datasetId>/manifest-lite.json` and `/dataset-reader/<datasetId>/reader-index.json`.
- Static Demo must not call `/api/*`; use `npm run qa:static-browser` to enforce this before public review.

## Server

Set `NEXT_PUBLIC_DEMO_MODE=server` or open `/?runtime=server`.

- Persists worlds and sessions in SQLite.
- Exposes the Agent Control API under `/api/v1`.
- Uses DeepSeek only for permitted NPC surface dialogue and optional solution prose.
- Preserves the same local rule engine as Static Demo.
- Shows the local Dataset Package, Replay Dataset, and World Packages panels through server-side metadata APIs.

The runtime selector is available in the World Settings drawer. Query parameters override the environment default.
