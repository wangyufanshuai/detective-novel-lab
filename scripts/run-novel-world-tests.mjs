import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  createRequire
} from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = process.cwd();
const source = await fs.readFile(path.join(root, "packages", "engine", "src", "novel-world.ts"), "utf8");
const outDir = path.join(root, "outputs", "novel-world-test-runtime");
await fs.mkdir(outDir, { recursive: true });
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText;
const runtimeFile = path.join(outDir, "novel-world.cjs");
await fs.writeFile(runtimeFile, compiled, "utf8");
await fs.writeFile(path.join(outDir, "novel-world.js"), compiled, "utf8");
const simulationSource = await fs.readFile(path.join(root, "packages", "engine", "src", "novel-simulation.ts"), "utf8");
const simulationCompiled = ts.transpileModule(simulationSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText;
const simulationRuntimeFile = path.join(outDir, "novel-simulation.cjs");
await fs.writeFile(simulationRuntimeFile, simulationCompiled, "utf8");
const gameSource = await fs.readFile(path.join(root, "packages", "engine", "src", "novel-game.ts"), "utf8");
const gameCompiled = ts.transpileModule(gameSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText;
const gameRuntimeFile = path.join(outDir, "novel-game.cjs");
await fs.writeFile(gameRuntimeFile, gameCompiled, "utf8");
const {
  addNovelChapterAnalysis,
  attachFallbackEvidenceToGraph,
  applyNovelCorrectionOverlay,
  buildNovelAskQueryPlan,
  buildNovelCausalityReport,
  buildNovelQualityAuditReport,
  collectGraphEvidence,
  commitNovelImportDraftToProject,
  createNovelBatchQueue,
  canonicalNovelEntityId,
  createNovelCorrectionSet,
  createDefaultNovelThemeDefinitions,
  createFallbackEvidenceIndex,
  createFallbackNovelAskAnswer,
  createFallbackNovelChapterBlueprint,
  createFallbackNovelCausalityReport,
  createFallbackNovelThemeSignals,
  createNovelWorldProject,
  createFallbackNovelWorldGraph,
  createNovelLongChapterText,
  createNovelStateSimulation,
  createFallbackNovelCharacterStates,
  getNextNovelBatchChapterIds,
  mergeNovelCharacterArcs,
  mergeNovelThemeArcs,
  mergeNovelThemeDefinitions,
  mergeNovelWorldGraphs,
  normalizeNovelCharacterStatePoints,
  normalizePinnedNovelCausalChainIds,
  normalizePinnedNovelCharacterIds,
  normalizePinnedNovelThemeIds,
  normalizeNovelBatchQueue,
  normalizeNovelImportDraft,
  normalizeNovelChapterBlueprint,
  normalizeNovelCorrectionPatch,
  normalizeNovelThemeRegistry,
  normalizeNovelThemeSignals,
  normalizeNovelEntityIdentityRegistry,
  normalizeNovelWorldGraph,
  rankNovelCharacterArcs,
  rankNovelCausalChains,
  rankNovelThemeArcs,
  remapNovelThemeSignals,
  revertNovelCorrectionPatch,
  resolveNovelEntityIdentity,
  searchNovelAskEvidence,
  splitNovelChapterParagraphs,
  splitWholeNovelIntoChapterCandidates,
  updateNovelBatchChapterStatus,
  validateEvidenceAwareNovelWorldGraph,
  validateEvidenceSnippets,
  validateNovelAskAnswer,
  validateNovelCharacterStatePoints,
  validateNovelCorrectionSet,
  validateNovelImportDraft,
  validateNovelChapterBlueprint,
  validateNovelCausalityReport,
  validateNovelThemeSignals,
  validateNovelWorldProject,
  validateNovelWorldGraph
} = await import(pathToFileURL(runtimeFile).href);
const {
  advanceNovelSimulation,
  applyNovelSimulationIntervention,
  compareNovelSimulationBranch,
  compareNovelReplayToSource,
  compileNovelSimulationState,
  createFallbackNovelSimulationExplanation,
  createNovelSimulationRun,
  createNovelSimulationBranch,
  generateNovelActionCandidates,
  rewindNovelSimulation,
  scoreNovelActionCandidates,
  validateNovelSimulationExplanation,
  validateNovelSimulationRun
} = await import(pathToFileURL(simulationRuntimeFile).href);
const {
  createNovelGameVisualProfile,
  createNovelGameSceneState,
  validateNovelGameVisualProfile,
  validateNovelGameSceneState
} = await import(pathToFileURL(gameRuntimeFile).href);

const valid = createFallbackNovelWorldGraph();
assert.equal(validateNovelWorldGraph(valid).valid, true, "fallback graph should be valid");

const wholeBookText = [
  "第一章 Station",
  "Pavel waits near the station. Conflict begins and people gather around him.",
  "",
  "第十章 Winter",
  "Winter pressure changes Pavel's body and his obligations to the organization.",
  "",
  "一、 Factory",
  "Factory work reframes personal pride as collective duty.",
  "",
  "Chapter 4 Recovery",
  "Recovery turns private pain into a public test of discipline."
].join("\n");
const importDraft = splitWholeNovelIntoChapterCandidates({ title: "Steel Test", sourceNote: "local test", rawText: wholeBookText });
assert.equal(importDraft.candidates.length, 4, "whole-book splitter should recognize Chinese and English chapter headings");
assert.equal(validateNovelImportDraft(importDraft).valid, true, "chapter import draft should validate");

const fallbackDraft = splitWholeNovelIntoChapterCandidates({ title: "No Headings", rawText: "A".repeat(9000) });
assert.equal(fallbackDraft.candidates.length >= 2, true, "whole-book splitter should create length candidates without headings");
assert.ok(fallbackDraft.warnings.some((warning) => warning.includes("generated by length")), "fallback split should warn");

const editedDraft = normalizeNovelImportDraft({
  ...importDraft,
  candidates: importDraft.candidates.slice(0, 3).map((candidate, index) => ({
    ...candidate,
    order: index + 1,
    title: index === 0 ? "Edited Opening" : candidate.title
  }))
});
const committedImport = commitNovelImportDraftToProject(editedDraft, { genreTone: "test" });
assert.equal(committedImport.chapters.length, 3, "committed import should produce chapter text records");
assert.equal(validateNovelWorldProject(committedImport.project).valid, true, "committed import should produce a valid project");
assert.equal(committedImport.project.chapters[0].input.title, "Edited Opening", "edited candidate title should be committed");

let queue = createNovelBatchQueue(committedImport.project, 3);
assert.deepEqual(getNextNovelBatchChapterIds(committedImport.project, queue), committedImport.project.chapters.map((chapter) => chapter.input.id), "batch queue should select the first three queued chapters");
queue = updateNovelBatchChapterStatus(queue, committedImport.project.chapters[0].input.id, "ready");
assert.equal(getNextNovelBatchChapterIds(committedImport.project, queue).includes(committedImport.project.chapters[0].input.id), false, "ready chapters should not be selected again");
queue = updateNovelBatchChapterStatus(queue, committedImport.project.chapters[1].input.id, "error");
assert.equal(getNextNovelBatchChapterIds(committedImport.project, queue).includes(committedImport.project.chapters[1].input.id), true, "error chapters should be retryable");
const normalizedQueue = normalizeNovelBatchQueue(committedImport.project, { batchSize: 10, chapterStatuses: { [committedImport.project.chapters[2].input.id]: "skipped" } });
assert.equal(normalizedQueue.batchSize, 10, "batch queue should preserve supported batch sizes");
assert.equal(getNextNovelBatchChapterIds(committedImport.project, normalizedQueue).includes(committedImport.project.chapters[2].input.id), false, "skipped chapters should not run in the next batch");

const longChapter = createNovelLongChapterText({
  chapterId: "steel-c1",
  order: 1,
  title: "Test Chapter",
  rawText: "  保尔在车站旁停下。\n他听见远处传来争吵。\n\n朱赫来提醒他保持沉默。\n\n第三段很短。"
});
assert.equal(longChapter.paragraphs.length, 3, "paragraph splitter should handle Chinese line breaks and blank lines");
assert.equal(splitNovelChapterParagraphs("steel-c1", "第一段\n\n第二段")[1].id, "steel-c1-p-2", "paragraph ids should be stable");

const evidenceIndex = createFallbackEvidenceIndex(longChapter);
assert.equal(validateEvidenceSnippets(evidenceIndex.snippets, [longChapter]).valid, true, "fallback evidence snippets should validate");
assert.equal(evidenceIndex.snippets.every((snippet) => snippet.source.quote.length <= 120), true, "fallback evidence quotes should respect the quote limit");

const danglingEvidenceReport = validateEvidenceSnippets([
  {
    id: "bad-source",
    source: {
      chapterId: "missing-chapter",
      paragraphId: "missing-paragraph",
      quote: "missing",
      summary: "missing",
      confidence: 0.4
    },
    keywords: []
  }
], [longChapter]);
assert.equal(danglingEvidenceReport.valid, false, "dangling source refs should fail validation");
assert.ok(danglingEvidenceReport.errors.some((error) => error.includes("unknown paragraph")), "dangling paragraph should be reported");

const empty = normalizeNovelWorldGraph({});
const emptyReport = validateNovelWorldGraph(empty);
assert.equal(emptyReport.valid, false, "empty graph should be invalid");
assert.ok(emptyReport.errors.some((error) => error.includes("at least two entities")), "empty graph should require entities");

const duplicate = {
  ...valid,
  entities: [{ ...valid.entities[0] }, { ...valid.entities[0] }]
};
const duplicateReport = validateNovelWorldGraph(duplicate);
assert.equal(duplicateReport.valid, false, "duplicate entity ids should fail");
assert.ok(duplicateReport.errors.some((error) => error.includes("duplicate entity id")), "duplicate id error should be reported");

const danglingRelationship = {
  ...valid,
  relationships: [{ ...valid.relationships[0], fromEntityId: "missing-entity" }]
};
const danglingRelationshipReport = validateNovelWorldGraph(danglingRelationship);
assert.equal(danglingRelationshipReport.valid, false, "dangling relationship should fail");
assert.ok(danglingRelationshipReport.errors.some((error) => error.includes("unknown fromEntityId")), "dangling relationship error should be reported");

const danglingEvent = {
  ...valid,
  events: [{ ...valid.events[0], locationEntityId: "missing-location", participantEntityIds: ["missing-character"] }]
};
const danglingEventReport = validateNovelWorldGraph(danglingEvent);
assert.equal(danglingEventReport.valid, false, "dangling event references should fail");
assert.ok(danglingEventReport.errors.some((error) => error.includes("unknown locationEntityId")), "dangling event location should be reported");

const evidenceGraph = attachFallbackEvidenceToGraph(valid, longChapter);
const evidenceGraphReport = validateEvidenceAwareNovelWorldGraph(evidenceGraph, [longChapter]);
assert.equal(evidenceGraphReport.valid, true, "evidence-aware graph should validate with paragraph provenance");
assert.ok(collectGraphEvidence(evidenceGraph).length > 0, "graph evidence should be collectable");

const normalized = normalizeNovelWorldGraph({
  title: "测试世界",
  entities: [
    { kind: "character", name: "甲" },
    { kind: "location", name: "旧城" }
  ],
  events: [{ title: "入城", participantEntityIds: ["character-甲"] }]
});
assert.equal(normalized.entities.length, 2, "normalizer should preserve entities");
assert.equal(validateNovelWorldGraph(normalized).valid, true, "minimal normalized graph should pass");

const chapterOneGraph = normalizeNovelWorldGraph({
  id: "chapter-one",
  title: "Chapter One",
  genreTone: "test",
  premise: "first",
  observerBrief: "brief",
  entities: [
    { id: "char-lin", kind: "character", name: "Lin", role: "traveler", summary: "arrives", traits: ["careful"], x: 20, y: 40 },
    { id: "loc-city", kind: "location", name: "Old City", role: "city", summary: "sealed", traits: ["rain"], x: 50, y: 50 }
  ],
  relationships: [{ id: "rel-1", fromEntityId: "char-lin", toEntityId: "loc-city", label: "enters", polarity: "neutral", evidence: "arrival", strength: 40 }],
  events: [{ id: "ev-1", order: 1, timeLabel: "dawn", title: "Arrival", summary: "Lin arrives.", locationEntityId: "loc-city", participantEntityIds: ["char-lin"], causes: [], consequences: ["gate closes"], publicKnowledge: true }],
  development: [{ id: "dev-1", title: "Gate tension", trigger: "closed gate", likelyOutcome: "search begins", involvedEntityIds: ["char-lin"], tension: 40, unresolvedQuestion: "why closed?" }],
  warnings: []
});

const chapterTwoGraph = normalizeNovelWorldGraph({
  id: "chapter-two",
  title: "Chapter Two",
  genreTone: "test",
  premise: "second",
  observerBrief: "brief",
  entities: [
    { id: "char-lin-renamed", kind: "character", name: "Lin", role: "traveler", summary: "hides a jade slip", traits: ["secretive"], x: 30, y: 50 },
    { id: "concept-lin", kind: "concept", name: "Lin", role: "rumor", summary: "a circulating rumor", traits: ["public"] }
  ],
  relationships: [{ id: "rel-1", fromEntityId: "char-lin-renamed", toEntityId: "loc-city", label: "enters", polarity: "rival", evidence: "conflicting rumor", strength: 80 }],
  events: [{ id: "ev-1", order: 1, timeLabel: "noon", title: "Rumor spreads", summary: "The city hears about Lin.", locationEntityId: "loc-city", participantEntityIds: ["char-lin-renamed"], causes: ["arrival"], consequences: ["watchers gather"], publicKnowledge: true }],
  development: [{ id: "dev-2", title: "Rumor pressure", trigger: "rumor", likelyOutcome: "watchers gather", involvedEntityIds: ["char-lin-renamed"], tension: 70, unresolvedQuestion: "who started it?" }],
  warnings: []
});

const chapterAnalyses = [
  { input: { id: "c1", order: 1, title: "One", fragment: "one" }, status: "ready", graph: chapterOneGraph, validation: validateNovelWorldGraph(chapterOneGraph) },
  { input: { id: "c2", order: 2, title: "Two", fragment: "two" }, status: "ready", graph: chapterTwoGraph, validation: validateNovelWorldGraph(chapterTwoGraph) }
];
const merged = mergeNovelWorldGraphs(chapterAnalyses, { title: "Merged", genreTone: "test" });
assert.equal(merged.graph.entities.filter((entity) => entity.kind === "character" && entity.name === "Lin").length, 1, "same character name/kind should merge");
assert.equal(merged.graph.entities.some((entity) => entity.kind === "concept" && entity.name === "Lin"), true, "same name with different kind should remain distinct");
assert.equal(merged.graph.events.length, 2, "chapter events should append into unified timeline");
assert.equal(merged.graph.events.every((event) => event.sourceChapterId), true, "merged events should keep chapter provenance");
assert.equal(merged.report.conflicts.some((conflict) => conflict.kind === "relationship"), true, "relationship polarity conflicts should be reported");
assert.equal(merged.report.changedEntityIds.includes("char-lin"), true, "changed merged entity should be tracked");
assert.equal(merged.registry.decisions.some((decision) => decision.status === "auto-merged"), true, "exact identity matches should become durable auto-merge decisions");
assert.equal(canonicalNovelEntityId({ ...createNovelWorldProject({ title: "Identity" }), identityRegistry: merged.registry }, "char-lin-renamed", "c2"), "char-lin", "canonical identity lookup should remap chapter-local ids");
assert.equal(normalizeNovelEntityIdentityRegistry(merged.registry).version, 1, "identity registry should normalize to a compatible version");

const pendingIdentityGraph = normalizeNovelWorldGraph({
  id: "chapter-identity-pending",
  title: "Identity Pending",
  genreTone: "test",
  premise: "third",
  observerBrief: "brief",
  entities: [
    { id: "char-lin-gate", kind: "character", name: "Lin", role: "warden", summary: "waits", traits: [], x: 35, y: 50 }
  ],
  relationships: [],
  events: [],
  development: [],
  warnings: []
});
let identityProject = createNovelWorldProject({ title: "Identity Project", genreTone: "test" });
identityProject = addNovelChapterAnalysis(identityProject, chapterAnalyses[0]);
identityProject = addNovelChapterAnalysis(identityProject, { input: { id: "c-identity", order: 2, title: "Identity", fragment: "Lin waits." }, status: "ready", graph: pendingIdentityGraph, validation: validateNovelWorldGraph(pendingIdentityGraph) });
const pendingIdentity = identityProject.identityRegistry?.decisions.find((decision) => decision.sourceEntityId === "char-lin-gate");
assert.equal(pendingIdentity?.status, "pending", "same-name but conflicting roles should require review instead of auto-merging");
const rejectedIdentityProject = resolveNovelEntityIdentity(identityProject, pendingIdentity.id, "rejected");
assert.equal(rejectedIdentityProject.identityRegistry?.decisions.find((decision) => decision.id === pendingIdentity.id)?.status, "rejected", "identity rejection should persist");
assert.equal(rejectedIdentityProject.mergedGraph.entities.some((entity) => entity.id === "char-lin-gate"), true, "rejected identity candidate must remain separate");

let project = createNovelWorldProject({ title: "Project", genreTone: "test" });
project = addNovelChapterAnalysis(project, chapterAnalyses[0]);
project = addNovelChapterAnalysis(project, chapterAnalyses[1]);
const projectReport = validateNovelWorldProject(project);
assert.equal(projectReport.valid, true, "project should validate with analyzed chapters even when merge conflicts are warnings");
const roundTrip = JSON.parse(JSON.stringify(project));
assert.equal(validateNovelWorldProject(roundTrip).valid, true, "project should survive JSON export/import");

const arcChapterOne = createNovelLongChapterText({ chapterId: "c1", order: 1, title: "One", rawText: "Lin arrives.\n\nThe gate closes." });
const arcChapterTwo = createNovelLongChapterText({ chapterId: "c2", order: 2, title: "Two", rawText: "Rumor spreads.\n\nWatchers gather." });
const arcEvidenceOne = createFallbackEvidenceIndex(arcChapterOne).snippets[0];
const arcEvidenceTwo = createFallbackEvidenceIndex(arcChapterTwo).snippets[0];
const dimension = (summary, direction = "changed", intensity = 70) => ({ summary, direction, intensity });
const characterStatesOne = normalizeNovelCharacterStatePoints([{
  id: "state-c1-lin",
  characterEntityId: "char-lin",
  chapterId: "c1",
  chapterOrder: 1,
  summary: "Arrival turns caution into an immediate objective.",
  dimensions: {
    goal: dimension("Enter the city despite the closing gate."),
    belief: dimension("Caution is still useful.", "stable", 20),
    relationships: dimension("No stable alliance yet.", "unknown", 0),
    bodyCapability: dimension("Travel capability is intact.", "stable", 10),
    socialPosition: dimension("An outsider at the gate.", "down", 65)
  },
  evidence: [arcEvidenceOne],
  uncertainty: 0.2
}]);
const characterStatesTwo = normalizeNovelCharacterStatePoints([{
  id: "state-c2-lin",
  characterEntityId: "char-lin-renamed",
  chapterId: "c2",
  chapterOrder: 2,
  summary: "Public rumor changes Lin's social exposure.",
  dimensions: {
    goal: dimension("Protect the hidden jade slip."),
    belief: dimension("Official attention is dangerous.", "changed", 68),
    relationships: dimension("Watchers become an active pressure.", "down", 72),
    bodyCapability: dimension("No supported physical change.", "unknown", 0),
    socialPosition: dimension("Moves from outsider to watched suspect.", "down", 84)
  },
  evidence: [arcEvidenceTwo],
  uncertainty: 0.16
}]);
assert.equal(validateNovelCharacterStatePoints(characterStatesOne, chapterOneGraph, [arcChapterOne]).valid, true, "valid five-dimension state should pass");
const danglingCharacterState = normalizeNovelCharacterStatePoints([{ ...characterStatesOne[0], id: "bad-state", characterEntityId: "missing", chapterId: "missing" }]);
const danglingCharacterReport = validateNovelCharacterStatePoints(danglingCharacterState, chapterOneGraph, [arcChapterOne]);
assert.equal(danglingCharacterReport.valid, false, "dangling character and chapter refs should fail");
assert.ok(danglingCharacterReport.errors.some((error) => error.includes("unknown character")), "dangling character should be reported");
assert.ok(danglingCharacterReport.errors.some((error) => error.includes("unknown chapter")), "dangling chapter should be reported");

let arcProject = createNovelWorldProject({ title: "Arc Project", genreTone: "test" });
arcProject = addNovelChapterAnalysis(arcProject, { ...chapterAnalyses[0], characterStates: characterStatesOne });
arcProject = addNovelChapterAnalysis(arcProject, { ...chapterAnalyses[1], characterStates: characterStatesTwo });
const arcs = mergeNovelCharacterArcs(arcProject);
const linArc = arcs.find((arc) => arc.characterName === "Lin");
assert.equal(linArc?.points.length, 2, "renamed stable entity ids should aggregate into one character arc");
assert.deepEqual(linArc?.points.map((point) => point.chapterId), ["c1", "c2"], "arc points should be chapter ordered");
assert.ok((linArc?.turningPoints.length || 0) >= 1, "high-intensity dimension changes should create turning points");
assert.equal(rankNovelCharacterArcs(arcs)[0]?.characterName, "Lin", "main-character ranking should prioritize evidenced participation");
assert.equal(normalizePinnedNovelCharacterIds(["char-lin", "x", "char-lin", "concept-lin"], arcs).length, 1, "pinned characters should be valid, unique, and limited");

const gapProject = addNovelChapterAnalysis(arcProject, {
  input: { id: "c3", order: 3, title: "Three", fragment: "Lin waits." },
  status: "ready",
  graph: chapterOneGraph,
  validation: validateNovelWorldGraph(chapterOneGraph)
});
assert.ok(mergeNovelCharacterArcs(gapProject).find((arc) => arc.characterName === "Lin")?.evidenceGapChapterIds.includes("c3"), "missing state evidence should create an explicit gap");
assert.equal(mergeNovelCharacterArcs(project).every((arc) => arc.points.length === 0), true, "V5 projects without character states should still load");
assert.ok(createFallbackNovelCharacterStates(chapterOneGraph, arcChapterOne).every((point) => point.evidence.length > 0), "fallback character states should remain paragraph-grounded");

const defaultThemes = createDefaultNovelThemeDefinitions();
const pendingTheme = normalizeNovelThemeRegistry([
  ...defaultThemes,
  { id: "theme-city-pressure", name: "City pressure", category: "institutionOrganization", aliases: ["lockdown"], status: "pending" }
]).find((theme) => theme.id === "theme-city-pressure");
assert.equal(pendingTheme?.status, "pending", "custom theme candidate should keep pending status");
const themeSignalOne = normalizeNovelThemeSignals([{
  id: "theme-c1-will",
  themeId: "theme-personal-will",
  chapterId: "c1",
  chapterOrder: 1,
  direction: "intensify",
  intensity: 72,
  summary: "The closed gate turns private caution into direct pressure.",
  uncertainty: 0.18,
  relatedCharacterIds: ["char-lin"],
  relatedEventIds: ["ev-1"],
  relatedFactionIds: [],
  evidence: [arcEvidenceOne]
}]);
assert.equal(validateNovelThemeSignals(themeSignalOne, defaultThemes, chapterOneGraph, [arcChapterOne]).valid, true, "valid theme signal should pass");
const danglingThemeSignals = normalizeNovelThemeSignals([{
  ...themeSignalOne[0],
  id: "theme-bad",
  themeId: "missing-theme",
  chapterId: "missing-chapter",
  relatedCharacterIds: ["missing-character"],
  relatedEventIds: ["missing-event"],
  relatedFactionIds: ["missing-faction"],
  evidence: [{ ...arcEvidenceOne, source: { ...arcEvidenceOne.source, paragraphId: "missing-paragraph" } }]
}]);
const danglingThemeReport = validateNovelThemeSignals(danglingThemeSignals, defaultThemes, chapterOneGraph, [arcChapterOne]);
assert.equal(danglingThemeReport.valid, false, "dangling theme signal refs should fail");
assert.ok(danglingThemeReport.errors.some((error) => error.includes("unknown theme")), "dangling theme should be reported");
assert.ok(danglingThemeReport.errors.some((error) => error.includes("unknown paragraph")), "dangling paragraph should be reported");
assert.ok(danglingThemeReport.errors.some((error) => error.includes("unknown character")), "dangling character should be reported");

const themeSignalTwo = normalizeNovelThemeSignals([{
  id: "theme-c2-city",
  themeId: "theme-city-pressure",
  chapterId: "c2",
  chapterOrder: 2,
  direction: "contested",
  intensity: 81,
  summary: "The city pressure can be read as protection or coercion.",
  uncertainty: 0.22,
  relatedCharacterIds: ["char-lin-renamed"],
  relatedEventIds: ["ev-1"],
  relatedFactionIds: [],
  competingInterpretations: ["Protection of the city", "Coercion against an outsider"],
  evidence: [arcEvidenceTwo]
}]);
const mergedThemes = normalizeNovelThemeRegistry([...defaultThemes, pendingTheme]);
const themeSignalTwoReport = validateNovelThemeSignals(themeSignalTwo, mergedThemes, chapterTwoGraph, [arcChapterTwo]);
assert.equal(themeSignalTwoReport.valid, true, "pending custom theme signal should validate when theme exists");

let themeProject = createNovelWorldProject({ title: "Theme Project", genreTone: "test" });
themeProject.themeRegistry = mergedThemes;
themeProject = addNovelChapterAnalysis(themeProject, { ...chapterAnalyses[0], characterStates: characterStatesOne, themeSignals: themeSignalOne, themeCandidates: [] });
themeProject = addNovelChapterAnalysis(themeProject, { ...chapterAnalyses[1], characterStates: characterStatesTwo, themeSignals: themeSignalTwo, themeCandidates: [pendingTheme] });
const themeArcs = mergeNovelThemeArcs(themeProject);
assert.deepEqual(themeArcs.find((arc) => arc.themeId === "theme-personal-will")?.signals.map((signal) => signal.chapterId), ["c1"], "theme signals should stay chapter ordered");
assert.equal(themeArcs.find((arc) => arc.themeId === "theme-city-pressure")?.contestedSignalIds.length, 1, "contested theme signals should be retained");
assert.equal(rankNovelThemeArcs(themeArcs)[0].signals.length > 0, true, "theme ranking should prioritize evidenced arcs");
const themeGapProject = addNovelChapterAnalysis(themeProject, {
  input: { id: "c3", order: 3, title: "Three", fragment: "Lin waits." },
  status: "ready",
  graph: chapterOneGraph,
  validation: validateNovelWorldGraph(chapterOneGraph)
});
assert.ok(mergeNovelThemeArcs(themeGapProject).find((arc) => arc.themeId === "theme-personal-will")?.evidenceGapChapterIds.includes("c3"), "missing theme evidence should create explicit gaps");
assert.equal(normalizePinnedNovelThemeIds(["theme-personal-will", "x", "theme-personal-will", "theme-value-belief", "theme-relationship-emotion", "theme-institution-organization", "theme-material-survival"], themeArcs).length, 4, "pinned themes should be valid, unique, and limited to four");

const registryAfterThemeMerge = mergeNovelThemeDefinitions(mergedThemes, "theme-city-pressure", "theme-institution-organization");
assert.equal(registryAfterThemeMerge.some((theme) => theme.id === "theme-city-pressure"), false, "merged source theme should be removed from registry");
assert.ok(registryAfterThemeMerge.find((theme) => theme.id === "theme-institution-organization")?.aliases.includes("City pressure"), "merged theme name should become target alias");
const remappedThemeSignals = remapNovelThemeSignals(themeSignalTwo, "theme-city-pressure", "theme-institution-organization");
assert.equal(remappedThemeSignals[0].themeId, "theme-institution-organization", "theme merge should remap historical signals");
const hiddenRegistry = normalizeNovelThemeRegistry(mergedThemes.map((theme) => theme.id === "theme-city-pressure" ? { ...theme, status: "hidden" } : theme));
assert.equal(mergeNovelThemeArcs({ ...themeProject, themeRegistry: hiddenRegistry }).some((arc) => arc.themeId === "theme-city-pressure"), false, "hidden themes should not render arcs");
assert.equal(validateNovelWorldProject(project).valid, true, "V5/V6 project without theme fields should still load");
const fallbackThemeSignals = createFallbackNovelThemeSignals(chapterOneGraph, characterStatesOne, arcChapterOne, undefined, defaultThemes);
assert.ok(fallbackThemeSignals.length > 0, "fallback theme extraction should produce conservative signals");
assert.equal(validateNovelThemeSignals(fallbackThemeSignals, defaultThemes, chapterOneGraph, [arcChapterOne]).valid, true, "fallback theme signals should be paragraph-grounded");

const causalityReport = buildNovelCausalityReport(themeProject);
assert.equal(causalityReport.claims.length > 0, true, "causality report should derive claims from events, theme signals, and character states");
assert.equal(validateNovelCausalityReport(causalityReport, themeProject, [arcChapterOne, arcChapterTwo]).valid, true, "causality report should validate with paragraph evidence");
assert.equal(causalityReport.claims.some((claim) => claim.contestedInterpretations.length > 0), true, "contested theme signals should keep competing causal explanations");
assert.deepEqual(
  rankNovelCausalChains(causalityReport.chains)[0].chapterIds,
  rankNovelCausalChains(causalityReport.chains)[0].chapterIds.slice().sort((a, b) => (a === "c1" ? 1 : 2) - (b === "c1" ? 1 : 2)),
  "causal chain chapters should stay ordered"
);
assert.equal(normalizePinnedNovelCausalChainIds([...causalityReport.chains.map((chain) => chain.id), "missing", causalityReport.chains[0]?.id].filter(Boolean), causalityReport.chains).length <= 3, true, "pinned causal chains should be valid, unique, and limited");

const danglingCausalityReport = {
  ...causalityReport,
  claims: [{ ...causalityReport.claims[0], id: "bad-causal-claim", effect: { ...causalityReport.claims[0].effect, id: "missing-state" } }]
};
const danglingCausalityValidation = validateNovelCausalityReport(danglingCausalityReport, themeProject, [arcChapterOne, arcChapterTwo]);
assert.equal(danglingCausalityValidation.valid, false, "dangling causal refs should fail validation");
assert.ok(danglingCausalityValidation.errors.some((error) => error.includes("unknown effect")), "dangling causal effect should be reported");

let noEvidenceCausalProject = createNovelWorldProject({ title: "No Evidence Causal", genreTone: "test" });
const noEvidenceThemeSignal = normalizeNovelThemeSignals([{ ...themeSignalOne[0], id: "theme-no-evidence", evidence: [] }]);
const noEvidenceState = normalizeNovelCharacterStatePoints([{ ...characterStatesOne[0], id: "state-no-evidence", evidence: [] }]);
noEvidenceCausalProject = addNovelChapterAnalysis(noEvidenceCausalProject, { ...chapterAnalyses[0], input: { id: "c1", order: 1, title: "One", fragment: "one" }, themeSignals: noEvidenceThemeSignal, characterStates: noEvidenceState });
const noEvidenceCausalityReport = buildNovelCausalityReport(noEvidenceCausalProject);
assert.equal(noEvidenceCausalityReport.claims.length, 0, "missing evidence should not create fake causal claims");
assert.equal(noEvidenceCausalityReport.gaps.length > 0, true, "missing evidence should create causal gaps");
assert.equal(createFallbackNovelCausalityReport(project).chains.length >= 0, true, "V5/V6/V7 projects without causality fields should still load");

const askPlan = buildNovelAskQueryPlan(themeProject, "Why is Lin watched by the city pressure?", "c2");
assert.equal(askPlan.kind, "causality", "ask query plan should detect causal questions");
assert.equal(askPlan.entityIds.includes("char-lin"), true, "ask query plan should match character names");
assert.equal(askPlan.themeIds.includes("theme-city-pressure"), true, "ask query plan should match theme names and aliases");

const askSearch = searchNovelAskEvidence(themeProject, [arcChapterOne, arcChapterTwo], askPlan, "c2");
assert.equal(askSearch.evidenceHits.length > 0, true, "ask evidence search should return ranked hits from graph evidence");
assert.equal(askSearch.evidenceHits.some((hit) => ["character-state", "theme-signal", "causal-claim", "paragraph"].includes(hit.sourceType)), true, "ask search should cover structured sources");

const askAnswer = createFallbackNovelAskAnswer(themeProject, askPlan.question, askSearch.evidenceHits, askPlan);
const askValidation = validateNovelAskAnswer(askAnswer, askSearch.evidenceHits, [arcChapterOne, arcChapterTwo]);
assert.equal(askValidation.valid, true, "fallback ask answer should validate with cited evidence hits");

const danglingAskHit = { ...askSearch.evidenceHits[0], id: "ask-dangling", paragraphId: "missing-paragraph" };
assert.equal(validateNovelAskAnswer({ ...askAnswer, evidenceHitIds: ["ask-dangling"] }, [danglingAskHit], [arcChapterOne, arcChapterTwo]).valid, false, "dangling ask paragraph refs should fail validation");

const longQuoteAskHit = { ...askSearch.evidenceHits[0], id: "ask-long-quote", quote: "x".repeat(121) };
assert.equal(validateNovelAskAnswer({ ...askAnswer, evidenceHitIds: ["ask-long-quote"] }, [longQuoteAskHit], [arcChapterOne, arcChapterTwo]).valid, false, "ask evidence quotes over 120 chars should fail validation");

const unsupportedAskPlan = buildNovelAskQueryPlan(themeProject, "What happens after the final chapter and what was the author's real intention?");
const unsupportedAnswer = createFallbackNovelAskAnswer(themeProject, unsupportedAskPlan.question, [], unsupportedAskPlan);
assert.equal(unsupportedAskPlan.kind, "unsupported", "future and author-intent questions should be unsupported");
assert.equal(unsupportedAnswer.status, "refused", "unsupported ask questions should be refused");

const insufficientAskAnswer = createFallbackNovelAskAnswer(themeProject, "Where is the hidden spaceship evidence?", [], buildNovelAskQueryPlan(themeProject, "Where is the hidden spaceship evidence?"));
assert.equal(insufficientAskAnswer.status, "insufficient-evidence", "ask fallback should not invent answers without evidence");

const emptyCorrectionSet = createNovelCorrectionSet(themeProject);
assert.equal(JSON.stringify(applyNovelCorrectionOverlay(themeProject, emptyCorrectionSet)), JSON.stringify(themeProject), "empty correction set should not change a project view");
assert.equal(validateNovelCorrectionSet(emptyCorrectionSet, themeProject, [arcChapterOne, arcChapterTwo]).valid, true, "empty correction set should validate");

const renamePatch = normalizeNovelCorrectionPatch({
  id: "rename-lin",
  target: { kind: "entity", id: "char-lin" },
  operation: { type: "rename-entity", name: "Lin Corrected" },
  status: "applied",
  reason: "manual rename"
});
const kindPatch = normalizeNovelCorrectionPatch({
  id: "kind-concept",
  target: { kind: "entity", id: "concept-lin" },
  operation: { type: "change-entity-kind", kind: "item" },
  status: "applied",
  reason: "manual kind correction"
});
const editPatch = normalizeNovelCorrectionPatch({
  id: "edit-lin",
  target: { kind: "entity", id: "char-lin" },
  operation: { type: "edit-entity-fields", role: "audited protagonist", summary: "Corrected summary", traits: ["audited"] },
  status: "applied",
  reason: "manual field correction"
});
const mergePatch = normalizeNovelCorrectionPatch({
  id: "merge-concept-into-lin",
  target: { kind: "entity", id: "concept-lin" },
  operation: { type: "merge-entities", sourceEntityId: "concept-lin", targetEntityId: "char-lin" },
  status: "applied",
  reason: "manual duplicate merge"
});
const hideThemePatch = normalizeNovelCorrectionPatch({
  id: "hide-theme",
  target: { kind: "theme-signal", id: "theme-c1-will" },
  operation: { type: "hide-object", reason: "rejected theme signal" },
  status: "applied",
  reason: "manual hide"
});
const replaceEvidencePatch = normalizeNovelCorrectionPatch({
  id: "replace-lin-evidence",
  target: { kind: "entity", id: "char-lin" },
  operation: { type: "replace-evidence", evidence: [arcEvidenceTwo] },
  status: "applied",
  reason: "manual evidence replacement"
});
const correctionSet = {
  ...emptyCorrectionSet,
  patches: [renamePatch, kindPatch, editPatch, mergePatch, hideThemePatch, replaceEvidencePatch],
  updatedAt: new Date().toISOString()
};
assert.equal(validateNovelCorrectionSet(correctionSet, themeProject, [arcChapterOne, arcChapterTwo]).valid, true, "valid correction overlay should validate");
const correctedThemeProject = applyNovelCorrectionOverlay(themeProject, correctionSet);
const correctedLin = correctedThemeProject.mergedGraph.entities.find((entity) => entity.id === "char-lin");
assert.equal(correctedLin.name, "Lin Corrected", "rename correction should affect corrected view");
assert.equal(correctedLin.role, "audited protagonist", "edit correction should affect entity role");
assert.deepEqual(correctedLin.traits, ["audited", "public"], "merge and edit corrections should create a stable corrected trait view");
assert.equal(correctedLin.evidence[0].source.chapterId, "c2", "replace evidence should affect corrected view");
assert.equal(correctedThemeProject.mergedGraph.entities.some((entity) => entity.id === "concept-lin"), false, "merge correction should hide source duplicate entity");
assert.equal(correctedThemeProject.chapters.flatMap((chapter) => chapter.themeSignals || []).some((signal) => signal.id === "theme-c1-will"), false, "hide correction should remove rejected theme signal from corrected view");
assert.equal(correctedThemeProject.mergedGraph.events.some((event) => event.participantEntityIds.includes("concept-lin")), false, "merge correction should remap event participants");
assert.equal(correctedThemeProject.chapters.flatMap((chapter) => chapter.themeSignals || []).some((signal) => signal.relatedCharacterIds.includes("concept-lin") || signal.relatedFactionIds.includes("concept-lin")), false, "merge correction should remap theme references");

const badEvidencePatch = normalizeNovelCorrectionPatch({
  id: "bad-replace-evidence",
  target: { kind: "entity", id: "char-lin" },
  operation: { type: "replace-evidence", evidence: [{ ...arcEvidenceOne, source: { ...arcEvidenceOne.source, paragraphId: "missing-paragraph" } }] },
  status: "applied",
  reason: "bad evidence"
});
assert.equal(validateNovelCorrectionSet({ ...emptyCorrectionSet, patches: [badEvidencePatch] }, themeProject, [arcChapterOne, arcChapterTwo]).valid, false, "replace evidence should reject dangling paragraph refs");
const revertedCorrectionSet = revertNovelCorrectionPatch(correctionSet, "rename-lin");
assert.equal(applyNovelCorrectionOverlay(themeProject, revertedCorrectionSet).mergedGraph.entities.find((entity) => entity.id === "char-lin").name, "Lin", "reverted patch should restore overlay-before view for that operation");

const auditGraph = {
  ...themeProject.mergedGraph,
  entities: [
    ...themeProject.mergedGraph.entities,
    { ...themeProject.mergedGraph.entities.find((entity) => entity.id === "char-lin"), id: "char-lin-duplicate", evidence: [] }
  ],
  relationships: [
    ...themeProject.mergedGraph.relationships,
    { ...themeProject.mergedGraph.relationships[0], id: "rel-dangling", fromEntityId: "missing-entity" }
  ],
  events: [
    ...themeProject.mergedGraph.events,
    { ...themeProject.mergedGraph.events[0], id: "ev-dangling", participantEntityIds: ["missing-entity"], evidence: [] }
  ]
};
const auditProject = {
  ...themeProject,
  chapters: themeProject.chapters.map((chapter, index) => index === 0
    ? {
        ...chapter,
        characterStates: (chapter.characterStates || []).map((state, stateIndex) => stateIndex === 0 ? { ...state, uncertainty: 0.62 } : state)
      }
    : chapter),
  mergedGraph: auditGraph,
  mergeReport: {
    ...themeProject.mergeReport,
    conflicts: [
      ...themeProject.mergeReport.conflicts,
      { id: "conflict-audit", kind: "relationship", targetId: "rel-dangling", message: "audit conflict", chapterIds: ["c1", "c2"] }
    ]
  }
};
const auditReport = buildNovelQualityAuditReport(auditProject, emptyCorrectionSet, [arcChapterOne, arcChapterTwo]);
assert.equal(auditReport.metrics.length, 5, "quality audit should expose five weighted metrics");
assert.equal(auditReport.issues.some((issue) => issue.id.startsWith("dangling-relationship")), true, "quality audit should detect dangling relationship refs");
assert.equal(auditReport.issues.some((issue) => issue.id.startsWith("duplicate-entity")), true, "quality audit should detect duplicate candidates");
assert.equal(auditReport.issues.some((issue) => issue.id.startsWith("merge-conflict")), true, "quality audit should surface unresolved merge conflicts");
assert.equal(auditReport.issues.some((issue) => issue.id.startsWith("missing-evidence")), true, "quality audit should detect low evidence objects");
assert.equal(auditReport.issues.some((issue) => issue.id.startsWith("low-confidence")), true, "quality audit should detect high uncertainty items");
assert.equal(auditReport.score < 100, true, "blocking and high issues should lower trust score");
assert.equal(auditReport.suggestedPatches.length > 0, true, "quality audit should generate suggested local patches");

const simulationGraphOne = attachFallbackEvidenceToGraph(chapterOneGraph, arcChapterOne);
const simulationGraphTwo = attachFallbackEvidenceToGraph(chapterTwoGraph, arcChapterTwo);
let simulationProject = createNovelWorldProject({ title: "Replay Project", genreTone: "test" });
simulationProject = addNovelChapterAnalysis(simulationProject, { ...chapterAnalyses[0], graph: simulationGraphOne, characterStates: characterStatesOne, themeSignals: themeSignalOne });
simulationProject = addNovelChapterAnalysis(simulationProject, { ...chapterAnalyses[1], graph: simulationGraphTwo, characterStates: characterStatesTwo, themeSignals: themeSignalTwo });
const initialSimulationState = compileNovelSimulationState(simulationProject, "c2");
assert.equal(initialSimulationState.actorStates.length > 0, true, "simulation should compile character actor states");
assert.equal(initialSimulationState.knowledgeFacts.length > 0, true, "simulation should compile paragraph-grounded knowledge facts");
assert.equal(initialSimulationState.actorStates.every((actor) => actor.knowledgeFactIds.length === 0), true, "initial snapshot must not pre-grant future event knowledge");
assert.equal(initialSimulationState.actorStates.every((actor) => actor.resources.length === 0), true, "actors must not receive every in-scope item without ownership evidence");

const replayA = createNovelSimulationRun(simulationProject, { seed: "fixed-replay", throughChapterId: "c2" });
const replayB = createNovelSimulationRun(simulationProject, { seed: "fixed-replay", throughChapterId: "c2" });
const replayAStepOne = advanceNovelSimulation(simulationProject, replayA);
const replayBStepOne = advanceNovelSimulation(simulationProject, replayB);
assert.deepEqual(
  replayAStepOne.steps.map((step) => ({ selectedCandidateId: step.selectedCandidateId, provenance: step.provenance, title: step.title })),
  replayBStepOne.steps.map((step) => ({ selectedCandidateId: step.selectedCandidateId, provenance: step.provenance, title: step.title })),
  "same seed and source state should produce identical replay steps"
);
assert.equal(replayAStepOne.steps[0].provenance, "source", "grounded replay should match an evidenced source checkpoint");
assert.equal(validateNovelSimulationRun(replayAStepOne, simulationProject, [arcChapterOne, arcChapterTwo]).valid, true, "grounded replay should validate");

const firstCheckpoint = simulationProject.mergedGraph.events.find((event) => event.id === replayA.checkpointEventIds[0]);
const candidates = generateNovelActionCandidates(simulationProject, initialSimulationState, firstCheckpoint, "fixed-replay");
assert.equal(candidates.some((candidate) => candidate.sourceEventId === firstCheckpoint.id && candidate.legal), true, "evidenced source action should be legal");
const exhaustedSnapshot = {
  ...initialSimulationState,
  actorStates: initialSimulationState.actorStates.map((actor) => ({ ...actor, bodyCapability: 0, knowledgeFactIds: [] }))
};
const blockedCandidates = generateNovelActionCandidates(simulationProject, exhaustedSnapshot, firstCheckpoint, "fixed-replay");
assert.equal(blockedCandidates.find((candidate) => candidate.sourceEventId === firstCheckpoint.id)?.legal, false, "missing knowledge and body capability should block source action");
assert.equal(scoreNovelActionCandidates(candidates, initialSimulationState, "fixed-replay")[0].score >= candidates[candidates.length - 1].score, true, "candidate scoring should order actions by rule score");

const rewoundReplay = rewindNovelSimulation(simulationProject, replayAStepOne);
assert.equal(rewoundReplay.steps.length, 0, "rewind should remove exactly one completed step");
assert.deepEqual(rewoundReplay.currentSnapshot, rewoundReplay.initialSnapshot, "rewind to zero should restore the initial snapshot");

const branchBase = advanceNovelSimulation(simulationProject, createNovelSimulationRun(simulationProject, { seed: "fixed-branch", mode: "grounded-replay", throughChapterId: "c2", branchStepLimit: 1 }));
const branchActor = branchBase.currentSnapshot.actorStates[0];
const intervenedRun = createNovelSimulationBranch(simulationProject, branchBase, {
  stepIndex: branchBase.currentStepIndex,
  seed: "fixed-branch-derived",
  intervention: {
    kind: "body-capability",
  actorEntityId: branchActor.actorEntityId,
    value: 0
  }
});
const branchStep = advanceNovelSimulation(simulationProject, intervenedRun);
assert.equal(branchStep.mode, "short-branch", "intervention should convert replay into a short branch");
assert.equal(branchStep.interventions.length, 1, "short branch should store one intervention");
assert.equal(branchStep.parentRunId, branchBase.id, "branch should retain the baseline run id");
assert.equal(branchBase.steps.length, 1, "creating a branch must not mutate its baseline");
assert.equal(branchStep.steps.at(-1)?.provenance, "counterfactual", "relevant body intervention should select a counterfactual action");
assert.equal(branchStep.status, "complete", "one-scene short branch should stop at its configured boundary");
assert.equal(branchStep.steps.at(-1)?.sourceEventId, undefined, "counterfactual step must not be stored as a source event");
assert.equal(validateNovelSimulationRun(branchStep, simulationProject, [arcChapterOne, arcChapterTwo]).valid, true, "short branch should validate without mutating source graph");
const branchComparison = compareNovelSimulationBranch(branchBase, branchStep);
assert.equal(branchComparison.materialDivergence, true, "relevant branch must report a material state divergence");
const noOpBranch = createNovelSimulationBranch(simulationProject, branchBase, { stepIndex: branchBase.currentStepIndex, seed: "fixed-branch-noop", intervention: { kind: "knowledge", actorEntityId: branchActor.actorEntityId, value: true } });
const noOpStep = advanceNovelSimulation(simulationProject, noOpBranch);
assert.equal(noOpStep.steps.at(-1)?.provenance, "source", "irrelevant intervention may retain the source action instead of forcing divergence");

const comparison = compareNovelReplayToSource(simulationProject, replayAStepOne);
assert.equal(comparison.completedCheckpointCount, 1, "comparison should count completed source checkpoints");
assert.equal(comparison.eventMatchRate > 0, true, "comparison should calculate event match rate");
assert.equal(comparison.participantMatchRate > 0, true, "comparison should calculate participant agreement");

const explanation = createFallbackNovelSimulationExplanation(replayAStepOne.steps[0]);
assert.equal(validateNovelSimulationExplanation(explanation, replayAStepOne.steps[0]).valid, true, "fallback simulation explanation should cite step evidence");
assert.equal(validateNovelSimulationExplanation({ ...explanation, evidenceIds: ["missing-evidence"] }, replayAStepOne.steps[0]).valid, false, "simulation explanation should reject dangling evidence refs");

const gameSceneOne = createNovelGameSceneState(replayAStepOne, simulationProject.mergedGraph);
const gameSceneTwo = createNovelGameSceneState(replayAStepOne, simulationProject.mergedGraph);
assert.deepEqual(gameSceneOne.locations.map((location) => [location.id, location.x, location.y]), gameSceneTwo.locations.map((location) => [location.id, location.x, location.y]), "game scene layout should be stable for the same run and graph");
assert.equal(validateNovelGameSceneState(gameSceneOne).valid, true, "valid game scene should pass validation");
assert.equal(gameSceneOne.events.some((event) => event.provenance === "source"), true, "source replay steps should become source event markers");
assert.equal(createNovelGameSceneState(branchStep, simulationProject.mergedGraph).events.some((event) => event.provenance === "counterfactual"), true, "short branch steps should become counterfactual event markers");
const visualProfileOne = createNovelGameVisualProfile(gameSceneOne, simulationProject.mergedGraph, { labels: "all", evidenceHeat: true, motionTrails: true, pixelScale: 2 });
const visualProfileTwo = createNovelGameVisualProfile(gameSceneTwo, simulationProject.mergedGraph, { labels: "all", evidenceHeat: true, motionTrails: true, pixelScale: 2 });
assert.deepEqual(visualProfileOne, visualProfileTwo, "same scene and graph should produce the same visual profile");
assert.equal(validateNovelGameVisualProfile(visualProfileOne, gameSceneOne).valid, true, "valid visual profile should pass validation");
const multiActorGameScene = {
  ...gameSceneOne,
  actors: [
    ...gameSceneOne.actors,
    { ...gameSceneOne.actors[0], id: "char-visual-second", label: "Second Actor", relationshipPressure: 91 }
  ]
};
const multiActorVisualProfile = createNovelGameVisualProfile(multiActorGameScene, simulationProject.mergedGraph);
assert.equal(new Set(multiActorVisualProfile.sprites.map((sprite) => sprite.palette.primary)).size > 1, true, "different actors should receive distinguishable palettes");
assert.equal(visualProfileOne.effects.some((effect) => effect.kind === "source-pulse"), true, "source steps should produce source pulse effects");
const branchVisualProfile = createNovelGameVisualProfile(createNovelGameSceneState(branchStep, simulationProject.mergedGraph), simulationProject.mergedGraph);
assert.equal(branchVisualProfile.effects.some((effect) => effect.kind === "branch-glitch"), true, "counterfactual steps should produce branch glitch effects");
const normalizedPreferenceProfile = createNovelGameVisualProfile(gameSceneOne, simulationProject.mergedGraph, { labels: "bad", evidenceHeat: "yes", motionTrails: "no", pixelScale: 9 });
assert.deepEqual(normalizedPreferenceProfile.preferences, { labels: "all", evidenceHeat: true, motionTrails: true, pixelScale: 1 }, "visual preferences should normalize malformed values");

const noLocationGameScene = createNovelGameSceneState(replayAStepOne, { ...simulationProject.mergedGraph, entities: simulationProject.mergedGraph.entities.filter((entity) => entity.kind !== "location") });
assert.equal(noLocationGameScene.locations[0].kind, "fallback", "game scene should create a fallback staging area when no locations exist");
assert.equal(validateNovelGameSceneState(noLocationGameScene).valid, true, "fallback game scene should validate");
assert.equal(validateNovelGameVisualProfile(createNovelGameVisualProfile(noLocationGameScene, simulationProject.mergedGraph), noLocationGameScene).valid, true, "fallback game visual profile should validate");

const danglingLocationScene = createNovelGameSceneState({
  ...replayAStepOne,
  currentSnapshot: {
    ...replayAStepOne.currentSnapshot,
    actorStates: replayAStepOne.currentSnapshot.actorStates.map((actor, index) => index === 0 ? { ...actor, locationEntityId: "missing-location" } : actor)
  }
}, simulationProject.mergedGraph);
assert.equal(danglingLocationScene.warnings.some((warning) => warning.includes("unknown location")), true, "dangling actor locations should become warnings instead of crashes");

let gapSimulationProject = createNovelWorldProject({ title: "Replay Gap", genreTone: "test" });
gapSimulationProject = addNovelChapterAnalysis(gapSimulationProject, chapterAnalyses[0]);
const gapRun = advanceNovelSimulation(gapSimulationProject, createNovelSimulationRun(gapSimulationProject, { seed: "gap" }));
assert.equal(gapRun.status, "blocked", "replay should stop when source events have no paragraph evidence");
assert.equal(gapRun.steps[0]?.provenance, "gap", "missing evidence should produce a gap step instead of a fabricated event");
const gapGameScene = createNovelGameSceneState(gapRun, gapSimulationProject.mergedGraph);
assert.equal(gapGameScene.events.some((event) => event.provenance === "gap"), true, "gap simulation steps should become gap event markers");
assert.equal(createNovelGameVisualProfile(gapGameScene, gapSimulationProject.mergedGraph).effects.some((effect) => effect.kind === "evidence-gap"), true, "gap steps should produce evidence gap effects");

const simulated = createNovelStateSimulation(project, [
  createNovelLongChapterText({ chapterId: "c1", order: 1, title: "One", rawText: "Lin arrives.\n\nThe gate closes." }),
  createNovelLongChapterText({ chapterId: "c2", order: 2, title: "Two", rawText: "Rumor spreads.\n\nWatchers gather." })
], "c2");
assert.equal(simulated.throughChapterId, "c2", "state simulation should report the analyzed chapter boundary");
assert.ok(simulated.summary.includes("does not project beyond"), "state simulation should state that it does not continue the story");
assert.ok(simulated.items.length > 0, "state simulation should produce book-internal state items");

const validBlueprint = createFallbackNovelChapterBlueprint(project, "c2", {
  wordCountRange: "3000-4500 words",
  narrativePerspective: "dual close third",
  pacing: "high-tension",
  emphasizePayoffs: true
});
assert.equal(validateNovelChapterBlueprint(validBlueprint, project).valid, true, "fallback blueprint should validate against analyzed project");
assert.equal(validBlueprint.sceneBeats.length >= 3, true, "fallback blueprint should include scene beats");

const missingBeats = normalizeNovelChapterBlueprint({ targetChapterTitle: "Next", chapterGoal: "Goal", sceneBeats: [] });
const missingBeatsReport = validateNovelChapterBlueprint(missingBeats, project);
assert.equal(missingBeatsReport.valid, false, "blueprint without scene beats should fail");
assert.ok(missingBeatsReport.errors.some((error) => error.includes("scene beat")), "missing scene beat error should be reported");

const danglingBlueprint = normalizeNovelChapterBlueprint({
  targetChapterTitle: "Next",
  chapterGoal: "Goal",
  sceneBeats: [{ id: "beat-x", title: "Bad ref", involvedEntityIds: ["missing-entity"], sourceEventIds: ["missing-event"] }]
});
const danglingBlueprintReport = validateNovelChapterBlueprint(danglingBlueprint, project);
assert.equal(danglingBlueprintReport.valid, false, "dangling blueprint refs should fail");
assert.ok(danglingBlueprintReport.errors.some((error) => error.includes("unknown involvedEntityId")), "dangling entity ref should be reported");
assert.ok(danglingBlueprintReport.errors.some((error) => error.includes("unknown sourceEventId")), "dangling event ref should be reported");

const emptyProject = createNovelWorldProject({ title: "Empty", genreTone: "test" });
const emptyBlueprint = createFallbackNovelChapterBlueprint(emptyProject, undefined, {});
assert.equal(validateNovelChapterBlueprint(emptyBlueprint, emptyProject).valid, true, "fallback blueprint should work with empty project");

const malformedBlueprint = normalizeNovelChapterBlueprint({
  sceneBeats: [{ title: "Only title", tension: 400 }],
  writingRisks: [{ message: "Risk", severity: "impossible" }]
});
assert.equal(malformedBlueprint.sceneBeats[0].tension, 100, "normalizer should clamp beat tension");
assert.equal(malformedBlueprint.writingRisks[0].severity, "medium", "normalizer should repair invalid risk severity");

console.log("Novel world graph tests passed.");
