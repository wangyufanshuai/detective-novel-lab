import { errorResponse, fail, adminOk, adminGuard, readJson } from "@/app/api/v1/_utils";
import { validateTownMapPackInput } from "@/app/api/v1/_town-runtime";

export async function POST(request: Request) {
  try {
    const unauthorized = adminGuard(request);
    if (unauthorized) return unauthorized;
    const body = await readJson<{ pack?: unknown }>(request, {});
    if (!body.pack) return fail("BAD_REQUEST", "pack is required");
    return adminOk({ validation: validateTownMapPackInput(body.pack) });
  } catch (error) {
    return errorResponse(error);
  }
}
