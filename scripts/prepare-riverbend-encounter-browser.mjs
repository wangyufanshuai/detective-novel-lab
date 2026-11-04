import fs from "node:fs";
import crypto from "node:crypto";
const hash=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const prior=JSON.parse(fs.readFileSync("output/playwright/riverbend-residents-checked-sources.json","utf8"));
const files=[...Object.keys(prior),"app/town-play/TownStreetConversation.tsx","app/town-play/town-interaction.ts","app/town-play/resident-encounter.ts"];
fs.writeFileSync("output/playwright/riverbend-encounters-checked-sources.json",JSON.stringify(Object.fromEntries(files.map(file=>[file,hash(file)])),null,2)+"\n");
let runner=fs.readFileSync("output/playwright/riverbend-resident-case.js","utf8");
function replace(before,after){if(!runner.includes(before))throw new Error("Missing old runner anchor: "+before.slice(0,90));runner=runner.replace(before,after);}
replace("  const go = async destination => {",fs.readFileSync("output/playwright/riverbend-encounter-helpers.js","utf8")+"  const go = async destination => {");
replace("    await go('books'); await click('领取调查手记', 'case-open');",`    const greetingBefore=await read();await approach('resident-07');await inspectFraming('precase-street-frame');await shot('greeting');
    assert(await page.getByRole('button',{name:'问问早晨的事',exact:false}).count()===0,'Case question appeared before receiving a case');
    const greetingPosition=await position();await page.keyboard.down('w');await page.waitForTimeout(350);await page.keyboard.up('w');
    assert(JSON.stringify(await position())===JSON.stringify(greetingPosition),'Conversation allowed player movement');
    const greetingAfter=await read();assert(greetingAfter.worldRevision===greetingBefore.worldRevision&&greetingAfter.time===greetingBefore.time,'Opening a greeting advanced story time');
    steps.push({name:'precase-encounter',time:greetingAfter.time,revision:greetingAfter.worldRevision});
    await go('books'); await click('领取调查手记', 'case-open');`);
replace("await click('交谈 · 许知微', 'case-question', false); await shot('books-dialogue');","await talk('resident-03'); await shot('books-dialogue');");
replace("await click('交谈 · 宋棠', 'case-question', false);","await talk('resident-01');");
replace("await go('books'); await click('交谈 · 许知微', 'case-question', false); await page.getByLabel('拿物证核对').selectOption('rb-clue-07'); await click('出示物证', 'case-challenge');","await go('books'); await talk('resident-03','rb-clue-07');");
replace("await go('cafe'); await click('交谈 · 宋棠', 'case-question', false); await page.getByLabel('拿物证核对').selectOption('rb-clue-04'); await click('出示物证', 'case-challenge');","await go('cafe'); await talk('resident-01','rb-clue-04');");
// The street surface opens the same persistent case book using its own button.
replace("await page.getByRole('button', { name: '打开案件本 →', exact: true }).click(); await page.getByRole('button', { name: '整理推断', exact: true }).click();","await page.getByRole('button', { name: '翻开案件本', exact: true }).click(); await page.getByRole('button', { name: '整理推断', exact: true }).click();");
runner=runner.replaceAll("riverbend-resident-case-","riverbend-encounter-case-");
fs.writeFileSync("output/playwright/riverbend-encounter-case.js",runner);
console.log(JSON.stringify({checkedSources:files.length,prepared:true}));
