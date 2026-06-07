import { buildCaseLogicReport, validateHardCaseLogic } from "./deduction-graph";
import { extractCaseFromWorld } from "./world-case";
import { createInitialWorld } from "./world-simulator";
import type { CaseFromLog, MemoryKind, MemoryRecord, NPCProfile, WorldEvent, WorldState } from "./world-types";

type PremiumShowcase = {
  world: WorldState;
  events: WorldEvent[];
  activeCase: CaseFromLog;
};

const premiumNpcData = [
  ["npc-00", "林澈", "镇档案员"],
  ["npc-01", "周岚", "药剂师"],
  ["npc-02", "顾沉", "旅店老板"],
  ["npc-03", "许真", "钟楼维修工"],
  ["npc-04", "赵砚", "巡夜人"],
  ["npc-05", "沈青禾", "花店主"],
  ["npc-06", "陆执", "旧剧院经理"],
  ["npc-07", "陈映雪", "湖畔画师"]
] as const;

const schedules: Record<string, Record<string, string>> = {
  "npc-00": { "08:00": "archive", "12:00": "town-square", "16:00": "clocktower", "20:00": "archive", "23:00": "home-1" },
  "npc-01": { "08:00": "clinic", "12:00": "town-square", "16:00": "clinic", "20:00": "market", "23:00": "home-2" },
  "npc-02": { "08:00": "inn", "12:00": "town-square", "16:00": "inn", "20:00": "inn", "23:00": "home-3" },
  "npc-03": { "08:00": "clocktower", "12:00": "town-square", "16:00": "clocktower", "20:00": "clocktower", "23:00": "home-4" },
  "npc-04": { "08:00": "town-square", "12:00": "town-square", "16:00": "lake", "20:00": "town-square", "23:00": "home-5" },
  "npc-05": { "08:00": "greenhouse", "12:00": "town-square", "16:00": "greenhouse", "20:00": "town-square", "23:00": "home-6" },
  "npc-06": { "08:00": "theater", "12:00": "town-square", "16:00": "theater", "20:00": "archive", "23:00": "home-7" },
  "npc-07": { "08:00": "lake", "12:00": "town-square", "16:00": "lake", "20:00": "town-square", "23:00": "home-8" }
};

function now() {
  return new Date().toISOString();
}

function eventId(time: string, suffix: string) {
  return `premium-d1-${time.replace(":", "")}-${suffix}`;
}

function locationName(world: WorldState, id: string) {
  return world.locations.find((location) => location.id === id)?.name || id;
}

function npcName(world: WorldState, id: string) {
  return world.npcs.find((npc) => npc.id === id)?.name || id;
}

function addMemory(world: WorldState, event: WorldEvent, npcId: string, kind: MemoryKind, summary: string, evidenceIds: string[] = []) {
  const memory: MemoryRecord = {
    id: `mem-${event.id}-${npcId}-${kind}`,
    worldId: world.id,
    npcId,
    kind,
    eventId: event.id,
    day: event.day,
    summary,
    confidence: kind === "false" ? 0.35 : kind === "rumor" ? 0.6 : 0.92,
    visibleToPlayer: kind !== "secret",
    challengeableEvidenceIds: evidenceIds
  };
  if (!world.memories.some((item) => item.id === memory.id)) world.memories.push(memory);
  const npc = world.npcs.find((item) => item.id === npcId);
  if (npc && !npc.memoryEventIds.includes(event.id)) npc.memoryEventIds.push(event.id);
}

function rememberEvent(world: WorldState, event: WorldEvent) {
  for (const actorId of event.actorIds) addMemory(world, event, actorId, event.hidden ? "secret" : "direct", event.hidden ? event.summary : event.publicSummary, event.evidenceId ? [event.evidenceId] : []);
  for (const characterId of event.relatedCharacterIds) {
    if (!event.actorIds.includes(characterId) && !event.hidden) addMemory(world, event, characterId, "direct", event.publicSummary, event.evidenceId ? [event.evidenceId] : []);
  }
}

