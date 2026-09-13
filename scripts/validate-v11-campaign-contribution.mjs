import fs from "node:fs";
import path from "node:path";
import { localizePublicText } from "../app/localization/locale-catalog.ts";
import { readWorldPackageDirectory } from "../lib/world-package-catalog.ts";
import { loadEngineForTool } from "./load-engine-for-tools.mjs";
import { validateCampaignEvidenceManifest } from "./v11-alpha-evidence-lib.mjs";

const root = process.cwd();
const jsonMode = process.argv.includes("--json");
const campaignFilters = process.argv
  .filter((argument) => argument.startsWith("--campaign="))
  .map((argument) => argument.slice("--campaign=".length))
  .filter(Boolean);
const evidenceArgument = process.argv.find((argument) => argument.startsWith("--evidence="))?.slice("--evidence=".length);
const evidencePath = path.resolve(evidenceArgument || path.join(root, "outputs", "v11-alpha", "72-case-evidence-manifest.json"));
const expectedRouteIds = ["baseline", "counter-route"];
const expectedOrdinals = [1, 2, 3];
const forbiddenPublicOutput = /(?:\b(?:case|route|session|source|event|npc|location|institution|resource|evidence)Id\b|hidden.?truth|raw.?body|culprit|victim|checkpoint|sqlite|[A-Za-z]:[\\/])/i;
const hanText = /\p{Script=Han}/u;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function unique(values) {
  return [...new Set(values)];
}

function addString(target, value) {
  if (typeof value === "string" && value.trim()) target.push(value.trim());
}

function publicCampaignStrings(campaign, cases) {
  const values = [];
  addString(values, campaign.volumeLabel);
  addString(values, campaign.label);
  addString(values, campaign.themeLabel);
  for (const route of campaign.routes || []) {
    addString(values, route.label);
    addString(values, route.strategyLabel);
    addString(values, route.finaleLabel);
    addString(values, route.replayContrast);
    for (const chapter of route.chapters || []) {
      addString(values, chapter.label);
      addString(values, chapter.objectiveLabel);
      addString(values, chapter.evidenceThemeLabel);
      addString(values, chapter.worldSurfaceLabel);
    }
  }
  for (const definition of cases) {
    for (const key of [
      "title", "theme", "publicPremise", "publicCaseFile", "causalBridge",
      "occupationalPressure", "evidenceFrame", "witnessFrame", "challengeFrame", "aftermathLabel"
    ]) addString(values, definition[key]);
    for (const value of Object.values(definition.evidenceTitles || {})) addString(values, value);
    for (const value of definition.redHerrings || []) addString(values, value);
  }
  return unique(values);
}

function treatmentContrast(baseline, counter) {
  const dimensions = {
    chapterCaseFamilies: JSON.stringify(baseline.map((item) => item.caseFamily)) !== JSON.stringify(counter.map((item) => item.caseFamily)),
    leadRhythm: JSON.stringify(baseline.map((item) => item.rhythm)) !== JSON.stringify(counter.map((item) => item.rhythm)),
    evidenceFrame: JSON.stringify(baseline.map((item) => item.evidenceFrame)) !== JSON.stringify(counter.map((item) => item.evidenceFrame)),
    redHerrings: JSON.stringify(baseline.flatMap((item) => item.redHerrings)) !== JSON.stringify(counter.flatMap((item) => item.redHerrings)),
    causalBridge: JSON.stringify(baseline.map((item) => item.causalBridge)) !== JSON.stringify(counter.map((item) => item.causalBridge)),
    finaleCaseFamily: baseline.at(-1)?.caseFamily !== counter.at(-1)?.caseFamily
  };
  return { dimensions, distinctCount: Object.values(dimensions).filter(Boolean).length };
}

const engine = await loadEngineForTool("v11-campaign-contribution");
const registry = engine.listDetectiveCampaignDefinitions();
const allCases = engine.listAuthoredCampaignCaseDefinitions();
const safeTextIndex = engine.campaignLocalizedSafeTextIndex();
const selectedCampaigns = campaignFilters.length
  ? registry.filter((campaign) => campaignFilters.includes(campaign.id))
  : registry;
const missingCampaigns = campaignFilters.filter((campaignId) => !registry.some((campaign) => campaign.id === campaignId));
let evidenceManifest = null;
let evidenceIntegrity = false;
let evidenceError = "";

