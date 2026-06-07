import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { worldRepository } from "@/lib/world/repository";

export async function GET(request: Request) {
  try {
    const caseId = new URL(request.url).searchParams.get("caseId");
    if (!caseId) return fail("BAD_REQUEST", "caseId is required");
    const caseFromLog = worldRepository.getCase(caseId);
    if (!caseFromLog) return fail("CASE_NOT_FOUND", "Case not found", 404);
    return ok({ caseFromLog });
  } catch (error) {
    return errorResponse(error);
  }
}
