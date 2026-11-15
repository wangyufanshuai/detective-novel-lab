import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createNoirTestLoader } from "./noir-player-test-loader.mjs";

const { load } = createNoirTestLoader();
const { casePeople, evidenceCheckRecord } = load("app/town-play/case-notebook.ts");
const { TownEvidencePreview } = load("app/town-play/TownEvidencePreview.tsx");
const { TownStreetConversation } = load("app/town-play/TownStreetConversation.tsx");
const c = {
  suspects: [{ id: "a", name: "甲", role: "店主" }, { id: "b", name: "乙", role: "站员" }],
  clues: [{ id: "clue-07", title: "公开小票", description: "05:18 买过豆浆。", sceneId: "cafe" }],
  conversations: [
    { id: "initial", characterId: "a", name: "甲", answer: "没有出门。", corrected: false },
    { id: "changed", characterId: "a", name: "甲", evidenceId: "clue-07", answer: "我去过咖啡馆。", corrected: true },
    { id: "witness", characterId: "w", name: "证人", answer: "我看见了。", corrected: false }
  ], questionedIds: ["a", "w"], solved: false
};
const residents = [{ npcId: "a", actorId: "actor-a", name: "甲", role: "店主", visibility: "last-seen", sceneId: "cafe", locationName: "咖啡馆", day: 2, time: "09:15", schedule: { now: "secret-location" }, secret: "never-export" }, { npcId: "unrelated", name: "无关居民", sceneId: "post" }];
const before = JSON.stringify({ c, residents });
const people = casePeople(c, residents, [{ id: "cafe" }]);
assert.deepEqual(people.map(p => p.id), ["a", "b", "w"]);
assert.equal(people[0].sceneId, "cafe");
assert(people[0].sighting.includes("第 2 天 09:15"));
assert.equal(people[0].corrected, true);
assert.equal(people[1].sceneId, null);
assert.equal(people[1].questioned, false);
assert.equal(people[2].role, "证人");
assert.equal(casePeople(c, residents, [{ id: "books" }])[0].sceneId, null, "An unmapped location must not produce a navigation button");
assert(!JSON.stringify(people).includes("secret-location"));
assert(!JSON.stringify(people).includes("never-export"));
assert.equal(JSON.stringify({ c, residents }), before, "Public source records must remain unchanged");
assert.equal(evidenceCheckRecord(c, "a", "not-discovered"), null);
assert.equal(evidenceCheckRecord(c, "b", "clue-07").previous, undefined, "A different person's check must not appear as this person's history");
assert.equal(evidenceCheckRecord(c, "a", "clue-07").previous.corrected, true);
const preview = renderToStaticMarkup(React.createElement(TownEvidencePreview, { investigation: c, personId: "a", evidenceId: "clue-07" }));
assert(preview.includes("公开小票") && preview.includes("05:18 买过豆浆。"));
assert(preview.includes("说法已更正") && preview.includes("再次出示仍会用五分钟"));
assert.equal(renderToStaticMarkup(React.createElement(TownEvidencePreview, { investigation: c, personId: "a", evidenceId: "hidden" })), "");
const unchanged = { ...c, conversations: c.conversations.map(line => ({...line, corrected: false})) };
assert(renderToStaticMarkup(React.createElement(TownEvidencePreview, { investigation: unchanged, personId: "a", evidenceId: "clue-07" })).includes("当时的说法未改变"));
const person = { actorId: "actor-a", npcId: "a", name: "甲", role: "店主", sceneId: "cafe" };
const dialogue = renderToStaticMarkup(React.createElement(TownStreetConversation, { person, view: { sceneId: "cafe", residents, investigation: c }, disabled: false, command: async () => { throw new Error("Reading must not send a command"); }, openBook() {}, close() {} }));
assert(dialogue.includes("对照最初记下的原话") && dialogue.includes("没有出门。") && dialogue.includes("我去过咖啡馆。"));
assert(dialogue.includes("对方已离开这次目击地点"));
assert.match(dialogue, /disabled=""[^>]*>再问问早晨的事/);
assert.match(dialogue, /disabled=""[^>]*>出示这份物证/);
console.log("✓ Follow-up: public sightings, unknown people, navigable places, privacy, check history, original testimony and departed-person controls passed");
