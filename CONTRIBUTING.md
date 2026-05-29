# Contributing

Contributions should preserve the core principle:

> LLMs generate candidates and prose; deterministic rules judge validity.

## Useful Commands

```powershell
npm run build
npm run test:rules
```

## Good Contributions

- New rule checks.
- New high-quality fixture cases.
- Better Workbench visualizations.
- More robust handling of LLM JSON drift.
- Documentation and examples.

## Before Opening a PR

- Do not commit `.env`.
- Keep `outputs/` ignored.
- Add or update rule tests when changing engine behavior.
- Do not make the LLM the final judge of correctness.
