# Guided First Case

This guide explains how a first-time visitor can complete the default Static Demo case without needing a DeepSeek key or a writable SQLite database.

## Goal

The first case is designed to demonstrate the core product loop in under three minutes:

1. Observe the crime window.
2. Search locations for world-backed evidence.
3. Question NPCs from memory-scoped testimony.
4. Challenge testimony with discovered evidence.
5. Submit a wrong theory and inspect non-spoiler gap cards.
6. Submit the complete theory.
7. Reveal the solution and final deduction graph node.

## Guided Task Queue

On the first Static Demo visit, the app opens a dismissible onboarding layer and keeps a compact task queue in the left control rail. The guide state is stored in browser `localStorage` under:

```text
detective-town-onboarding-v1
```

Closing the onboarding layer persists dismissal, but the guide can be reopened from the Help button.

## Investigation Feedback

The app avoids giving away the answer before the player earns it:

- Evidence cards explain how a clue can be used, but do not name the culprit.
- NPC replies show `Prompt Safe`, memory count, discovered evidence count, and contradiction status.
- Wrong theories show gap categories: culprit, motive, method, key evidence chain, and exclusion chain.
- The final culprit conclusion in the Deduction Graph stays locked until the local rule engine accepts the theory.

## Why This Matters

The guided case is not a tutorial pasted on top of a generated story. It is a product-level proof that the engine can expose a fair-play investigation loop:

- the world log exists before the case file;
- evidence is sourced from `WorldEvent` records;
- testimony is scoped to `MemoryRecord` data;
- local TypeScript rules judge the theory;
- the LLM is optional and never controls the truth.

## Static vs Server Runtime

`?runtime=static` runs the whole first case in the browser. It does not call `/api/*`, DeepSeek, or SQLite.

`?runtime=server` keeps the same investigation surface, but uses the local server runtime, SQLite persistence, Agent API endpoints, and optional DeepSeek dialogue surface.
