# Detective Town Agent SDK Starter

Zero-dependency Node client for the stable `/api/v1/*` Agent API. It uses native `fetch`, so run it with Node 18 or newer.

```js
import { DetectiveTownClient } from "./detective-town-client.mjs";

const client = new DetectiveTownClient({
  baseUrl: process.env.DETECTIVE_TOWN_BASE_URL || "http://127.0.0.1:3000"
});

const status = await client.runtimeStatus();
const created = await client.createTown({ seed: "sdk-readme", mode: "showcase", caseMode: "generated" });
await client.startRuntime(created.world.id, { steps: 2 });
const candidates = await client.listCandidates(created.world.id);

console.log(status.capabilities);
console.log(candidates.candidates.length);
```

Run against a local server:

```powershell
npm run dev -- -p 3000
$env:DETECTIVE_TOWN_BASE_URL="http://127.0.0.1:3000"
node examples/agent-client-node/index.mjs
node examples/scenario-runner/index.mjs
node examples/correction-bot/index.mjs
```

The client unwraps `{ ok: true, data }` responses. Failed calls throw `DetectiveTownApiError` with `status`, `path`, and the raw API payload.