function makeEvent(world: WorldState, input: Omit<WorldEvent, "worldId" | "day">): WorldEvent {
  return { ...input, worldId: world.id, day: 1 };
}

function moveEvents(world: WorldState): WorldEvent[] {
  const events: WorldEvent[] = [];
  for (const time of ["08:00", "12:00", "16:00", "20:00", "23:00"]) {
    for (const npc of world.npcs.filter((item) => item.alive)) {
      const locationId = npc.schedule[time] || "town-square";
      events.push(
        makeEvent(world, {
          id: eventId(time, `${npc.id}-move`),
          time,
          type: "move",
          actorIds: [npc.id],
          locationId,
          summary: `${npc.name}按固定日程到达${locationName(world, locationId)}。`,
          publicSummary: `${npc.name}在 ${time} 左右出现在${locationName(world, locationId)}。`,
          hidden: false,
          relatedCharacterIds: [npc.id],
          tags: ["schedule"]
        })
      );
    }
  }
  return events;
}

function createPremiumWorld(seed = "premium-showcase"): WorldState {
  const world = createInitialWorld(seed, { mode: "showcase", npcCount: 8, timelineHours: 24, caseArchetype: "blunt" });
  world.id = `world-premium-showcase-${seed.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`;
  world.seed = seed;
  world.name = "雾灯镇";
  world.currentTime = "08:00";
  world.timelineHours = 24;
  world.plannedArchetype = "blunt";
  world.memories = [];
  world.simulationReports = [];
  world.locations = world.locations.map((location) => {
    const clean: Record<string, string> = {
      "town-square": "雾灯广场",
      archive: "镇档案馆",
      inn: "黑松旅店",
      clocktower: "钟楼",
      clinic: "白桦诊所",
      market: "雨棚集市",
      theater: "旧剧院",
      lake: "月牙湖码头",
      greenhouse: "温室"
    };
    return { ...location, name: clean[location.id] || location.name };
  });
  world.npcs = world.npcs.map((npc, index): NPCProfile => {
    const [id, name, role] = premiumNpcData[index];
    return {
      ...npc,
      id,
      name,
      role,
      schedule: schedules[id],
      alive: true,
      secret:
        id === "npc-06"
          ? "陆执挪用旧剧院修缮款，林澈掌握了原始票据。"
          : id === "npc-02"
            ? "顾沉欠林澈一笔旧债，表面动机很强。"
            : id === "npc-03"
              ? "许真私自改过钟楼维修登记，容易被误认为操纵时间。"
              : `${name}有一段不愿公开的小镇往事。`,
      motiveSeed:
        id === "npc-06"
          ? "林澈准备公开剧院修缮款票据，陆执会失去剧院和名声。"
          : id === "npc-02"
            ? "顾沉和林澈有债务冲突。"
            : id === "npc-03"
              ? "许真担心维修登记问题被追责。"
              : `${name}没有足以杀人的直接动机。`,
      skills: id === "npc-06" ? ["theater_rigging", "staging"] : id === "npc-03" ? ["mechanical", "clockwork"] : npc.skills,
      memoryEventIds: [],
      liePolicy: id === "npc-06" ? "会隐瞒修缮款和案发窗口，但不能编造未见过的事实。" : "只能陈述自己记忆范围内的事实。"
    };
  });
  return world;
}

