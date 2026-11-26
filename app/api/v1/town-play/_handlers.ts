import { NextRequest, NextResponse } from "next/server";
import { commandTownPlay, commandTownWorkStep, readTownPlay, startTownPlay, TownPlayError, type TownPlayCredentials, type TownPlayProfile } from "@/lib/world/town-exploration-store";
import type { TownPlayCommand } from "@/lib/town-play-contract";

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store", "x-runtime-surface": "player" } });
}
function failure(error: unknown) {
  return error instanceof TownPlayError
    ? json({ ok: false, error: { code: error.code, message: error.message } }, error.status)
    : json({ ok: false, error: { code: "SAVE_UNAVAILABLE", message: "小镇暂时未能完成保存。原手记已保留，请稍后重试。" } }, 500);
}
export function createTownPlayHandlers(profile: TownPlayProfile, cookieName: string, cookiePath: string) {
  function identity(request: NextRequest): TownPlayCredentials | undefined {
    const value = request.cookies.get(cookieName)?.value;
    if (!value) return undefined;
    const match = /^([a-f0-9-]{36})\.([a-f0-9]{64})$/.exec(value);
    if (!match) throw new TownPlayError("SESSION_FORBIDDEN", "这份浏览器手记暂时无法识别。", 401);
    return { id: match[1], secret: match[2] };
  }
  return {
    async GET(request: NextRequest) {
      try {
        const credentials = identity(request);
        return json({ ok: true, data: { view: credentials ? readTownPlay(credentials, profile) : null, replayed: false } });
      } catch (error) { return failure(error); }
    },
    async POST(request: NextRequest) {
      try {
        // Use the browser's destination Host; Next can normalize its internal URL.
        let originHost = "";
        try { const url = new URL(request.headers.get("origin") || ""); if (["http:", "https:"].includes(url.protocol)) originHost = url.host; } catch { /* Opaque or absent origins are rejected. */ }
        if (!originHost || originHost !== (request.headers.get("host") || request.nextUrl.host) || !request.headers.get("content-type")?.startsWith("application/json")) throw new TownPlayError("ORIGIN_MISMATCH", "请从小镇页面完成这个动作。", 403);
        const raw = await request.text();
        if (raw.length > 4096) throw new TownPlayError("BAD_COMMAND", "动作内容过长。", 400);
        let body: Record<string, unknown>;
        try { body = JSON.parse(raw); } catch { throw new TownPlayError("BAD_COMMAND", "动作内容未能读取。", 400); }
        if (!body || typeof body !== "object" || Array.isArray(body)) throw new TownPlayError("BAD_COMMAND", "动作内容未能读取。", 400);
        const credentials = identity(request);
        if (body.kind === "start") {
          const started = startTownPlay(credentials, profile, body.fresh === true);
          const response = json({ ok: true, data: started.result });
          response.cookies.set(cookieName, `${started.credentials.id}.${started.credentials.secret}`, { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "strict", path: cookiePath, maxAge: 60 * 60 * 24 * 365 });
          return response;
        }
        if (!credentials) throw new TownPlayError("SESSION_REQUIRED", "请先开始这一段河湾手记。", 401);
        readTownPlay(credentials, profile);
        const command = body as unknown as TownPlayCommand;
        return json({ ok: true, data: command.kind === "work-step" ? await commandTownWorkStep(credentials, command) : commandTownPlay(credentials, command) });
      } catch (error) { return failure(error); }
    }
  };
}
