import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { getNovelRuntimeRecord, saveNovelRuntimeRecord } from "@/app/api/v1/_novel-store";
import { resolveNovelEntityIdentity } from "@/lib/engine";

type Body = {
  projectId?: string;
  decisionId?: string;
  status?: "confirmed" | "rejected";
};

export async function POST(request: Request) {
  try {
    const body = await readJson<Body>(request, {});
    if (!body.decisionId || !body.status) return fail("BAD_REQUEST", "decisionId and status are required");
    const record = getNovelRuntimeRecord(body.projectId);
    if (!record) return fail("NOVEL_PROJECT_NOT_FOUND", "Novel project not found", 404);
    const project = resolveNovelEntityIdentity(record.project, body.decisionId, body.status);
    if (project === record.project) return fail("NOVEL_IDENTITY_NOT_FOUND", "Identity decision not found", 404);
    const saved = saveNovelRuntimeRecord({ ...record, project });
    return ok({
      projectId: saved.project.id,
      project: saved.project,
      registry: saved.project.identityRegistry,
      simulationRuns: saved.simulationRuns,
      updatedAt: saved.updatedAt
    });
  } catch (error) {
    return errorResponse(error);
  }
}
