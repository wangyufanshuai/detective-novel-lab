import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const board = await fs.readFile(path.join(root, "app/components/CinematicDeductionBoard.tsx"), "utf8");
const boardCss = await fs.readFile(path.join(root, "app/components/CinematicDeductionBoard.module.css"), "utf8");
const shell = await fs.readFile(path.join(root, "app/components/CommandDeckShell.tsx"), "utf8");
const shellCss = await fs.readFile(path.join(root, "app/components/CommandDeckShell.responsive.module.css"), "utf8");

assert.match(board, /data-path-step=\{pathStep\}/, "the board exposes its active path step");
assert.match(board, /data-testid=\"investigation-path-stepper\"/, "the path rail is a real landmark");
for (const label of ["现场证据", "人物关系", "推理链"]) assert.match(board, new RegExp(label), `${label} remains visible to the player`);
assert.match(boardCss, /@container \(max-width: 700px\)/, "the board has a narrow-container layout");
assert.match(boardCss, /\.pathStepper[\s\S]*position: sticky/, "the mobile path rail stays available while scrolling");
assert.match(boardCss, /env\(safe-area-inset-bottom\)/, "the question surface accounts for the mobile safe area");
assert.match(boardCss, /min-height: 44px/, "board actions preserve the touch target budget");
assert.match(shell, /activeInspectorTab === \"logic\" \? panel\(\"logic\"\) \|\| panel\(\"investigation\"\)/, "accepted-case review falls back safely to the investigation desk");
assert.match(shell, /viewHeadingRef\.current\?\.focus\(\{ preventScroll: true \}\)/, "desk and review transitions return focus to a visible heading");
assert.match(shell, /deskTriggerRef/, "closing the desk can restore focus to its source trigger");
assert.match(shell, /trigger\?\.isConnected\) trigger\.focus\(\)/, "closing the desk restores focus when its source remains mounted");
assert.match(shellCss, /noir-deduction-workspace/, "the mobile shell keeps the case workspace boundary");
assert.match(shellCss, /min-height: 44px|44px/, "the responsive shell retains a minimum touch target");
assert.match(shellCss, /command-deck-map-lens[^\n]*min-height: 44px/, "mobile map lens controls meet the touch target");
assert.match(boardCss, /certifiedAction \{[^}]*env\(safe-area-inset-bottom\)/s, "the sticky certified action accounts for the mobile safe area");
assert.match(boardCss, /chainLinks > b \{[^}]*overflow-wrap: anywhere/s, "long evidence labels can wrap on narrow screens");

console.log(JSON.stringify({
  ok: true,
  suite: "goal6-mobile-contracts",
  checks: [
    "path-step-landmark",
    "path-step-copy",
    "narrow-container-layout",
    "sticky-mobile-path",
    "safe-area-inset",
    "touch-target",
    "accepted-review-fallback",
    "focus-return",
    "source-focus-return",
    "tablet-step-flow",
    "sticky-action-safe-area",
    "long-label-wrap"
  ]
}));
