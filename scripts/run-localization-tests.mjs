import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const runtimeDir = path.join(root, "outputs", "v96-localization-runtime");
await fs.rm(runtimeDir, { recursive: true, force: true });
await fs.mkdir(runtimeDir, { recursive: true });

for (const name of ["locale-catalog", "locale-preference"]) {
  const source = await fs.readFile(path.join(root, "app", "localization", `${name}.ts`), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText.replace(/require\("\.\/locale-catalog"\)/g, 'require("./locale-catalog.cjs")');
  await fs.writeFile(path.join(runtimeDir, `${name}.cjs`), output, "utf8");
}

const catalog = await import(`${pathToFileURL(path.join(runtimeDir, "locale-catalog.cjs")).href}?v96=${Date.now()}`);
const preference = await import(`${pathToFileURL(path.join(runtimeDir, "locale-preference.cjs")).href}?v96=${Date.now()}`);
const validation = catalog.validateLocaleCatalog();
assert.equal(validation.ok, true, "both locale catalogs are complete and public-safe");
assert.ok(validation.keyCount >= 150, "main-path catalog remains broad enough for the release baseline");

const en = catalog.localeCatalogSnapshot("en-US");
const zh = catalog.localeCatalogSnapshot("zh-CN");
assert.deepEqual(Object.keys(en), Object.keys(zh), "English and Chinese catalogs have identical typed keys");
assert.equal(Object.values(en).every((value) => typeof value === "string" && value.trim().length > 0), true, "English messages are non-empty");
assert.equal(Object.values(zh).every((value) => typeof value === "string" && value.trim().length > 0), true, "Chinese messages are non-empty");
assert.equal(catalog.formatLocaleMessage("en-US", "front.campaign", { ordinal: 4 }), "Campaign 4");
assert.equal(catalog.formatLocaleMessage("zh-CN", "front.campaign", { ordinal: 4 }), "Campaign 4");
assert.equal(catalog.formatLocaleMessage("zh-CN", "workspace.objective"), "当前目标");
assert.equal(catalog.formatLocaleMessage("en-US", "workspace.objective"), "Current Objective");
assert.equal(catalog.localizePublicText("Town Reckoning", "zh-CN"), "城镇清算");
assert.equal(catalog.localizePublicText("The Empty Cue", "zh-CN"), "空缺提示");
assert.equal(catalog.localizePublicText(en["status.worldCreated"], "zh-CN"), zh["status.worldCreated"], "stored system copy follows an explicit locale switch");
assert.equal(catalog.localizePublicText(zh["error.generic"], "en-US"), en["error.generic"], "stored error copy follows an explicit locale switch");
assert.equal(catalog.localizePublicText("unknown public phrase", "zh-CN"), "unknown public phrase", "unknown authored copy falls back without exposing a translation key");

const sourceTree = { title: "Town Reckoning", nested: ["The Empty Cue"], count: 2 };
const localizedTree = catalog.localizeSafeTree(sourceTree, "zh-CN");
assert.deepEqual(localizedTree, { title: "城镇清算", nested: ["空缺提示"], count: 2 });
assert.deepEqual(sourceTree, { title: "Town Reckoning", nested: ["The Empty Cue"], count: 2 }, "safe localization never mutates the authority source");

assert.equal(preference.resolveBrowserLocale({ query: "zh-CN", stored: { formatVersion: 1, locale: "en-US" }, languages: ["en"] }), "zh-CN", "URL locale has first priority");
assert.equal(preference.resolveBrowserLocale({ stored: { formatVersion: 1, locale: "en-US" }, languages: ["zh-CN"] }), "en-US", "versioned explicit preference has second priority");
assert.equal(preference.resolveBrowserLocale({ stored: { locale: "zh-CN" }, languages: ["zh-Hans"] }), "zh-CN", "invalid legacy preference is ignored in favor of navigator language");
assert.equal(preference.resolveBrowserLocale({ languages: ["fr-FR"] }), "en-US", "unsupported languages deterministically fall back to English");
assert.deepEqual(preference.normalizeLocalePreference({ formatVersion: 1, locale: "zh-CN", worldId: "must-not-survive" }), { formatVersion: 1, locale: "zh-CN" }, "preference projection retains locale fields only");
assert.equal(preference.normalizeLocalePreference({ formatVersion: 2, locale: "en-US" }), null, "unknown preference versions fail closed");

const serialized = JSON.stringify({ en, zh, localizedTree });
assert.doesNotMatch(serialized, /\b(?:culpritId|victimId|caseId|sessionId|worldId|npcId|sourceId|eventId|hiddenTruth|rawBody)\b|[A-Za-z]:[\\/]/i, "locale output contains no forbidden authority keys or absolute paths");

const localizedSurfaceSources = await Promise.all([
  "app/components/CharacterEncounterCard.tsx",
  "app/components/DistrictStrategicFronts.tsx",
  "app/components/InvestigationDebriefReplaySurface.tsx",
  "app/hooks/useInvestigationWorkspacePresentation.ts"
].map((file) => fs.readFile(path.join(root, file), "utf8")));
for (const source of localizedSurfaceSources) assert.match(source, /useAppLocale/, "audited main-path surfaces consume the typed locale boundary");
assert.doesNotMatch(localizedSurfaceSources[0], />Character encounter<|>Public standing<|>Next legal action</, "character encounter has no hard-coded English system labels");
assert.doesNotMatch(localizedSurfaceSources[1], />Strategic Fronts<|>District Operations<|>Why now</, "District Fronts has no hard-coded English system labels");
assert.doesNotMatch(localizedSurfaceSources[2], /SQLite schema|Low-spoiler solved-case summary only/, "Replay boundaries use localized, implementation-safe copy");
assert.doesNotMatch(localizedSurfaceSources[3], /\$\{selectedEvent\.locationId\}|\$\{selectedAgent\.locationId\}/, "Inspector summaries never render raw location keys");

console.log(JSON.stringify({ ok: true, suite: "localization", keyCount: validation.keyCount, locales: ["en-US", "zh-CN"] }));
