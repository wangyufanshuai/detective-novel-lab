import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { getNovelRuntimeRecord } from "@/app/api/v1/_novel-store";

export async function GET(request: Request) {
  try {
    const projectId = new URL(request.url).searchParams.get("projectId");
    if (!projectId) return fail("BAD_REQUEST", "projectId is required");
    const workspace = getNovelRuntimeRecord(projectId);
    if (!workspace) return fail("NOVEL_PROJECT_NOT_FOUND", "Novel project not found", 404);
    return ok({ workspace });
  } catch (error) {
    return errorResponse(error);
  }
}
