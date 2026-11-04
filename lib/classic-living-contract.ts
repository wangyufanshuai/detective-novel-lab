/** Visual identities only. No schedule, private goal or case truth belongs in
 * this module, which is shared with the renderer. */
export const CLASSIC_LIVING_REVISION = "classic-living.v1";
export const CLASSIC_LIVING_ASSET_SHA256 = "4a06314a399bfb19b8fc624c60bca8fba4fa4a232941c4028fb9a52c306e29ed";
export const CLASSIC_LIVING_ENDPOINT = "/api/v1/town-play/living";
export const CLASSIC_LIVING_PLACES = ["town-square", "books", "station", "inn"] as const;
export const CLASSIC_LIVING_ACTORS = [
  { actorId: "resident-03", npcId: "rb-xu-zhiwei", roomId: "bookshop", sceneId: "books", jobId: "repair-book" },
  { actorId: "resident-06", npcId: "rb-gu-yuanshan", roomId: "station", sceneId: "station", jobId: "verify-timetable" },
  { actorId: "resident-08", npcId: "rb-lin-ali", roomId: "inn", sceneId: "inn", jobId: "reconcile-guest-register" }
] as const;
export const classicWorldScene = (roomId?: string | null) => roomId === "bookshop" ? "books" : roomId || "town-square";
