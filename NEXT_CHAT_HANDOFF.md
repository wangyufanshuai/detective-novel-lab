# Detective Town / Living World Lab Handoff

## Repository

- Local path: `E:\xuexi\detective-novel-lab`
- GitHub repo: `wangyufanshuai/detective-novel-lab`
- Branch: `main`
- Latest pushed commit: `03acff4 Add living world audit correction studio`

## Project Goal

Build Detective Town / Living World Lab into a top-tier open-source AI world simulation and fair-play deduction engine, competitive with projects like `4thfever/cultivation-world-simulator`.

Core positioning:

> A detective world engine where cases and narratives emerge from observable NPC lives.

Core differentiation:

- Cases are not directly written by an LLM.
- Cases emerge from world events, NPC memories, relationship pressure, causal chains, evidence placement, and local validation.
- DeepSeek is only used for surface language, dialogue, optional explanation polish, and extraction support.
- Local TypeScript rules decide actions, evidence validity, culprit uniqueness, testimony scope, case fairness, and player judgement.
- The project emphasizes observable worlds, auditable evidence, agent intervention, correction overlays, and explainable deduction.

## Current Major Capabilities

### Detective Town

- Static Demo Runtime: playable without API key or writable SQLite.
- Server Runtime: SQLite + DeepSeek + Agent API.
- Three built-in premium case templates:
  - `archive-blunt`
  - `clocktower-locked-room`
  - `clinic-poison`
- Pixel map main view.
- 24h timeline replay.
- Event log.
- NPC status, locations, evidence markers, murder markers, contradiction markers.
- Evidence Notebook.
- Proof Tour.
- Deduction Graph.
- Suspect Board.
- Wrong Theory gap cards.
- Solution reveal.
- Authoring Workbench for editing, validating, importing, exporting, and running playable case drafts.

### Persistent Agent Town

- Persistent town runtime.
- NPCs have goals, plans, known facts, relationship pressure, secret risk, resources, location, fatigue, and alertness.
- Each tick runs an agent decision loop:
  - observe events
  - update memory/beliefs
  - generate action candidates
  - locally score actions
  - execute chosen action
  - write `WorldEvent` and `MemoryRecord`
- Action scoring dimensions:
  - goal priority
  - known information
  - relationship pressure
  - resource availability
  - location reachability
  - risk
  - evidence consistency
  - case impact
- Case Emergence Factory builds case candidates from high-risk conflict chains.
- Emergence Queue shows risk chains, candidate status, validation results, and failure reasons.
- NPC interventions create counterfactual branches without overwriting original facts.

### Living World Lab

- Imports novel snippets, chapters, or world settings.
- Extracts:
  - entities
  - relationships
  - events
  - locations
  - factions
  - secrets
  - evidence references
- Supports:
  - World graph
  - Phaser game/canvas view
  - Replay
  - Ask
  - Causality
  - Theme
  - Character Arc
  - Map
  - Events
  - Writer blueprint
- Simulation conclusions are tagged as:
  - `source paragraph`
  - `inferred`
  - `counterfactual`
  - `gap`

### Living World Audit Studio

Latest completed version.

Capabilities:

- Novel Quality Audit.
- Trust Score hero.
- Metrics.
- Issue Queue.
- Suggested Fixes.
- Applied Corrections.
- Correction Inspector.
- `Original Extracted Graph` / `Corrected View` state indicator.
- Correction Overlay affects only corrected view.
- Original chapters, original evidence index, and original extracted graph are not modified.

Audit coverage:

- Missing evidence.
- Low confidence.
- Duplicate entities.
- Dangling relationship/event references.
- Merge conflicts.
- Causal chain gaps.
- Replay readiness.

Correction patch support:

- Rename entity.
- Merge entities.
- Change kind.
- Edit fields.
- Replace/add/remove evidence.
- Hide/restore object.
- Revert patch.

## Important API Surface

Keep all existing interfaces compatible:

- `/api/v1/query/*`
- `/api/v1/command/*`
- `/api/worlds/*`
- `/api/investigation/*`
- `/api/generate`

### Novel / Living World API

Existing:

- `POST /api/v1/command/novel/analyze`
- `POST /api/v1/command/novel/evidence-index`
- `POST /api/v1/command/novel/blueprint`
- `POST /api/v1/command/novel/ask`
- `POST /api/v1/command/novel/simulation/explain`

Audit / Correction API:

- `GET /api/v1/query/novel/audit?projectId=...`
- `GET /api/v1/query/novel/corrections?projectId=...`
- `GET /api/v1/query/novel/corrected-world-graph?projectId=...`
- `POST /api/v1/command/novel/correction/suggest`
- `POST /api/v1/command/novel/correction/apply`
- `POST /api/v1/command/novel/correction/dismiss`
- `POST /api/v1/command/novel/correction/revert`

Response shape:

```json
{ "ok": true, "data": {} }
```

Error shape:

```json
{ "ok": false, "error": { "code": "...", "message": "..." } }
```

## Key Files

### Frontend

- `app/page.tsx`
- `app/globals.css`
- `app/components/DetectiveTownUI.tsx`
- `app/components/NovelGameCanvas.tsx`

### API

- `app/api/v1/_novel-store.ts`
- `app/api/v1/_novel-correction.ts`
- `app/api/v1/query/novel/audit/route.ts`
- `app/api/v1/query/novel/corrections/route.ts`
- `app/api/v1/query/novel/corrected-world-graph/route.ts`
- `app/api/v1/command/novel/correction/apply/route.ts`
- `app/api/v1/command/novel/correction/dismiss/route.ts`
- `app/api/v1/command/novel/correction/revert/route.ts`
- `app/api/v1/command/novel/correction/suggest/route.ts`

