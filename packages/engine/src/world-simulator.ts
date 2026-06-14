import type {
  CaseGenerationProfile,
  DailySimulationReport,
  MemoryKind,
  MemoryRecord,
  MurderArchetype,
  NPCProfile,
  SocialPressure,
  WorldEvent,
  WorldLocation,
  WorldMode,
  WorldState
} from "./world-types";

const showcasePeople = [
  ["林澈", "镇档案员"],
  ["周岚", "药剂师"],
  ["顾沉", "旅店老板"],
  ["许真", "钟楼维修工"],
  ["赵砚", "巡夜人"],
  ["沈青禾", "花店主"],
  ["陆执", "旧剧院经理"],
  ["陈映雪", "湖畔画师"]
] as const;

const advancedPeople = [
  ...showcasePeople,
  ["方以恒", "记者"],
  ["韩照", "码头管理员"],
  ["苏晚", "诊所护士"],
  ["梁岚", "咖啡店主"],
  ["唐纪", "小学教师"],
  ["邵闻", "木匠"],
  ["白鹭", "邮差"],
  ["程澄", "图书管理员"],
  ["孟遥", "面包师"],
  ["江燃", "摄影师"],
  ["秦露", "珠宝修理师"],
  ["贺舟", "退役警员"],
  ["薛宁", "酒馆歌手"],
  ["魏景", "渔具店主"],
  ["钟离", "钟表匠"],
  ["叶檀", "植物学学生"],
  ["冯瓷", "陶艺师"],
  ["罗栖", "电台主持"],
  ["马聪", "旧货商"],
  ["戴云", "司机"],
  ["宋彦", "律师"],
  ["季衣", "剧团演员"]
] as const;

type ArchetypeSpec = {
  id: MurderArchetype;
  label: string;
  sceneLocationIds: string[];
  prepLocationId: string;
  item: string;
  prepAction: string;
  methodAction: string;
  stagingAction: string;
  traceAction: string;
  traceTitle: string;
};

const archetypes: ArchetypeSpec[] = [
  {
    id: "blade",
    label: "刀具伪装",
    sceneLocationIds: ["lake", "theater", "greenhouse"],
    prepLocationId: "market",
    item: "修缮刀",
    prepAction: "买下一把带细锯齿的修缮刀，并要求摊主不要登记姓名",
    methodAction: "用修缮刀杀害死者",
    stagingAction: "把死者怀表拨慢十五分钟，伪造死亡时间",
    traceAction: "离开现场时留下带温室红泥的鞋印",
    traceTitle: "红泥鞋印"
  },
  {
    id: "poison",
    label: "药物投毒",
    sceneLocationIds: ["inn", "clinic", "archive"],
    prepLocationId: "clinic",
    item: "镇静剂小瓶",
    prepAction: "从诊所药柜取走一瓶镇静剂，并改动夜班登记",
    methodAction: "把镇静剂混入死者随身水壶，诱发昏迷后造成死亡",
    stagingAction: "清洗水壶外壁，并把杯子摆成死者独饮的样子",
    traceAction: "袖口留下诊所消毒水味和药柜金属粉末",
    traceTitle: "药柜金属粉末"
  },
  {
    id: "blunt",
    label: "钝器误导",
    sceneLocationIds: ["theater", "archive", "market"],
    prepLocationId: "theater",
    item: "舞台配重锤",
    prepAction: "从旧剧院后台取走舞台配重锤，并用布袋遮住锤头",
    methodAction: "用配重锤击杀死者，再把现场伪装成灯架坠落",
    stagingAction: "故意撞断灯架螺丝，让现场看起来像意外事故",
    traceAction: "衣袖沾上旧剧院幕布纤维和黑色油漆",
    traceTitle: "幕布纤维"
  },
  {
    id: "fall",
    label: "坠落机关",
    sceneLocationIds: ["clocktower", "lake", "greenhouse"],
    prepLocationId: "clocktower",
    item: "松动的护栏螺栓",
    prepAction: "提前松开护栏螺栓，并把维修记录改成昨日完成",
    methodAction: "把死者引到护栏边，借松动护栏制造坠落",
    stagingAction: "把维修牌翻到安全一面，伪装成死者自己失足",
    traceAction: "工具箱里留下新鲜金属屑和带指纹的扳手",
    traceTitle: "新鲜金属屑"
  }
];

