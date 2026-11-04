import { createTownPlayHandlers } from "./_handlers";

export const runtime = "nodejs";
const handlers = createTownPlayHandlers("riverbend", "riverbend_exploration_v1", "/api/v1/town-play");
export const GET = handlers.GET;
export const POST = handlers.POST;
