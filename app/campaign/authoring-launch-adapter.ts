import { cloneLocal } from "@/app/lib/client-runtime";
import { validateAuthoringDraft, type AuthoringDraft, type DemoRuntimeState, type InvestigationProgress } from "@/lib/engine";

export function buildAuthoringRuntimeState(draft: AuthoringDraft, initialProgress: InvestigationProgress) {
  const report = validateAuthoringDraft(draft);
  if (!report.valid) return { valid: false as const, error: "The current draft failed hard logic validation and cannot run as a playable case." };
  const stamp = new Date().toISOString();
  const runtimeState: DemoRuntimeState = {
    mode: "static-demo",
    world: cloneLocal(draft.world),
    events: cloneLocal(draft.events),
    activeCase: cloneLocal(draft.caseFromLog),
    session: {
      id: `session-authoring-${Date.now()}`,
      worldId: draft.world.id,
      caseId: draft.caseFromLog.id,
      playerId: "player-authoring",
      displayName: "Author Test",
      discoveredEvidenceIds: [],
      interrogationLog: [],
      createdAt: stamp,
      updatedAt: stamp
    },
    progress: { ...initialProgress, joinedInvestigation: true },
    revealText: ""
  };
  return { valid: true as const, runtimeState };
}
