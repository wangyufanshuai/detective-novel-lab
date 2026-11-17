import { createPersistentTownRuntime, type PersistentTownRuntime } from "./persistent-town";
import { createTownMapPackFromWorld } from "./town-map-pack";
import { validateTownExplorationBinding, type TownExplorationBinding } from "./town-exploration";
import type { NPCProfile, WorldLocation, WorldState } from "./world-types";

/** Original authoring candidate. This module contains private resident material;
 * player APIs must use townExplorationPlayerView, never return this bundle.
 * Authored schedules are intentions, not proof the agent runtime follows them.
 */
export const RIVERBEND_WORLD_REVISION = "riverbend-world.v1";
/** Riverbend play runs three days, from day 1 08:00 to day 4 08:00, in 5-minute
 * ticks. Nights pass by resting at the inn. Saves from the one-day release are
 * raised to this window when they next act; nothing else about them changes. */
export const RIVERBEND_PLAY_DAYS = 3;
export const RIVERBEND_PLAY_TICKS = RIVERBEND_PLAY_DAYS * 288;
export const RIVERBEND_ASSET_SHA256 = "763d45d4c549d51e96953ffc099950dd2511d31c1567d9bf9686ee6e687acbc3";
export const RIVERBEND_VISITABLE_SCENES = ["cafe", "books", "police", "station", "post", "inn"] as const;

const places: Array<[string, string, WorldLocation["kind"], number, number, string]> = [
  ["town-square", "河湾广场", "public", 0, -7, "河桥连着广场。咖啡馆与书店朝南开门，警务所的钟楼从河岸就能看见。"],
  ["cafe", "河湾咖啡馆", "work", -10, 5, "绿白遮阳篷下摆着小圆桌，早班旅客在这里等第一壶咖啡。"],
  ["books", "旧书店", "work", .3, 6.7, "临街书架摆着旧地图，后面的修复桌常年压着没有装订完的书页。"],
  ["police", "警务所", "work", 12, 6.25, "值班桌后挂着街区图，门前钟楼报时，居民可以在此查阅公开告示。"],
  ["station", "河湾车站", "public", -26, 10.5, "低矮站房外停着自行车，行李单与发车钟构成小镇另一套时间。"],
  ["post", "邮局", "work", 25.8, 8.1, "分拣台位于街区东端，门前的人常谈起迟到的信和离镇的亲人。"],
  ["inn", "桥畔旅馆", "public", -25, -9, "面向河桥的小旅馆，老板把来客的伞收在门廊里。"],
  ["house-east", "河畔民居", "home", 26, -3.9, "河岸东面的合住民居。当前只作为生活地点，尚未开放室内。"],
  ["house-north-a", "书店后巷住宅", "home", -12, 23, "咖啡馆后巷的小住宅，楼下有邻居共用的杂物柜。"],
  ["house-north-b", "广场后巷住宅", "home", -3, 23.3, "书店后方的住宅，晚间能听见广场最后一班自行车铃。"],
  ["house-north-c", "邮局后巷住宅", "home", 11.3, 23.8, "警务所北侧的砖墙住宅，住户沿后巷去邮局和车站。"]
];
// Authored story-time costs, not metres divided by walking speed. The client
// walks the real GLB streets; these edges charge authoritative investigation time.
const roads: Array<[string, string, number]> = [
  ["town-square", "cafe", 5], ["town-square", "books", 5], ["town-square", "police", 5],
  ["town-square", "station", 10], ["town-square", "post", 10], ["town-square", "inn", 5],
  ["cafe", "books", 5], ["books", "police", 5], ["cafe", "station", 5], ["police", "post", 5],
  ["station", "inn", 5], ["post", "house-east", 5], ["cafe", "house-north-a", 5],
  ["books", "house-north-b", 5], ["police", "house-north-c", 5],
  ["house-north-a", "house-north-b", 5], ["house-north-b", "house-north-c", 5]
];

