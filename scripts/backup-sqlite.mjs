import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--database") result.database = argv[index += 1];
    else if (item === "--out") result.out = argv[index += 1];
    else if (item === "--label") result.label = argv[index += 1];
  }
  return result;
}

function databasePath(input = process.env.DATABASE_URL || "file:./data/mystery-town.db") {
  if (input === "file:./data/mystery-town.db" || input === "./data/mystery-town.db") {
    return path.join(process.cwd(), "data", "mystery-town.db");
  }
  const rawPath = input.startsWith("file:") ? input.slice(5) : input;
  return path.isAbsolute(rawPath) ? rawPath : path.join(process.cwd(), "data", path.basename(rawPath));
}

function safeLabel(input) {
  return (input || "manual").replace(/[^a-z0-9-]/gi, "-").toLowerCase().replace(/-+/g, "-").replace(/^-|-$/g, "") || "manual";
}

const args = parseArgs(process.argv.slice(2));
const sourcePath = databasePath(args.database);
if (!fs.existsSync(sourcePath)) {
  throw new Error(`SQLite database not found: ${sourcePath}`);
}

const outputDir = path.resolve(args.out || path.join(process.cwd(), "outputs", "backups"));
fs.mkdirSync(outputDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(outputDir, `mystery-town-${safeLabel(args.label)}-${timestamp}.db`);

const db = new Database(sourcePath, { readonly: true, fileMustExist: true });
try {
  await db.backup(backupPath);
} finally {
  db.close();
}

const summary = {
  ok: true,
  sourcePath,
  backupPath,
  bytes: fs.statSync(backupPath).size,
  createdAt: new Date().toISOString()
};

console.log(JSON.stringify(summary, null, 2));
