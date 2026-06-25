# Persistent Agent Town

Persistent Agent Town is the server-runtime version of Detective Town. It keeps a running town in SQLite, stores runtime state inside the world JSON, and keeps writing new `WorldEvent` and `MemoryRecord` records as NPCs act.

## Runtime Loop

Each tick is local and deterministic:

```text
observe recent events
-> propagate direct, witness, rumor, and deduced memories
-> update goals, plans, pressure, risk, fatigue, and alertness
-> generate action candidates
-> score candidates with local rules
-> execute the best legal action
-> write WorldEvent, MemoryRecord, pressure ledger, and consequence records
-> build or update CaseCandidate records
```

DeepSeek is not used for action legality, event creation, culprit selection, evidence placement, case validation, or player judgement. It remains a surface-language layer for server-mode dialogue and optional prose.

## Town Situation Brief

The command center derives a compact, deterministic brief from the persisted runtime. It ranks location pressure and NPC risk, summarizes selected actions and observation provenance, reports case readiness, and points to the next missing emergence condition. Hot locations and risk NPCs are direct navigation targets in the UI.

`GET /api/v1/query/town/brief?worldId=...` exposes the same brief to external agents. The query is read-only: it does not advance ticks, mutate the runtime, or write to SQLite.

## Agent State

The Agent tab now opens with Review Mode: a compact summary of runtime health, scenario status, branch count, snapshot count, benchmark pass rate, and valid candidate count before the detailed agent cards.

Each NPC receives a persisted `NpcAgentState`:

- current goal and priority;
- short-term plan;
- known fact ids;
- relationship pressure;
- secret risk;
- resources;
- current location;
- fatigue and alertness.
- propagated memory count and last consequence summary.

The UI shows these in the `Agent` tab when the user opens **持续小镇 / Persistent Agent Town**.

## Action Scoring

Every candidate action includes a full `NpcActionScore`:

| Field | Meaning |
| --- | --- |
| `goalPriority` | How strongly the action serves the NPC's current goal. |
| `knownInformation` | Whether the NPC has enough visible knowledge to justify the action. |
| `relationshipPressure` | Whether social conflict or pressure makes the action plausible. |
| `resourceAvailability` | Whether required resources are present. |
| `locationReachability` | Whether the target location is reachable. |
| `risk` | How risky the action is for the NPC. |
| `evidenceConsistency` | Whether the action remains compatible with known world evidence. |
| `caseImpact` | Whether it can contribute to a conflict, clue, alibi, or candidate case. |
| `witnessExposure` | Whether the action can surface source events through same-location witnesses. |
| `rumorValue` | Whether known facts are useful enough to spread as rumor memory. |
| `alibiPressure` | Whether the NPC is trying to create a public exclusion trail. |
| `coverUpUrgency` | Whether secret risk makes a trace-hiding action plausible. |

Illegal candidates are retained in traces with a `blockedReason`, so failures remain inspectable instead of disappearing.

Core simulation actions now include `investigate`, `spread-rumor`, `seek-alibi`, `pressure`, and `cover-up` in addition to movement, observation, talk, confrontation, resource access, and trace hiding.

## Case Emergence Factory

The runtime builds `CaseCandidate` records from pressure chains:

- secret exposure;
- relationship pressure;
- resource or means contact;
- opportunity windows;
- cover-up or staging actions;
- alibi seeds;
- suspicious movement;
- memory-backed testimony;
- event-backed evidence.

Candidates must pass local validation before extraction:

- unique culprit;
- world-event-backed evidence;
- memory-scoped testimony;
- non-culprit exclusion chains;
- closed timeline;
- playable evidence chain.

Invalid candidates are still useful. Their validation report explains whether the missing piece is motive, means, opportunity, memory support, timeline depth, non-culprit exclusion seed, or hard-logic validation.

## Counterfactual Interventions

External agents and the UI can apply bounded interventions:

- NPC goal;
- location;
- resource;
- relationship pressure;
- knowledge visibility.

Interventions create a `counterfactual` branch and do not overwrite original world facts. The next tick carries the branch impact into the decision trace.

## Agent API

Main endpoints:

