import fs from "node:fs";
import path from "node:path";

const roots = ["app", "packages/engine/src", "tests/e2e"];
const extensions = new Set([".ts", ".tsx", ".mjs", ".md"]);

const mojibakeMarkers = [
  "鎺", "璋", "閫", "鐞", "鍦", "鏃", "鍂", "鐢", "浣", "涓", "瀹", "闂", "閸", "鍑", "鍝", "灏",
  "瑙", "褰", "寤", "琛", "鍓", "澶", "妗", "彂", "煡", "瘝", "悊", "磋", "晣", "绗", "閿", "墽",
  "戠", "勭", "叧", "佸", "枃", "鉁"
];

const allowQuestionRuns = [
  /\?runtime=/,
  /new URLSearchParams/,
  /[A-Za-z0-9_]\?\./,
  /[A-Za-z0-9_]\?\?/,
  /\? :/,
  /\? "/,
  /"\?"/,
  /\?;/,
  /\?:/,
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
      if (hit) failures.push(`${file}:${index + 1}: contains mojibake marker ${hit}`);
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
