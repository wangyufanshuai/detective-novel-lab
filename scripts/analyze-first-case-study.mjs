import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

function argument(name) {
  const inline = process.argv.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const inputArgument = argument("--input");
const outputArgument = argument("--output");
if (!inputArgument) throw new Error("Pass --input <first-case-study collection.json>; --output <report.md> is optional.");
const inputPath = path.resolve(inputArgument);
const outputPath = outputArgument ? path.resolve(outputArgument) : null;
if (outputPath && outputPath.toLowerCase() === inputPath.toLowerCase()) throw new Error("The report must not overwrite the input collection.");
const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "first-case-study-analysis-"));
const source = fs.readFileSync(new URL("../lib/first-case-study.ts", import.meta.url), "utf8");
const runtimePath = path.join(runtime, "model.cjs");
fs.writeFileSync(runtimePath, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
const model = createRequire(import.meta.url)(runtimePath);
const payload = JSON.parse(fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/, ""));
// Validation and cross-attempt checks finish before any report is written.
const analysis = model.analyzeFirstCaseStudy(payload);
const report = model.renderFirstCaseStudyReport(analysis);
if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, report, "utf8");
}
console.log(JSON.stringify({ ok: true, ...analysis, reportWritten: Boolean(outputPath) }, null, 2));
