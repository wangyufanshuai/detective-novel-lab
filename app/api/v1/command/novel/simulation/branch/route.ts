import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { getEffectiveNovelProject, getNovelRuntimeRecord, saveNovelRuntimeRecord } from "@/app/api/v1/_novel-store";
import {
  createNovelGameSceneState,
  createNovelGameVisualProfile,
  createNovelSimulationBranch,
  validateNovelSimulationRun,
  type NovelSimulationInterventionKind
} from "@/lib/engine";

type Body = {
  projectId?: string;
  baselineRunId?: string;
  stepIndex?: number;
  seed?: string;
  branchStepLimit?: number;
  intervention?: {
    actorEntityId?: string;
    kind?: NovelSimulationInterventionKind;
    value?: string | number | boolean;
  };
};

export async function POST(request: Request) {
  try {
    const body = await readJson<Body>(request, {});
    const record = getNovelRuntimeRecord(body.projectId);
    if (!record) return fail("NOVEL_PROJECT_NOT_FOUND", "Novel project not found", 404);
    const baseline = body.baselineRunId
      ? record.simulationRuns.find((run) => run.id === body.baselineRunId)
      : record.simulationRuns.find((run) => !run.parentRunId);
    if (!baseline) return fail("NOVEL_SIMULATION_NOT_FOUND", "Baseline simulation not found", 404);
    const stepIndex = body.stepIndex ?? baseline.currentStepIndex;
    if (stepIndex < 0 || stepIndex > baseline.steps.length) return fail("BAD_REQUEST", "stepIndex must reference a completed baseline checkpoint");
    if (body.intervention && (!body.intervention.actorEntityId || !body.intervention.kind)) {
      return fail("BAD_REQUEST", "intervention actorEntityId and kind are required");
    }
    const effectiveProject = getEffectiveNovelProject(record);
    const branch = createNovelSimulationBranch(effectiveProject, baseline, {
      stepIndex,
      seed: body.seed,
      branchStepLimit: body.branchStepLimit,
      intervention: body.intervention?.actorEntityId && body.intervention.kind ? {
        actorEntityId: body.intervention.actorEntityId,
        kind: body.intervention.kind,
        value: body.intervention.value ?? ""
      } : undefined
    });
    const saved = saveNovelRuntimeRecord({
      ...record,
      simulationRuns: [branch, ...record.simulationRuns.filter((run) => run.id !== branch.id)].slice(0, 10)
    });
    const validation = validateNovelSimulationRun(branch, effectiveProject, record.chapters);
    const scene = createNovelGameSceneState(branch, effectiveProject.mergedGraph);
    return ok({
      projectId: saved.project.id,
      baselineRunId: baseline.id,
      run: branch,
      validation,
      scene,
      visualProfile: createNovelGameVisualProfile(scene, effectiveProject.mergedGraph),
      comparison: branch.branchComparison,
      updatedAt: saved.updatedAt
    });
  } catch (error) {
    return errorResponse(error);
  }
}
