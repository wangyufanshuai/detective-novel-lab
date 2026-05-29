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
