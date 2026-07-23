import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { worldRepository } from "@/lib/world/repository";

export async function GET(_request: Request, { params }: { params: Promise<{ packageId: string }> }) {
  try {
    const { packageId } = await params;
    if (!/^[a-z0-9._-]+$/i.test(packageId)) return fail("BAD_REQUEST", "Invalid packageId", 400);
    const detail = worldRepository.getPackageCatalogEntry(packageId);
    if (!detail) return fail("PACKAGE_NOT_FOUND", "Package catalog entry not found", 404);
    return ok(detail);
  } catch (error) {
    return errorResponse(error);
  }
}
