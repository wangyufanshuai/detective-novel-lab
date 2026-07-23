import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ runId?: string; datasetId?: string }>(request, {});
    const runId = body.runId || "campaign-campaign-validation-5000";
    if (!/^[a-z0-9._-]+$/i.test(runId)) return fail("BAD_REQUEST", "Invalid runId", 400);
    if (body.datasetId && !/^[a-z0-9._-]+$/i.test(body.datasetId)) return fail("BAD_REQUEST", "Invalid datasetId", 400);
    const { exportDatasetPackage } = await import("@/lib/dataset-package");
    return ok(exportDatasetPackage({ runId, datasetId: body.datasetId }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("was not found")) return fail("RUN_NOT_FOUND", message, 404);
    return errorResponse(error);
  }
}
