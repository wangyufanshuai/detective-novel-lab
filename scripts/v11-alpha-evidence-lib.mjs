import crypto from "node:crypto";

export const V11_ALPHA_EVIDENCE_SCHEMA = "detective-town.v11-alpha-evidence.v1";
export const V11_ALPHA_BROWSER_EVIDENCE_SCHEMA = "detective-town.v11-alpha-browser-observability.v1";
export const V11_ALPHA_REPORT_SCHEMA = "detective-town.v11-alpha-report.v1";
export const V11_LONG_RUN_GATE_SCHEMA = "detective-town.v11-long-run-gate.v1";
export const V11_GOLD_SLICE_BEHAVIOR_SCHEMA = "detective-town.v11-gold-slice-behavior-evidence.v1";

const REJECTION_CATEGORY_ORDER = ["trigger", "means", "route-integrity", "evidence-coverage", "unknown"];
const STATUS_ORDER = ["automated-pass", "human-pending", "not-run", "failed"];

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson(value[key])]));
}

export function sha256Json(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stableJson(value))).digest("hex");
}

const LONG_RUN_TICK_COUNTS = [5000, 10000];

function isPassingLongRun(run, tickCount, requirements) {
  return run?.status === "automated-pass"
    && run.tickCount === tickCount
    && run.minimumCaseCount === requirements.minimumCaseCount
    && run.cases >= requirements.minimumCaseCount
    && run.uniqueCases === run.cases
    && run.evidenceGraphWarnings === 0
    && run.completeEvidenceCaseCount === run.resolvedEvidenceCaseCount
    && run.runtimeMs <= requirements.maxRuntimeMsPerRun
    && /^fnv1a-[a-f0-9]+$/.test(run.deterministicRunHash || "")
    && Boolean(run.artifactRunId);
}

export function buildLongRunGateEvidence(input) {
  const requirements = {
    tickCounts: LONG_RUN_TICK_COUNTS,
    minimumCaseCount: input.minimumCaseCount,
    maxRuntimeMsPerRun: input.maxRuntimeMsPerRun
  };
  const runs = [...(input.runs || [])].sort((left, right) => left.tickCount - right.tickCount);
  const passCount = LONG_RUN_TICK_COUNTS.filter((tickCount) => {
    const matching = runs.filter((run) => run.tickCount === tickCount);
    return matching.length === 1 && isPassingLongRun(matching[0], tickCount, requirements);
  }).length;
  const summary = {
    status: passCount === LONG_RUN_TICK_COUNTS.length && runs.length === LONG_RUN_TICK_COUNTS.length ? "automated-pass" : "failed",
    passCount,
    failCount: LONG_RUN_TICK_COUNTS.length - passCount
  };
  const evidenceBody = {
    command: input.command,
    requirements,
    runs,
    summary
  };
  return {
    schema: V11_LONG_RUN_GATE_SCHEMA,
    generatedAt: input.generatedAt || new Date().toISOString(),
    ...evidenceBody,
    evidenceHash: sha256Json(evidenceBody)
  };
}

