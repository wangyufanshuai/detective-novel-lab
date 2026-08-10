import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const sourcePath = path.join(process.cwd(), "app", "campaign", "town-map-lens-model.ts");
const outputPath = path.join(process.cwd(), "outputs", "town-map-lens-model-test.mjs");
const source = await fs.readFile(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, compiled, "utf8");
const { deriveTownMapLensViewModel } = await import(`${pathToFileURL(outputPath).href}?test=${Date.now()}`);

const input = {
  world: {
    locations: [
      { id: "location-court-01", name: "North Court" },
      { id: "location-dock-02", name: "Public Dock" }
    ]
  },
  snapshot: {
    tiles: [
      { locationName: "North Court", evidenceCount: 2, discoveredEvidenceCount: 1 },
      { locationName: "Public Dock", evidenceCount: 1, discoveredEvidenceCount: 1 }
    ]
  },
  runtime: {
    tick: 8,
    ruleState: {
      institutions: [
        { id: "institution-court-01", name: "Magistrate Court", influenceByLocation: { "location-court-01": 72, "location-dock-02": 20 } },
        { id: "institution-trade-02", name: "Dock Union", influenceByLocation: { "location-court-01": 20, "location-dock-02": 64 } }
      ]
    },
    locationProfiles: [
      { locationId: "location-court-01", heat: 3, resourcePressure: 2 },
      { locationId: "location-dock-02", heat: 8, resourcePressure: 6 }
    ]
  },
  brief: null,
  socialResponse: {
    direction: "guarded",
    reactions: [{ locationLabel: "Public Dock", reactionLabel: "keeps a careful public watch" }]
  }
};

const before = structuredClone(input);
const first = deriveTownMapLensViewModel(input);
const second = deriveTownMapLensViewModel(structuredClone(input));
assert.deepEqual(first, second, "same safe state produces deterministic lenses");
assert.deepEqual(input, before, "lens derivation never mutates runtime or case-facing input");
assert.deepEqual(first.controls.map((control) => control.kind), ["institution", "pressure", "reaction", "evidence"], "four lens kinds have one fixed order");
assert.equal(new Set(first.controls.map((control) => control.kind)).size, 4, "lens controls are mutually exclusive kinds");
assert.equal(first.defaultLens, "evidence", "evidence is the map-first default lens");

const court = first.locationSignals.find((signal) => signal.locationName === "North Court");
const dock = first.locationSignals.find((signal) => signal.locationName === "Public Dock");
assert.equal(court?.institutionTone, "high", "strong institution influence becomes a high signal");
assert.equal(court?.evidenceTone, "high", "remaining evidence stays visually prominent");
assert.equal(dock?.pressureTone, "high", "bounded location pressure becomes a high signal");
assert.equal(dock?.reactionTone, "high", "guarded public response becomes a high reaction signal");
assert.equal(dock?.evidenceTone, "watch", "fully discovered evidence remains a review signal");

const serialized = JSON.stringify(first);
assert.equal(/"[A-Za-z]+Ids?":/.test(serialized), false, "safe lens output contains no internal id fields");
assert.equal(/\b(?:npc|case|event|source|location|institution|resource|evidence|scene|session|character)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(serialized), false, "safe lens output contains no raw identifier values");
console.log(JSON.stringify({ ok: true, tests: ["determinism", "no-mutation", "fixed-lenses", "institution", "pressure", "reaction", "evidence", "safe-output"] }));
