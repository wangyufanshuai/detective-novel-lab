import fs from "node:fs";
import path from "node:path";

const roots = ["app", "packages/engine/src", "tests/e2e"];
const extensions = new Set([".ts", ".tsx", ".mjs", ".md"]);
const forbidden = [
  "�",
  "俙",
  "鈼",
  "鉁",
  "锛",
  "姝昏",
  "鎺",
  "鍒",
  "璋",
  "鏋",
  "鍛",
  "椤",
  "閽",
  "鑽",
  "绛",
  "妗堥",
  "闆剧",
  "榛戞",
  "闀囨"
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
      const hit = forbidden.find((item) => line.includes(item));
      if (hit) failures.push(`${file}:${index + 1}: contains mojibake marker "${hit}"`);
    });
  }
}

if (failures.length) {
  console.error(failures.slice(0, 80).join("\n"));
  if (failures.length > 80) console.error(`... ${failures.length - 80} more`);
  process.exit(1);
}

console.log("Encoding tests passed.");