export function makeSeededRandom(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash += 0x6d2b79f5;
    let value = hash;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: T[], random: () => number) {
  return items[Math.floor(random() * items.length)];
}

function sample<T>(items: T[], count: number, random: () => number) {
  const pool = [...items];
  const result: T[] = [];
  while (pool.length && result.length < count) result.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return result;
}

export function createTownLocations(): WorldLocation[] {
  return [
    { id: "town-square", name: "雾灯广场", kind: "public", description: "小镇中心，公告栏、喷泉和巡夜登记都能留下目击线索。", connectedLocationIds: ["archive", "inn", "clocktower", "market"], x: 0, y: 0 },
    { id: "archive", name: "镇档案馆", kind: "work", description: "存放旧户籍、债务契约和失踪人口剪报。", connectedLocationIds: ["town-square", "clinic", "theater"], x: -2, y: 1 },
    { id: "inn", name: "黑松旅店", kind: "public", description: "外来者和本地人都会经过，走廊钟表常慢三分钟。", connectedLocationIds: ["town-square", "lake", "market"], x: 1, y: -1 },
    { id: "clocktower", name: "钟楼", kind: "restricted", description: "俯瞰全镇的旧钟楼，维修间里放着工具和备用电闸。", connectedLocationIds: ["town-square", "theater", "lake"], x: 1, y: 2 },
    { id: "clinic", name: "白桦诊所", kind: "work", description: "诊所药柜有严格登记，但夜间值班室常无人看守。", connectedLocationIds: ["archive", "market", "greenhouse"], x: -3, y: -1 },
    { id: "market", name: "雨棚集市", kind: "public", description: "摊贩密集，收据、脚印和短暂停留最容易被记录。", connectedLocationIds: ["town-square", "clinic", "inn"], x: -1, y: -2 },
    { id: "theater", name: "旧剧院", kind: "public", description: "后台、灯控间和排练厅互相连通，声音容易误导目击者。", connectedLocationIds: ["archive", "clocktower", "greenhouse"], x: -1, y: 3 },
    { id: "lake", name: "月牙湖码头", kind: "crime", description: "潮湿木栈道通向湖面，夜里雾气重，适合伪装行踪。", connectedLocationIds: ["inn", "clocktower", "greenhouse"], x: 3, y: 1 },
    { id: "greenhouse", name: "温室", kind: "restricted", description: "植物、泥土和化学试剂混在一起，能隐藏微量痕迹。", connectedLocationIds: ["clinic", "theater", "lake"], x: -3, y: 3 }
  ];
}

type CreateWorldOptions = {
  caseArchetype?: MurderArchetype;
  mode?: WorldMode;
  npcCount?: number;
  timelineHours?: number;
};

export function createInitialWorld(seed = "detective-town-showcase", options: CreateWorldOptions = {}): WorldState {
  const mode = options.mode || "showcase";
  const random = makeSeededRandom(seed);
  const locations = createTownLocations();
  const workLocations = locations.filter((location) => location.kind !== "home");
  const requestedNpcCount = options.npcCount || (mode === "advanced" ? 30 : 8);
  const people = mode === "advanced" || requestedNpcCount > showcasePeople.length ? advancedPeople : showcasePeople;
  const npcCount = Math.max(4, Math.min(requestedNpcCount, people.length));
  const npcs: NPCProfile[] = people.slice(0, npcCount).map(([name, role], index) => {
    const homeLocationId = `home-${index + 1}`;
    return {
      id: `npc-${String(index).padStart(2, "0")}`,
      name,
      role,
      homeLocationId,
      schedule: {
        "08:00": pick(workLocations, random).id,
        "12:00": "town-square",
        "16:00": pick(workLocations, random).id,
        "20:00": pick(workLocations, random).id,
        "23:00": homeLocationId
      },
      relationships: {},
      secret: `${name}隐瞒着一段和镇档案有关的私人交易。`,
      motiveSeed: `${name}担心自己的秘密被公开。`,
      skills: [index % 3 === 0 ? "mechanical" : "social", index % 4 === 0 ? "medicine" : "local_knowledge"],
      memoryEventIds: [],
      liePolicy: index % 2 === 0 ? "会回避与自己秘密有关的问题，但不能编造未见过的事实。" : "会淡化冲突，只承认自己亲眼见过的事。",
      alive: true
    };
  });

  for (const npc of npcs) {
    const others = sample(npcs.filter((item) => item.id !== npc.id), Math.min(4, npcs.length - 1), random);
    for (const other of others) npc.relationships[other.id] = pick(["friend", "rival", "debt", "secret"], random) as NPCProfile["relationships"][string];
  }

  const now = new Date().toISOString();
  return {
    id: `world-${seed.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}-${Date.now().toString(36)}`,
    seed,
    name: "雾灯镇",
    mode,
    timelineHours: options.timelineHours || (mode === "advanced" ? 120 : 24),
    day: 1,
    currentTime: "08:00",
    plannedArchetype: options.caseArchetype,
    locations,
    npcs,
    memories: [],
    simulationReports: [],
    createdAt: now,
    updatedAt: now
  };
}

