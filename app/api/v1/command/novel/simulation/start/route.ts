import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { getNovelRuntimeRecord, saveNovelRuntimeRecord } from "@/app/api/v1/_novel-store";
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
    const run = createNovelSimulationRun(record.project, {
      seed: body.seed || `${record.project.id}:agent-start`,
      mode: body.mode || "grounded-replay",
      throughChapterId: body.throughChapterId,
      branchStepLimit: body.branchStepLimit
    });
    const nextRecord = saveNovelRuntimeRecord({ ...record, simulationRuns: [run, ...record.simulationRuns.filter((item) => item.id !== run.id)].slice(0, 10) });
    const validation = validateNovelSimulationRun(run, record.project, record.chapters);
    const scene = createNovelGameSceneState(run, record.project.mergedGraph);
    return ok({
      projectId: nextRecord.project.id,
      run,
      validation,
      scene,
      visualProfile: createNovelGameVisualProfile(scene, record.project.mergedGraph),
      updatedAt: nextRecord.updatedAt
    });
  } catch (error) {
    return errorResponse(error);
  }
}
