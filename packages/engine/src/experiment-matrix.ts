import {
  runRuleAblationSuite,
  type LongRunValidationReport,
  type RuleAblationDelta,
  type RuleAblationVariant
} from "./long-run-validation";
import type { ScenarioPack } from "./scenario-pack";
import type { TownMapPack } from "./town-map-pack";
import type { TownRuleCatalog } from "./town-rules";

export type ExperimentMatrixConfig = {
  ticks: number;
  seeds: string[];
  threshold: number;
  minimumCaseCount: number;
};

export type ExperimentMatrixSource = {
  experimentId: string;
  experimentHash?: string;
  scenarioPack: ScenarioPack;
  mapPack: TownMapPack;
  ruleCatalog: TownRuleCatalog;
};

export type ExperimentVariantDelta = {
  experimentId: string;
  seed: string;
  variant: Exclude<RuleAblationVariant, "baseline">;
  changed: boolean;
  strongestMetric: string;
  relativeChange: number;
  metricDeltas: Record<string, number>;
};

export type ExperimentMatrixRun = {
  experimentId: string;
  experimentHash?: string;
  seed: string;
  baseline: {
    ok: boolean;
    caseCount: number;
    uniqueCaseCount: number;
    distinctCaseTypeCount: number;
    candidateDiversityScore: number;
    candidateRepeatRate: number;
    causalLinkCount: number;
    laterCaseInfluenceRate: number;
    deterministicRunHash: string;
  };
  variantDeltas: RuleAblationDelta[];
  caseTypeDistribution: LongRunValidationReport["metrics"]["diversity"]["caseTypeDistribution"];
  passedQualityGate: boolean;
  errors: string[];
};

export type ExperimentMatrixReport = {
  matrixId: string;
  generatedAt: string;
  ok: boolean;
  config: ExperimentMatrixConfig;
  experiments: Array<{ experimentId: string; experimentHash?: string }>;
  runs: ExperimentMatrixRun[];
  variantDeltas: ExperimentVariantDelta[];
  caseTypeDistribution: Record<string, Record<string, number>>;
  summary: {
    experimentCount: number;
    runCount: number;
    qualityPassedExperimentCount: number;
    qualityPassedRunCount: number;
    changedVariantCount: number;
    variantCount: number;
    matrixScore: number;
  };
  errors: string[];
};

function qualityGate(report: LongRunValidationReport, config: ExperimentMatrixConfig) {
  return report.ok &&
    report.metrics.caseCount >= config.minimumCaseCount &&
    report.metrics.uniqueCaseCount === report.metrics.caseCount &&
    report.metrics.candidateDiversityScore >= 70 &&
    report.metrics.candidateRepeatRate <= 20 &&
    report.metrics.causalLinkCount >= (config.ticks >= 1000 ? 120 : 70) &&
    report.metrics.diversity.distinctCaseTypeCount >= 4 &&
    report.metrics.caseGraph.laterCaseInfluenceRate >= 60 &&
    report.metrics.evidenceGraph.warnings.length === 0;
}

