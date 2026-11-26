import type { TownCaseView, TownClosedCaseView, TownPlayView } from "@/lib/town-play-contract";

export type ArchivedCase = {
  id: string; revision: string; ordinal: string; title: string;
  person: string; headline: string; motive: string; method: string;
  clues: TownCaseView["clues"];
  conversations: Array<{ name: string; question: string; answer: string; corrected: boolean }>;
  timeline: Array<{ time: string; event: string }>;
  ending: string[];
};
export const caseArchiveKey = (worldId: string) => `detective-town:case-archive:v1:${worldId}`;

export function confirmedClosedCases(view: TownPlayView | null): TownClosedCaseView[] {
  const c = view?.investigation;
  const current = c?.solved && c.resolution ? [{ id: c.id, ordinal: c.ordinal, title: c.title, person: c.resolution.person,
    day: view?.series?.cases.find(x => x.ordinal === c.ordinal)?.day ?? view?.day ?? 1,
    clues: c.clues.length, totalClues: c.clues.length + c.leads.reduce((sum, lead) => sum + lead.open, 0),
    testimony: c.conversations.length, corrections: c.conversations.filter(l => l.corrected).length }] : [];
  return [...new Map([...(view?.closedCases ?? []), ...current].map(item => [item.id, item])).values()];
}

/** Whitelist the released conclusion and discovered records, never the raw view. */
export function archiveSolvedCase(c: TownCaseView | null): ArchivedCase | null {
  if (!c?.solved || !c.resolution) return null;
  const r = c.resolution;
  return {
    id: c.id, revision: c.revision, ordinal: c.ordinal, title: c.title,
    person: r.person, headline: r.headline, motive: r.motive, method: r.method,
    clues: c.clues.map(e => ({ id: e.id, title: e.title, sceneId: e.sceneId, description: e.description })),
    conversations: c.conversations.map(l => ({ name: l.name, question: l.question, answer: l.answer, corrected: l.corrected })),
    timeline: r.timeline.map(t => ({ time: t.time, event: t.event })), ending: [...r.ending]
  };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid archive record");
  return value as Record<string, unknown>;
}
function strings(value: unknown, fields: string[]) {
  const row = record(value);
  return Object.fromEntries(fields.map(field => {
    if (typeof row[field] !== "string") throw new Error("Invalid archive text");
    return [field, row[field]];
  }));
}
function rows(value: unknown, fields: string[]) {
  if (!Array.isArray(value)) throw new Error("Invalid archive list");
  return value.map(item => strings(item, fields));
}
export function readCaseArchive(raw: string, worldId: string): ArchivedCase[] {
  const saved = record(JSON.parse(raw));
  if (saved.version !== 1 || saved.worldId !== worldId || !Array.isArray(saved.entries)) throw new Error("Archive scope or version changed");
  return saved.entries.map(value => {
    const item = record(value);
    const entry = strings(item, ["id", "revision", "ordinal", "title", "person", "headline", "motive", "method"]);
    const clues = rows(item.clues, ["id", "title", "sceneId", "description"]);
    const timeline = rows(item.timeline, ["time", "event"]);
    if (!Array.isArray(item.conversations) || !Array.isArray(item.ending) || !item.ending.every(s => typeof s === "string")) throw new Error("Invalid archive content");
    const conversations = item.conversations.map(value => {
      const line = record(value);
      if (typeof line.corrected !== "boolean") throw new Error("Invalid archive correction");
      return { ...strings(line, ["name", "question", "answer"]), corrected: line.corrected };
    });
    return { ...entry, clues, conversations, timeline, ending: [...item.ending] } as ArchivedCase;
  });
}

/** A failed read preserves the original storage; failed writes keep an in-page copy. */
export function rememberSolvedCase(storage: Pick<Storage, "getItem" | "setItem">, worldId: string, current: TownCaseView | null, fallback: ArchivedCase[] = []) {
  const captured = archiveSolvedCase(current);
  const merge = (entries: ArchivedCase[]) => captured ? [...entries.filter(e => e.id !== captured.id), captured] : entries;
  let raw: string | null, entries: ArchivedCase[];
  try {
    raw = storage.getItem(caseArchiveKey(worldId));
    entries = raw ? readCaseArchive(raw, worldId) : fallback;
  } catch {
    return { entries: merge(fallback), message: "本机留存暂时无法读取，旧数据已保留。请及时导出当前手记。" };
  }
  const next = merge([...new Map([...entries, ...fallback].map(entry => [entry.id, entry])).values()]);
  if (captured || fallback.length > 0) {
    const text = JSON.stringify({ version: 1, worldId, entries: next });
    try { if (raw !== text) storage.setItem(caseArchiveKey(worldId), text); }
    catch { return { entries: next, message: "完整记录暂留在当前页面，刷新后可能丢失。请及时导出手记。" }; }
  }
  return { entries: next, message: "" };
}

const heading = (text: string) => text.replace(/[\r\n]+/g, " ");
export function archivedCaseMarkdown(c: ArchivedCase, nested = false) {
  const title = nested ? "###" : "##";
  const section = `${title}#`;
  const item = `${section}#`;
  return [
    `${title} ${heading(c.ordinal)} · ${heading(c.title)}`,
    c.headline,
    `动机：${c.motive}`,
    `手法：${c.method}`,
    `${section} 已核对物证`,
    c.clues.map(e => `${item} ${heading(e.title)}\n\n${e.description}`).join("\n\n"),
    `${section} 当面证词`,
    c.conversations.map(l => `${item} ${heading(l.name)}${l.corrected ? " · 说法已更正" : ""}\n\n${l.question}\n\n${l.answer}`).join("\n\n"),
    `${section} 证据支持的经过`,
    c.timeline.map(t => `- ${t.time} ${t.event}`).join("\n"),
    `${section} 后来`,
    c.ending.join("\n\n"),
    ""
  ].join("\n\n");
}

export function townJournalMarkdown({ view, places, visited, notes, archives }: { view: TownPlayView | null; places: Array<{ id: string; label: string }>; visited: string[]; notes: string; archives: ArchivedCase[] }) {
  const current = view?.investigation;
  const solved = archiveSolvedCase(current ?? null);
  const investigation = solved ? archivedCaseMarkdown(solved) : current ? `## ${current.title}\n${current.brief}\n\n${current.clues.map(e => `### ${e.title}\n${e.description}`).join("\n\n")}\n\n## 当面证词\n${current.conversations.map(l => `### ${l.name}\n${l.question}\n${l.answer}`).join("\n\n")}\n` : "";
  const older = archives.filter(entry => entry.id !== current?.id && view?.closedCases?.some(c => c.id === entry.id));
  const missing = (view?.closedCases ?? []).filter(c => c.id !== current?.id && !older.some(e => e.id === c.id));
  const history = (older.length ? `\n## 本机留存的已结案件\n\n${older.map(c => archivedCaseMarkdown(c, true)).join("\n\n")}` : "") + (missing.length ? `\n\n## 尚无完整留存的结案摘要\n\n${missing.map(c => `- ${c.ordinal}《${c.title}》：${c.person}（本浏览器尚无完整记录）`).join("\n")}\n` : "");
  return `# 河湾手记\n\n## 已探访\n${visited.map(id => `- ${places.find(d => d.id === id)?.label ?? id}`).join("\n")}\n\n## 人物目击\n${view?.residents.map(p => `- ${p.name}（${p.role}）：第 ${p.day} 天 ${p.time}，${p.locationName}`).join("\n") || "尚无目击记录。"}\n\n## 随手记\n${notes || "尚无笔记。"}\n\n${investigation}${history}`;
}
