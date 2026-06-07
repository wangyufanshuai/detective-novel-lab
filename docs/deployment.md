# Deployment

## Vercel Static Demo

`vercel.json` sets `NEXT_PUBLIC_DEMO_MODE=static` at build time. Deploy the repository normally; no database or API key is required. The public experience runs entirely in the browser and restores progress from `localStorage`.

## Docker Server Mode

Create `.env.local` when DeepSeek dialogue is required, then run:

```bash
docker compose up --build
```

SQLite data is stored in the `detective-town-data` volume. The container exposes port `3000`.

## Screenshot Update

Install Chromium once:

```bash
npx playwright install chromium
```

Run `npm run test:e2e:update-screenshots`, verify the desktop workbench, and replace `docs/assets/detective-town-workbench.png` only when the visual change is intentional.