type Resident = { actorId: string; id: string; name: string; role: string; home: string; work: string; noon: string; afternoon: string; secret: string; concern: string; skills: string[]; relations: NPCProfile["relationships"] };
const residents: Resident[] = [
  { actorId: "resident-01", id: "rb-song-tang", name: "宋棠", role: "咖啡馆店主", home: "house-north-a", work: "cafe", noon: "cafe", afternoon: "post", secret: "把妹妹寄回的钱垫进了咖啡馆租金，一直没写回信说明。", concern: "担心失去店面，也担心被妹妹误解。", skills: ["hospitality", "local_knowledge"], relations: { "rb-zhou-yan": "friend", "rb-jiang-zhi": "friend" } },
  { actorId: "resident-02", id: "rb-zhou-yan", name: "周砚", role: "投递员", home: "house-north-c", work: "post", noon: "cafe", afternoon: "station", secret: "私下替年迈住户读信，从未向分拣员说明谁请他帮过忙。", concern: "不愿让别人的私事成为街谈。", skills: ["local_knowledge", "cycling"], relations: { "rb-chen-hui": "friend", "rb-song-tang": "friend" } },
  { actorId: "resident-03", id: "rb-xu-zhiwei", name: "许知微", role: "旧书修复师", home: "house-north-b", work: "books", noon: "town-square", afternoon: "books", secret: "一张旧地图上的注记出自她的祖父，她尚未决定是否公开这层关系。", concern: "希望修复记录保留原貌，而不是迎合收藏商。", skills: ["book_repair", "handwriting"], relations: { "rb-jiang-zhi": "friend", "rb-shen-ying": "rival" } },
  { actorId: "resident-04", id: "rb-lu-xingzhou", name: "陆行舟", role: "值班警员", home: "house-north-c", work: "police", noon: "town-square", afternoon: "station", secret: "上周未及时处理一份匿名报失单，准备下班前补查。", concern: "想把遗漏查清，也怕被认为偏袒熟人。", skills: ["investigation", "local_knowledge"], relations: { "rb-gu-yuanshan": "friend", "rb-han-shuo": "friend" } },
  { actorId: "resident-05", id: "rb-chen-hui", name: "陈蕙", role: "邮局分拣员", home: "house-north-c", work: "post", noon: "town-square", afternoon: "post", secret: "珍藏着一封没有寄出的辞职信，信上写着她真正想去的城市。", concern: "害怕一辈子替别人安排离别，自己却始终没有出发。", skills: ["records", "sorting"], relations: { "rb-zhou-yan": "friend", "rb-gu-yuanshan": "family" } },
  { actorId: "resident-06", id: "rb-gu-yuanshan", name: "顾远山", role: "车站值班员", home: "house-north-c", work: "station", noon: "station", afternoon: "police", secret: "保留了一本已经作废的列车时刻册，用来记往年离镇的人。", concern: "不想车站被人当成只有离开才有价值的地方。", skills: ["records", "mechanical"], relations: { "rb-chen-hui": "family", "rb-lu-xingzhou": "friend" } },
  { actorId: "resident-07", id: "rb-bai-lu", name: "白露", role: "花摊摊主", home: "house-east", work: "town-square", noon: "cafe", afternoon: "inn", secret: "欠旅馆老板一笔育苗钱，交货失败后尚未凑齐。", concern: "希望花摊能留下来，不愿被看作只会许诺的人。", skills: ["gardening", "trade"], relations: { "rb-lin-ali": "debt", "rb-cheng-du": "friend" } },
  { actorId: "resident-08", id: "rb-lin-ali", name: "林阿梨", role: "旅馆老板", home: "inn", work: "inn", noon: "inn", afternoon: "post", secret: "替一位不愿留下姓名的客人保管着行李，承诺等他本人来取。", concern: "在守信用和配合调查之间拿不定主意。", skills: ["hospitality", "records"], relations: { "rb-bai-lu": "debt", "rb-shen-ying": "friend" } },
  { actorId: "resident-09", id: "rb-cheng-du", name: "程渡", role: "桥梁木工", home: "house-east", work: "town-square", noon: "cafe", afternoon: "station", secret: "偷偷替邻居修过不在工单上的栏杆，费用全记在自己的账里。", concern: "怕好意被当成账目不清，也担心桥迟迟无人正式验收。", skills: ["carpentry", "mechanical"], relations: { "rb-han-shuo": "friend", "rb-bai-lu": "friend" } },
  { actorId: "resident-10", id: "rb-shen-ying", name: "沈映", role: "地方记者", home: "inn", work: "town-square", noon: "books", afternoon: "police", secret: "她来河湾既是采访，也是为了查明母亲留下的一句旧话。", concern: "不愿把居民变成报道的材料，却又急于写出自己的第一篇长文。", skills: ["interview", "photography"], relations: { "rb-xu-zhiwei": "rival", "rb-lin-ali": "friend" } },
  { actorId: "resident-11", id: "rb-han-shuo", name: "韩朔", role: "钟表维修工", home: "house-north-b", work: "police", noon: "town-square", afternoon: "books", secret: "有一次把钟楼的校时误差先记在便笺上，忘了补进正式登记。", concern: "希望大家相信记录能够纠正，而不是一有差错就作废。", skills: ["mechanical", "clock_repair"], relations: { "rb-cheng-du": "friend", "rb-lu-xingzhou": "friend" } },
  { actorId: "resident-12", id: "rb-jiang-zhi", name: "江芷", role: "退休教师", home: "house-north-a", work: "cafe", noon: "books", afternoon: "town-square", secret: "她给旧学生写过一封很严厉的信，至今想当面道歉。", concern: "担心自己的记忆正在替别人改写过去。", skills: ["history", "handwriting"], relations: { "rb-song-tang": "friend", "rb-xu-zhiwei": "friend" } }
];

