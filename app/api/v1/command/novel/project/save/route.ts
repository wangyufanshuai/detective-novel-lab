import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { getNovelRuntimeRecord, saveNovelRuntimeRecord } from "@/app/api/v1/_novel-store";
import { normalizeNovelBatchQueue, normalizeNovelCorrectionSet, validateNovelWorldProject, type NovelPersistentWorkspace } from "@/lib/engine";
import { NovelProjectConflictError } from "@/lib/world/repository";

type Body = {
  workspace?: Partial<NovelPersistentWorkspace>;
  expectedUpdatedAt?: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<Body>(request, {});
    const project = body.workspace?.project;
    if (!project || project.version !== 2) return fail("BAD_REQUEST", "A NovelWorldProject v2 workspace is required");
    const validation = validateNovelWorldProject(project);
    if (!validation.valid) return fail("BAD_REQUEST", validation.errors[0] || "Novel project validation failed");
    const current = getNovelRuntimeRecord(project.id);
    if (current && !body.expectedUpdatedAt) {
      return fail("NOVEL_PROJECT_CONFLICT", `Novel project ${project.id} already exists on the server`, 409);
    }
    const workspace: NovelPersistentWorkspace = {
      version: 1,
      project,
      chapters: Array.isArray(body.workspace?.chapters) ? body.workspace.chapters : [],
      evidenceIndexes: body.workspace?.evidenceIndexes || {},
      simulationRuns: Array.isArray(body.workspace?.simulationRuns) ? body.workspace.simulationRuns : [],
      correctionSet: normalizeNovelCorrectionSet(body.workspace?.correctionSet, project),
      batchQueue: normalizeNovelBatchQueue(project, body.workspace?.batchQueue),
      updatedAt: body.workspace?.updatedAt || project.updatedAt
    };
    const saved = saveNovelRuntimeRecord(workspace, body.expectedUpdatedAt);
    return ok({ workspace: saved });
  } catch (error) {
    if (error instanceof NovelProjectConflictError) {
      return fail("NOVEL_PROJECT_CONFLICT", error.message, 409);
    }
    return errorResponse(error);
  }
}
