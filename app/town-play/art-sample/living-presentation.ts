import type { TownPlayView } from "@/lib/town-play-contract";
import { CLASSIC_LIVING_ACTORS, CLASSIC_LIVING_ASSET_SHA256, CLASSIC_LIVING_REVISION, CLASSIC_LIVING_PLACES, classicWorldScene } from "@/lib/classic-living-contract";
import type { Point } from "./sample-navigation";

export const squareResidentPositions: Record<string, Point> = {
  "resident-03": [-2.7, -2.1], "resident-06": [-5, -2.1], "resident-08": [1, -2.1]
};
/** Authored visual standing places. These never authorize a visit. */
export const visitorResidentPositions: Record<string, Record<string, Point>> = {
  books: { "resident-06": [-4.7, 4.35], "resident-08": [-2.05, 2.5] },
  station: { "resident-03": [-10.2, 2.8], "resident-08": [-14.1, 2.75] },
  inn: { "resident-03": [4.4, 3.2], "resident-06": [8.15, 1.65] }
};
export function residentSceneAnchor(actor: { actorId: string; roomId: string; position: Point }, sceneId: string): Point | undefined {
  return sceneId === classicWorldScene(actor.roomId) ? actor.position : sceneId === "town-square"
    ? squareResidentPositions[actor.actorId] : visitorResidentPositions[sceneId]?.[actor.actorId];
}
export function validClassicLivingView(view: TownPlayView) {
  return view.bindingRevision === CLASSIC_LIVING_REVISION && view.assetSha256 === CLASSIC_LIVING_ASSET_SHA256;
}
/** Public observation only: last-seen entries never animate a live actor. */
export function classicResidentPresence(view: TownPlayView | null, actorId: string) {
  if (!view || !validClassicLivingView(view)) return null;
  const binding = CLASSIC_LIVING_ACTORS.find(actor => actor.actorId === actorId);
  const person = view.residents.find(person => person.actorId === actorId && person.npcId === binding?.npcId && person.visibility === "observed" && person.sceneId === view.sceneId);
  if (!binding || !person || !person.sceneId || !(CLASSIC_LIVING_PLACES as readonly string[]).includes(person.sceneId)) return null;
  return { ...person, sceneId: person.sceneId, workplace: person.sceneId === binding.sceneId, workingActionId: person.sceneId === binding.sceneId && person.work?.status === "working" ? person.work.actionId : null };
}
