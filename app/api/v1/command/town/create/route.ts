import { errorResponse, ok, readJson } from "@/app/api/v1/_utils";
import { createInitialWorld, createPremiumShowcaseWorld, extractCaseFromWorld, simulateDailyLife, simulateWorldTick, type CaseTemplateId, type MurderArchetype, type WorldMode } from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";

type CreateTownBody = {
  seed?: string;
  caseArchetype?: MurderArchetype | "auto";
  mode?: WorldMode;
  npcCount?: number;
  timelineHours?: number;
  preSimDays?: number;
  caseMode?: "premium" | "generated";
  caseTemplateId?: CaseTemplateId;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<CreateTownBody>(request, {});
    const mode = body.mode || "showcase";
    if (mode === "showcase" && (body.caseMode || "generated") === "premium") {
      const premium = createPremiumShowcaseWorld(body.seed || "premium-showcase", body.caseTemplateId || "archive-blunt");
      const savedWorld = worldRepository.saveWorld(premium.world);
      worldRepository.addEvents(premium.events);
      worldRepository.saveCase(premium.activeCase);
      return ok({ world: savedWorld, events: premium.events, activeCase: premium.activeCase, qualityReport: premium.activeCase.qualityReport, simulationReports: [] });
    }
    const world = createInitialWorld(body.seed || "detective-town-showcase", {
      mode,
      npcCount: body.npcCount || (mode === "advanced" ? 30 : 8),
      timelineHours: body.timelineHours || (mode === "advanced" ? 120 : 24),
      caseArchetype: body.caseArchetype === "auto" ? undefined : body.caseArchetype
    });
    const daily = simulateDailyLife(world, mode === "advanced" ? Math.max(3, Math.min(7, body.preSimDays || 5)) : 1, []);
    const tick = simulateWorldTick(daily.world, daily.events);
    const savedWorld = worldRepository.saveWorld(tick.world);
    worldRepository.addEvents([...daily.events, ...tick.events]);
    const events = worldRepository.getEvents(savedWorld.id);
    const activeCase = extractCaseFromWorld(savedWorld, events);
    savedWorld.activeCaseId = activeCase.id;
    worldRepository.saveWorld(savedWorld);
    worldRepository.saveCase(activeCase);
    return ok({ world: savedWorld, events, activeCase, qualityReport: activeCase.qualityReport, simulationReports: daily.reports });
  } catch (error) {
    return errorResponse(error);
  }
}
