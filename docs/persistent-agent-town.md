# Persistent Agent Town

Persistent Agent Town is the server-runtime version of Detective Town. It keeps a running town in SQLite, stores runtime state inside the world JSON, and keeps writing new `WorldEvent` and `MemoryRecord` records as NPCs act.

## Runtime Loop

Each tick is local and deterministic:

```text
observe recent events
-> update memories and known facts
-> generate action candidates
-> score candidates with local rules
-> execute the best legal action
-> write WorldEvent and MemoryRecord
-> build or update CaseCandidate records
```

DeepSeek is not used for action legality, event creation, culprit selection, evidence placement, case validation, or player judgement. It remains a surface-language layer for server-mode dialogue and optional prose.

## Agent State

Each NPC receives a persisted `NpcAgentState`:

- current goal and priority;
- short-term plan;
- known fact ids;
- relationship pressure;
- secret risk;
- resources;
- current location;
- fatigue and alertness.

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

Illegal candidates are retained in traces with a `blockedReason`, so failures remain inspectable instead of disappearing.

## Case Emergence Factory

The runtime builds `CaseCandidate` records from pressure chains:

- secret exposure;
- relationship pressure;
- resource or means contact;
- opportunity windows;
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

Invalid candidates are still useful. Their validation report explains whether the missing piece is motive, means, opportunity, exclusion evidence, timeline closure, or hard-logic validation.

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
- `GET /api/v1/query/town/emergence-proof?worldId=...&candidateId=...`
- `POST /api/v1/command/town/runtime/start`
- `POST /api/v1/command/town/runtime/pause`
- `POST /api/v1/command/town/runtime/step`
- `POST /api/v1/command/town/runtime/reset`
- `POST /api/v1/command/town/agent/intervene`
- `POST /api/v1/command/town/case/extract`

Smoke test:

```powershell
node scripts/run-persistent-town-api-smoke.mjs
```

## Tests

```powershell
npm run test:persistent-town
node scripts/run-persistent-town-api-smoke.mjs
```

The tests cover deterministic ticks, complete decision traces, action score fields, invalid-candidate failure reasons, playable extraction, and counterfactual intervention behavior.
