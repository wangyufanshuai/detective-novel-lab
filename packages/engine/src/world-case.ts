import { judgeTheory } from "./judgement";
import { buildCaseQualityReport } from "./world-analysis";
import type { Character, DeductionCase, Evidence, PlayerTheory } from "./types";
import { deriveSuspectMatrix, evaluateEvidenceChallenge, validateCase } from "./validators";
import type {
  CaseFromLog,
  CaseGenerationProfile,
  InterrogationLogEntry,
  MurderArchetype,
  NPCProfile,
  TestimonyRecord,
  WorldCaseSourceMap,
  WorldCaseValidation,
  WorldEvent,
  WorldState
} from "./world-types";

const archetypeLabels: Record<MurderArchetype, string> = {
  blade: "刀具伪装",
  poison: "药物投毒",
  blunt: "钝器误导",
  fall: "坠落机关"
};

const keyEvidenceTitles: Record<string, string> = {
  "ev-means": "手段准备记录",
  "ev-motive": "秘密暴露冲突记录",
  "ev-opportunity": "案发窗口目击记录",
  "ev-staging": "现场伪装痕迹",
  "ev-trace": "现场微量痕迹",
  "ev-death-scene": "死亡现场记录",
  "ev-town-rollcall": "雾灯广场巡夜登记"
};

function locationName(world: WorldState, id: string) {
  return world.locations.find((location) => location.id === id)?.name || id;
}

function npcName(world: WorldState, id: string) {
  return world.npcs.find((npc) => npc.id === id)?.name || id;
}

function eventByEvidence(events: WorldEvent[], evidenceId: string) {
  return events.find((event) => event.evidenceId === evidenceId);
}

function eventByTag(events: WorldEvent[], tag: string) {
  return events.find((event) => event.tags.includes(tag));
}

function inferGenerationProfile(world: WorldState, events: WorldEvent[]): CaseGenerationProfile {
  const death = events.find((event) => event.type === "death");
  if (!death) throw new Error("No death event exists in this world log. Run a world tick before extracting a case.");
  const archetype = (["blade", "poison", "blunt", "fall"].find((tag) => death.tags.includes(tag)) || "blade") as MurderArchetype;
  const victimId = death.actorIds[1] || death.relatedCharacterIds[1];
  const culpritId = death.actorIds[0];
  const witnessEvent = eventByEvidence(events, "ev-opportunity") || eventByTag(events, "opportunity");
  const focusSuspectIds = events
    .filter((event) => event.tags.includes("focus_suspect"))
    .map((event) => event.actorIds[0])
    .filter(Boolean);
  const decisiveEvidenceIds = ["ev-means", "ev-motive", "ev-opportunity", "ev-staging", "ev-trace"];
  return {
    seed: world.seed,
    archetype,
    victimId,
    culpritId,
    witnessId: witnessEvent?.actorIds[0] || "",
    focusSuspectIds,
    sceneLocationId: death.locationId,
    prepLocationId: eventByEvidence(events, "ev-means")?.locationId || "",
    motiveEventId: eventByEvidence(events, "ev-motive")?.id || "",
    meansEventId: eventByEvidence(events, "ev-means")?.id || "",
    opportunityEventId: eventByEvidence(events, "ev-opportunity")?.id || "",
    deathEventId: death.id,
    stagingEventId: eventByEvidence(events, "ev-staging")?.id || "",
    traceEventId: eventByEvidence(events, "ev-trace")?.id || "",
    groupAlibiEventId: eventByEvidence(events, "ev-town-rollcall")?.id || "",
    decisiveEvidenceIds
  };
}

function sourceMapFromProfile(events: WorldEvent[], profile: CaseGenerationProfile): WorldCaseSourceMap {
  return {
    motiveEvidenceId: "ev-motive",
    meansEvidenceId: "ev-means",
    opportunityEvidenceId: "ev-opportunity",
    stagingEvidenceId: "ev-staging",
    traceEvidenceId: "ev-trace",
    groupAlibiEvidenceId: "ev-town-rollcall",
    sourceEventIds: events.filter((event) => event.evidenceId || event.id === profile.deathEventId).map((event) => event.id)
  };
}

