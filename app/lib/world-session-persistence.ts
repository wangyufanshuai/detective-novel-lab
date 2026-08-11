export const WORLD_SESSION_STORAGE_KEY = "detective-town-launch-v1";
export const WORLD_BOOTSTRAP_STORAGE_KEY = "detective-town-bootstrap-v1";
export const WORLD_SESSION_FORMAT_VERSION = 1 as const;

export type WorldSessionPointer = {
  formatVersion: typeof WORLD_SESSION_FORMAT_VERSION;
  worldId: string;
  sessionId: string;
};

export type WorldSessionPointerResult = {
  status: "empty" | "ready" | "legacy" | "invalid";
  pointer: WorldSessionPointer | null;
};

const SAFE_POINTER_VALUE = /^[A-Za-z0-9._:-]{1,180}$/;

function safePointerPart(value: unknown, required: boolean) {
  if (value === undefined || value === null || value === "") return required ? null : "";
  if (typeof value !== "string" || !SAFE_POINTER_VALUE.test(value)) return null;
  return value;
}

export function normalizeWorldSessionPointer(value: unknown): WorldSessionPointerResult {
  if (value === undefined || value === null || value === "") return { status: "empty", pointer: null };
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { return { status: "invalid", pointer: null }; }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { status: "invalid", pointer: null };
  const record = parsed as Record<string, unknown>;
  const worldId = safePointerPart(record.worldId, true);
  const sessionId = safePointerPart(record.sessionId, false);
  if (worldId === null || sessionId === null) return { status: "invalid", pointer: null };
  const pointer: WorldSessionPointer = { formatVersion: WORLD_SESSION_FORMAT_VERSION, worldId, sessionId };
  if (record.formatVersion === undefined) return { status: "legacy", pointer };
  if (record.formatVersion !== WORLD_SESSION_FORMAT_VERSION) return { status: "invalid", pointer: null };
  return { status: "ready", pointer };
}

export function serializeWorldSessionPointer(worldId: string, sessionId = "") {
  const normalized = normalizeWorldSessionPointer({ formatVersion: WORLD_SESSION_FORMAT_VERSION, worldId, sessionId });
  return normalized.pointer ? JSON.stringify(normalized.pointer) : null;
}

const UNSAFE_ERROR_TEXT = /\b(?:culpritId|victimId|caseId|sessionId|worldId|npcId|sourceId|eventId|hiddenTruth|rawBody|sqlite)\b|[A-Za-z]:[\\/]|(?:Error|TypeError):|\bat\s+\S+\s+\(/i;

export function clientErrorIsPublicSafe(error: unknown) {
  return error instanceof Error && Boolean(error.message) && error.message.length <= 180 && !UNSAFE_ERROR_TEXT.test(error.message);
}
