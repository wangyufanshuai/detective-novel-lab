# Deployment

## Vercel Static Demo

`vercel.json` sets `NEXT_PUBLIC_DEMO_MODE=static` at build time. Deploy the repository normally; no database or API key is required. The public experience runs entirely in the browser and restores progress from `localStorage`.

The README keeps the public demo URL as a placeholder until a hosted deployment is connected. Use Vercel's project URL or a custom domain once the static demo is published.

Detailed setup and browser QA: [static-demo-vercel.md](static-demo-vercel.md).

## Docker Server Mode

Docker Server Mode is the recommended deployment for the full runtime: SQLite persistence, Persistent Agent Town, Scenario Runner, Time Machine rollback, and Agent API scripts.

Create `.env.local` when DeepSeek dialogue is required, then run:

```bash
docker compose up --build
```

SQLite data is stored in the `detective-town-data` volume at `/app/data`. The container exposes port `3000` and has a healthcheck against `/api/v1/query/runtime/status`.

Required environment:

```bash
DATABASE_URL=file:./data/mystery-town.db
NEXT_PUBLIC_DEMO_MODE=server
AI_PROVIDER=mock # or deepseek
DEEPSEEK_API_KEY= # optional unless using live DeepSeek dialogue
```

Health check:

```bash
curl -fsS http://127.0.0.1:3000/api/v1/query/runtime/status
```

The response includes `storage.schemaVersion`, `storage.databasePath`, `storage.walEnabled`, and `storage.health`. Treat any value other than `storage.health: "ok"` as a release blocker before long-running demos.

Backup:

```bash
npm run backup:sqlite
```

Backups are written to `outputs/backups/` and are intentionally ignored by Git. For Docker, either run the command inside the container or copy `/app/data/mystery-town.db` from the `detective-town-data` volume after stopping writes.

Restore:

1. Stop the container.
2. Copy a verified backup over the mounted `mystery-town.db`.
3. Start the container.
4. Confirm `/api/v1/query/runtime/status` returns `storage.health: "ok"`.

Upgrade checklist:

- Run `npm run test`.
- Run `npm run build`.
- Create a backup before replacing the container image.
- Start Docker Server Mode and verify runtime status.
- Create a premium case using `greenhouse-blade`.
- Start Persistent Agent Town and run one Scenario Runner pass.

Docker smoke check:

```bash
docker build -t detective-town:smoke .
docker run --rm -p 3000:3000 -e AI_PROVIDER=mock -e DATABASE_URL=file:./data/mystery-town.db detective-town:smoke
curl -fsS http://127.0.0.1:3000/api/v1/query/runtime/status
```

## Screenshot Update

Install Chromium once:

```bash
npx playwright install chromium
```

Run `npm run test:e2e:update-screenshots`, verify the desktop workbench, and replace `docs/assets/detective-town-workbench.png` only when the visual change is intentional.
