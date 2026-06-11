# Contributing

Contributions should preserve the core principle:

> LLMs generate candidates and prose; deterministic rules judge validity.

## Useful Commands

```powershell
npm run build
npm run test
npm run benchmark:emergence
npm run test:e2e
node scripts/run-agent-api-smoke.mjs
node scripts/run-novel-agent-api-smoke.mjs
node scripts/run-persistent-town-api-smoke.mjs
node scripts/run-scenario-runner-api-smoke.mjs
```

## Good Contributions

- New rule checks.
- New high-quality fixture cases.
- Better Workbench visualizations.
- More robust handling of LLM JSON drift.
- Documentation and examples.

## Before Opening a PR

- Do not commit `.env`.
- Do not commit `.env.local`, `data/`, `.next/`, `test-results/`, `playwright-report/`, or Playwright temporary artifacts.
- Keep `outputs/` ignored.
- Add or update rule tests when changing engine behavior.
- Do not make the LLM the final judge of correctness.

## Contribution Areas

- Engine changes should add focused tests in the matching script under `scripts/`.
- Agent API changes should keep `{ ok: true, data }` and `{ ok: false, error }` response shapes stable.
- UI changes should reuse the existing workbench visual system and keep Static Demo API-free.
- Documentation and examples should be runnable without secrets unless explicitly marked as live-provider flows.

## Validation Matrix

Use the narrowest checks while developing, then run the broader matrix before publishing:

| Area | Minimum check |
| --- | --- |
| Rule engine | `npm run test:rules` |
| World/case simulation | `npm run test:world` |
| Persistent Agent Town | `npm run test:persistent-town` |
| Living World Lab | `npm run test:novel-world` |
| Agent API examples | relevant `node scripts/run-*-api-smoke.mjs` |
| UI/workbench | `npm run test:e2e` |
| Release readiness | `npm run test`, `npm run build`, `npm run benchmark:emergence`, smoke scripts |

Static Demo must remain deployable with no API key and no writable SQLite directory. Server Runtime may use SQLite and optional DeepSeek credentials, but local TypeScript rules still decide evidence validity, culprit uniqueness, case fairness, and player judgement.
