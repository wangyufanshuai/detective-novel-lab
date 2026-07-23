# Case Authoring Workbench

The Case Authoring Workbench turns the Premium Showcase into an editable mystery draft. It is designed for developers and case authors who want to tune a fair-play case, validate the logic, and export a runnable JSON artifact.

Authoring is browser-only in this release:

- No SQLite writes.
- No DeepSeek calls.
- No server API calls.
- No repo JSON writes from the browser.
- Drafts are persisted in `localStorage` as `detective-town-authoring-v1`.
- Local Case Gallery entries are persisted in `localStorage` as `detective-town-case-gallery-v1`.

## Workflow

1. Open the app and switch from `Play` to `Authoring`.
2. Edit the case structure in the left rail:
   - `Case`: title, public case file, theme, premise.
   - `Content`: browser-local seed guide from read-only detective content tables.
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

## Content-Guided Authoring

v4.3 adds a `Content` tab that reads the built-in `content/detective-v1/` tables as template guidance for browser-local drafts. It lets an author choose a case type, compatible location, roles, motive, evidence types, and one red-herring pattern. Default selections are stable: the highest-weight case type wins first, then compatible rows are ordered by table references or weight.

`Preview Content Seed` shows the text fields that would change. `Apply Content Seed` writes only safe public-facing draft text:

- case title, theme, premise, and public case file;
- character role labels, public bios, and motive surface text;
- evidence titles and player-visible descriptions;
- red-herring labels.

It intentionally does not change case ids, character ids, evidence ids, scene ids, timeline ids, source event ids, suspect matrix rows, clue order, critical reasoning chain, proof structure, world events, SQLite data, or public release artifacts. After apply, the workbench immediately reruns `validateAuthoringDraft`; if validation fails, the draft is kept in browser state and the Rule Report shows the blocker.

v4.4 groups preview changes into Case, Characters, Evidence, and Logic. Before a non-empty `Apply Content Seed`, it also saves the complete pre-apply draft to Local Case Gallery as `Before Content Seed - <case title>`. Use `Load into Authoring` on that local entry to restore the snapshot. An empty apply creates no backup, and all snapshot data stays under the existing browser-local Gallery schema.

v4.5 adds a session-only `Content Seed Undo` audit trail inside the `Content` tab. After a non-empty seed apply, the trail records the previous title, new title, case type label, patch count, validation result, and matching Gallery backup title. `Undo Content Seed` restores the pre-apply draft immediately from page state and removes that session entry; the durable browser-local Gallery backup remains available until the user deletes it. Loading a template, importing a draft, or loading a Gallery entry clears the session undo queue so an old seed cannot be applied to a different draft context.

v4.6 adds `Safe Diff Review` to the same browser-local Content tab. Before apply, it shows the pending safe diff from the selected content seed. After apply, it compares the session before snapshot with the current draft and shows the applied safe diff. The review is limited to public text fields: case title/theme/premise/public case file, character role/public bio/motive surface, evidence title/visible description, and red-herring labels. It does not display ids, hidden truth fields, true evidence meanings, timeline truth, suspect matrix, clue order, critical reasoning chain, source event ids, replay bodies, or package bodies.

v4.7 adds `Authoring Workflow Coach` to the browser-local Authoring inspector. It exposes the authoring flow as Draft, Content Seed, Safe Diff, Validation, Run Draft, and Gallery Backup stages, each with a ready/active/blocked/done status. `Next Action` only focuses existing UI or opens the existing preview state: validation blockers route through `focusAuthoringIssue`, pending content seeds open `Preview Content Seed`, applied seeds point back to `Applied safe diff`, Undo, and Gallery backup, and valid drafts point to `Run Draft` or `Save to Gallery`. The coach reads only current browser state and summary counts; it does not call `/api/*`, write SQLite, edit repo JSON, expose spoiler fields, or add public artifact schema.

The content tables remain source-controlled read-only input for this UI. The browser does not edit `content/detective-v1/*.json`, and public catalog artifacts continue to expose only aggregate `contentSummary` metadata.

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
- `buildDetectiveContentAuthoringGuide(contentPack, draft, selection?)`
- `selectDefaultDetectiveContentAuthoringSelection(contentPack, previous?)`
- `exportAuthoringJson(draft)`
- `exportAuthoringMarkdown(draft)`
- `createCaseGalleryEntry(draft, options?)`
- `createContentSeedBackupEntry(draft, timestamp?)`
- `exportCaseGalleryBundle(entries)`
- `importCaseGalleryEntries(value, baseDraft?)`

The patch API is intentionally small:

```ts
type AuthoringPatch =
  | { op: "set"; path: string; value: unknown }
  | { op: "delete-array-item"; path: string; id: string }
  | { op: "append-array-item"; path: string; value: unknown };
```

## v5.37 Authored Campaign Grammar

The browser-local detective pack now supports optional, backward-compatible authoring metadata without changing `detective-content-pack.v1`:

- `authoredCluster`: a safe lowercase slug grouping cases with a shared world conflict.
- `contrastKey`: a safe lowercase slug naming the case's distinct investigative contrast inside that cluster.
- `campaignTags`: public-safe lowercase tags used to connect cases, event archetypes, and progression lines.

The built-in pack contains six new authored case contrasts and four new event archetypes, for totals of 16 case types, 10 event archetypes, and 8 progression lines. Validation rejects invalid slugs, duplicate contrast keys within one cluster, orphan clusters, broken references, unsafe copy, and institution-incompatible directive mappings. Deterministic three-case planning selects distinct case types and distinct clusters before any repeat. The metadata guides content selection only; it never changes hard-logic identity paths, truth, evidence coverage, or judgement.

## Current Scope

This release is not a full commercial case editor. It focuses on the open-source engine workflow:

- Build from a high-quality template.
- Edit core mystery structure.
- Validate hard logic continuously.
- Save and reuse local drafts in the browser-only Case Gallery.
- Export a runnable artifact.
- Play the draft in Static Demo Runtime.

Future improvements can add object creation flows, richer reference management, diff previews, and collaborative case libraries.
