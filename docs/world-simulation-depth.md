# World Simulation Depth

This project now has three complementary simulation layers:

- **Detective Town**: a hard-logic murder mystery engine. It simulates NPC life, extracts a case from `WorldEvent` logs, and validates fair-play deduction.
- **Persistent Agent Town**: a server-runtime loop where NPCs carry persistent goals, memories, plans, pressure, resources, and decision traces across ticks.
- **Living World Lab**: a broader observer workbench. It extracts a world graph from chapter text, audits extraction quality, applies local correction overlays, replays source-backed actor decisions, and supports bounded interventions.

## Local Rules Before Language

The important rule is the same in both layers: language is not the source of truth.

Detective Town validates:

- unique culprit;
- motive, means, opportunity;
- discoverable decisive evidence;
- memory-scoped testimony;
- non-culprit exclusion chains;
- reasoning coverage.

Living World Lab validates:

- graph references between entities, relationships, events, and development hooks;
- paragraph-backed evidence snippets;
- character state points tied to character entities;
- theme signals tied to known themes and chapter evidence;
- causal claims and chains with evidence;
- correction patches against their target objects and paragraph references;
- simulation steps with legal action candidates and provenance.

Audit Studio evaluates:

- evidence coverage;
- reference integrity;
- unresolved merge conflicts;
- extraction confidence;
- correction completion;
- whether corrected views remain valid without mutating original extraction results.

Persistent Agent Town validates:

- per-tick agent decision traces;
- complete action score fields;
- blocked action reasons for illegal choices;
- event and memory provenance for case candidates;
- candidate failure reasons before extraction;
- fair-play validation after a candidate becomes a playable case.

## Persistent Runtime Loop

Persistent Agent Town adds a long-running form of Detective Town:

```text
NPC state -> legal candidate actions -> local scoring -> WorldEvent -> MemoryRecord -> CaseCandidate -> validation
```

The runtime is deliberately stored inside existing world JSON instead of a new graph database. That keeps the project deployable as a local SQLite app while still making the agent loop observable through `/api/v1/query/town/*`.

Decision traces are first-class output. A failed or blocked candidate should answer "why did this not become a fair mystery?" instead of returning only `false`.

## Replay Provenance

Every Living World replay step has one of four provenance values:

| Value | Meaning |
| --- | --- |
| `source` | The replay matched an extracted source event. |
| `inferred` | The engine inferred a local transition from supported state. |
| `counterfactual` | The user/agent intervention selected a bounded alternate action. |
| `gap` | The engine stopped because evidence or legal action support was missing. |

This makes failures useful. A `gap` is not hidden; it tells the author where the source model lacks enough support.

## Correction Overlay Boundary

Living World corrections are overlays, not source rewrites:

- original chapter text stays unchanged;
- original paragraph evidence indexes stay unchanged;
- original extracted graph remains queryable through `/api/v1/query/novel/world-graph`;
- corrected output is queryable through `/api/v1/query/novel/corrected-world-graph`;
- every patch keeps an audit trail with created, applied, dismissed, or reverted status.

## Agent Intervention Boundary

Interventions are deliberately narrow. External agents can change actor conditions, but cannot directly edit world truth:

- actor location;
- actor knowledge availability;
- relationship pressure;
- resource possession;
- body capability.

After an intervention, the next branch remains bounded by `branchStepLimit` and is marked as counterfactual.

## Why This Matters

The comparison target is not "a nicer prompt." The target is an engine shape where a developer or agent can:

1. observe current state;
2. inspect source evidence;
3. decide an intervention;
4. apply it;
5. observe the changed branch;
6. evaluate whether the world still has enough evidence support.

That is the core step toward a persistent detective world.
