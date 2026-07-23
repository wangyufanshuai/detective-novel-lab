import { errorResponse, ok, readJson } from "@/app/api/v1/_utils";
import { syncReplayCatalogFromStore } from "@/app/api/v1/_replay-catalog";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ store?: string | null }>(request, {});
    return ok(await syncReplayCatalogFromStore({ store: body.store }));
  } catch (error) {
    return errorResponse(error);
  }
}
