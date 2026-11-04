import assert from "node:assert/strict";
import fs from "node:fs/promises";

const component = await fs.readFile("app/components/InvestigationRoomProjectionSurface.tsx", "utf8");
const styles = await fs.readFile("app/components/InvestigationRoomProjectionSurface.module.css", "utf8");
const page = await fs.readFile("app/page.tsx", "utf8");
const query = await fs.readFile("app/hooks/useInvestigationReadQueries.ts", "utf8");
const route = await fs.readFile("app/api/v1/query/case/room-projection/route.ts", "utf8");

for (const token of ["roomId", "caseId", "triggeredEventId", "routeStepIds", "evidenceNodeIds", "data-testid=\"investigation-room-projection\""]) {
  assert.equal(component.includes(token), true, `room surface renders ${token}`);
}
for (const token of ["perspective", "prefers-reduced-motion", "@media (max-width: 640px)", ".evidencePins", ".routeRail"]) {
  assert.equal(styles.includes(token), true, `room surface styles include ${token}`);
}
assert.match(query, /\/api\/v1\/query\/case\/room-projection/);
assert.match(query, /roomProjection:/);
assert.match(page, /roomProjection=\{roomProjection\}/);
assert.match(route, /mode === "review"/);
assert.match(route, /adminGuard\(request\)/);

console.log(JSON.stringify({ ok: true, suite: "room-projection-ui-contract", checks: ["semantic-identifiers", "responsive-preview", "reduced-motion", "player-query", "admin-review-boundary", "page-wiring"] }));