function characterFromNpc(npc: NPCProfile, world: WorldState, profile: CaseGenerationProfile): Character {
  const isVictim = npc.id === profile.victimId;
  const isCulprit = npc.id === profile.culpritId;
  const isFocus = profile.focusSuspectIds.includes(npc.id);
  return {
    id: npc.id,
    name: npc.name,
    role: isVictim ? "死者" : npc.role,
    publicBio: isVictim ? `${npc.name}是本案死者，最后出现在${locationName(world, profile.sceneLocationId)}。` : `${npc.name}是${npc.role}，在镇上有固定日程和人际关系。`,
    secret: npc.secret,
    motive: isCulprit ? npc.motiveSeed : isFocus ? `${npc.name}与死者存在可疑摩擦。` : "没有足以杀人的直接动机。",
    means: isCulprit ? `能接触与${archetypeLabels[profile.archetype]}有关的关键物品。` : isFocus ? "表面上有接触类似工具或地点的可能。" : "没有被证明接触过关键手段。",
    opportunity: isCulprit ? `案发窗口被目击接近${locationName(world, profile.sceneLocationId)}。` : isFocus ? "案发窗口需要用证据排除。" : "案发窗口有可查的不在场记录。",
    isCulprit,
    alibi: isCulprit ? "声称自己案发窗口没有接近现场。" : "有一条可发现的不在场记录。",
    initialStatement: isCulprit ? "我只听说现场出事了。夜里那么乱，谁都可能被误认。" : "我愿意配合调查，但我只能说自己亲眼见到的部分。",
    knowledgeScope: npc.memoryEventIds,
    liePolicy: npc.liePolicy,
    contradictionTriggers: isCulprit ? [...profile.decisiveEvidenceIds] : []
  };
}

function evidenceFromEvent(world: WorldState, event: WorldEvent, profile: CaseGenerationProfile): Evidence {
  const isAlibi = event.type === "alibi";
  const isKey = profile.decisiveEvidenceIds.includes(event.evidenceId || "");
  return {
    id: event.evidenceId || event.id,
    title: isAlibi ? `${event.relatedCharacterIds.map((id) => npcName(world, id)).slice(0, 2).join("、") || "居民"}不在场记录` : keyEvidenceTitles[event.evidenceId || ""] || event.publicSummary,
    location: locationName(world, event.locationId),
    visibleDescription: event.publicSummary,
    trueMeaning: event.summary,
    relatedCharacterIds: event.relatedCharacterIds,
    relatedTime: `第${event.day}日 ${event.time}`,
    discoverable: true,
    isKey,
    unlocks: isAlibi ? ["排除对应嫌疑人"] : ["推进关键推理链"],
    contradicts: event.relatedCharacterIds.includes(profile.culpritId) ? [profile.culpritId] : event.relatedCharacterIds,
    supportsConclusion: isAlibi ? ["排除非凶手"] : ["锁定凶手", "还原时间线"],
    discoveryDifficulty: isKey ? "medium" : "easy"
  };
}

function memoriesForNpc(world: WorldState, npcId: string) {
  return (world.memories || []).filter((memory) => memory.npcId === npcId);
}

function createTestimonies(world: WorldState, deductionCase: DeductionCase, profile: CaseGenerationProfile): TestimonyRecord[] {
  return deductionCase.characters
    .filter((character) => character.role !== "死者")
    .map((character) => {
      const memories = memoriesForNpc(world, character.id);
      const isCulprit = character.id === profile.culpritId;
      const isWitness = character.id === profile.witnessId;
      const initialStatement = isCulprit
        ? `案发窗口我没有接近${locationName(world, profile.sceneLocationId)}，也不知道死者为什么会去那里。`
        : isWitness
          ? `我在夜雾中看见有人接近${locationName(world, profile.sceneLocationId)}，但一开始没有看清是谁。`
          : character.alibi;
      return {
        id: `testimony-${deductionCase.id}-${character.id}`,
        caseId: deductionCase.id,
        characterId: character.id,
        initialStatement,
        currentStatement: initialStatement,
        contradictionEvidenceIds: isCulprit ? ["ev-opportunity", "ev-means", "ev-motive", "ev-trace"] : isWitness ? ["ev-opportunity"] : [],
        exposedContradictions: [],
        revised: false,
        memoryIds: memories.map((memory) => memory.id)
      };
    });
}