export function createRiverbendWorld(input: { worldId: string; now: string; seed?:string }) {
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(input.worldId) || !Number.isFinite(Date.parse(input.now))) throw new Error("Riverbend needs a stable world identity and timestamp");
  if(input.seed!==undefined&&(!input.seed.trim()||input.seed.length>120))throw new Error("Riverbend seed must be nonempty and bounded");
  const locations = places.map(([id, name, kind, x, y, description]): WorldLocation => ({
    id, name, kind, x, y, description,
    connectedLocationIds: roads.flatMap(([from, to]) => from === id ? [to] : to === id ? [from] : [])
  }));
  const npcs: NPCProfile[] = residents.map(person => ({
    id: person.id, name: person.name, role: person.role, homeLocationId: person.home,
    schedule: { "00:00": person.home, "08:00": person.work, "12:00": person.noon, "14:00": person.work, "16:00": person.afternoon, "19:00": person.home, "23:00": person.home },
    relationships: { ...person.relations }, secret: person.secret, motiveSeed: person.concern,
    skills: [...person.skills], memoryEventIds: [], alive: true,
    liePolicy: "可以回避自己的私事；不得把未见过的事情说成亲眼所见。被证据质疑时，区分记错、隐瞒和确知。"
  }));
  const world: WorldState = { id: input.worldId, seed: input.seed??"riverbend-original-v1", name: "河湾", mode: "showcase", timelineHours: 24, day: 1, currentTime: "08:00", locations, npcs, memories: [], simulationReports: [], createdAt: input.now, updatedAt: input.now };
  const map = createTownMapPackFromWorld(world, { id: "riverbend-town-v1", name: "河湾街区", description: "原创河湾生活地点；住宅尚无玩家室内通行验收。" });
  map.manifest.createdAt = input.now;
  map.connections = roads.map(([from, to, travelMinutes]) => ({ from, to, kind: "street", travelMinutes }));
  map.interactions = map.interactions.filter(interaction => (RIVERBEND_VISITABLE_SCENES as readonly string[]).includes(interaction.locationId));
  const binding: TownExplorationBinding = {
    schema: "town-exploration-binding.v1", worldId: world.id, mapId: map.manifest.id,
    revision: RIVERBEND_WORLD_REVISION, assetSha256: RIVERBEND_ASSET_SHA256, initialLocationId: "town-square",
    places: locations.map(location => ({ sceneId: location.id, locationId: location.id })),
    residents: residents.map(person => ({ actorId: person.actorId, npcId: person.id }))
  };
  validateTownExplorationBinding(world, map, binding);
  const runtime = createPersistentTownRuntime(world, [], { tickIntervalMinutes: 5, maxTicks: RIVERBEND_PLAY_TICKS, caseTriggerPolicy: "source-signaled", now: input.now });
  runtime.currentMapPackId = map.manifest.id;
  runtime.mapPacks = [map];
  if (runtime.currentExperiment) runtime.currentExperiment.mapPackId = map.manifest.id;
  runtime.commandRevision = 0;
  runtime.dailyRoutine = { schema: "town-daily-routine.v1", enabled: true, mapId: map.manifest.id, lastTick: 0, journeys: {}, holds: {} };
  runtime.eventIdentityPolicy = "world-scoped";
  return { world: { ...world, persistentRuntime: runtime } as WorldState & { persistentRuntime: PersistentTownRuntime }, map, binding };
}
