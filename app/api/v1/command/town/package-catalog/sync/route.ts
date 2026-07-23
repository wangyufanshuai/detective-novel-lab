import { errorResponse, ok } from "@/app/api/v1/_utils";
import { worldRepository } from "@/lib/world/repository";

export async function POST() {
  try {
    const { buildPackageCatalogIndex, writePackageCatalogIndex } = await import("@/lib/world-package-catalog");
    const index = buildPackageCatalogIndex();
    const indexPath = writePackageCatalogIndex(index);
    const sync = worldRepository.syncPackageCatalogIndex(index);
    return ok({ indexPath, summary: index.summary, sync: { ...sync, indexPath } });
  } catch (error) {
    return errorResponse(error);
  }
}