export function validateLongRunGateEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") {
    return { status: "not-run", summary: "5000 / 10000 tick evidence has not been generated." };
  }
  const evidenceBody = {
    command: evidence.command,
    requirements: evidence.requirements,
    runs: evidence.runs,
    summary: evidence.summary
  };
  const requirements = evidence.requirements || {};
  const requirementsMatch = JSON.stringify(requirements.tickCounts) === JSON.stringify(LONG_RUN_TICK_COUNTS)
    && Number.isInteger(requirements.minimumCaseCount)
    && requirements.minimumCaseCount > 0
    && Number.isFinite(requirements.maxRuntimeMsPerRun)
    && requirements.maxRuntimeMsPerRun > 0;
  const runs = Array.isArray(evidence.runs) ? evidence.runs : [];
  const runsPass = requirementsMatch
    && runs.length === LONG_RUN_TICK_COUNTS.length
    && LONG_RUN_TICK_COUNTS.every((tickCount) => {
      const matching = runs.filter((run) => run.tickCount === tickCount);
      return matching.length === 1 && isPassingLongRun(matching[0], tickCount, requirements);
    });
  const hashMatches = evidence.evidenceHash === sha256Json(evidenceBody);
  const passed = evidence.schema === V11_LONG_RUN_GATE_SCHEMA
    && evidence.summary?.status === "automated-pass"
    && evidence.summary?.passCount === LONG_RUN_TICK_COUNTS.length
    && evidence.summary?.failCount === 0
    && runsPass
    && hashMatches;
  const failedRunSummary = runs.map((run) => {
    const runtime = Number.isFinite(run.runtimeMs) ? ` in ${run.runtimeMs}ms` : "";
    const cases = Number.isFinite(run.cases) ? `, ${run.cases}/${requirements.minimumCaseCount} cases` : "";
    return `${run.tickCount || "unknown"} ticks ${run.status || "failed"}${cases}${runtime}${run.failure ? ` (${run.failure})` : ""}`;
  }).join("; ");
  return {
    status: passed ? "automated-pass" : "failed",
    summary: passed
      ? `5000 and 10000 tick runs passed; evidence hash ${evidence.evidenceHash}.`
      : `${failedRunSummary || "Long-run evidence is incomplete"}; evidence hash ${hashMatches ? "verified" : "mismatch"}.`
  };
}

export function validateGoldSliceBehaviorEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") {
    return { status: "not-run", summary: "Gold Slice behavior evidence has not been generated.", hashMatches: false };
  }
  const evidenceBody = {
    suite: evidence.suite,
    scope: evidence.scope,
    status: evidence.status,
    checks: evidence.checks,
    coreActionEffects: evidence.coreActionEffects
  };
  const requiredChecks = [
    "evidence-discovery-selection-exclusion",
    "claim-evidence-challenge-world-reaction",
    "rapid-action-restoration",
    "three-chapter-finale-recall",
    "theory-pressure-idempotence",
    "authority-isolation",
    "core-action-effect-contract"
  ];
  const effects = evidence.coreActionEffects || {};
  const effectContractValid = ["discover", "select", "exclude", "challenge", "reject-theory", "recover", "finale"]
    .every((action) => Array.isArray(effects[action]) && effects[action].some((effect) => ["cognition", "world", "risk"].includes(effect)));
  const hashMatches = evidence.evidenceHash === sha256Json(evidenceBody);
  const passed = evidence.schema === V11_GOLD_SLICE_BEHAVIOR_SCHEMA
    && evidence.suite === "cinematic-deduction-gold-slice"
    && evidence.scope?.campaign === "Midnight Chorus"
    && evidence.scope?.route === "Public Reckoning"
    && evidence.scope?.chapters === 3
    && evidence.status === "automated-pass"
    && Array.isArray(evidence.checks)
    && requiredChecks.every((check) => evidence.checks.includes(check))
    && effectContractValid
    && hashMatches;
  return {
    status: passed ? "automated-pass" : "failed",
    summary: passed
      ? `${evidence.checks.length}/${evidence.checks.length} Gold Slice behavior checks passed; evidence hash ${evidence.evidenceHash}.`
      : `Gold Slice behavior evidence is incomplete or invalid; evidence hash ${hashMatches ? "verified" : "mismatch"}.`,
    hashMatches
  };
}

export function classifyCandidateRejectionReason(reason) {
  const normalized = normalizeText(reason).toLowerCase();
  if (/real case trigger|death or crime|triggered event/.test(normalized)) return "trigger";
  if (/means|means-access|resource access/.test(normalized)) return "means";
  if (/evidence|contamination|provenance|chain depth/.test(normalized)) return "evidence-coverage";
  if (/motive|opportunity|cover-up|staging|memory|testimony|timeline|exclusion|culprit|victim|route/.test(normalized)) return "route-integrity";
  return "unknown";
}

