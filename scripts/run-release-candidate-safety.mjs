import fs from "node:fs";
import path from "node:path";
import { hashPublicArtifactTree } from "./public-artifact-safety-lib.mjs";

const root = process.cwd();
const publicScopes = ["public/dataset-reader", "public/review-catalog"];
const contentScope = "content/detective-v1";
const publicForbidden = [
  /(?:api[_-]?key|secret[_-]?key|authorization\s*:\s*bearer|deepseek_api_key|siliconflow_api_key)/i,
  /(?:\.env(?:\.local)?|DATABASE_URL|sqlite|better-sqlite|agent_state_snapshot|hiddenDebugLog|checkpoint)/i,
  /"(?:culpritId|victimId|evidenceIds|sourceIds|eventId|npcId|institutionId|resourceKey|actionKey|rawBody)"\s*:/i,
  /(?<!public-)\b(?:npc|agent|case|ev|evidence|source|event|loc|inst|resource|action)-[a-z0-9_-]*\d[a-z0-9_-]*\b/i,
  /(?:[A-Za-z]:[\\/]|\/Users\/|\/home\/|\/workspace\/|\/mnt\/)/i,
  /\b(?:sk|gh[pousr]|xox[baprs])[-_][A-Za-z0-9_-]{16,}\b/i
];
const contentForbidden = [
  /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/,
  /(?:api[_-]?key|secret[_-]?key|authorization\s*:\s*bearer|deepseek_api_key|siliconflow_api_key)/i,
  /(?:\.env(?:\.local)?|DATABASE_URL|sqlite|better-sqlite|agent_state_snapshot|hiddenDebugLog|checkpoint)/i,
  /(?:[A-Za-z]:[\\/]|\/Users\/|\/home\/|\/workspace\/|\/mnt\/)/i,
  /\b(?:sk|gh[pousr]|xox[baprs])[-_][A-Za-z0-9_-]{16,}\b/i
];

function filesIn(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) return [];
  const entries = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target);
      else entries.push(target);
    }
  };
  walk(absolute);
  return entries.sort((left, right) => left.localeCompare(right));
}

function scanScope(relativePath, patterns) {
  const errors = [];
  const files = filesIn(relativePath);
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        errors.push(`${relativePath}/${path.relative(path.join(root, relativePath), file).replace(/\\/g, "/")} matches ${pattern}`);
        break;
      }
    }
  }
  return { fileCount: files.length, errors };
}

const publicResults = publicScopes.map((scope) => ({ scope, ...scanScope(scope, publicForbidden) }));
const contentResult = { scope: contentScope, ...scanScope(contentScope, contentForbidden) };
const artifactTree = hashPublicArtifactTree({ paths: publicScopes });
const errors = [...publicResults.flatMap((result) => result.errors), ...contentResult.errors];
const result = {
  ok: errors.length === 0,
  scopes: [...publicResults, contentResult],
  protectedPublicTree: { fileCount: artifactTree.fileCount, treeHash: artifactTree.treeHash },
  rules: {
    public: "safe projection only: no credentials, raw authority keys, database markers, or absolute paths; aggregate audit counters remain allowed",
    content: "source content may contain case truth fields; scan blocks credentials, runtime/database markers, and absolute paths"
  },
  errors
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
