# Vercel Static Demo

The public demo target for v0.1.0 is a browser-only Static Demo deployment. It does not need API keys, SQLite, or writable filesystem access.

## Deploy

1. Import the GitHub repository into Vercel.
2. Keep the default build command:

```bash
npm run build
```

3. Keep `vercel.json` committed. It sets:

```json
{ "env": { "NEXT_PUBLIC_DEMO_MODE": "static" } }
```

4. Deploy and open the generated Vercel URL.
5. Use this public entry:

```text
https://<project>.vercel.app/?runtime=static
```

## No-Secret Guarantee

Static Demo must not require:

- `DEEPSEEK_API_KEY`
- `.env` or `.env.local`
- SQLite write access
- Any `/api/*` call during the playable browser flow

Server Runtime features remain available for local or Docker users:

- Persistent Agent Town
- Scenario Runner
- World State Time Machine rollback
- Agent API scripts
- Living World correction API

## Browser QA

Before linking a public URL from the README:

- Open `/?runtime=static`.
- Confirm no `/api/*` requests are made.
- Open `/openapi.v1.json` and confirm valid JSON.
- Check desktop and mobile widths for page-level horizontal overflow.
- Confirm the console has no app runtime errors.
