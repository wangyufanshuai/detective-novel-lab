# SDK API

Deduction Engine v5 keeps the Web App as the official demo, but the reusable logic now lives in `packages/engine/src`.

## Import

```ts
import {
  createShowcaseCase,
  validateCase,
  validateCaseSchema,
  judgeTheory,
  deriveSuspectMatrix,
  getTimelineContradictions,
  getReasoningCoverage,
  evaluateEvidenceChallenge,
} from "../packages/engine/src";
```

`lib/engine` remains as a compatibility layer for the app.

## Core Functions

| Export | Purpose |
| --- | --- |
| `createShowcaseCase` | Returns the built-in high-quality demo case. |
| `createFallbackCase` | Compatibility alias for the showcase case. |
| `validateCaseSchema` | Performs runtime shape checks for LLM output and fixture JSON. |
| `validateCase` | Runs symbolic rule validation: unique culprit, fairness, timeline, and coverage. |
| `judgeTheory` | Judges a player's culprit, motive, method, and evidence chain. |
| `deriveSuspectMatrix` | Builds motive/means/opportunity/exclusion rows for all suspects. |
| `getTimelineContradictions` | Returns public testimony vs evidence contradictions. |
| `getReasoningCoverage` | Scores whether the reasoning chain is supported by discoverable evidence. |
| `evaluateEvidenceChallenge` | Determines whether evidence hits a character contradiction before LLM wording. |

## Minimal Example

```ts
import { createShowcaseCase, judgeTheory, validateCase } from "./packages/engine/src";

const deductionCase = createShowcaseCase();
const report = validateCase(deductionCase);

const result = judgeTheory(deductionCase, {
  culpritId: deductionCase.truth.culpritId,
  motive: deductionCase.truth.motive,
  method: deductionCase.truth.method,
  evidenceIds: deductionCase.logicPuzzle.criticalEvidenceIds,
});

console.log(report.valid, result.passed);
```

## Stability

This is SDK-ready, not yet an npm package. The exported function names are intended to stay stable while the internal rule checks continue to improve.
