import { ok } from "@/app/api/v1/_utils";
import { getAiModelName } from "@/lib/world/ai";

export async function GET() {
  return ok({
    service: "detective-town",
    mode: "local-first",
    database: "sqlite",
    aiProvider: process.env.AI_PROVIDER || "deepseek",
    model: getAiModelName(),
    hasDeepSeekKey: Boolean(process.env.DEEPSEEK_API_KEY),
    version: "v1"
  });
}
