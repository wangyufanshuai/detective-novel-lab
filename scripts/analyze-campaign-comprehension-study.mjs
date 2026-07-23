import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();

function argumentValue(name) {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const inputArgument = argumentValue("--input");
const outputArgument = argumentValue("--output");

if (!inputArgument) {
  throw new Error("Missing --input. Pass the browser-local detective-town-campaign-study-v1.json export without copying it into a public directory.");
}

const inputPath = path.resolve(root, inputArgument);
const outputPath = outputArgument ? path.resolve(root, outputArgument) : undefined;
const publicRoot = path.resolve(root, "public");
if (outputPath && (outputPath === publicRoot || outputPath.startsWith(`${publicRoot}${path.sep}`))) {
  throw new Error("The aggregate human-study report must not be written into public artifacts.");
}

const sourcePath = path.join(root, "lib", "campaign-comprehension-study.ts");
const runtimeDir = path.join(root, "outputs", "campaign-comprehension-analysis-runtime");
const runtimePath = path.join(runtimeDir, "campaign-comprehension-study.cjs");
await fs.mkdir(runtimeDir, { recursive: true });
const source = await fs.readFile(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText;
await fs.writeFile(runtimePath, compiled, "utf8");
const study = await import(pathToFileURL(runtimePath).href);

const payload = JSON.parse(await fs.readFile(inputPath, "utf8"));
const analysis = study.analyzeCampaignStudyGate(payload);
const report = study.renderCampaignStudyGateReport(analysis);
const forbiddenReportPattern = /\b(?:ordinal|worldId|caseId|sessionId|npcId|locationId|sourceId|eventId|seed|selectedAnswer|playerText|rawBody|hiddenTruth)\b|[A-Za-z]:[\\/]/i;
if (forbiddenReportPattern.test(report)) throw new Error("Aggregate report privacy validation failed.");

if (outputPath && !analysis.sampleReady) {
  throw new Error("The aggregate report was not written because the exact eight-attempt 2 x 2 official matrix is incomplete.");
}
if (outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${report}\n`, "utf8");
}

console.log(JSON.stringify({
  ok: true,
  status: analysis.status,
  sampleReady: analysis.sampleReady,
  humanGatePassed: analysis.humanGatePassed,
  eligibleOfficialCount: analysis.eligibleOfficialCount,
  interruptedOfficialCount: analysis.interruptedOfficialCount,
  unfinishedOfficialCount: analysis.unfinishedOfficialCount,
  officialOrderValid: analysis.officialOrderValid,
  metrics: Object.fromEntries(Object.entries(analysis.metrics).map(([key, metric]) => [key, metric.passed])),
  topConfusions: analysis.topConfusions,
  reportWritten: Boolean(outputPath)
}, null, 2));