export function createCandidateRejectionAccumulator() {
  return {
    seen: new Set(),
    categories: new Map(REJECTION_CATEGORY_ORDER.map((category) => [category, new Map()])),
    examples: new Map(REJECTION_CATEGORY_ORDER.map((category) => [category, []])),
    exampleKeys: new Map(REJECTION_CATEGORY_ORDER.map((category) => [category, new Set()]))
  };
}

export function recordCandidateRejections(accumulator, context) {
  for (const candidate of context.candidates || []) {
    if (candidate.validation?.valid) continue;
    const primaryReasons = candidate.validation?.failureReasons?.length
      ? candidate.validation.failureReasons
      : candidate.validation?.errors || [];
    const reasons = Array.from(new Set(primaryReasons.map(normalizeText).filter(Boolean)));
    for (const reason of reasons) {
      const key = [context.campaign, context.route, context.ordinal, candidate.id || candidate.caseType || "candidate", reason].join("|");
      if (accumulator.seen.has(key)) continue;
      accumulator.seen.add(key);
      const category = classifyCandidateRejectionReason(reason);
      const reasonCounts = accumulator.categories.get(category);
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
      const examples = accumulator.examples.get(category);
      const caseType = candidate.caseType || "unspecified";
      const exampleKey = [context.campaign, context.route, context.ordinal, caseType, reason].join("|");
      const exampleKeys = accumulator.exampleKeys.get(category);
      if (examples.length < 3 && !exampleKeys.has(exampleKey)) {
        exampleKeys.add(exampleKey);
        examples.push({
          locator: `${context.campaign}/${context.route}/case-${context.ordinal}/${caseType}`,
          campaign: context.campaign,
          route: context.route,
          ordinal: context.ordinal,
          caseType,
          reason
        });
      }
    }
  }
}

