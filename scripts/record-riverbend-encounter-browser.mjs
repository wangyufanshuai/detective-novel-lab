import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const sha=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const read=file=>JSON.parse(fs.readFileSync(file,"utf8"));
const result=file=>{
  const line=fs.readFileSync(file,"utf8").split(/\r?\n/).find(line=>line.startsWith('{"status":'));
  assert(line,`Missing browser result: ${file}`);
  const value=JSON.parse(line);
  assert.equal(value.status,"passed",`${file}: ${value.failures}`);
  assert.deepEqual(value.failures,[]);assert.deepEqual(value.errors,[]);assert.deepEqual(value.warnings,[]);
  return value;
};
const prefix="docs/3d-town/riverbend-encounters-v1/";
const caseRun=result("output/playwright/riverbend-encounter-case.log");
const mobile=result("output/playwright/riverbend-encounter-mobile.log");
const noon=result("output/playwright/riverbend-encounter-noon.log");
const sources=read("output/playwright/riverbend-encounters-checked-sources.json");
for(const [file,hash]of Object.entries(sources))assert.equal(sha(file),hash,`Source changed after review: ${file}`);
const caseSources=read("output/playwright/riverbend-encounter-case-checked-sources.json"),cssPath="app/town-play/town-play.module.css",caseCssPath="output/playwright/riverbend-encounter-case-checked.css";
for(const [file,hash]of Object.entries(caseSources))if(file!==cssPath)assert.equal(sha(file),hash,`Functional source changed after full case: ${file}`);
assert.equal(sha(caseCssPath),caseSources[cssPath]);
const beforeRule=".interact { bottom: 116px; }",afterRule=".interact { left: auto; right: 24px; bottom: 100px; transform: none; max-width: calc(50vw - 40px); }.interact span { overflow: hidden; text-overflow: ellipsis; }";
const checkedCss=fs.readFileSync(caseCssPath,"utf8").replaceAll("\r\n","\n");assert.equal(checkedCss.split(beforeRule).length,2);
assert.equal(fs.readFileSync(cssPath,"utf8").replaceAll("\r\n","\n"),checkedCss.replace(beforeRule,afterRule),"Only the reviewed short-screen prompt offset may differ from the full-case CSS");
const measured=read(prefix+"function-form-review.json");assert.equal(measured.passed,true);
for(const input of measured.inputs)assert.equal(sha(input.path),input.sha256,`Stale encounter input: ${input.path}`);
const manifest=read("public/assets/riverbend/residents-v2/manifest.json");
assert.equal(sha("public"+manifest.asset.url),manifest.asset.sha256);
assert.equal(manifest.asset.sha256,measured.assetSha256);
assert.equal(sha("docs/3d-town/riverbend-residents-v2/riverbend-residents.blend"),manifest.sourceSha256);
assert.equal(sha("public/assets/riverbend/v1/town.glb"),manifest.baseAssetSha256);
for(const [file,hash]of Object.entries(manifest.proofs))assert.equal(sha("docs/3d-town/riverbend-residents-v2/"+file),hash,`Stale art proof: ${file}`);
assert.equal(new Set(caseRun.steps.filter(s=>s.name.startsWith("walk-")).map(s=>s.sceneId)).size,6);
assert(caseRun.steps.some(s=>s.name==="case-solved"&&s.solved&&s.clues===8));
assert.equal(caseRun.steps.filter(s=>s.name==="street-question").length,2);
assert.equal(caseRun.steps.filter(s=>s.name==="street-challenge").length,2);
assert(caseRun.steps.some(s=>s.name==="precase-encounter"&&s.time==="08:00"&&s.revision===0));
assert.equal(noon.observed.length,4);assert.equal(noon.time,"12:40");
const frames=[...caseRun.steps,...mobile.steps,...noon.steps].filter(s=>s.framing);
for(const {name,framing}of frames){assert.equal(framing.overflow,false,name);assert.deepEqual(framing.collisions,[],name);assert.deepEqual(framing.outside,[],name);}
for(const size of ["320x568","390x844","768x1024","844x390","1440x900"])assert(mobile.steps.some(s=>s.name===`conversation-${size}`));
assert(mobile.steps.some(s=>s.name==="conversation-gesture-and-reduced-motion"));
assert(mobile.steps.some(s=>s.name==="touch-hold-release-after-conversation"));
const folder=fs.mkdtempSync("output/playwright/riverbend-encounter-review-");
const preserve=file=>{
  const dest=path.join(folder,path.basename(file)).replaceAll("\\","/");
  fs.copyFileSync(file,dest);return {path:dest,sha256:sha(dest),bytes:fs.statSync(dest).size};
};
const screenshots=[...caseRun.shots,...mobile.shots,...noon.shots].map(preserve);
const report={schema:"riverbend-encounter-browser.v1",reviewedAt:new Date().toISOString(),status:"street-conversation-and-camera-candidate-pass-full-goal-open",
  sourceFiles:sources,sourceCapture:preserve("output/playwright/riverbend-encounters-checked-sources.json"),
  rawLogs:["case","mobile","noon"].map(name=>preserve(`output/playwright/riverbend-encounter-${name}.log`)),
  runners:["case","mobile","noon","helpers","mobile-body","noon-body"].map(name=>preserve(`output/playwright/riverbend-encounter-${name}.js`)),
  preparationScripts:["browser","mobile","noon"].map(name=>preserve(`scripts/prepare-riverbend-encounter-${name}.mjs`)),
  screenshots,
  measuredFunctionForm:{path:prefix+"function-form-review.json",sha256:sha(prefix+"function-form-review.json"),checks:measured.checks,maxRadius:measured.maxRadius,minY:measured.minY},
  geometry:{residentSourceSha256:manifest.sourceSha256,residentAssetSha256:manifest.asset.sha256,baseAssetSha256:manifest.baseAssetSha256,changed:false,scope:"Existing background-Blender resident source, multiview and export gates retained; this iteration layers interaction poses and camera changes on that exact geometry."},
  caseRegression:{browser:caseRun.browser,worldId:caseRun.worldId,caseId:caseRun.caseId,finalTime:caseRun.finalTime,finalRevision:caseRun.finalRevision,steps:caseRun.steps,requests:caseRun.requests,sourceFiles:caseSources,sourceCapture:preserve("output/playwright/riverbend-encounter-case-checked-sources.json"),checkedCss:preserve(caseCssPath),scope:"Full six-place case, restored draft and saved ending on these exact functional sources. After this run only the short-screen interaction-prompt CSS position changed; its exact replacement is checked by the recorder and the current mobile/noon reviews cover that final layout."},
  mobile:{browser:mobile.browser,worldId:mobile.worldId,finalTime:mobile.finalTime,finalRevision:mobile.finalRevision,scope:mobile.scope,steps:mobile.steps,requests:mobile.requests},
  noon:{browser:noon.browser,worldId:noon.worldId,time:noon.time,worldRevision:noon.worldRevision,observed:noon.observed,scope:noon.scope,steps:noon.steps},
  retainedCorrections:["output/playwright/riverbend-encounter-mobile-obscured-head.log","output/playwright/riverbend-encounter-mobile-obscured-head.png","output/playwright/riverbend-encounter-mobile-landscape-crop.log","output/playwright/riverbend-encounter-mobile-landscape-crop.png","output/playwright/riverbend-encounter-noon-prompt-overlap.log","output/playwright/riverbend-encounter-noon-prompt-overlap.png","output/playwright/riverbend-encounter-mobile-preflight-error.log"].map(preserve),
  corrections:["At 320x568 the case summary covered the player's head. Conversation now hides that summary and the development label, retaining the clock.","At 844x390 the half-height speech panel covered the resident's feet. A higher camera frame on short screens clears both characters; all tested sizes were repeated.","The normal noon landscape view exposed a central observation prompt over four walking residents. Only the short-screen prompt CSS was then moved to the right; final mobile and noon reviews were repeated. The full-case source binding preserves the earlier CSS separately.","The mobile runner initially failed parsing because its source splitter assumed LF line endings. The preparer now normalizes CRLF and refuses a missing boundary; no product execution occurred in that preflight failure."],
  boundaries:{greeting:"Authored public flavour only; greeting, camera, reading and gestures do not advance authoritative time.",interaction:"Visible observed residents in the confirmed place, within 1.85 m and without a wall in the client affordance; nearest doorway remains accessible.",authority:"Existing owned, persisted server actions validate co-location, evidence and frozen case facts. UI proximity is not a new server-level physics guarantee.",animation:"Original rigid joint hierarchy, fixed feet and subtle head/arm gesture; reduced-motion preference stops gestures. No generated dialogue, private schedule input or new body location."},
  gates:{observedStreetConversation:true,completeAuthoredCaseRegression:true,emulatedPhoneTouch:true,reviewedResponsiveCamera:true,engineeringPoseEnvelope:true,newBlenderGeometry:false,productionBuild:false,sustainedFullGamePerformance:false,physicalDevice:false,humanArtApproved:false,novelWorkflow:false},
  limitations:["The art remains a replaceable candidate. Subtle rigid-joint gestures are not lip sync, skinning or a finished animation library.","Camera bounds cover the recorded places, poses and viewport samples, not every possible composition.","Mobile checks use a desktop browser's touch emulation, not a physical phone.","Earlier resident performance probes belong to their earlier source version; this camera and conversation build has not completed a new sustained or production performance gate.","Cross-place commute presentation, traversable interiors, day/night, shared novel workflow and a 6-8 chapter same-case candidate remain unfinished."]};
fs.writeFileSync(prefix+"browser-review.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({status:report.status,retained:folder,screenshots:screenshots.length,caseTime:caseRun.finalTime,framingSamples:frames.length,noonResidents:noon.observed.length}));
