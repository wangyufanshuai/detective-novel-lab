const baseUrl = process.env.DETECTIVE_TOWN_BASE_URL || "http://127.0.0.1:3000";

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) }
  });
  const json = await response.json();
  if (!response.ok || json.ok === false) throw new Error(JSON.stringify(json));
  return json.data;
}

const created = await api("/api/v1/command/town/create", {
  method: "POST",
  body: JSON.stringify({ seed: "scenario-runner-example", mode: "showcase", caseMode: "generated" })
});
const actorId = created.world.npcs[0].id;

const scenario = await api("/api/v1/command/town/scenario/run", {
  method: "POST",
  body: JSON.stringify({
    worldId: created.world.id,
    config: {
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
    }
  })
});

console.log(scenario.report.summary);
console.table(scenario.report.branches.map((branch) => ({
  branch: branch.name,
  events: branch.eventGrowth,
  memories: branch.memoryGrowth,
  changedAgents: branch.diffFromBaseline.changedAgents.length
})));