try {
  evidenceManifest = readJson(evidencePath);
  const evidenceValidation = validateCampaignEvidenceManifest(evidenceManifest);
  evidenceIntegrity = evidenceValidation.status === "automated-pass";
  if (!evidenceIntegrity) evidenceError = evidenceValidation.summary;
} catch (error) {
  evidenceError = error instanceof Error ? error.message : String(error);
}

const reports = [];
const templates = ["archive-blunt", "clocktower-locked-room", "clinic-poison", "greenhouse-blade"];

for (const campaign of selectedCampaigns) {
  const errors = [];
  const warnings = [];
  const definitions = allCases
    .filter((item) => item.campaignId === campaign.id)
    .sort((left, right) => left.routeId.localeCompare(right.routeId) || left.ordinal - right.ordinal);
  const routeIds = campaign.routes.map((route) => route.id);
  if (campaign.routes.length !== 2 || JSON.stringify([...routeIds].sort()) !== JSON.stringify([...expectedRouteIds].sort())) {
    errors.push("Campaign must expose exactly baseline and counter-route.");
  }
  for (const route of campaign.routes) {
    if (route.chapters.length !== 3 || JSON.stringify(route.chapters.map((chapter) => chapter.ordinal)) !== JSON.stringify(expectedOrdinals)) {
      errors.push(`${route.id} must expose ordered chapters 1, 2, and 3.`);
    }
  }
  if (definitions.length !== 6) errors.push("Campaign must provide exactly six authored treatments.");
  for (const routeId of expectedRouteIds) {
    const ordinals = definitions.filter((item) => item.routeId === routeId).map((item) => item.ordinal);
    if (JSON.stringify(ordinals) !== JSON.stringify(expectedOrdinals)) errors.push(`${routeId} must provide authored treatments 1, 2, and 3.`);
  }

  const primaryPackageId = campaign.worldPackageIds[0];
  const packageDirectory = primaryPackageId ? path.join(root, "world-packs", primaryPackageId) : "";
  const source = primaryPackageId ? readWorldPackageDirectory(packageDirectory, root) : null;
  const manifest = source?.validation?.package?.manifest;
  if (!primaryPackageId) errors.push("Campaign must declare a primary WorldPackage.");
  if (!source) errors.push(`Primary WorldPackage ${primaryPackageId || "<missing>"} was not found.`);
  if (source && !source.validation.ok) errors.push(...source.validation.errors.map((error) => `WorldPackage: ${error}`));
  if (source?.validation?.warnings?.length) errors.push(...source.validation.warnings.map((warning) => `WorldPackage warning: ${warning}`));
  if (source && source.packageId !== primaryPackageId) errors.push("WorldPackage directory, manifest identity, and Campaign binding must agree.");
  if (manifest?.schemaVersion !== "world-package.v1") errors.push("WorldPackage schemaVersion must be world-package.v1.");
  if (!/^1\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(String(manifest?.version || ""))) {
    errors.push("WorldPackage manifest.version must be SemVer with major version 1.");
  }
  if (campaign.worldPackageIds.length > 1) warnings.push("Compatibility aliases are present; only the primary WorldPackage is evaluated for admission.");

  const baseline = definitions.filter((item) => item.routeId === "baseline");
  const counter = definitions.filter((item) => item.routeId === "counter-route");
  const contrast = treatmentContrast(baseline, counter);
  if (contrast.distinctCount < 4) errors.push("Paired routes must differ in at least four authored dimensions.");
  if (campaign.routes[0]?.replayContrast === campaign.routes[1]?.replayContrast) errors.push("Paired routes must expose distinct replayContrast copy.");

  const localizationFailures = [];
  const localizationValues = publicCampaignStrings(campaign, definitions);
  // Legacy Campaigns predate the co-located bilingual index. Keep their
  // admission check honest for all public labels and authored titles while
  // allowing the stricter full-copy requirement for new authoring modules.
  const valuesToCheck = campaign.localizedText ? localizationValues : localizationValues.filter((value) => (
    value === campaign.label
    || value === campaign.volumeLabel
    || campaign.routes.some((route) => [route.label, route.finaleLabel].includes(value))
    || definitions.some((definition) => definition.title === value)
  ));
  for (const value of valuesToCheck) {
    const projected = safeTextIndex[value]?.["zh-CN"] || localizePublicText(value, "zh-CN");
    if (!projected || projected === value || !hanText.test(projected) || forbiddenPublicOutput.test(projected)) {
      localizationFailures.push(value);
    }
  }
  if (localizationFailures.length) errors.push(`${localizationFailures.length} public strings lack a safe Chinese projection.`);
  if (!campaign.localizedText) warnings.push("Campaign uses legacy co-located copy; full treatment-level localization will be required for newly authored Campaigns.");

  const certificateRows = [];
  for (let index = 0; index < definitions.length; index += 1) {
    const definition = definitions[index];
    const base = engine.createStaticDemoRuntime(templates[index % templates.length]);
    const treated = structuredClone(base.activeCase);
    const truthBefore = structuredClone(treated.deductionCase.truth);
    const evidenceBefore = treated.deductionCase.evidence.map((item) => item.id).sort();
    engine.applyAuthoredCampaignCaseTreatment(treated, definition);
    const validation = engine.validateWorldCase(base.world, base.events, treated.deductionCase);
    const certificate = engine.certifyPlayableCase(treated, base.events);
    const autoSolve = engine.autoSolvePlayableCase(treated, base.events);
    const authorityIsolated = JSON.stringify(treated.deductionCase.truth) === JSON.stringify(truthBefore)
      && JSON.stringify(treated.deductionCase.evidence.map((item) => item.id).sort()) === JSON.stringify(evidenceBefore);
    const passed = validation.valid
      && certificate.routeCertified
      && autoSolve.passed
      && autoSolve.summary.proofCoverageComplete
      && treated.qualityReport.nonCulpritExcluded
      && treated.qualityReport.timeline24hComplete
      && authorityIsolated;
    if (!passed) errors.push(`${definition.routeId}/chapter-${definition.ordinal} failed Route Certificate or authority isolation.`);
    certificateRows.push({ route: definition.routeId, ordinal: definition.ordinal, status: passed ? "automated-pass" : "failed" });
  }

  const evidenceRows = (evidenceManifest?.cases || [])
    .filter((item) => item.campaign === campaign.id)
    .sort((left, right) => left.route.localeCompare(right.route) || left.ordinal - right.ordinal);
  const evidenceKeys = evidenceRows.map((item) => `${item.route}/${item.ordinal}`);
  const expectedEvidenceKeys = expectedRouteIds.flatMap((routeId) => expectedOrdinals.map((ordinal) => `${routeId}/${ordinal}`)).sort();
  const playthroughPassed = evidenceIntegrity
    && evidenceRows.length === 6
    && JSON.stringify([...evidenceKeys].sort()) === JSON.stringify(expectedEvidenceKeys)
    && evidenceRows.every((item) => item.status === "automated-pass");
  if (!playthroughPassed) errors.push(`Reproducible six-case playthrough evidence is missing or invalid (${evidenceError || path.relative(root, evidencePath)}).`);

  reports.push({
    campaignId: campaign.id,
    packageId: primaryPackageId,
    status: errors.length ? "failed" : "automated-pass",
    checks: {
      worldPackage: Boolean(source?.validation.ok && source.validation.warnings.length === 0),
      compatibility: manifest?.schemaVersion === "world-package.v1" && /^1\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(String(manifest?.version || "")),
      routeShape: definitions.length === 6,
      routeContrastDimensions: contrast.distinctCount,
      routeCertificates: certificateRows.filter((item) => item.status === "automated-pass").length,
      safeChineseProjection: localizationFailures.length === 0,
      playthroughEvidence: playthroughPassed
    },
    localizationFailures: localizationFailures.slice(0, 8),
    warnings,
    errors
  });
}

const result = {
  schema: "detective-town.v11-campaign-contribution.v1",
  ok: missingCampaigns.length === 0 && reports.length > 0 && reports.every((report) => report.status === "automated-pass"),
  evidencePath: path.relative(root, evidencePath).replaceAll("\\", "/"),
  evidenceHash: evidenceIntegrity ? evidenceManifest.evidenceHash : null,
  campaignCount: reports.length,
  passedCampaigns: reports.filter((report) => report.status === "automated-pass").length,
  missingCampaigns,
  campaigns: reports
};

if (jsonMode) {
  console.log(JSON.stringify(result));
} else {
  console.log(`Campaign contribution gate: ${result.passedCampaigns}/${result.campaignCount} passed`);
  for (const report of reports) console.log(`- ${report.campaignId}: ${report.status}${report.errors.length ? ` (${report.errors.join("; ")})` : ""}`);
}
if (!result.ok) process.exitCode = 1;