export function summarizeCandidateRejections(accumulator) {
  const categories = REJECTION_CATEGORY_ORDER.map((category) => {
    const reasons = [...accumulator.categories.get(category).entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
    return {
      category,
      count: reasons.reduce((sum, item) => sum + item.count, 0),
      reasonCount: reasons.length,
      reasons,
      examples: accumulator.examples.get(category)
    };
  });
  return {
    total: categories.reduce((sum, item) => sum + item.count, 0),
    categories
  };
}

export function buildCampaignEvidenceManifest(input) {
  const cases = [...(input.cases || [])].sort((left, right) =>
    left.campaign.localeCompare(right.campaign) || left.route.localeCompare(right.route) || left.ordinal - right.ordinal
  );
  const passCount = cases.filter((item) => item.status === "automated-pass").length;
  const failCount = cases.filter((item) => item.status === "failed").length;
  const complete = cases.length === input.expectedCases && passCount === input.expectedCases && failCount === 0;
  const reproducibility = {
    seedPattern: "v11-alpha-<campaign>-<route>[-stable-suffix]",
    candidateAttemptLimit: input.candidateAttemptLimit,
    stableRouteSuffixes: input.stableRouteSuffixes
  };
  const evidenceBody = {
    reproducibility,
    suite: input.suite,
    command: input.command,
    expected: {
      campaigns: input.expectedCampaigns,
      routes: input.expectedRoutes,
      cases: input.expectedCases
    },
    summary: {
      status: complete ? "automated-pass" : "failed",
      campaigns: new Set(cases.map((item) => item.campaign)).size,
      routes: new Set(cases.map((item) => `${item.campaign}/${item.route}`)).size,
      cases: cases.length,
      passCount,
      failCount,
      totalDurationMs: cases.reduce((sum, item) => sum + Math.max(0, Number(item.durationMs) || 0), 0)
    },
    cases,
    candidateRejections: input.candidateRejections,
    failure: input.failure ? { status: "failed", safeSummary: normalizeText(input.failure) } : null
  };
  return {
    schema: V11_ALPHA_EVIDENCE_SCHEMA,
    generatedAt: input.generatedAt || new Date().toISOString(),
    ...evidenceBody,
    evidenceHash: sha256Json(evidenceBody)
  };
}

export function validateCampaignEvidenceManifest(evidence, expected = { campaigns: 12, routes: 24, cases: 72 }) {
  if (!evidence || typeof evidence !== "object") {
    return { status: "not-run", summary: "72-case evidence manifest has not been generated.", hashMatches: false };
  }
  const evidenceBody = {
    reproducibility: evidence.reproducibility,
    suite: evidence.suite,
    command: evidence.command,
    expected: evidence.expected,
    summary: evidence.summary,
    cases: evidence.cases,
    candidateRejections: evidence.candidateRejections,
    failure: evidence.failure
  };
  const cases = Array.isArray(evidence.cases) ? evidence.cases : [];
  const campaigns = new Set(cases.map((item) => item.campaign)).size;
  const routes = new Set(cases.map((item) => `${item.campaign}/${item.route}`)).size;
  const passCount = cases.filter((item) => item.status === "automated-pass").length;
  const safeCaseShape = cases.every((item) =>
    typeof item.campaign === "string"
    && typeof item.route === "string"
    && Number.isInteger(item.ordinal)
    && Number.isFinite(item.durationMs)
    && Number.isInteger(item.candidatePolls)
    && typeof item.safeSummary === "string"
    && !Object.hasOwn(item, "worldId")
    && !Object.hasOwn(item, "candidateId")
    && !Object.hasOwn(item, "truth")
  );
  const expectedMatches = evidence.expected?.campaigns === expected.campaigns
    && evidence.expected?.routes === expected.routes
    && evidence.expected?.cases === expected.cases;
  const summaryMatches = evidence.summary?.status === "automated-pass"
    && evidence.summary?.campaigns === campaigns
    && evidence.summary?.routes === routes
    && evidence.summary?.cases === cases.length
    && evidence.summary?.passCount === passCount
    && evidence.summary?.failCount === 0;
  const reproducible = evidence.reproducibility?.seedPattern === "v11-alpha-<campaign>-<route>[-stable-suffix]"
    && Number.isInteger(evidence.reproducibility?.candidateAttemptLimit)
    && evidence.reproducibility.candidateAttemptLimit > 0
    && evidence.reproducibility?.stableRouteSuffixes
    && typeof evidence.reproducibility.stableRouteSuffixes === "object";
  const rejectionIndex = evidence.candidateRejections;
  const rejectionIndexValid = Number.isInteger(rejectionIndex?.total)
    && Array.isArray(rejectionIndex?.categories)
    && rejectionIndex.categories.every((category) =>
      REJECTION_CATEGORY_ORDER.includes(category.category)
      && Number.isInteger(category.count)
      && Number.isInteger(category.reasonCount)
      && Array.isArray(category.reasons)
      && Array.isArray(category.examples)
      && category.examples.every((example) => typeof example.locator === "string" && typeof example.reason === "string")
    );
  const hashMatches = evidence.evidenceHash === sha256Json(evidenceBody);
  const passed = evidence.schema === V11_ALPHA_EVIDENCE_SCHEMA
    && expectedMatches
    && cases.length === expected.cases
    && campaigns === expected.campaigns
    && routes === expected.routes
    && passCount === expected.cases
    && safeCaseShape
    && summaryMatches
    && reproducible
    && rejectionIndexValid
    && hashMatches;
  return {
    status: passed ? "automated-pass" : "failed",
    summary: passed
      ? `${passCount}/${expected.cases} cases verified across ${routes} routes; evidence hash ${evidence.evidenceHash}.`
      : `72-case manifest validation failed; evidence hash ${hashMatches ? "verified" : "mismatch"}.`,
    hashMatches
  };
}

export function validateBrowserObservabilityEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") {
    return { status: "not-run", summary: "Browser observability evidence has not been generated.", hashMatches: false };
  }
  const evidenceBody = {
    status: evidence.status,
    summary: evidence.summary,
    checks: evidence.checks,
    matrix: evidence.matrix,
    goldSliceMatrix: evidence.goldSliceMatrix,
    failures: evidence.failures
  };
  const requiredChecks = ["network", "console", "overflow", "focus", "reducedMotion", "keyboard", "goldSlice"];
  const matrix = Array.isArray(evidence.matrix) ? evidence.matrix : [];
  const goldSliceMatrix = Array.isArray(evidence.goldSliceMatrix) ? evidence.goldSliceMatrix : [];
  const hashMatches = evidence.evidenceHash === sha256Json(evidenceBody);
  const passed = evidence.schema === V11_ALPHA_BROWSER_EVIDENCE_SCHEMA
    && evidence.status === "automated-pass"
    && evidence.summary?.entries === 12
    && evidence.summary?.passed === 12
    && evidence.summary?.failed === 0
    && matrix.length === 12
    && goldSliceMatrix.length === 6
    && matrix.every((entry) => entry.status === "automated-pass")
    && goldSliceMatrix.every((entry) => entry.status === "automated-pass")
    && requiredChecks.every((check) => evidence.checks?.[check]?.status === "automated-pass")
    && Array.isArray(evidence.failures)
    && evidence.failures.length === 0
    && hashMatches;
  return {
    status: passed ? "automated-pass" : "failed",
    summary: passed
      ? `12/12 browser matrix and 6/6 Gold Slice entries verified; evidence hash ${evidence.evidenceHash}.`
      : `Browser evidence validation failed; evidence hash ${hashMatches ? "verified" : "mismatch"}.`,
    hashMatches
  };
}