function premiumEvents(world: WorldState): WorldEvent[] {
  const events = moveEvents(world);
  const caseEvents: WorldEvent[] = [
    makeEvent(world, {
      id: eventId("09:20", "guchen-debt-red-herring"),
      time: "09:20",
      type: "conflict",
      actorIds: ["npc-02", "npc-00"],
      locationId: "inn",
      summary: "顾沉向林澈追问旧债票据，争执被旅店账房听见。",
      publicSummary: "黑松旅店上午出现一场和旧债有关的争执。",
      hidden: false,
      relatedCharacterIds: ["npc-02", "npc-00"],
      tags: ["tension", "suspicion", "focus_suspect"]
    }),
    makeEvent(world, {
      id: eventId("13:20", "xuzhen-clock-red-herring"),
      time: "13:20",
      type: "conversation",
      actorIds: ["npc-03", "npc-00"],
      locationId: "clocktower",
      summary: "许真承认钟楼维修登记有改动，林澈要求他傍晚前交出原记录。",
      publicSummary: "钟楼维修登记被人改动，许真因此显得可疑。",
      hidden: false,
      relatedCharacterIds: ["npc-03", "npc-00"],
      tags: ["suspicion", "focus_suspect", "time-trick"]
    }),
    makeEvent(world, {
      id: eventId("18:10", "means-prep"),
      time: "18:10",
      type: "obtain_item",
      actorIds: ["npc-06"],
      locationId: "theater",
      summary: "陆执从旧剧院后台取走舞台配重锤，并用幕布袋遮住锤头。",
      publicSummary: "旧剧院后台少了一只舞台配重锤，登记没有签名。",
      hidden: true,
      evidenceId: "ev-means",
      relatedCharacterIds: ["npc-06"],
      tags: ["prep", "means", "blunt"]
    }),
    makeEvent(world, {
      id: eventId("20:20", "secret-leak"),
      time: "20:20",
      type: "conflict",
      actorIds: ["npc-06", "npc-00"],
      locationId: "archive",
      summary: "林澈告诉陆执，明早会公开旧剧院修缮款原始票据。",
      publicSummary: "镇档案馆夜间传出争执，内容与旧剧院修缮款有关。",
      hidden: true,
      evidenceId: "ev-motive",
      relatedCharacterIds: ["npc-06", "npc-00"],
      tags: ["secret_leak", "motive", "suspicion"]
    }),
    makeEvent(world, {
      id: eventId("21:30", "witness-opportunity"),
      time: "21:30",
      type: "witness",
      actorIds: ["npc-01"],
      locationId: "market",
      summary: "周岚在雨棚集市看见陆执穿深色雨衣，绕过广场走向镇档案馆后门。",
      publicSummary: "周岚声称夜雾中有人接近镇档案馆，最初没有说出姓名。",
      hidden: false,
      evidenceId: "ev-opportunity",
      relatedCharacterIds: ["npc-06", "npc-01"],
      tags: ["witness", "opportunity", "testimony-reversal"]
    }),
    makeEvent(world, {
      id: eventId("21:42", "guchen-alibi"),
      time: "21:42",
      type: "alibi",
      actorIds: ["npc-02"],
      locationId: "inn",
      summary: "旅店夜账和两名住客证明顾沉在 21:42 到 21:55 一直在黑松旅店前台。",
      publicSummary: "黑松旅店夜账能排除顾沉在案发窗口离开旅店。",
      hidden: false,
      evidenceId: "ev-focus-alibi-1",
      relatedCharacterIds: ["npc-02"],
      tags: ["alibi", "exclusion", "focus_suspect"]
    }),
    makeEvent(world, {
      id: eventId("21:43", "xuzhen-alibi"),
      time: "21:43",
      type: "alibi",
      actorIds: ["npc-03"],
      locationId: "clocktower",
      summary: "钟楼维修铃在 21:43 自动记录许真的工具箱被打开，他无法同时抵达档案馆。",
      publicSummary: "钟楼维修铃记录能排除许真在案发窗口抵达档案馆。",
      hidden: false,
      evidenceId: "ev-focus-alibi-2",
      relatedCharacterIds: ["npc-03"],
      tags: ["alibi", "exclusion", "focus_suspect"]
    }),
    makeEvent(world, {
      id: eventId("21:46", "town-rollcall"),
      time: "21:46",
      type: "alibi",
      actorIds: ["npc-01", "npc-04", "npc-05", "npc-07"],
      locationId: "town-square",
      summary: "巡夜登记显示周岚、赵砚、沈青禾、陈映雪在案发窗口集中于雾灯广场避雨。",
      publicSummary: "雾灯广场巡夜登记能排除多数路人嫌疑。",
      hidden: false,
      evidenceId: "ev-town-rollcall",
      relatedCharacterIds: ["npc-01", "npc-04", "npc-05", "npc-07"],
      tags: ["alibi", "exclusion", "group_alibi"]
    }),
    makeEvent(world, {
      id: eventId("21:47", "death"),
      time: "21:47",
      type: "death",
      actorIds: ["npc-06", "npc-00"],
      locationId: "archive",
      summary: "陆执在镇档案馆用舞台配重锤击杀林澈，再伪装成灯架坠落事故。",
      publicSummary: "林澈被发现死在镇档案馆，现场像是灯架坠落事故。",
      hidden: true,
      evidenceId: "ev-death-scene",
      relatedCharacterIds: ["npc-06", "npc-00"],
      tags: ["murder", "blunt"]
    }),
    makeEvent(world, {
      id: eventId("21:55", "staging"),
      time: "21:55",
      type: "destroy_evidence",
      actorIds: ["npc-06"],
      locationId: "archive",
      summary: "陆执故意撞断灯架螺丝，让现场看起来像意外事故。",
      publicSummary: "镇档案馆灯架螺丝断口新鲜，现场摆放解释不完整。",
      hidden: true,
      evidenceId: "ev-staging",
      relatedCharacterIds: ["npc-06"],
      tags: ["staging", "time-trick", "blunt"]
    }),
    makeEvent(world, {
      id: eventId("22:05", "trace"),
      time: "22:05",
      type: "forensic_clue",
      actorIds: ["npc-06"],
      locationId: "archive",
      summary: "档案柜边缘留下旧剧院幕布纤维和黑色油漆，连接陆执和凶器。",
      publicSummary: "镇档案馆发现幕布纤维和黑色油漆，与公开事故说法不一致。",
      hidden: false,
      evidenceId: "ev-trace",
      relatedCharacterIds: ["npc-06"],
      tags: ["trace", "forensic", "blunt"]
    })
  ];
  events.push(...caseEvents);
  return events.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
}

