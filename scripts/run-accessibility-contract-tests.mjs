import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFile(path.join(root, file), "utf8");
const [layout, localeContext, globals, frontDoor, onboarding, workspace, theatre, commandDeck, townMap, encounter, districtFronts] = await Promise.all([
  read("app/layout.tsx"), read("app/localization/locale-context.tsx"), read("app/globals.css"),
  read("app/components/CampaignFrontDoor.tsx"), read("app/components/DetectiveTownUI.tsx"),
  read("app/components/CinematicDeductionBoard.tsx"), read("app/components/CampaignTransitionTheatre.tsx"),
  read("app/components/CommandDeckShell.tsx"), read("app/components/NoirMapStage.tsx"),
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
assert.match(workspace, /<label[^>]*>[\s\S]*?name="cinematic-challenge-question"/, "The actual shared desk question has a label and stable field name");
assert.match(workspace, /name="cinematic-theory-motive"/);
assert.match(workspace, /name="cinematic-theory-method"/);
assert.match(workspace, /aria-pressed=\{active\}/, "Evidence selection exposes pressed state on the actual shared desk");
assert.doesNotMatch(workspace, /<main className=\{styles\.context\}/, "Final Detective Workspace does not create a nested main landmark");
assert.match(theatre, /aria-live=\{presentation\.phase/);
assert.doesNotMatch(commandDeck, /commandDeckNotifications[^>]*aria-live/);
assert.match(commandDeck, /inert=\{blockingOverlayActive \|\| transitionVisible \? true : undefined\}/, "The background player workspace is inert beneath the active major overlay");
assert.match(commandDeck, /viewHeadingRef\.current\?\.focus/);
assert.match(commandDeck, /navigationRefs\.current\.explore\?\.focus/, "Escape restores focus to the Explore navigation entry");
assert.match(townMap, /<button[^>]*key=\{place\.id\}/, "Every actual map location is a named native button");
assert.match(townMap, /<button[^>]*key=\{marker\.id\}/);
assert.match(townMap, /<button[^>]*key=\{actor\.id\}/);
assert.match(townMap, /event\.key === "Escape"/);
assert.match(townMap, /lastTrigger\.current\?\.focus/);
assert.match(encounter, /aria-label=\{t\("encounter\.aria"/);
assert.doesNotMatch(commandDeck, /mapToolbar|townDetails/, "The player shell does not retain the retired duplicate map toolbar or drawer");
assert.match(townMap, /className=\{styles\.mapTools\}/, "The map stage owns the single semantic toolbar");

for (const [file, source] of Object.entries({ frontDoor, onboarding, workspace, townMap, encounter, districtFronts })) {
  assert.doesNotMatch(source, /<div[^>]+onClick=|<span[^>]+onClick=/, `${file} has no new non-semantic click target`);
}

console.log(JSON.stringify({ ok: true, suite: "accessibility-contracts", checks: ["lang", "skip-link", "focus-visible", "dialogs", "focus-restore", "drawer-focus", "semantic-map-controls", "forms", "landmarks", "live-owner", "reduced-motion", "touch-target"] }));