export function extractCaseFromWorld(world: WorldState, events: WorldEvent[]): CaseFromLog {
  const profile = inferGenerationProfile(world, events);
  const death = events.find((event) => event.id === profile.deathEventId)!;
  const sourceEvents = events.filter((event) => event.evidenceId || event.id === profile.deathEventId || event.tags.includes("suspicion"));
  const evidenceEvents = sourceEvents.filter((event) => event.evidenceId);
  const evidence = evidenceEvents.map((event) => evidenceFromEvent(world, event, profile));
  const characters = world.npcs.map((npc) => characterFromNpc(npc, world, profile));
  const sourceMap = sourceMapFromProfile(events, profile);
  const alibiEvidenceByCharacter = new Map<string, string>();
  for (const event of evidenceEvents.filter((item) => item.type === "alibi")) {
    if (event.evidenceId) for (const actorId of event.actorIds) alibiEvidenceByCharacter.set(actorId, event.evidenceId);
  }

  const deductionCase: DeductionCase = {
    id: `case-${world.id}`,
    title: `${world.name}：${locationName(world, profile.sceneLocationId)}${archetypeLabels[profile.archetype]}案`,
    theme: `持续模拟小镇中的${archetypeLabels[profile.archetype]}本格案件`,
    premise: `${world.name}按 NPC 日程运行。第${death.day}日夜间，${locationName(world, profile.sceneLocationId)}发生死亡事件，案件事实全部来自世界事件日志。`,
    publicCaseFile: `第${death.day}日夜，${npcName(world, profile.victimId)}死在${locationName(world, profile.sceneLocationId)}。公开现场经过伪装，玩家需要搜索地点、询问 NPC，并用证据排除其他嫌疑人。`,
    truth: {
      culpritId: profile.culpritId,
      motive: eventByEvidence(events, "ev-motive")?.summary || `${npcName(world, profile.culpritId)}害怕秘密被死者公开。`,
      method: death.summary,
      opportunity: eventByEvidence(events, "ev-opportunity")?.summary || `${npcName(world, profile.culpritId)}在案发窗口接近现场。`,
      decisiveEvidenceIds: profile.decisiveEvidenceIds,
      trueTimeline: sourceEvents
        .filter((event) => ["obtain_item", "conflict", "witness", "death", "destroy_evidence", "forensic_clue"].includes(event.type))
        .map((event) => ({
          id: event.id,
          time: `第${event.day}日 ${event.time}`,
          event: event.summary,
          characterIds: event.relatedCharacterIds.length ? event.relatedCharacterIds : event.actorIds,
          isPublic: !event.hidden,
          source: "world-event-log",
          publicVersion: event.publicSummary,
          contradictedByEvidenceIds: event.evidenceId ? [event.evidenceId] : []
        }))
    },
    characters,
    evidence,
    scenes: world.locations.map((location) => ({
      id: location.id,
      name: location.name,
      description: location.description,
      evidenceIds: evidenceEvents.filter((event) => event.locationId === location.id).map((event) => event.evidenceId || event.id)
    })),
    relationships: world.npcs.filter((npc) => npc.id !== profile.victimId).map((npc) => ({ from: npc.id, to: profile.victimId, label: npc.relationships[profile.victimId] || "town_contact" })),
    logicPuzzle: {
      suspectMatrix: world.npcs
        .filter((npc) => npc.id !== profile.victimId)
        .map((npc) => {
          const isCulprit = npc.id === profile.culpritId;
          const isFocus = profile.focusSuspectIds.includes(npc.id);
          return {
            characterId: npc.id,
            name: npc.name,
            motive: isCulprit || isFocus,
            means: isCulprit || isFocus,
            opportunity: isCulprit || isFocus,
            excludedByEvidenceIds: isCulprit ? [] : [alibiEvidenceByCharacter.get(npc.id) || "ev-town-rollcall"],
            completeAndUnexcluded: isCulprit,
            isCulprit
          };
        }),
      exclusionChains: world.npcs
        .filter((npc) => npc.id !== profile.victimId && npc.id !== profile.culpritId)
        .map((npc) => ({ characterId: npc.id, reason: `${npc.name}在案发窗口被地点记录排除，无法同时出现在${locationName(world, profile.sceneLocationId)}。`, evidenceIds: [alibiEvidenceByCharacter.get(npc.id) || "ev-town-rollcall"] })),
      criticalReasoningChain: [
        { id: "reason-motive", conclusion: "死者掌握凶手秘密，形成直接动机。", evidenceIds: ["ev-motive"] },
        { id: "reason-means", conclusion: "凶手提前准备了与手法匹配的关键物品。", evidenceIds: ["ev-means"] },
        { id: "reason-opportunity", conclusion: "案发窗口凶手接近现场。", evidenceIds: ["ev-opportunity"] },
        { id: "reason-staging", conclusion: "现场经过伪装，公开版本不可信。", evidenceIds: ["ev-staging"] },
        { id: "reason-trace", conclusion: "现场痕迹把凶手和真实手法连接起来。", evidenceIds: ["ev-trace"] }
      ],
      redHerrings: ["现场伪装会误导死亡方式或时间。", "夜雾和群体登记会制造大量表面嫌疑人。"],
      requiredClueOrder: ["ev-staging", "ev-opportunity", "ev-means", "ev-motive", "ev-trace"]
    }
  };

  const testimonies = createTestimonies(world, deductionCase, profile);
  const validation = validateWorldCase(world, events, deductionCase);
  const qualityReport = buildCaseQualityReport(world, events, { deductionCase, generationProfile: profile, testimonies });
  return {
    id: deductionCase.id,
    worldId: world.id,
    sourceEventIds: sourceEvents.map((event) => event.id),
    deathEventId: death.id,
    generationProfile: profile,
    sourceMap,
    testimonies,
    qualityReport,
    deductionCase,
    validation,
    createdAt: new Date().toISOString()
  };
}

