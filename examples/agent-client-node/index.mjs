import { DetectiveTownClient } from "../sdk/detective-town-client.mjs";

const client = new DetectiveTownClient();

const status = await client.runtimeStatus();
console.log("Capabilities:", status.capabilities);

const created = await client.createTown({ seed: "agent-client-example", mode: "showcase", caseMode: "generated" });
console.log("World:", created.world.id, "events:", created.events.length);

const started = await client.startRuntime(created.world.id, { steps: 2 });
console.log("Runtime tick:", started.runtime.tick, "candidates:", started.queue.candidates.length);
