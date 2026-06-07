import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "WORLD_NOT_FOUND"
  | "CASE_NOT_FOUND"
  | "SESSION_NOT_FOUND"
  | "EVIDENCE_NOT_FOUND"
  | "INTERNAL_ERROR";

export function ok<T>(data: T) {
  return NextResponse.json({ ok: true, data });
}

export function fail(code: ApiErrorCode, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export function errorResponse(error: unknown) {
  return fail("INTERNAL_ERROR", error instanceof Error ? error.message : "Unknown error", 500);
}

export async function readJson<T>(request: Request, fallback: T): Promise<T> {
  return (await request.json().catch(() => fallback)) as T;
}
