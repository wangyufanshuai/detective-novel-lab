import { DetectiveTownClient } from "../sdk/detective-town-client.mjs";

const client = new DetectiveTownClient();

const created = await client.createTown({ seed: "scenario-runner-example", mode: "showcase", caseMode: "generated" });
const worldId = created.world.id;
const actorId = created.world.npcs[0].id;

const initialScenarios = await client.listScenarios(worldId);
const resourcePreset = initialScenarios.presets.find((preset) => preset.id === "resource-counterfactual") || initialScenarios.presets[0];

const savedPreset = await client.saveScenarioPreset(worldId, {
  id: "example-review-preset",
  name: "Example review preset",
  description: "Example custom preset saved from the SDK starter.",
  config: {
    ...resourcePreset.config,
    id: "example-review-preset",
    name: "Example review preset",
    seed: "scenario-runner-example-fixed",
    branches: [{
      id: "example-resource-branch",
      name: "Example resource branch",
      steps: 12,
      interventions: [{ atTickOffset: 1, intervention: { actorId, kind: "resource", value: "resource:example" } }]
    }]
  }
}, { overwrite: true });

const scenario = await client.runScenario(worldId, {
  ...savedPreset.preset.config,
  id: `example-scenario-${Date.now()}`
});

const scenariosAfterRun = await client.listScenarios(worldId);
const latestRun = scenariosAfterRun.runs[0];
const reviewBundle = await client.exportReviewBundle(worldId, {
  scenarioId: latestRun.id,
  from: scenario.report.baseline.startSnapshotId,
  to: scenario.report.baseline.endSnapshotId,
  format: "markdown",
  includeBenchmark: true
});

console.log(`Saved preset: ${savedPreset.preset.name}`);
console.log(`Latest run: ${latestRun.name} (${latestRun.status})`);
console.log(scenario.report.summary);
console.table(scenariosAfterRun.runs.map((run) => ({
  id: run.id,
  status: run.status,
  branches: run.branchCount,
  events: run.baselineEventGrowth,
  memories: run.baselineMemoryGrowth,
  valid: run.validCandidateCount
})));
console.log("--- Review Bundle Markdown ---");
console.log(reviewBundle.content.split("\n").slice(0, 18).join("\n"));

await client.deleteScenarioPreset(worldId, "example-review-preset");
