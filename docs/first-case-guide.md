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

On the first Static Demo visit, the app opens a lightweight onboarding task card and keeps a compact task queue in the left control rail. It does not block the map. The guide state is stored in browser `localStorage` under:

```text
detective-town-onboarding-v1
```

Closing the onboarding layer persists dismissal, but the guide can be reopened from the Help button.

The top investigation stage bar shows the current loop:

```text
Observe scene -> Search evidence -> Question witness -> Challenge contradiction -> Organize theory -> Submit conclusion -> Review solution
```

Clicking a guided task highlights the relevant map target, time window, NPC, or reasoning panel.

## Investigation Feedback

The app avoids giving away the answer before the player earns it:

- Evidence cards explain how a clue can be used, but do not name the culprit.
- Search, interrogation, wrong theory, and solution actions show short feedback toasts. The toasts are non-blocking and never contain the hidden answer.
- Location hover cards show searchability, evidence progress, and the nearest public event.
- NPC popovers show name, role, question status, contradiction status, and exclusion status without marking the true culprit before the case is solved.
- Deduction Graph nodes explain why discovered evidence is valid, which WorldEvent created it, and what testimony or exclusion it can support.
- Suspect Board rows show motive / means / opportunity status plus non-spoiler exclusion state.
- NPC replies show `Prompt Safe`, memory count, discovered evidence count, and contradiction status.
- Wrong theories show gap categories: culprit, motive, method, key evidence chain, and exclusion chain.
- Gap cards are clickable: they jump to the relevant board, form field, evidence list, or graph area without revealing the correct answer.
- The final culprit conclusion in the Deduction Graph stays locked until the local rule engine accepts the theory.

## Reading The Logic UI

Use the right-side Inspector as a reasoning workspace:

- **Graph explanation card**: click an unlocked graph node to see the public reason it exists and its source event.
- **Suspect explanation card**: click a suspect row to see surface suspicion, MMO status, visible exclusion evidence, and any still-locked evidence count.
- **Wrong theory gap cards**: after a failed submission, click a gap card to jump to the area that needs work.
- **Solution chain**: after a correct theory and reveal, read the discovered-evidence-to-conclusion sequence before the prose solution.

The design rule is strict: before the case is solved, the interface may explain only what the player has discovered or what is publicly visible.

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
