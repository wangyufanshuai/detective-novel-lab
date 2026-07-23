import { errorResponse, ok } from "@/app/api/v1/_utils";

export async function GET() {
  try {
    const { listDatasetPackages } = await import("@/lib/dataset-package");
    return ok(listDatasetPackages());
  } catch (error) {
    return errorResponse(error);
  }
}
