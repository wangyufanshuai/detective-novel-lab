# Architecture

Deduction Engine is organized as an engine plus a demo application.

## Flow

1. The user provides a case brief.
2. `/api/generate` asks the model for structured JSON.
3. The local TypeScript rule engine validates the result.
4. If the case is invalid, the API asks the model to repair the structure.
5. The Web Workbench visualizes the resulting case.
6. The player investigates scenes, challenges characters, and submits a theory.
7. Local rules judge the theory. The model only explains the result.

## Main Boundaries

- `lib/engine`: public engine exports.
- `lib/deduction.ts`: current rule engine implementation and core types.
- `app/page.tsx`: demo application and visual workbench.
- `app/api/generate/route.ts`: model adapter and stage router.
- `scripts/`: rule and API tests.

The project intentionally avoids a database and account system. A case is a single JSON object that can be stored, exported, tested, and replayed.
