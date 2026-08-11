import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFile(path.join(root, file), "utf8");
const [layout, localeContext, globals, frontDoor, onboarding, workspace, theatre, commandDeck, townMap, encounter, districtFronts] = await Promise.all([
  read("app/layout.tsx"), read("app/localization/locale-context.tsx"), read("app/globals.css"),
  read("app/components/CampaignFrontDoor.tsx"), read("app/components/DetectiveTownUI.tsx"),
  read("app/components/FinalDetectiveWorkspace.tsx"), read("app/components/CampaignTransitionTheatre.tsx"),
  read("app/components/CommandDeckShell.tsx"), read("app/components/TownMapSurface.tsx"),
  read("app/components/CharacterEncounterCard.tsx"), read("app/components/DistrictStrategicFronts.tsx")
]);

assert.match(layout, /<html lang="en-US"/);
assert.match(layout, /<AppLocaleProvider>/);
assert.match(localeContext, /className="skipToMain"/);
assert.match(localeContext, /id="detective-town-main"/);
assert.match(globals, /:focus-visible/);
assert.doesNotMatch(`${globals}\n${await read("app/components/CampaignFrontDoor.module.css")}`, /outline:\s*none/);
assert.match(globals, /prefers-reduced-motion:\s*reduce/);
assert.match(globals, /min-height:\s*44px/);
assert.match(frontDoor, /role="dialog"/);
assert.match(frontDoor, /aria-modal="true"/);
assert.match(frontDoor, /event\.key === "Escape"/);
assert.match(frontDoor, /event\.key !== "Tab"/);
assert.match(onboarding, /role="dialog"/);
assert.match(onboarding, /aria-modal="true"/);
assert.match(onboarding, /restoreFocusRef/);
assert.match(workspace, /name="investigation-question"/);
assert.match(workspace, /name="theory-motive"/);
assert.match(workspace, /aria-pressed=\{item\.selected\}/);
assert.doesNotMatch(workspace, /<main className=\{styles\.context\}/, "Final Detective Workspace does not create a nested main landmark");
assert.match(theatre, /aria-live=\{presentation\.phase/);
assert.doesNotMatch(commandDeck, /commandDeckNotifications[^>]*aria-live/);
assert.match(commandDeck, /id="command-deck-context-drawer"[\s\S]{0,240}inert=\{compactLayout && activePanel !== "context"/);
assert.match(commandDeck, /focusPanel\(next\)/);
assert.match(townMap, /className="mapTileHitTarget"/);
assert.match(townMap, /<button\s+type="button"\s+key=\{marker\.id\}/);
assert.match(townMap, /<button\s+type="button"\s+key=\{actor\.id\}/);
assert.match(encounter, /aria-label=\{t\("encounter\.aria"/);
assert.match(districtFronts, /onKeyDown=\{\(event\) => navigateFront/);

for (const [file, source] of Object.entries({ frontDoor, onboarding, workspace, townMap, encounter, districtFronts })) {
  assert.doesNotMatch(source, /<div[^>]+onClick=|<span[^>]+onClick=/, `${file} has no new non-semantic click target`);
}

console.log(JSON.stringify({ ok: true, suite: "accessibility-contracts", checks: ["lang", "skip-link", "focus-visible", "dialogs", "focus-restore", "drawer-focus", "semantic-map-controls", "forms", "landmarks", "live-owner", "reduced-motion", "touch-target"] }));
