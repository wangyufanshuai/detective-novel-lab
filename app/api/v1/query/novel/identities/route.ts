import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { getNovelRuntimeRecord } from "@/app/api/v1/_novel-store";
import { normalizeNovelEntityIdentityRegistry } from "@/lib/engine";

export async function GET(request: Request) {
  try {
    const projectId = new URL(request.url).searchParams.get("projectId");
    const record = getNovelRuntimeRecord(projectId);
    if (!record) return fail("NOVEL_PROJECT_NOT_FOUND", "Novel project not found", 404);
    const registry = normalizeNovelEntityIdentityRegistry(record.project.identityRegistry);
    return ok({
      projectId: record.project.id,
      registry,
      counts: registry.decisions.reduce<Record<string, number>>((counts, decision) => {
        counts[decision.status] = (counts[decision.status] || 0) + 1;
        return counts;
      }, {}),
      updatedAt: record.updatedAt
    });
  } catch (error) {
    return errorResponse(error);
  }
}
