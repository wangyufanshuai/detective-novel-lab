import { adminGuard, adminOk, fail } from "@/app/api/v1/_utils";
import { worldRepository } from "@/lib/world/repository";

/** Protected operator view of recent admin authentication attempts. */
export async function GET(request: Request) {
  const unauthorized = adminGuard(request, { requireConfigured: true });
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit === null ? 50 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    return fail("BAD_REQUEST", "limit must be an integer between 1 and 200", 400);
  }

  return adminOk({
    events: worldRepository.listAdminAuditEvents(limit),
    limit,
    generatedAt: new Date().toISOString()
  });
}
