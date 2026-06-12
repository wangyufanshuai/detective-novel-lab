import { buildCaseLogicReport, validateHardCaseLogic } from "./deduction-graph";
import { extractCaseFromWorld } from "./world-case";
import { createInitialWorld } from "./world-simulator";
import type { CaseFromLog, CaseTemplateId, MemoryKind, MemoryRecord, NPCProfile, WorldEvent, WorldState } from "./world-types";

export type PremiumShowcase = {
  world: WorldState;
  events: WorldEvent[];
  activeCase: CaseFromLog;
};

export type CaseTemplateMeta = {
  id: CaseTemplateId;
  title: string;
  description: string;
  archetype: "blade" | "poison" | "blunt" | "fall";
};

type TemplateConfig = CaseTemplateMeta & {
  worldSeed: string;
  victimId: string;
  culpritId: string;
  witnessId: string;
  focusSuspectIds: string[];
  sceneLocationId: string;
  prepLocationId: string;
  meansItem: string;
  motiveText: string;
  meansText: string;
  opportunityText: string;
  methodText: string;
  stagingText: string;
  traceText: string;
  traceTitle: string;
  redHerringOne: string;
  redHerringTwo: string;
};

const npcData = [
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

const templates: TemplateConfig[] = [
  {
    id: "archive-blunt",
    title: "档案馆钝器误导案",
    description: "旧剧院经理试图把档案馆凶案伪装成灯架坠落事故。",
    archetype: "blunt",
    worldSeed: "archive-blunt",
    victimId: "npc-00",
    culpritId: "npc-06",
    witnessId: "npc-01",
    focusSuspectIds: ["npc-02", "npc-03"],
    sceneLocationId: "archive",
    prepLocationId: "theater",
    meansItem: "舞台配重锤",
    motiveText: "林澈准备公开旧剧院修缮款票据，陆执会失去剧院和名声。",
    meansText: "陆执从旧剧院后台取走舞台配重锤，并用幕布袋遮住锤头。",
    opportunityText: "周岚在雨棚集市看见陆执穿深色雨衣，绕过广场走向镇档案馆后门。",
    methodText: "陆执在镇档案馆用舞台配重锤击杀林澈，再伪装成灯架坠落事故。",
    stagingText: "陆执故意撞断灯架螺丝，让现场看起来像意外事故。",
    traceText: "档案柜边缘留下旧剧院幕布纤维和黑色油漆，连接陆执和凶器。",
    traceTitle: "幕布纤维",
    redHerringOne: "顾沉向林澈追问旧债票据，争执被旅店账房听见。",
    redHerringTwo: "许真承认钟楼维修登记有改动，林澈要求他傍晚前交出原记录。"
  },
  {
    id: "clocktower-locked-room",
    title: "钟楼密室时间案",
    description: "钟楼维修记录制造密室假象，真实突破口是护栏与巡夜钟声。",
    archetype: "fall",
    worldSeed: "clocktower-locked-room",
    victimId: "npc-00",
    culpritId: "npc-03",
    witnessId: "npc-07",
    focusSuspectIds: ["npc-02", "npc-06"],
    sceneLocationId: "clocktower",
    prepLocationId: "clocktower",
    meansItem: "松动护栏螺栓",
    motiveText: "林澈掌握许真私改维修登记的原始记录，准备把他从钟楼项目中除名。",
    meansText: "许真提前松开钟楼护栏螺栓，并把维修记录改成昨日完成。",
    opportunityText: "陈映雪在湖畔写生时看见许真从钟楼侧门绕回，时间早于报案。",
    methodText: "许真把林澈引到护栏边，借松动护栏制造坠落。",
    stagingText: "许真把维修牌翻到安全一面，并调慢巡夜钟声记录，制造密室时间错觉。",
    traceText: "工具箱里留下新鲜金属屑和带指纹的扳手，证明护栏刚被动过。",
    traceTitle: "新鲜金属屑",
    redHerringOne: "顾沉在旅店提到林澈欠债，表面动机很强。",
    redHerringTwo: "陆执借用过钟楼灯控钥匙，容易被误认为能进入密室。"
  },
  {
    id: "clinic-poison",
    title: "诊所毒杀证词案",
    description: "药柜登记和水壶清洗痕迹揭开毒杀案，证人最初隐瞒了药剂师行踪。",
    archetype: "poison",
    worldSeed: "clinic-poison",
    victimId: "npc-00",
    culpritId: "npc-01",
    witnessId: "npc-04",
    focusSuspectIds: ["npc-02", "npc-05"],
    sceneLocationId: "inn",
    prepLocationId: "clinic",
    meansItem: "镇静剂小瓶",
    motiveText: "林澈发现周岚长期篡改诊所药品登记，并准备把原始药柜记录交给镇议会。",
    meansText: "周岚从白桦诊所药柜取走一瓶镇静剂，并改动夜班登记。",
    opportunityText: "赵砚巡夜时看见周岚带着药箱进入黑松旅店后门。",
    methodText: "周岚把镇静剂混入林澈随身水壶，诱发昏迷后造成死亡。",
    stagingText: "周岚清洗水壶外壁，并把杯子摆成死者独饮的样子。",
    traceText: "水壶螺纹处残留镇静剂结晶和诊所药柜金属粉末。",
    traceTitle: "药柜金属粉末",
    redHerringOne: "顾沉与林澈在旅店账本上有旧债纠纷。",
    redHerringTwo: "沈青禾保管温室药剂，容易被误认为拥有毒物来源。"
  },
  {
    id: "greenhouse-blade",
    title: "Greenhouse pruning blade case",
    description: "A florist hides a pruning knife murder behind greenhouse maintenance logs and staged broken glass.",
    archetype: "blade",
    worldSeed: "greenhouse-blade",
    victimId: "npc-00",
    culpritId: "npc-05",
    witnessId: "npc-04",
    focusSuspectIds: ["npc-02", "npc-03"],
    sceneLocationId: "greenhouse",
    prepLocationId: "greenhouse",
    meansItem: "pruning knife",
    motiveText: "Lin Miao found shipment records proving Shen Qinghe used the greenhouse ledger to hide banned bulbs and planned to expose the fraud at the town council.",
    meansText: "Shen Qinghe removed the greenhouse pruning knife from the locked tool rack and changed the maintenance checklist to make the missing blade look routine.",
    opportunityText: "Zhao Lei saw Shen Qinghe leave the town square with a canvas tool wrap and walk toward the greenhouse before the alarm was raised.",
    methodText: "Shen Qinghe lured Lin Miao into the greenhouse aisle and stabbed him with the pruning knife before hiding the weapon in a compost bin.",
    stagingText: "Shen Qinghe broke a pane of greenhouse glass and scattered potting soil to suggest an outside intruder forced the door.",
    traceText: "Fresh sap, dark soil, and a nicked pruning rack mark match the blade hidden in the compost bin and tie it back to Shen Qinghe's tool set.",
    traceTitle: "sap-stained rack mark",
    redHerringOne: "Gu Chen argued with Lin Miao over unpaid inn bills, and the dispute was heard from the guest ledger room.",
    redHerringTwo: "Xu Zhen borrowed greenhouse access keys for clocktower repairs, making his movement log look suspicious before the alibi check."
  }
];

function now() {
  return new Date().toISOString();
}

function eventId(templateId: CaseTemplateId, time: string, suffix: string) {
  return `${templateId}-d1-${time.replace(":", "")}-${suffix}`;
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

function moveEvents(world: WorldState, templateId: CaseTemplateId): WorldEvent[] {
  const events: WorldEvent[] = [];
  for (const time of ["08:00", "12:00", "16:00", "20:00", "23:00"]) {
    for (const npc of world.npcs.filter((item) => item.alive)) {
      const locationId = npc.schedule[time] || "town-square";
      const id = eventId(templateId, time, `${npc.id}-move`);
      events.push(
        makeEvent(world, {
          id,
          time,
          type: "move",
          actorIds: [npc.id],
          locationId,
          summary: `${npc.name}按固定日程到达${world.locations.find((location) => location.id === locationId)?.name || locationId}。`,
          publicSummary: `${npc.name}在 ${time} 左右出现在${world.locations.find((location) => location.id === locationId)?.name || locationId}。`,
          hidden: false,
          relatedCharacterIds: [npc.id],
          tags: ["schedule"],
          goalId: `goal-${npc.id}-protect-secret`,
          intentId: `intent-${id}`,
          explanation: "固定日程提供案发窗口的可达性与不在场基础。"
        })
      );
    }
  }
  return events;
}

function createTemplateWorld(config: TemplateConfig): WorldState {
  const world = createInitialWorld(config.worldSeed, { mode: "showcase", npcCount: 8, timelineHours: 24, caseArchetype: config.archetype });
  world.id = `world-${config.id}`;
  world.seed = config.worldSeed;
  world.name = "雾灯镇";
  world.currentTime = "08:00";
  world.timelineHours = 24;
  world.plannedArchetype = config.archetype;
  world.memories = [];
  world.simulationReports = [];
  world.npcs = world.npcs.map((npc, index): NPCProfile => {
    const [id, name, role] = npcData[index];
    return {
      ...npc,
      id,
      name,
      role,
      schedule: schedules[id],
      alive: true,
      secret:
        id === config.culpritId
          ? config.motiveText
          : config.focusSuspectIds.includes(id)
            ? `${name}有一段会制造表面嫌疑的旧事。`
            : `${name}有一段不愿公开的小镇往事。`,
      motiveSeed: id === config.culpritId ? config.motiveText : config.focusSuspectIds.includes(id) ? `${name}与林澈存在可疑摩擦。` : `${name}没有足以杀人的直接动机。`,
      skills: id === config.culpritId ? ["planning", config.archetype] : npc.skills,
      memoryEventIds: [],
      liePolicy: id === config.culpritId ? "会隐瞒案发窗口和自身秘密，但不能编造未见过的事实。" : "只能陈述自己记忆范围内的事实。"
    };
  });
  return world;
}

function templateEvents(world: WorldState, config: TemplateConfig): WorldEvent[] {
  const events = moveEvents(world, config.id);
  const focusOne = config.focusSuspectIds[0];
  const focusTwo = config.focusSuspectIds[1];
  const common = {
    goalId: `goal-${config.culpritId}-protect-secret`
  };
  const caseEvents: WorldEvent[] = [
    makeEvent(world, {
      id: eventId(config.id, "09:20", "red-herring-one"),
      time: "09:20",
      type: "conflict",
      actorIds: [focusOne, config.victimId],
      locationId: focusOne === "npc-02" ? "inn" : "theater",
      summary: config.redHerringOne,
      publicSummary: config.redHerringOne,
      hidden: false,
      relatedCharacterIds: [focusOne, config.victimId],
      tags: ["tension", "suspicion", "focus_suspect"],
      intentId: `intent-${eventId(config.id, "09:20", "red-herring-one")}`,
      explanation: "强误导嫌疑人形成表面动机。"
    }),
    makeEvent(world, {
      id: eventId(config.id, "13:20", "red-herring-two"),
      time: "13:20",
      type: "conversation",
      actorIds: [focusTwo, config.victimId],
      locationId: focusTwo === "npc-03" ? "clocktower" : "greenhouse",
      summary: config.redHerringTwo,
      publicSummary: config.redHerringTwo,
      hidden: false,
      relatedCharacterIds: [focusTwo, config.victimId],
      tags: ["suspicion", "focus_suspect", "time-trick"],
      intentId: `intent-${eventId(config.id, "13:20", "red-herring-two")}`,
      explanation: "第二名强误导嫌疑人制造手段或时间疑点。"
    }),
    makeEvent(world, {
      id: eventId(config.id, "18:10", "means-prep"),
      time: "18:10",
      type: "obtain_item",
      actorIds: [config.culpritId],
      locationId: config.prepLocationId,
      summary: config.meansText,
      publicSummary: `${world.locations.find((location) => location.id === config.prepLocationId)?.name || config.prepLocationId}出现一条和${config.meansItem}有关的异常记录。`,
      hidden: true,
      evidenceId: "ev-means",
      relatedCharacterIds: [config.culpritId],
      tags: ["prep", "means", config.archetype],
      ...common,
      intentId: `intent-${eventId(config.id, "18:10", "means-prep")}`,
      causedByEventIds: [eventId(config.id, "09:20", "red-herring-one")],
      explanation: "秘密风险推动凶手提前接触手段。"
    }),
    makeEvent(world, {
      id: eventId(config.id, "20:20", "secret-leak"),
      time: "20:20",
      type: "conflict",
      actorIds: [config.culpritId, config.victimId],
      locationId: "archive",
      summary: config.motiveText,
      publicSummary: "镇档案馆夜间传出争执，内容与旧档案有关。",
      hidden: true,
      evidenceId: "ev-motive",
      relatedCharacterIds: [config.culpritId, config.victimId],
      tags: ["secret_leak", "motive", "suspicion"],
      ...common,
      intentId: `intent-${eventId(config.id, "20:20", "secret-leak")}`,
      causedByEventIds: [eventId(config.id, "18:10", "means-prep")],
      explanation: "死者准备公开秘密，动机升级为直接冲突。"
    }),
    makeEvent(world, {
      id: eventId(config.id, "21:30", "witness-opportunity"),
      time: "21:30",
      type: "witness",
      actorIds: [config.witnessId],
      locationId: world.npcs.find((npc) => npc.id === config.witnessId)?.schedule["20:00"] || "town-square",
      summary: config.opportunityText,
      publicSummary: `${world.npcs.find((npc) => npc.id === config.witnessId)?.name || "证人"}声称夜雾中有人接近案发地点，最初没有说出姓名。`,
      hidden: false,
      evidenceId: "ev-opportunity",
      relatedCharacterIds: [config.culpritId, config.witnessId],
      tags: ["witness", "opportunity", "testimony-reversal"],
      ...common,
      intentId: `intent-${eventId(config.id, "21:30", "witness-opportunity")}`,
      causedByEventIds: [eventId(config.id, "20:20", "secret-leak")],
      explanation: "凶手进入案发地点，形成机会证据。"
    }),
    makeEvent(world, {
      id: eventId(config.id, "21:42", "focus-alibi-one"),
      time: "21:42",
      type: "alibi",
      actorIds: [focusOne],
      locationId: focusOne === "npc-02" ? "inn" : "theater",
      summary: `${world.npcs.find((npc) => npc.id === focusOne)?.name || focusOne}在案发窗口被独立记录排除。`,
      publicSummary: `${world.npcs.find((npc) => npc.id === focusOne)?.name || focusOne}有可查的不在场记录。`,
      hidden: false,
      evidenceId: "ev-focus-alibi-1",
      relatedCharacterIds: [focusOne],
      tags: ["alibi", "exclusion", "focus_suspect"],
      intentId: `intent-${eventId(config.id, "21:42", "focus-alibi-one")}`,
      explanation: "表面嫌疑人被世界事件排除。"
    }),
    makeEvent(world, {
      id: eventId(config.id, "21:43", "focus-alibi-two"),
      time: "21:43",
      type: "alibi",
      actorIds: [focusTwo],
      locationId: focusTwo === "npc-03" ? "clocktower" : "greenhouse",
      summary: `${world.npcs.find((npc) => npc.id === focusTwo)?.name || focusTwo}在案发窗口被独立记录排除。`,
      publicSummary: `${world.npcs.find((npc) => npc.id === focusTwo)?.name || focusTwo}有可查的不在场记录。`,
      hidden: false,
      evidenceId: "ev-focus-alibi-2",
      relatedCharacterIds: [focusTwo],
      tags: ["alibi", "exclusion", "focus_suspect"],
      intentId: `intent-${eventId(config.id, "21:43", "focus-alibi-two")}`,
      explanation: "第二名表面嫌疑人被世界事件排除。"
    }),
    makeEvent(world, {
      id: eventId(config.id, "21:46", "town-rollcall"),
      time: "21:46",
      type: "alibi",
      actorIds: world.npcs.filter((npc) => npc.alive && ![config.culpritId, config.victimId, focusOne, focusTwo].includes(npc.id)).map((npc) => npc.id),
      locationId: "town-square",
      summary: "巡夜登记显示，多数居民在案发窗口集中于雾灯广场避雨。",
      publicSummary: "雾灯广场巡夜登记能排除多名路人嫌疑。",
      hidden: false,
      evidenceId: "ev-town-rollcall",
      relatedCharacterIds: world.npcs.filter((npc) => npc.alive && ![config.culpritId, config.victimId, focusOne, focusTwo].includes(npc.id)).map((npc) => npc.id),
      tags: ["alibi", "exclusion", "group_alibi"],
      intentId: `intent-${eventId(config.id, "21:46", "town-rollcall")}`,
      explanation: "公共登记形成群体排除链。"
    }),
    makeEvent(world, {
      id: eventId(config.id, "21:47", "death"),
      time: "21:47",
      type: "death",
      actorIds: [config.culpritId, config.victimId],
      locationId: config.sceneLocationId,
      summary: config.methodText,
      publicSummary: `${world.npcs.find((npc) => npc.id === config.victimId)?.name || "死者"}被发现死在${world.locations.find((location) => location.id === config.sceneLocationId)?.name || config.sceneLocationId}。`,
      hidden: true,
      evidenceId: "ev-death-scene",
      relatedCharacterIds: [config.culpritId, config.victimId],
      tags: ["murder", config.archetype],
      ...common,
      intentId: `intent-${eventId(config.id, "21:47", "death")}`,
      causedByEventIds: [eventId(config.id, "18:10", "means-prep"), eventId(config.id, "20:20", "secret-leak"), eventId(config.id, "21:30", "witness-opportunity")],
      explanation: "动机、手段、机会汇合为案发事件。"
    }),
    makeEvent(world, {
      id: eventId(config.id, "21:55", "staging"),
      time: "21:55",
      type: "destroy_evidence",
      actorIds: [config.culpritId],
      locationId: config.sceneLocationId,
      summary: config.stagingText,
      publicSummary: "现场有一处明显但解释不完整的伪装痕迹。",
      hidden: true,
      evidenceId: "ev-staging",
      relatedCharacterIds: [config.culpritId],
      tags: ["staging", "time-trick", config.archetype],
      ...common,
      intentId: `intent-${eventId(config.id, "21:55", "staging")}`,
      causedByEventIds: [eventId(config.id, "21:47", "death")],
      explanation: "凶手试图用伪装改变玩家对时间和手法的判断。"
    }),
    makeEvent(world, {
      id: eventId(config.id, "22:05", "trace"),
      time: "22:05",
      type: "forensic_clue",
      actorIds: [config.culpritId],
      locationId: config.sceneLocationId,
      summary: config.traceText,
      publicSummary: `${world.locations.find((location) => location.id === config.sceneLocationId)?.name || config.sceneLocationId}发现${config.traceTitle}，与公开说法不一致。`,
      hidden: false,
      evidenceId: "ev-trace",
      relatedCharacterIds: [config.culpritId],
      tags: ["trace", "forensic", config.archetype],
      ...common,
      intentId: `intent-${eventId(config.id, "22:05", "trace")}`,
      causedByEventIds: [eventId(config.id, "21:55", "staging")],
      explanation: "伪装留下反证，成为玩家可发现的关键线索。"
    })
  ];
  events.push(...caseEvents);
  return events.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
}

function attachTemplateMemories(world: WorldState, events: WorldEvent[], config: TemplateConfig) {
  world.memories = [];
  for (const event of events) rememberEvent(world, event);
  const opportunity = events.find((event) => event.evidenceId === "ev-opportunity");
  if (opportunity) {
    addMemory(
      world,
      opportunity,
      config.witnessId,
      "direct",
      "证人起初只承认看见深色雨衣，出示目击记录后才承认那个人是凶手。",
      ["ev-opportunity"]
    );
  }
}

function finishTemplate(world: WorldState, events: WorldEvent[]): PremiumShowcase {
  const victim = world.npcs.find((npc) => events.some((event) => event.type === "death" && event.actorIds[1] === npc.id));
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

export function listCaseTemplates(): CaseTemplateMeta[] {
  return templates.map(({ id, title, description, archetype }) => ({ id, title, description, archetype }));
}

export function createCaseTemplate(templateId: CaseTemplateId = "archive-blunt"): PremiumShowcase {
  const config = templates.find((item) => item.id === templateId) || templates[0];
  const world = createTemplateWorld(config);
  const events = templateEvents(world, config);
  attachTemplateMemories(world, events, config);
  return finishTemplate(world, events);
}

export function createCaseLibrary(): PremiumShowcase[] {
  return templates.map((template) => createCaseTemplate(template.id));
}

export function createPremiumShowcaseWorld(seed = "premium-showcase", templateId: CaseTemplateId = "archive-blunt"): PremiumShowcase {
  const selected = seed === "premium-showcase" ? templateId : templateId;
  return createCaseTemplate(selected);
}