function eventId(day: number, time: string, suffix: string) {
  return `d${day}-${time.replace(":", "")}-${suffix}`;
}

function remember(world: WorldState, event: WorldEvent) {
  for (const actorId of event.actorIds) {
    const npc = world.npcs.find((item) => item.id === actorId);
    if (npc && !npc.memoryEventIds.includes(event.id)) npc.memoryEventIds.push(event.id);
  }
  for (const relatedId of event.relatedCharacterIds) {
    const npc = world.npcs.find((item) => item.id === relatedId);
    if (npc && !npc.memoryEventIds.includes(event.id) && !event.hidden) npc.memoryEventIds.push(event.id);
  }
}

function memoryId(event: WorldEvent, npcId: string, kind: MemoryKind) {
  return `mem-${event.id}-${npcId}-${kind}`;
}

function addMemory(world: WorldState, event: WorldEvent, npcId: string, kind: MemoryKind, summary: string, options: Partial<MemoryRecord> = {}) {
  const memory: MemoryRecord = {
    id: memoryId(event, npcId, kind),
    worldId: world.id,
    npcId,
    kind,
    eventId: event.id,
    day: event.day,
    summary,
    sourceNpcId: options.sourceNpcId,
    confidence: options.confidence ?? (kind === "rumor" ? 0.55 : kind === "false" ? 0.35 : 0.9),
    visibleToPlayer: options.visibleToPlayer ?? kind !== "secret",
    challengeableEvidenceIds: options.challengeableEvidenceIds || []
  };
  if (!world.memories.some((item) => item.id === memory.id)) world.memories.push(memory);
  const npc = world.npcs.find((item) => item.id === npcId);
  if (npc && !npc.memoryEventIds.includes(event.id)) npc.memoryEventIds.push(event.id);
  return memory;
}

function locationName(world: WorldState, id: string) {
  return world.locations.find((location) => location.id === id)?.name || id;
}

export function computeSocialPressures(world: WorldState, events: WorldEvent[]): SocialPressure[] {
  const pressureByPair = new Map<string, SocialPressure>();
  function entry(npcId: string, targetId: string) {
    const key = `${npcId}->${targetId}`;
    const existing = pressureByPair.get(key);
    if (existing) return existing;
    const created: SocialPressure = { npcId, targetId, secretRisk: 0, relationshipTension: 0, opportunityWindow: 0, meansAccess: 0, score: 0, sourceEventIds: [] };
    pressureByPair.set(key, created);
    return created;
  }
  for (const event of events) {
    if (event.actorIds.length < 2 && event.relatedCharacterIds.length < 2) continue;
    const actor = event.actorIds[0];
    const target = event.actorIds[1] || event.relatedCharacterIds.find((id) => id !== actor);
    if (!actor || !target) continue;
    const pressure = entry(actor, target);
    if (event.tags.includes("secret_leak")) pressure.secretRisk += 4;
    if (event.tags.includes("tension") || event.type === "conflict") pressure.relationshipTension += 3;
    if (event.tags.includes("means_access")) pressure.meansAccess += 2;
    if (event.type === "move" || event.tags.includes("opportunity_window")) pressure.opportunityWindow += 1;
    if (!pressure.sourceEventIds.includes(event.id)) pressure.sourceEventIds.push(event.id);
  }
  for (const pressure of pressureByPair.values()) pressure.score = pressure.secretRisk + pressure.relationshipTension + pressure.opportunityWindow + pressure.meansAccess;
  return Array.from(pressureByPair.values()).sort((a, b) => b.score - a.score);
}

