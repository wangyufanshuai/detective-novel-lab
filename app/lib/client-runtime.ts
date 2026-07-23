import type { RuntimeMode } from "@/lib/engine";

type ApiResult<T> = T & { ok: boolean; error?: string };
export type V1Result<T> = { ok: boolean; data?: T; error?: { code: string; message: string } };

export class V1RequestError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message);
    this.name = "V1RequestError";
  }
}

export function apiUrl(path: string) {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

export function loadLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function cloneLocal<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function postJson<T>(url: string, body: unknown) {
  const response = await fetch(apiUrl(url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = (await response.json()) as ApiResult<T>;
  if (!data.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function getV1<T>(url: string) {
  let response = await fetch(apiUrl(url));
  let text = await response.text();
  if (text.trimStart().startsWith("<!DOCTYPE") || text.trimStart().startsWith("<html")) {
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    response = await fetch(apiUrl(url));
    text = await response.text();
  }
  const data = JSON.parse(text) as V1Result<T>;
  if (!data.ok || !data.data) throw new V1RequestError(data.error?.code || "INTERNAL_ERROR", response.status, data.error?.message || "Request failed");
  return data.data;
}

export async function postV1<T>(url: string, body: unknown) {
  const response = await fetch(apiUrl(url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = (await response.json()) as V1Result<T>;
  if (!data.ok || !data.data) throw new V1RequestError(data.error?.code || "INTERNAL_ERROR", response.status, data.error?.message || "Request failed");
  return data.data;
}

export function actorInitial(name: string) {
  return Array.from(name)[0] || "?";
}

export function slugifyLabel(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "scenario";
}

export function downloadTextFile(fileName: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function resolveRuntimeMode(): RuntimeMode {
  if (typeof window === "undefined") return "server";
  const requested = new URLSearchParams(window.location.search).get("runtime");
  if (requested === "static") return "static-demo";
  if (requested === "server") return "server";
  return process.env.NEXT_PUBLIC_DEMO_MODE === "static" ? "static-demo" : "server";
}