export function validateWorldCase(world: WorldState, events: WorldEvent[], deductionCase: DeductionCase): WorldCaseValidation {
  const report = validateCase(deductionCase);
  const worldErrors: string[] = [];
  const worldWarnings: string[] = [];
  const eventIds = new Set(events.map((event) => event.id));
  const npcIds = new Set(world.npcs.map((npc) => npc.id));
  const evidenceEventIds = new Set(events.filter((event) => event.evidenceId).map((event) => event.evidenceId || ""));
  const deathEvents = events.filter((event) => event.type === "death");
  const culpritRows = deriveSuspectMatrix(deductionCase).filter((row) => row.completeAndUnexcluded);

  if (deathEvents.length !== 1) worldErrors.push(`World log must contain exactly one death event; found ${deathEvents.length}.`);
  if (world.mode === "showcase" && world.npcs.length !== 8) worldErrors.push(`Showcase world must contain exactly 8 NPCs; found ${world.npcs.length}.`);
  if (culpritRows.length !== 1) worldErrors.push("World case must leave exactly one complete and unexcluded suspect.");
  if (!npcIds.has(deductionCase.truth.culpritId)) worldErrors.push("Culprit must exist in the world NPC list.");
  if (!events.some((event) => event.type === "conflict" && event.relatedCharacterIds.includes(deductionCase.truth.culpritId))) worldErrors.push("Culprit must have a motive-bearing conflict event.");
  if (!events.some((event) => event.tags.includes("means") && event.relatedCharacterIds.includes(deductionCase.truth.culpritId))) worldErrors.push("Culprit must have a means/prep event.");
  if (!events.some((event) => event.tags.includes("opportunity") && event.relatedCharacterIds.includes(deductionCase.truth.culpritId))) worldErrors.push("Culprit must have an opportunity witness event.");
  for (const id of deductionCase.truth.decisiveEvidenceIds) if (!evidenceEventIds.has(id)) worldErrors.push(`Decisive evidence ${id} must come from a world event.`);
  for (const event of deductionCase.truth.trueTimeline) {
    if (!eventIds.has(event.id)) worldErrors.push(`Timeline event ${event.id} is not backed by the current world log.`);
    for (const characterId of event.characterIds) if (!npcIds.has(characterId)) worldErrors.push(`Timeline event ${event.id} references missing NPC ${characterId}.`);
  }
  for (const row of deriveSuspectMatrix(deductionCase).filter((item) => !item.isCulprit)) {
    if (!row.excludedByEvidenceIds.some((id) => evidenceEventIds.has(id))) worldErrors.push(`Non-culprit ${row.characterId} lacks world-backed exclusion evidence.`);
  }
  if (deductionCase.evidence.length > 40) worldWarnings.push("This case has many alibi clues; UI grouping may be needed for polished play.");

  const qualityReport = buildCaseQualityReport(world, events, {
    deductionCase,
    generationProfile: {
      seed: world.seed,
      archetype: "blade",
      victimId: deductionCase.characters.find((character) => character.role === "死者")?.id || "victim",
      culpritId: deductionCase.truth.culpritId,
      witnessId: "",
      focusSuspectIds: [],
      sceneLocationId: events.find((event) => event.type === "death")?.locationId || "",
      prepLocationId: "",
      motiveEventId: "",
      meansEventId: "",
      opportunityEventId: "",
      deathEventId: events.find((event) => event.type === "death")?.id || "",
      stagingEventId: "",
      traceEventId: "",
      groupAlibiEventId: "",
      decisiveEvidenceIds: deductionCase.truth.decisiveEvidenceIds
    },
    testimonies: []
  });
  if (!qualityReport.uniqueCulprit) worldErrors.push("World case must have exactly one possible culprit after candidate analysis.");
  if (!qualityReport.reachabilityValid) worldErrors.push("World case has unresolved reachability for at least one non-culprit.");
  if (!qualityReport.reasoningTrace.every((trace) => trace.complete)) worldErrors.push("Every critical reasoning step must trace back to world events.");

  return { ...report, valid: report.valid && worldErrors.length === 0, worldValid: worldErrors.length === 0, worldErrors, worldWarnings, issues: [...report.issues, ...worldErrors], sourceEventIds: events.map((event) => event.id) };
}

