# Architecture

Detective Town is organized as a deterministic engine, two runtime adapters, and a Next.js visual workbench.

## Flow

1. NPC schedules produce `WorldEvent` records.
2. Events produce scoped `MemoryRecord` entries and evidence.
3. A case is extracted from the event log and validated by local TypeScript rules.
4. The map snapshot and deduction graph are derived views; neither changes truth.
5. The player investigates, challenges testimony, and submits a theory.
6. Local rules judge the theory. DeepSeek may phrase dialogue or a solution, but cannot change facts.

## Main Boundaries

- `packages/engine/src`: world simulation, case extraction, validation, judgement, static runtime, maps, and deduction graphs.
- `lib/engine`: stable application-facing re-export.
- `app/page.tsx`: demo application and visual workbench.
- `app/api/v1`: stable Agent Control API wrappers.
- `lib/world/repository.ts`: SQLite persistence for server mode.
- `app/api/generate/route.ts`: legacy model adapter and novel/case stage router.
- `scripts/`: rule and API tests.

## Runtime Boundaries

- `static-demo`: deterministic Premium data and browser-local investigation state. No SQLite and no model request.
- `server`: SQLite persistence, Agent API, generated worlds, and optional DeepSeek dialogue.

Both runtimes call the same engine functions for discovery, testimony constraints, and theory judgement.