### Engine

- `packages/engine/src/novel-world.ts`
- `packages/engine/src/persistent-town.ts`
- `packages/engine/src/world-simulator.ts`
- `packages/engine/src/premium-showcase.ts`
- `packages/engine/src/demo-runtime.ts`

### Tests And Scripts

- `scripts/run-novel-world-tests.mjs`
- `scripts/run-novel-agent-api-smoke.mjs`
- `scripts/run-agent-api-smoke.mjs`
- `scripts/run-persistent-town-api-smoke.mjs`
- `scripts/run-emergence-benchmark.mjs`
- `tests/e2e/launch.spec.ts`

### Docs

- `README.md`
- `docs/living-world-lab.md`
- `docs/agent-control-api.md`
- `docs/world-simulation-depth.md`
- `docs/first-case-guide.md`

## Latest Validation

Before commit `03acff4`, these passed:

```powershell
npm run build
npm run test
npm run test:novel-world
npm run eval
npm run benchmark:emergence
npm run test:e2e
node scripts/run-agent-api-smoke.mjs
node scripts/run-novel-agent-api-smoke.mjs
node scripts/run-persistent-town-api-smoke.mjs
```

Browser smoke:

- `http://127.0.0.1:3000/?runtime=static` loads.
- Page title: `Detective Town`.
- Observed console errors were Next dev-server HMR WebSocket handshake errors, not app runtime failures.

## Local Environment Rules

Never commit:

- `.env`
- `.env.local`
- `data/`
- `outputs/`
- `.next/`
- `test-results/`
- Playwright temporary artifacts

DeepSeek API keys must stay in local env files only. Do not write keys into source, docs, tests, screenshots, outputs, or commits.

## Recommended Next Version

The project is now feature-heavy. If continuing to push capability before launch polish, the highest-value next version is:

## Multi-Agent Scenario Runner + World State Time Machine

Purpose:

Turn the project from a playable world demo into a reproducible world experimentation platform.

### Feature 1: Multi-Agent Scenario Runner

Add scenario config files that can run batches of town simulations and interventions.

Suggested capabilities:

- `ScenarioConfig` JSON format.
- Batch simulation runner.
- Original vs counterfactual branch comparison.
- Scenario report export.
- Agent API for:
  - create scenario
  - run scenario
  - pause scenario
  - inspect scenario
  - export scenario report
- UI panel for scenario status, seeds, branches, pass/fail, and validation metrics.

Why it matters:

- Moves closer to `cultivation-world-simulator` style agent-world experimentation.
- Makes the project more than a single demo.
- Helps prove that the world model is controllable and reproducible.

### Feature 2: World State Time Machine

Add snapshot, rollback, and diff for world states.

Suggested capabilities:

- Tick snapshots.
- State diff.
- Memory diff.
- Relationship diff.
- Evidence diff.
- Case candidate diff.
- Timeline scrubber for comparing world evolution.
- API for querying snapshot and diff.

Why it matters:

- Makes persistent simulation credible.
- Makes debugging and benchmarking easier.
- Gives the UI a stronger “observable world” story.

### Feature 3: Agent API SDK Examples

Add examples so external developers can quickly use the API.

Suggested examples:

- `examples/agent-client-node`
- `examples/scenario-runner`
- `examples/correction-bot`
- `examples/case-emergence-bot`

Why it matters:

- Improves GitHub adoption.
- Makes the Agent API feel real, not just documented.

### Feature 4: Benchmark Dashboard

Make current benchmark outputs visible in the app.

Suggested capabilities:

- Emergence benchmark table.
- Seed pass/fail.
- Quality score.
- Hard logic failure reasons.
- Novel audit issue categories.
- Corrected graph improvement score.

Why it matters:

- Shows technical credibility.
- Proves this is not just a UI demo.

## Suggested New Chat Opening Prompt

Copy this into a new Codex chat:

```text
Continue development in E:\xuexi\detective-novel-lab.

Read NEXT_CHAT_HANDOFF.md first.

Current latest commit:
03acff4 Add living world audit correction studio
Already pushed to origin/main.

First steps:
1. cd E:\xuexi\detective-novel-lab
2. git status
3. npm run test
4. Read README.md, docs/living-world-lab.md, docs/agent-control-api.md
5. Do not commit .env/.env.local/data/outputs/.next/test-results/Playwright temporary artifacts.

Project goal:
Build Detective Town / Living World Lab into an open-source AI world simulation + fair-play deduction engine competitive with 4thfever/cultivation-world-simulator.

Current capabilities:
Detective Town, Static Demo, Server Runtime, three case templates, Evidence Notebook, Proof Tour, Deduction Graph, Authoring, Persistent Agent Town, Living World Lab, Novel World simulation, Audit Studio, Correction Overlay, Agent API.

Recommended next version:
Multi-Agent Scenario Runner + World State Time Machine + Agent API SDK Examples + Benchmark Dashboard.

After implementation, run:
npm run build
npm run test
npm run eval
npm run benchmark:emergence
npm run test:e2e
node scripts/run-agent-api-smoke.mjs
node scripts/run-novel-agent-api-smoke.mjs
node scripts/run-persistent-town-api-smoke.mjs

Then commit and push:
git -c http.proxy= -c https.proxy= push origin main
```

