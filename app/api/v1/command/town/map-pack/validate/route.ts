import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { validateTownMapPackInput } from "@/app/api/v1/_town-runtime";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ pack?: unknown }>(request, {});
    if (!body.pack) return fail("BAD_REQUEST", "pack is required");
    return ok({ validation: validateTownMapPackInput(body.pack) });
  } catch (error) {
    return errorResponse(error);
  }
}
