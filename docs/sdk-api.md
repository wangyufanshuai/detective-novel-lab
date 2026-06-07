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
  listCaseTemplates,
  createCaseTemplate,
  buildWorldCausalTrace,
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
| `listCaseTemplates` | Lists built-in premium case templates. |
| `createCaseTemplate` | Creates a deterministic premium world, events, memories, and case from a template id. |
| `buildWorldCausalTrace` | Derives an explainable event chain from world logs and a case. |
| `validateCausalTrace` | Checks whether decisive evidence events are backed by intents or cause links. |

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

## Case Library Example

```ts
import { createCaseTemplate, listCaseTemplates, validateHardCaseLogic } from "./packages/engine/src";

const templates = listCaseTemplates();
const { world, events, caseFromLog } = createCaseTemplate("clocktower-locked-room");
const hardLogic = validateHardCaseLogic(world, events, caseFromLog);

console.log(templates.map((template) => template.id), hardLogic.valid);
```

## Stability

This is SDK-ready, not yet an npm package. The exported function names are intended to stay stable while the internal rule checks continue to improve.
