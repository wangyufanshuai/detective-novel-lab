# AI Safety

DeepSeek is used for surface language only. The server builds a restricted `NpcKnowledgeContext` before any model call.

## Allowed In NPC Prompts

- Current NPC public profile.
- Current NPC visible memories.
- Player-discovered evidence visible to that NPC.
- Current question and optional challenged evidence.

## Forbidden In NPC Prompts

- `truth.culpritId`.
- Full `trueTimeline`.
- Hidden method details not present in the NPC memory scope.
- Undiscovered decisive evidence.
- Global reasoning chain.

## Enforcement

- `auditPromptPayload` checks prompt payloads before evaluation.
- `evaluateNpcDialogue` flags early culprit leaks, hidden method leaks, ignored memory scope, and missed evidence challenges.
- If DeepSeek is unavailable, local rule-bound replies keep the game playable.
