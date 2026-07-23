import { errorResponse, ok } from "@/app/api/v1/_utils";
import { worldRepository } from "@/lib/world/repository";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const result = worldRepository.listPackageCatalog({
      kind: params.get("kind") || undefined,
      source: params.get("source") || undefined,
      status: params.get("status") || undefined,
      limit: Number(params.get("limit") || "30"),
      offset: Number(params.get("offset") || "0")
    });
    return ok(result);
  } catch (error) {
    return errorResponse(error);
  }
}