export function buildNpcKnowledgeContext(world: WorldState, events: WorldEvent[], deductionCase: DeductionCase, characterId: string, discoveredEvidenceIds: string[]) {
  const character = deductionCase.characters.find((item) => item.id === characterId);
  const npc = world.npcs.find((item) => item.id === characterId);
  const visibleMemories = (world.memories || []).filter(
    (memory) => memory.npcId === characterId && (memory.visibleToPlayer || memory.kind === "direct" || memory.kind === "rumor" || discoveredEvidenceIds.some((id) => memory.challengeableEvidenceIds.includes(id)))
  );
  const allowedEventIds = new Set([...visibleMemories.map((memory) => memory.eventId), ...(character?.knowledgeScope || []), ...(npc?.memoryEventIds || [])]);
  const visibleEvents = events.filter((event) => allowedEventIds.has(event.id) && (!event.hidden || event.actorIds.includes(characterId)));
  const visibleEvidence = deductionCase.evidence.filter((item) => discoveredEvidenceIds.includes(item.id) && (item.relatedCharacterIds.includes(characterId) || visibleEvents.some((event) => event.evidenceId === item.id)));
  return { character, npc, visibleEvents, visibleEvidence, visibleMemories, memoryEventIds: visibleMemories.map((memory) => memory.eventId) };
}

export function detectContradictionHit(testimonies: TestimonyRecord[], characterId: string, evidenceId?: string) {
  const testimony = testimonies.find((item) => item.characterId === characterId);
  const hit = Boolean(testimony && evidenceId && testimony.contradictionEvidenceIds.includes(evidenceId));
  return {
    hit,
    testimonyId: testimony?.id,
    evidenceId,
    characterId,
    contradiction: hit ? "出示证据击中了该 NPC 的证词矛盾。" : "这条证据没有击中该 NPC 的证词矛盾。",
    revisedStatement: hit ? "我之前说得不完整。你拿出的证据说明，我确实隐瞒或误判了一部分案发窗口的信息。" : undefined
  };
}

export function updateTestimonyWithContradiction(testimonies: TestimonyRecord[], characterId: string, evidenceId?: string) {
  const hit = detectContradictionHit(testimonies, characterId, evidenceId);
  if (!hit.hit || !evidenceId) return { testimonies, contradictionHit: hit, updated: false };
  const next = testimonies.map((testimony) =>
    testimony.characterId === characterId ? { ...testimony, currentStatement: hit.revisedStatement || testimony.currentStatement, exposedContradictions: Array.from(new Set([...testimony.exposedContradictions, evidenceId])), revised: true } : testimony
  );
  return { testimonies: next, contradictionHit: hit, updated: true };
}

export function makeRuleBoundInterrogation(
  world: WorldState,
  events: WorldEvent[],
  deductionCase: DeductionCase,
  sessionId: string,
  characterId: string,
  question: string,
  discoveredEvidenceIds: string[],
  evidenceId?: string,
  modelAnswer?: string
): InterrogationLogEntry {
  const context = buildNpcKnowledgeContext(world, events, deductionCase, characterId, discoveredEvidenceIds);
  const challenge = evidenceId ? evaluateEvidenceChallenge(deductionCase, characterId, evidenceId) : undefined;
  const fallbackAnswer = context.character
    ? `${context.character.name}说：我只能确认自己知道的事。${context.visibleEvents.map((event) => event.publicSummary).slice(0, 2).join(" ")}${challenge?.hit ? " 你提到的证据确实让我原先的说法站不稳。" : " 其他细节我没有亲眼见过。"}`
    : "这个角色不存在，无法询问。";
  return {
    id: `iq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    sessionId,
    characterId,
    question,
    evidenceId,
    answer: modelAnswer?.trim() || fallbackAnswer,
    memoryEventIds: context.memoryEventIds,
    challenge,
    createdAt: new Date().toISOString()
  };
}

export function submitWorldTheory(deductionCase: DeductionCase, theory: PlayerTheory, discoveredEvidenceIds: string[]) {
  return judgeTheory(deductionCase, theory, discoveredEvidenceIds);
}
