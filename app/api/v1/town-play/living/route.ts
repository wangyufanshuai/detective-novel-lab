import { createTownPlayHandlers } from "../_handlers";

export const runtime = "nodejs";
const handlers = createTownPlayHandlers("classic-living", "riverbend_classic_living_v1", "/api/v1/town-play/living");
export const GET = handlers.GET;
export const POST = handlers.POST;
