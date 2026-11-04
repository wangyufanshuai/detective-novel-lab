/** Public v12 transport. Built only from the existing player-safe projection. */
import type { townExplorationPlayerView } from "../town-exploration";

export const EXPLORATION_PLACES = [
  { id: "town-square", name: "河湾广场", hint: "街坊们在这里碰面。", x: 530, y: 518, w: 0, h: 0, color: "#777b64" },
  { id: "inn", name: "桥畔旅馆", hint: "登记簿、旅行箱和还亮着的灯。", x: 210, y: 565, w: 168, h: 102, color: "#925b4e" },
  { id: "station", name: "河湾车站", hint: "站员在核对早班列车的记录。", x: 190, y: 306, w: 224, h: 92, color: "#5c7275" },
  { id: "cafe", name: "河湾咖啡馆", hint: "等第一壶咖啡的人已经来了。", x: 450, y: 323, w: 150, h: 96, color: "#6b7652" },
  { id: "books", name: "旧书店", hint: "旧地图与尚未装订完的书页。", x: 730, y: 310, w: 176, h: 118, color: "#78604c" },
] as const;
export type ExplorationPlaceId = typeof EXPLORATION_PLACES[number]["id"];
export type ExplorationObservation = {
  schema: "agent-first-observation.v1";
  worldId: string; sessionId: string; revision: number; worldRevision: number; bindingRevision: string;
  sourceRef: string; day: number; time: string; sceneId: string;
  places: Array<{ id: ExplorationPlaceId; name: string; hint: string }>;
  residents: Array<{ id: string; name: string; role: string; visibility: "observed" | "last-seen";
    sceneId: string | null; locationName: string; day: number; time: string; activity?: string }>;
  simulation: { policy: "existing-rules"; residentCount: 12; modelCalls: 0|null };
  life?: { schema:"town-resident-life.v1"; elapsedMinutes:number; remainingMinutes:number; plannerMode:"rules"|"offline-agent"; proposalCount:number; modelCalls:0|null; modelAttemptsReserved:number };
};
export function observationRef(view: { sessionId: string; revision: number; worldRevision: number }) {
  return `observation:${view.sessionId}:${view.revision}:${view.worldRevision}`;
}
export function projectExplorationObservation(view: ReturnType<typeof townExplorationPlayerView> & {residentLife?:ExplorationObservation["life"]}): ExplorationObservation {
  return {
    schema: "agent-first-observation.v1", worldId: view.worldId, sessionId: view.sessionId,
    revision: view.revision, worldRevision: view.worldRevision, bindingRevision: view.bindingRevision,
    sourceRef: observationRef(view), day: view.day, time: view.time, sceneId: view.sceneId || "town-square",
    places: EXPLORATION_PLACES.map(({ id, name, hint }) => ({ id, name, hint })),
    residents: view.residents.map(person => ({ id: person.npcId, name: person.name, role: person.role,
      visibility: person.visibility, sceneId: person.sceneId, locationName: person.locationName,
      day: person.day, time: person.time, ...(person.visibility === "observed" && (person.activity||person.work) ? { activity:person.activity??person.work!.label } : {}) })),
    simulation: { policy: "existing-rules", residentCount: 12, modelCalls: view.residentLife?.modelCalls ?? (view.residentLife?.modelAttemptsReserved ? null : 0) },
    ...(view.residentLife?{life:{schema:view.residentLife.schema,elapsedMinutes:view.residentLife.elapsedMinutes,remainingMinutes:view.residentLife.remainingMinutes,plannerMode:view.residentLife.plannerMode,proposalCount:view.residentLife.proposalCount,modelCalls:view.residentLife.modelCalls,modelAttemptsReserved:view.residentLife.modelAttemptsReserved}}:{}),
  };
}