export function simulateDailyLife(world: WorldState, days = 1, previousEvents: WorldEvent[] = []) {
  const nextWorld: WorldState = JSON.parse(JSON.stringify(world));
  nextWorld.memories ||= [];
  nextWorld.simulationReports ||= [];
  const events: WorldEvent[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const day = nextWorld.day;
    const random = makeSeededRandom(`${nextWorld.seed}:daily:${day}`);
    const dayEvents: WorldEvent[] = [];
    const living = nextWorld.npcs.filter((npc) => npc.alive);
    const pairs = sample(living, Math.min(nextWorld.mode === "advanced" ? 10 : 6, living.length), random);

    pairs.forEach((npc, index) => {
      const other = pick(living.filter((item) => item.id !== npc.id), random);
      const location = pick(nextWorld.locations, random);
      const tension = npc.relationships[other.id] === "rival" || npc.relationships[other.id] === "debt" || random() > 0.62;
      const leak = npc.relationships[other.id] === "secret" || random() > 0.78;
      const type = leak ? "conversation" : tension ? "conflict" : "conversation";
      const time = `${String(9 + index).padStart(2, "0")}:20`;
      const id = eventId(day, time, `${npc.id}-${other.id}-daily`);
      const event: WorldEvent = {
        id,
        worldId: nextWorld.id,
        day,
        time,
        type,
        actorIds: [npc.id, other.id],
        locationId: location.id,
        summary: leak ? `${other.name}听见${npc.name}的秘密可能被旧档案牵出。` : tension ? `${npc.name}和${other.name}在${location.name}发生争执。` : `${npc.name}和${other.name}在${location.name}交换了镇上近况。`,
        publicSummary: tension ? `${location.name}有人发生争执。` : `${location.name}有人交谈。`,
        hidden: leak,
        relatedCharacterIds: [npc.id, other.id],
        tags: [leak ? "secret_leak" : tension ? "tension" : "social", random() > 0.7 ? "rumor" : "direct", location.kind === "restricted" || location.kind === "work" ? "means_access" : "opportunity_window"],
        goalId: `goal-${npc.id}-protect-secret`,
        intentId: `intent-${id}`,
        causedByEventIds: [],
        explanation: leak ? `${npc.name}的秘密风险上升，后续可能转化为动机。` : `${npc.name}的日常关系事件被写入世界日志。`
      };
      dayEvents.push(event);
      remember(nextWorld, event);
      addMemory(nextWorld, event, npc.id, leak ? "secret" : "direct", event.summary, { confidence: 0.9, visibleToPlayer: !leak });
      addMemory(nextWorld, event, other.id, leak ? "rumor" : tension ? "direct" : "rumor", event.summary, { sourceNpcId: npc.id, confidence: leak ? 0.62 : tension ? 0.82 : 0.55, visibleToPlayer: !leak });
    });

    const pressures = computeSocialPressures(nextWorld, [...previousEvents, ...events, ...dayEvents]);
    const memoryIds = nextWorld.memories.filter((memory) => memory.day === day).map((memory) => memory.id);
    const report: DailySimulationReport = { day, eventIds: dayEvents.map((event) => event.id), memoryIds, topPressures: pressures.slice(0, 5) };
    nextWorld.simulationReports.push(report);
    events.push(...dayEvents);
    if (days > 1 || nextWorld.mode === "advanced") nextWorld.day += 1;
  }
  nextWorld.currentTime = "08:00";
  nextWorld.updatedAt = new Date().toISOString();
  return { world: nextWorld, events, reports: nextWorld.simulationReports.slice(-days) };
}

