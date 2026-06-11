# Living World Lab

Living World Lab is the world-simulation workbench beside the default Detective Town investigation. It turns chapter text or a world fragment into an observable graph, then lets local rules replay and branch the world.

## Purpose

The goal is to prove that the project can model more than one fixed murder case:

- extract entities, factions, locations, items, relationships, events, development hooks, and paragraph evidence;
- merge analyzed chapters into a `NovelWorldProject`;
- build character state points, theme pressure signals, and causal chains;
- audit extraction quality and apply local correction overlays;
- run a grounded replay where local rules score action candidates;
- apply a bounded intervention and inspect the counterfactual branch;
- keep every claim marked as `source`, `inferred`, `counterfactual`, or `gap`.

DeepSeek can help extract or explain structure, but the replay state and action legality are local TypeScript decisions.

## UI

Open the app and choose **Living World Lab**.

The workbench has three main areas:

- Left rail: whole-book import, chapter queue, replay runs, ask history, causal focus, theme focus, character focus, project JSON.
- Center: Audit Studio, Phaser observer canvas, replay controls, world graph canvas, event timeline, ask view, arc view, causality view, writer view.
- Right inspector: selected entity, event, relationship, character state, audit issue, correction patch, simulation step, game actor, location, evidence, intervention editor, and blueprint detail.

The Phaser view is intentionally a visual observer, not a full RPG engine. It renders deterministic locations, actor sprites, paths, event markers, evidence heat, and branch effects from the engine state.

## Audit Studio

Audit Studio makes the extracted world repairable:

- `Trust Score` is computed from evidence coverage, reference integrity, unresolved conflicts, confidence, and correction completion.
- `Issue Queue` shows missing evidence, low confidence claims, duplicate entities, dangling references, merge conflicts, and replay-readiness gaps.
- `Suggested Fixes` are local `NovelCorrectionPatch` records generated from the audit report.
- `Applied Corrections` create a corrected view used by Map, Game, Replay, Causality, Theme, Character Arc, Ask, and Writer surfaces.
- Original chapters, paragraph evidence indexes, and the original extracted graph remain unchanged.

## Agent API

Living World Lab exposes an external observe/intervene loop:

```text
POST /api/v1/command/novel/import
GET  /api/v1/query/novel/world-graph
GET  /api/v1/query/novel/audit
POST /api/v1/command/novel/correction/suggest
POST /api/v1/command/novel/correction/apply
GET  /api/v1/query/novel/corrected-world-graph
POST /api/v1/command/novel/simulation/start
POST /api/v1/command/novel/simulation/advance
POST /api/v1/command/novel/simulation/intervene
GET  /api/v1/query/novel/simulation
```

`/api/v1/command/novel/simulation/intervene` supports the intervention kinds currently enforced by the engine:

- `location`
- `knowledge`
- `relationship-pressure`
- `resource`
- `body-capability`

The endpoint changes actor state only. It does not write new source facts or override Detective Town case truth.

Correction endpoints also stay local and deterministic. They do not call DeepSeek and do not edit source text; they only update the in-memory `correctionSet` for the current runtime project.

## Tests

```powershell
npm run test:novel-world
node scripts/run-novel-agent-api-smoke.mjs
```

The first command validates the engine helpers. The second starts a local server and verifies the API loop from import through intervention.
