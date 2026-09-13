import { adminGuard, adminOk, fail } from "@/app/api/v1/_utils";
import { worldRepository } from "@/lib/world/repository";

/** Protected operator metrics projection. It contains aggregate counts only. */
export async function GET(request: Request) {
  const unauthorized = adminGuard(request, { requireConfigured: true });
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const rawWindow = url.searchParams.get("windowMinutes");
  const windowMinutes = rawWindow === null ? 60 : Number(rawWindow);
  if (!Number.isInteger(windowMinutes) || windowMinutes < 1 || windowMinutes > 24 * 60) {
    return fail("BAD_REQUEST", "windowMinutes must be an integer between 1 and 1440", 400);
  }

  return adminOk({
    metrics: worldRepository.getAdminOperationalMetrics(windowMinutes),
    generatedAt: new Date().toISOString()
  });
}