export function buildCaseGenerationProfile(world: WorldState): CaseGenerationProfile {
  const random = makeSeededRandom(`${world.seed}:case:${world.day}`);
  const spec = world.plannedArchetype ? archetypes.find((item) => item.id === world.plannedArchetype) || archetypes[0] : pick(archetypes, random);
  const living = world.npcs.filter((npc) => npc.alive);
  const pressures = world.simulationReports?.length ? world.simulationReports.flatMap((report) => report.topPressures).sort((a, b) => b.score - a.score) : computeSocialPressures(world, []);
  const selectedPressure = pressures.find((pressure) => living.some((npc) => npc.id === pressure.npcId) && living.some((npc) => npc.id === pressure.targetId) && pressure.score >= 5);
  const culprit = selectedPressure ? world.npcs.find((npc) => npc.id === selectedPressure.npcId)! : pick(living, random);
  const victim = selectedPressure ? world.npcs.find((npc) => npc.id === selectedPressure.targetId)! : pick(living.filter((npc) => npc.id !== culprit.id), random);
  const witness = pick(living.filter((npc) => npc.id !== victim.id && npc.id !== culprit.id), random);
  const pool = living.filter((npc) => ![victim.id, culprit.id, witness.id].includes(npc.id));
  const focusSuspects = sample(pool, Math.min(3, pool.length), random).map((npc) => npc.id);
  const sceneLocationId = pick(spec.sceneLocationIds, random);
  return {
    seed: world.seed,
    archetype: spec.id,
    victimId: victim.id,
    culpritId: culprit.id,
    witnessId: witness.id,
    focusSuspectIds: focusSuspects,
    sceneLocationId,
    prepLocationId: spec.prepLocationId,
    motiveEventId: eventId(world.day, "20:20", "secret-leak"),
    meansEventId: eventId(world.day, "18:10", "means-prep"),
    opportunityEventId: eventId(world.day, "21:30", "witness-opportunity"),
    deathEventId: eventId(world.day, "21:47", "death"),
    stagingEventId: eventId(world.day, "21:55", "staging"),
    traceEventId: eventId(world.day, "22:05", "trace"),
    groupAlibiEventId: eventId(world.day, "21:46", "town-rollcall"),
    decisiveEvidenceIds: ["ev-means", "ev-motive", "ev-opportunity", "ev-staging", "ev-trace"]
  };
}

function addEventMemoryForActors(world: WorldState, event: WorldEvent, culpritId: string, witnessId: string) {
  remember(world, event);
  for (const actorId of event.actorIds) {
    const kind: MemoryKind = actorId === culpritId && event.hidden ? "secret" : "direct";
    const memorySummary = kind === "secret" ? event.summary : event.publicSummary;
    addMemory(world, event, actorId, kind, memorySummary, { confidence: actorId === culpritId ? 1 : 0.85, visibleToPlayer: kind !== "secret", challengeableEvidenceIds: event.evidenceId ? [event.evidenceId] : [] });
  }
  if (event.relatedCharacterIds.includes(witnessId) && !event.actorIds.includes(witnessId)) {
    addMemory(world, event, witnessId, "direct", event.publicSummary, { confidence: 0.85, visibleToPlayer: true, challengeableEvidenceIds: event.evidenceId ? [event.evidenceId] : [] });
  }
}

