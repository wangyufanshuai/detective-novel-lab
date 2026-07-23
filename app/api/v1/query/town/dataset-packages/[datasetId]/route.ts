import { errorResponse, fail, ok } from "@/app/api/v1/_utils";

export async function GET(_request: Request, { params }: { params: Promise<{ datasetId: string }> }) {
  try {
    const { datasetId } = await params;
    if (!/^[a-z0-9._-]+$/i.test(datasetId)) return fail("BAD_REQUEST", "Invalid datasetId", 400);
    const { getDatasetPackage } = await import("@/lib/dataset-package");
    const manifest = getDatasetPackage(datasetId);
    if (!manifest) return fail("DATASET_PACKAGE_NOT_FOUND", `Dataset package ${datasetId} was not found.`, 404);
    return ok(manifest);
  } catch (error) {
    return errorResponse(error);
  }
}
