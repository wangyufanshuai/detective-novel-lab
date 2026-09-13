import { errorResponse, adminOk, adminGuard, readJson } from "@/app/api/v1/_utils";
import { syncReplayCatalogFromStore } from "@/app/api/v1/_replay-catalog";

export async function POST(request: Request) {
  try {
    const unauthorized = adminGuard(request);
    if (unauthorized) return unauthorized;
    const body = await readJson<{ store?: string | null }>(request, {});
    return adminOk(await syncReplayCatalogFromStore({ store: body.store }));
  } catch (error) {
    return errorResponse(error);
  }
}
