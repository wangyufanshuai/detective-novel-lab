import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { startReleaseCandidateServer } from "./lib/release-candidate-server.mjs";

const jsonMode = process.argv.includes("--json");
let baseUrl = "";
const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 }
];
const failures = [];
const observations = [];
let serverHarness;
let currentQaStep = "startup";

function launchOptions() {
  // The bundled Playwright Chromium can be present but unlaunchable on some
  // Windows sessions (`spawn UNKNOWN`). Prefer the installed Chrome channel,
  // while keeping a default fallback for CI machines without Chrome.
  return { headless: true, channel: "chrome" };
}

async function ensureEncounterVisible(page, encounter, inspectorToggle, label = "encounter") {
  if (await encounter.isVisible()) return;
  // The Inspector is allowed to own the primary layer. If a preceding
  // certified action reopened it, close that layer before testing Encounter.
  if (await inspectorToggle.getAttribute("aria-expanded") === "true") {
    await inspectorToggle.click();
  }
  try {
    await encounter.waitFor({ state: "visible", timeout: 15_000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      inspector: document.querySelector("[data-testid='command-deck-shell'] [data-inspector-open]")?.getAttribute("data-inspector-open") || "",
      dominant: document.querySelector("[data-testid='command-deck-shell']")?.getAttribute("data-dominant-overlay") || "",
      suspendEncounter: document.querySelector("[data-testid='command-deck-shell']")?.getAttribute("data-suspend-encounter") || "",
      activePanel: document.querySelector("[data-testid='command-deck-shell']")?.getAttribute("data-active-panel") || "",
      context: document.querySelector("[data-testid='command-deck-context']")?.getAttribute("data-context-kind") || "",
      theatre: document.querySelector("[data-testid='campaign-transition-theatre']")?.getAttribute("data-transition-phase") || "none"
    }));
    throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)} / state ${JSON.stringify(state)}`);
  }
}

async function closeContextDrawerIfOpen(page) {
  const toggle = page.getByTestId("command-deck-drawer-toggle");
  if (!(await toggle.isVisible().catch(() => false))) return;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await toggle.getAttribute("aria-expanded") !== "true") return;
    await toggle.click({ force: true });
    await page.waitForFunction(() => document.querySelector("[data-testid='command-deck-drawer-toggle']")?.getAttribute("aria-expanded") === "false", undefined, { timeout: 5_000 }).catch(() => undefined);
  }
}

async function waitForPrimaryActionLabel(page, labels, timeout = 15_000) {
  try {
    await page.waitForFunction((expectedLabels) => {
      const action = document.querySelector("[data-command-deck-primary='true']:not([disabled])");
      const text = action?.textContent || "";
      return expectedLabels.some((label) => text.includes(label));
    }, labels, { timeout });
  } catch (error) {
    const state = await page.evaluate(() => ({
      primary: Array.from(document.querySelectorAll("[data-command-deck-primary='true']")).map((node) => ({ text: node.textContent || "", disabled: node.hasAttribute("disabled") })),
      lifecycle: document.querySelector("[data-testid='strategic-action-bar']")?.getAttribute("data-action-lifecycle") || "",
      context: document.querySelector("[data-testid='command-deck-context']")?.getAttribute("data-context-kind") || "",
      tab: document.querySelector("[data-testid='command-deck-shell']")?.getAttribute("data-active-panel") || ""
    }));
    throw new Error(`${error instanceof Error ? error.message : String(error)} / expected ${labels.join(" or ")} / state ${JSON.stringify(state)}`);
  }
  return page.locator("[data-command-deck-primary='true']:not([disabled])").first().innerText();
}

async function waitForStableTheatreGeometry(page, timeout = 5_000) {
  await page.evaluate(({ timeout }) => new Promise((resolve, reject) => {
    const startedAt = performance.now();
    let previous = "";
    let stableFrames = 0;
    const sample = () => {
      const theatre = document.querySelector("[data-testid='campaign-transition-theatre']");
      const control = theatre?.querySelector("button");
      const rect = theatre?.getBoundingClientRect();
      const controlRect = control?.getBoundingClientRect();
      const layerHit = rect ? document.elementFromPoint(rect.left + Math.min(rect.width / 2, 160), rect.top + Math.min(24, rect.height / 2)) : null;
      const controlHit = controlRect ? document.elementFromPoint(controlRect.left + controlRect.width / 2, controlRect.top + controlRect.height / 2) : null;
      const animationsIdle = theatre ? theatre.getAnimations({ subtree: true }).every((animation) => animation.playState !== "running" && animation.playState !== "pending") : false;
      const signature = rect ? [rect.top, rect.left, rect.width, rect.height].map((value) => value.toFixed(2)).join(":") : "missing";
      const ready = Boolean(
        theatre
        && control
        && rect
        && rect.top >= 0
        && rect.top <= 560
        && layerHit?.closest("[data-testid='campaign-transition-theatre']") === theatre
        && controlHit?.closest("button") === control
        && animationsIdle
      );
      stableFrames = ready && signature === previous ? stableFrames + 1 : 0;
      previous = signature;
      if (stableFrames >= 3) return resolve(true);
      if (performance.now() - startedAt >= timeout) return reject(new Error(`Theatre geometry did not settle (${signature}).`));
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }), { timeout });
}

try {
  serverHarness = await startReleaseCandidateServer({
    prefix: "rc-command-deck",
    env: { AI_PROVIDER: "mock", DEEPSEEK_API_KEY: "", SILICONFLOW_API_KEY: "" }
  });
  baseUrl = serverHarness.baseUrl;
  const browser = await chromium.launch(launchOptions());
  try {
    for (const { width, height } of viewports) {
      const page = await browser.newPage({ viewport: { width, height } });
      const contextKinds = [];
      const lifecycleStates = [];
      const transitionLayouts = [];
      const rhythmAutomation = [];
      const resolutionConsistency = [];
      let workspaceLayout = null;
      // Controlled latency injection exercises the resolving UI; response completion remains the synchronization boundary.
      if (width === 1440) await page.route("**/api/players/join", async (route) => { await new Promise((resolve) => setTimeout(resolve, 500)); await route.continue(); });
      await page.goto(`${baseUrl}/?runtime=server&lang=en-US`, { waitUntil: "networkidle" });
      const frontDoor = page.getByTestId("campaign-front-door");
      await frontDoor.waitFor({ state: "visible", timeout: 15_000 });
      const frontDoorCardCount = await frontDoor.getByTestId("campaign-front-door-card").count();
      const frontDoorSelectedCount = await frontDoor.locator("[data-testid='campaign-front-door-card'][aria-pressed='true']").count();
      const frontDoorRouteSelectedCount = await frontDoor.locator("[data-testid='campaign-front-door-route'][aria-pressed='true']").count();
      const frontDoorPrimaryCount = await frontDoor.locator("[data-campaign-primary='true']:not([disabled])").count();
      if (frontDoorCardCount !== 12 || frontDoorSelectedCount !== 1 || frontDoorRouteSelectedCount !== 1 || frontDoorPrimaryCount !== 1) failures.push(`${width}px Campaign Front Door did not expose twelve Campaign cards, one Campaign selection, one route selection, and one primary action.`);
      await frontDoor.getByTestId("campaign-front-door-dismiss").click();
      await page.getByTestId("command-deck-pulse").waitFor({ state: "visible", timeout: 15_000 });
      const encounterActor = page.locator("[data-testid='pixel-map'] .actorPin").first();
      if (await encounterActor.count()) {
        await encounterActor.click();
        try {
          await ensureEncounterVisible(page, page.getByTestId("character-encounter"), page.getByTestId("command-deck-inspector-toggle"), `${width}px initial actor`);
        } catch (error) {
          const actorState = await page.evaluate(() => ({
            selectedCount: document.querySelectorAll(".actor-current").length,
            actorClass: document.querySelector("[data-testid='pixel-map'] .actorPin")?.className || "",
            context: document.querySelector("[data-testid='command-deck-context']")?.getAttribute("data-context-kind") || ""
          }));
          throw new Error(`${error instanceof Error ? error.message : String(error)} / encounter actor state ${JSON.stringify(actorState)}`);
        }
        const encounterText = await page.getByTestId("character-encounter").innerText();
        if (!/character encounter|public posture|next legal action/i.test(encounterText)) failures.push(`${width}px Character Encounter card is missing its public context sections.`);
        if (await page.getByTestId("character-encounter").locator("[data-encounter-action]").count() > 3) failures.push(`${width}px Character Encounter exposed more than three actions.`);
        if (/\b(?:npc|case|event|source|location|institution|resource|evidence|session|character)-[a-z0-9-]*\d[a-z0-9-]*\b|culpritId|victimId|hiddenTruth|rawBody/i.test(encounterText)) failures.push(`${width}px Character Encounter exposed an internal identifier or hidden case binding.`);
        await page.getByTestId("character-encounter-close").click();
      }
      await closeContextDrawerIfOpen(page);
      await page.evaluate(() => {
        window.__detectiveAudioCues = [];
        window.__detectiveTransitionPhases = [];
        window.__detectiveTransitionSamples = [];
        window.addEventListener("detective-town:audio-cue", (event) => window.__detectiveAudioCues.push(event.detail));
        const sampleTransition = () => {
          const shell = document.querySelector("[data-testid='command-deck-shell']");
          const theatre = document.querySelector("[data-testid='campaign-transition-theatre']");
          if (!shell || !theatre) return;
          const phase = theatre.getAttribute("data-transition-phase") || "";
          if (phase && !window.__detectiveTransitionPhases.includes(phase)) window.__detectiveTransitionPhases.push(phase);
          window.__detectiveTransitionSamples.push({
            phase,
            dominant: shell.getAttribute("data-dominant-overlay") || "",
            encounterVisible: Boolean(document.querySelector("[data-testid='character-encounter']") && getComputedStyle(document.querySelector("[data-testid='character-encounter']")).display !== "none"),
            frontsOpen: document.querySelector("[data-testid='district-fronts-panel']")?.getAttribute("aria-hidden") === "false",
            contextInteractive: getComputedStyle(document.querySelector("[data-testid='command-deck-context-rail']")).pointerEvents !== "none",
            notificationsVisible: Boolean(document.querySelector("[data-testid='command-deck-notifications']") && getComputedStyle(document.querySelector("[data-testid='command-deck-notifications']")).display !== "none")
          });
        };
        new MutationObserver(() => window.requestAnimationFrame(sampleTransition)).observe(document.querySelector("[data-testid='command-deck-shell']"), { attributes: true, childList: true, subtree: true });
        sampleTransition();
      });
      const lensKinds = [];
      const lensButtons = page.getByTestId("command-deck-map-lens");
      for (let index = 0; index < await lensButtons.count(); index += 1) {
        const button = lensButtons.nth(index);
        const kind = await button.getAttribute("data-map-lens-kind");
        await closeContextDrawerIfOpen(page);
        await button.focus();
        await page.keyboard.press("Enter");
        if (kind) lensKinds.push(kind);
        if (await page.getByTestId("command-deck-shell").getAttribute("data-map-lens") !== kind) failures.push(`${width}px map lens ${kind} did not become active.`);
      }
      if (width <= 760) {
        const drawerToggle = page.getByTestId("command-deck-drawer-toggle");
        if (await drawerToggle.getAttribute("aria-expanded") === "true") {
          await drawerToggle.click();
          await page.waitForFunction(() => document.querySelector("[data-testid='command-deck-drawer-toggle']")?.getAttribute("aria-expanded") === "false", undefined, { timeout: 5_000 });
        }
        await drawerToggle.click();
        await page.waitForFunction(() => document.querySelector("[data-testid='command-deck-drawer-toggle']")?.getAttribute("aria-expanded") === "true", undefined, { timeout: 5_000 });
        if (await drawerToggle.getAttribute("aria-expanded") !== "true") failures.push(`${width}px context drawer did not open.`);
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => document.querySelector("[data-testid='command-deck-drawer-toggle']")?.getAttribute("aria-expanded") === "false", undefined, { timeout: 5_000 });
        if (await drawerToggle.getAttribute("aria-expanded") !== "false") failures.push(`${width}px context drawer did not close.`);
        if (!(await drawerToggle.evaluate((node) => node === document.activeElement))) failures.push(`${width}px context drawer did not restore focus after Escape.`);
      }
      const inspectorDetailToggle = page.getByTestId("command-deck-inspector-toggle");
      if (await inspectorDetailToggle.getAttribute("aria-expanded") !== "false") failures.push(`${width}px full Inspector detail was not closed by default.`);
      if (width === 1440) {
        await inspectorDetailToggle.click();
        if (await inspectorDetailToggle.getAttribute("aria-expanded") !== "true") failures.push("1440px full Inspector detail did not open on request.");
        currentQaStep = "1440 reset town";
        await page.locator(".settingsDrawer summary").click();
        await page.getByRole("button", { name: /Reset \/ Create Town/ }).click();
        await page.locator("[data-testid='pixel-map'] .mapTile").first().waitFor({ state: "visible", timeout: 30_000 });
        // The full Inspector was opened above to verify its disclosure contract.
        // Close it for the Encounter action path: Inspector ownership intentionally
        // suspends the Encounter card, while actor selection remains available.
        if (await inspectorDetailToggle.getAttribute("aria-expanded") === "true") {
          await inspectorDetailToggle.click();
          await page.waitForFunction(() => document.querySelector("[data-testid='character-encounter']")?.getAttribute("data-posture") !== "busy");
        }
        const selectableLocation = page.locator("[data-testid='pixel-map'] .mapTile[data-location-id] .mapTileHitTarget").first();
        if (await selectableLocation.count()) {
          await selectableLocation.focus();
          await page.keyboard.press("Enter");
          currentQaStep = "1440 location context";
          await page.waitForFunction(() => document.querySelector("[data-testid='command-deck-context']")?.getAttribute("data-context-kind") === "location");
          contextKinds.push(await page.getByTestId("command-deck-context").getAttribute("data-context-kind"));
          const prerequisiteSteps = [
            { label: "Join investigation", ready: ["Join investigation", "Observe case window", "Search location"], next: ["Observe case window", "Search location"] },
            { label: "Observe case window", ready: ["Observe case window", "Search location", "Search the next linked scene", "Search the linked scene", "Focus search location"], next: ["Search location", "Search the next linked scene", "Search the linked scene", "Focus search location"] }
          ];
          for (const prerequisiteStep of prerequisiteSteps) {
            const prerequisite = prerequisiteStep.label;
            currentQaStep = `1440 ${prerequisite} ready`;
            const actionLabel = await waitForPrimaryActionLabel(page, prerequisiteStep.ready);
            if (actionLabel.includes(prerequisite)) {
              const interactionStartedAt = Date.now();
              const panelBefore = await inspectorDetailToggle.getAttribute("aria-expanded");
              const resolvePhase = width === 1440 && prerequisite === "Join investigation"
                ? page.waitForFunction(() => document.querySelector("[data-testid='strategic-action-bar']")?.getAttribute("data-action-lifecycle") === "resolving")
                : null;
              await page.locator("[data-command-deck-primary='true']:not([disabled])").first().click();
              if (resolvePhase) {
                currentQaStep = "1440 resolve phase";
                await resolvePhase;
                lifecycleStates.push("resolving");
              }
              currentQaStep = `1440 ${prerequisite} completion`;
              await waitForPrimaryActionLabel(page, prerequisiteStep.next);
              if (prerequisite === "Join investigation") await page.waitForFunction(() => document.querySelector("[data-testid='strategic-action-bar']")?.getAttribute("data-action-lifecycle") !== "resolving", undefined, { timeout: 15_000 });
              rhythmAutomation.push({ stage: prerequisite === "Join investigation" ? "join" : "search", primaryClicks: 1, panelSwitches: panelBefore === await inspectorDetailToggle.getAttribute("aria-expanded") ? 0 : 1, settleMs: Date.now() - interactionStartedAt });
            }
          }
          currentQaStep = "1440 search action ready";
          await waitForPrimaryActionLabel(page, ["Search location", "Search the next linked scene", "Search the linked scene", "Focus search location"]);
          const searchStartedAt = Date.now();
          const searchPanelBefore = await inspectorDetailToggle.getAttribute("aria-expanded");
          await page.locator("[data-command-deck-primary='true']:not([disabled])").first().click();
          currentQaStep = "1440 evidence context";
          await page.waitForFunction(() => document.querySelector("[data-testid='command-deck-context']")?.getAttribute("data-context-kind") === "evidence", undefined, { timeout: 15_000 });
          rhythmAutomation.push({ stage: "search", primaryClicks: 1, panelSwitches: searchPanelBefore === await inspectorDetailToggle.getAttribute("aria-expanded") ? 0 : 1, settleMs: Date.now() - searchStartedAt });
          contextKinds.push("evidence");
          lifecycleStates.push(await page.getByTestId("strategic-action-bar").getAttribute("data-action-lifecycle"));
          currentQaStep = "1440 transition theatre";
          await page.waitForFunction(() => document.querySelector("[data-testid='campaign-transition-theatre']")?.getAttribute("data-transition-phase") === "immediate-result", undefined, { timeout: 15_000 });
          resolutionConsistency.push(await page.evaluate(() => {
            const values = (selector) => Object.fromEntries(Array.from(document.querySelectorAll(`${selector} [data-resolution-field]`)).map((node) => [node.getAttribute("data-resolution-field"), node.querySelector("b")?.textContent || ""]));
            const latest = values("[data-testid='command-deck-feedback']");
            const theatre = values("[data-testid='campaign-transition-resolution']");
            const liveOwners = Array.from(document.querySelectorAll("[aria-live]")).filter((node) => node.querySelector("[data-testid='campaign-transition-resolution']") || node.matches("[data-testid='campaign-transition-resolution']")).length;
            return { latest, theatre, equal: JSON.stringify(latest) === JSON.stringify(theatre), liveOwners };
          }));
          await page.waitForFunction(() => ["world-consequence", "next-objective"].includes(document.querySelector("[data-testid='campaign-transition-theatre']")?.getAttribute("data-transition-phase") || ""), undefined, { timeout: 15_000 });
          if (await page.getByTestId("campaign-transition-theatre").getAttribute("data-transition-phase") === "world-consequence") {
            await page.waitForFunction(() => document.querySelector("[data-testid='campaign-transition-theatre']")?.getAttribute("data-transition-phase") === "next-objective", undefined, { timeout: 15_000 });
          }
          for (const transitionWidth of viewports.map(({ width: viewportWidth }) => viewportWidth)) {
            await page.setViewportSize({ width: transitionWidth, height: transitionWidth <= 390 ? 844 : 900 });
            await waitForStableTheatreGeometry(page);
            const layout = await page.evaluate(() => {
              const theatre = document.querySelector("[data-testid='campaign-transition-theatre']");
              const map = document.querySelector("[data-testid='command-deck-map-area']");
              const action = document.querySelector("[data-testid='strategic-action-bar']");
              const context = document.querySelector("[data-testid='command-deck-context-rail']");
              const control = theatre?.querySelector("button");
              const rect = theatre?.getBoundingClientRect();
              const mapRect = map?.getBoundingClientRect();
              const actionRect = action?.getBoundingClientRect();
              const contextRect = context?.getBoundingClientRect();
              const hit = rect ? document.elementFromPoint(rect.left + Math.min(rect.width / 2, 160), rect.top + Math.min(24, rect.height / 2)) : null;
              const controlRect = control?.getBoundingClientRect();
              const controlHit = controlRect ? document.elementFromPoint(controlRect.left + controlRect.width / 2, controlRect.top + controlRect.height / 2) : null;
              const overlapHeight = rect && actionRect ? Math.max(0, Math.min(rect.bottom, actionRect.bottom) - Math.max(rect.top, actionRect.top)) : 0;
              const overlapWidth = rect && actionRect ? Math.max(0, Math.min(rect.right, actionRect.right) - Math.max(rect.left, actionRect.left)) : 0;
              const contextStyle = context ? getComputedStyle(context) : null;
              const contextVisible = Boolean(contextStyle && contextStyle.display !== "none" && contextStyle.visibility !== "hidden" && Number.parseFloat(contextStyle.opacity) > 0.01);
              const contextOverlapHeight = contextVisible && rect && contextRect ? Math.max(0, Math.min(rect.bottom, contextRect.bottom) - Math.max(rect.top, contextRect.top)) : 0;
              const contextOverlapWidth = contextVisible && rect && contextRect ? Math.max(0, Math.min(rect.right, contextRect.right) - Math.max(rect.left, contextRect.left)) : 0;
              return {
                viewport: innerWidth,
                overflow: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) - innerWidth,
                top: rect?.top ?? -1,
                left: rect?.left ?? -1,
                right: rect?.right ?? -1,
                width: rect?.width ?? 0,
                height: rect?.height ?? 0,
                controlHeight: control?.getBoundingClientRect().height ?? 0,
                ownsHitPoint: Boolean(hit?.closest("[data-testid='campaign-transition-theatre']")),
                controlOwnsHitPoint: Boolean(control && controlHit?.closest("button") === control),
                actionOverlapArea: overlapHeight * overlapWidth,
                contextOverlapArea: contextOverlapHeight * contextOverlapWidth,
                mapVisible: Boolean(mapRect && mapRect.top < innerHeight && mapRect.bottom > 0)
              };
            });
            transitionLayouts.push(layout);
            if (layout.overflow > 1) failures.push(`${transitionWidth}px Theatre overflowed horizontally by ${layout.overflow}px.`);
            if (layout.top < 0 || layout.top > Math.min(560, (transitionWidth <= 390 ? 844 : 900) * 0.75)) failures.push(`${transitionWidth}px Theatre did not remain in the map-focused upper viewport.`);
            if (layout.left < -1 || layout.right > transitionWidth + 1 || layout.width < Math.min(360, transitionWidth) * 0.8) failures.push(`${transitionWidth}px Theatre escaped its bounded viewport width.`);
            if (layout.controlHeight < 44) failures.push(`${transitionWidth}px Theatre control fell below 44px.`);
            if (!layout.ownsHitPoint) failures.push(`${transitionWidth}px Theatre did not own its visible pointer layer.`);
            if (!layout.controlOwnsHitPoint) failures.push(`${transitionWidth}px Theatre control did not own its pointer center.`);
            if (layout.actionOverlapArea > 1) failures.push(`${transitionWidth}px Theatre overlapped the Current Action bar.`);
            if (transitionWidth <= 900 && layout.contextOverlapArea > 1) failures.push(`${transitionWidth}px suspended Context drawer visually overlapped the Theatre.`);
            if (!layout.mapVisible) failures.push(`${transitionWidth}px Theatre displaced the map outside the visible workspace.`);
            await page.screenshot({ path: path.join(process.cwd(), "outputs", "command-deck-qa", `${transitionWidth}-transition.png`), fullPage: false });
          }
          await page.setViewportSize({ width: 1440, height: 900 });
          const theatre = page.getByTestId("campaign-transition-theatre");
          if (await theatre.isVisible().catch(() => false)) await theatre.getByRole("button", { name: "Continue" }).click();
          await theatre.waitFor({ state: "detached", timeout: 5_000 }).catch(() => undefined);
          // Search is a certified action that may open the full Inspector for
          // its result. Close that detail layer before exercising the actor
          // Encounter action; the later arbitration assertion re-opens it.
          if (await inspectorDetailToggle.getAttribute("aria-expanded") === "true") {
            await inspectorDetailToggle.click();
          }
          const actorPins = page.locator("[data-testid='pixel-map'] .actorPin");
          if (await actorPins.count()) {
            const encounter = page.getByTestId("character-encounter");
            let encounterQuestion = encounter.locator("[data-encounter-action='question']:not([disabled])");
            for (let actorIndex = 0; actorIndex < await actorPins.count() && !(await encounterQuestion.count()); actorIndex += 1) {
              await actorPins.nth(actorIndex).click();
              await ensureEncounterVisible(page, encounter, inspectorDetailToggle, `1440px post-search actor ${actorIndex}`);
              encounterQuestion = encounter.locator("[data-encounter-action='question']:not([disabled])");
              if (!(await encounterQuestion.count())) await encounter.getByTestId("character-encounter-close").click();
            }
            contextKinds.push(await page.getByTestId("command-deck-context").getAttribute("data-context-kind"));
            if (!(await page.getByTestId("command-deck-context").locator("h2").evaluate((node) => node === document.activeElement))) failures.push("1440px context selection did not move focus to the inspector heading.");
            if (await encounterQuestion.count()) {
              currentQaStep = "1440 encounter question action";
              const questionStartedAt = Date.now();
              await encounterQuestion.click();
              await page.waitForFunction(() => /Questioning recorded|Challenge recorded|Case accepted/i.test(document.querySelector("[data-testid='character-encounter']")?.textContent || ""), undefined, { timeout: 20_000 });
              rhythmAutomation.push({ stage: "question", primaryClicks: 1, panelSwitches: 0, settleMs: Date.now() - questionStartedAt });
              await page.getByTestId("campaign-transition-theatre").waitFor({ state: "visible", timeout: 15_000 });
              const resolvingDismiss = page.getByTestId("campaign-transition-theatre").getByRole("button", { name: "Hide while resolving" });
              if (await resolvingDismiss.count()) await resolvingDismiss.click();
              else {
                const skipTransition = page.getByTestId("campaign-transition-theatre").getByRole("button", { name: "Skip to next" });
                if (await skipTransition.count()) await skipTransition.click();
                await page.waitForFunction(() => document.querySelector("[data-testid='campaign-transition-theatre']")?.getAttribute("data-transition-phase") === "next-objective", undefined, { timeout: 15_000 });
                await page.getByTestId("campaign-transition-theatre").getByRole("button", { name: "Continue" }).click();
              }
              await page.getByTestId("campaign-transition-theatre").waitFor({ state: "detached", timeout: 5_000 });
            } else failures.push("1440px Character Encounter did not expose the existing Question registry action after Search.");
            // Re-open the Inspector after the action Theatre is dismissed. This
            // is an intentional overlay boundary: the selected actor remains
            // selectable, but its Encounter card is hidden while the Inspector
            // owns the primary layer.
            currentQaStep = "1440 inspector/encounter arbitration";
            if (await inspectorDetailToggle.getAttribute("aria-expanded") === "false") await inspectorDetailToggle.click();
            await encounter.waitFor({ state: "hidden", timeout: 5_000 });
            if (await page.getByTestId("command-deck-context").getAttribute("data-context-kind") !== "actor") failures.push("1440px opening Inspector lost the selected actor context.");
            currentQaStep = "1440 theory context after transition";
            await page.locator(".inspectorTabs button").nth(2).click();
            await page.waitForFunction(() => document.querySelector("[data-testid='command-deck-context']")?.getAttribute("data-context-kind") === "theory");
            contextKinds.push("theory");
            currentQaStep = "1440 institution context after transition";
            await page.locator(".inspectorTabs button").nth(3).click();
            await page.waitForFunction(() => document.querySelector("[data-testid='command-deck-context']")?.getAttribute("data-context-kind") === "institution");
            contextKinds.push("institution");
            await page.locator(".inspectorTabs button").nth(1).click();
            if (await inspectorDetailToggle.getAttribute("aria-expanded") === "true") await inspectorDetailToggle.click();
            await selectableLocation.focus();
            await page.keyboard.press("Enter");
          }
        }
      }
      currentQaStep = `${width}px Final Detective Workspace`;
      const drawerToggleForWorkspace = page.getByTestId("command-deck-drawer-toggle");
      if (width <= 1020 && await drawerToggleForWorkspace.isVisible().catch(() => false) && await drawerToggleForWorkspace.getAttribute("aria-expanded") !== "true") {
        await drawerToggleForWorkspace.click();
      }
      if (await inspectorDetailToggle.getAttribute("aria-expanded") !== "true") await inspectorDetailToggle.click();
      const inspectorTabs = page.locator(".inspectorTabs button");
      if (await inspectorTabs.count() > 1) await inspectorTabs.nth(1).click();
      await page.getByTestId("final-detective-workspace").waitFor({ state: "visible", timeout: 15_000 });
      await page.evaluate(() => {
        const content = document.querySelector(".inspectorContent");
        if (content) content.scrollTop = 0;
      });
      workspaceLayout = await page.evaluate(() => {
        const workspace = document.querySelector("[data-testid='final-detective-workspace']");
        const objective = workspace?.querySelector("[data-testid='final-workspace-objective']");
        const task = workspace?.querySelector("[data-testid='case-intake-next-action']");
        const active = workspace?.querySelector("[data-testid='final-workspace-active-area']");
        const evidence = workspace?.querySelector("[data-testid='final-workspace-evidence']");
        const context = workspace?.querySelector("[data-testid='final-workspace-context']");
        const theory = workspace?.querySelector("[data-testid='final-workspace-theory']");
        const resolution = workspace?.querySelector("[data-testid='final-workspace-latest-resolution']");
        const primary = workspace?.querySelector("[data-testid='final-workspace-primary-action']");
        const buttons = Array.from(workspace?.querySelectorAll("button") || []).filter((node) => getComputedStyle(node).display !== "none");
        const follows = (left, right) => Boolean(left && right && left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING);
        const rect = workspace?.getBoundingClientRect();
        const gridColumns = active ? getComputedStyle(active).gridTemplateColumns.split(/\s+/).filter(Boolean) : [];
        const text = workspace?.textContent || "";
        return {
          visible: Boolean(workspace && rect && rect.width > 0),
          stage: workspace?.getAttribute("data-workspace-stage") || "",
          width: rect?.width || 0,
          overflow: workspace ? workspace.scrollWidth - workspace.clientWidth : -1,
          columnCount: gridColumns.length,
          primaryCount: workspace?.querySelectorAll("[data-testid='final-workspace-primary-action']").length || 0,
          primaryHeight: primary?.getBoundingClientRect().height || 0,
          contextualMinHeight: buttons.length ? Math.min(...buttons.map((node) => node.getBoundingClientRect().height)) : 0,
          actionKind: primary?.getAttribute("data-action-kind") || "",
          ariaLiveCount: workspace?.querySelectorAll("[aria-live]").length || 0,
          sourceReviewCount: workspace?.querySelectorAll("[data-testid='source-review-unlock']").length || 0,
          sectionLabels: ["Evidence", "Testimony", "Contradictions", "Theory", "Source Review Unlock"].filter((label) => text.includes(label)),
          rawLeak: /\b(?:npc|case|event|source|location|institution|resource|evidence|scene|session|character)-[a-z0-9-]*\d[a-z0-9-]*\b|culpritId|victimId|hiddenTruth|rawBody|sourceId|[A-Za-z]:[\\/]/i.test(text),
          mobileOrder: follows(objective, task) && follows(task, evidence) && follows(evidence, context) && follows(context, theory) && (!resolution || follows(theory, resolution))
        };
      });
      await page.screenshot({ path: path.join(process.cwd(), "outputs", "command-deck-qa", `${width}-detective-workspace.png`), fullPage: false });
      const metrics = await page.evaluate(() => {
        const map = document.querySelector("[data-testid='command-deck-map-area']");
        const shell = document.querySelector("[data-testid='command-deck-shell']");
        const objective = document.querySelector("[data-testid='strategic-pacing']");
        const currentAction = document.querySelector("[data-testid='strategic-action-bar']");
        const latestResolution = document.querySelector("[data-testid='command-deck-feedback']");
        const objectiveRect = objective?.getBoundingClientRect();
        const mapRect = map?.getBoundingClientRect();
        const currentActionRect = currentAction?.getBoundingClientRect();
        const latestResolutionRect = latestResolution?.getBoundingClientRect();
        const chainValues = (selector) => Object.fromEntries(Array.from(document.querySelectorAll(`${selector} [data-resolution-field]`)).map((node) => [node.getAttribute("data-resolution-field"), node.querySelector("b")?.textContent || ""]));
        const latestChain = chainValues("[data-testid='command-deck-feedback']");
        const journalChain = chainValues("[data-testid='campaign-resolution-entry']:first-of-type");
        return {
          viewport: window.innerWidth,
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          mapWidth: map?.getBoundingClientRect().width || 0,
          shellWidth: shell?.getBoundingClientRect().width || 0,
          agenda: Boolean(document.querySelector("[data-testid='strategic-pacing']")),
          context: Boolean(document.querySelector("[data-testid='command-deck-context']"))
          ,mapIntel: document.querySelector("[data-testid='command-deck-map-intel']")?.textContent || ""
          ,drawerToggle: Boolean(document.querySelector("[data-testid='command-deck-drawer-toggle']"))
          ,contextActions: document.querySelectorAll("[data-testid='command-deck-context-action']").length
          ,primaryActions: document.querySelectorAll("[data-command-deck-primary='true']:not([disabled])").length
          ,lensCount: document.querySelectorAll("[data-testid='command-deck-map-lens']").length
          ,pressedLensCount: document.querySelectorAll("[data-testid='command-deck-map-lens'][aria-pressed='true']").length
          ,visibleLensBadgeCount: Array.from(document.querySelectorAll(".mapLensBadge")).filter((node) => getComputedStyle(node).display !== "none").length
          ,pacing: Boolean(document.querySelector("[data-testid='strategic-pacing']"))
          ,currentObjectiveCount: document.querySelectorAll("[data-testid='strategic-pacing']").length
          ,currentObjectiveText: objective?.textContent || ""
          ,caseRhythmCount: document.querySelectorAll("[data-testid='strategic-case-rhythm']").length
          ,caseRhythmBeatCount: document.querySelectorAll("[data-testid='strategic-case-rhythm'] li").length
          ,caseRhythmCurrentBeatCount: document.querySelectorAll("[data-testid='strategic-case-rhythm'] li[data-status='current']").length
          ,caseRhythmStep: document.querySelector("[data-testid='strategic-case-rhythm']")?.getAttribute("data-rhythm-step") || ""
          ,caseRhythmRawLeak: /\b(?:npc|case|event|source|location|institution|resource|evidence|session|character)-[a-z0-9-]*\d[a-z0-9-]*\b|culpritId|victimId|hiddenTruth|rawBody/i.test(document.querySelector("[data-testid='strategic-case-rhythm']")?.textContent || "")
          ,caseRhythmDetailCount: document.querySelectorAll("[data-testid='certified-case-rhythm']").length
          ,caseRhythmRouteOpen: document.querySelector("[data-testid='certified-case-rhythm'] details")?.hasAttribute("open") || false
          ,caseRhythmManualFirst: /manual first/i.test(document.querySelector("[data-testid='certified-case-rhythm']")?.textContent || "")
           ,objectiveBeforeAction: Boolean(objectiveRect && currentActionRect && objectiveRect.top < currentActionRect.top)
           ,currentActionBeforeLatest: Boolean(currentActionRect && latestResolutionRect && currentActionRect.top < latestResolutionRect.top)
           ,latestBeforeMap: Boolean(latestResolutionRect && mapRect && latestResolutionRect.top < mapRect.top)
          ,pacingPhase: document.querySelector("[data-testid='strategic-pacing']")?.getAttribute("data-pacing-phase") || ""
          ,campaignPulseText: document.querySelector("[data-testid='command-deck-pulse']")?.textContent || ""
          ,strategicWhyNowText: document.querySelector("[data-testid='strategic-why-now']")?.textContent || ""
          ,campaignPanelText: document.querySelector("[data-testid='campaign-session']")?.textContent || ""
          ,campaignPacingText: document.querySelector("[data-testid='campaign-pacing']")?.textContent || ""
          ,campaignPacingPrimaryCount: document.querySelectorAll("[data-testid='campaign-pacing'] button").length
          ,feedbackState: document.querySelector("[data-testid='command-deck-feedback']")?.getAttribute("data-feedback-state") || ""
          ,feedbackAriaLive: document.querySelector("[data-testid='command-deck-feedback']")?.getAttribute("aria-live") || ""
          ,feedbackVisible: Boolean(document.querySelector("[data-testid='command-deck-feedback']"))
          ,encounterVisible: Boolean(document.querySelector("[data-testid='character-encounter']"))
          ,encounterPosture: document.querySelector("[data-testid='character-encounter']")?.getAttribute("data-posture") || ""
          ,encounterActionCount: document.querySelectorAll("[data-testid='character-encounter'] [data-encounter-action]").length
          ,encounterRawLeak: /\b(?:npc|case|event|source|location|institution|resource|evidence|session|character)-[a-z0-9-]*\d[a-z0-9-]*\b|culpritId|victimId|hiddenTruth|rawBody/i.test(document.querySelector("[data-testid='character-encounter']")?.textContent || "")
          ,audioCues: window.__detectiveAudioCues || []
          ,transitionPhases: window.__detectiveTransitionPhases || []
          ,transitionSamples: window.__detectiveTransitionSamples || []
          ,feedbackLayerCount: document.querySelectorAll("[data-testid='command-deck-feedback'] > span").length
          ,feedbackLabels: Array.from(document.querySelectorAll("[data-testid='command-deck-feedback'] > span > small")).map((node) => node.textContent || "")
          ,feedbackValues: latestChain
          ,resolutionLedgerCount: document.querySelectorAll("[data-testid='campaign-resolution-entry']").length
          ,resolutionLedgerMatchesLatest: !Object.keys(journalChain).length || JSON.stringify(latestChain) === JSON.stringify(journalChain)
          ,resolutionRawLeak: /\b(?:npc|case|event|source|location|institution|resource|evidence|scene|session|character)-[a-z0-9-]*\d[a-z0-9-]*\b|culpritId|victimId|hiddenTruth|rawBody|sourceId|[A-Za-z]:[\\/]/i.test(document.querySelector("[data-testid='command-deck-feedback']")?.textContent || "")
          ,rawLeak: /\b(?:npc|case|event|source|location|institution|resource|evidence|scene|session|character)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(document.body.innerText)
          ,rawLeakSurfaces: Array.from(new Set(Array.from(document.querySelectorAll("[data-testid], section, article, aside, .notebookMeta, .notebookTags, h3, p")).filter((node) => /\b(?:npc|case|event|source|location|institution|resource|evidence|scene|session|character)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(node.textContent || "")).map((node) => node.getAttribute("data-testid") || node.className || node.tagName).filter((value) => typeof value === "string"))).slice(-10)
          ,tileSample: document.querySelector(".pixelMap .mapTile") ? {
            className: document.querySelector(".pixelMap .mapTile")?.className || "",
            background: getComputedStyle(document.querySelector(".pixelMap .mapTile")).backgroundColor
          } : null
        };
      });
      metrics.contextKinds = contextKinds;
      metrics.frontDoorCardCount = frontDoorCardCount;
      metrics.frontDoorSelectedCount = frontDoorSelectedCount;
      metrics.frontDoorRouteSelectedCount = frontDoorRouteSelectedCount;
      metrics.frontDoorPrimaryCount = frontDoorPrimaryCount;
      metrics.lensKinds = lensKinds;
      metrics.lifecycleStates = lifecycleStates;
      metrics.transitionLayouts = transitionLayouts;
      metrics.rhythmAutomation = rhythmAutomation;
      metrics.resolutionConsistency = resolutionConsistency;
      metrics.workspaceLayout = workspaceLayout;
      observations.push(metrics);
      if (metrics.overflow > 1) failures.push(`${width}px document overflowed by ${metrics.overflow}px.`);
      if (!metrics.agenda || !metrics.context) failures.push(`${width}px missing agenda/context surface.`);
      if (!metrics.pacing || !["brief", "inspect", "choose", "execute", "resolve", "advance"].includes(metrics.pacingPhase)) failures.push(`${width}px strategic pacing phase is missing or invalid.`);
      if (metrics.currentObjectiveCount !== 1 || !/current objective/i.test(metrics.currentObjectiveText)) failures.push(`${width}px did not expose exactly one canonical Current Objective.`);
      if (metrics.caseRhythmCount !== 1 || metrics.caseRhythmBeatCount !== 4 || metrics.caseRhythmCurrentBeatCount !== 1) failures.push(`${width}px Certified Case Rhythm did not expose four beats with one current beat.`);
      if (metrics.caseRhythmRawLeak) failures.push(`${width}px Certified Case Rhythm exposed an internal identifier or hidden field.`);
      if (metrics.feedbackLayerCount !== 4 || !["Result", "World Change", "Objective Progress", "Next Action"].every((label) => metrics.feedbackLabels.includes(label))) failures.push(`${width}px four-stage Resolution Ledger is missing or incomplete.`);
      if (!metrics.feedbackVisible || !["idle", "resolving", "recorded", "blocked", "completed"].includes(metrics.feedbackState)) failures.push(`${width}px Resolution Ledger state is missing or invalid.`);
      if (metrics.feedbackAriaLive) failures.push(`${width}px Server Latest Resolution competed with Theatre live-region ownership.`);
      if (metrics.resolutionRawLeak) failures.push(`${width}px Latest Resolution exposed an internal identifier, private field, or path.`);
      if (!metrics.campaignPulseText.includes("Town Reckoning")) failures.push(`${width}px Town Pulse does not expose the bound safe campaign label.`);
      if (metrics.campaignPanelText && !metrics.campaignPanelText.includes("Civic records, merchant debt, and institutional pressure")) failures.push(`${width}px Campaign Journey does not expose the safe authored theme.`);
      if (width >= 1200 && metrics.strategicWhyNowText.replace(/why now/i, "").trim().length < 12) failures.push(`${width}px Command Deck is missing its campaign-specific Why Now context.`);
      if (metrics.campaignPacingText && !["campaign pacing", "why now", "what changes / what stays fair"].every((label) => metrics.campaignPacingText.toLowerCase().includes(label))) failures.push(`${width}px visible Campaign Pacing context is incomplete.`);
      if (metrics.campaignPacingPrimaryCount !== 0) failures.push(`${width}px Campaign Pacing created a competing action control.`);
      if (width <= 760 && !metrics.drawerToggle) failures.push(`${width}px missing mobile context drawer toggle.`);
      if (width >= 1200 && metrics.contextActions < 1) failures.push(`${width}px context inspector did not expose a safe action.`);
      if (metrics.contextActions > 3) failures.push(`${width}px context inspector exposed more than three actions.`);
      if (metrics.encounterActionCount > 3) failures.push(`${width}px Character Encounter exceeded the three-action budget.`);
      if (metrics.encounterRawLeak) failures.push(`${width}px Character Encounter contains a raw identifier-like token.`);
      if (metrics.primaryActions > 1) failures.push(`${width}px exposed more than one primary Command Deck action.`);
      if (metrics.lensCount !== 4 || metrics.pressedLensCount !== 1) failures.push(`${width}px map lenses are not four mutually exclusive controls.`);
      if (!metrics.visibleLensBadgeCount) failures.push(`${width}px active map lens has no visible location signal.`);
      if (!["institution", "pressure", "reaction", "evidence"].every((kind) => metrics.lensKinds.includes(kind))) failures.push(`${width}px did not activate all four map lenses.`);
      if (metrics.rawLeak) failures.push(`${width}px command deck body contains a raw identifier-like token.`);
      if (!metrics.workspaceLayout?.visible) failures.push(`${width}px Final Detective Workspace is not visible on request.`);
      if (metrics.workspaceLayout?.overflow > 1) failures.push(`${width}px Final Detective Workspace overflowed its container by ${metrics.workspaceLayout.overflow}px.`);
      if (metrics.workspaceLayout?.primaryCount !== 1 || metrics.workspaceLayout?.primaryHeight < 44) failures.push(`${width}px Final Detective Workspace did not expose exactly one 44px primary action.`);
      if (metrics.workspaceLayout?.contextualMinHeight < 44) failures.push(`${width}px Final Detective Workspace exposed a control below 44px.`);
      if (metrics.workspaceLayout?.ariaLiveCount !== 0) failures.push(`${width}px Final Detective Workspace competed for aria-live ownership.`);
      if (metrics.workspaceLayout?.sourceReviewCount !== 1 || metrics.workspaceLayout?.sectionLabels.length !== 5) failures.push(`${width}px Final Detective Workspace did not consolidate Evidence, Testimony, Contradictions, Theory, and Source Review.`);
      if (metrics.workspaceLayout?.rawLeak) failures.push(`${width}px Final Detective Workspace exposed an internal identifier, private field, or path.`);
      if (width >= 1200 && (metrics.workspaceLayout?.width < 780 || metrics.workspaceLayout?.columnCount < 3)) failures.push(`${width}px Final Detective Workspace did not use the dedicated three-column desktop theatre.`);
      if (width < 1200 && (metrics.workspaceLayout?.columnCount !== 1 || !metrics.workspaceLayout?.mobileOrder)) failures.push(`${width}px Final Detective Workspace did not preserve objective -> task -> workspace -> theory -> resolution progressive disclosure.`);
      if (width >= 1200 && metrics.mapWidth / Math.max(metrics.shellWidth, 1) < 0.55) failures.push(`${width}px map area is below the 55% target.`);
      if (width >= 1200 && !["INSTITUTION", "PRESSURE", "REACTION", "EVIDENCE"].every((label) => metrics.mapIntel.includes(label))) failures.push(`${width}px map intel is missing one or more fixed lenses.`);
      if (width >= 1200 && !["location", "actor", "institution", "evidence", "theory"].every((kind) => metrics.contextKinds.includes(kind))) failures.push(`${width}px did not cover location, actor, institution, evidence, and theory contexts.`);
      if (width >= 1200 && !metrics.lifecycleStates.includes("resolving")) failures.push(`${width}px did not expose the resolving lifecycle while an existing handler was in flight.`);
      if (width >= 1200 && (metrics.caseRhythmDetailCount !== 1 || metrics.caseRhythmRouteOpen || !metrics.caseRhythmManualFirst)) failures.push(`${width}px Inspector rhythm did not keep the full route default-closed with its Manual First boundary.`);
      if (width >= 1200 && !metrics.rhythmAutomation.length) failures.push(`${width}px did not collect automated Certified Case Rhythm interaction samples.`);
      for (const sample of metrics.rhythmAutomation) {
        if (sample.primaryClicks > 2) failures.push(`${width}px ${sample.stage} exceeded the two-click automated rhythm budget.`);
        if (sample.panelSwitches > 1) failures.push(`${width}px ${sample.stage} exceeded the one-panel-switch rhythm budget.`);
        const settleBudget = sample.stage === "question" || sample.stage === "challenge" ? 12000 : 3000;
        if (sample.settleMs > settleBudget) failures.push(`${width}px ${sample.stage} exceeded the ${settleBudget}ms automated settle budget (${sample.settleMs}ms).`);
      }
      if (width >= 1200 && !["action-resolving", "immediate-result", "next-objective"].every((phase) => metrics.transitionPhases.includes(phase))) failures.push(`${width}px Campaign Transition Theatre did not expose Resolve, Result, and Next phases.`);
      if (width >= 1200 && (!metrics.resolutionConsistency.length || metrics.resolutionConsistency.some((sample) => !sample.equal || sample.liveOwners !== 1))) failures.push(`${width}px Transition and Latest Resolution did not share one canonical four-stage chain and one aria-live owner.`);
      if (width >= 1200 && metrics.resolutionLedgerCount && !metrics.resolutionLedgerMatchesLatest) failures.push(`${width}px Journal and Latest Resolution did not render identical canonical chain text.`);
      if (metrics.transitionSamples.some((sample) => ["action", "transition"].includes(sample.dominant) && (sample.encounterVisible || sample.frontsOpen || sample.contextInteractive || sample.notificationsVisible))) failures.push(`${width}px a lower-priority overlay competed with the Campaign Transition Theatre.`);
      if (width >= 1200 && !metrics.audioCues.some((cue) => cue?.cue === "resolve" || cue?.cue === "confirm")) failures.push(`${width}px did not emit a browser-local resolve/confirm audio cue hook.`);
      if (width === 390) {
        if (!metrics.objectiveBeforeAction || !metrics.currentActionBeforeLatest || !metrics.latestBeforeMap) failures.push("390px order is not Current Objective -> Current Action -> Latest Resolution -> Map.");
        await page.emulateMedia({ reducedMotion: "reduce" });
        const reducedMotionDuration = await page.getByTestId("command-deck-feedback").evaluate((node) => getComputedStyle(node).animationDuration);
        if (Number.parseFloat(reducedMotionDuration) > 0.01) failures.push(`390px presentation feedback ignored prefers-reduced-motion.`);
      }
      const screenshotPath = path.join(process.cwd(), "outputs", "command-deck-qa", `${width}.png`);
      fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.querySelector("[data-testid='command-deck-agenda-rail']")?.scrollTo(0, 0);
      });
      await page.screenshot({ path: screenshotPath, fullPage: false });
      await page.close();
    }

    const staticPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const apiRequests = [];
    staticPage.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith("/api/")) apiRequests.push(pathname);
    });
    await staticPage.goto(`${baseUrl}/?runtime=static&study=1&lang=en-US`, { waitUntil: "networkidle" });
    const staticFrontDoor = staticPage.getByTestId("campaign-front-door");
    if (!(await staticFrontDoor.count()) || !(await staticFrontDoor.isVisible())) failures.push("Static runtime did not expose its read-only Campaign preview boundary.");
    const staticFrontDoorDismiss = staticFrontDoor.getByTestId("campaign-front-door-dismiss");
    if (await staticFrontDoorDismiss.count() && await staticFrontDoorDismiss.isVisible().catch(() => false)) await staticFrontDoorDismiss.click();
    const staticOnboarding = staticPage.getByTestId("onboarding-overlay");
    if (await staticOnboarding.count() && await staticOnboarding.isVisible()) await staticOnboarding.locator("button").last().click();
    await staticPage.getByTestId("command-deck-pulse").waitFor({ state: "visible", timeout: 15_000 });
    const staticActor = staticPage.locator("[data-testid='pixel-map'] .actorPin").first();
    if (await staticActor.count()) {
      await staticActor.click();
      const staticEncounter = staticPage.getByTestId("character-encounter");
      await ensureEncounterVisible(
        staticPage,
        staticEncounter,
        staticPage.getByTestId("command-deck-inspector-toggle"),
        "static actor"
      );
      const staticEncounterText = await staticEncounter.innerText();
      if (await staticEncounter.locator("[data-encounter-action]").count() > 3) failures.push("Static Character Encounter exceeded the three-action budget.");
      if (/\b(?:npc|case|event|source|location|institution|resource|evidence|session|character)-[a-z0-9-]*\d[a-z0-9-]*\b|culpritId|victimId|hiddenTruth|rawBody/i.test(staticEncounterText)) failures.push("Static Character Encounter exposed an internal identifier or hidden case binding.");
    }
    const staticDrawer = staticPage.getByTestId("command-deck-drawer-toggle");
    if (await staticDrawer.isVisible().catch(() => false) && await staticDrawer.getAttribute("aria-expanded") !== "true") await staticDrawer.evaluate((node) => node.click());
    const staticInspector = staticPage.getByTestId("command-deck-inspector-toggle");
    if (await staticInspector.getAttribute("aria-expanded") !== "true") await staticInspector.evaluate((node) => node.click());
    const staticTabs = staticPage.locator(".inspectorTabs button");
    if (await staticTabs.count() > 1) await staticTabs.nth(1).click();
    await staticPage.getByTestId("final-detective-workspace").waitFor({ state: "visible", timeout: 15_000 });
    const staticState = await staticPage.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      studyRecorder: document.body.innerText.includes("Campaign Study Recorder"),
      theatreCount: document.querySelectorAll("[data-testid='campaign-transition-theatre']").length,
      resolutionFieldCount: document.querySelectorAll("[data-testid='command-deck-feedback'] > span").length,
      worldChange: document.querySelector("[data-testid='command-deck-feedback'] [data-resolution-field='worldChange'] b")?.textContent || "",
      resolutionAriaLive: document.querySelector("[data-testid='command-deck-feedback']")?.getAttribute("aria-live") || "",
      storageLength: localStorage.length,
      workspaceRuntime: document.querySelector("[data-testid='final-detective-workspace']")?.getAttribute("data-workspace-runtime") || "",
      workspacePrimaryCount: document.querySelectorAll("[data-testid='final-detective-workspace'] [data-testid='final-workspace-primary-action']").length,
      workspaceRawLeak: /\b(?:npc|case|event|source|location|institution|resource|evidence|session|character)-[a-z0-9-]*\d[a-z0-9-]*\b|culpritId|victimId|hiddenTruth|rawBody|sourceId|[A-Za-z]:[\\/]/i.test(document.querySelector("[data-testid='final-detective-workspace']")?.textContent || "")
    }));
    if (apiRequests.length) failures.push(`Static Command Deck requested ${apiRequests.join(", ")}.`);
    if (staticState.overflow > 1) failures.push(`Static 390px overflowed by ${staticState.overflow}px.`);
    if (staticState.studyRecorder) failures.push("Static runtime displayed Study Recorder.");
    if (staticState.theatreCount) failures.push("Static runtime rendered a persistent Campaign Transition Theatre.");
    if (staticState.resolutionFieldCount !== 4 || staticState.worldChange !== "No persistent world change") failures.push("Static runtime did not expose the safe four-stage Ledger boundary.");
    if (staticState.resolutionAriaLive !== "polite") failures.push("Static Latest Resolution did not own its single polite live region.");
    if (staticState.storageLength) failures.push("Static Command Deck wrote localStorage.");
    if (staticState.workspaceRuntime !== "static-demo" || staticState.workspacePrimaryCount !== 1) failures.push("Static runtime did not expose the same read-only Final Detective Workspace projection with one local action.");
    if (staticState.workspaceRawLeak) failures.push("Static Final Detective Workspace exposed an internal identifier, private field, or path.");
    await staticPage.close();
  } finally {
    await browser.close();
  }
} catch (error) {
  failures.push(`${currentQaStep}: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await serverHarness?.cleanup();
}

const result = { ok: failures.length === 0, viewports, observations, failures };
console.log(jsonMode ? JSON.stringify(result) : result.ok ? "Command Deck browser QA passed." : failures.join("\n"));
if (!result.ok) process.exitCode = 1;
