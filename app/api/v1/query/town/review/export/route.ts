import fs from "node:fs";
import path from "node:path";
import { loadRunArtifactFile } from "@/app/api/v1/_run-artifacts";
import { buildReviewExportBundle, loadRuntimeWorld, renderReviewExportMarkdown } from "@/app/api/v1/_town-runtime";
import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import type { EmergenceBenchmarkReport, ReviewExportBundle } from "@/lib/engine";

function readLatestBenchmark(includeBenchmark: boolean) {
  if (!includeBenchmark) return null;
  const reportPath = path.join(process.cwd(), "outputs", "emergence-benchmark.json");
  if (!fs.existsSync(reportPath)) return null;
  return JSON.parse(fs.readFileSync(reportPath, "utf8")) as EmergenceBenchmarkReport;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const worldId = url.searchParams.get("worldId");
    const scenarioId = url.searchParams.get("scenarioId");
    const runId = url.searchParams.get("runId");
    const fromId = url.searchParams.get("from");
    const toId = url.searchParams.get("to");
    const format = (url.searchParams.get("format") || "json").toLowerCase();
    const includeBenchmark = url.searchParams.get("includeBenchmark") === "true";
    if (!worldId) return fail("BAD_REQUEST", "worldId is required");
    if (format !== "json" && format !== "markdown") return fail("BAD_REQUEST", "format must be json or markdown");
    if (runId) {
      const artifactBundle = loadRunArtifactFile<ReviewExportBundle>(runId, "review-bundle.json");
      if (artifactBundle) {
        const content = format === "markdown"
          ? renderReviewExportMarkdown(artifactBundle)
          : `${JSON.stringify(artifactBundle, null, 2)}\n`;
        return ok({
          format,
          fileName: `${runId}-review-bundle.${format === "markdown" ? "md" : "json"}`,
          content,
          bundle: artifactBundle
        });
      }
    }
    const loaded = loadRuntimeWorld(worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const bundle = buildReviewExportBundle(loaded.world, loaded.runtime, {
      scenarioId,
      fromId,
      toId,
      benchmark: readLatestBenchmark(includeBenchmark)
    });
    if (!bundle) return fail("SCENARIO_NOT_FOUND", "Scenario not found", 404);
    const content = format === "markdown"
      ? renderReviewExportMarkdown(bundle)
      : `${JSON.stringify(bundle, null, 2)}\n`;
    return ok({
      format,
      fileName: `${bundle.scenario.id}-review-bundle.${format === "markdown" ? "md" : "json"}`,
      content,
      bundle
    });
  } catch (error) {
    return errorResponse(error);
  }
}
