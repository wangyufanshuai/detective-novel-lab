# Evaluation Benchmark

The evaluation benchmark checks whether the engine can reject broken mystery structures and tolerate common LLM field drift.

Run:

```powershell
npm run eval
```

Outputs:

- `outputs/eval-report.json`
- `outputs/eval-report.md`

These files are ignored by Git.

## What It Covers

| Fixture | Expected Behavior |
| --- | --- |
| Valid showcase | Schema and rule validation pass. |
| Two complete suspects | Rule validation fails because culprit uniqueness is broken. |
| Missing decisive evidence | Rule validation fails because a non-culprit lacks an exclusion chain. |
| Undiscoverable decisive evidence | Rule validation fails because critical evidence is not obtainable. |
| No timeline contradiction | Rule validation fails because public testimony has no evidence-backed contradiction. |
| Reasoning chain without evidence | Rule validation fails because the solution is unsupported. |
| LLM field drift | Schema reports warnings/hints while the rule layer normalizes supported drift. |

## Scores

The benchmark records:

- Schema status.
- Rule status.
- Reasoning coverage score.
- Timeline contradiction count.
- Suspect matrix size.
- Normalization hints for drifted fields.

CI runs the benchmark as a smoke check. It does not call DeepSeek and does not require API keys.

## Emergence Benchmark

The emergence benchmark checks whether generated town cases can prove their origin from simulation data rather than model prose, then complete the deterministic investigation route with the local auto-player.

Run:

```powershell
npm run benchmark:emergence
```

Outputs:

- `outputs/emergence-benchmark.json`
- `outputs/emergence-benchmark.md`

These files are ignored by Git.

It records, for each deterministic seed:

- Case generation success.
- Unique culprit status.
- Whether decisive evidence is backed by `WorldEvent`.
- Whether testimony is backed by `MemoryRecord`.
- Whether every non-culprit has an explainable exclusion chain.
- Timeline consistency.
- Hard logic validation.
- Route Certificate success.
- Auto-solve pass/fail, step count, and failure kinds.
- Quality score and emergence score.
- Structured failure reasons when a seed fails.
