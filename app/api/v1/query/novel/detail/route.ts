import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { getNovelRuntimeRecord } from "@/app/api/v1/_novel-store";
import { buildNovelCausalityReport } from "@/lib/engine";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const projectId = params.get("projectId");
    const type = params.get("type");
    const id = params.get("id");
    const record = getNovelRuntimeRecord(projectId);
    if (!record) return fail("NOVEL_PROJECT_NOT_FOUND", "Novel project not found", 404);
    if (!type || !id) return fail("BAD_REQUEST", "type and id are required");

    const graph = record.project.mergedGraph;
    const causality = buildNovelCausalityReport(record.project);
    const detail =
      type === "entity" ? graph.entities.find((item) => item.id === id)
        : type === "event" ? graph.events.find((item) => item.id === id)
          : type === "relationship" ? graph.relationships.find((item) => item.id === id)
            : type === "development" ? graph.development.find((item) => item.id === id)
              : type === "causal-claim" ? causality.claims.find((item) => item.id === id)
                : type === "causal-edge" ? causality.edges.find((item) => item.id === id)
                  : null;

    if (!detail) return fail("BAD_REQUEST", `No ${type} detail found for ${id}`, 404);
    return ok({ type, id, detail, projectId: record.project.id });
  } catch (error) {
    return errorResponse(error);
  }
}
