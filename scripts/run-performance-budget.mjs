import fs from "node:fs";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { loadEngineForTool } from "./load-engine-for-tools.mjs";

const jsonMode = process.argv.includes("--json");
const root = process.cwd();
const budgets = {
  pageLines: 1100,
  detectiveTownUiLines: 1000,
  globalCssLines: 5500,
  investigationSurfaceLines: 350,
  investigationCoreSurfaceLines: 700,
  investigationRouteSurfaceLines: 700,
  investigationReplaySurfaceLines: 700,
  investigationWorkspaceModelLines: 500,
  certifiedInvestigationActionLines: 500,
  certifiedPlaythroughActionLines: 300,
  investigationNavigationActionLines: 350,
  investigationWorkspacePresentationLines: 400,
  certifiedCaseAuditModelLines: 250,
  certifiedCaseRhythmModelLines: 300,
  certifiedCaseRhythmHookLines: 50,
  certifiedCaseRhythmActionLines: 80,
  certifiedCaseRhythmSurfaceLines: 100,
  certifiedCaseRhythmCssLines: 180,
  commandDeckShellLines: 500,
  commandDeckShellCssLines: 560,
  commandDeckResponsiveCssLines: 320,
  townPulseBarCssLines: 120,
  worldCampaignPresentationLines: 350,
  manualReplayDrillActionLines: 200,
  authoringLaunchAdapterLines: 100,
  investigationGraphSurfaceLines: 100,
  strategicPacingModelLines: 500,
  campaignPacingModelLines: 350,
  campaignCatalogLines: 450,
  authoredCampaignCaseLines: 600,
  campaignFrontDoorModelLines: 140,
  campaignFrontDoorSurfaceLines: 180,
  campaignFrontDoorCssLines: 360,
  campaignFrontDoorRoutesCssLines: 160,
  campaignLaunchActionLines: 220,
  campaignTransitionModelLines: 350,
  campaignTransitionHookLines: 250,
  overlayArbiterHookLines: 150,
  campaignTransitionSurfaceLines: 200,
  campaignTransitionCssLines: 250,
  worldCampaignSurfaceLines: 300,
  largestCampaignSubsurfaceLines: 400,
  largestPacingSurfaceLines: 500,
  districtFrontModelLines: 500,
  districtFrontComponentLines: 500,
  districtFrontCssLines: 500,
  campaignCommandBriefModelLines: 300,
  campaignCommandBriefHookLines: 80,
  guidedManualViewModelLines: 250,
  theorySubmissionActionLines: 500,
  guidedManualActionLines: 500,
  apiRouteFiles: 130,
  runtimeJsonBytes: 4_000_000,
  p95TickMs: 250
};

function lineCount(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").split(/\r?\n/).length;
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(target) : [target];
  });
}

const engine = await loadEngineForTool("performance-budget");
let world = engine.createInitialWorld("performance-budget", { mode: "showcase", npcCount: 8, timelineHours: 24 });
const daily = engine.simulateDailyLife(world, 1, []);
world = daily.world;
let events = [...daily.events];
let runtime = engine.createPersistentTownRuntime(world, events, { maxTicks: 96 });
const durations = [];

for (let index = 0; index < 24; index += 1) {
  const start = performance.now();
  const advanced = engine.advancePersistentTownTick(world, events, { steps: 1, status: "running", actionEveryTicks: 2 });
  durations.push(performance.now() - start);
  world = advanced.world;
  runtime = advanced.runtime;
  events = [...events, ...advanced.events];
}

