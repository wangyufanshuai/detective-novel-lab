import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { getNovelRuntimeRecord, saveNovelRuntimeRecord } from "@/app/api/v1/_novel-store";
import { createNovelGameSceneState, createNovelGameVisualProfile, rewindNovelSimulation, validateNovelSimulationRun } from "@/lib/engine";

type RewindBody = {
  projectId?: string;
  runId?: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<RewindBody>(request, {});
    const record = getNovelRuntimeRecord(body.projectId);
    if (!record) return fail("NOVEL_PROJECT_NOT_FOUND", "Novel project not found", 404);
    const run = body.runId ? record.simulationRuns.find((item) => item.id === body.runId) : record.simulationRuns[0];
    if (!run) return fail("NOVEL_SIMULATION_NOT_FOUND", "Novel simulation not found", 404);
    const nextRun = rewindNovelSimulation(record.project, run);
    const nextRecord = saveNovelRuntimeRecord({
      ...record,
      simulationRuns: [nextRun, ...record.simulationRuns.filter((item) => item.id !== run.id)].slice(0, 10)
    });
    const validation = validateNovelSimulationRun(nextRun, record.project, record.chapters);
    const scene = createNovelGameSceneState(nextRun, record.project.mergedGraph);
    return ok({
      projectId: nextRecord.project.id,
      run: nextRun,
      validation,
      scene,
      visualProfile: createNovelGameVisualProfile(scene, record.project.mergedGraph),
      updatedAt: nextRecord.updatedAt
    });
  } catch (error) {
    return errorResponse(error);
  }
}
