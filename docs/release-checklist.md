# Release Checklist

Use this checklist before pushing a launch or demo-readiness change. The v3.x public baseline is the Static Demo reader path plus the 5000 tick dataset handoff.

## v10.0 clean distribution closure

Use a committed or explicit tree snapshot for the canonical clean run:

```powershell
npm.cmd run quality:v10-clean-worktree -- --snapshot=HEAD
```

Acceptance requires exact lockfile installation, TypeScript/build from empty derived state, a zero-production-advisory check, two complete `quality:rc` passes with `.next`, outputs, and temporary data removed between them, native production smoke, available Docker/Linux smoke, safe release evidence, zero residual QA databases/processes, and the frozen protected-public hash. See [v10.0-distribution-runbook.md](v10.0-distribution-runbook.md), [v10.0-migration-policy.md](v10.0-migration-policy.md), and [v10.0-validation-report.md](v10.0-validation-report.md).

The branch's nine protected public files are byte-locked external inputs rather than tracked source. Do not regenerate or stage them. A clean worktree must provision the exact hash documented by the runbook before claiming full Static distribution closure.

## v9.7/v10 read-only Release Candidate gate

For the frozen v9.7 worktree, use the single non-generating gate:

```powershell
npm.cmd run quality:rc -- --json
```

It builds before production Server QA, uses dynamic ports and unique temporary SQLite files, removes DB/WAL/SHM/journal companions in `finally`, reports structured failure tails, scans privacy/security boundaries, checks v10 distribution contracts and lockfile/licenses, runs the native production distribution smoke, validates Static Reader in `--public-only` mode, and hashes both protected public trees before and after execution. A passing gate must leave no new RC database or project-owned Next process.

Do not run the Refresh or Public Catalog Build commands below during a protected-artifact freeze. Those sections describe a separately authorized artifact-release workflow. The v9.7 gate does not invoke artifact generation or extended long-tick validation. See [v9.7-rc-manifest.md](v9.7-rc-manifest.md), [v9.7-known-issues.md](v9.7-known-issues.md), and [v9.7-recovery-runbook.md](v9.7-recovery-runbook.md).

## Refresh

```powershell
npm run replay:audit
npm run package:validate
npm run package:sync -- --json
npm run dataset:reader -- --path=outputs/dataset-packages/detective-town-v3-5000-campaign
npm run dataset:static-reader -- --path=outputs/dataset-packages/detective-town-v3-5000-campaign
npm run qa:static-reader -- --json
```

When package or dataset handoff changed, also run:

```powershell
npm run dataset:export -- --run=campaign-campaign-validation-5000
npm run dataset:validate -- --path=outputs/dataset-packages/detective-town-v3-5000-campaign
npm run dataset:smoke -- --path=outputs/dataset-packages/detective-town-v3-5000-campaign
npm run dataset:reader -- --path=outputs/dataset-packages/detective-town-v3-5000-campaign
npm run dataset:static-reader -- --path=outputs/dataset-packages/detective-town-v3-5000-campaign
npm run dataset:reader -- --path=public/dataset-reader/detective-town-v3-5000-campaign
```

## Public Catalog Verify

```powershell
npm run public-catalog:build -- --json
npm run content:validate -- --json
npm run public-catalog:validate -- --json
npm run dataset:reader -- --path=public/dataset-reader/detective-town-v3-5000-campaign --json
npm run qa:static-browser -- --json
npm run qa:release-local -- --json
```

`public/dataset-reader/` and `public/review-catalog/` are tracked public release snapshots. They must be reproducible from the validated local dataset package, static reader metadata, and the aggregate v3.8 detective content summary: `qa:release-local` repeats static reader + catalog generation and fails if the public artifact tree hash changes. The public catalog is generated from `public/dataset-reader/<datasetId>/manifest-lite.json`, `reader-index.json`, and aggregate `content/detective-v1/` validation summary only; it must not read `data/`, `outputs/`, SQLite, or `/api/*`.

## Full Regression Gate

```powershell
npm run test:storage
npm run test:replay-audit
npm run replay:audit
npm run test:persistent-town
npm run test:long-run
npm run test:simulation-quality
npm run benchmark:campaign -- --ticks=1000
npm run benchmark:campaign -- --ticks=5000
npm run benchmark:experiment-matrix
npm run build
npm run replay:audit
```

The final replay audit should report `Errors: 0`, `Secret leaks: 0`, and `Hidden truth leaks: 0`. Legacy manifest warnings are acceptable in default audit mode while older local artifacts remain.

When Docker, dependencies, runtime startup, or deployment files changed:

```powershell
docker build -t detective-town:smoke .
docker run --rm -p 3000:3000 -e AI_PROVIDER=mock -e DATABASE_URL=file:./data/mystery-town.db detective-town:smoke
```

Then open `http://127.0.0.1:3000/api/v1/query/runtime/status`.

## Browser QA

- Static Demo: `npm run qa:static-browser` must show Public Catalog, Dataset Reader, Reader Summary, 5000 gate, top distributions, RunCatalog, and ReplayBundle.
- Network: Static Demo must make zero `/api/*` requests. It may fetch only `/review-catalog/*` and `/dataset-reader/*` public files.
- Mobile: 390px viewport must have no page-level horizontal overflow.
- Server Runtime: `?runtime=server` must still show Dataset Package, Replay Dataset, World Packages, RunCatalog, and ReplayBundle.
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
- Tag or release only after CI and Docker smoke are green on `main`.
