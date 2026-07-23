import { errorResponse, ok } from "@/app/api/v1/_utils";
import { listRunArtifactManifests } from "@/app/api/v1/_run-artifacts";

export async function GET(request: Request) {
  try {
    const limit = Number(new URL(request.url).searchParams.get("limit") || 20);
    return ok({ artifacts: listRunArtifactManifests(Math.max(1, Math.min(100, limit))) });
  } catch (error) {
    return errorResponse(error);
  }
}
