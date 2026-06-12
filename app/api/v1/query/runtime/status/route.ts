import { ok } from "@/app/api/v1/_utils";
import { getAiModelName } from "@/lib/world/ai";
import { worldRepository } from "@/lib/world/repository";

export async function GET() {
  return ok({
    service: "detective-town",
    mode: "local-first",
    database: "sqlite",
    storage: worldRepository.storageHealth(),
    aiProvider: process.env.AI_PROVIDER || "deepseek",
    model: getAiModelName(),
    hasDeepSeekKey: Boolean(process.env.DEEPSEEK_API_KEY),
    capabilities: {
      detectiveTown: true,
      livingWorldLab: true,
      livingWorldAuditStudio: true,
      agentInterventionLoop: true,
      persistentAgentTown: true,
      caseEmergenceFactory: true,
      scenarioRunner: true,
      worldStateTimeMachine: true,
      benchmarkDashboard: true,
      staticDemo: true
    },
    version: "v1"
  });
}
