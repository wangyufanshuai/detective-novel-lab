# World Simulation Depth

This project now has two complementary simulation layers:

- **Detective Town**: a hard-logic murder mystery engine. It simulates NPC life, extracts a case from `WorldEvent` logs, and validates fair-play deduction.
- **Living World Lab**: a broader observer workbench. It extracts a world graph from chapter text, replays source-backed actor decisions, and supports bounded interventions.

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
- simulation steps with legal action candidates and provenance.

## Replay Provenance

Every Living World replay step has one of four provenance values:

| Value | Meaning |
| --- | --- |
| `source` | The replay matched an extracted source event. |
| `inferred` | The engine inferred a local transition from supported state. |
| `counterfactual` | The user/agent intervention selected a bounded alternate action. |
| `gap` | The engine stopped because evidence or legal action support was missing. |

This makes failures useful. A `gap` is not hidden; it tells the author where the source model lacks enough support.

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
