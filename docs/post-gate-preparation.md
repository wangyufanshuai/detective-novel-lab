# Post-Gate Engineering Preparation

This work lives outside the frozen P1 baseline. It improves verification, maintainability, authoring visibility, and post-study decision readiness without changing the Campaign path, copy, layout, case authority, runtime payloads, or study format.

## Branch boundary

- The P1 baseline is commit `8c1fa31` on `main`.
- Preparation work belongs on `chore/post-gate-preparation` until the human gate produces a decision.
- None of the UX candidates below is wired into the product.
- If instrumentation or protocol changes before P1, both pilots must restart with new participants. Once O1 begins, product or protocol changes invalidate all official sessions.

## Commit-level quality gates

Run before review:

```powershell
npx.cmd tsc --noEmit
npm.cmd run test:campaign-study
npm.cmd run test:world-invariants
npm.cmd run content:validate -- --json
npm.cmd run content:preview-consequences -- --strict --json
npm.cmd run quality:repository-safety
npm.cmd run quality:performance-budget -- --json
npm.cmd run build
npm.cmd run qa:static-boundary -- --json
```

`quality:repository-safety` rejects tracked local databases, study exports, local environment files, Codex state, build state, high-confidence credential tokens, and changes to protected public snapshots. `qa:static-boundary` is intentionally narrower than the release QA: it checks zero `/api/*`, zero Study localStorage, a hidden Study Recorder, and the 390px overflow boundary without generating public artifacts.

## Performance budget

The first budget is a regression tripwire, not a claim of production capacity.

| Metric | Budget | Why it matters |
|---|---:|---|
| `app/page.tsx` physical lines | 9,000 | Prevent the main client controller from growing again while extraction continues. |
| `DetectiveTownUI.tsx` physical lines | 4,200 | Keep the shared UI surface below its current concentration ceiling. |
| `globals.css` physical lines | 12,000 | Force new feature styles into owned files. |
| API route files | 130 | New endpoints require an explicit budget change and review. |
| Serialized Persistent Town runtime | 4 MB | Bound local persistence and response projection pressure. |
| p95 single tick, 24-tick local sample | 250 ms | Catch order-of-magnitude simulation regressions while avoiding runner noise. |

The tool reports observed values as JSON so later CI history can lower budgets after stable measurements exist.

## Internal consequence preview

`npm run content:preview-consequences -- --write` produces an ignored local Markdown preview under `outputs/`. For every event archetype it shows only public-safe authoring labels and verifies four presentation surfaces:

1. actor role;
2. public place;
3. institution or faction;
4. connected progression line.

The preview does not read cases, truth, sessions, replay bodies, runtime JSON, SQLite, or public artifacts. `--strict` fails when any event lacks a surface.

## v6.3 UX candidates — prepared, not selected

Selection must use the official study's top confusion categories. Do not combine all three; that would add density instead of resolving it.

### Candidate A — Investigator-first linear rail

Use when `current-objective` or `certified-route` is the dominant confusion.

- Keep exactly one primary action at the top: current certified investigation step.
- Move world state, proof, replay, and audit into collapsed completed-context sections.
- Reveal the next section only after the current action succeeds.
- Primary measure: lower stage dwell time and fewer current-objective episodes.
- Risk: systemic players may perceive the town as less open.

### Candidate B — Map-led contextual objective

Use when `world-choice` or `advance-town` dominates.

- Keep the map primary and attach one contextual objective card to the selected location or institution.
- Separate `Investigate now` from `Advance town` with distinct consequence language.
- Show world choices only when their target place is visible.
- Primary measure: fewer wrong-surface clicks and faster first meaningful action.
- Risk: small-screen map density and weaker visibility of the certified route.

### Candidate C — Case file / town response split

Use when `recovery`, `finale-cause`, or `replay` dominates.

- Present two persistent lanes: `Case File` and `Town Response`.
- Case File owns truth-safe investigation and Recovery; Town Response owns optional consequences and future-case influence.
- Finale shows a compact causal bridge between the two lanes.
- Primary measure: unprompted Recovery, correct Finale explanation, and different-route Replay intent.
- Risk: two lanes can become competing current objectives unless one is visibly secondary.

## Campaign expansion matrix — planning only

Both candidates reuse current case types, events, progression lines, fairness rules, and the shared Town Reckoning finale. They add no runtime type or schema.

### Campaign B — Civic Access Chain

| Case | Case family | World event | Progression line | Distinct player question | Visible consequence target |
|---|---|---|---|---|---|
| 1 | `archive-vanishing` | Archive Stamp Conflict | Institutional Pressure Arc | Who controls access to the missing copy? | Court clerks and record access |
| 2 | `permit-forgery` | Credit Pressure Spike | Civic Commerce Arc | Who benefits when a false permit remains usable? | Market credit and court procedure |
| 3 | `household-escrow` | Household Letter Surfaced | Private Loyalty Arc | Which private obligation completes the public record chain? | Household trust and public record review |

Authoring goal: distinguish institutional delay, commercial leverage, and private access while retaining one certified evidence authority.

### Campaign C — Public Source Chain

| Case | Case family | World event | Progression line | Distinct player question | Visible consequence target |
|---|---|---|---|---|---|
| 1 | `editorial-coercion` | Editorial Pressure Wave | Public Scandal Arc | Who controls what becomes printable? | Gazette staff and media pressure |
| 2 | `dock-witness-swap` | Dock Shift Dispute | Movement Control Arc | Who can move a source without changing the record? | Dock shifts and witness availability |
| 3 | `false-testimony` | Proof Sheet Leak | Public Source Arc | Which public account survives source comparison? | Court testimony and public trust |

Authoring goal: make information movement visible across newsroom, dock, and court without treating dialogue or LLM prose as evidence.

## Exit criteria before merging preparation work

- P1 baseline commit remains independently checkable.
- No Campaign action, copy, ordering, state, request, or measurement changes.
- All new gates pass on Windows and GitHub-hosted Ubuntu runners.
- Generated preview and performance runtime remain ignored under `outputs/`.
- Protected public snapshot diffs remain empty.
- Human-gate status remains pending.