export function normalizeGateStatus(status) {
  return STATUS_ORDER.includes(status) ? status : "not-run";
}

export function validateGoldSliceVisibleCopyEvidence(evidence, sourceHash) {
  if (!evidence) return { status: "not-run", summary: "Observed Gold Slice copy regressions have not been run." };
  const { schema, generatedAt, evidenceHash, ...body } = evidence;
  const results = Array.isArray(evidence.results) ? evidence.results : [];
  const failed = results.filter((item) => item.status === "failed").length;
  const passed = results.filter((item) => item.status === "automated-pass").length;
  const valid = schema === "detective-town.gold-slice-visible-copy.v1"
    && evidence.suite === "gold-slice-visible-copy"
    && typeof generatedAt === "string"
    && Number.isFinite(Date.parse(generatedAt))
    && typeof sourceHash === "string" && evidence.sourceHash === sourceHash
    && evidenceHash === sha256Json(body)
    && results.length >= 33
    && new Set(results.map((item) => item.label)).size === results.length
    && passed + failed === results.length
    && evidence.checks === results.length && evidence.passed === passed && evidence.failed === failed
    && Array.isArray(evidence.failures) && evidence.failures.length === failed
    && evidence.ok === (failed === 0);
  return {
    status: valid && failed === 0 ? "automated-pass" : "failed",
    summary: valid
      ? `${passed}/${results.length} observed-copy regression checks passed; ${failed} failed. This is a source-level test, not a browser matrix or human review.`
      : "Visible-copy evidence is invalid or does not match the current localization source; rerun the targeted suite."
  };
}

