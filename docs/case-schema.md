# Case Schema

The central object is `DeductionCase`.

Required top-level fields:

- `id`
- `title`
- `theme`
- `premise`
- `publicCaseFile`
- `truth`
- `characters`
- `evidence`
- `scenes`
- `relationships`
- `logicPuzzle`

## Truth

`truth` contains the hidden solution:

- `culpritId`
- `motive`
- `method`
- `opportunity`
- `decisiveEvidenceIds`
- `trueTimeline`

## Logic Puzzle

`logicPuzzle` describes why the case is fair:

- `suspectMatrix`: motive / means / opportunity / exclusion status.
- `exclusionChains`: how each non-culprit is ruled out.
- `criticalReasoningChain`: evidence-backed steps to the solution.
- `redHerrings`: misleading but explainable clues.
- `requiredClueOrder`: recommended investigation order.

The rule engine tolerates common LLM drift such as `suspectId` instead of `characterId`, string reasoning steps, and natural-language evidence references.
