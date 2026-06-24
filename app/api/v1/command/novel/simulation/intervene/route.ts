import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { getEffectiveNovelProject, getNovelRuntimeRecord, saveNovelRuntimeRecord } from "@/app/api/v1/_novel-store";
import {
  applyNovelSimulationIntervention,
  compareNovelSimulationBranch,
  createNovelGameSceneState,
  createNovelGameVisualProfile,
  validateNovelSimulationRun,
  type NovelSimulationInterventionKind
} from "@/lib/engine";

type InterveneBody = {
  projectId?: string;
  runId?: string;
  actorEntityId?: string;
  kind?: NovelSimulationInterventionKind;
  value?: string | number | boolean;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<InterveneBody>(request, {});
    const record = getNovelRuntimeRecord(body.projectId);
    if (!record) return fail("NOVEL_PROJECT_NOT_FOUND", "Novel project not found", 404);
    const run = body.runId ? record.simulationRuns.find((item) => item.id === body.runId) : record.simulationRuns[0];
    if (!run) return fail("NOVEL_SIMULATION_NOT_FOUND", "Novel simulation not found", 404);
    if (!body.actorEntityId || !body.kind) return fail("BAD_REQUEST", "actorEntityId and kind are required");
    const effectiveProject = getEffectiveNovelProject(record);
    let nextRun = applyNovelSimulationIntervention(effectiveProject, run, {
      actorEntityId: body.actorEntityId,
      kind: body.kind,
      value: body.value ?? ""
    });
    const baseline = nextRun.parentRunId ? record.simulationRuns.find((item) => item.id === nextRun.parentRunId) : undefined;
    if (baseline) nextRun = { ...nextRun, branchComparison: compareNovelSimulationBranch(baseline, nextRun) };
    const nextRecord = saveNovelRuntimeRecord({
      ...record,
      simulationRuns: [nextRun, ...record.simulationRuns.filter((item) => item.id !== run.id)].slice(0, 10)
    });
    const validation = validateNovelSimulationRun(nextRun, effectiveProject, record.chapters);
    const scene = createNovelGameSceneState(nextRun, effectiveProject.mergedGraph);
    return ok({
      projectId: nextRecord.project.id,
      run: nextRun,
      validation,
      scene,
      visualProfile: createNovelGameVisualProfile(scene, effectiveProject.mergedGraph),
      intervention: nextRun.interventions[0] || null,
      updatedAt: nextRecord.updatedAt
    });
  } catch (error) {
    return errorResponse(error);
  }
}
