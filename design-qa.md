# Design QA: Interactive Director Command Center

Status: passed

## Scope

- Surface: Persistent Agent Town full-width command center only.
- Reference: user-provided Product Design image `C:\WINDOWS\TEMP\codex-clipboard-c36ba965-4f6a-4730-aeca-00e067d25a93.png`.
- Note: the original temporary reference file expired before final artifact generation. The visual target was inspected from the conversation attachment, and the comparison artifact records that constraint.

## Evidence

- Desktop main screenshot: `test-results/qa-screenshots/command-center-desktop-1920x1080.png`
- Desktop action-bias screenshot: `test-results/qa-screenshots/command-center-action-bias-1920x1080.png`
- Pixel 7 mobile screenshot: `test-results/qa-screenshots/command-center-pixel-7.png`
- Static demo production screenshot: `test-results/qa-screenshots/static-demo-production-1920.png`
- Design comparison artifact: `test-results/qa-screenshots/design-comparison.png`

## Product Design Checks

| Check | Result | Notes |
| --- | --- | --- |
| Dark detective RPG visual system | Passed | Black-gold frame system, warm amber emphasis, red phase/risk and green pass states are present. |
| Full-width command layout | Passed | HUD, left archive/control rail, map, scene feed, NPC dossier/action rail, candidate board, memory/time/benchmark modules are present. |
| Generated high-fidelity assets | Passed | Replaced placeholder SVGs with generated WebP map, crest, and 8 NPC portraits under `public/command-center/`. |
| Functional navigation | Passed | Left map/action/memory/queue/time menu changes focus and supports mobile collapse. |
| Map interactions | Passed | Zoom, reset, drag pan, NPC/evidence/event filters, and data-driven overlays work in E2E. |
| Action cards | Passed | Expanded scoring, risk, director bias, reasons, expected impact, and "bias next Tick" action are visible. |
| Scenario/Time Machine continuity | Passed | Existing scenario, snapshot, diff, rollback cancel, benchmark, and extraction flows remain available. |
| Chinese UI copy | Passed | Core command-center labels and scoring reasons are Chinese. Raw fact ids remain as technical identifiers by design. |
| Mobile layout | Passed | Pixel 7 viewport has no page-level horizontal overflow and shows compact HUD before the map. |
| Static demo isolation | Passed | Production static demo made 0 `/api/*` requests and had 0 console/page errors. |

## Issues Found And Fixed

| Severity | Issue | Fix |
| --- | --- | --- |
| P1 | Mobile HUD occupied too much vertical space and delayed the map too far. | Added compact mobile HUD grid and module ordering so the map appears immediately after the HUD. |
| P2 | Some action scoring reasons still appeared in English. | Added Chinese mapping for witness exposure, rumor memory, alibi pressure, cover-up urgency, and director bias. |
| P2 | Action-bias state was not visible enough after clicking. | Added visible pending state, director-bias score, and deterministic next-tick score bump in action cards. |

## Browser And Runtime QA

- Static demo production QA: passed.
  - `/api/*` requests: 0
  - console/page errors: 0
  - horizontal overflow: 0
- Server runtime command-center QA: covered by Playwright desktop/mobile E2E and final screenshots.
- Chrome/browser plugin note: in-app browser was used for static demo inspection. Server runtime screenshots and interaction QA used Playwright because the folded settings entry was not reliably reachable through the browser plugin coordinate layer.

## Validation

- `npm run test`: passed.
- `npm run build`: passed.
- `npm run eval`: passed.
- `npm run benchmark:emergence`: passed, 20/20 seeds, 100% pass rate.
- `npm run test:e2e`: passed, 24/24.
- `node scripts/run-agent-api-smoke.mjs`: passed.
- `node scripts/run-novel-agent-api-smoke.mjs`: passed.
- `node scripts/run-persistent-town-api-smoke.mjs`: passed.
- `node scripts/run-scenario-runner-api-smoke.mjs`: passed.
- `node scripts/run-sdk-client-smoke.mjs`: passed.
- Docker smoke: blocked by local environment. Docker CLI is installed, but the Docker Desktop Linux daemon pipe is unavailable.

## Final Result

passed
