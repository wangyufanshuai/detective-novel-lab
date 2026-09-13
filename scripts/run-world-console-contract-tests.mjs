import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const surface = read("app/components/WorldConsoleSurface.tsx");
const home = read("app/components/HomeModeSurfaces.tsx");
const launch = read("app/hooks/useCampaignLaunchActions.ts");
const layout = read("app/layout.tsx");
const css = read("app/styles/world-console.css");

const checks = [
  ["surface-root", surface.includes('data-testid="world-console"')],
  ["hud", surface.includes('data-testid="world-console-hud"')],
  ["map", surface.includes('data-testid="world-console-map"')],
  ["timeline", surface.includes('data-testid="world-console-timeline"')],
  ["settlement-replay", surface.includes('data-testid="world-console-settlement"') && surface.includes("结算与世界回响")],
  ["safe-aftermath-aggregate", surface.includes("caseAftermathLog") && surface.includes("aftermath.length") && !surface.includes("latestAftermath.caseId")],
  ["safe-recovery-summary", surface.includes("campaignRecoverySummary?.status")],
  ["source-branch-diff-summary", surface.includes("sourceWorldId") && surface.includes("branchWorldId") && surface.includes("diffCount")],
  ["public-world-copy", surface.includes("localizeWorldCopy") && surface.includes("publicActorName") && surface.includes("公开事件")],
  ["agent-inspector", surface.includes('data-testid="world-console-agent-inspector"')],
  ["case-queue", surface.includes('data-testid="world-console-case-queue"')],
  ["replay-drawer", surface.includes('data-testid="world-console-replay-drawer"')],
  ["presentational-boundary", !/\b(fetch\s*\(|postV1|getV1|loadRuntimeWorld)\b/.test(surface)],
  ["home-wires-world-console", home.includes("<WorldConsoleSurface")],
  ["campaign-start-world-first", launch.includes('setAppMode("persistent-town")')],
  ["scoped-css-loaded", layout.includes('./styles/world-console.css')],
  ["responsive-grid", css.includes("@media (max-width: 900px)") && css.includes("@media (max-width: 600px)")],
  ["reduced-motion", css.includes("prefers-reduced-motion")],
  ["touch-targets", css.includes("min-height: 42px")]
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(JSON.stringify({ ok: false, failed }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, suite: "world-console-contracts", checks: checks.map(([name]) => name) }, null, 2));
