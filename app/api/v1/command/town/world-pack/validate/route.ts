import { errorResponse, fail, adminOk, adminGuard, readJson } from "@/app/api/v1/_utils";
import { findWorldPackageRegistryEntryById } from "@/app/api/v1/_world-package-registry";
import { validateWorldPackageFiles, type WorldPackageFiles } from "@/lib/engine";

export async function POST(request: Request) {
  try {
    const unauthorized = adminGuard(request);
    if (unauthorized) return unauthorized;
    const body = await readJson<{ packageId?: string; files?: Partial<WorldPackageFiles> }>(request, {});
    if (body.packageId) {
      if (!/^[a-z0-9._-]+$/i.test(body.packageId)) return fail("BAD_REQUEST", "Invalid packageId", 400);
      const { readWorldPackageFiles } = await import("@/lib/world-package-catalog");
      const validation = readWorldPackageFiles(body.packageId);
      if (!validation) return fail("PACKAGE_NOT_FOUND", "WorldPackage not found", 404);
      const { package: _package, ...publicValidation } = validation;
      return adminOk({ ...publicValidation, receipt: findWorldPackageRegistryEntryById(body.packageId)?.worldPackageReceipt });
    }
    if (!body.files) return fail("BAD_REQUEST", "packageId or files is required", 400);
    const validation = validateWorldPackageFiles(body.files);
    const { package: _package, ...publicValidation } = validation;
    return adminOk(publicValidation);
  } catch (error) {
    return errorResponse(error);
  }
}