function attachPremiumMemories(world: WorldState, events: WorldEvent[]) {
  world.memories = [];
  for (const event of events) rememberEvent(world, event);
  const opportunity = events.find((event) => event.evidenceId === "ev-opportunity");
  if (opportunity) addMemory(world, opportunity, "npc-01", "direct", "周岚起初只承认看见深色雨衣，出示目击记录后才承认那人是陆执。", ["ev-opportunity"]);
}

export function createPremiumShowcaseWorld(seed = "premium-showcase"): PremiumShowcase {
  const world = createPremiumWorld(seed);
  const events = premiumEvents(world);
  attachPremiumMemories(world, events);
  const victim = world.npcs.find((npc) => npc.id === "npc-00");
  if (victim) victim.alive = false;
  const activeCase = extractCaseFromWorld(world, events);
  const logicReport = buildCaseLogicReport(world, events, activeCase);
  activeCase.qualityReport = {
    ...activeCase.qualityReport,
    logicStrength: logicReport.logicStrength,
    misdirectionQuality: logicReport.misdirectionQuality,
    deductionGraphComplete: logicReport.deductionGraphComplete,
    allNonCulpritsExplainablyExcluded: logicReport.allNonCulpritsExplainablyExcluded
  };
  const hard = validateHardCaseLogic(world, events, activeCase);
  activeCase.validation = {
    ...activeCase.validation,
    valid: activeCase.validation.valid && hard.valid,
    worldValid: activeCase.validation.worldValid && hard.valid,
    worldErrors: [...activeCase.validation.worldErrors, ...hard.errors],
    issues: [...activeCase.validation.issues, ...hard.errors]
  };
  world.activeCaseId = activeCase.id;
  world.updatedAt = now();
  return { world, events, activeCase };
}
