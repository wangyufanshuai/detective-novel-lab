import { POST as interrogate } from "@/app/api/investigation/interrogate/route";
import { errorResponse, fail, playerOk, type ApiErrorCode } from "@/app/api/v1/_utils";

// Keep the v1 envelope while sharing validation and atomic persistence with
// the player endpoint. Both entry points must enforce the same evidence rules.
export async function POST(request: Request) {
  try {
    const response = await interrogate(request);
    const { ok: succeeded, code, error, ...data } = await response.json();
    if (!succeeded) return fail((code || "INTERNAL_ERROR") as ApiErrorCode, error, response.status);
    return playerOk(data);
  } catch (error) {
    return errorResponse(error);
  }
}
