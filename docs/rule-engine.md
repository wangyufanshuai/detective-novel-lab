# Rule Engine

The rule engine is deterministic TypeScript. It is the authority for case validity and player judgement.

## Case Validation

`validateCase(case)` returns:

- `valid`
- `errors`
- `warnings`
- `suspectMatrix`
- `timelineContradictions`
- `reasoningCoverage`
- `fixSuggestions`

Validation checks:

- exactly one culprit flag
- `truth.culpritId` matches that culprit
- decisive evidence exists and is discoverable
- scenes reference existing evidence
- only one complete unexcluded suspect remains
- non-culprits with motive/means/opportunity have exclusion evidence
- critical reasoning steps are backed by discoverable evidence
- at least one public timeline version can be contradicted by evidence

## Player Judgement

`judgeTheory(case, theory, discoveredEvidenceIds)` checks:

- culprit
- motive
- method
- decisive evidence
- exclusion evidence for non-culprits

The LLM may explain the result, but it does not change the result.
