import fs from "node:fs";
import path from "node:path";
import { errorResponse, ok } from "@/app/api/v1/_utils";
import type { EmergenceBenchmarkReport } from "@/lib/engine";

export async function GET() {
  try {
    const reportPath = path.join(process.cwd(), "outputs", "emergence-benchmark.json");
    if (!fs.existsSync(reportPath)) {
      return ok({ available: false, report: null });
    }
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as EmergenceBenchmarkReport;
    return ok({ available: true, report });
  } catch (error) {
    return errorResponse(error);
  }
}
