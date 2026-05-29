import { createEvalFixtures } from "./fixtures";
import { validateCaseSchema } from "./schema";
import { validateCase } from "./validators";
import type { EvalCase, EvalCaseResult, EvalReport } from "./types";

export function runEval(cases: EvalCase[] = createEvalFixtures()): EvalReport {
  const results: EvalCaseResult[] = cases.map((item) => {
    const schema = validateCaseSchema(item.case);
    const rule = validateCase(item.case);
    const driftCompatible = item.kind !== "drift" || (schema.normalizedHints.length > 0 && rule.valid === item.expectValid);
    const passed = schema.valid && rule.valid === item.expectValid && driftCompatible;
    return {
      id: item.id,
      name: item.name,
      kind: item.kind,
      expectValid: item.expectValid,
      schemaValid: schema.valid,
      ruleValid: rule.valid,
      passed,
      coverage: rule.reasoningCoverage.coverageRatio,
      errorCount: schema.errors.length + rule.errors.length,
      warningCount: schema.warnings.length + rule.warnings.length,
      driftCompatible,
      errors: [...schema.errors.map((error) => `${error.path}: ${error.message}`), ...rule.errors]
    };
  });
  const passed = results.filter((item) => item.passed).length;
  const averageCoverage = results.reduce((sum, item) => sum + item.coverage, 0) / Math.max(results.length, 1);
  return {
    generatedAt: new Date().toISOString(),
    total: results.length,
    passed,
    failed: results.length - passed,
    averageCoverage,
    results
  };
}

export function renderEvalMarkdown(report: EvalReport) {
  const lines = [
    "# Deduction Engine Evaluation Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Passed: ${report.passed}/${report.total}`,
    `Average coverage: ${Math.round(report.averageCoverage * 100)}%`,
    "",
    "| Case | Kind | Expected | Schema | Rules | Coverage | Result |",
    "| --- | --- | --- | --- | --- | --- | --- |"
  ];
  for (const result of report.results) {
    lines.push(
      `| ${result.name} | ${result.kind} | ${result.expectValid ? "valid" : "invalid"} | ${result.schemaValid ? "pass" : "fail"} | ${result.ruleValid ? "valid" : "invalid"} | ${Math.round(result.coverage * 100)}% | ${result.passed ? "pass" : "fail"} |`
    );
  }
  const failures = report.results.filter((item) => !item.passed);
  if (failures.length) {
    lines.push("", "## Failures", "");
    for (const failure of failures) {
      lines.push(`### ${failure.name}`, "", ...failure.errors.map((error) => `- ${error}`), "");
    }
  }
  return `${lines.join("\n")}\n`;
}
