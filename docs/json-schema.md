# JSON Schema

`packages/engine/src/schema.ts` exports a built-in runtime schema description and a lightweight validator:

```ts
import { deductionCaseJsonSchema, validateCaseSchema } from "./packages/engine/src";
```

The project intentionally avoids adding Zod or a JSON Schema runtime dependency in v5. The current validator focuses on:

- Required top-level fields.
- Required `truth` fields.
- Required arrays such as `characters`, `evidence`, `scenes`, `timeline`, and `logicPuzzle.reasoningChain`.
- Common LLM drift such as `suspectId` instead of `characterId`, `exclusionEvidenceIds` or `supportingEvidenceIds` instead of `evidenceIds`, `evidence` instead of `evidenceIds`, and string reasoning steps.
- Clear errors and normalized hints for repair prompts or debugging.

## Required Top-Level Shape

```ts
type DeductionCase = {
  id: string;
  title: string;
  premise: string;
  truth: CaseTruth;
  characters: Character[];
  evidence: Evidence[];
  scenes: Scene[];
  timeline: TimelineEvent[];
  relationships: Relationship[];
  logicPuzzle: LogicPuzzle;
};
```

## Validation Contract

`validateCaseSchema(value)` returns:

```ts
{
  valid: boolean;
  errors: SchemaIssue[];
  warnings: SchemaIssue[];
  normalizedHints: string[];
}
```

Schema validation is not the same as case logic validation. Use `validateCaseSchema` first for shape, then `validateCase` for fairness, uniqueness, contradictions, and reasoning coverage.
