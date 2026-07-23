import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "WORLD_NOT_FOUND"
  | "CASE_NOT_FOUND"
  | "CASE_NOT_PLAYABLE"
  | "SESSION_NOT_FOUND"
  | "EVIDENCE_NOT_FOUND"
  | "NOVEL_PROJECT_NOT_FOUND"
  | "NOVEL_PROJECT_CONFLICT"
  | "NOVEL_IDENTITY_NOT_FOUND"
  | "NOVEL_SIMULATION_NOT_FOUND"
  | "SCENARIO_NOT_FOUND"
  | "SCENARIO_PRESET_CONFLICT"
  | "SCENARIO_PRESET_NOT_FOUND"
  | "SCENARIO_PRESET_READ_ONLY"
  | "SCENARIO_PACK_NOT_FOUND"
  | "SCENARIO_PACK_INVALID"
  | "TOWN_MAP_PACK_NOT_FOUND"
  | "TOWN_MAP_PACK_INVALID"
  | "TOWN_MAP_PACK_CONFLICT"
  | "TOWN_MAP_PACK_READ_ONLY"
  | "EXPERIMENT_PACK_NOT_FOUND"
  | "PACKAGE_NOT_FOUND"
  | "DATASET_PACKAGE_NOT_FOUND"
  | "WORLD_PACKAGE_INVALID"
  | "RUN_NOT_FOUND"
  | "RUN_JOB_NOT_FOUND"
  | "SNAPSHOT_NOT_FOUND"
  | "WORLD_ARC_DIRECTIVE_NOT_READY"
  | "PLAYER_RESOURCE_COMMITMENT_NOT_READY"
  | "WORLD_EVENT_OFFER_NOT_READY"
  | "CAMPAIGN_RECOVERY_NOT_READY"
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
