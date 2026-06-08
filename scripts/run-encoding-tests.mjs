import fs from "node:fs";
import path from "node:path";

const roots = ["app", "packages/engine/src", "tests/e2e"];
const extensions = new Set([".ts", ".tsx", ".mjs", ".md"]);

const mojibakeCodepoints = [
  0x93ba, // 鎺
  0x748b, // 璋
  0x95ab, // 閫
  0x941e, // 鐞
  0x9366, // 鍦
  0x93c3, // 鏃
  0x9342, // 鍒
  0x9422, // 鐢
  0x6d63, // 浣
  0x6d93, // 涓
  0x7039, // 瀹
  0x95c2, // 闂
  0x95b8, // 閸
  0x9351, // 鍑
  0x935d, // 鍝
  0x704f // 瀏
];

const mojibakeMarkers = mojibakeCodepoints.map((value) => String.fromCodePoint(value));
const allowQuestionRuns = [
  /\\?runtime=/,
  /new URLSearchParams/,
  /[A-Za-z0-9_]\\?\\./,
  /[A-Za-z0-9_]\\?\\?/,
  /\\? :/,
  /\\? "/,
  /"\\?"/,
  /\\?;/,
  /\\?:/,
  /\?\)/
];

function walk(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walk(full));
    else if (extensions.has(path.extname(entry.name))) result.push(full);
  }
  return result;
}

const failures = [];
for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      const hit = mojibakeMarkers.find((item) => line.includes(item));
      if (hit) failures.push(`${file}:${index + 1}: contains mojibake codepoint U+${hit.codePointAt(0).toString(16).toUpperCase()}`);
      if (/\?{3,}/.test(line) && !allowQuestionRuns.some((pattern) => pattern.test(line))) {
        failures.push(`${file}:${index + 1}: contains suspicious repeated question marks`);
      }
    });
  }
}

if (failures.length) {
  console.error(failures.slice(0, 80).join("\n"));
  if (failures.length > 80) console.error(`... ${failures.length - 80} more`);
  process.exit(1);
}

console.log("Encoding tests passed.");
