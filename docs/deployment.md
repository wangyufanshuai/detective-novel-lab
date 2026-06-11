# Deployment

## Vercel Static Demo

`vercel.json` sets `NEXT_PUBLIC_DEMO_MODE=static` at build time. Deploy the repository normally; no database or API key is required. The public experience runs entirely in the browser and restores progress from `localStorage`.

The README keeps the public demo URL as a placeholder until a hosted deployment is connected. Use Vercel's project URL or a custom domain once the static demo is published.

## Docker Server Mode

Create `.env.local` when DeepSeek dialogue is required, then run:

```bash
docker compose up --build
```

SQLite data is stored in the `detective-town-data` volume. The container exposes port `3000`.

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
