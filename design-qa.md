# City Pulse design QA

Reference: `C:\Users\86137\.codex\generated_images\01a076cd-1852-7340-a873-021d55e3c6b3\exec-62ddbec9-704a-4962-8722-c7335c0feb1c.png`

Implementation: `app/components/WorldConsoleSurface.tsx` and `app/styles/world-console.css`

## Review

- The living town map is the visual main event on desktop; the map measured 1241×600 at the 1440px browser check and page overflow was 0px.
- The selected “城市脉搏 / City Pulse” identity is visible in the world HUD and the map carries the narrative line “城市有记忆，而你，正在聆听。”
- Situation and character projections are floating field notes over the map, while timeline, settlement, queue and replay remain progressive disclosures below the scene.
- The existing map artwork and interactive location, event and actor controls remain real DOM elements; no text was baked into the image.
- Mobile rules return the overlays to normal flow and preserve the existing compact controls, focus styles, reduced-motion behavior and touch target contract.

## Evidence

- `outputs/detective-world-simulation-goal10-20260912/visual-acceptance.json`
- `outputs/detective-world-simulation-goal10-20260912/world-console-1440x900.png`
- Browser check at `http://127.0.0.1:23640/?runtime=server&lang=zh-CN`: brand `城市脉搏`, hero copy present, map 1241×600, overflow 0.

## Remaining follow-up

The generated reference includes pressure gauges and bespoke objective/event cards that are not authoritative fields in the current world projection. Those should only be added after the simulation exposes matching public metrics; this pass keeps the UI truthful to the existing kernel.

final result: passed
