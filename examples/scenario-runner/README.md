# Scenario Runner Example

Runs a review-mode flow through the Agent API and shared SDK starter:

- list built-in scenario presets;
- save one custom preset;
- run a deterministic scenario from that preset;
- list run history;
- export a markdown review bundle;
- delete the temporary custom preset.

```powershell
node examples/scenario-runner/index.mjs
```

Set `DETECTIVE_TOWN_BASE_URL` to target a running server. Default: `http://127.0.0.1:3000`.