export function buildAlphaReport(input) {
  const gates = (input.gates || []).map((gate) => ({ ...gate, status: normalizeGateStatus(gate.status) }));
  const statusCounts = Object.fromEntries(STATUS_ORDER.map((status) => [status, gates.filter((gate) => gate.status === status).length]));
  const alphaEntryGates = gates.filter((gate) => gate.phase === "alpha1");
  const alphaEntryStatus = alphaEntryGates.length === 0
    ? "not-run"
    : alphaEntryGates.some((gate) => gate.status === "failed")
      ? "failed"
      : alphaEntryGates.every((gate) => gate.status === "automated-pass")
        ? "automated-pass"
        : "not-run";
  const failed = statusCounts.failed > 0;
  const notRun = statusCounts["not-run"] > 0;
  const evidenceBody = {
    release: input.release,
    baseline: input.baseline,
    gates,
    statusCounts,
    alphaEntryStatus,
    automatedStatus: failed ? "failed" : notRun ? "incomplete" : "automated-pass",
    promotionStatus: failed || notRun || statusCounts["human-pending"] > 0 ? "held" : "eligible",
    protectedPublicHash: input.protectedPublicHash || { status: "not-run" },
    evidenceManifest: input.evidenceManifest || { status: "not-run" },
    candidateRejections: input.candidateRejections || { status: "not-run" },
    browserEvidence: input.browserEvidence || { status: "not-run" },
    goldSliceBehaviorEvidence: input.goldSliceBehaviorEvidence || { status: "not-run" },
    visibleCopyEvidence: input.visibleCopyEvidence || { status: "not-run" }
  };
  return {
    schema: V11_ALPHA_REPORT_SCHEMA,
    generatedAt: input.generatedAt || new Date().toISOString(),
    ...evidenceBody,
    reportHash: sha256Json(evidenceBody)
  };
}

export function alphaReportMarkdown(report) {
  const escapeCell = (value) => String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
  const rows = report.gates.map((gate) => `| ${escapeCell(gate.phase || "unscoped")} | ${escapeCell(gate.area)} | ${escapeCell(gate.check)} | ${gate.status} | ${escapeCell(gate.summary)} |`);
  const rejectionRows = (report.candidateRejections?.categories || []).map((category) => {
    const examples = (category.examples || []).map((example) => `${example.locator}: ${example.reason}`).join("<br>");
    return `| ${category.category} | ${category.count} | ${category.reasonCount} | ${escapeCell(examples || "none")} |`;
  });
  return [
    "# v11.1 Alpha Evidence Report",
    "",
    `- Alpha.1 entry status: **${report.alphaEntryStatus}**`,
    `- Automated status: **${report.automatedStatus}**`,
    `- Promotion status: **${report.promotionStatus}**`,
    `- Report hash: \`${report.reportHash}\``,
    "",
    "This report validates and aggregates saved evidence; generating it does not rerun tests or certify the current worktree. Source timestamps identify the recorded runs, not current-code freshness.",
    "",
    "## Evidence index",
    "",
    `- 72-case manifest: \`${report.evidenceManifest?.path || "not-run"}\` (JSON pointer \`/cases\`, hash \`${report.evidenceManifest?.evidenceHash || "not-run"}\`)`,
    `- Candidate rejections: \`${report.candidateRejections?.path || "not-run"}\` (JSON pointer \`${report.candidateRejections?.jsonPointer || "not-run"}\`)`,
    `- Browser observability: \`${report.browserEvidence?.path || "not-run"}\` (JSON pointer \`/checks\`)`,
    `- Gold Slice behavior: \`${report.goldSliceBehaviorEvidence?.path || "not-run"}\` (hash \`${report.goldSliceBehaviorEvidence?.evidenceHash || "not-run"}\`)`,
    `- Protected public tree: \`${report.protectedPublicHash?.treeHash || "not-run"}\``,
    `- Observed-copy regressions: \`${report.visibleCopyEvidence?.path || "not-run"}\` (${report.visibleCopyEvidence?.status || "not-run"})`,
    "",
    "## Candidate rejection index",
    "",
    "| Category | Observations | Distinct reasons | Representative locators |",
    "|---|---:|---:|---|",
    ...(rejectionRows.length ? rejectionRows : ["| not-run | 0 | 0 | none |"]),
    "",
    "## Gates",
    "",
    "| Phase | Area | Check | Status | Evidence |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    "Status vocabulary is fixed: `automated-pass`, `human-pending`, `not-run`, `failed`.",
    ""
  ].join("\n");
}
