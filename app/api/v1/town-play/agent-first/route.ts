import { NextRequest, NextResponse } from "next/server";
import { readAgentFirst, startAgentFirst, actAgentFirst } from "@/lib/world/agent-first-store";
import { TownPlayError, type TownPlayCredentials } from "@/lib/world/town-exploration-store";
import { RefereeRejection } from "@/packages/engine/src/town/agent-intent";

export const runtime = "nodejs";
const COOKIE = "agent_first_visitor_v1";
function identity(request: NextRequest): TownPlayCredentials | undefined {
  const value = request.cookies.get(COOKIE)?.value;
  if (!value) return;
  const match = /^([a-f0-9-]{36})\.([a-f0-9]{64})$/.exec(value);
  if (!match) throw new TownPlayError("SESSION_FORBIDDEN", "浏览器手记无法识别。", 401);
  return { id: match[1], secret: match[2] };
}
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", "x-runtime-surface": "player" } });
function failure(error: unknown) {
  return error instanceof TownPlayError || error instanceof RefereeRejection
    ? json({ ok: false, error: { schema: "agent-first-refusal.v1", code: error.code, message: error.message } }, error.status)
    : json({ ok: false, error: { schema: "agent-first-refusal.v1", code: "SAVE_UNAVAILABLE", message: "暂时未能保存。手记已保留，请稍后重试。" } }, 500);
}
export async function GET(request: NextRequest) {
  try { const credentials = identity(request); return json({ ok: true, data: { observation: credentials ? readAgentFirst(credentials) : null, replayed: false } }); }
  catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    let origin = "";
    try { const url = new URL(request.headers.get("origin") || ""); if (["http:", "https:"].includes(url.protocol)) origin = url.host; } catch { /* reject opaque origins */ }
    if (!origin || origin !== (request.headers.get("host") || request.nextUrl.host) || !request.headers.get("content-type")?.startsWith("application/json"))
      throw new TownPlayError("ORIGIN_MISMATCH", "请从小镇页面提交行动。", 403);
    const text = await request.text();
    if (text.length > 4096) throw new TownPlayError("BAD_COMMAND", "动作内容过长。", 400);
    let body;
    try { body = JSON.parse(text); } catch { throw new TownPlayError("BAD_COMMAND", "动作无法读取。", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new TownPlayError("BAD_COMMAND", "动作无法读取。", 400);
    const credentials = identity(request);
    if (body.kind === "start" && Object.keys(body).length === 1) {
      const started = startAgentFirst(credentials);
      const response = json({ ok: true, data: { observation: started.observation, replayed: !!credentials } });
      response.cookies.set(COOKIE, `${started.credentials.id}.${started.credentials.secret}`, { httpOnly: true, sameSite: "strict", secure: request.nextUrl.protocol === "https:", path: "/api/v1/town-play/agent-first", maxAge: 60 * 60 * 24 * 365 });
      return response;
    }
    if (!credentials) throw new TownPlayError("SESSION_REQUIRED", "请先开始手记。", 401);
    if (!["propose", "commit"].includes(body.kind) || Object.keys(body).some(key => !["kind", "intent"].includes(key))) throw new TownPlayError("BAD_COMMAND", "未知的访客命令。", 400);
    return json({ ok: true, data: actAgentFirst(credentials, body.intent, body.kind) });
  } catch (error) { return failure(error); }
}
