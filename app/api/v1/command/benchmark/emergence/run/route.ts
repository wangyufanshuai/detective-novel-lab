import fs from "node:fs";
import path from "node:path";
import { renderEmergenceBenchmarkMarkdown, runEmergenceBenchmark } from "@/lib/engine";
import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";

function benchmarkSeeds(seedCount: 10 | 20) {
  return Array.from({ length: seedCount }, (_, index) => `emergence-benchmark-${String(index + 1).padStart(2, "0")}`);
}

export async function POST(request: Request) {
  try {
    const body = await readJson<{ seedCount?: 10 | 20 }>(request, {});
    const seedCount = body.seedCount ?? 20;
    if (seedCount !== 10 && seedCount !== 20) return fail("BAD_REQUEST", "seedCount must be 10 or 20");
    const report = runEmergenceBenchmark(benchmarkSeeds(seedCount));
    const outputDir = path.join(process.cwd(), "outputs");
    const jsonPath = path.join(outputDir, "emergence-benchmark.json");
    const markdownPath = path.join(outputDir, "emergence-benchmark.md");
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    fs.writeFileSync(markdownPath, renderEmergenceBenchmarkMarkdown(report), "utf8");
    return ok({
      report,
      outputFiles: {
        json: jsonPath,
        markdown: markdownPath
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
