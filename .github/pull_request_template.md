## Summary

Describe what changed and why.

## Runtime Mode Impact

- [ ] Static Demo remains browser-only and does not require API keys, SQLite, or `/api/*` calls.
- [ ] Server Runtime changes keep SQLite and `/api/v1/*` response shapes backward compatible.
- [ ] DeepSeek is not used as the final judge for culprit, evidence, case validity, or player theories.

## Validation

- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `npm run benchmark:emergence`
- [ ] `npm run test:e2e`
- [ ] `node scripts/run-agent-api-smoke.mjs`
- [ ] `node scripts/run-novel-agent-api-smoke.mjs`
- [ ] `node scripts/run-persistent-town-api-smoke.mjs`
- [ ] `node scripts/run-scenario-runner-api-smoke.mjs`
- [ ] Docker build/smoke when runtime, deployment, or dependency files changed.

## Safety

- [ ] No `.env`, `.env.local`, `data/`, `outputs/`, `.next/`, `test-results/`, or Playwright artifacts committed.
- [ ] Case logic remains evidence-backed, memory-scoped, and locally validated.
- [ ] Public docs/examples avoid secrets and use placeholders only for credentials.
