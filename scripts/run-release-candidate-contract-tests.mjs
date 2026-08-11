import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const serverQaScripts = [
  "scripts/run-bilingual-accessibility-browser-qa.mjs",
  "scripts/run-campaign-comprehension-browser-qa.mjs",
  "scripts/run-campaign-front-door-browser-qa.mjs",
  "scripts/run-command-deck-browser-qa.mjs",
  "scripts/run-district-strategic-front-browser-qa.mjs",
  "scripts/run-investigator-headquarters-browser-qa.mjs",
  "scripts/run-static-boundary-qa.mjs",
  "scripts/run-static-browser-qa.mjs",
  "scripts/run-strategic-command-browser-qa.mjs",
  "scripts/run-strategic-pacing-browser-qa.mjs",
  "scripts/run-persistent-town-api-smoke.mjs",
  "scripts/run-nine-case-campaign-playthrough.mjs"
];
const helperImport = /release-candidate-server\.mjs/;
const helperSource = read("scripts/lib/release-candidate-server.mjs");
assert.doesNotMatch(helperSource, /RC_DATABASE_URL/, "RC server database isolation cannot be overridden by ambient environment");
assert.match(helperSource, /const database = temporaryDatabase\(prefix\)\.databaseUrl/, "every RC server receives a unique temporary database");
assert.match(helperSource, /AI_PROVIDER: "mock"[\s\S]*DEEPSEEK_API_KEY: ""[\s\S]*SILICONFLOW_API_KEY: ""/, "RC server lifecycle always clears live provider credentials");
for (const script of serverQaScripts) {
  const source = read(script);
  assert.match(source, helperImport, `${script} uses the RC server lifecycle helper`);
  assert.doesNotMatch(source, /(?:const|let)\s+(?:port|fixedPort)\s*=\s*\d{4,5}/, `${script} has no fixed QA port`);
  assert.doesNotMatch(source, /(?:localhost|127\.0\.0\.1):\d{4,5}/, `${script} has no embedded fixed URL`);
}

for (const script of serverQaScripts.filter((item) => item.includes("browser-qa"))) {
  assert.match(read(script), /lang=en-US/, `${script} pins the English baseline locale`);
}

const browserQaScripts = fs.readdirSync(path.join(root, "scripts"))
  .filter((name) => /^run-.*-browser-qa\.mjs$/.test(name))
  .map((name) => `scripts/${name}`);
for (const script of browserQaScripts) {
  assert.doesNotMatch(read(script), /waitForTimeout\s*\(/, `${script} does not use fixed sleep as browser synchronization`);
}
const latencyInjections = browserQaScripts.flatMap((script) => [...read(script).matchAll(/setTimeout\s*\(/g)].map(() => script));
assert.deepEqual(latencyInjections, ["scripts/run-command-deck-browser-qa.mjs"], "only Command Deck owns the deliberate network-latency injection");
assert.match(read(latencyInjections[0]), /Controlled latency injection/, "the retained delay is documented as fault injection rather than synchronization");

const smokeSource = read("scripts/run-persistent-town-api-smoke.mjs");
assert.doesNotMatch(smokeSource, /process\.exit\s*\(/, "API smoke timeout cannot bypass finally cleanup");
assert.match(smokeSource, /AbortSignal\.(?:any|timeout)/, "API smoke has bounded request/overall cancellation");

const packageJson = JSON.parse(read("package.json"));
assert.equal(typeof packageJson.scripts["quality:rc"], "string", "package exposes quality:rc");
const gateSource = read("scripts/run-release-candidate-gate.mjs");
for (const forbidden of [
  "qa:" + "release-local",
  "public-catalog:" + "build",
  "dataset:" + "export",
  "dataset:" + "static-reader",
  "5000",
  "10000"
]) {
  assert.equal(gateSource.includes(forbidden), false, `quality:rc does not invoke forbidden operation ${forbidden}`);
}
for (const protectedPath of ["public/dataset-reader", "public/review-catalog"]) {
  assert.match(gateSource, new RegExp(protectedPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `quality:rc hashes ${protectedPath}`);
}
for (const documentPath of [
  "docs/v10.0-distribution-runbook.md",
  "docs/v10.0-migration-policy.md",
  "docs/v10.0-validation-report.md"
]) {
  assert.equal(fs.existsSync(path.join(root, documentPath)), true, `${documentPath} is part of the RC handoff`);
}

console.log(JSON.stringify({
  ok: true,
  serverQaScripts: serverQaScripts.length,
  checks: ["shared-server-lifecycle", "dynamic-ports", "en-US-baseline", "state-based-browser-sync", "bounded-api-timeouts", "gate-scope", "protected-path-hash", "release-documents"]
}));