export function runExperimentMatrix(
  sources: ExperimentMatrixSource[],
  input: Partial<ExperimentMatrixConfig> = {}
): ExperimentMatrixReport {
  const config: ExperimentMatrixConfig = {
    ticks: Math.max(100, input.ticks || 500),
    seeds: input.seeds?.length ? input.seeds : ["matrix-a", "matrix-b", "matrix-c"],
    threshold: input.threshold ?? 20,
    minimumCaseCount: input.minimumCaseCount || ((input.ticks || 500) >= 1000 ? 8 : 5)
  };
  const runs: ExperimentMatrixRun[] = [];
  const variantDeltas: ExperimentVariantDelta[] = [];
  const distribution: Record<string, Record<string, number>> = {};

  for (const source of sources) {
    distribution[source.experimentId] ||= {};
    for (const seed of config.seeds) {
      const ablation = runRuleAblationSuite({
        seed,
        tickCount: config.ticks,
        minimumCaseCount: config.minimumCaseCount,
        scenarioPack: source.scenarioPack,
        mapPack: source.mapPack,
        ruleCatalog: source.ruleCatalog,
        snapshotEveryTicks: 5,
        checkpointEveryTicks: 25,
        threshold: config.threshold
      });
      const baseline = ablation.baseline;
      for (const [caseType, count] of Object.entries(baseline.metrics.diversity.caseTypeDistribution)) {
        distribution[source.experimentId][caseType] = (distribution[source.experimentId][caseType] || 0) + Number(count || 0);
      }
      const passedQualityGate = qualityGate(baseline, config);
      const errors = [
        ...baseline.errors,
        ...ablation.errors,
        passedQualityGate ? "" : `${source.experimentId}/${seed} did not pass the complete campaign quality gate`
      ].filter(Boolean);
      runs.push({
        experimentId: source.experimentId,
        experimentHash: source.experimentHash,
        seed,
        baseline: {
          ok: baseline.ok,
          caseCount: baseline.metrics.caseCount,
          uniqueCaseCount: baseline.metrics.uniqueCaseCount,
          distinctCaseTypeCount: baseline.metrics.diversity.distinctCaseTypeCount,
          candidateDiversityScore: baseline.metrics.candidateDiversityScore,
          candidateRepeatRate: baseline.metrics.candidateRepeatRate,
          causalLinkCount: baseline.metrics.causalLinkCount,
          laterCaseInfluenceRate: baseline.metrics.caseGraph.laterCaseInfluenceRate,
          deterministicRunHash: baseline.metrics.deterministicRunHash
        },
        variantDeltas: ablation.ablationDeltas,
        caseTypeDistribution: baseline.metrics.diversity.caseTypeDistribution,
        passedQualityGate,
        errors
      });
      for (const delta of ablation.ablationDeltas) {
        variantDeltas.push({
          experimentId: source.experimentId,
          seed,
          variant: delta.variant,
          changed: delta.changed,
          strongestMetric: delta.strongestMetric,
          relativeChange: delta.relativeChange,
          metricDeltas: delta.metricDeltas
        });
      }
    }
  }
  const passedExperimentIds = new Set(
    sources
      .filter((source) => config.seeds.every((seed) => runs.find((run) => run.experimentId === source.experimentId && run.seed === seed)?.passedQualityGate))
      .map((source) => source.experimentId)
  );
  const changedVariantCount = variantDeltas.filter((delta) => delta.changed).length;
  const qualityPassedRunCount = runs.filter((run) => run.passedQualityGate).length;
  const matrixScore = Math.round((
    (qualityPassedRunCount / Math.max(runs.length, 1)) * 60 +
    (changedVariantCount / Math.max(variantDeltas.length, 1)) * 40
  ));
  const errors = [
    passedExperimentIds.size < Math.min(2, sources.length) ? `Only ${passedExperimentIds.size}/2 experiment folders passed the complete quality gate.` : "",
    ...variantDeltas.filter((delta) => !delta.changed).map((delta) =>
      `${delta.experimentId}/${delta.seed}/${delta.variant} strongest delta ${delta.relativeChange}% is below ${config.threshold}%.`
    )
  ].filter(Boolean);
  return {
    matrixId: `matrix-${Date.now().toString(36)}`,
    generatedAt: new Date().toISOString(),
    ok: errors.length === 0,
    config,
    experiments: sources.map((source) => ({ experimentId: source.experimentId, experimentHash: source.experimentHash })),
    runs,
    variantDeltas,
    caseTypeDistribution: distribution,
    summary: {
      experimentCount: sources.length,
      runCount: runs.length,
      qualityPassedExperimentCount: passedExperimentIds.size,
      qualityPassedRunCount,
      changedVariantCount,
      variantCount: variantDeltas.length,
      matrixScore
    },
    errors
  };
}

export function renderExperimentMatrixMarkdown(report: ExperimentMatrixReport) {
  const lines = [
    "# Experiment Comparison Matrix",
    "",
    `Matrix: ${report.matrixId}`,
    `Generated: ${report.generatedAt}`,
    `Passed: ${report.ok ? "yes" : "no"}`,
    `Ticks: ${report.config.ticks}`,
    `Seeds: ${report.config.seeds.join(", ")}`,
    `Score: ${report.summary.matrixScore}`,
    "",
    "| Experiment | Seed | Cases | Unique | Types | Diversity | Repeat | Causal | Influence | Gate |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...report.runs.map((run) =>
      `| ${run.experimentId} | ${run.seed} | ${run.baseline.caseCount} | ${run.baseline.uniqueCaseCount} | ${run.baseline.distinctCaseTypeCount} | ${run.baseline.candidateDiversityScore} | ${run.baseline.candidateRepeatRate}% | ${run.baseline.causalLinkCount} | ${run.baseline.laterCaseInfluenceRate}% | ${run.passedQualityGate ? "pass" : "fail"} |`
    ),
    "",
    "## Ablation Deltas",
    "",
    "| Experiment | Seed | Variant | Strongest metric | Change |",
    "| --- | --- | --- | --- | ---: |",
    ...report.variantDeltas.map((delta) =>
      `| ${delta.experimentId} | ${delta.seed} | ${delta.variant} | ${delta.strongestMetric} | ${delta.relativeChange}% |`
    )
  ];
  if (report.errors.length) lines.push("", "## Errors", "", ...report.errors.map((error) => `- ${error}`));
  return `${lines.join("\n")}\n`;
}
