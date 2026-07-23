import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { validateScenarioPackInput } from "@/app/api/v1/_town-runtime";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ pack?: unknown }>(request, {});
    if (!body.pack) return fail("BAD_REQUEST", "pack is required");
    return ok({ validation: validateScenarioPackInput(body.pack) });
  } catch (error) {
    return errorResponse(error);
  }
}
