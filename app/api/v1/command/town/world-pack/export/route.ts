import { errorResponse, fail, adminOk, adminGuard, readJson } from "@/app/api/v1/_utils";
import { findWorldPackageRegistryEntryById } from "@/app/api/v1/_world-package-registry";

export async function POST(request: Request) {
  try {
    const unauthorized = adminGuard(request);
    if (unauthorized) return unauthorized;
    const body = await readJson<{ packageId?: string; format?: "folder" | "zip" }>(request, {});
    if (!body.packageId) return fail("BAD_REQUEST", "packageId is required", 400);
    if (!/^[a-z0-9._-]+$/i.test(body.packageId)) return fail("BAD_REQUEST", "Invalid packageId", 400);
    if (body.format && body.format !== "folder") return fail("BAD_REQUEST", "Only folder export is supported without adding a zip dependency.", 400);
    const { exportWorldPackage } = await import("@/lib/world-package-catalog");
    const report = exportWorldPackage({ packageId: body.packageId, format: "folder" });
    const registryEntry = findWorldPackageRegistryEntryById(body.packageId);
    return adminOk({
      packageId: report.packageId,
      exportedAt: report.exportedAt,
      format: report.format,
      reportIncluded: report.reportIncluded,
      reportPath: report.reportPath,
      relativeExportPath: report.relativeExportPath,
      sourceRelativePath: report.sourceRelativePath,
      contentHash: report.contentHash,
      fileCount: report.fileCount,
      bytes: report.bytes,
      files: report.files,
      receipt: registryEntry?.worldPackageReceipt,
      validation: report.validation
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("was not found")) return fail("PACKAGE_NOT_FOUND", message, 404);
    if (message.includes("invalid")) return fail("WORLD_PACKAGE_INVALID", message, 400);
    return errorResponse(error);
  }
}
