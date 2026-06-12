# Case Authoring Workbench

The Case Authoring Workbench turns the Premium Showcase into an editable mystery draft. It is designed for developers and case authors who want to tune a fair-play case, validate the logic, and export a runnable JSON artifact.

Authoring is browser-only in this release:

- No SQLite writes.
- No DeepSeek calls.
- No server API calls.
- Drafts are persisted in `localStorage` as `detective-town-authoring-v1`.
- Local Case Gallery entries are persisted in `localStorage` as `detective-town-case-gallery-v1`.

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
5. Save reusable drafts with `Save to Gallery`.
6. Open `Gallery` to browse built-in Premium templates and browser-local drafts.
7. Export JSON, Markdown, a single gallery draft, or the full gallery bundle.
8. Use `Run Draft` only after validation passes.

## Local Case Gallery

The Gallery tab is a browser-local case library for Static Demo workflows. It shows read-only built-in Premium templates and local drafts saved from the current Authoring state.

Each gallery card shows:

- title and source;
- built-in, imported, or local draft status;
- updated time;
- validation status;
- evidence and character counts;
- hard-logic pass/fail.

Card actions:

- `Load into Authoring`: replaces the current draft with that gallery item.
- `Run Draft`: creates a temporary Static Demo Runtime only when validation passes.
- `Export JSON`: exports a single `AuthoringDraft`.
- `Delete`: removes local/imported drafts only. Built-in templates are read-only.

The gallery never writes to SQLite and never calls `/api/*`. It is intentionally safe for Vercel Static Demo deployments. Clearing browser storage removes local gallery items.

## Gallery Import / Export

`Import JSON` accepts three shapes:

- an `AuthoringDraft`;
- a standalone `DeductionCase`, normalized into an authoring draft using the current or default world shell;
- a `CaseGalleryBundle`.

Gallery bundles use this browser-local shape:

```ts
type CaseGalleryEntry = {
  id: string;
  title: string;
  source: "built-in" | "local" | "imported";
  draft: AuthoringDraft;
  validation: {
    valid: boolean;
    hardLogicValid: boolean;
    evidenceCount: number;
    characterCount: number;
    errorCount: number;
    warningCount: number;
    qualityScore: number;
    logicStrength: number;
  };
  createdAt: string;
  updatedAt: string;
};

type CaseGalleryBundle = {
  version: 1;
  entries: CaseGalleryEntry[];
  exportedAt: string;
};
```

`Export Gallery JSON` exports local/imported gallery entries as a bundle. Built-in templates remain available from the app and are not required in local bundles.

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
- `createCaseGalleryEntry(draft, options?)`
- `exportCaseGalleryBundle(entries)`
- `importCaseGalleryEntries(value, baseDraft?)`

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
- Save and reuse local drafts in the browser-only Case Gallery.
- Export a runnable artifact.
- Play the draft in Static Demo Runtime.

Future improvements can add object creation flows, richer reference management, diff previews, and collaborative case libraries.
