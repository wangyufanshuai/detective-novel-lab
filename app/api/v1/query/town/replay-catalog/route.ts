import { errorResponse, ok } from "@/app/api/v1/_utils";
import type { ReplayCatalogListFilters } from "@/lib/replay-catalog-types";
import { worldRepository } from "@/lib/world/repository";

function parseReplayCatalogFilters(url: string): ReplayCatalogListFilters {
  const params = new URL(url).searchParams;
  const numberParam = (name: string) => {
    const raw = params.get(name);
    if (!raw) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  return {
    kind: params.get("kind") || undefined,
    status: params.get("status") || undefined,
    experimentId: params.get("experimentId") || undefined,
    seed: params.get("seed") || undefined,
    minTicks: numberParam("minTicks"),
    limit: numberParam("limit"),
    offset: numberParam("offset")
  };
}

export async function GET(request: Request) {
  try {
    return ok(worldRepository.listReplayCatalogRuns(parseReplayCatalogFilters(request.url)));
  } catch (error) {
    return errorResponse(error);
  }
}
