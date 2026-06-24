import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { getEffectiveNovelProject, getNovelRuntimeRecord, saveNovelRuntimeRecord } from "@/app/api/v1/_novel-store";
import { createNovelGameSceneState, createNovelGameVisualProfile, createNovelSimulationRun, validateNovelSimulationRun, type NovelSimulationMode } from "@/lib/engine";

type StartBody = {
  projectId?: string;
  seed?: string;
  mode?: NovelSimulationMode;
  throughChapterId?: string;
  branchStepLimit?: number;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<StartBody>(request, {});
    const record = getNovelRuntimeRecord(body.projectId);
    if (!record) return fail("NOVEL_PROJECT_NOT_FOUND", "Novel project not found", 404);
    const effectiveProject = getEffectiveNovelProject(record);
    const run = createNovelSimulationRun(effectiveProject, {
      seed: body.seed || `${record.project.id}:agent-start`,
      mode: body.mode || "grounded-replay",
      throughChapterId: body.throughChapterId,
      branchStepLimit: body.branchStepLimit
    });
    const nextRecord = saveNovelRuntimeRecord({ ...record, simulationRuns: [run, ...record.simulationRuns.filter((item) => item.id !== run.id)].slice(0, 10) });
    const validation = validateNovelSimulationRun(run, effectiveProject, record.chapters);
    const scene = createNovelGameSceneState(run, effectiveProject.mergedGraph);
    return ok({
      projectId: nextRecord.project.id,
      run,
      validation,
      scene,
      visualProfile: createNovelGameVisualProfile(scene, effectiveProject.mergedGraph),
      updatedAt: nextRecord.updatedAt
    });
  } catch (error) {
    return errorResponse(error);
  }
}
