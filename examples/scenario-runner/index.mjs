import { DetectiveTownClient } from "../sdk/detective-town-client.mjs";

const client = new DetectiveTownClient();

const created = await client.createTown({ seed: "scenario-runner-example", mode: "showcase", caseMode: "generated" });
const actorId = created.world.npcs[0].id;

const scenario = await client.runScenario(created.world.id, {
  id: "example-scenario",
  name: "Example counterfactual scenario",
  seed: "scenario-runner-example-fixed",
  baselineSteps: 6,
  branches: [{
    id: "resource-counterfactual",
    name: "Resource counterfactual",
    steps: 6,
    interventions: [{ atTickOffset: 1, intervention: { actorId, kind: "resource", value: "resource:example" } }]
  }],
  passCriteria: { minEventGrowth: 3, minMemoryGrowth: 3, maxBlockedCandidates: 8 }
});

console.log(scenario.report.summary);
console.table(scenario.report.branches.map((branch) => ({
  branch: branch.name,
  events: branch.eventGrowth,
  memories: branch.memoryGrowth,
  changedAgents: branch.diffFromBaseline.changedAgents.length
})));
