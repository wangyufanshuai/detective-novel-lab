# Release Checklist

Use this checklist before pushing a launch or demo-readiness change.

## Local Validation

```powershell
npm run test
npm run build
npm run benchmark:emergence
npm run test:e2e
node scripts/run-agent-api-smoke.mjs
node scripts/run-novel-agent-api-smoke.mjs
node scripts/run-persistent-town-api-smoke.mjs
node scripts/run-scenario-runner-api-smoke.mjs
node scripts/run-sdk-client-smoke.mjs
```

When Docker, dependencies, runtime startup, or deployment files changed:

```powershell
docker build -t detective-town:smoke .
docker run --rm -p 3000:3000 -e AI_PROVIDER=mock -e DATABASE_URL=file:./data/mystery-town.db detective-town:smoke
```

Then open `http://127.0.0.1:3000/api/v1/query/runtime/status`.

## Browser QA

- Static Demo: open `http://127.0.0.1:3000/?runtime=static`; verify no `/api/*` requests are made.
- OpenAPI: open `http://127.0.0.1:3000/openapi.v1.json`; verify valid JSON.
- Server Runtime: open `http://127.0.0.1:3000/?runtime=server`; verify Persistent Agent Town can start, step, run Scenario Runner, and inspect Time Machine diff.
- Mobile: verify no page-level horizontal overflow.
- Console/network: no app runtime errors; Next dev-server HMR warnings are not release blockers for local dev screenshots.

## Screenshots

If the visual workbench changed intentionally:

```powershell
npm run test:e2e:update-screenshots
```

Replace `docs/assets/detective-town-workbench.png` only after reviewing the new desktop image.

## Git Hygiene

- Keep `.env`, `.env.local`, `data/`, `outputs/`, `.next/`, `test-results/`, and Playwright artifacts out of commits.
- Keep `NEXT_CHAT_HANDOFF.md` local unless explicitly asked to publish it.
- Commit with a short capability-focused message.
- Push `main` only after the validation matrix passes.
- Tag `v0.1.0` only after CI and Docker Smoke are green on `main`.
