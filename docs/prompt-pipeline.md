# Prompt Pipeline

The API keeps a single public route:

```text
POST /api/generate
```

## Stages

- `gameTruthSeed`: ask the model for JSON-first truth structure.
- `gameLogicRepair`: ask the model to repair a failed structure.
- `gameCaseFile`: generate the player-visible case file.
- `gameDialogue`: generate ordinary character dialogue.
- `gameEvidenceChallenge`: generate evidence-based interrogation response.
- `gameJudgement`: explain the local judgement result.
- `gameSolutionReveal`: reveal the full solution after success.

## Design Rule

The model is allowed to propose and narrate. The rule engine decides.

When JSON parsing fails or validation fails, the API attempts repair. If repair still fails, the UI can fall back to the built-in Showcase case.
