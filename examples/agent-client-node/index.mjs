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

const status = await api("/api/v1/query/runtime/status");
console.log("Capabilities:", status.capabilities);

const created = await api("/api/v1/command/town/create", {
  method: "POST",
  body: JSON.stringify({ seed: "agent-client-example", mode: "showcase", caseMode: "generated" })
});
console.log("World:", created.world.id, "events:", created.events.length);

const started = await api("/api/v1/command/town/runtime/start", {
  method: "POST",
  body: JSON.stringify({ worldId: created.world.id, steps: 2 })
});
console.log("Runtime tick:", started.runtime.tick, "candidates:", started.queue.candidates.length);