const sorted = [...durations].sort((left, right) => left - right);
const metrics = {
  pageLines: lineCount("app/page.tsx"),
  detectiveTownUiLines: lineCount("app/components/DetectiveTownUI.tsx"),
  globalCssLines: lineCount("app/globals.css"),
  investigationSurfaceLines: lineCount("app/components/InvestigationSurface.tsx"),
  investigationCoreSurfaceLines: lineCount("app/components/InvestigationCoreActionsSurface.tsx"),
  investigationRouteSurfaceLines: lineCount("app/components/InvestigationRouteReviewSurface.tsx"),
  investigationReplaySurfaceLines: lineCount("app/components/InvestigationDebriefReplaySurface.tsx"),
  investigationWorkspaceModelLines: lineCount("app/campaign/investigation-workspace-model.ts"),
  certifiedInvestigationActionLines: lineCount("app/hooks/useCertifiedInvestigationActions.ts"),
  certifiedPlaythroughActionLines: lineCount("app/hooks/useCertifiedPlaythroughActions.ts"),
  investigationNavigationActionLines: lineCount("app/hooks/useInvestigationNavigationActions.ts"),
  investigationWorkspacePresentationLines: lineCount("app/hooks/useInvestigationWorkspacePresentation.ts"),
  certifiedCaseAuditModelLines: lineCount("app/hooks/useCertifiedCaseAuditModels.ts"),
  certifiedCaseRhythmModelLines: lineCount("app/campaign/certified-case-rhythm-model.ts"),
  certifiedCaseRhythmHookLines: lineCount("app/hooks/useCertifiedCaseRhythm.ts"),
  certifiedCaseRhythmActionLines: lineCount("app/hooks/useCertifiedCaseRhythmActions.ts"),
  certifiedCaseRhythmSurfaceLines: lineCount("app/components/CertifiedCaseRhythmSurface.tsx"),
  certifiedCaseRhythmCssLines: lineCount("app/components/CertifiedCaseRhythmSurface.module.css"),
  commandDeckShellLines: lineCount("app/components/CommandDeckShell.tsx"),
  commandDeckShellCssLines: lineCount("app/components/CommandDeckShell.module.css"),
  commandDeckResponsiveCssLines: lineCount("app/components/CommandDeckShell.responsive.module.css"),
  townPulseBarCssLines: lineCount("app/components/TownPulseBar.module.css"),
  worldCampaignPresentationLines: lineCount("app/hooks/useWorldCampaignPresentation.ts"),
  manualReplayDrillActionLines: lineCount("app/hooks/useManualReplayDrillActions.ts"),
  authoringLaunchAdapterLines: lineCount("app/campaign/authoring-launch-adapter.ts"),
  investigationGraphSurfaceLines: lineCount("app/components/InvestigationGraphSurface.tsx"),
  strategicPacingModelLines: lineCount("app/campaign/strategic-pacing-model.ts"),
  campaignPacingModelLines: lineCount("app/campaign/campaign-pacing-model.ts"),
  campaignCatalogLines: lineCount("packages/engine/src/town/campaign-catalog.ts"),
  authoredCampaignCaseLines: lineCount("packages/engine/src/town/authored-campaign-cases.ts"),
  campaignFrontDoorModelLines: lineCount("app/campaign/campaign-front-door-model.ts"),
  campaignFrontDoorSurfaceLines: lineCount("app/components/CampaignFrontDoor.tsx"),
  campaignFrontDoorCssLines: lineCount("app/components/CampaignFrontDoor.module.css"),
  campaignFrontDoorRoutesCssLines: lineCount("app/components/CampaignFrontDoor.routes.module.css"),
  campaignLaunchActionLines: lineCount("app/hooks/useCampaignLaunchActions.ts"),
  campaignTransitionModelLines: lineCount("app/campaign/campaign-transition-model.ts"),
  campaignTransitionHookLines: lineCount("app/hooks/useCampaignTransitionTheatre.ts"),
  overlayArbiterHookLines: lineCount("app/hooks/useCommandDeckOverlayArbiter.ts"),
  campaignTransitionSurfaceLines: lineCount("app/components/CampaignTransitionTheatre.tsx"),
  campaignTransitionCssLines: lineCount("app/components/CampaignTransitionTheatre.module.css"),
  worldCampaignSurfaceLines: lineCount("app/components/WorldCampaignPanel.tsx"),
  largestCampaignSubsurfaceLines: Math.max(
    lineCount("app/components/CampaignJourneySurfaces.tsx"),
    lineCount("app/components/WorldCampaignLifecycleSurfaces.tsx"),
    lineCount("app/components/WorldCampaignOperationSurfaces.tsx")
  ),
  largestPacingSurfaceLines: Math.max(
    lineCount("app/components/StrategicCommandSurfaces.tsx"),
    lineCount("app/components/StrategicPacingSurface.tsx"),
    lineCount("app/hooks/useReviewWorkflowActions.ts"),
    lineCount("app/hooks/useCampaignWorldChoiceActions.ts"),
    lineCount("app/hooks/useReplaySessionActions.ts")
  ),
  districtFrontModelLines: lineCount("app/campaign/district-strategic-front-model.ts"),
  districtFrontComponentLines: lineCount("app/components/DistrictStrategicFronts.tsx"),
  districtFrontCssLines: lineCount("app/components/DistrictStrategicFronts.module.css"),
  campaignCommandBriefModelLines: lineCount("app/campaign/campaign-command-brief-model.ts"),
  campaignCommandBriefHookLines: lineCount("app/hooks/useCampaignCommandBrief.ts"),
  guidedManualViewModelLines: lineCount("app/hooks/useGuidedManualViewModel.ts"),
  theorySubmissionActionLines: lineCount("app/hooks/useTheorySubmissionActions.ts"),
  guidedManualActionLines: lineCount("app/hooks/useGuidedManualActions.ts"),
  apiRouteFiles: listFiles(path.join(root, "app", "api")).filter((file) => file.endsWith(`${path.sep}route.ts`)).length,
  runtimeJsonBytes: Buffer.byteLength(JSON.stringify(runtime), "utf8"),
  p95TickMs: Number(sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)].toFixed(2))
};
const failures = Object.entries(budgets)
  .filter(([key, limit]) => metrics[key] > limit)
  .map(([key, limit]) => `${key} ${metrics[key]} exceeds ${limit}`);
const result = { ok: failures.length === 0, sampleTicks: durations.length, metrics, budgets, failures };
console.log(jsonMode ? JSON.stringify(result) : JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
