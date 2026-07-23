import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const contentRoot = path.join(root, "content", "detective-v1");
const read = (name) => JSON.parse(fs.readFileSync(path.join(contentRoot, name), "utf8"));
const events = read("event-archetypes.json");
const progressions = read("progression-lines.json");
const factions = read("factions.json");
const locations = new Map(read("locations.json").map((item) => [item.id, item.label]));
const roles = new Map(read("roles.json").map((item) => [item.id, item.label]));
const factionById = new Map(factions.map((item) => [item.id, item]));
const jsonMode = process.argv.includes("--json");
const strict = process.argv.includes("--strict");
const write = process.argv.includes("--write");

const rows = events.map((event) => {
  const progressionLabels = progressions.filter((line) => line.eventArchetypeIds.includes(event.id)).map((line) => line.label);
  const institutionKinds = Array.from(new Set(Object.values(event.directiveResponses || {}).map((response) => response.institutionKind)));
  const factionLabels = event.factionIds.map((id) => factionById.get(id)?.label).filter(Boolean);
  const actorLabels = event.roleIds.map((id) => roles.get(id) || id);
  const placeLabels = event.locationIds.map((id) => locations.get(id) || id);
  const surfaces = {
    actor: actorLabels.length > 0,
    place: placeLabels.length > 0,
    institution: institutionKinds.length > 0 || factionLabels.length > 0
  };
  return {
    event: event.label,
    actorLabels,
    placeLabels,
    institutionLabels: [...factionLabels, ...institutionKinds],
    progressionLabels,
    responseCount: Object.keys(event.directiveResponses || {}).length,
    surfaces,
    complete: Object.values(surfaces).every(Boolean) && progressionLabels.length > 0
  };
});

const report = {
  formatVersion: 1,
  eventCount: rows.length,
  completeCount: rows.filter((row) => row.complete).length,
  gapCount: rows.filter((row) => !row.complete).length,
  rows
};
const markdown = [
  "# Detective Content Consequence Preview",
  "",
  "Internal authoring view only. It verifies that an event can be presented through a public actor role, place, institution/faction, and progression line. It does not load case truth or runtime bodies.",
  "",
  `Coverage: ${report.completeCount}/${report.eventCount} event archetypes have all four presentation surfaces.`,
  "",
  "| Event | Actor surface | Place surface | Institution surface | Progression | Responses | Status |",
  "|---|---|---|---|---|---:|---|",
  ...rows.map((row) => `| ${row.event} | ${row.actorLabels.join(" / ") || "—"} | ${row.placeLabels.join(" / ") || "—"} | ${row.institutionLabels.join(" / ") || "—"} | ${row.progressionLabels.join(" / ") || "—"} | ${row.responseCount} | ${row.complete ? "ready" : "gap"} |`),
  ""
].join("\n");

if (write) {
  const output = path.join(root, "outputs", "content-consequence-preview.md");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, markdown, "utf8");
}
console.log(jsonMode ? JSON.stringify(report) : markdown);
if (strict && report.gapCount > 0) process.exitCode = 1;