- `GET /api/v1/query/town/runtime?worldId=...`
- `GET /api/v1/query/town/agents?worldId=...`
- `GET /api/v1/query/town/agent?worldId=...&npcId=...`
- `GET /api/v1/query/town/candidates?worldId=...`
- `GET /api/v1/query/town/brief?worldId=...`
- `GET /api/v1/query/town/emergence-proof?worldId=...&candidateId=...`
- `GET /api/v1/query/town/scenario?worldId=...&scenarioId=...`
- `GET /api/v1/query/town/scenario/report?worldId=...&scenarioId=...`
- `GET /api/v1/query/town/snapshots?worldId=...`
- `GET /api/v1/query/town/snapshot/diff?worldId=...&from=...&to=...`
- `POST /api/v1/command/town/runtime/start`
- `POST /api/v1/command/town/runtime/pause`
- `POST /api/v1/command/town/runtime/step`
- `POST /api/v1/command/town/runtime/reset`
- `POST /api/v1/command/town/agent/intervene`
- `POST /api/v1/command/town/case/extract`
- `POST /api/v1/command/town/scenario/run`
- `POST /api/v1/command/town/snapshot/rollback`

## Playable Case Intake

`POST /api/v1/command/town/case/extract` keeps the existing response fields and may also return `playableIntake`. The intake is derived from the extracted `CaseFromLog`, source map, world events, memory counts, and current player session when available.

The intake is now backed by a deterministic Truth Ledger. The ledger rebuilds proof obligations for motive, means, opportunity, timeline, testimony contradiction, non-culprit exclusion, source backing, and final conclusion. Each required obligation must point to discoverable evidence plus a source event or memory before a candidate is considered fully playable. This keeps the candidate gate, player navigation, wrong-theory gaps, and final judgement on the same hard-logic rules.

Route Certificate is the next gate on top of Truth Ledger. It proves that a candidate can be completed through search, witness questioning, testimony challenge, evidence selection, and an accepted local `judgeTheory` submission. Emerged case extraction requires this certificate before persistence.

Auto-solve is the regression layer on top of Route Certificate. It builds a synthetic local player session, executes the certified search, witness, challenge, evidence-selection, and theory-submission steps, and requires the resulting `judgeTheory` plus proof coverage to pass. The default API path is dry-run; `persist=true` saves an isolated `auto-player` session only when the report passes, without touching real player progress.

Investigation Coach is the player completion layer on top of those checks. It converts the certified route, proof coverage, current session progress, and auto-solve report into a low-spoiler next step: join, search, question, challenge, select evidence, submit, or review source. The coach never calls DeepSeek and stays masked until the case is solved.

`GET /api/v1/query/case/proof-ledger?caseId=...&sessionId=...&includeCertificate=true` rebuilds the ledger, optional player coverage, and optional route certificate without mutating the case. Before the player solves the case, UI surfaces only low-spoiler obligation labels, certificate counts, and gap targets. After a correct theory, the Proof Ledger unlocks evidence ids, source events, memory ids, conclusion links, and the full certified route alongside Proof Tour.

The UI shows the intake before the player enters the investigation. It contains readiness score, route integrity, Route Certificate status, current progress, Coach step, six-stage chain status, source event and memory counts, evidence route hints, witness challenge planning, and spoiler-safe gaps.

The extraction command now applies a final playable-route gate before writing the extracted case to SQLite. A candidate must have a searchable evidence route, a witness route, at least one discoverable testimony challenge, and source-backed motive / means / opportunity / non-culprit exclusion coverage. Blocked candidates return `CASE_NOT_PLAYABLE` with low-spoiler reasons.

Before the case is solved, hidden source events are labeled generically and culprit-specific witness details are masked. After a correct theory is accepted, the same intake can expose the full source trail and conclusion nodes.

Smoke test:

```powershell
node scripts/run-persistent-town-api-smoke.mjs
node scripts/run-scenario-runner-api-smoke.mjs
```

## Scenario Runner And Time Machine

The Agent workbench presents Scenario Runner and Time Machine results as a review surface: pass/fail checks, branch comparison, copyable report JSON, snapshot timeline, baseline diff quick selection, expanded diff rows, and rollback confirmation.

Scenario Runner stores reproducible `ScenarioRun` reports on the runtime. Each run records a baseline branch plus optional counterfactual branches with scheduled interventions. The report compares event growth, memory growth, candidate counts, hard-logic availability, and branch diffs.

World State Time Machine stores tick snapshots on the runtime. Snapshot diffs show added events, added memories, changed agent fields, candidate status changes, and branch-only interventions. Rollback restores the runtime and world JSON checkpoint for a snapshot while leaving the SQLite event log as the durable audit trail.

## Tests

```powershell
npm run test:persistent-town
node scripts/run-persistent-town-api-smoke.mjs
node scripts/run-scenario-runner-api-smoke.mjs
```

The tests cover deterministic ticks, complete decision traces, action score fields, invalid-candidate failure reasons, playable extraction, and counterfactual intervention behavior.