export function simulateWorldTick(world: WorldState, previousEvents: WorldEvent[] = []) {
  const nextWorld: WorldState = JSON.parse(JSON.stringify(world));
  nextWorld.memories ||= [];
  nextWorld.simulationReports ||= [];
  const events: WorldEvent[] = [];
  const random = makeSeededRandom(`${world.seed}:${world.day}:${previousEvents.length}`);
  const hasDeath = previousEvents.some((event) => event.type === "death");
  const times = ["08:00", "12:00", "16:00", "20:00", "23:00"];

  for (const time of times) {
    for (const npc of nextWorld.npcs.filter((item) => item.alive)) {
      const locationId = npc.schedule[time] || "town-square";
      const id = eventId(nextWorld.day, time, `${npc.id}-move`);
      const event: WorldEvent = {
        id,
        worldId: nextWorld.id,
        day: nextWorld.day,
        time,
        type: "move",
        actorIds: [npc.id],
        locationId,
        summary: `${npc.name}按日程来到${locationName(nextWorld, locationId)}。`,
        publicSummary: `${npc.name}在 ${time} 左右出现在${locationName(nextWorld, locationId)}。`,
        hidden: false,
        relatedCharacterIds: [npc.id],
        tags: ["schedule"],
        goalId: `goal-${npc.id}-protect-secret`,
        intentId: `intent-${id}`,
        explanation: "日程事件提供后续可达性和不在场判断。"
      };
      events.push(event);
      remember(nextWorld, event);
      addMemory(nextWorld, event, npc.id, "direct", event.publicSummary, { visibleToPlayer: true });
    }
  }

  if (!hasDeath) {
    const profile = buildCaseGenerationProfile(nextWorld);
    const spec = archetypes.find((item) => item.id === profile.archetype) || archetypes[0];
    const culprit = nextWorld.npcs.find((npc) => npc.id === profile.culpritId)!;
    const victim = nextWorld.npcs.find((npc) => npc.id === profile.victimId)!;
    const witness = nextWorld.npcs.find((npc) => npc.id === profile.witnessId)!;
    const focusSuspects = nextWorld.npcs.filter((npc) => profile.focusSuspectIds.includes(npc.id));
    const sceneName = locationName(nextWorld, profile.sceneLocationId);
    const prepName = locationName(nextWorld, profile.prepLocationId);
    const priorPressure = nextWorld.simulationReports.flatMap((report) => report.topPressures).find((pressure) => pressure.npcId === culprit.id && pressure.targetId === victim.id);
    const pressureCause = priorPressure?.sourceEventIds[0];

    const murderEvents: WorldEvent[] = [
      {
        id: profile.meansEventId,
        worldId: nextWorld.id,
        day: nextWorld.day,
        time: "18:10",
        type: "obtain_item",
        actorIds: [culprit.id],
        locationId: profile.prepLocationId,
        summary: `${culprit.name}在${prepName}${spec.prepAction}。`,
        publicSummary: `${prepName}出现一条和${spec.item}有关的异常记录。`,
        hidden: true,
        evidenceId: "ev-means",
        relatedCharacterIds: [culprit.id],
        tags: ["prep", "means", spec.id],
        goalId: `goal-${culprit.id}-protect-secret`,
        intentId: `intent-${profile.meansEventId}`,
        causedByEventIds: pressureCause ? [pressureCause] : [],
        explanation: "秘密风险促使凶手提前准备可用手段。"
      },
      {
        id: profile.motiveEventId,
        worldId: nextWorld.id,
        day: nextWorld.day,
        time: "20:20",
        type: "conflict",
        actorIds: [culprit.id, victim.id],
        locationId: "archive",
        summary: `${victim.name}告诉${culprit.name}，明早会公开一份足以暴露其秘密的旧档案。`,
        publicSummary: "镇档案馆夜间传出争执，内容与旧档案有关。",
        hidden: true,
        evidenceId: "ev-motive",
        relatedCharacterIds: [culprit.id, victim.id],
        tags: ["secret_leak", "motive", "suspicion"],
        goalId: `goal-${culprit.id}-protect-secret`,
        intentId: `intent-${profile.motiveEventId}`,
        causedByEventIds: pressureCause ? [pressureCause] : [profile.meansEventId],
        explanation: "死者掌握秘密，动机从风险升级为直接冲突。"
      },
      {
        id: profile.opportunityEventId,
        worldId: nextWorld.id,
        day: nextWorld.day,
        time: "21:30",
        type: "witness",
        actorIds: [witness.id],
        locationId: witness.schedule["20:00"] || "town-square",
        summary: `${witness.name}看见${culprit.name}在案发窗口前往${sceneName}方向。`,
        publicSummary: `${witness.name}声称夜雾中有人接近${sceneName}，最初没有说出姓名。`,
        hidden: false,
        evidenceId: "ev-opportunity",
        relatedCharacterIds: [culprit.id, witness.id],
        tags: ["witness", "opportunity"],
        goalId: `goal-${culprit.id}-protect-secret`,
        intentId: `intent-${profile.opportunityEventId}`,
        causedByEventIds: [profile.motiveEventId],
        explanation: "冲突后凶手移动到案发地点，形成机会。"
      },
      {
        id: profile.deathEventId,
        worldId: nextWorld.id,
        day: nextWorld.day,
        time: "21:47",
        type: "death",
        actorIds: [culprit.id, victim.id],
        locationId: profile.sceneLocationId,
        summary: `${culprit.name}在${sceneName}${spec.methodAction}。`,
        publicSummary: `${victim.name}被发现死在${sceneName}。`,
        hidden: true,
        evidenceId: "ev-death-scene",
        relatedCharacterIds: [culprit.id, victim.id],
        tags: ["murder", spec.id],
        goalId: `goal-${culprit.id}-protect-secret`,
        intentId: `intent-${profile.deathEventId}`,
        causedByEventIds: [profile.meansEventId, profile.motiveEventId, profile.opportunityEventId],
        explanation: "动机、手段和机会汇合，案件从世界行为中发生。"
      },
      {
        id: profile.stagingEventId,
        worldId: nextWorld.id,
        day: nextWorld.day,
        time: "21:55",
        type: "destroy_evidence",
        actorIds: [culprit.id],
        locationId: profile.sceneLocationId,
        summary: `${culprit.name}${spec.stagingAction}。`,
        publicSummary: `${sceneName}有一处明显但解释不完整的现场摆放痕迹。`,
        hidden: true,
        evidenceId: "ev-staging",
        relatedCharacterIds: [culprit.id],
        tags: ["staging", "time-trick", spec.id],
        goalId: `goal-${culprit.id}-protect-secret`,
        intentId: `intent-${profile.stagingEventId}`,
        causedByEventIds: [profile.deathEventId],
        explanation: "凶手试图把真实犯罪伪装成另一种事件。"
      },
      {
        id: profile.traceEventId,
        worldId: nextWorld.id,
        day: nextWorld.day,
        time: "22:05",
        type: "forensic_clue",
        actorIds: [culprit.id],
        locationId: profile.sceneLocationId,
        summary: `${culprit.name}${spec.traceAction}。`,
        publicSummary: `${sceneName}发现${spec.traceTitle}，与公开说法不一致。`,
        hidden: false,
        evidenceId: "ev-trace",
        relatedCharacterIds: [culprit.id],
        tags: ["trace", "forensic", spec.id],
        goalId: `goal-${culprit.id}-protect-secret`,
        intentId: `intent-${profile.traceEventId}`,
        causedByEventIds: [profile.stagingEventId],
        explanation: "伪装行为留下反证，成为玩家可发现的关键线索。"
      }
    ];
    events.push(...murderEvents);
    victim.alive = false;
    for (const event of murderEvents) addEventMemoryForActors(nextWorld, event, culprit.id, witness.id);

    focusSuspects.forEach((npc, index) => {
      const location = pick(nextWorld.locations.filter((item) => item.id !== profile.sceneLocationId), random);
      const id = eventId(nextWorld.day, "21:45", `${npc.id}-focus-alibi`);
      const event: WorldEvent = {
        id,
        worldId: nextWorld.id,
        day: nextWorld.day,
        time: "21:45",
        type: "alibi",
        actorIds: [npc.id],
        locationId: location.id,
        summary: `${npc.name}在案发窗口被记录在${location.name}，无法同时出现在${sceneName}。`,
        publicSummary: `${npc.name}有一条可查的不在场记录。`,
        hidden: false,
        evidenceId: `ev-focus-alibi-${index + 1}`,
        relatedCharacterIds: [npc.id],
        tags: ["alibi", "exclusion", "focus_suspect"],
        goalId: `goal-${npc.id}-protect-secret`,
        intentId: `intent-${id}`,
        causedByEventIds: [],
        explanation: "表面嫌疑人被独立世界事件排除。"
      };
      events.push(event);
      remember(nextWorld, event);
      addMemory(nextWorld, event, npc.id, "direct", event.summary, { visibleToPlayer: true, challengeableEvidenceIds: [event.evidenceId!] });
    });

    const rollcallActors = nextWorld.npcs
      .filter((npc) => npc.alive && ![profile.culpritId, profile.victimId, profile.witnessId, ...profile.focusSuspectIds].includes(npc.id))
      .map((npc) => npc.id);
    const rollcall: WorldEvent = {
      id: profile.groupAlibiEventId,
      worldId: nextWorld.id,
      day: nextWorld.day,
      time: "21:46",
      type: "alibi",
      actorIds: rollcallActors,
      locationId: "town-square",
      summary: `巡夜登记显示，多数居民在案发窗口集中于雾灯广场避雨，无法同时出现在${sceneName}。`,
      publicSummary: "雾灯广场的巡夜登记能一次性排除多数路人嫌疑。",
      hidden: false,
      evidenceId: "ev-town-rollcall",
      relatedCharacterIds: rollcallActors,
      tags: ["alibi", "exclusion", "group_alibi"],
      intentId: `intent-${profile.groupAlibiEventId}`,
      explanation: "公共登记为非凶手建立可发现的排除链。"
    };
    events.push(rollcall);
    remember(nextWorld, rollcall);
    for (const actorId of rollcallActors) addMemory(nextWorld, rollcall, actorId, "direct", rollcall.summary, { visibleToPlayer: true, challengeableEvidenceIds: ["ev-town-rollcall"] });
  }

  nextWorld.day += 1;
  nextWorld.currentTime = "08:00";
  nextWorld.updatedAt = new Date().toISOString();
  return { world: nextWorld, events };
}
