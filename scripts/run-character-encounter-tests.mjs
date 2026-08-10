import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const sourcePath = path.join(process.cwd(), "app", "campaign", "character-encounter-model.ts");
const outputPath = path.join(process.cwd(), "outputs", "character-encounter-model-test.mjs");
const source = await fs.readFile(sourcePath, "utf8");
assert.equal(/WorldMapActor|CaseFromLog|MemoryRecord|PlayerSession|WorldEvent|PersistentTownRuntime|DeductionCase|AgentDecision/i.test(source), false, "pure encounter model has no case, memory, event, runtime, or agent authority import");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, compiled, "utf8");
const { deriveCharacterEncounter } = await import(`${pathToFileURL(outputPath).href}?test=${Date.now()}`);

const actions = [
  { kind: "question", label: "Question character", detail: "Ask a focused public question.", enabled: true, primary: true, shortcut: "Q", handlerKey: "interrogateCharacter" },
  { kind: "challenge", label: "Challenge testimony", detail: "Test a contradiction using discovered evidence.", enabled: true, primary: false, shortcut: "C", handlerKey: "challengeTestimony" },
  { kind: "review", label: "Review conclusion", detail: "Open the accepted conclusion.", enabled: false, primary: false, disabledReason: "Complete the certified route.", handlerKey: "showConclusion" }
];

const base = {
  actor: { name: "Mara Chen", roleLabel: "Reporter", locationLabel: "Town Square" },
  institution: { label: "Press Network", pressureBand: "watch" },
  faction: { label: "Press Network", standing: "neutral", directionLabel: "steady" },
  locationPressure: "watch",
  investigation: {
    hasCase: true,
    hasSession: true,
    joined: true,
    observed: true,
    questioned: false,
    challenged: false,
    accepted: false,
    caseLinked: true
  },
  actions
};

const before = structuredClone(base);
const first = deriveCharacterEncounter({
  ...base,
  socialResponse: {
    direction: "supportive",
    reactions: [{ actorName: "Mara Chen", roleLabel: "Reporter", locationLabel: "Town Square", reactionLabel: "coordinates openly with nearby townspeople" }]
  }
});
const second = deriveCharacterEncounter(structuredClone({
  ...base,
  socialResponse: {
    direction: "supportive",
    reactions: [{ actorName: "Mara Chen", roleLabel: "Reporter", locationLabel: "Town Square", reactionLabel: "coordinates openly with nearby townspeople" }]
  }
}));
assert.deepEqual(first, second, "same public context produces a deterministic encounter");
assert.deepEqual(base, before, "encounter projection never mutates its input");
assert.equal(first.posture, "supportive", "supportive town response produces supportive posture");
assert.equal(first.availability, "available", "case-linked actor with a legal action is available");
assert.equal(first.latestReaction, "coordinates openly with nearby townspeople", "latest reaction remains public text only");
assert.deepEqual(first.actions.map((action) => action.kind), ["question", "challenge", "review"], "existing action order is preserved");
assert.equal("handlerKey" in first.actions[0], false, "internal handler keys are stripped from the encounter card");

const guarded = deriveCharacterEncounter({
  ...base,
  faction: { label: "Press Network", standing: "strained", directionLabel: "guarded" },
  socialResponse: { direction: "guarded", reactions: [{ actorName: "Mara Chen", roleLabel: "Reporter", locationLabel: "Town Square", reactionLabel: "keeps a careful public watch" }] }
});
assert.equal(guarded.posture, "guarded", "guarded public response is visible without implying hidden truth");
assert.equal(guarded.availability, "limited", "guarded posture remains a legal but bounded contact");

const movedAfterReaction = deriveCharacterEncounter({
  ...base,
  socialResponse: { direction: "supportive", reactions: [{ actorName: "Mara Chen", roleLabel: "Reporter", locationLabel: "Harbor Walk", reactionLabel: "reassures nearby residents" }] }
});
assert.equal(movedAfterReaction.latestReaction, "reassures nearby residents", "latest actor reaction remains visible after the resident moves to another public place");

const avoidant = deriveCharacterEncounter({
  ...base,
  faction: { label: "Press Network", standing: "hostile", directionLabel: "closed" },
  socialResponse: { direction: "guarded", reactions: [{ actorName: "Mara Chen", roleLabel: "Reporter", locationLabel: "Town Square", reactionLabel: "avoids unnecessary contact" }] }
});
assert.equal(avoidant.posture, "avoidant", "closed public standing maps to avoidant posture");

const practice = deriveCharacterEncounter({
  ...base,
  investigation: { ...base.investigation, scope: "practice" }
});
assert.equal(practice.availability, "practice", "replay practice is clearly marked as world-frozen");
assert.match(practice.boundaryLabel, /Persistent Town remains frozen/i, "practice boundary is explicit");

const publicOnly = deriveCharacterEncounter({
  ...base,
  investigation: { ...base.investigation, hasCase: false, caseLinked: false },
  actions: []
});
assert.equal(publicOnly.availability, "public-only", "unlinked residents never receive a fabricated case action");
assert.equal(publicOnly.actions.length, 0, "unlinked residents have no invented legal action");

const serialized = JSON.stringify({ first, guarded, avoidant, practice, publicOnly });
assert.equal(/"(?:handlerKey|characterId|locationId|institutionId|sourceKey|eventId|caseId|truth|culprit|victim|rawBody|memoryRecord)"\s*:/i.test(serialized), false, "encounter output contains no internal keys or hidden truth terms");
assert.equal(/\b(?:culprit|victim|hidden truth|raw body|memory record)\b/i.test(serialized), false, "encounter copy contains no hidden case language");
assert.equal(/\b(?:npc|case|event|source|location|institution|resource|evidence|session|character)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(serialized), false, "encounter output contains no raw identifier values");

console.log(JSON.stringify({ ok: true, tests: ["determinism", "no-mutation", "supportive", "guarded", "avoidant", "practice-boundary", "public-only", "safe-output"] }));
