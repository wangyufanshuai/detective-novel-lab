# Case Authoring Workbench

The Case Authoring Workbench turns the Premium Showcase into an editable mystery draft. It is designed for developers and case authors who want to tune a fair-play case, validate the logic, and export a runnable JSON artifact.

Authoring is browser-only in this release:

- No SQLite writes.
- No DeepSeek calls.
- No server API calls.
- Drafts are persisted in `localStorage` as `detective-town-authoring-v1`.

## Workflow

1. Open the app and switch from `Play` to `Authoring`.
2. Edit the case structure in the left rail:
   - `Case`: title, public case file, theme, premise.
   - `Characters`: name, role, public bio, testimony, motive surface.
   - `Evidence`: title, visible description, true meaning, discoverability.
   - `Scenes`: scene name, description, evidence ids.
   - `Timeline`: true event, public version, contradicted evidence ids.
   - `Logic`: clue order, red herrings, suspect matrix.
3. Watch the center preview:
   - Pixel map snapshot.
   - Deduction graph preview.
4. Watch the right inspector:
   - Schema issues.
   - Rule report.
   - Hard-case logic status.
   - Suspect matrix.
   - Quality, logic strength, misdirection quality, reasoning coverage.
5. Export JSON or Markdown.
6. Use `Run Draft` only after validation passes.

## Validation Boundary

The workbench reuses the same engine functions as Play mode:

```ts
import {
  validateAuthoringDraft,
  validateCaseSchema,
  validateCase,
  validateWorldCase,
  validateHardCaseLogic
} from "./packages/engine/src";
```

`Run Draft` is disabled if any required schema, case, world, or hard-logic rule fails. This prevents an edited case from becoming playable when it has missing evidence, broken references, incomplete suspect exclusion, or a deduction graph that no longer closes.

## Exported JSON

`Export JSON` returns an `AuthoringDraft`:

```ts
type AuthoringDraft = {
  version: 1;
  source: "premium-template" | "imported" | "custom";
  world: WorldState;
  events: WorldEvent[];
  caseFromLog: CaseFromLog;
  updatedAt: string;
};
```

This is intentionally larger than a standalone `DeductionCase` because a playable Detective Town case needs world events, NPC memories, source maps, testimonies, and quality reports.

## Engine API

Authoring exports:

- `createAuthoringDraftFromCase(caseFromLog, world?, events?)`
- `createPremiumAuthoringDraft()`
- `validateAuthoringDraft(draft)`
- `applyAuthoringPatch(draft, patch)`
- `exportAuthoringJson(draft)`
- `exportAuthoringMarkdown(draft)`

The patch API is intentionally small:

```ts
type AuthoringPatch =
  | { op: "set"; path: string; value: unknown }
  | { op: "delete-array-item"; path: string; id: string }
  | { op: "append-array-item"; path: string; value: unknown };
```

## Current Scope

This release is not a full commercial case editor. It focuses on the open-source engine workflow:

- Build from a high-quality template.
- Edit core mystery structure.
- Validate hard logic continuously.
- Export a runnable artifact.
- Play the draft in Static Demo Runtime.

Future improvements can add object creation flows, richer reference management, diff previews, and collaborative case libraries.
