import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { getEffectiveNovelProject, getNovelRuntimeRecord } from "@/app/api/v1/_novel-store";
import { createNovelGameSceneState, createNovelGameVisualProfile, validateNovelSimulationRun } from "@/lib/engine";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const projectId = params.get("projectId");
    const runId = params.get("runId");
    const record = getNovelRuntimeRecord(projectId);
    if (!record) return fail("NOVEL_PROJECT_NOT_FOUND", "Novel project not found", 404);
    const run = runId ? record.simulationRuns.find((item) => item.id === runId) : record.simulationRuns[0];
    if (!run) return fail("NOVEL_SIMULATION_NOT_FOUND", "Novel simulation not found", 404);
    const effectiveProject = getEffectiveNovelProject(record);
    const validation = validateNovelSimulationRun(run, effectiveProject, record.chapters);
    const scene = createNovelGameSceneState(run, effectiveProject.mergedGraph);
    const visualProfile = createNovelGameVisualProfile(scene, effectiveProject.mergedGraph);
    return ok({
      projectId: record.project.id,
      run,
      validation,
      scene,
      visualProfile,
      comparison: run.comparison,
      updatedAt: record.updatedAt
    });
  } catch (error) {
    return errorResponse(error);
  }
}
